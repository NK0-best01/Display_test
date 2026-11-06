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

// ค่าคงที่ตามข้อกำหนด Kiosk เสถียรภาพสูง 24 ชม.
const SERVER = "http://127.0.0.1:8765";
const WATCHDOG_TIMEOUT = 12_000; // ไม่มี progress เกินนี้ = ค้าง (12 วิ)
const WATCHDOG_CHECK = 5_000;    // ตรวจสอบ watchdog ทุก 5 วิ
const ERROR_THROTTLE = 300;      // หน่วงเวลา error ไม่ให้วนลูปเร็วกว่า 300ms

/**
 * โมดูลทดสอบเล่นวิดีโอ (Video Playback Test)
 * ออกแบบตามข้อกำหนด Kiosk 24 ชม. สำหรับ Linux WebKitGTK และ Windows
 * - สตรีมผ่าน Local HTTP Server (รองรับ HTTP 206 Range)
 * - เล่นผ่าน Dynamic iframe (ทำลายและสร้างใหม่ทุกคลิปเพื่อคืน dmabuf/GPU memory)
 * - มี Watchdog กันค้าง และ Error Throttle
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

      // Iframe และสถานะขณะเล่น
      private currentIframe: HTMLIFrameElement | null = null;
      private isPaused = false;
      private aspectMode: VideoAspectMode = "contain";
      private isLooping = true;
      private isMuted = false;

      // เมตริกและสถานะวิดีโอปัจจุบัน
      private currentVideoWidth = 0;
      private currentVideoHeight = 0;
      private currentVideoDuration = 0;
      private currentVideoTime = 0;

      // ตัวจับเวลาและ Watchdog
      private watchdogIntervalId: number | null = null;
      private lastProgressTime = 0;
      private lastErrorTime = 0;

      // UI สำหรับหน้ารายการ
      private listOverlayElement: HTMLDivElement | null = null;

      // แถบควบคุมสัมผัสขณะเล่นวิดีโอ
      private playbackControlsEl: HTMLDivElement | null = null;

      // Bound listener สำหรับ postMessage จาก iframe
      private boundMessageListener: (e: MessageEvent) => void;

      constructor(onStatusChange?: (status: string) => void) {
            this.onStatusChange = onStatusChange;
            this.boundMessageListener = (e: MessageEvent) => this.handleIframeMessage(e);
      }

      public async start(canvas: HTMLCanvasElement, _ctx: CanvasRenderingContext2D): Promise<void> {
            this.canvas = canvas;
            this.container = canvas.parentElement;
            this.state = "list";
            this.errorMessage = null;

            window.addEventListener("message", this.boundMessageListener);

            // โหลดรายชื่อโฟลเดอร์และไฟล์วิดีโอ
            await this.scanVideos();
            this.renderCurrentState();
      }

      public stop(): void {
            window.removeEventListener("message", this.boundMessageListener);
            this.cleanupPlayback();
            this.cleanupListUi();
            this.canvas = null;
            this.container = null;
      }

      /**
       * สแกนรายชื่อไฟล์วิดีโอผ่าน HTTP server และ Tauri API
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
                  // Fallback สำหรับโหมดเบราว์เซอร์ / ทดสอบผ่าน Local HTTP
                  try {
                        const res = await fetch(`${SERVER}/videos/index.json`, { cache: "no-store" });
                        if (res.ok) {
                              const data = (await res.json()) as { files: string[] };
                              this.videoDir = "videos";
                              this.videoList = data.files.map((name) => ({
                                    name,
                                    path: name,
                                    size_bytes: 0,
                              }));
                        } else {
                              this.videoDir = "videos";
                              this.videoList = [];
                        }
                  } catch {
                        this.videoDir = "videos";
                        this.videoList = [];
                  }
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
                  this.renderPlaybackControls();
            }
      }

      public onResize(_canvas: HTMLCanvasElement, _ctx: CanvasRenderingContext2D): void {
            if (this.state === "list") {
                  this.renderListUi();
            }
      }

      /**
       * เริ่มเล่นไฟล์วิดีโอตามดัชนีผ่าน Dynamic Iframe + Local HTTP Streaming Server
       */
      public playVideo(index: number, isError = false): void {
            if (this.videoList.length === 0) return;

            // Error throttle ป้องกัน loop เร็วเกิน 300ms
            if (isError) {
                  const now = Date.now();
                  if (now - this.lastErrorTime < ERROR_THROTTLE) {
                        return;
                  }
                  this.lastErrorTime = now;
            }

            this.selectedIndex = (index + this.videoList.length) % this.videoList.length;
            const file = this.videoList[this.selectedIndex];
            if (!file) return;

            this.state = "playing";
            this.errorMessage = null;
            this.isPaused = false;
            this.currentVideoWidth = 0;
            this.currentVideoHeight = 0;
            this.currentVideoDuration = 0;
            this.currentVideoTime = 0;

            this.cleanupListUi();

            if (this.canvas) {
                  this.canvas.style.display = "none";
            }

            // ทำลาย iframe เก่าทิ้งอย่างสมบูรณ์เพื่อคืน dmabuf/GPU memory
            this.cleanupPlayback();

            if (!this.container) return;

            const videoUrl = `${SERVER}/videos/${encodeURIComponent(file.name)}`;
            const objectFitStyle =
                  this.aspectMode === "contain"
                        ? "contain"
                        : this.aspectMode === "none"
                          ? "none"
                          : "fill";

            // สร้าง iframe ใหม่เอี่ยมทุกคลิปตามข้อกำหนด
            const iframe = document.createElement("iframe");
            iframe.className = "w-full h-full absolute inset-0 bg-black z-10 border-0 pointer-events-auto";
            iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

            iframe.srcdoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: ${objectFitStyle};
      background: #000000;
    }
  </style>
