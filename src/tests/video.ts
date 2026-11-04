import type { TestModule, TestModuleId } from "../core/types";
import { normalizeKey } from "../core/keys";

export interface VideoFileInfo {
  name: string;
  path: string;
  size_bytes: number;
}

export type VideoAspectMode = "contain" | "none" | "fill";

const ASPECT_MODE_LABELS: Record<VideoAspectMode, string> = {
  contain: "พอดีจอ (รักษาสัดส่วน)",
  none: "ขนาดจริง 1:1 (ไม่ขยาย)",
  fill: "ยืดเต็มจอ",
};

/**
 * โมดูลทดสอบเล่นวิดีโอ (Video Playback Test)
 * รองรับการทดสอบภาพเคลื่อนไหว ความลื่นไหล การฉีกของภาพ และสี จากไฟล์ในโฟลเดอร์ videos/
 */
export class VideoTestModule implements TestModule {
  public readonly id: TestModuleId = "video";
  public readonly title = "8. ทดสอบวิดีโอ (Video)";
  public readonly description =
    "เล่นวิดีโอจากโฟลเดอร์ videos ทดสอบความลื่นไหล สี และอัตราเฟรมตกเต็มจอ";
  public readonly controlsHint =
    "Space: เล่น/หยุด | ←/→: ไฟล์ก่อนหน้า/ถัดไป | Z: โหมดภาพ | L: วนซ้ำ | M: เสียง | Esc: ย้อนกลับ";
  public readonly usesTouchDirectly = true;

  private onStatusChange?: (status: string) => void;
  private canvas: HTMLCanvasElement | null = null;
    private container: HTMLElement | null = null;

  // สถานะหลัก
  private state: "list" | "playing" = "list";
  private videoDir = "";
  private videoList: VideoFileInfo[] = [];
  private selectedIndex = 0;
  private isLoading = true;
  public errorMessage: string | null = null;

  // วิดีโอ Element ขณะเล่น
  private videoElement: HTMLVideoElement | null = null;
  private aspectMode: VideoAspectMode = "contain";
  private isLooping = true;
  private isMuted = false;
  private updateIntervalId: number | null = null;

  // UI สำหรับหน้ารายการ
  private listOverlayElement: HTMLDivElement | null = null;

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  public async start(canvas: HTMLCanvasElement, _ctx: CanvasRenderingContext2D): Promise<void> {
    this.canvas = canvas;
        this.container = canvas.parentElement;
    this.state = "list";
    this.errorMessage = null;

    // โหลดรายชื่อโฟลเดอร์และไฟล์วิดีโอ
    await this.scanVideos();
    this.renderCurrentState();
  }

  public stop(): void {
    this.cleanupPlayback();
    this.cleanupListUi();
    this.canvas = null;
        this.container = null;
  }

