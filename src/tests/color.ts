import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";
import { normalizeKey } from "../core/keys";

interface ColorPatternItem {
  id: string;
  name: string;
  guide: string;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => void;
  // ค่าสีอ้างอิงสำหรับตรวจรับใน automated verification
  expectedColors?: Array<{ xPercent: number; yPercent: number; r: number; g: number; b: number; name: string }>;
}

export class ColorTestModule implements TestModule {
  public readonly id: TestModuleId = "color";
  public readonly title = "3. ทดสอบสี (Color Accuracy & Gradient)";
  public readonly description =
    "สีเต็มจอ 8 สี, แถบสีมาตรฐาน SMPTE, การไล่เฉด R/G/B, สีเทียบธรรมชาติ และตรวจสีเพี้ยน White/Gray Tint";
  public readonly controlsHint =
    "ลูกศร ← / → หรือแตะซ้าย/ขวา เพื่อเปลี่ยนภาพ | กด D เปิด/ปิดตรวจค่าสี RGB | H ซ่อน HUD | Esc กลับเมนู";
  public readonly usesTouchDirectly = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentIndex = 0;
  private rafId: number | null = null;
  private pointerStartX: number | null = null;
  private pointerStartY: number | null = null;
  private onStatusChange?: (status: string) => void;

  // โหมด Debug Inspector เพื่ออ่านค่า pixel จาก canvas ตามเกณฑ์ตรวจรับ
  private debugInspectorActive = false;
  private targetPhysicalPos: { x: number; y: number } | null = null;
  private inspectedPixel: { x: number; y: number; r: number; g: number; b: number; hex: string } | null = null;

