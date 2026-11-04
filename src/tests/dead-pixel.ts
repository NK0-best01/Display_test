import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";

interface DefectPoint {
  x: number;
  y: number;
  colorAtTime: string;
}

interface DeadPixelColor {
  name: string;
  r: number;
  g: number;
  b: number;
  hex: string;
  hint: string;
}

export class DeadPixelTestModule implements TestModule {
  public readonly id: TestModuleId = "dead-pixel";
  public readonly title = "4. ตรวจจุดเสีย (Dead / Stuck Pixel)";
  public readonly description =
    "วนสีพื้นหลังเต็มจอพร้อมแว่นขยาย (Magnifier 4x-8x) และกดมาร์กนับตำแหน่งจุดเสีย";
  public readonly controlsHint =
    "ลูกศร ← / → หรือแตะเปลี่ยนสี | M แว่นขยาย | ดับเบิ้ลคลิก/Space มาร์กจุดเสีย | H ซ่อน HUD | Esc กลับเมนู";
  public readonly usesTouchDirectly = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentIndex = 0;
  private rafId: number | null = null;
  private onStatusChange?: (status: string) => void;

  // 5 สีหลักตามข้อกำหนด: ดำ ขาว แดง เขียว น้ำเงิน
  public readonly colors: DeadPixelColor[] = [
    {
      name: "ดำ (Black)",
      r: 0,
      g: 0,
      b: 0,
      hex: "#000000",
      hint: "ตรวจหา Stuck / Hot Pixel (จุดสว่างหรือจุดสีที่ค้างบนพื้นดำ)",
    },
    {
      name: "ขาว (White)",
      r: 255,
      g: 255,
      b: 255,
      hex: "#FFFFFF",
      hint: "ตรวจหา Dead Pixel (จุดมืดดำหรือดับสนิทบนพื้นขาว)",
    },
    {
      name: "แดง (Red)",
      r: 255,
      g: 0,
      b: 0,
      hex: "#FF0000",
      hint: "ตรวจหา Subpixel สีแดงที่เสียหรือไม่ติด",
    },
    {
      name: "เขียว (Green)",
      r: 0,
      g: 255,
      b: 0,
      hex: "#00FF00",
      hint: "ตรวจหา Subpixel สีเขียวที่เสียหรือไม่ติด",
    },
    {
      name: "น้ำเงิน (Blue)",
      r: 0,
      g: 0,
      b: 255,
      hex: "#0000FF",
      hint: "ตรวจหา Subpixel สีน้ำเงินที่เสียหรือไม่ติด",
    },
  ];

  // ระบบแว่นขยาย (Magnifier 4x - 8x)
  private magnifierEnabled = false;
  private zoomLevel = 6; // 4x, 6x, 8x
  private pointerPos: { x: number; y: number; isTouch: boolean } | null = null;

  // ระบบตัวนับและมาร์กเกอร์จุดเสีย (เก็บเฉพาะในหน่วยความจำ ไม่บันทึกลงไฟล์)
  public defectMarkers: DefectPoint[] = [];

  // การซ่อนเคอร์เซอร์อัตโนมัติ
  private hideCursorTimeout: number | null = null;
  private isCursorHidden = false;

  // Gesture ตรวจจับ Double Tap และ Swipe
  private pointerDownTime = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private lastTapTime = 0;

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentIndex = 0;
    this.magnifierEnabled = false;
    this.zoomLevel = 6;
    this.pointerPos = null;
    this.defectMarkers = [];
    this.isCursorHidden = false;
    if (this.canvas) {
      this.canvas.style.cursor = "crosshair";
    }