  /**
   * สแกนรายชื่อไฟล์วิดีโอผ่าน Tauri API
   */
  public async scanVideos(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.renderCurrentState();

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const [dir, list] = await Promise.all([
        invoke<string>("get_video_dir"),
        invoke<VideoFileInfo[]>("list_videos"),
      ]);
      this.videoDir = dir;
      this.videoList = list;
    } catch {
      // Fallback สำหรับโหมดเบราว์เซอร์ / ทดสอบ
      this.videoDir = "videos";
      this.videoList = [];
    } finally {
      this.isLoading = false;
      if (this.selectedIndex >= this.videoList.length) {
        this.selectedIndex = Math.max(0, this.videoList.length - 1);
      }
      this.renderCurrentState();
    }
  }

  /**
   * เปิดโฟลเดอร์ videos ใน File Explorer
   */
  public async openFolder(): Promise<void> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_video_dir");
    } catch {
      console.warn("ไม่สามารถเปิดโฟลเดอร์ได้นอกสภาพแวดล้อม Tauri");
    }
  }

  public onKey(e: KeyboardEvent): void {
    const key = normalizeKey(e);
    if (!key) return;

    if (this.state === "list") {
      if (key === "r" || key === "R") {
        e.preventDefault();
        void this.scanVideos();
      } else if (key === "o" || key === "O") {
        e.preventDefault();
        void this.openFolder();
      } else if (key === "ArrowUp") {
        e.preventDefault();
        if (this.videoList.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.videoList.length) % this.videoList.length;
          this.renderListUi();
        }
      } else if (key === "ArrowDown") {
        e.preventDefault();
        if (this.videoList.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.videoList.length;
          this.renderListUi();
        }
      } else if (key === "Enter" || key === " ") {
        e.preventDefault();
        if (this.videoList.length > 0) {
          const file = this.videoList[this.selectedIndex];
          if (file) void this.playVideo(this.selectedIndex);
        }
      }
      // ปุ่มตัวเลข 1-9 ในหน้ารายการเพื่อเลือกไฟล์เร็ว
      const num = Number.parseInt(key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= this.videoList.length && num <= 9) {
        e.preventDefault();
        void this.playVideo(num - 1);
      }
    } else if (this.state === "playing") {
      if (key === "Escape") {
        // ย้อนกลับจากหน้าเล่นวิดีโอไปยังหน้ารายการ (ดักจับไว้ไม่ให้หลุดกลับเมนูหลักทันที)
        e.preventDefault();
        this.stopVideoAndBackToList();
        return;
      }

      if (key === " ") {
        e.preventDefault();
        this.togglePlayPause();
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        this.playPreviousVideo();
      } else if (key === "ArrowRight") {
        e.preventDefault();
        this.playNextVideo();
      } else if (key === "z" || key === "Z") {
        e.preventDefault();
        this.cycleAspectMode();
      } else if (key === "l" || key === "L") {
        e.preventDefault();
        this.toggleLoop();
      } else if (key === "m" || key === "M") {
        e.preventDefault();
        this.toggleMute();
      }
    }
  }

  public onPointer(e: PointerEvent): void {
    if (this.state === "playing" && e.type === "pointerdown") {
      const w = window.innerWidth;
      const x = e.clientX;

      // สัมผัส 1/3 ทางซ้าย: ก่อนหน้า, 1/3 ทางขวา: ถัดไป, ตรงกลาง: เล่น/หยุด
      if (x < w * 0.33) {
        this.playPreviousVideo();
      } else if (x > w * 0.67) {
        this.playNextVideo();
      } else {
        this.togglePlayPause();
      }
    }
  }

  public onResize(_canvas: HTMLCanvasElement, _ctx: CanvasRenderingContext2D): void {
    if (this.state === "list") {
      this.renderListUi();
    }
  }

  /**
   * เริ่มเล่นไฟล์วิดีโอตามดัชนี
   */
  public async playVideo(index: number): Promise<void> {
    if (index < 0 || index >= this.videoList.length) return;

    this.selectedIndex = index;
    const file = this.videoList[index];
    if (!file) return;

    this.state = "playing";
    this.errorMessage = null;
    this.cleanupListUi();

    if (this.canvas) {
      this.canvas.style.display = "none";
    }

    // สร้าง element <video> เต็มจอ
    this.cleanupPlayback();
    const video = document.createElement("video");
    video.className = "w-full h-full absolute inset-0 bg-black z-10";
    video.autoplay = true;
    video.playsInline = true;
    video.loop = this.isLooping;
    video.muted = this.isMuted;
    this.applyAspectModeStyle(video);

    // แปลง path สำหรับ asset protocol ของ Tauri
    let videoSrc = file.path;
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      videoSrc = convertFileSrc(file.path);
    } catch {
      // โหมดทดสอบนอก Tauri
    }

    video.src = videoSrc;

    // จัดการข้อผิดพลาดกรณี Codec ไม่รองรับ
    video.addEventListener("error", () => {
      const err = video.error;
      let detail = "รูปแบบไฟล์หรือ Codec ไม่รองรับบนระบบนี้";
      if (err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        detail = "รูปแบบวิดีโอหรือตัวถอดรหัส (Codec) ไม่รองรับ";
      } else if (err?.code === MediaError.MEDIA_ERR_DECODE) {
        detail = "เกิดข้อผิดพลาดในการถอดรหัสวิดีโอ";
      }
      this.showPlaybackError(detail);
    });

    video.addEventListener("loadedmetadata", () => {
      this.emitStatus();
    });

    video.addEventListener("play", () => this.emitStatus());
    video.addEventListener("pause", () => this.emitStatus());

    this.container?.appendChild(video);
    this.videoElement = video;

    try {
      await video.play();
    } catch (err) {
      console.warn("Autoplay block:", err);
    }

    this.startStatusUpdater();
  }

  public playNextVideo(): void {
    if (this.videoList.length === 0) return;
    const next = (this.selectedIndex + 1) % this.videoList.length;
    void this.playVideo(next);
  }

  public playPreviousVideo(): void {
    if (this.videoList.length === 0) return;
    const prev = (this.selectedIndex - 1 + this.videoList.length) % this.videoList.length;
    void this.playVideo(prev);
  }

  public togglePlayPause(): void {
    if (!this.videoElement) return;
    if (this.videoElement.paused) {
      void this.videoElement.play();
    } else {
      this.videoElement.pause();
    }
    this.emitStatus();
  }

  public cycleAspectMode(): void {
    if (this.aspectMode === "contain") {
      this.aspectMode = "none";
    } else if (this.aspectMode === "none") {
      this.aspectMode = "fill";
    } else {
      this.aspectMode = "contain";
    }

    if (this.videoElement) {
      this.applyAspectModeStyle(this.videoElement);
    }
    this.emitStatus();
  }

  private applyAspectModeStyle(video: HTMLVideoElement): void {
    video.style.objectFit = this.aspectMode;
  }

  public toggleLoop(): void {
    this.isLooping = !this.isLooping;
    if (this.videoElement) {
      this.videoElement.loop = this.isLooping;
    }
    this.emitStatus();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.videoElement) {
      this.videoElement.muted = this.isMuted;
    }
    this.emitStatus();
  }

  public stopVideoAndBackToList(): void {
    this.cleanupPlayback();
    this.state = "list";
    if (this.canvas) {
      this.canvas.style.display = "block";
    }
    this.renderCurrentState();
  }

  private showPlaybackError(message: string): void {
    this.errorMessage = message;
    this.emitStatus();

    // แสดงแจ้งเตือนบนหน้าจอให้ผู้ใช้เห็นชัดเจนพร้อมปุ่มข้าม
    const existing = document.getElementById("video-error-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "video-error-overlay";
    overlay.className =
      "absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-6 text-center text-white";
    overlay.innerHTML = `
      <div class="max-w-md p-6 rounded-2xl bg-neutral-900 border border-red-500/50 shadow-2xl space-y-4">
        <div class="text-4xl">⚠️</div>
        <h2 class="text-xl font-bold text-red-400">ไม่สามารถเล่นไฟล์นี้ได้</h2>
        <p class="text-sm text-neutral-300 leading-relaxed">${message}</p>
        <p class="text-xs text-neutral-400 font-mono">ไฟล์: ${this.videoList[this.selectedIndex]?.name ?? ""}</p>
        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button id="btn-err-next" type="button" class="touch-btn px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold text-sm text-white shadow-lg">
            เล่นไฟล์ถัดไป [→]
          </button>
          <button id="btn-err-back" type="button" class="touch-btn px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-sm text-neutral-200 border border-neutral-700 shadow-lg">
            กลับหน้ารายการ [Esc]
          </button>
        </div>
      </div>
    `;

    overlay.querySelector("#btn-err-next")?.addEventListener("click", () => {
      overlay.remove();
      this.playNextVideo();
    });

    overlay.querySelector("#btn-err-back")?.addEventListener("click", () => {
      overlay.remove();
      this.stopVideoAndBackToList();
    });

    this.container?.appendChild(overlay);
  }

  private startStatusUpdater(): void {
    this.stopStatusUpdater();
    this.updateIntervalId = window.setInterval(() => {
      this.emitStatus();
    }, 500);
  }

  private stopStatusUpdater(): void {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  private emitStatus(): void {
    if (this.state === "list") {
      this.onStatusChange?.(
        `[หน้ารายการวิดีโอ] พบ ${this.videoList.length} ไฟล์ | ↑/↓ เลือก | Enter/แตะ เพื่อเล่น | R สแกนใหม่ | O เปิดโฟลเดอร์`
      );
      return;
    }

    if (!this.videoElement) return;

    const file = this.videoList[this.selectedIndex];
    const name = file ? file.name : "วิดีโอ";
    const res = `${this.videoElement.videoWidth}×${this.videoElement.videoHeight}`;
    const curTime = formatSeconds(this.videoElement.currentTime);
    const totalTime = formatSeconds(this.videoElement.duration || 0);
    const playState = this.videoElement.paused ? "⏸ พัก" : "▶ เล่น";
    const modeLabel = ASPECT_MODE_LABELS[this.aspectMode];
    const loopStr = this.isLooping ? "วนซ้ำ" : "เล่นครั้งเดียว";
    const muteStr = this.isMuted ? "🔇 ปิดเสียง" : "🔊 เปิดเสียง";

    // อ่านจำนวนเฟรมตกผ่าน getVideoPlaybackQuality
    let droppedStr = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (this.videoElement as any).getVideoPlaybackQuality?.();
    if (q) {
      droppedStr = ` | เฟรมตก: ${q.droppedVideoFrames}/${q.totalVideoFrames}`;
    }

    this.onStatusChange?.(
      `[${playState} ${this.selectedIndex + 1}/${this.videoList.length}] ${name} (${res}) | ${curTime}/${totalTime} | ${modeLabel} | ${loopStr} | ${muteStr}${droppedStr}`
    );
  }

  private renderCurrentState(): void {
    if (this.state === "list") {
      this.renderListUi();
    }
  }

  private cleanupPlayback(): void {
    this.stopStatusUpdater();
    const errOverlay = document.getElementById("video-error-overlay");
    if (errOverlay) errOverlay.remove();

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute("src");
      this.videoElement.load();
      this.videoElement.remove();
      this.videoElement = null;
    }
  }

  private cleanupListUi(): void {
    if (this.listOverlayElement) {
      this.listOverlayElement.remove();
      this.listOverlayElement = null;
    }
  }

  /**
   * เรนเดอร์หน้ารายการไฟล์วิดีโอ (List Screen)
   */
  private renderListUi(): void {
    this.cleanupListUi();
    if (!this.container) return;

    const overlay = document.createElement("div");
    this.listOverlayElement = overlay;
    overlay.className =
      "w-full h-full absolute inset-0 bg-neutral-950 text-neutral-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 overflow-y-auto z-10";

    const hasVideos = this.videoList.length > 0;

    let contentHtml = "";
    if (this.isLoading) {
      contentHtml = `
        <div class="my-auto flex flex-col items-center justify-center text-center py-12">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mb-4"></div>
          <p class="text-base font-semibold text-neutral-300">กำลังสแกนหาไฟล์วิดีโอ...</p>
        </div>
      `;
    } else if (!hasVideos) {
      contentHtml = `
        <div class="my-auto max-w-2xl mx-auto flex flex-col items-center justify-center text-center p-6 sm:p-8 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl">
          <div class="text-5xl sm:text-6xl mb-4">🎬</div>
          <h2 class="text-xl sm:text-2xl font-bold text-white mb-2">ยังไม่มีไฟล์วิดีโอ</h2>
          <p class="text-sm text-neutral-400 mb-4 leading-relaxed">
            กรุณานำไฟล์วิดีโอ (.mp4, .webm, .mkv, .mov, .m4v, .ogv) ใส่ลงในโฟลเดอร์ต่อไปนี้:
          </p>
          <div class="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-6 text-xs sm:text-sm font-mono text-cyan-400 break-all select-all">
            ${this.videoDir || "videos/"}
          </div>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <button id="btn-open-folder" type="button" class="touch-btn px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-sm text-white shadow-md">
              📁 เปิดโฟลเดอร์วิดีโอ [O]
            </button>
            <button id="btn-rescan-empty" type="button" class="touch-btn px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-sm text-neutral-200 border border-neutral-700 shadow-md">
              🔄 สแกนใหม่ [R]
            </button>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="my-auto py-2">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-neutral-400">เลือกวิดีโอที่ต้องการทดสอบ (${this.videoList.length} ไฟล์):</span>
            <span class="text-xs font-mono text-neutral-500">${this.videoDir}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            ${this.videoList
              .map((file, idx) => {
                const isSelected = idx === this.selectedIndex;
                const sizeMb = (file.size_bytes / (1024 * 1024)).toFixed(1);
                const ext = file.name.split(".").pop()?.toUpperCase() ?? "VIDEO";
                return `
                  <button
                    type="button"
                    data-video-idx="${idx}"
                    class="touch-btn text-left flex flex-col justify-between p-4 rounded-2xl border transition-all min-h-[96px] ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-500/10"
                        : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                    }"
                  >
                    <div class="flex items-center justify-between w-full mb-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        isSelected
                          ? "bg-cyan-500 text-neutral-950"
                          : "bg-neutral-800 text-neutral-300"
                      }">
                        #${idx + 1} • ${ext}
                      </span>
                      <span class="text-[11px] font-mono text-neutral-400">
                        ${sizeMb} MB
                      </span>
                    </div>
                    <div class="font-bold text-sm sm:text-base text-white truncate w-full" title="${file.name}">
                      ${file.name}
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <!-- Header -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>🎬</span> ทดสอบวิดีโอเต็มจอ (Video Playback Test)
          </h1>
          <p class="text-xs text-neutral-400 mt-0.5">
            โฟลเดอร์: <span class="font-mono text-cyan-400">${this.videoDir || "videos/"}</span>
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          <button
            id="btn-open-folder-top"
            type="button"
            class="touch-btn px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700 text-xs sm:text-sm font-semibold text-neutral-100 transition-colors shadow-sm"
          >
            📁 เปิดโฟลเดอร์ [O]
          </button>
          <button
            id="btn-rescan-top"
            type="button"
            class="touch-btn px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-xs sm:text-sm font-bold text-white transition-colors shadow-sm"
          >
            🔄 สแกนใหม่ [R]
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col justify-center">
        ${contentHtml}
      </main>

      <!-- Footer Hints -->
      <footer class="border-t border-neutral-800 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
        <div>
          <span class="text-neutral-300 font-semibold">การควบคุม:</span>
          แตะเลือกวิดีโอหรือกด <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Enter</kbd> เพื่อเล่นเต็มจอ
          | กด <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Esc</kbd> เพื่อกลับเมนูหลัก
        </div>
        <div>
          ขณะเล่น: <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Space</kbd> เล่น/หยุด
          | <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Z</kbd> โหมดภาพ
          | <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">←/→</kbd> เปลี่ยนไฟล์
        </div>
      </footer>
    `;

    // ผูก Event
    overlay.querySelectorAll<HTMLButtonElement>("[data-video-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number.parseInt(btn.getAttribute("data-video-idx") || "0", 10);
        void this.playVideo(idx);
      });
    });

    overlay.querySelector("#btn-open-folder")?.addEventListener("click", () => void this.openFolder());
    overlay.querySelector("#btn-open-folder-top")?.addEventListener("click", () => void this.openFolder());
    overlay.querySelector("#btn-rescan-empty")?.addEventListener("click", () => void this.scanVideos());
    overlay.querySelector("#btn-rescan-top")?.addEventListener("click", () => void this.scanVideos());

    this.container.appendChild(overlay);
    this.emitStatus();
  }
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
