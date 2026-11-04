import { getCurrentWindow, currentMonitor, type Monitor } from "@tauri-apps/api/window";

/**
 * ตรวจสอบว่ารันอยู่ใน Tauri WebView หรือไม่
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * สลับสถานะ Fullscreen (F11 หรือปุ่มในเมนู)
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (isTauri()) {
    try {
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!current);
      return !current;
    } catch (err) {
      console.error("Failed to toggle Tauri fullscreen:", err);
    }
  }

  // Fallback สำหรับการเปิดผ่านเบราว์เซอร์ปกติตอน dev
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    return true;
  } else {
    await document.exitFullscreen().catch(() => {});
    return false;
  }
}

/**
 * ตั้งค่าสถานะ Fullscreen ตามที่ระบุ
 */
export async function setFullscreenState(fullscreen: boolean): Promise<boolean> {
  if (isTauri()) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setFullscreen(fullscreen);
      return await appWindow.isFullscreen();
    } catch (err) {
      console.error("Failed to set Tauri fullscreen:", err);
    }
  }

  if (fullscreen && !document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    return true;
  } else if (!fullscreen && document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    return false;
  }
  return Boolean(document.fullscreenElement);
}

/**
 * อ่านสถานะ Fullscreen ปัจจุบัน
 */
export async function getFullscreenState(): Promise<boolean> {
  if (isTauri()) {
    try {
      return await getCurrentWindow().isFullscreen();
    } catch {
      return false;
    }
  }
  return Boolean(document.fullscreenElement);
}

/**
 * อ่านข้อมูล Monitor ปัจจุบันผ่าน Tauri API
 */
export async function getMonitorInfo(): Promise<Monitor | null> {
  if (isTauri()) {
    try {
      return await currentMonitor();
    } catch (err) {
      console.error("Failed to get current monitor:", err);
    }
  }
  return null;
}

/**
 * ปิด Context Menu, การเลือกข้อความ, และการซูมด้วยคีย์ลัดหรือล้อเมาส์
 */
export function lockWebViewInteractions(): void {
  // ปิดคลิกขวา (Context Menu)
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // ป้องกันการลากเลือกข้อความหรือรูปภาพ
  window.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  // ป้องกันการซูมด้วย Ctrl + ล้อเมาส์ / Pinch
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // ป้องกัน Gesture ซูมบนบาง WebView
  window.addEventListener("gesturestart", (e) => e.preventDefault());
  window.addEventListener("gesturechange", (e) => e.preventDefault());
  window.addEventListener("gestureend", (e) => e.preventDefault());
}

