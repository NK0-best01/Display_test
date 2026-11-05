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
    "จอดำสนิท เทาเข้มปรับละเอียดทีละ 1/255 และตาราง 5×5 (25 โซน) เทียบความสม่ำเสมอของแสง";
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
    } else if (k === "ArrowUp" || k === "+" || k === "=") {
      // เพิ่มระดับสีเทาทีละ 1/255
      e.preventDefault();
      this.adjustGrayBy(1);
    } else if (k === "ArrowDown" || k === "-" || k === "_") {
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

  private getControlsLayout(w: number, h: number, dpr: number) {
    const sliderW = Math.min(w - Math.round(60 * dpr), Math.round(620 * dpr));
    const sliderH = Math.round(18 * dpr);
    const sliderX = (w - sliderW) / 2;
    const sliderY = h - sliderH - Math.round(22 * dpr);

    const btnH = Math.round(42 * dpr);
    // เว้นระยะห่างจากแถบสไลเดอร์และตัวเลข 0/255 อย่างน้อย 30px เพื่อไม่ให้ชิดเกินไป
    const btnY = sliderY - btnH - Math.round(30 * dpr);

    const prevW = Math.round(130 * dpr);
    const adjW = Math.round(60 * dpr);
    const gridW = Math.round(160 * dpr);
    const nextW = Math.round(130 * dpr);
    const gap = Math.round(12 * dpr);
    const totalW = prevW + adjW * 2 + gridW + nextW + gap * 4;
    const startX = Math.round((w - totalW) / 2);

    return {
      sliderW,
      sliderH,
      sliderX,
      sliderY,
      btnH,
      btnY,
      prevX: startX,
      prevW,
      minusX: startX + prevW + gap,
      minusW: adjW,
      gridX: startX + prevW + gap + adjW + gap,
      gridW,
      plusX: startX + prevW + gap + adjW + gap + gridW + gap,
      plusW: adjW,
      nextX: startX + prevW + gap + adjW + gap + gridW + gap + adjW + gap,
      nextW,
    };
  }

  public onPointer(e: PointerEvent): void {
    this.wakeUi();
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const physX = Math.round(e.clientX * dpr);
    const physY = Math.round(e.clientY * dpr);

    if (e.type === "pointerdown") {
      const layout = this.getControlsLayout(this.canvas.width, this.canvas.height, dpr);
      const hitPadding = Math.round(6 * dpr);

      // ตรวจสอบการกดปุ่มสัมผัสควบคุม
      if (physY >= layout.btnY - hitPadding && physY <= layout.btnY + layout.btnH + hitPadding) {
        if (physX >= layout.prevX - hitPadding && physX <= layout.prevX + layout.prevW + hitPadding) {
          this.prevPreset();
          return;
        }
        if (physX >= layout.minusX - hitPadding && physX <= layout.minusX + layout.minusW + hitPadding) {
          this.adjustGrayBy(-5);
          return;
        }
        if (physX >= layout.gridX - hitPadding && physX <= layout.gridX + layout.gridW + hitPadding) {
          this.toggleGridMode();
          return;
        }
        if (physX >= layout.plusX - hitPadding && physX <= layout.plusX + layout.plusW + hitPadding) {
          this.adjustGrayBy(5);
          return;
        }
        if (physX >= layout.nextX - hitPadding && physX <= layout.nextX + layout.nextW + hitPadding) {
          this.nextPreset();
          return;
        }
      }

      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;

      // ตรวจสอบการลากสไลเดอร์: ดักจับเฉพาะแถบสไลเดอร์ +/- 16px
      const sliderMargin = Math.round(16 * dpr);
      if (physY >= layout.sliderY - sliderMargin && physY <= layout.sliderY + layout.sliderH + sliderMargin) {
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
      // สลับไปโหมดตาราง 5x5
      const gridIndex = this.presets.findIndex((p) => p.id === "grid-5x5");
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
      // 1. โหมดตารางเทียบความสว่างระหว่างโซน 5x5 (25 โซน)
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

    // โครงสร้างเลย์เอาต์สไลเดอร์และปุ่มควบคุมด้านล่าง (เว้นระยะห่างไม่อัดแน่น)
    const layout = this.getControlsLayout(w, h, dpr);

    // รางสไลเดอร์
    const grad = ctx.createLinearGradient(layout.sliderX, 0, layout.sliderX + layout.sliderW, 0);
    grad.addColorStop(0, "#000000");
    grad.addColorStop(1, "#ffffff");
    ctx.fillStyle = grad;
    ctx.fillRect(layout.sliderX, layout.sliderY, layout.sliderW, layout.sliderH);
    ctx.strokeStyle = "#525252";
    ctx.lineWidth = 1;
    ctx.strokeRect(layout.sliderX, layout.sliderY, layout.sliderW, layout.sliderH);

    // ปุ่มจับ (Thumb)
    const thumbX = layout.sliderX + (gray / 255) * layout.sliderW;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(thumbX - Math.round(6 * dpr), layout.sliderY - Math.round(4 * dpr), Math.round(12 * dpr), layout.sliderH + Math.round(8 * dpr));
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(thumbX - Math.round(6 * dpr), layout.sliderY - Math.round(4 * dpr), Math.round(12 * dpr), layout.sliderH + Math.round(8 * dpr));

    // ป้ายบอกค่าที่ตัวเลื่อน (วางเหนือสไลเดอร์ในช่องว่างระหว่างปุ่มกับสไลเดอร์ ไม่ทับกับปุ่ม)
    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${gray}/255`, thumbX, layout.sliderY - Math.round(10 * dpr));

    // แถบปุ่มสัมผัสควบคุม (วางอยู่เหนือสไลเดอร์และตัวเลข โดยเว้นระยะห่างสบายตา)
    const drawBtn = (x: number, y: number, bw: number, bh: number, label: string, active = false) => {
      ctx.fillStyle = active ? "#0284c7" : "rgba(24, 24, 27, 0.9)";
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = active ? "#38bdf8" : "#3f3f46";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, bw, bh);

      ctx.fillStyle = active ? "#ffffff" : "#d4d4d8";
      ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + bw / 2, y + bh / 2);
    };

    drawBtn(layout.prevX, layout.btnY, layout.prevW, layout.btnH, "◀ ก่อนหน้า");
    drawBtn(layout.minusX, layout.btnY, layout.minusW, layout.btnH, "-5");
    const isGridActive = curPreset?.isGrid ?? false;
    drawBtn(
      layout.gridX,
      layout.btnY,
      layout.gridW,
      layout.btnH,
      isGridActive ? "ตาราง 5×5: เปิด" : "ตาราง 5×5 (G)",
      isGridActive
    );
    drawBtn(layout.plusX, layout.btnY, layout.plusW, layout.btnH, "+5");
    drawBtn(layout.nextX, layout.btnY, layout.nextW, layout.btnH, "ถัดไป ▶");
  }
}