</head>
<body>
  <video id="v" src="${videoUrl}" autoplay ${this.isMuted ? "muted" : ""} playsinline></video>
  <script>
    const v = document.getElementById('v');
    const send = (m) => window.parent.postMessage(m, '*');

    v.addEventListener('ended', () => send({ type: 'video-ended' }));
    v.addEventListener('error', () => {
      const code = v.error ? v.error.code : 0;
      send({ type: 'video-error', code });
    });

    v.addEventListener('loadedmetadata', () => {
      send({
        type: 'video-metadata',
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        duration: v.duration
      });
    });

    v.addEventListener('play', () => send({ type: 'video-play' }));
    v.addEventListener('pause', () => send({ type: 'video-pause' }));

    let last = -1;
    v.addEventListener('timeupdate', () => {
      if (v.currentTime !== last) {
        last = v.currentTime;
        send({ type: 'video-progress', currentTime: v.currentTime });
      }
    });

    window.addEventListener('message', (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.action === 'toggle-play') {
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      } else if (e.data.action === 'play') {
        v.play().catch(() => {});
      } else if (e.data.action === 'pause') {
        v.pause();
      } else if (e.data.action === 'mute') {
        v.muted = !!e.data.value;
      } else if (e.data.action === 'set-aspect') {
        v.style.objectFit = e.data.value;
      }
    });

    const cleanup = () => {
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch (e) {}
    };
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('beforeunload', cleanup);
  </script>
