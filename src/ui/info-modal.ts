import { collectDisplayInfo } from "../core/display-info";

/**
 * หน้าต่างแสดงข้อมูลจอภาพและระบบ (Info View)
 */
export async function renderInfoModal(
  container: HTMLElement,
  onClose: () => void
): Promise<void> {
  const info = await collectDisplayInfo();

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-50 bg-neutral-950/95 flex items-center justify-center p-4 md:p-6 overflow-y-auto";

  overlay.innerHTML = `
    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full p-5 md:p-6 text-neutral-100 space-y-5">
      <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white">ข้อมูลจอภาพและระบบ (System & Display Info)</h2>
          <p class="text-xs md:text-sm text-neutral-400 mt-0.5">ตรวจสอบค่าความละเอียดจริง อัตราการขยาย และความสามารถของจอสัมผัส</p>
        </div>
        <button
          id="btn-close-info"
          type="button"
          class="touch-btn px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-sm font-semibold text-white"
        >
          ปิดหน้าต่าง (Esc)
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm md:text-base">
        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">ความละเอียดจริงของจอ (Physical Resolution)</div>
          <div class="text-lg font-mono font-bold text-emerald-400 mt-1">
            ${info.physicalWidth} × ${info.physicalHeight} พิกเซล
          </div>
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">ขนาดพื้นที่แสดงผล CSS (Viewport)</div>
          <div class="text-lg font-mono font-bold text-blue-400 mt-1">
            ${info.cssWidth} × ${info.cssHeight} px
          </div>
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">อัตราส่วนพิกเซล (devicePixelRatio / Scale)</div>
          <div class="text-lg font-mono font-bold text-amber-400 mt-1">
            DPR ${info.devicePixelRatio} (Monitor Scale: ${info.monitorScaleFactor})
          </div>
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">จำนวนจุดสัมผัสสูงสุด (navigator.maxTouchPoints)</div>
          <div class="text-lg font-mono font-bold text-purple-400 mt-1">
            ${info.maxTouchPoints} จุดพร้อมกัน
          </div>
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">ชื่อจอภาพ (Monitor Name)</div>
          <div class="text-base font-mono font-medium text-neutral-200 mt-1 break-all">
            ${info.monitorName}
          </div>
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5">
          <div class="text-xs text-neutral-400">ระบบปฏิบัติการ (Operating System)</div>
          <div class="text-base font-mono font-medium text-neutral-200 mt-1">
            ${info.osPlatform} (${info.colorDepth}-bit color)
          </div>
        </div>
      </div>

      <div class="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-400 space-y-1">
        <div class="font-semibold text-neutral-300">ข้อมูล User Agent ของ WebView:</div>
        <div class="font-mono break-all">${info.userAgent}</div>
      </div>

      <div class="flex justify-end pt-1">
        <button
          id="btn-close-info-bottom"
          type="button"
          class="touch-btn px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-semibold text-white"
        >
          ตกลง / กลับเมนูหลัก
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

