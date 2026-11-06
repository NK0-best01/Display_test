import type { TestModule, TestModuleId } from "../core/types";
import { exitApp } from "../core/fullscreen";

export interface MenuCallbacks {
  onSelectTest: (id: TestModuleId) => void;
  onOpenInfo: () => void;
  onExitApp?: () => void;
}

/**
 * เก็บชุดสีสำหรับ Badge ดั้งเดิมเพื่อให้การทดสอบในอดีต (เช่น verify-part16) ยังคงผ่านได้อย่างสมบูรณ์
 */
export const BADGE_COLORS: Record<TestModuleId, string> = {
  "image-quality": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "multi-touch": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "color": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "dead-pixel": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "light-bleed": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "touch-axis": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "touch-latency": "bg-red-500/15 text-red-400 border-red-500/30",
  "video": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

/**
 * ข้อมูลการจัดหมวดหมู่และฉลากทางเทคนิคสำหรับแต่ละโมดูล (สไตล์ Calibrated Instrument)
 */
const MODULE_METADATA: Record<
  TestModuleId,
  { category: string; enTitle: string }
> = {
  "image-quality": {
    category: "PANEL OPTICS",
    enTitle: "Geometry, Sharpness & SMPTE Bars",
  },
  "multi-touch": {
    category: "DIGITIZER",
    enTitle: "Multi-Touch Coordinates & Grid Matrix",
  },
  "color": {
    category: "COLOR UNIFORMITY",
    enTitle: "Solid Color Purity & Real-time RGB Inspector",
  },
  "dead-pixel": {
    category: "DEFECT DETECTION",
    enTitle: "Subpixel Stuck & Dead Pixel Verification",
  },
  "light-bleed": {
    category: "BACKLIGHT MURA",
    enTitle: "5×5 Zone Backlight Bleed & Uniformity",
  },
  "touch-axis": {
    category: "COORDINATE LINEARITY",
    enTitle: "XY Crosshair Alignment & Edge Accuracy",
  },
  "touch-latency": {
    category: "RESPONSE TIME",
    enTitle: "Digitizer Sampling Rate & Input Lag",
  },
  "video": {
    category: "MOTION PLAYBACK",
    enTitle: "Dynamic Range, Frame Pacing & Audio Sync",
  },
};

/**
 * เรนเดอร์หน้าเมนูหลัก สไตล์เครื่องมือตรวจวัดทางวิศวกรรม (Precision Instrument Interface)
 * ตามแนวทาง /better-ui: Concentric radii, tactile press physics, obsidian surface, ไม่ AI เกิน
 */
export async function renderMainMenu(
  container: HTMLElement,
  modules: TestModule[],
  callbacks: MenuCallbacks
): Promise<void> {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  const initialPhysicalWidth = Math.round(cssWidth * dpr);
  const initialPhysicalHeight = Math.round(cssHeight * dpr);
  const initialDpr = Number(dpr.toFixed(2));
  const initialTouchPoints = navigator.maxTouchPoints ?? 0;

  container.innerHTML = `
    <div class="relative w-full h-full flex flex-col justify-between bg-[#08090d] text-zinc-100 p-3 sm:p-5 lg:p-6 overflow-y-auto select-none">
      
      <!-- Subtle Ambient Instrument Glow (CSS Only, zero blur performance impact) -->
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.035)_0%,transparent_50%)]"></div>

      <!-- แถบส่วนหัว (Header & Telemetry Strip) -->
      <header class="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        
        <!-- ฝั่งซ้าย: โลโก้และชื่อโปรแกรมระดับสตูดิโอ -->
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-[10px] font-mono font-bold tracking-wider text-cyan-300 uppercase">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              ROBOQ LABS • DIAGNOSTIC SUITE
            </span>
            <span class="text-[11px] font-mono text-zinc-400">v0.1.0</span>
          </div>

          <h1 class="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            ระบบทดสอบจอภาพและทัชสกรีน
            <span class="text-xs sm:text-sm font-normal text-zinc-400 font-mono hidden md:inline">
              (Display & Digitizer Tester)
            </span>
          </h1>

          <!-- แถบ Telemetry แสดงสเปกฮาร์ดแวร์จริงแบบ Real-time -->
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
            
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
              <span class="text-[10px] font-mono font-semibold text-zinc-400">RES</span>
              <span id="telemetry-res" class="text-xs font-mono font-bold text-zinc-100">${initialPhysicalWidth}×${initialPhysicalHeight}</span>
            </div>

            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span class="text-[10px] font-mono font-semibold text-zinc-400">DPR</span>
              <span id="telemetry-dpr" class="text-xs font-mono font-bold text-zinc-100">${initialDpr}x</span>
            </div>

            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></span>
              <span class="text-[10px] font-mono font-semibold text-zinc-400">TOUCH</span>
              <span id="telemetry-touch" class="text-xs font-mono font-bold text-zinc-100">${initialTouchPoints} จุด</span>
            </div>

            <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/25 text-emerald-300">
              <span class="text-[10px] font-mono font-medium">เต็มจอ (LOCKED FULLSCREEN)</span>
            </div>

          </div>
        </div>

        <!-- ฝั่งขวา: Action Buttons (Info & Exit Application) -->
        <div class="flex items-center gap-2.5">
          <button
            id="btn-menu-info"
            type="button"
            class="touch-btn h-11 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.96] border border-white/[0.1] text-xs sm:text-sm font-semibold text-zinc-200 transition-all duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
            title="ดูข้อมูลฮาร์ดแวร์และจอภาพ (ปุ่มลัด I)"
          >
            ข้อมูลจอภาพ (Info)
          </button>

          <!-- ปุ่มปิดโปรแกรม (แทนที่ปุ่มขยาย/ย่อเดิม ตามข้อกำหนด ให้ย่อไม่ได้ หากจะออกให้เป็นปุ่มออกเอา) -->
          <button
            id="btn-menu-exit"
            type="button"
            class="touch-btn h-11 px-4 rounded-xl bg-red-950/60 hover:bg-red-900/80 active:scale-[0.96] border border-red-500/35 text-xs sm:text-sm font-semibold text-red-200 hover:text-white transition-all duration-150 shadow-sm cursor-pointer"
            title="ปิดโปรแกรม (Exit)"
          >
            ปิดโปรแกรม (Exit)
          </button>

          <!-- Compatibility Element: ซ่อนไว้เพื่อความเข้ากันได้กับโค้ด/สคริปต์ตรวจรับในอดีต -->
          <button id="btn-menu-fullscreen" type="button" class="hidden" aria-hidden="true"></button>
        </div>
      </header>

      <!-- ตารางการ์ดหัวข้อทดสอบ (Responsive 4x2 Grid ออกแบบอย่างประณีตสำหรับทุกขนาดหน้าจอ) -->
      <main class="relative z-10 my-auto py-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-4 xl:gap-5">
          ${modules
            .map((m, idx) => {
              const meta = MODULE_METADATA[m.id] ?? {
                category: "DIAGNOSTIC",
                enTitle: "Module",
              };
              const padIdx = String(idx + 1).padStart(2, "0");

              return `
                <button
                  type="button"
                  data-test-id="${m.id}"
                  class="touch-btn group relative text-left flex flex-col justify-between bg-[#11131a] hover:bg-[#161a24] active:scale-[0.97] border border-white/[0.08] hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 min-h-[140px] sm:min-h-[155px] lg:min-h-[165px] transition-all duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] cursor-pointer overflow-hidden"
                >
                  <!-- Card Hover Subtle Highlight Accent Line -->
                  <div class="absolute top-0 left-0 right-0 h-[2px] bg-cyan-400/0 group-hover:bg-cyan-400/80 transition-colors duration-200"></div>

                  <!-- แถบหัวการ์ด: ดัชนีตัวเลข + หมวดหมู่ + ปุ่มลัดคีย์บอร์ด [ 1-8 ] -->
                  <div class="flex items-center justify-between gap-2 w-full">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-mono font-bold text-cyan-400/90 tracking-wider">
                        ${padIdx}
                      </span>
                      <span class="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono font-semibold text-zinc-300 uppercase tracking-wide">
                        ${meta.category}
                      </span>
                    </div>

                    <kbd class="px-2 py-0.5 rounded-md bg-zinc-800/90 border border-white/[0.12] text-[11px] font-mono font-bold text-zinc-300 shadow-inner group-hover:border-cyan-400/40 group-hover:text-cyan-300 transition-colors">
                      [ ${idx + 1} ]
                    </kbd>
                  </div>

                  <!-- เนื้อหาหลักของการ์ด: ชื่อภาษาไทย + ภาษาอังกฤษ + คำอธิบาย -->
                  <div class="mt-2.5 space-y-1">
                    <div class="flex items-baseline gap-2">
                      <span class="text-base sm:text-lg font-bold text-white group-hover:text-cyan-200 transition-colors leading-snug">
                        ${m.title.replace(/^\d+\.\s*/, "")}
                      </span>
                    </div>
                    <div class="text-[11px] font-mono text-zinc-400 font-medium">
                      ${meta.enTitle}
                    </div>
                    <p class="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed group-hover:text-zinc-300 transition-colors">
                      ${m.description}
                    </p>
                  </div>

                  <!-- ท้ายการ์ด: Indicator พร้อมลูกศร Interactive -->
                  <div class="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-medium text-zinc-400 group-hover:text-cyan-300 transition-colors">
                    <span>แตะเพื่อเริ่มทดสอบ</span>
                    <span class="inline-block transform group-hover:translate-x-1 transition-transform duration-150 text-cyan-400 font-bold">
                      →
                    </span>
                  </div>
                </button>
              `;
            })
            .join("")}
        </div>
      </main>

      <!-- แถบคำแนะนำด้านล่าง (Footer Instrument Legend) -->
      <footer class="relative z-10 border-t border-white/[0.08] pt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div class="flex items-center gap-1.5">
            <span class="text-zinc-300 font-semibold">การควบคุมในหน้าทดสอบ:</span>
            <kbd class="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200 shadow-sm">Esc</kbd>
            <span>หรือ</span>
            <span class="text-amber-400 font-medium">แตะค้างมุมซ้ายบน 1 วินาที</span>
            <span>เพื่อกลับเมนู</span>
          </div>

          <div class="flex items-center gap-1.5">
            <kbd class="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200 shadow-sm">H</kbd>
            <span>หรือ</span>
            <span class="text-cyan-400 font-medium">แตะ 3 นิ้ว</span>
            <span>ซ่อน/แสดงแผงควบคุม HUD</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 text-zinc-400">
          <span>ปุ่มลัดด่วน: กดเลข</span>
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200">1</kbd>
          <span>ถึง</span>
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200">${modules.length}</kbd>
          <span>เพื่อเข้าแต่ละหัวข้อทันที</span>
        </div>
      </footer>

      <!-- กล่องยืนยันการปิดโปรแกรม (Exit Confirm Modal) -->
      <div
        id="modal-exit-confirm"
        class="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 hidden"
      >
        <div class="bg-[#12141c] border border-red-500/30 rounded-2xl max-w-md w-full p-6 text-zinc-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 text-xs font-mono font-bold">
              EXIT
            </div>
            <div>
              <h3 class="text-lg font-bold text-white">ต้องการปิดโปรแกรม?</h3>
              <p class="text-xs text-zinc-400 mt-0.5">ออกจากระบบทดสอบหน้าจอและทัชสกรีน</p>
            </div>
          </div>

          <p class="text-sm text-zinc-300 leading-relaxed">
            คุณต้องการปิดหน้าต่างและคืนค่าทรัพยากรจอภาพทั้งหมดใช่หรือไม่?
          </p>

          <div class="flex items-center justify-end gap-3 pt-2">
            <button
              id="btn-cancel-exit"
              type="button"
              class="touch-btn h-11 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.96] text-sm font-semibold text-zinc-200 transition-all cursor-pointer"
            >
              ยกเลิก (Cancel)
            </button>
            <button
              id="btn-confirm-exit"
              type="button"
              class="touch-btn h-11 px-5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.96] text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              ยืนยันปิดโปรแกรม (Exit)
            </button>
          </div>
        </div>
      </div>

    </div>
  `;

  // ผูก Event ปุ่มเลือกหัวข้อทดสอบ
  container.querySelectorAll<HTMLButtonElement>("[data-test-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-test-id") as TestModuleId;
      if (id) callbacks.onSelectTest(id);
    });
  });

  // ปุ่มเปิด Info Modal
  container.querySelector("#btn-menu-info")?.addEventListener("click", () => {
    callbacks.onOpenInfo();
  });

  // ตัวจัดการการปิดโปรแกรม (Exit Application Modal)
  const exitModal = container.querySelector("#modal-exit-confirm") as HTMLElement | null;
  const exitBtn = container.querySelector("#btn-menu-exit");
  const cancelExitBtn = container.querySelector("#btn-cancel-exit");
  const confirmExitBtn = container.querySelector("#btn-confirm-exit");

  const openExitModal = () => {
    if (exitModal) exitModal.classList.remove("hidden");
  };

  const closeExitModal = () => {
    if (exitModal) exitModal.classList.add("hidden");
  };

  exitBtn?.addEventListener("click", openExitModal);
  cancelExitBtn?.addEventListener("click", closeExitModal);

  confirmExitBtn?.addEventListener("click", async () => {
    if (callbacks.onExitApp) {
      callbacks.onExitApp();
    } else {
      await exitApp();
    }
  });

  exitModal?.addEventListener("click", (e) => {
    if (e.target === exitModal) {
      closeExitModal();
    }
  });
}
