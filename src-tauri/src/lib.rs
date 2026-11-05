use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
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
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                let ext_lower = ext.to_ascii_lowercase();
                if valid_exts.contains(&ext_lower.as_str()) {
                    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Ok(dir) = determine_video_dir(&app.handle()) {
                let _ = app.asset_protocol_scope().allow_directory(&dir, true);
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
