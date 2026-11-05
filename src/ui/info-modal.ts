import { collectDisplayInfo } from "../core/display-info";

/**
 * หน้าต่างแสดงข้อมูลจอภาพและระบบ (System & Display Info Modal)
 * สไตล์ Calibrated Hardware Spec Sheet (Non-AI, Crafted & Precise)
 */
export async function renderInfoModal(
  container: HTMLElement,
  onClose: () => void
): Promise<void> {
  const info = await collectDisplayInfo();

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto select-none";

  overlay.innerHTML = `
    <div class="relative bg-[#0f1118] border border-white/[0.1] rounded-2xl max-w-3xl w-full p-5 sm:p-6 text-zinc-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="flex items-start justify-between border-b border-white/[0.08] pb-4">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-[10px] font-mono font-bold tracking-wider text-cyan-300 uppercase">
            HARDWARE TELEMETRY
          </div>
          <h2 class="text-lg sm:text-2xl font-bold tracking-tight text-white">
            ข้อมูลจอภาพและสเปกฮาร์ดแวร์
          </h2>
          <p class="text-xs sm:text-sm text-zinc-400">
            รายละเอียดความละเอียดฟิสิคัล, อัตราขยาย DPI, ดิจิไทเซอร์ และสภาพแวดล้อมรันไทม์
          </p>
        </div>

        <button
          id="btn-close-info"
          type="button"
          class="touch-btn h-10 px-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-[0.96] border border-white/[0.1] text-xs font-semibold text-zinc-200 transition-all cursor-pointer shadow-sm"
        >
          ปิด (Esc)
        </button>
      </div>

      <!-- Telemetry Spec Matrix (2 Columns) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        
        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            ความละเอียดจริงระดับพิกเซล (Physical Resolution)
          </div>
          <div class="text-lg sm:text-xl font-mono font-bold text-emerald-400">
            ${info.physicalWidth} × ${info.physicalHeight} px
          </div>
          <div class="text-[11px] text-zinc-400">
            Native Hardware Backing Store (100% 1:1 Pixel Mapping)
          </div>
        </div>

        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            ขนาดพื้นที่แสดงผล CSS (Viewport Logic)
          </div>
          <div class="text-lg sm:text-xl font-mono font-bold text-cyan-400">
            ${info.cssWidth} × ${info.cssHeight} px
          </div>
          <div class="text-[11px] text-zinc-400">
            ความละเอียดที่ระบบเรนเดอร์คำนวณในหน่วย CSS Pixels
          </div>
        </div>

        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            อัตราส่วนพิกเซล (devicePixelRatio / Monitor Scale)
          </div>
          <div class="text-lg sm:text-xl font-mono font-bold text-amber-300">
            ${info.devicePixelRatio}x
          </div>
          <div class="text-[11px] text-zinc-400">
            Monitor Scale Factor: ${info.monitorScaleFactor}
          </div>
        </div>

        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            จำนวนจุดสัมผัสดิจิไทเซอร์ (Max Touch Points)
          </div>
          <div class="text-lg sm:text-xl font-mono font-bold text-cyan-300">
            ${info.maxTouchPoints} จุดพร้อมกัน
          </div>
          <div class="text-[11px] text-zinc-400">
            ตรวจจับผ่าน W3C Pointer & Touch API
          </div>
        </div>

        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            ชื่ออุปกรณ์แสดงผล (Monitor Device Name)
          </div>
          <div class="text-sm sm:text-base font-mono font-medium text-zinc-200 break-all">
            ${info.monitorName}
          </div>
        </div>

        <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3.5 space-y-1">
          <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
            แพลตฟอร์มและบิตสี (OS Platform & Color Depth)
          </div>
          <div class="text-sm sm:text-base font-mono font-medium text-zinc-200">
            ${info.osPlatform} (${info.colorDepth}-bit Framebuffer)
          </div>
        </div>

      </div>

      <!-- User Agent Footprint -->
      <div class="bg-[#141722] border border-white/[0.07] rounded-xl p-3 text-xs space-y-1 text-zinc-400">
        <div class="font-mono text-[10px] uppercase font-semibold text-zinc-300">
          User Agent / WebView Runtime Footprint:
        </div>
        <div class="font-mono text-[11px] text-zinc-400 break-all leading-relaxed">
          ${info.userAgent}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-end pt-2 border-t border-white/[0.08]">
        <button
          id="btn-close-info-bottom"
          type="button"
          class="touch-btn h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.96] font-semibold text-white transition-all cursor-pointer shadow-lg shadow-cyan-950/40"
        >
          รับทราบ / กลับสู่เมนูหลัก (OK)
        </button>
      </div>

    </div>
  `;

  const cleanupAndClose = () => {
    overlay.remove();
    onClose();
  };

  overlay.querySelector("#btn-close-info")?.addEventListener("click", cleanupAndClose);
  overlay.querySelector("#btn-close-info-bottom")?.addEventListener("click", cleanupAndClose);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cleanupAndClose();
  });

  container.appendChild(overlay);
}
