import type { TestModule, TestModuleId } from "./types";
import { HudController } from "./hud";
import { syncCanvasPhysicalSize } from "./display-info";
import { setFullscreenState, toggleFullscreen } from "./fullscreen";
import { renderMainMenu } from "../ui/menu";
import { renderInfoModal } from "../ui/info-modal";
import { normalizeKey } from "./keys";

const CORNER_ZONE_PX = 96; // พื้นที่มุมซ้ายบน 96x96 CSS px สำหรับกดค้างกลับเมนู
const CORNER_HOLD_MS = 1000; // กดค้าง 1 วินาที

export class AppRouter {
  private root: HTMLElement;
  private modules: Map<TestModuleId, TestModule> = new Map();
  private moduleList: TestModule[] = [];
  private activeModule: TestModule | null = null;
  private infoModalOpen = false;

  // องค์ประกอบขณะอยู่ในหน้าทดสอบ
  private canvasContainer: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HudController | null = null;

  // สถานะสำหรับตรวจจับการแตะ 3 นิ้ว และการกดค้างมุมซ้ายบน
  private activePointers: Set<number> = new Set();
  private threeFingerTriggered = false;
  private cornerHoldPointerId: number | null = null;
  private cornerHoldStartTime = 0;
  private cornerHoldRafId: number | null = null;

  // Bound listeners เพื่อให้ถอดออกได้สะอาดเมื่อสลับหน้า (ป้องกัน Memory Leak)
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundTouchStartFallback: (e: TouchEvent) => void;

  constructor(root: HTMLElement, modules: TestModule[]) {
    this.root = root;
    this.moduleList = modules;
    for (const m of modules) {
      this.modules.set(m.id, m);
    }

    this.boundKeyDown = (e) => this.handleGlobalKeyDown(e);
    this.boundResize = () => this.handleResize();
    this.boundPointerDown = (e) => this.handleTestPointer(e);
    this.boundPointerMove = (e) => this.handleTestPointer(e);
    this.boundPointerUp = (e) => this.handleTestPointer(e);
    this.boundTouchStartFallback = (e) => this.handleTouchThreeFingerFallback(e);

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("resize", this.boundResize);
  }

  /**
   * แสดงหน้าเมนูหลักและล้างหน้าทดสอบเดิมออกทั้งหมด
   */
  public async showMenu(): Promise<void> {
    this.teardownActiveTest();
    this.infoModalOpen = false;

    await renderMainMenu(this.root, this.moduleList, {
      onSelectTest: (id) => this.startTest(id),
      onOpenInfo: () => this.openInfo(),
    });
  }

  /**
   * เข้าสู่หน้าทดสอบตามรหัสโมดูล
   */
  public startTest(id: TestModuleId): void {
    const mod = this.modules.get(id);
    if (!mod) return;

    // ล้างหน้าทดสอบเดิมก่อนเสมอ
    this.teardownActiveTest();
    this.infoModalOpen = false;
    this.root.innerHTML = "";

    // สร้าง Container และ Canvas เต็มความละเอียดจริงของจอ (ไม่มี filter/shadow/transition)
    const container = document.createElement("div");
    container.className = "test-canvas-container";

    const canvas = document.createElement("canvas");
    canvas.className = "test-canvas";
    container.appendChild(canvas);
    this.root.appendChild(container);

    syncCanvasPhysicalSize(canvas);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("ไม่สามารถสร้าง CanvasRenderingContext2D ได้");
    }

    // สร้าง HUD มุมขวาบน
    const hud = new HudController(this.root, () => {
      void this.showMenu();
    });
    hud.update({
      title: mod.title,
      controlsHint: mod.controlsHint,
    });

    this.canvasContainer = container;
    this.canvas = canvas;
    this.ctx = ctx;
    this.hud = hud;
    this.activeModule = mod;

    // ผูก Event บน Canvas สำหรับการทดสอบ
    canvas.addEventListener("pointerdown", this.boundPointerDown);
    canvas.addEventListener("pointermove", this.boundPointerMove);
    canvas.addEventListener("pointerup", this.boundPointerUp);
    canvas.addEventListener("pointercancel", this.boundPointerUp);
    canvas.addEventListener("touchstart", this.boundTouchStartFallback, {
      passive: false,
    });