  public patterns: ColorPatternItem[] = [];

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
    this.initPatterns();
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentIndex = 0;
    this.debugInspectorActive = false;
    this.inspectedPixel = null;
    this.emitStatus();
    this.draw();
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.pointerStartX = null;
    this.pointerStartY = null;
    this.inspectedPixel = null;
  }

  public onKey(e: KeyboardEvent): void {
    const k = normalizeKey(e);
    if (!k) return;

    if (
      k === "ArrowRight" ||
      k === " " ||
      k === "Space" ||
      k === "PageDown"
    ) {
      e.preventDefault();
      this.nextPattern();
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      this.prevPattern();
    } else if (k === "Home") {
      e.preventDefault();
      this.currentIndex = 0;
      this.emitStatus();
      this.scheduleDraw();
    } else if (k === "End") {
      e.preventDefault();
      this.currentIndex = this.patterns.length - 1;
      this.emitStatus();
      this.scheduleDraw();
    } else if (k === "d" || e.code === "KeyD" || e.key === "d" || e.key === "D" || e.key === "ก" || e.key === "ด") {
      e.preventDefault();
      this.toggleDebugInspector();
    }
  }

  private getTouchToolbarBounds(w: number, h: number, dpr: number) {
    const btnW = Math.round(140 * dpr);
    const centerBtnW = Math.round(180 * dpr);
    const btnH = Math.round(44 * dpr);
    const btnY = h - btnH - Math.round(14 * dpr);
    const prevX = Math.round(20 * dpr);
    const centerX = Math.round((w - centerBtnW) / 2);
    const nextX = w - btnW - Math.round(20 * dpr);
    return { btnW, centerBtnW, btnH, btnY, prevX, centerX, nextX };
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas || !this.ctx) return;

    if (e.type === "pointerdown") {
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;

      const dpr = window.devicePixelRatio || 1;
      const physX = Math.round(e.clientX * dpr);
      const physY = Math.round(e.clientY * dpr);
      const { btnW, centerBtnW, btnH, btnY, prevX, centerX, nextX } = this.getTouchToolbarBounds(
        this.canvas.width,
        this.canvas.height,
        dpr
      );

      const hitPadding = Math.round(6 * dpr);
      if (physY >= btnY - hitPadding && physY <= btnY + btnH + hitPadding) {
        if (physX >= prevX - hitPadding && physX <= prevX + btnW + hitPadding) {
          this.pointerStartX = null;
          this.prevPattern();
          return;
        }
        if (physX >= centerX - hitPadding && physX <= centerX + centerBtnW + hitPadding) {
          this.pointerStartX = null;
          this.toggleDebugInspector();
          return;
        }
        if (physX >= nextX - hitPadding && physX <= nextX + btnW + hitPadding) {
          this.pointerStartX = null;
          this.nextPattern();
          return;
        }
      }

      if (this.debugInspectorActive && this.canvas) {
        this.updateTargetPosFromPointer(e.clientX, e.clientY);
      }
    } else if (e.type === "pointermove") {
      if (this.debugInspectorActive && (e.buttons > 0 || e.pointerType === "mouse") && this.canvas) {
        this.updateTargetPosFromPointer(e.clientX, e.clientY);
      }
    } else if (e.type === "pointerup") {
      if (this.pointerStartX !== null) {
        const dx = e.clientX - this.pointerStartX;
        const dy = e.clientY - (this.pointerStartY ?? e.clientY);

        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) this.nextPattern();
          else this.prevPattern();
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          if (!this.debugInspectorActive) {
            if (e.clientX > window.innerWidth / 2) {
              this.nextPattern();
            } else {
              this.prevPattern();
            }
          }
        }
      }
      this.pointerStartX = null;
      this.pointerStartY = null;
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public nextPattern(): void {
    this.currentIndex = (this.currentIndex + 1) % this.patterns.length;
    this.inspectedPixel = null;
    this.emitStatus();
    this.scheduleDraw();
  }

  public prevPattern(): void {
    this.currentIndex =
      (this.currentIndex - 1 + this.patterns.length) % this.patterns.length;
    this.inspectedPixel = null;
    this.emitStatus();
    this.scheduleDraw();
  }

  public toggleDebugInspector(): void {
    this.debugInspectorActive = !this.debugInspectorActive;
    this.targetPhysicalPos = null;
    this.inspectedPixel = null;
    this.emitStatus();
    this.scheduleDraw();
  }

  public isDebugInspectorActive(): boolean {
    return this.debugInspectorActive;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * อ่านค่าสีจริงจากพิกเซลบน Canvas ด้วย ctx.getImageData (ตรงตามเกณฑ์ตรวจรับข้อ 1)
   */
  public readPixelAt(physicalX: number, physicalY: number): { r: number; g: number; b: number; a: number } | null {
    if (!this.ctx || !this.canvas) return null;
    const clampedX = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(physicalX)));
    const clampedY = Math.max(0, Math.min(this.canvas.height - 1, Math.floor(physicalY)));
    const pixel = this.ctx.getImageData(clampedX, clampedY, 1, 1).data;
    return {
      r: pixel[0],
      g: pixel[1],
      b: pixel[2],
      a: pixel[3],
    };
  }

  private updateTargetPosFromPointer(clientX: number, clientY: number): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = Math.round((clientX - rect.left) * scaleX);
    const py = Math.round((clientY - rect.top) * scaleY);
    this.targetPhysicalPos = {
      x: Math.max(0, Math.min(this.canvas.width - 1, px)),
      y: Math.max(0, Math.min(this.canvas.height - 1, py)),
    };
    this.scheduleDraw();
  }

  private emitStatus(): void {
    const cur = this.patterns[this.currentIndex];
    if (cur) {
      const dbg = this.debugInspectorActive ? " [โหมดตรวจสี Debug ON]" : "";
      this.onStatusChange?.(
        `${this.currentIndex + 1}/${this.patterns.length}: ${cur.name} — ${cur.guide}${dbg}`
      );
    }
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
    const pattern = this.patterns[this.currentIndex];
    if (pattern) {
      pattern.draw(this.ctx, width, height, dpr);
    }

    // อ่านค่าสีจากภาพทดสอบ "ก่อน" วาด Overlay ใด ๆ ทับ (แก้ปัญหาอ่านโดนสีเป้าเล็ง 0/255 ตามข้อกำหนด Part 13)
    if (this.debugInspectorActive) {
      const targetX = this.targetPhysicalPos?.x ?? Math.floor(width / 2);
      const targetY = this.targetPhysicalPos?.y ?? Math.floor(height / 2);
      const clampedX = Math.max(0, Math.min(width - 1, Math.floor(targetX)));
      const clampedY = Math.max(0, Math.min(height - 1, Math.floor(targetY)));

      const pixelData = this.ctx.getImageData(clampedX, clampedY, 1, 1).data;
      const r = pixelData[0] ?? 0;
      const g = pixelData[1] ?? 0;
      const b = pixelData[2] ?? 0;
      const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

      this.inspectedPixel = {
        x: clampedX,
        y: clampedY,
        r,
        g,
        b,
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      };

      // วาด Overlay แสดงค่าสีและเป้าเล็งทับลงไปหลังจากอ่านค่าเสร็จแล้วเท่านั้น
      this.drawDebugOverlay(this.ctx, width, height, dpr, this.inspectedPixel);
    }

    // วาดแถบปุ่มสัมผัสด้านล่างจอ (รองรับการใช้นิ้วกด 100%)
    this.drawTouchToolbar(this.ctx, width, height, dpr);
  }

  private drawTouchToolbar(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const { btnW, centerBtnW, btnH, btnY, prevX, centerX, nextX } = this.getTouchToolbarBounds(w, h, dpr);

    const drawBtn = (x: number, y: number, bw: number, bh: number, label: string, active = false) => {
      ctx.fillStyle = active ? "#0284c7" : "rgba(24, 24, 27, 0.88)";
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

    drawBtn(prevX, btnY, btnW, btnH, "◀ สีก่อนหน้า");
    drawBtn(
      centerX,
      btnY,
      centerBtnW,
      btnH,
      this.debugInspectorActive ? "🔍 ตรวจ RGB: เปิดอยู่" : "🔍 ตรวจ RGB (D)",
      this.debugInspectorActive
    );
    drawBtn(nextX, btnY, btnW, btnH, "สีถัดไป ▶");
  }

  private drawDebugOverlay(
    ctx: CanvasRenderingContext2D,
    _w: number,
    h: number,
    dpr: number,
    data: { x: number; y: number; r: number; g: number; b: number; hex: string }
  ): void {
    const isBright = data.r * 0.299 + data.g * 0.587 + data.b * 0.114 > 140;
    const strokeColor = isBright ? "#09090b" : "#ffffff";
    const accentColor = "#38bdf8";

    // วาด Reticle เป้าเล็งแบบเว้นจุดกึ่งกลาง (Center Gap) เพื่อไม่บดบังพิกเซลเป้าหมาย
    const outerR = Math.round(18 * dpr);
    const innerGap = Math.round(5 * dpr);
    const tickLen = Math.round(8 * dpr);

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1.5, Math.round(2 * dpr));
    ctx.beginPath();
    ctx.arc(data.x, data.y, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // ขีดบอกตำแหน่ง 4 ทิศ (เว้นกึ่งกลาง)
    ctx.beginPath();
    ctx.moveTo(data.x - outerR - tickLen, data.y);
    ctx.lineTo(data.x - innerGap, data.y);
    ctx.moveTo(data.x + innerGap, data.y);
    ctx.lineTo(data.x + outerR + tickLen, data.y);
    ctx.moveTo(data.x, data.y - outerR - tickLen);
    ctx.lineTo(data.x, data.y - innerGap);
    ctx.moveTo(data.x, data.y + innerGap);
    ctx.lineTo(data.x, data.y + outerR + tickLen);
    ctx.stroke();

    // กล่องแสดงค่าสีด้านล่างซ้าย (วางเหนือแถบปุ่มสัมผัสล่างจอ ไม่ให้ทับซ้อนกัน)
    const cardW = Math.round(330 * dpr);
    const cardH = Math.round(124 * dpr);
    const cardX = Math.round(20 * dpr);
    const { btnY } = this.getTouchToolbarBounds(_w, h, dpr);
    let cardY = btnY - cardH - Math.round(12 * dpr);

    // หากเป้าเล็งอยู่บริเวณล่างซ้าย ให้สลับการ์ดไปไว้ด้านบนซ้ายเพื่อไม่ให้บังเป้าเล็ง
    if (data.y >= cardY - Math.round(20 * dpr) && data.x <= cardX + cardW + Math.round(20 * dpr)) {
      cardY = Math.round(64 * dpr);
    }

    ctx.fillStyle = "rgba(10, 10, 10, 0.94)";
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // ช่องแสดงสีตัวอย่าง (Color Swatch)
    const swatchSize = Math.round(48 * dpr);
    const swatchX = cardX + Math.round(14 * dpr);
    const swatchY = cardY + Math.round(16 * dpr);
    ctx.fillStyle = `rgb(${data.r},${data.g},${data.b})`;
    ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
    ctx.strokeStyle = isBright ? "#27272a" : "#ffffff";
    ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

    // ข้อมูลตัวเลขค่าสี
    const textX = swatchX + swatchSize + Math.round(14 * dpr);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.round(13 * dpr)}px monospace`;
    ctx.fillText(`HEX: ${data.hex}`, textX, swatchY);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px monospace`;
    ctx.fillText(`RGB: (${data.r}, ${data.g}, ${data.b})`, textX, swatchY + Math.round(18 * dpr));

    ctx.fillStyle = "#a1a1aa";
    ctx.font = `${Math.round(11 * dpr)}px monospace`;
    ctx.fillText(`พิกัดพิกเซลจริง: (${data.x}, ${data.y}) px`, textX, swatchY + Math.round(36 * dpr));

    // ข้อความชี้แจงตามข้อกำหนดขั้นตอนที่ 3 ในแผน v2
    ctx.fillStyle = "#facc15";
    ctx.font = `${Math.round(9.5 * dpr)}px sans-serif`;
    ctx.fillText("ค่าสีจาก Buffer ของ Canvas (ก่อนผ่าน Color Profile ของจอ)", cardX + Math.round(14 * dpr), cardY + cardH - Math.round(34 * dpr));

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.round(9 * dpr)}px sans-serif`;
    ctx.fillText("กด D เพื่อเปิด/ปิดโหมดตรวจสี | แตะหรือคลิกเพื่อเล็งพิกเซล", cardX + Math.round(14 * dpr), cardY + cardH - Math.round(18 * dpr));

    ctx.restore();
  }

  // -------------------------------------------------------------
  // ชุดภาพทดสอบสี 12 รูปแบบสำหรับ Part 4
  // -------------------------------------------------------------
  private initPatterns(): void {
    const makeSolidColor = (
      id: string,
      name: string,
      r: number,
      g: number,
      b: number,
      hex: string
    ): ColorPatternItem => ({
      id,
      name: `สีเต็มจอ: ${name} (${hex})`,
      guide: `ตรวจความบริสุทธิ์ของสี (${name}) ความสม่ำเสมอทั่วแผงจอ และตรวจหาเม็ดสีผิดปกติ`,
      draw: (ctx, w, h) => {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, w, h);
      },
      expectedColors: [
        { xPercent: 0.5, yPercent: 0.5, r, g, b, name },
        { xPercent: 0.1, yPercent: 0.1, r, g, b, name },
        { xPercent: 0.9, yPercent: 0.9, r, g, b, name },
      ],
    });

    this.patterns = [
      // 1. สีเต็มจอ 8 สี
      makeSolidColor("solid-red", "แดง (Red)", 255, 0, 0, "#FF0000"),
      makeSolidColor("solid-green", "เขียว (Green)", 0, 255, 0, "#00FF00"),
      makeSolidColor("solid-blue", "น้ำเงิน (Blue)", 0, 0, 255, "#0000FF"),
      makeSolidColor("solid-white", "ขาว (White)", 255, 255, 255, "#FFFFFF"),
      makeSolidColor("solid-black", "ดำ (Black)", 0, 0, 0, "#000000"),
      makeSolidColor("solid-cyan", "ฟ้าอมเขียว (Cyan)", 0, 255, 255, "#00FFFF"),
      makeSolidColor("solid-magenta", "ม่วงแดง (Magenta)", 255, 0, 255, "#FF00FF"),
      makeSolidColor("solid-yellow", "เหลือง (Yellow)", 255, 255, 0, "#FFFF00"),

      // 9. Color Bars แบบ SMPTE และ 8 แท่งมาตรฐาน
      {
        id: "color-bars-smpte",
        name: "แถบสีมาตรฐาน SMPTE & 8 Color Bars",
        guide: "แถบสีมาตรฐานสากล: ขาว, เหลือง, Cyan, เขียว, Magenta, แดง, น้ำเงิน, ดำ พร้อมแท่ง PLUGE",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);

          // 8 แท่งสีมาตรฐานตอนบน (67% ของจอ)
          const bars = [
            { r: 255, g: 255, b: 255, name: "White" },
            { r: 255, g: 255, b: 0, name: "Yellow" },
            { r: 0, g: 255, b: 255, name: "Cyan" },
            { r: 0, g: 255, b: 0, name: "Green" },
            { r: 255, g: 0, b: 255, name: "Magenta" },
            { r: 255, g: 0, b: 0, name: "Red" },
            { r: 0, g: 0, b: 255, name: "Blue" },
            { r: 0, g: 0, b: 0, name: "Black" },
          ];

          const topH = Math.floor(h * 0.67);
          const barW = w / bars.length;

          bars.forEach((b, i) => {
            ctx.fillStyle = `rgb(${b.r},${b.g},${b.b})`;
            ctx.fillRect(Math.floor(i * barW), 0, Math.ceil(barW), topH);
          });

          // แถบกลาง (8% ของจอ) - Cast Bars
          const midH = Math.floor(h * 0.08);
          const midY = topH;
          const castBars = [
            { r: 0, g: 0, b: 255 },       // Blue
            { r: 19, g: 19, b: 19 },     // Super black
            { r: 255, g: 0, b: 255 },     // Magenta
            { r: 19, g: 19, b: 19 },     // Super black
            { r: 0, g: 255, b: 255 },     // Cyan
            { r: 19, g: 19, b: 19 },     // Super black
            { r: 192, g: 192, b: 192 }, // 75% White
            { r: 0, g: 0, b: 0 },
          ];
          castBars.forEach((b, i) => {
            ctx.fillStyle = `rgb(${b.r},${b.g},${b.b})`;
            ctx.fillRect(Math.floor(i * barW), midY, Math.ceil(barW), midH);
          });

          // แถบล่าง (25% ของจอ) - I, White, Q, Black, PLUGE
          const botY = topH + midH;
          const botH = h - botY;

          // ช่อง 1: -I (Navy)
          const w1 = barW * 1.5;
          ctx.fillStyle = "rgb(0, 33, 77)";
          ctx.fillRect(0, botY, Math.ceil(w1), botH);

          // ช่อง 2: White 100%
          const w2 = barW * 1.5;
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.fillRect(Math.floor(w1), botY, Math.ceil(w2), botH);

          // ช่อง 3: +Q (Purple)
          const w3 = barW * 1.5;
          ctx.fillStyle = "rgb(50, 0, 106)";
          ctx.fillRect(Math.floor(w1 + w2), botY, Math.ceil(w3), botH);

          // ช่อง 4: Black (0)
          const w4 = barW * 1.5;
          ctx.fillStyle = "rgb(0, 0, 0)";
          ctx.fillRect(Math.floor(w1 + w2 + w3), botY, Math.ceil(w4), botH);

          // ช่อง 5: PLUGE Pulses (ตรวจ Black Level)
          const plugeStartX = Math.floor(w1 + w2 + w3 + w4);
          const plugeW = w - plugeStartX;
          ctx.fillStyle = "rgb(19, 19, 19)"; // 7.5 IRE reference black
          ctx.fillRect(plugeStartX, botY, plugeW, botH);

          const subW = plugeW / 3;
          // -2% Black (5 IRE)
          ctx.fillStyle = "rgb(10, 10, 10)";
          ctx.fillRect(Math.floor(plugeStartX), botY, Math.ceil(subW), botH);
          // 0% Black (7.5 IRE)
          ctx.fillStyle = "rgb(19, 19, 19)";
          ctx.fillRect(Math.floor(plugeStartX + subW), botY, Math.ceil(subW), botH);
          // +2% Black (10 IRE)
          ctx.fillStyle = "rgb(30, 30, 30)";
          ctx.fillRect(Math.floor(plugeStartX + subW * 2), botY, Math.ceil(subW), botH);

          // ขอบเส้นคั่น
          ctx.strokeStyle = "#404040";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, topH);
          ctx.lineTo(w, topH);
          ctx.moveTo(0, botY);
          ctx.lineTo(w, botY);
          ctx.stroke();

          // ป้ายชื่อ
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
          ctx.textAlign = "center";
          bars.forEach((b, i) => {
            ctx.fillStyle = b.r + b.g + b.b > 400 ? "#000000" : "#ffffff";
            ctx.fillText(b.name, Math.floor(i * barW + barW / 2), Math.round(25 * dpr));
          });
        },
        expectedColors: [
          { xPercent: 0.05, yPercent: 0.3, r: 255, g: 255, b: 255, name: "White bar" },
          { xPercent: 0.18, yPercent: 0.3, r: 255, g: 255, b: 0, name: "Yellow bar" },
          { xPercent: 0.31, yPercent: 0.3, r: 0, g: 255, b: 255, name: "Cyan bar" },
          { xPercent: 0.44, yPercent: 0.3, r: 0, g: 255, b: 0, name: "Green bar" },
          { xPercent: 0.56, yPercent: 0.3, r: 255, g: 0, b: 255, name: "Magenta bar" },
          { xPercent: 0.69, yPercent: 0.3, r: 255, g: 0, b: 0, name: "Red bar" },
          { xPercent: 0.81, yPercent: 0.3, r: 0, g: 0, b: 255, name: "Blue bar" },
        ],
      },

      // 10. Gradient แยกช่องสี R, G, B และสีผสม (ตรวจ Banding)
      {
        id: "color-gradients",
        name: "Gradient แยกช่องสี R, G, B และสีผสม (ตรวจ Banding)",
        guide: "แถบสีต้องไล่เฉดอย่างราบรื่น ไม่เห็นเป็นขั้นกระโดดหรือเกิดรอยต่อแถบสี",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);

          const marginX = Math.round(30 * dpr);
          const marginY = Math.round(25 * dpr);
          const availableW = w - marginX * 2;
          const bandCount = 5;
          const gap = Math.round(12 * dpr);
          const bandH = Math.floor((h - marginY * 2 - gap * (bandCount - 1)) / bandCount);

          const drawGradBand = (
            y: number,
            label: string,
            stops: Array<{ stop: number; color: string }>
          ) => {
            const grad = ctx.createLinearGradient(marginX, 0, marginX + availableW, 0);
            for (const s of stops) {
              grad.addColorStop(s.stop, s.color);
            }
            ctx.fillStyle = grad;
            ctx.fillRect(marginX, y, availableW, bandH);

            ctx.strokeStyle = "#404040";
            ctx.lineWidth = 1;
            ctx.strokeRect(marginX, y, availableW, bandH);

            // ป้ายข้อความ
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(label, marginX + Math.round(12 * dpr), y + Math.round(16 * dpr));
          };

          // 1. Red (0 -> 255)
          drawGradBand(marginY, "Red Channel (0 → 255)", [
            { stop: 0, color: "rgb(0,0,0)" },
            { stop: 1, color: "rgb(255,0,0)" },
          ]);

          // 2. Green (0 -> 255)
          drawGradBand(marginY + (bandH + gap), "Green Channel (0 → 255)", [
            { stop: 0, color: "rgb(0,0,0)" },
            { stop: 1, color: "rgb(0,255,0)" },
          ]);

          // 3. Blue (0 -> 255)
          drawGradBand(marginY + (bandH + gap) * 2, "Blue Channel (0 → 255)", [
            { stop: 0, color: "rgb(0,0,0)" },
            { stop: 1, color: "rgb(0,0,255)" },
          ]);

          // 4. CMY / Multi-Color Blend
          drawGradBand(marginY + (bandH + gap) * 3, "Cyan / Magenta / Yellow Blend", [
            { stop: 0, color: "rgb(0,255,255)" },
            { stop: 0.5, color: "rgb(255,0,255)" },
            { stop: 1, color: "rgb(255,255,0)" },
          ]);

          // 5. Full Spectrum Rainbow
          drawGradBand(marginY + (bandH + gap) * 4, "Full Spectrum (Red → Yellow → Green → Cyan → Blue → Magenta → Red)", [
            { stop: 0, color: "rgb(255,0,0)" },
            { stop: 0.17, color: "rgb(255,255,0)" },
            { stop: 0.33, color: "rgb(0,255,0)" },
            { stop: 0.5, color: "rgb(0,255,255)" },
            { stop: 0.67, color: "rgb(0,0,255)" },
            { stop: 0.83, color: "rgb(255,0,255)" },
            { stop: 1, color: "rgb(255,0,0)" },
          ]);
        },
      },

      // 11. ช่องสีเทียบธรรมชาติ (Skin Tones, Sky, Foliage & ColorChecker)
      {
        id: "color-natural-patches",
        name: "ช่องสีเทียบธรรมชาติ (สีผิว, ท้องฟ้า, หญ้า)",
        guide: "ตรวจดูด้วยสายตาว่าสีผิวคน สีท้องฟ้า และสีใบไม้เป็นธรรมชาติ ไม่ติดโทนจัดจ้านหรือซีดเกินไป",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#111111";
          ctx.fillRect(0, 0, w, h);

          // ชุดสีธรรมชาติอ้างอิงตามค่ามาตรฐาน ColorChecker
          const naturalGroups = [
            {
              category: "สีผิวคน (Skin Tones)",
              patches: [
                { name: "ผิวขาวอมชมพู (Fair)", r: 236, g: 196, b: 178 },
                { name: "ผิวเอเชีย/สองสี (Medium/Tan)", r: 196, g: 147, b: 120 },
                { name: "ผิวสีแทนเข้ม (Deep Tan)", r: 161, g: 111, b: 87 },
                { name: "ผิวเข้ม (Dark Skin)", r: 115, g: 82, b: 68 },
              ],
            },
            {
              category: "สีท้องฟ้า & น้ำ (Sky & Water)",
              patches: [
                { name: "ฟ้าครามกลางวัน (Day Sky)", r: 112, g: 151, b: 194 },
                { name: "ฟ้าสดใส (Clear Sky)", r: 86, g: 123, b: 161 },
                { name: "น้ำทะเลลึก (Deep Water)", r: 42, g: 85, b: 128 },
                { name: "ฟ้าน้ำทะเล (Cyan Marine)", r: 72, g: 160, b: 178 },
              ],
            },
            {
              category: "สีใบไม้ & ธรรมชาติ (Foliage & Nature)",
              patches: [
                { name: "ใบไม้อ่อน (Light Foliage)", r: 110, g: 162, b: 68 },
                { name: "ใบไม้เข้ม (Foliage Green)", r: 74, g: 107, b: 54 },
                { name: "ดินแห้ง (Dry Soil)", r: 142, g: 104, b: 68 },
                { name: "หินธรรมชาติ (Neutral Stone)", r: 148, g: 148, b: 148 },
              ],
            },
          ];

          const marginX = Math.round(30 * dpr);
          const marginY = Math.round(30 * dpr);
          const totalW = w - marginX * 2;
          const totalH = h - marginY * 2;

          const groupCount = naturalGroups.length;
          const groupH = Math.floor((totalH - Math.round(15 * dpr) * (groupCount - 1)) / groupCount);

          naturalGroups.forEach((grp, gIdx) => {
            const gy = marginY + gIdx * (groupH + Math.round(15 * dpr));

            // หัวข้อกลุ่ม
            ctx.fillStyle = "#38bdf8";
            ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(grp.category, marginX, gy);

            const patchY = gy + Math.round(22 * dpr);
            const patchH = groupH - Math.round(26 * dpr);
            const patchCount = grp.patches.length;
            const gap = Math.round(14 * dpr);
            const patchW = Math.floor((totalW - gap * (patchCount - 1)) / patchCount);

            grp.patches.forEach((p, pIdx) => {
              const px = marginX + pIdx * (patchW + gap);

              // ช่องสี
              ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
              ctx.fillRect(px, patchY, patchW, patchH);

              ctx.strokeStyle = "#404040";
              ctx.lineWidth = 1;
              ctx.strokeRect(px, patchY, patchW, patchH);

              // แถบชื่อและค่า RGB ด้านล่างช่องสี
              const labelH = Math.round(28 * dpr);
              ctx.fillStyle = "rgba(0,0,0,0.8)";
              ctx.fillRect(px, patchY + patchH - labelH, patchW, labelH);

              ctx.fillStyle = "#ffffff";
              ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(p.name, px + patchW / 2, patchY + patchH - Math.round(16 * dpr));

              ctx.fillStyle = "#a3a3a3";
              ctx.font = `${Math.round(9 * dpr)}px monospace`;
              ctx.fillText(`RGB (${p.r},${p.g},${p.b})`, px + patchW / 2, patchY + patchH - Math.round(6 * dpr));
            });
          });
        },
      },

      // 12. White & Gray Tint (ขาวและเทา 25%, 50%, 75% ตรวจสีเพี้ยน)
      {
        id: "white-gray-tint",
        name: "White & Gray Tint (ตรวจสีเพี้ยน White/Gray Balance)",
        guide: "แบ่ง 4 โซน: ขาว 100%, เทา 75%, เทากลาง 50%, เทา 25% ตรวจหาสีเจือปน (เช่น อมเขียวหรืออมเหลือง)",
        draw: (ctx, w, h, dpr) => {
          const halfW = Math.floor(w / 2);
          const halfH = Math.floor(h / 2);

          const zones = [
            // บนซ้าย: ขาว 100% (255, 255, 255)
            { x: 0, y: 0, w: halfW, h: halfH, val: 255, label: "ขาวบริสุทธิ์ 100% (RGB 255, 255, 255)" },
            // บนขวา: เทา 75% (191, 191, 191)
            { x: halfW, y: 0, w: w - halfW, h: halfH, val: 191, label: "เทาสว่าง 75% (RGB 191, 191, 191)" },
            // ล่างซ้าย: เทากลาง 50% (128, 128, 128)
            { x: 0, y: halfH, w: halfW, h: h - halfH, val: 128, label: "เทากลาง 50% (RGB 128, 128, 128)" },
            // ล่างขวา: เทาเข้ม 25% (64, 64, 64)
            { x: halfW, y: halfH, w: w - halfW, h: h - halfH, val: 64, label: "เทาเข้ม 25% (RGB 64, 64, 64)" },
          ];

          zones.forEach((z) => {
            ctx.fillStyle = `rgb(${z.val},${z.val},${z.val})`;
            ctx.fillRect(z.x, z.y, z.w, z.h);

            // ขอบบางเส้นกึ่งกลาง
            ctx.strokeStyle = "#525252";
            ctx.lineWidth = 1;
            ctx.strokeRect(z.x, z.y, z.w, z.h);

            // ป้ายบอกค่ากลางโซน
            const badgeW = Math.round(280 * dpr);
            const badgeH = Math.round(36 * dpr);
            const badgeX = z.x + (z.w - badgeW) / 2;
            const badgeY = z.y + (z.h - badgeH) / 2;

            ctx.fillStyle = z.val > 150 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)";
            ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

            ctx.fillStyle = z.val > 150 ? "#ffffff" : "#000000";
            ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h / 2);
          });

          // เส้นกากบาทแบ่ง 4 ช่องตรงกลาง
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = Math.max(1, Math.round(1.5 * dpr));
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW, h);
          ctx.moveTo(0, halfH);
          ctx.lineTo(w, halfH);
          ctx.stroke();
        },
        expectedColors: [
          { xPercent: 0.25, yPercent: 0.25, r: 255, g: 255, b: 255, name: "100% White quadrant" },
          { xPercent: 0.75, yPercent: 0.25, r: 191, g: 191, b: 191, name: "75% Gray quadrant" },
          { xPercent: 0.25, yPercent: 0.75, r: 128, g: 128, b: 128, name: "50% Gray quadrant" },
          { xPercent: 0.75, yPercent: 0.75, r: 64, g: 64, b: 64, name: "25% Gray quadrant" },
        ],
      },
    ];
  }
}
