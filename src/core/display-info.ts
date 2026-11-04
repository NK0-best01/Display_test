import { getMonitorInfo, isTauri } from "./fullscreen";

export interface DisplayInfoSnapshot {
  cssWidth: number;
  cssHeight: number;
  physicalWidth: number;
  physicalHeight: number;
  devicePixelRatio: number;
  monitorName: string;
  monitorScaleFactor: number;
  maxTouchPoints: number;
  osPlatform: string;
  userAgent: string;
  colorDepth: number;
  refreshRateHint: string;
}

/**
 * ตรวจสอบชื่อระบบปฏิบัติการจาก User Agent / Platform
 */
export function detectOSName(): string {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return "Windows";
  }
  if (/Linux/i.test(platform) || /Linux|X11/i.test(ua)) {
    return "Linux (X11 / WebKitGTK)";
  }
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    return "macOS";
  }
  return platform || "ไม่ทราบระบบปฏิบัติการ";
}

/**
 * อ่านข้อมูลจอภาพและระบบทั้งหมดสำหรับแสดงในหน้า Info และเมนูหลัก
 */
export async function collectDisplayInfo(): Promise<DisplayInfoSnapshot> {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  const monitor = await getMonitorInfo();

  const physicalWidth = monitor ? monitor.size.width : Math.round(cssWidth * dpr);
  const physicalHeight = monitor ? monitor.size.height : Math.round(cssHeight * dpr);
  const monitorScaleFactor = monitor ? monitor.scaleFactor : dpr;
  const monitorName = monitor?.name
    ? monitor.name
    : isTauri()
      ? "จอภาพหลัก (Tauri Monitor)"
      : "จอภาพมาตรฐาน (WebView / Browser)";

  return {
    cssWidth,
    cssHeight,
    physicalWidth,
    physicalHeight,
    devicePixelRatio: Number(dpr.toFixed(2)),
    monitorName,
    monitorScaleFactor: Number(monitorScaleFactor.toFixed(2)),
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    osPlatform: detectOSName(),
    userAgent: navigator.userAgent,
    colorDepth: window.screen?.colorDepth ?? 24,
    refreshRateHint: "วัดตาม VSync (requestAnimationFrame)",
  };
}

/**
 * ปรับขนาด `<canvas>` ให้ตรงกับความละเอียดพิกเซลจริงของจอ (Physical Pixels)
 * เพื่อให้การวาดเส้น 1 พิกเซลคมชัด ไม่เบลอแม้ตั้ง Display Scaling 125% หรือ 150%
 */
export function syncCanvasPhysicalSize(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
  dpr: number;
} {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const physW = Math.max(1, Math.round(cssW * dpr));
  const physH = Math.max(1, Math.round(cssH * dpr));

  if (canvas.width !== physW || canvas.height !== physH) {
    canvas.width = physW;
    canvas.height = physH;
  }

  return { width: physW, height: physH, dpr };
}

