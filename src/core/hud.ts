export interface HudUpdatePayload {
  title: string;
  controlsHint: string;
  subStatus?: string;
}

/**
 * ตัวจัดการ HUD มุมจอ และตัวบ่งชี้การกดค้างมุมซ้ายบน 1 วินาทีเพื่อกลับเมนูหลัก
 */
export class HudController {
  private container: HTMLDivElement;
  private hudBox: HTMLDivElement;
  private pillBtn: HTMLButtonElement;
  private titleEl: HTMLElement;
  private statusEl: HTMLElement;
  private hintEl: HTMLElement;
  private cornerIndicator: HTMLDivElement;
  private cornerProgressEl: HTMLDivElement;
  private visible = true;
  private onBackTrigger: () => void;

  constructor(parent: HTMLElement, onBackTrigger: () => void) {
    this.onBackTrigger = onBackTrigger;

    this.container = document.createElement("div");
    this.container.className = "fixed inset-0 pointer-events-none z-40";

    // โซน индикаเตอร์มุมซ้ายบน (แสดงความคืบหน้าเมื่อกดค้างเพื่อกลับเมนู)
    this.cornerIndicator = document.createElement("div");
    this.cornerIndicator.className =
      "fixed top-0 left-0 w-28 h-28 pointer-events-none flex flex-col items-start justify-start p-2 opacity-0 transition-opacity duration-150";
    this.cornerIndicator.innerHTML = `
      <div class="bg-neutral-900/95 border border-neutral-700 text-white text-xs px-3 py-2 rounded-xl shadow-lg">
        <div class="font-medium">แตะค้างเพื่อกลับเมนู...</div>
        <div class="w-full bg-neutral-700 h-2 rounded-full mt-1.5 overflow-hidden">
          <div id="hud-corner-bar" class="bg-amber-400 h-full w-0 transition-all"></div>
        </div>
      </div>
    `;
    this.cornerProgressEl = this.cornerIndicator.querySelector("#hud-corner-bar") as HTMLDivElement;

    // ปุ่มลอยเมื่อซ่อน HUD เพื่อให้ใช้นิ้วแตะเรียกกลับมาได้เสมอ ไม่ต้องพึ่งคีย์บอร์ด
    this.pillBtn = document.createElement("button");
    this.pillBtn.type = "button";
    this.pillBtn.id = "hud-floating-pill";
    this.pillBtn.className =
      "fixed top-3 right-3 px-4 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-200 pointer-events-auto select-none shadow-lg transition-all hidden";
    this.pillBtn.innerHTML = "☰ แสดงแผงควบคุม / เมนู";
    this.pillBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.pillBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setVisible(true);
    });

    // กล่อง HUD มุมขวาบน (เพื่อไม่ทับกับโซนกดค้างมุมซ้ายบน)
    this.hudBox = document.createElement("div");
    this.hudBox.className =
      "fixed top-3 right-3 max-w-xs md:max-w-sm bg-neutral-900/90 border border-neutral-700 text-neutral-100 rounded-xl p-3 pointer-events-auto select-none";

    this.hudBox.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 id="hud-title" class="font-bold text-sm md:text-base text-white leading-tight"></h3>
          <p id="hud-status" class="text-xs text-emerald-400 font-mono mt-0.5"></p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            id="hud-btn-hide"
            type="button"
            title="ซ่อน HUD (ปุ่ม H หรือแตะ 3 นิ้ว)"
            class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-xs font-semibold text-neutral-200 cursor-pointer min-h-[38px] transition-colors"
          >
            ซ่อน (H)
          </button>
          <button
            id="hud-btn-back"
            type="button"
            title="กลับเมนูหลัก (Esc)"
            class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-800 text-xs font-semibold text-white cursor-pointer min-h-[38px] transition-colors shadow-sm"
          >
            เมนู (Esc)
          </button>
        </div>
      </div>
      <div id="hud-hint" class="text-xs text-neutral-300 mt-2 pt-2 border-t border-neutral-800 leading-relaxed"></div>
    `;

    this.titleEl = this.hudBox.querySelector("#hud-title") as HTMLElement;
    this.statusEl = this.hudBox.querySelector("#hud-status") as HTMLElement;
    this.hintEl = this.hudBox.querySelector("#hud-hint") as HTMLElement;

    const hideBtn = this.hudBox.querySelector("#hud-btn-hide") as HTMLButtonElement;
    const backBtn = this.hudBox.querySelector("#hud-btn-back") as HTMLButtonElement;

    hideBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    backBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onBackTrigger();
    });

    this.container.appendChild(this.cornerIndicator);
    this.container.appendChild(this.pillBtn);
    this.container.appendChild(this.hudBox);
    parent.appendChild(this.container);
  }

  public update(payload: HudUpdatePayload): void {
    this.titleEl.textContent = payload.title;
    this.hintEl.textContent = payload.controlsHint;
    if (payload.subStatus) {
      this.statusEl.textContent = payload.subStatus;
      this.statusEl.style.display = "block";
    } else {
      this.statusEl.textContent = "";
      this.statusEl.style.display = "none";
    }
  }

  public setSubStatus(subStatus: string): void {
    this.statusEl.textContent = subStatus;
    this.statusEl.style.display = subStatus ? "block" : "none";
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.hudBox.style.display = visible ? "block" : "none";
    if (visible) {
      this.pillBtn.classList.add("hidden");
    } else {
      this.pillBtn.classList.remove("hidden");
    }
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  public setCornerHoldProgress(progress0to1: number): void {
    if (progress0to1 <= 0) {
      this.cornerIndicator.style.opacity = "0";
      this.cornerProgressEl.style.width = "0%";
    } else {
      this.cornerIndicator.style.opacity = "1";
      const pct = Math.min(100, Math.max(0, Math.round(progress0to1 * 100)));
      this.cornerProgressEl.style.width = `${pct}%`;
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
