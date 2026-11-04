import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";
import { normalizeKey } from "../core/keys";

type LightBleedModeId =
  | "black-0"
  | "gray-5"
  | "gray-10"
  | "gray-15"
  | "gray-20"
  | "gray-50"
  | "white-100"
  | "custom-gray"
  | "grid-3x3"
  | "grid-5x5";

interface LightBleedPreset {
  id: LightBleedModeId;
  name: string;
  defaultGray: number; // 0 - 255
  guide: string;
  isGrid?: boolean;
  gridCols?: number;
  gridRows?: number;
}

export class LightBleedTestModule implements TestModule {
  public readonly id: TestModuleId = "light-bleed";
  public readonly title = "5. แสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)";
  public readonly description =
    "จอดำสนิท เทาเข้มปรับละเอียดทีละ 1/255 และตาราง 3×3 / 5×5 เทียบความสม่ำเสมอของแสง";
  public readonly controlsHint =
    "ลูกศร ← / → สลับโหมด | ↑ / ↓ หรือ +/- ปรับเทาทีละ 1/255 | UI จะซ่อนอัตโนมัติใน 2 วินาที | Esc กลับเมนู";
  public readonly usesTouchDirectly = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentPresetIndex = 0;
  private currentGrayValue = 0; // ค่าสีเทา 0 - 255 (ปรับละเอียดทีละ 1/255)
  private rafId: number | null = null;
  private onStatusChange?: (status: string) => void;

  // Auto-hide UI หลังไม่มีการโต้ตอบ 2.5 วินาที
  private isUiVisible = true;
  private autoHideTimer: number | null = null;

  // การลากนิ้ว/เมาส์เพื่อปรับสไลเดอร์ค่าสีเทา 0-255
  private isDraggingSlider = false;
  private pointerStartX = 0;
  private pointerStartY = 0;

  public readonly presets: LightBleedPreset[] = [
    {
      id: "black-0",
      name: "จอดำสนิท 0% (RGB 0, 0, 0)",
      defaultGray: 0,
      guide: "ตรวจ Backlight Bleed แสงรั่วตามขอบและมุมจอ (แนะนำทดสอบในห้องมืด)",
    },
    {
      id: "gray-5",
      name: "เทาเข้ม 5% (RGB 13, 13, 13)",
      defaultGray: 13,
      guide: "ตรวจจุดด่างขาว (Clouding) และความไม่สม่ำเสมอของแสงในที่มืด",
    },
    {
      id: "gray-10",
      name: "เทาเข้ม 10% (RGB 26, 26, 26)",
      defaultGray: 26,
      guide: "ตรวจความสม่ำเสมอของหลอด Blacklight และเงาหมองตามมุม",
    },
    {
      id: "gray-15",
      name: "เทาเข้ม 15% (RGB 38, 38, 38)",
      defaultGray: 38,
      guide: "ตรวจริ้วรอยความสว่างและแถบแนวนอน/แนวตั้ง (Banding / Clouding)",
    },
    {
      id: "gray-20",
      name: "เทาเข้ม 20% (RGB 51, 51, 51)",
      defaultGray: 51,
      guide: "ตรวจการกระจายแสงพื้นหลังในระดับแสงเงาปานกลาง",
    },
    {
      id: "gray-50",
      name: "เทากลาง 50% (RGB 128, 128, 128)",
      defaultGray: 128,
      guide: "ตรวจ Mura (รอยด่างเป็นปื้นหรือความไม่สม่ำเสมอของผลึกจอ)",
    },
    {
      id: "white-100",
      name: "ขาวสว่างเต็มจอ 100% (RGB 255, 255, 255)",
      defaultGray: 255,
      guide: "ตรวจความสว่างไม่เท่ากันและขอบมืด (Vignetting) ทั่วทั้งแผงจอ",
    },
    {
      id: "custom-gray",
      name: "ปรับระดับสีเทาอิสระ (Custom Gray 0-255)",
      defaultGray: 30,
      guide: "ใช้ปุ่ม ↑ / ↓ หรือ +/- หรือลากนิ้ว เพื่อปรับสีเทาละเอียดทีละ 1/255",
    },
    {
      id: "grid-3x3",
      name: "ตารางโซน 3×3 (9 โซนเทียบความสว่าง)",
      defaultGray: 38,
      isGrid: true,
      gridCols: 3,
      gridRows: 3,
      guide: "เทียบความสว่างสัมพัทธ์ระหว่างโซนกลางจอกับขอบจอ 9 ส่วน",
    },
    {
      id: "grid-5x5",
      name: "ตารางโซน 5×5 (25 โซนเทียบความสว่าง)",
      defaultGray: 38,
      isGrid: true,
      gridCols: 5,
      gridRows: 5,
      guide: "เทียบความสม่ำเสมอของแสงละเอียด 25 โซนทั่วหน้าจอ",
    },
  ];

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentPresetIndex = 0;
    this.currentGrayValue = this.presets[0]?.defaultGray ?? 0;
    this.isUiVisible = true;
    this.startAutoHideTimer();