    // เริ่มการทำงานของโมดูลทดสอบ
    mod.start(canvas, ctx);
  }

  /**
   * อัปเดตข้อความสถานะย่อยใน HUD (เรียกจากโมดูลทดสอบ)
   */
  public updateHudSubStatus(subStatus: string): void {
    this.hud?.setSubStatus(subStatus);
  }

  /**
   * เปิดหน้าต่าง Info
   */
  public async openInfo(): Promise<void> {
    if (this.activeModule || this.infoModalOpen) return;
    this.infoModalOpen = true;
    await renderInfoModal(this.root, () => {
      this.infoModalOpen = false;
    });
  }

  /**
   * หยุดโมดูลปัจจุบันและถอด Listener / RAF ทั้งหมดอย่างสะอาด (ไม่มี Memory Leak)
   */
  private teardownActiveTest(): void {
    this.cancelCornerHold();
    this.activePointers.clear();
    this.threeFingerTriggered = false;

    if (this.activeModule) {
      this.activeModule.stop();
      this.activeModule = null;
    }

    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
      this.canvas.removeEventListener("pointermove", this.boundPointerMove);
      this.canvas.removeEventListener("pointerup", this.boundPointerUp);
      this.canvas.removeEventListener("pointercancel", this.boundPointerUp);
      this.canvas.removeEventListener("touchstart", this.boundTouchStartFallback);
      this.canvas.remove();
      this.canvas = null;
    }

    this.ctx = null;

    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }

    if (this.canvasContainer) {
      this.canvasContainer.remove();
      this.canvasContainer = null;
    }
  }

  /**
   * จัดการคีย์ลัดระดับแอป (F11, Esc, H, เลข 1-8 ในเมนู) ผ่าน normalizeKey
   */
  private async handleGlobalKeyDown(e: KeyboardEvent): Promise<void> {
    const k = normalizeKey(e);
    if (!k) return;

    if (k === "F11") {
      e.preventDefault();
      await toggleFullscreen();
      this.handleResize();
      return;
    }

    // หากเปิดหน้าต่าง Info อยู่ กด Esc เพื่อปิด Info
    if (this.infoModalOpen && k === "Escape") {
      e.preventDefault();
      const closeBtn = document.getElementById("btn-close-info");
      closeBtn?.click();
      return;
    }

    // หากอยู่ในหน้าทดสอบ
    if (this.activeModule) {
      if (k === "Escape") {
        e.preventDefault();
        await this.showMenu();
        return;
      }
      if (k === "h") {
        e.preventDefault();
        this.hud?.toggle();
        return;
      }

      // ส่งต่อให้โมดูลทดสอบจัดการต่อ
      this.activeModule.onKey(e);
      return;
    }

    // หากอยู่ในหน้าเมนูหลัก: กด Esc ออกจาก Fullscreen, กด 1-8 เข้าหัวข้อทดสอบ, กด I เปิด Info
    if (k === "Escape") {
      e.preventDefault();
      await setFullscreenState(false);
      await this.showMenu();
      return;
    }

    if (k === "i") {
      e.preventDefault();
      await this.openInfo();
      return;
    }

    const num = Number.parseInt(k, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= this.moduleList.length) {
      e.preventDefault();
      const target = this.moduleList[num - 1];
      if (target) this.startTest(target.id);
    }
  }

  /**
   * จัดการ Pointer Events บน Canvas (ตรวจจับกดค้างมุมซ้ายบน 1 วินาที + แตะ 3 นิ้วซ่อน HUD + ส่งต่อให้โมดูล)
   */
  private handleTestPointer(e: PointerEvent): void {
    if (!this.activeModule) return;

    if (e.type === "pointerdown") {
      this.activePointers.add(e.pointerId);
      try {
        this.canvas?.setPointerCapture(e.pointerId);
      } catch {
        // บางเคสของเมาส์หรือสังเคราะห์ Event อาจไม่รองรับ pointer capture
      }

      // เช็คการแตะ 3 นิ้วพร้อมกันเพื่อสลับ HUD
      if (this.activePointers.size === 3 && !this.threeFingerTriggered) {
        this.threeFingerTriggered = true;
        this.hud?.toggle();
      }

      // เช็คการกดค้างมุมซ้ายบน (x <= 96, y <= 96) เมื่อมีนิ้วเดียว
      if (
        this.activePointers.size === 1 &&
        e.clientX <= CORNER_ZONE_PX &&
        e.clientY <= CORNER_ZONE_PX
      ) {
        this.startCornerHold(e.pointerId);
      } else {
        this.cancelCornerHold();
      }
    } else if (e.type === "pointermove") {
      if (this.cornerHoldPointerId === e.pointerId) {
        if (e.clientX > CORNER_ZONE_PX || e.clientY > CORNER_ZONE_PX) {
          this.cancelCornerHold();
        }
      }
    } else if (e.type === "pointerup" || e.type === "pointercancel") {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size === 0) {
        this.threeFingerTriggered = false;
      }
      if (this.cornerHoldPointerId === e.pointerId) {
        this.cancelCornerHold();
      }
    }

    // ส่งต่อให้โมดูลทดสอบเสมอ
    this.activeModule.onPointer(e);
  }

  /**
   * Fallback สำหรับ WebKitGTK บน Linux (X11) กรณีแตะ 3 นิ้วผ่าน TouchEvent
   */
  private handleTouchThreeFingerFallback(e: TouchEvent): void {
    if (e.touches.length === 3 && !this.threeFingerTriggered) {
      this.threeFingerTriggered = true;
      this.hud?.toggle();
    }
  }

  private startCornerHold(pointerId: number): void {
    this.cancelCornerHold();
    this.cornerHoldPointerId = pointerId;
    this.cornerHoldStartTime = performance.now();

    const tick = (now: number) => {
      if (this.cornerHoldPointerId !== pointerId) return;
      const elapsed = now - this.cornerHoldStartTime;
      const progress = Math.min(1, elapsed / CORNER_HOLD_MS);
      this.hud?.setCornerHoldProgress(progress);

      if (elapsed >= CORNER_HOLD_MS) {
        this.cancelCornerHold();
        void this.showMenu();
        return;
      }
      this.cornerHoldRafId = requestAnimationFrame(tick);
    };

    this.cornerHoldRafId = requestAnimationFrame(tick);
  }

  private cancelCornerHold(): void {
    this.cornerHoldPointerId = null;
    if (this.cornerHoldRafId !== null) {
      cancelAnimationFrame(this.cornerHoldRafId);
      this.cornerHoldRafId = null;
    }
    this.hud?.setCornerHoldProgress(0);
  }

  private handleResize(): void {
    if (this.activeModule && this.canvas && this.ctx) {
      syncCanvasPhysicalSize(this.canvas);
      this.activeModule.onResize?.(this.canvas, this.ctx);
    } else if (!this.activeModule && !this.infoModalOpen) {
      void this.showMenu();
    }
  }

  /**
   * สำหรับการทดสอบอัตโนมัติ (Self-Test): อ่านสถานะปัจจุบันของ Router
   */
  public getActiveModuleId(): TestModuleId | null {
    return this.activeModule?.id ?? null;
  }

  public isHudVisible(): boolean {
    return this.hud?.isVisible() ?? false;
  }
}

