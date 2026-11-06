import { getCurrentWindow, currentMonitor, type Monitor } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * ตรวจสอบว่ารันอยู่ใน Tauri WebView หรือไม่
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * ออกจากโปรแกรม (Exit Application)
 * ปิดหน้าต่างและคืนทรัพยากรทั้งหมด
 */
export async function exitApp(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("exit_app");
      return;
    } catch {
      try {
        await getCurrentWindow().close();
        return;
      } catch (err) {
        console.error("Failed to exit Tauri app:", err);
      }
    }
  }
  // Browser fallback
  window.close();
}

/**
 * บังคับสถานะเต็มจอเสมอ (Locked Fullscreen - ไม่สามารถย่อหน้าต่างได้ตามข้อกำหนด)
 */
export async function toggleFullscreen(): Promise<boolean> {
  return await setFullscreenState(true);
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
 * อ่านข้อมูล Monitor ปัจจุบันผ่าน Tauri API พร้อม Timeout ป้องกันการค้าง
 */
export async function getMonitorInfo(): Promise<Monitor | null> {
  if (isTauri()) {
    try {
      const monitorPromise = currentMonitor();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 1000)
      );
      return await Promise.race([monitorPromise, timeoutPromise]);
    } catch (err) {
      console.warn("Failed to get current monitor:", err);
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

