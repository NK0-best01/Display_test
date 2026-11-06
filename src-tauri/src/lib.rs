use std::fs;
use std::path::{Path as StdPath, PathBuf};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::Manager;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct MediaIndexResponse {
    pub files: Vec<String>,
}

fn determine_video_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // 1. ตรวจสอบโฟลเดอร์ videos ในไดเรกทอรีปัจจุบัน (สำหรับการรันโหมด Dev)
    if let Ok(cwd) = std::env::current_dir() {
        let dev_videos = cwd.join("videos");
        if dev_videos.exists() || (!cfg!(not(debug_assertions)) && fs::create_dir_all(&dev_videos).is_ok()) {
            return Ok(dev_videos);
        }
    }

    // 2. ตรวจสอบข้างไฟล์ executable (สำหรับโหมด Production / ติดตั้ง)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_videos = exe_dir.join("videos");
            if fs::create_dir_all(&exe_videos).is_ok() {
                // ทดสอบสิทธิ์การเขียน
                let test_file = exe_videos.join(".probe_write");
                if fs::write(&test_file, b"ok").is_ok() {
                    let _ = fs::remove_file(test_file);
                    return Ok(exe_videos);
                }
            }
        }
    }

    // 3. Fallback ไปยัง app_local_data_dir ของระบบ (เช่น %LOCALAPPDATA% บน Windows)
    let local_data = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("ไม่สามารถอ่าน app_local_data_dir ได้: {}", e))?;
    let data_videos = local_data.join("videos");
    fs::create_dir_all(&data_videos)
        .map_err(|e| format!("ไม่สามารถสร้างโฟลเดอร์ videos ได้: {}", e))?;
    Ok(data_videos)
}

#[tauri::command]
fn get_video_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = determine_video_dir(&app)?;
    let _ = app.asset_protocol_scope().allow_directory(&dir, true);
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn list_videos(app: tauri::AppHandle) -> Result<Vec<VideoFileInfo>, String> {
    let dir = determine_video_dir(&app)?;
    let _ = app.asset_protocol_scope().allow_directory(&dir, true);

    let mut result = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("ไม่สามารถอ่านโฟลเดอร์ {}: {}", dir.display(), e))?;

    let valid_exts = ["mp4", "webm", "mkv", "mov", "m4v", "ogv"];

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            // ข้ามไฟล์ที่ขึ้นต้นด้วย . หรือลงท้ายด้วย .tmp/.part
            if name.starts_with('.') || name.ends_with(".tmp") || name.ends_with(".part") {
                continue;
            }
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                let ext_lower = ext.to_ascii_lowercase();
                if valid_exts.contains(&ext_lower.as_str()) {
                    let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    result.push(VideoFileInfo {
                        name,
                        path: path.to_string_lossy().to_string(),
                        size_bytes,
                    });
                }
            }
        }
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

#[tauri::command]
fn open_video_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = determine_video_dir(&app)?;
    let dir_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("ไม่สามารถเปิดโฟลเดอร์ได้: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("ไม่สามารถเปิดโฟลเดอร์ได้: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("ไม่สามารถเปิดโฟลเดอร์ได้: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// -----------------------------------------------------------------------------
// Local HTTP Streaming Server (รองรับ HTTP Range Request สำหรับ WebKitGTK / Windows)
// -----------------------------------------------------------------------------

fn get_mime_type(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "mov" => "video/quicktime",
        "m4v" => "video/x-m4v",
        "ogv" => "video/ogg",
        _ => "application/octet-stream",
    }
}

fn parse_range_header(header_val: &str, file_size: u64) -> Option<(u64, u64)> {
    if file_size == 0 {
        return None;
    }
    let trimmed = header_val.trim();
    if !trimmed.starts_with("bytes=") {
        return None;
    }
    let spec = &trimmed["bytes=".len()..];
    let first_range = spec.split(',').next()?.trim();
    let parts: Vec<&str> = first_range.split('-').collect();
    if parts.len() != 2 {
        return None;
    }

    let start_part = parts[0].trim();
    let end_part = parts[1].trim();

    if start_part.is_empty() && !end_part.is_empty() {
        // รูปแบบ bytes=-suffix
        let suffix: u64 = end_part.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = if suffix >= file_size { 0 } else { file_size - suffix };
        Some((start, file_size - 1))
    } else if !start_part.is_empty() && end_part.is_empty() {
        // รูปแบบ bytes=start-
        let start: u64 = start_part.parse().ok()?;
        if start >= file_size {
            return None;
        }
        Some((start, file_size - 1))
    } else if !start_part.is_empty() && !end_part.is_empty() {
        // รูปแบบ bytes=start-end
        let start: u64 = start_part.parse().ok()?;
        let end: u64 = end_part.parse().ok()?;
        if start > end || start >= file_size {
            return None;
        }
        let end = end.min(file_size - 1);
        Some((start, end))
    } else {
        None
    }
}

async fn handle_media_index(State(dir): State<Arc<PathBuf>>) -> impl IntoResponse {
    let mut files = Vec::new();
    let valid_exts = ["mp4", "webm", "mkv", "mov", "m4v", "ogv"];

    if let Ok(entries) = fs::read_dir(dir.as_ref()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if name.starts_with('.') || name.ends_with(".tmp") || name.ends_with(".part") {
                    continue;
                }
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if valid_exts.contains(&ext.to_ascii_lowercase().as_str()) {
                        files.push(name);
                    }
                }
            }
        }
    }

    files.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    (headers, Json(MediaIndexResponse { files }))
}