    this.emitStatus();
    this.draw();
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.hideCursorTimeout !== null) {
      clearTimeout(this.hideCursorTimeout);
      this.hideCursorTimeout = null;
    }
    if (this.canvas) {
      this.canvas.style.cursor = "default";
    }
    this.canvas = null;
    this.ctx = null;
    this.pointerPos = null;
  }

  public onKey(e: KeyboardEvent): void {
    this.resetCursorHideTimer();

    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      this.nextColor();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      this.prevColor();
    } else if (e.key === "m" || e.key === "M" || e.key === "ท") {
      e.preventDefault();
      this.toggleMagnifier();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      this.cycleZoom(1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      this.cycleZoom(-1);
    } else if (e.key === " " || e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      this.markDefectAtCurrentPointer();
    } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "c" || e.key === "C") {
      e.preventDefault();
      this.clearMarkers();
    }
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas) return;
    this.resetCursorHideTimer();

    const dpr = window.devicePixelRatio || 1;
    const physX = Math.round(e.clientX * dpr);
    const physY = Math.round(e.clientY * dpr);
    const isTouch = e.pointerType === "touch";

    if (e.type === "pointerdown") {
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
      this.pointerDownTime = performance.now();
      this.pointerPos = { x: physX, y: physY, isTouch };

      // ตรวจสอบ Double Tap สำหรับทัช เพื่อมาร์กจุดเสีย
      const now = performance.now();
      if (now - this.lastTapTime < 300) {
        this.addDefectMarker(physX, physY);
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
      }

      this.scheduleDraw();
    } else if (e.type === "pointermove") {
      this.pointerPos = { x: physX, y: physY, isTouch };
      if (this.magnifierEnabled) {
        this.scheduleDraw();
      }
    } else if (e.type === "pointerup") {
      const dx = e.clientX - this.pointerStartX;
      const dy = e.clientY - this.pointerStartY;
      const elapsed = performance.now() - this.pointerDownTime;

      // ตรวจสอบการปัดเพื่อเปลี่ยนสี
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) this.nextColor();
        else this.prevColor();
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && elapsed < 250) {
        // หากเป็นการคลิก/แตะสั้น ๆ บนจอ (และไม่ได้แตะแถบมาร์กเกอร์)
        // แตะครึ่งขวาเปลี่ยนสีถัดไป ครึ่งซ้ายเปลี่ยนสีย้อนกลับ
        if (!this.magnifierEnabled) {
          if (e.clientX > window.innerWidth * 0.75) {
            this.nextColor();
          } else if (e.clientX < window.innerWidth * 0.25) {
            this.prevColor();
          }
        }
      }

      if (isTouch && !this.magnifierEnabled) {
        this.pointerPos = null;
      }
      this.scheduleDraw();
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public nextColor(): void {
    this.currentIndex = (this.currentIndex + 1) % this.colors.length;
    this.emitStatus();
    this.scheduleDraw();
  }

  public prevColor(): void {
    this.currentIndex =
      (this.currentIndex - 1 + this.colors.length) % this.colors.length;
    this.emitStatus();
    this.scheduleDraw();
  }

  public toggleMagnifier(): void {
    this.magnifierEnabled = !this.magnifierEnabled;
    if (this.canvas) {
      this.canvas.style.cursor = this.magnifierEnabled ? "none" : "crosshair";
    }
    this.emitStatus();
    this.scheduleDraw();
  }

  public isMagnifierEnabled(): boolean {
    return this.magnifierEnabled;
  }

  public getZoomLevel(): number {
    return this.zoomLevel;
  }

  public setZoomLevel(zoom: number): void {
    this.zoomLevel = Math.max(4, Math.min(8, zoom));
    this.emitStatus();
    this.scheduleDraw();
  }

  public cycleZoom(delta: number): void {
    let nextZoom = this.zoomLevel + delta * 2;
    if (nextZoom > 8) nextZoom = 4;
    if (nextZoom < 4) nextZoom = 8;
    this.setZoomLevel(nextZoom);
  }

  public addDefectMarker(x: number, y: number): void {
    const cur = this.colors[this.currentIndex];
    this.defectMarkers.push({
      x: Math.round(x),
      y: Math.round(y),
      colorAtTime: cur?.name ?? "ไม่ระบุ",
    });
    this.emitStatus();
    this.scheduleDraw();
  }

  public markDefectAtCurrentPointer(): void {
    if (this.pointerPos) {
      this.addDefectMarker(this.pointerPos.x, this.pointerPos.y);
    } else if (this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      this.addDefectMarker((window.innerWidth / 2) * dpr, (window.innerHeight / 2) * dpr);
    }
  }

  public clearMarkers(): void {
    this.defectMarkers = [];
    this.emitStatus();
    this.scheduleDraw();
  }

  private resetCursorHideTimer(): void {
    if (this.canvas && this.isCursorHidden) {
      this.isCursorHidden = false;
      this.canvas.style.cursor = this.magnifierEnabled ? "none" : "crosshair";
    }
    if (this.hideCursorTimeout !== null) {
      clearTimeout(this.hideCursorTimeout);
    }
    // ซ่อนเคอร์เซอร์อัตโนมัติเมื่อไม่มีการขยับ 3 วินาที เพื่อไม่บดบังการตรวจสอบจอ
    this.hideCursorTimeout = window.setTimeout(() => {
      if (this.canvas && !this.magnifierEnabled) {
        this.isCursorHidden = true;
        this.canvas.style.cursor = "none";
      }
    }, 3000);
  }

  private emitStatus(): void {
    const cur = this.colors[this.currentIndex];
    if (!cur) return;
    const mag = this.magnifierEnabled ? ` [แว่นขยาย ${this.zoomLevel}x เปิด]` : "";
    const def =
      this.defectMarkers.length > 0
        ? ` [มาร์กแล้ว ${this.defectMarkers.length} จุด]`
        : "";
    this.onStatusChange?.(
      `สี ${this.currentIndex + 1}/${this.colors.length}: ${cur.name} — ${cur.hint}${mag}${def}`
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
    const curColor = this.colors[this.currentIndex];
    if (!curColor) return;

    // 1. เติมสีเต็มทุกพิกเซลโดยไม่มีขอบเว้น (รวมแถบขอบจอ) ตามเกณฑ์ตรวจรับ
    ctx.fillStyle = `rgb(${curColor.r},${curColor.g},${curColor.b})`;
    ctx.fillRect(0, 0, width, height);

    // 2. วาดมาร์กเกอร์จุดเสียที่บันทึกไว้ในหน่วยความจำ
    this.drawDefectMarkers(ctx, dpr, curColor);

    // 3. วาดแว่นขยาย Magnifier (ถ้าเปิดใช้งาน)
    if (this.magnifierEnabled && this.pointerPos) {
      this.drawMagnifier(ctx, width, height, dpr, curColor, this.pointerPos);
    }

    // 4. แถบสรุปจำนวนจุดเสียด้านล่าง (แสดงเมื่อมีมาร์กเกอร์)
    if (this.defectMarkers.length > 0) {
      this.drawDefectCounterBar(ctx, width, height, dpr);
    }
  }

  private drawDefectMarkers(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    curColor: DeadPixelColor
  ): void {
    const markerRadius = Math.round(18 * dpr);
    const isBright = curColor.r + curColor.g + curColor.b > 380;
    const strokeColor = isBright ? "#ef4444" : "#eab308";
    const textColor = isBright ? "#000000" : "#ffffff";

    this.defectMarkers.forEach((m, idx) => {
      // วงแหวนคู่รอบจุดเสีย
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      ctx.beginPath();
      ctx.arc(m.x, m.y, markerRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isBright ? "#ffffff" : "#000000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, markerRadius + 3, 0, Math.PI * 2);
      ctx.stroke();

      // เส้นเป้าเล็งกึ่งกลาง
      ctx.beginPath();
      ctx.moveTo(m.x - markerRadius - 4, m.y);
      ctx.lineTo(m.x + markerRadius + 4, m.y);
      ctx.moveTo(m.x, m.y - markerRadius - 4);
      ctx.lineTo(m.x, m.y + markerRadius + 4);
      ctx.stroke();

      // หมายเลขลำดับและพิกัด
      ctx.fillStyle = isBright ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
      ctx.fillRect(
        m.x + markerRadius + 4,
        m.y - Math.round(14 * dpr),
        Math.round(120 * dpr),
        Math.round(24 * dpr)
      );

      ctx.fillStyle = textColor;
      ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `#${idx + 1} (${m.x}, ${m.y})`,
        m.x + markerRadius + 8,
        m.y - Math.round(2 * dpr)
      );
    });
  }

  private drawMagnifier(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    curColor: DeadPixelColor,
    pointer: { x: number; y: number; isTouch: boolean }
  ): void {
    // กำหนดตำแหน่งเลนส์แว่นขยาย: หากใช้ทัช เลื่อนเลนส์ขึ้นด้านบน 90px เพื่อไม่ให้นิ้วบังเลนส์
    const lensRadius = Math.round(80 * dpr);
    const touchOffsetY = pointer.isTouch ? Math.round(100 * dpr) : 0;
    let lensX = pointer.x;
    let lensY = pointer.y - touchOffsetY;

    // หนีบให้อยู่ในหน้าจอ
    lensX = Math.max(lensRadius + 4, Math.min(w - lensRadius - 4, lensX));
    lensY = Math.max(lensRadius + 4, Math.min(h - lensRadius - 4, lensY));

    // จำนวนพิกเซลจริงของจอที่ถูกขยาย
    const zoom = this.zoomLevel;

    ctx.save();

    // ตัดขอบเลนส์เป็นวงกลม
    ctx.beginPath();
    ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
    ctx.clip();

    // ปิด Image Smoothing เพื่อให้ขยายแบบ Nearest-Neighbor เห็นแต่ละพิกเซลเป็นสี่เหลี่ยมคมชัด
    ctx.imageSmoothingEnabled = false;

    // เติมสีพื้นหลังในเลนส์
    ctx.fillStyle = `rgb(${curColor.r},${curColor.g},${curColor.b})`;
    ctx.fillRect(lensX - lensRadius, lensY - lensRadius, lensRadius * 2, lensRadius * 2);

    // วาดตารางพิกเซลจริง (Pixel Grid) ในแว่นขยาย เพื่อช่วยตรวจ Dead/Stuck Subpixel
    ctx.strokeStyle = curColor.r + curColor.g + curColor.b > 380 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startPixelGridX = lensX - lensRadius;
    const endPixelGridX = lensX + lensRadius;
    for (let x = startPixelGridX; x <= endPixelGridX; x += zoom) {
      ctx.moveTo(x + 0.5, lensY - lensRadius);
      ctx.lineTo(x + 0.5, lensY + lensRadius);
    }
    const startPixelGridY = lensY - lensRadius;
    const endPixelGridY = lensY + lensRadius;
    for (let y = startPixelGridY; y <= endPixelGridY; y += zoom) {
      ctx.moveTo(lensX - lensRadius, y + 0.5);
      ctx.lineTo(lensX + lensRadius, y + 0.5);
    }
    ctx.stroke();

    // วาดจุดมาร์กเกอร์จำลองในเลนส์ หากเป้าชี้อยู่ใกล้จุดเสีย
    this.defectMarkers.forEach((m) => {
      const dx = (m.x - pointer.x) * zoom;
      const dy = (m.y - pointer.y) * zoom;
      const targetLensX = lensX + dx;
      const targetLensY = lensY + dy;

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      ctx.beginPath();
      ctx.arc(targetLensX, targetLensY, Math.round(12 * dpr), 0, Math.PI * 2);
      ctx.stroke();
    });

    // วาดเป้าเล็งกึ่งกลางเลนส์
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(1, Math.round(1.5 * dpr));
    ctx.beginPath();
    ctx.arc(lensX, lensY, Math.round(8 * dpr), 0, Math.PI * 2);
    ctx.moveTo(lensX - 16, lensY);
    ctx.lineTo(lensX + 16, lensY);
    ctx.moveTo(lensX, lensY - 16);
    ctx.lineTo(lensX, lensY + 16);
    ctx.stroke();

    ctx.restore();

    // ขอบกระบอกแว่นขยาย
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(3, Math.round(3 * dpr));
    ctx.beginPath();
    ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
    ctx.stroke();

    // ป้ายกำกับอัตราขยายและพิกัดใต้แว่นขยาย
    const badgeW = Math.round(160 * dpr);
    const badgeH = Math.round(26 * dpr);
    const badgeX = lensX - badgeW / 2;
    const badgeY = lensY + lensRadius + Math.round(6 * dpr);

    ctx.fillStyle = "rgba(10, 10, 10, 0.9)";
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = "#525252";
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(10 * dpr)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `แว่นขยาย ${zoom}x (${pointer.x}, ${pointer.y})`,
      lensX,
      badgeY + badgeH / 2
    );

    // เส้นประโยงระหว่างตำแหน่งนิ้วจริงกับตำแหน่งเลนส์ (กรณีทัชที่มี offset)
    if (touchOffsetY > 0) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pointer.x, pointer.y);
      ctx.lineTo(lensX, lensY + lensRadius);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawDefectCounterBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const barH = Math.round(36 * dpr);
    const barY = h - barH - Math.round(12 * dpr);
    const barW = Math.min(w - Math.round(40 * dpr), Math.round(520 * dpr));
    const barX = (w - barW) / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = "#eab308";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `พบจุดเสียมาร์กไว้: ${this.defectMarkers.length} จุด`,
      barX + Math.round(16 * dpr),
      barY + barH / 2
    );

    ctx.fillStyle = "#a3a3a3";
    ctx.font = `${Math.round(10 * dpr)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(
      "กด C หรือ Del เพื่อล้างมาร์กเกอร์",
      barX + barW - Math.round(16 * dpr),
      barY + barH / 2
    );
  }
}