    this.emitStatus();
    this.draw();
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.autoHideTimer !== null) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    if (this.canvas) {
      this.canvas.style.cursor = "default";
    }
    this.canvas = null;
    this.ctx = null;
  }

  public onKey(e: KeyboardEvent): void {
    this.wakeUi();
    const k = normalizeKey(e);
    if (!k) return;

    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      this.nextPreset();
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      this.prevPreset();
    } else if (k === "ArrowUp" || k === "+") {
      // เพิ่มระดับสีเทาทีละ 1/255
      e.preventDefault();
      this.adjustGrayBy(1);
    } else if (k === "ArrowDown" || k === "-") {
      // ลดระดับสีเทาทีละ 1/255
      e.preventDefault();
      this.adjustGrayBy(-1);
    } else if (k === "g") {
      e.preventDefault();
      this.toggleGridMode();
    } else if (k === "Home") {
      e.preventDefault();
      this.setGrayValue(0);
    } else if (k === "End") {
      e.preventDefault();
      this.setGrayValue(255);
    }
  }

  public onPointer(e: PointerEvent): void {
    this.wakeUi();
    if (!this.canvas) return;

    if (e.type === "pointerdown") {
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;

      // ตรวจสอบว่าแตะบริเวณแถบสไลเดอร์ด้านล่างหรือไม่ (20% ด้านล่างของจอ)
      if (e.clientY > window.innerHeight * 0.8) {
        this.isDraggingSlider = true;
        this.updateGrayFromPointerX(e.clientX);
      }
    } else if (e.type === "pointermove") {
      if (this.isDraggingSlider) {
        this.updateGrayFromPointerX(e.clientX);
      }
    } else if (e.type === "pointerup") {
      if (!this.isDraggingSlider) {
        const dx = e.clientX - this.pointerStartX;
        const dy = e.clientY - this.pointerStartY;

        // ปัดซ้าย/ขวาเพื่อเปลี่ยนโหมด
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) this.nextPreset();
          else this.prevPreset();
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          // แตะสั้น ๆ บนจอ: แตะครึ่งขวาเพิ่มสีเทา แตะครึ่งซ้ายลดสีเทา
          if (e.clientX > window.innerWidth * 0.7) {
            this.adjustGrayBy(5);
          } else if (e.clientX < window.innerWidth * 0.3) {
            this.adjustGrayBy(-5);
          }
        }
      }
      this.isDraggingSlider = false;
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public nextPreset(): void {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presets.length;
    this.currentGrayValue = this.presets[this.currentPresetIndex]?.defaultGray ?? 0;
    this.emitStatus();
    this.scheduleDraw();
  }

  public prevPreset(): void {
    this.currentPresetIndex =
      (this.currentPresetIndex - 1 + this.presets.length) % this.presets.length;
    this.currentGrayValue = this.presets[this.currentPresetIndex]?.defaultGray ?? 0;
    this.emitStatus();
    this.scheduleDraw();
  }

  public toggleGridMode(): void {
    const cur = this.presets[this.currentPresetIndex];
    if (cur?.isGrid) {
      // กลับมาโหมดสีเดียว
      this.currentPresetIndex = 0;
    } else {
      // สลับไปโหมดตาราง 3x3
      const gridIndex = this.presets.findIndex((p) => p.id === "grid-3x3");
      if (gridIndex >= 0) this.currentPresetIndex = gridIndex;
    }
    this.currentGrayValue = this.presets[this.currentPresetIndex]?.defaultGray ?? 0;
    this.emitStatus();
    this.scheduleDraw();
  }

  /**
   * ปรับระดับสีเทาละเอียดทีละ 1/255 ตามเกณฑ์ตรวจรับ
   */
  public adjustGrayBy(delta: number): void {
    this.setGrayValue(this.currentGrayValue + delta);
  }

  public setGrayValue(val: number): void {
    const clamped = Math.max(0, Math.min(255, Math.round(val)));
    if (this.currentGrayValue !== clamped) {
      this.currentGrayValue = clamped;
      this.emitStatus();
      this.scheduleDraw();
    }
  }

  public getGrayValue(): number {
    return this.currentGrayValue;
  }

  public isUiCurrentlyVisible(): boolean {
    return this.isUiVisible;
  }

  public getCurrentPreset(): LightBleedPreset | undefined {
    return this.presets[this.currentPresetIndex];
  }

  private updateGrayFromPointerX(clientX: number): void {
    const margin = 40;
    const availableW = window.innerWidth - margin * 2;
    const ratio = Math.max(0, Math.min(1, (clientX - margin) / availableW));
    this.setGrayValue(ratio * 255);
  }

  private wakeUi(): void {
    if (!this.isUiVisible) {
      this.isUiVisible = true;
      if (this.canvas) {
        this.canvas.style.cursor = "default";
      }
      this.scheduleDraw();
    }
    this.startAutoHideTimer();
  }

  private startAutoHideTimer(): void {
    if (this.autoHideTimer !== null) {
      clearTimeout(this.autoHideTimer);
    }
    // ซ่อน UI ทั้งหมดอัตโนมัติเมื่อไม่มีการขยับ 2.5 วินาที ตามเกณฑ์ตรวจรับ
    this.autoHideTimer = window.setTimeout(() => {
      this.isUiVisible = false;
      if (this.canvas) {
        this.canvas.style.cursor = "none";
      }
      this.scheduleDraw();
    }, 2500);
  }

  private emitStatus(): void {
    const cur = this.presets[this.currentPresetIndex];
    if (!cur) return;
    const pct = ((this.currentGrayValue / 255) * 100).toFixed(1);
    this.onStatusChange?.(
      `โหมด ${this.currentPresetIndex + 1}/${this.presets.length}: ${cur.name} [ค่าสีเทา: ${this.currentGrayValue}/255 (${pct}%)]`
    );
  }

  private scheduleDraw(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }

  private draw(): void {
    if (!this.canvas || !this.ctx) return;
    const { width, height, dpr } = syncCanvasPhysicalSize(this.canvas);
    const ctx = this.ctx;
    const curPreset = this.presets[this.currentPresetIndex];
    const gray = this.currentGrayValue;

    if (curPreset?.isGrid && curPreset.gridCols && curPreset.gridRows) {
      // 1. โหมดตารางเทียบความสว่างระหว่างโซน (3x3 หรือ 5x5)
      this.drawZoneGrid(ctx, width, height, dpr, curPreset.gridCols, curPreset.gridRows, gray);
    } else {
      // 2. โหมดเติมสีเต็มจอ 100% ปลอดสิ่งบดบัง
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. แสดง UI เฉพาะเมื่อผู้ใช้กำลังขยับ/โต้ตอบ (ซ่อนอัตโนมัติเมื่อหยุดนิ่ง)
    // เกณฑ์ตรวจรับ: ไม่มีองค์ประกอบ UI ค้างบนจอระหว่างทดสอบ
    if (this.isUiVisible) {
      this.drawInteractionOverlay(ctx, width, height, dpr, curPreset, gray);
    }
  }

  private drawZoneGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    cols: number,
    rows: number,
    gray: number
  ): void {
    // พื้นหลังสีดำระหว่างร่องโซน
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    const gap = Math.max(2, Math.round(4 * dpr));
    const cellW = (w - gap * (cols + 1)) / cols;
    const cellH = (h - gap * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gap + c * (cellW + gap);
        const y = gap + r * (cellH + gap);

        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        ctx.fillRect(x, y, cellW, cellH);

        // หมายเลขโซน (แสดงจาง ๆ เมื่อ UI แสดง)
        if (this.isUiVisible) {
          const zoneIndex = r * cols + c + 1;
          ctx.fillStyle = gray > 140 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)";
          ctx.font = `bold ${Math.round(14 * dpr)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`โซน ${zoneIndex}`, x + cellW / 2, y + cellH / 2);
        }
      }
    }
  }

  private drawInteractionOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    curPreset: LightBleedPreset | undefined,
    gray: number
  ): void {
    // แถบข้อมูลด้านบน: คำแนะนำและโหมดปัจจุบัน
    const bannerH = Math.round(76 * dpr);
    const bannerW = Math.min(w - Math.round(40 * dpr), Math.round(680 * dpr));
    const bannerX = (w - bannerW) / 2;
    const bannerY = Math.round(20 * dpr);

    ctx.fillStyle = "rgba(10, 10, 10, 0.88)";
    ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${curPreset?.name ?? "โหมดทดสอบ"} | ระดับสีเทา: ${gray}/255`,
      bannerX + Math.round(16 * dpr),
      bannerY + Math.round(12 * dpr)
    );

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.round(11 * dpr)}px sans-serif`;
    ctx.fillText(
      curPreset?.guide ?? "",
      bannerX + Math.round(16 * dpr),
      bannerY + Math.round(32 * dpr)
    );

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.round(10 * dpr)}px sans-serif`;
    ctx.fillText(
      "คำแนะนำ: ควรทดสอบในห้องมืด ปรับความสว่างจอ 100% และมองจากหน้าตรง (UI ซ่อนอัตโนมัติใน 2 วิ)",
      bannerX + Math.round(16 * dpr),
      bannerY + Math.round(52 * dpr)
    );

    // สไลเดอร์ปรับค่าสีเทา 0 - 255 ด้านล่าง
    const sliderW = Math.min(w - Math.round(60 * dpr), Math.round(620 * dpr));
    const sliderH = Math.round(20 * dpr);
    const sliderX = (w - sliderW) / 2;
    const sliderY = h - sliderH - Math.round(30 * dpr);

    // รางสไลเดอร์
    const grad = ctx.createLinearGradient(sliderX, 0, sliderX + sliderW, 0);
    grad.addColorStop(0, "#000000");
    grad.addColorStop(1, "#ffffff");
    ctx.fillStyle = grad;
    ctx.fillRect(sliderX, sliderY, sliderW, sliderH);
    ctx.strokeStyle = "#525252";
    ctx.lineWidth = 1;
    ctx.strokeRect(sliderX, sliderY, sliderW, sliderH);

    // ปุ่มจับ (Thumb)
    const thumbX = sliderX + (gray / 255) * sliderW;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(thumbX - Math.round(6 * dpr), sliderY - Math.round(4 * dpr), Math.round(12 * dpr), sliderH + Math.round(8 * dpr));
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(thumbX - Math.round(6 * dpr), sliderY - Math.round(4 * dpr), Math.round(12 * dpr), sliderH + Math.round(8 * dpr));

    // ป้ายบอกค่าที่ตัวเลื่อน
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${gray}/255`, thumbX, sliderY - Math.round(10 * dpr));
  }
}