async fn handle_media_file(
    State(dir): State<Arc<PathBuf>>,
    Path(filename): Path<String>,
    headers: HeaderMap,
) -> Response {
    // ป้องกัน Directory Traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }

    let file_path = dir.join(&filename);
    if !file_path.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    let metadata = match tokio::fs::metadata(&file_path).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Cannot read metadata").into_response(),
    };
    let file_size = metadata.len();

    let ext = StdPath::new(&filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let mime = get_mime_type(ext);

    let mut tokio_file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Cannot open file").into_response(),
    };

    // ตรวจสอบ Range Header
    if let Some(range_header) = headers.get(header::RANGE).and_then(|h| h.to_str().ok()) {
        if let Some((start, end)) = parse_range_header(range_header, file_size) {
            let len = end - start + 1;

            if tokio_file.seek(SeekFrom::Start(start)).await.is_err() {
                return (StatusCode::INTERNAL_SERVER_ERROR, "Seek error").into_response();
            }

            let take = tokio_file.take(len);
            let stream = ReaderStream::new(take);
            let body = Body::from_stream(stream);

            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            resp_headers.insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end, file_size)).unwrap(),
            );
            resp_headers.insert(
                header::CONTENT_LENGTH,
                HeaderValue::from_str(&len.to_string()).unwrap(),
            );
            resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));

            return (StatusCode::PARTIAL_CONTENT, resp_headers, body).into_response();
        } else {
            // Range ไม่ถูกต้อง
            let mut err_headers = HeaderMap::new();
            err_headers.insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes */{}", file_size)).unwrap(),
            );
            return (StatusCode::RANGE_NOT_SATISFIABLE, err_headers, "Range Not Satisfiable").into_response();
        }
    }

    // ไม่มี Range Header (ส่งทั้งไฟล์)
    let stream = ReaderStream::new(tokio_file);
    let body = Body::from_stream(stream);

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
    resp_headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&file_size.to_string()).unwrap(),
    );
    resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));

    (StatusCode::OK, resp_headers, body).into_response()
}

async fn start_media_server(media_dir: PathBuf) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dir = Arc::new(media_dir);

    let app = Router::new()
        .route("/videos/index.json", get(handle_media_index))
        .route("/media/index.json", get(handle_media_index))
        .route("/videos/:filename", get(handle_media_file))
        .route("/media/:filename", get(handle_media_file))
        .layer(CorsLayer::permissive())
        .with_state(dir);

    // Bind เฉพาะ 127.0.0.1:8765 ตามข้อกำหนดความปลอดภัย Kiosk
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 8765));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Ok(dir) = determine_video_dir(&app.handle()) {
                let _ = app.asset_protocol_scope().allow_directory(&dir, true);

                // เริ่มต้น Local HTTP Server สำหรับการสตรีมวิดีโอ (127.0.0.1:8765)
                let server_dir = dir.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = start_media_server(server_dir).await {
                        eprintln!("Local media server error: {}", e);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_video_dir,
            list_videos,
            open_video_dir,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