</body>
</html>`;

            this.container.appendChild(iframe);
            this.currentIframe = iframe;

            // รีเซ็ตและเริ่ม Watchdog
            this.lastProgressTime = Date.now();
            this.startWatchdog();

            this.renderPlaybackControls();
            this.emitStatus();
      }

      /**
       * จัดการข้อความที่ส่งมาจาก iframe
       */
      private handleIframeMessage(e: MessageEvent): void {
            if (!this.currentIframe || e.source !== this.currentIframe.contentWindow) {
                  return;
            }

            const data = e.data;
            if (!data || typeof data !== "object") return;

            switch (data.type) {
                  case "video-ended":
                        if (this.isLooping) {
                              this.playNextVideo();
                        } else if (this.selectedIndex < this.videoList.length - 1) {
                              this.playNextVideo();
                        } else {
                              this.stopVideoAndBackToList();
                        }
                        break;

                  case "video-progress":
                        this.lastProgressTime = Date.now();
                        this.currentVideoTime = Number(data.currentTime) || 0;
                        this.emitStatus();
                        break;

                  case "video-metadata":
                        this.currentVideoWidth = Number(data.videoWidth) || 0;
                        this.currentVideoHeight = Number(data.videoHeight) || 0;
                        this.currentVideoDuration = Number(data.duration) || 0;
                        this.emitStatus();
                        break;

                  case "video-play":
                        this.isPaused = false;
                        this.emitStatus();
                        this.updatePlayBtnText();
                        break;

                  case "video-pause":
                        this.isPaused = true;
                        this.emitStatus();
                        this.updatePlayBtnText();
                        break;

                  case "video-error": {
                        const code = Number(data.code) || 0;
                        let detail = "รูปแบบไฟล์หรือ Codec ไม่รองรับบนระบบนี้";
                        if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                              detail = "รูปแบบวิดีโอหรือตัวถอดรหัส (Codec) ไม่รองรับ";
                        } else if (code === MediaError.MEDIA_ERR_DECODE) {
                              detail = "เกิดข้อผิดพลาดในการถอดรหัสวิดีโอ";
                        }
                        this.showPlaybackError(detail);
                        break;
                  }
            }
      }

      public playNextVideo(isError = false): void {
            if (this.videoList.length === 0) return;
            const next = (this.selectedIndex + 1) % this.videoList.length;
            this.playVideo(next, isError);
      }

      public playPreviousVideo(): void {
            if (this.videoList.length === 0) return;
            const prev = (this.selectedIndex - 1 + this.videoList.length) % this.videoList.length;
            this.playVideo(prev);
      }

      public togglePlayPause(): void {
            this.currentIframe?.contentWindow?.postMessage({ action: "toggle-play" }, "*");
      }

      public cycleAspectMode(): void {
            if (this.aspectMode === "contain") {
                  this.aspectMode = "none";
            } else if (this.aspectMode === "none") {
                  this.aspectMode = "fill";
            } else {
                  this.aspectMode = "contain";
            }

            const objectFitStyle =
                  this.aspectMode === "contain"
                        ? "contain"
                        : this.aspectMode === "none"
                          ? "none"
                          : "fill";

            this.currentIframe?.contentWindow?.postMessage(
                  { action: "set-aspect", value: objectFitStyle },
                  "*"
            );
            this.emitStatus();
      }

      public toggleLoop(): void {
            this.isLooping = !this.isLooping;
            this.renderPlaybackControls();
            this.emitStatus();
      }

      public toggleMute(): void {
            this.isMuted = !this.isMuted;
            this.currentIframe?.contentWindow?.postMessage(
                  { action: "mute", value: this.isMuted },
                  "*"
            );
            this.renderPlaybackControls();
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

            const existing = document.getElementById("video-error-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "video-error-overlay";
            overlay.className =
                  "absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 p-6 text-center text-white";
            overlay.innerHTML = `
      <div class="max-w-md p-6 rounded-2xl bg-neutral-900 border border-red-500/50 shadow-2xl space-y-4">
        <div class="text-xs font-mono font-bold text-amber-400 tracking-wider uppercase">[ ข้อผิดพลาดตัวถอดรหัสวิดีโอ ]</div>
        <h2 class="text-xl font-bold text-red-400">ไม่สามารถเล่นไฟล์นี้ได้</h2>
        <p class="text-sm text-neutral-300 leading-relaxed">${message}</p>
        <p class="text-xs text-neutral-400 font-mono">ไฟล์: ${this.videoList[this.selectedIndex]?.name ?? ""}</p>
        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button id="btn-err-next" type="button" class="touch-btn px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold text-sm text-white shadow-lg cursor-pointer">
            เล่นไฟล์ถัดไป [→]
          </button>
          <button id="btn-err-back" type="button" class="touch-btn px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-sm text-neutral-200 border border-neutral-700 shadow-lg cursor-pointer">
            กลับหน้ารายการ [Esc]
          </button>
        </div>
      </div>
    `;

            overlay.querySelector("#btn-err-next")?.addEventListener("click", () => {
                  overlay.remove();
                  this.playNextVideo(true);
            });

            overlay.querySelector("#btn-err-back")?.addEventListener("click", () => {
                  overlay.remove();
                  this.stopVideoAndBackToList();
            });

            this.container?.appendChild(overlay);
      }

      /**
       * Watchdog ป้องกันวิดีโอค้างเงียบ ๆ
       */
      private startWatchdog(): void {
            this.stopWatchdog();
            this.watchdogIntervalId = window.setInterval(() => {
                  if (this.state !== "playing" || this.isPaused) return;

                  // หากไม่มี progress นานเกินกำหนด ถือว่าค้าง
                  if (Date.now() - this.lastProgressTime > WATCHDOG_TIMEOUT) {
                        console.warn("Watchdog timeout triggered. Skipping to next video.");
                        this.playNextVideo(true);
                  }
            }, WATCHDOG_CHECK);
      }

      private stopWatchdog(): void {
            if (this.watchdogIntervalId !== null) {
                  clearInterval(this.watchdogIntervalId);
                  this.watchdogIntervalId = null;
            }
      }

      private emitStatus(): void {
            if (this.state === "list") {
                  this.onStatusChange?.(
                        `[หน้ารายการวิดีโอ] พบ ${this.videoList.length} ไฟล์ | ↑/↓ เลือก | Enter/แตะ เพื่อเล่น | R สแกนใหม่ | O เปิดโฟลเดอร์`
                  );
                  return;
            }

            const file = this.videoList[this.selectedIndex];
            const name = file ? file.name : "วิดีโอ";
            const res =
                  this.currentVideoWidth > 0
                        ? `${this.currentVideoWidth}×${this.currentVideoHeight}`
                        : "กำลังโหลด...";
            const curTime = formatSeconds(this.currentVideoTime);
            const totalTime = formatSeconds(this.currentVideoDuration);
            const playState = this.isPaused ? "พัก" : "เล่น";
            const modeLabel = ASPECT_MODE_LABELS[this.aspectMode];
            const loopStr = this.isLooping ? "วนซ้ำ" : "เล่นครั้งเดียว";
            const muteStr = this.isMuted ? "ปิดเสียง" : "เปิดเสียง";

            this.onStatusChange?.(
                  `[${playState} ${this.selectedIndex + 1}/${this.videoList.length}] ${name} (${res}) | ${curTime}/${totalTime} | ${modeLabel} | ${loopStr} | ${muteStr}`
            );
      }

      private renderCurrentState(): void {
            if (this.state === "list") {
                  this.renderListUi();
            }
      }

      private cleanupPlayback(): void {
            this.stopWatchdog();
            this.cleanupPlaybackControls();
            const errOverlay = document.getElementById("video-error-overlay");
            if (errOverlay) errOverlay.remove();

            if (this.currentIframe) {
                  this.currentIframe.remove();
                  this.currentIframe = null;
            }
      }

      private updatePlayBtnText(): void {
            const playBtn = this.playbackControlsEl?.querySelector("#vctrl-play");
            if (playBtn) {
                  playBtn.textContent = this.isPaused ? "เล่น" : "พัก";
            }
      }

      private renderPlaybackControls(): void {
            this.cleanupPlaybackControls();
            if (!this.container) return;

            const ctrl = document.createElement("div");
            ctrl.id = "video-playback-controls";
            ctrl.className =
                  "absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-2xl bg-neutral-950/90 border border-neutral-700/80 shadow-2xl backdrop-blur-sm select-none pointer-events-auto transition-opacity duration-200";

            ctrl.innerHTML = `
      <button id="vctrl-prev" type="button" class="touch-btn px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-xs font-semibold text-white">
        ◀ ก่อนหน้า
      </button>
      <button id="vctrl-play" type="button" class="touch-btn px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-xs font-bold text-white shadow-md">
        ${this.isPaused ? "เล่น" : "พัก"}
      </button>
      <button id="vctrl-next" type="button" class="touch-btn px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-xs font-semibold text-white">
        ถัดไป ▶
      </button>
      <button id="vctrl-aspect" type="button" class="touch-btn px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-xs font-semibold text-neutral-200">
        สัดส่วน: ${ASPECT_MODE_LABELS[this.aspectMode]}
      </button>
      <button id="vctrl-loop" type="button" class="touch-btn px-3 py-2 rounded-xl ${
            this.isLooping ? "bg-emerald-600/80 text-white" : "bg-neutral-800 text-neutral-300"
      } hover:bg-neutral-700 text-xs font-semibold">
        ${this.isLooping ? "วนซ้ำ: ON" : "วนซ้ำ: OFF"}
      </button>
      <button id="vctrl-mute" type="button" class="touch-btn px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-xs font-semibold text-neutral-200">
        ${this.isMuted ? "ปิดเสียง" : "เปิดเสียง"}
      </button>
      <button id="vctrl-back" type="button" class="touch-btn px-3.5 py-2 rounded-xl bg-red-700/90 hover:bg-red-600 active:bg-red-800 text-xs font-bold text-white shadow-md">
        หน้ารายการ (Esc)
      </button>
    `;

            ctrl.addEventListener("pointerdown", (e) => e.stopPropagation());

            ctrl.querySelector("#vctrl-prev")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.playPreviousVideo();
            });

            ctrl.querySelector("#vctrl-play")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.togglePlayPause();
            });

            ctrl.querySelector("#vctrl-next")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.playNextVideo();
            });

            ctrl.querySelector("#vctrl-aspect")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.cycleAspectMode();
                  this.renderPlaybackControls();
            });

            ctrl.querySelector("#vctrl-loop")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.toggleLoop();
            });

            ctrl.querySelector("#vctrl-mute")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.toggleMute();
            });

            ctrl.querySelector("#vctrl-back")?.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.stopVideoAndBackToList();
            });

            this.container.appendChild(ctrl);
            this.playbackControlsEl = ctrl;
      }

      private cleanupPlaybackControls(): void {
            if (this.playbackControlsEl) {
                  this.playbackControlsEl.remove();
                  this.playbackControlsEl = null;
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
          <div class="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase mb-3">[ VIDEO REPOSITORY ]</div>
          <h2 class="text-xl sm:text-2xl font-bold text-white mb-2">ยังไม่มีไฟล์วิดีโอ</h2>
          <p class="text-sm text-neutral-400 mb-4 leading-relaxed">
            กรุณานำไฟล์วิดีโอ (.mp4, .webm, .mkv, .mov, .m4v, .ogv) ใส่ลงในโฟลเดอร์ต่อไปนี้:
          </p>
          <div class="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-6 text-xs sm:text-sm font-mono text-cyan-400 break-all select-all">
            ${this.videoDir || "videos/"}
          </div>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <button id="btn-open-folder" type="button" class="touch-btn px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-sm text-white shadow-md">
              เปิดโฟลเดอร์วิดีโอ [O]
            </button>
            <button id="btn-rescan-empty" type="button" class="touch-btn px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-sm text-neutral-200 border border-neutral-700 shadow-md">
              สแกนใหม่ [R]
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
                        const sizeMb =
                              file.size_bytes > 0
                                    ? (file.size_bytes / (1024 * 1024)).toFixed(1) + " MB"
                                    : "";
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
                      ${
                        sizeMb
                              ? `<span class="text-[11px] font-mono text-neutral-400">${sizeMb}</span>`
                              : ""
                      }
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
            ทดสอบวิดีโอเต็มจอ (Video Playback Test)
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
            เปิดโฟลเดอร์ [O]
          </button>
          <button
            id="btn-rescan-top"
            type="button"
            class="touch-btn px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-xs sm:text-sm font-bold text-white transition-colors shadow-sm"
          >
            สแกนใหม่ [R]
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
                        this.playVideo(idx);
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
