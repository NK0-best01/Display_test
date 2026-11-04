import "./style.css";
import {
  getFullscreenState,
  getMonitorInfo,
  lockWebViewInteractions,
  setFullscreenState,
  toggleFullscreen,
} from "./core/fullscreen";

// ปิด context menu, pinch zoom, drag ฯลฯ
lockWebViewInteractions();

const app = document.querySelector<HTMLDivElement>("#app")!;

async function renderScaffoldScreen(): Promise<void> {
  const isFull = await getFullscreenState();
  const monitor = await getMonitorInfo();
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const realW = Math.round(cssW * dpr);
  const realH = Math.round(cssH * dpr);
  const monitorName = monitor?.name ?? "ตรวจจากเบราว์เซอร์ / มาตรฐาน";
  const monitorPhysical = monitor
    ? `${monitor.size.width} × ${monitor.size.height} px (Scale ${monitor.scaleFactor})`
    : `${realW} × ${realH} px (คำนวณจาก DPR ${dpr})`;

  app.innerHTML = `
    <div class="w-full h-full flex flex-col justify-between p-4 md:p-6 xga:p-8 bg-neutral-950 text-neutral-100">
      <!-- ส่วนหัว -->
      <header class="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white">
            ระบบทดสอบจอภาพ (Display Tester)
          </h1>
          <p class="text-sm md:text-base text-neutral-400 mt-1">
            Part 1: โครงสร้างโปรเจกต์ Tauri v2 + TypeScript + Tailwind CSS v3.4
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            id="btn-toggle-fullscreen"
            class="touch-btn px-5 py-3 rounded-xl font-semibold text-base bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white"
          >
            ${isFull ? "ออกจากเต็มจอ (Esc / F11)" : "เปิดเต็มจอ (F11)"}
          </button>
        </div>
      </header>

      <!-- ข้อมูลจอภาพและการตรวจสอบสถานะ Part 1 -->
      <main class="my-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl w-full mx-auto">
        <section class="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
          <h2 class="text-lg md:text-xl font-semibold text-blue-400">
            ข้อมูลหน้าจอปัจจุบัน
          </h2>
          <div class="space-y-2 text-sm md:text-base">
            <div class="flex justify-between border-b border-neutral-800 pb-2">
              <span class="text-neutral-400">ชื่อจอภาพ (Monitor):</span>
              <span class="font-mono font-medium">${monitorName}</span>
            </div>
            <div class="flex justify-between border-b border-neutral-800 pb-2">
              <span class="text-neutral-400">ขนาด Viewport (CSS):</span>
              <span class="font-mono font-medium">${cssW} × ${cssH} px</span>
            </div>
            <div class="flex justify-between border-b border-neutral-800 pb-2">
              <span class="text-neutral-400">ความละเอียดจริง (Physical):</span>
              <span class="font-mono font-medium text-emerald-400">${monitorPhysical}</span>
            </div>
            <div class="flex justify-between border-b border-neutral-800 pb-2">
              <span class="text-neutral-400">Device Pixel Ratio (DPR):</span>
              <span class="font-mono font-medium">${dpr}</span>
            </div>
            <div class="flex justify-between border-b border-neutral-800 pb-2">
              <span class="text-neutral-400">จำนวนจุดสัมผัสสูงสุด (maxTouchPoints):</span>
              <span class="font-mono font-medium">${navigator.maxTouchPoints ?? 0}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-neutral-400">สถานะโหมดเต็มจอ (Fullscreen):</span>
              <span class="font-mono font-semibold ${isFull ? "text-emerald-400" : "text-amber-400"}">
                ${isFull ? "เปิดเต็มจอ (Fullscreen)" : "โหมดหน้าต่าง (Windowed)"}
              </span>
            </div>
          </div>
        </section>

        <section class="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div class="space-y-3">
            <h2 class="text-lg md:text-xl font-semibold text-emerald-400">
              การควบคุมและทดสอบ Part 1
            </h2>
            <ul class="space-y-2 text-sm md:text-base text-neutral-300 list-disc list-inside">
              <li>กดปุ่ม <kbd class="px-2 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">F11</kbd> เพื่อสลับโหมดเต็มจอ (Fullscreen)</li>
              <li>กดปุ่ม <kbd class="px-2 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Esc</kbd> เพื่อออกจากโหมดเต็มจอ</li>
              <li>ปิดการคลิกขวา (Context Menu), การลากคลุมข้อความ และการซูมหน้าจอเรียบร้อย</li>
              <li>ปุ่มกดรองรับการสัมผัสขนาดไม่ต่ำกว่า 64×64 พิกเซล และรองรับจอ 1024×768</li>
            </ul>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button
              id="btn-enter-fs"
              class="touch-btn px-4 py-3 rounded-xl font-medium bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white"
            >
              เข้าสู่โหมดเต็มจอ
            </button>
            <button
              id="btn-exit-fs"
              class="touch-btn px-4 py-3 rounded-xl font-medium bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200"
            >
              ออกจากโหมดเต็มจอ (Esc)
            </button>
          </div>
        </section>
      </main>

      <!-- ส่วนท้าย -->
      <footer class="border-t border-neutral-800 pt-3 flex flex-wrap items-center justify-between text-xs md:text-sm text-neutral-400">
        <span>พร้อมสำหรับเริ่มพัฒนา Part 2 (App Shell & เมนูหลัก 7 หัวข้อ)</span>
        <span>ปุ่มลัด: F11 = สลับเต็มจอ | Esc = ออกจากเต็มจอ</span>
      </footer>
    </div>
  `;

  document.getElementById("btn-toggle-fullscreen")?.addEventListener("click", async () => {
    await toggleFullscreen();
    await renderScaffoldScreen();
  });

  document.getElementById("btn-enter-fs")?.addEventListener("click", async () => {
    await setFullscreenState(true);
    await renderScaffoldScreen();
  });

  document.getElementById("btn-exit-fs")?.addEventListener("click", async () => {
    await setFullscreenState(false);
    await renderScaffoldScreen();
  });
}

// คีย์บอร์ดมาตรฐานสำหรับ Part 1: F11 สลับ Fullscreen, Esc ออกจาก Fullscreen
window.addEventListener("keydown", async (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    await toggleFullscreen();
    await renderScaffoldScreen();
  } else if (e.key === "Escape") {
    e.preventDefault();
    await setFullscreenState(false);
    await renderScaffoldScreen();
  }
});

window.addEventListener("resize", () => {
  void renderScaffoldScreen();
});

void renderScaffoldScreen();

