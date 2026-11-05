import type { TestModule, TestModuleId } from "../core/types";
import { collectDisplayInfo } from "../core/display-info";
import { getFullscreenState, toggleFullscreen } from "../core/fullscreen";

export interface MenuCallbacks {
  onSelectTest: (id: TestModuleId) => void;
  onOpenInfo: () => void;
}

const BADGE_COLORS: Record<TestModuleId, string> = {
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
 * เรนเดอร์หน้าเมนูหลัก (Responsive สำหรับทุกขนาดจอ รวมถึง 1024x768, 1280x720, 1920x1080)
 * โดยมีปุ่มข้อมูลจอภาพ (Info) เพียงจุดเดียวที่มุมขวาบนของแถบ Header
 */
export async function renderMainMenu(
  container: HTMLElement,
  modules: TestModule[],
  callbacks: MenuCallbacks
): Promise<void> {
  const [info, isFull] = await Promise.all([
    collectDisplayInfo(),
    getFullscreenState(),
  ]);

  container.innerHTML = `
    <div class="w-full h-full flex flex-col justify-between bg-neutral-950 text-neutral-100 p-3 sm:p-4 lg:p-6 overflow-y-auto">
      <!-- แถบส่วนหัว (Header) พร้อมปุ่มเปิดข้อมูลระบบ (Info) ที่มุมขวาบน -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
            ระบบทดสอบจอภาพและทัชสกรีน (Display & Touch Tester)
          </h1>
          <p class="text-xs sm:text-sm text-neutral-400 mt-0.5">
            ความละเอียดจริง: <span class="font-mono text-emerald-400 font-semibold">${info.physicalWidth}×${info.physicalHeight}</span>
            (CSS: <span class="font-mono">${info.cssWidth}×${info.cssHeight}</span>, DPR: <span class="font-mono">${info.devicePixelRatio}</span>)
            • รองรับสัมผัส: <span class="font-mono text-sky-400">${info.maxTouchPoints} จุด</span>
            • OS: <span class="font-mono">${info.osPlatform}</span>
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            id="btn-menu-info"
            type="button"
            class="touch-btn px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700 text-xs sm:text-sm font-semibold text-neutral-100 transition-colors shadow-sm"
            title="ดูข้อมูลฮาร์ดแวร์และจอภาพ (ปุ่มลัด I)"
          >
            ℹ️ ข้อมูลจอภาพ (Info)
          </button>
          <button
            id="btn-menu-fullscreen"
            type="button"
            class="touch-btn px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors shadow-sm ${
              isFull
                ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white"
                : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white"
            }"
          >
            ${isFull ? "ออกจากเต็มจอ (F11)" : "เปิดเต็มจอ (F11)"}
          </button>
        </div>
      </header>

      <!-- ตารางปุ่มหัวข้อทดสอบ (Responsive Grid 4x2 รองรับ 8 หัวข้อ พอดีจอ 1024x768 ไม่ล้น) -->
      <main class="my-auto py-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-4 xl:gap-5">
          ${modules
            .map((m, idx) => {
              const badgeStyle = BADGE_COLORS[m.id] ?? "bg-neutral-800 text-neutral-300 border-neutral-700";
              return `
                <button
                  type="button"
                  data-test-id="${m.id}"
                  class="touch-btn group text-left flex flex-col justify-between items-stretch bg-neutral-900 hover:bg-neutral-800/90 active:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 sm:p-5 min-h-[130px] sm:min-h-[145px] lg:min-h-[155px] transition-all"
                >
                  <div class="flex items-start justify-between gap-2 w-full">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${badgeStyle}">
                      หัวข้อที่ ${idx + 1} | ปุ่มลัด [${idx + 1}]
                    </span>
                    <span class="text-xs text-neutral-400 group-hover:text-white font-medium">
                      เริ่มทดสอบ →
                    </span>
                  </div>
                  <div class="mt-2.5">
                    <h2 class="text-base sm:text-lg font-bold text-white group-hover:text-sky-300 leading-snug">
                      ${m.title.replace(/^\d+\.\s*/, "")}
                    </h2>
                    <p class="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      ${m.description}
                    </p>
                  </div>
                </button>
              `;
            })
            .join("")}
        </div>
      </main>

      <!-- แถบคำแนะนำด้านล่าง (Footer) -->
      <footer class="border-t border-neutral-800 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
        <div>
          <span class="text-neutral-300 font-semibold">การควบคุมมาตรฐานในหน้าทดสอบ:</span>
          กด <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">Esc</kbd> หรือ <span class="text-amber-400 font-medium">กดค้างมุมซ้ายบน 1 วินาที</span> เพื่อกลับเมนูหลัก
          | <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">H</kbd> หรือ <span class="text-sky-400 font-medium">แตะ 3 นิ้ว</span> ซ่อน/แสดง HUD
        </div>
        <div>
          ปุ่มลัดเมนู: กดเลข <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">1</kbd>-<kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">${modules.length}</kbd> เพื่อเข้าแต่ละหัวข้อทันที
        </div>
      </footer>
    </div>
  `;

  // ผูก Event ปุ่มเลือกหัวข้อทดสอบ
  container.querySelectorAll<HTMLButtonElement>("[data-test-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-test-id") as TestModuleId;
      if (id) callbacks.onSelectTest(id);
    });
  });

  // ปุ่มเปิด Info Modal (ปุ่มมุมขวาบนเพียงจุดเดียว)
  container.querySelector("#btn-menu-info")?.addEventListener("click", () => {
    callbacks.onOpenInfo();
  });

  // ปุ่มสลับ Fullscreen
  container.querySelector("#btn-menu-fullscreen")?.addEventListener("click", async () => {
    await toggleFullscreen();
    await renderMainMenu(container, modules, callbacks);
  });
}
