import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";
import { normalizeKey } from "../core/keys";

export type TouchSubMode = "points" | "draw" | "grid";

interface ActivePointerState {
  id: number;
  x: number;
  y: number;
  pressure: number;
  width: number;
  height: number;
  pointerType: string;
  color: string;
  history: Array<{ x: number; y: number }>;
}

export class MultiTouchTestModule implements TestModule {
  public readonly id: TestModuleId = "multi-touch";
  public readonly title = "2. ทดสอบระบบสัมผัส (Multi-touch & วาดเส้น)";
  public readonly description =
    "ตรวจจับหลายนิ้วพร้อมกัน วาดเส้นต่อเนื่อง (Coalesced) และโหมดตาราง Grid เช็คโซนทัชทั่วจอ";
  public readonly controlsHint =
    "โหมด: [1] ตรวจจับจุดสัมผัส [2] วาดเส้น [3] ตาราง Grid | C/R ล้างผล | แตะปุ่มบนจอได้ทันที หรือ Esc กลับเมนู";
  public readonly usesTouchDirectly = true; // ปิดการปัดสลับหน้าของระบบกลาง

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private subMode: TouchSubMode = "points";
  private rafId: number | null = null;
  private onStatusChange?: (status: string) => void;

  // แผนที่นิ้วที่กำลังสัมผัสอยู่
  public activePointers: Map<number, ActivePointerState> = new Map();
  public peakTouches = 0;
  public totalEventsReceived = 0;

  // สำหรับโหมด Draw: เก็บประวัติเส้นวาดทั้งหมด
  private completedPaths: Array<{ color: string; points: Array<{ x: number; y: number }> }> = [];

  // สำหรับโหมด Grid (16x12 = 192 ช่อง)
  public readonly gridCols = 16;
  public readonly gridRows = 12;
  public gridCellsTouched: boolean[] = [];

  // พาเลตต์สีสดใส 12 สี แยกตามนิ้วสัมผัส
  private readonly fingerColors = [
    "#38bdf8", // Sky blue
    "#34d399", // Emerald green
    "#f472b6", // Pink
    "#fbbf24", // Amber
    "#a78bfa", // Purple
    "#fb923c", // Orange
    "#22d3ee", // Cyan
    "#a3e635", // Lime
    "#e879f9", // Fuchsia
    "#f87171", // Red
    "#818cf8", // Indigo
    "#2dd4bf", // Teal
  ];

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
    this.resetGrid();
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.activePointers.clear();
    this.peakTouches = 0;
    this.totalEventsReceived = 0;
    this.completedPaths = [];
    this.resetGrid();

    // บังคับ touch-action: none บน Canvas
    canvas.style.touchAction = "none";

    this.emitStatus();
    this.draw();
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.activePointers.clear();
    this.canvas = null;
    this.ctx = null;
  }

  public clearActivePointers(): void {
    if (this.activePointers.size > 0) {
      this.activePointers.clear();
      this.emitStatus();
      this.scheduleDraw();
    }
  }

  public onKey(e: KeyboardEvent): void {
    const k = normalizeKey(e);
    if (!k) return;

    if (k === "1") {
      e.preventDefault();
      this.setSubMode("points");
    } else if (k === "2") {
      e.preventDefault();
      this.setSubMode("draw");
    } else if (k === "3") {
      e.preventDefault();
      this.setSubMode("grid");
    } else if (k === "c" || k === "r" || k === "Delete") {
      e.preventDefault();
      this.resetCurrentMode();
    } else if (k === "Tab" || k === "Space") {
      e.preventDefault();
      this.cycleSubMode();
    }
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas) return;
    e.preventDefault();
    this.totalEventsReceived++;

    const dpr = window.devicePixelRatio || 1;
    const physX = Math.round(e.clientX * dpr);
    const physY = Math.round(e.clientY * dpr);

    // ตรวจสอบการกดปุ่มแท็บหรือปุ่มควบคุมบนหน้าจอ (Touch-friendly UI)
    if (e.type === "pointerdown") {
      if (this.handleOnScreenButtons(physX, physY, this.canvas.width, this.canvas.height, dpr)) {
        return;
      }

      const colorIndex = Math.abs(e.pointerId) % this.fingerColors.length;
      const color = this.fingerColors[colorIndex] || "#38bdf8";

      const ptr: ActivePointerState = {
        id: e.pointerId,
        x: physX,
        y: physY,
        pressure: e.pressure || 0.5,
        width: Math.round(e.width * dpr),
        height: Math.round(e.height * dpr),
        pointerType: e.pointerType,
        color,
        history: [{ x: physX, y: physY }],
      };

      this.activePointers.set(e.pointerId, ptr);
      if (this.activePointers.size > this.peakTouches) {
        this.peakTouches = this.activePointers.size;
      }

      if (this.subMode === "grid") {
        this.markGridAt(physX, physY);
      }

      this.emitStatus();
      this.scheduleDraw();
    } else if (e.type === "pointermove") {
      // ดักจับกรณีเมาส์ปล่อยปุ่มไปแล้วแต่ยังค้าง
      if (e.pointerType === "mouse" && e.buttons === 0 && this.activePointers.has(e.pointerId)) {
        this.activePointers.delete(e.pointerId);
        this.emitStatus();
        this.scheduleDraw();
        return;
      }

      const ptr = this.activePointers.get(e.pointerId);
      if (ptr) {
        const prevX = ptr.x;
        const prevY = ptr.y;

        ptr.x = physX;
        ptr.y = physY;
        ptr.pressure = e.pressure || 0.5;
        ptr.width = Math.round(e.width * dpr);
        ptr.height = Math.round(e.height * dpr);

        // ดึง Coalesced Events ถ้ามี เพื่อความต่อเนื่องของเส้นวาด
        if (typeof e.getCoalescedEvents === "function") {
          const coalesced = e.getCoalescedEvents();
          for (const ce of coalesced) {
            ptr.history.push({
              x: Math.round(ce.clientX * dpr),
              y: Math.round(ce.clientY * dpr),
            });
          }
        } else {
          ptr.history.push({ x: physX, y: physY });
        }

        // จำกัดประวัติเส้นไว้ 300 จุดต่อ 1 stroke เพื่อประหยัดหน่วยความจำ
        if (ptr.history.length > 300) {
          ptr.history.splice(0, ptr.history.length - 300);
        }

        if (this.subMode === "grid") {
          this.markGridLine(prevX, prevY, physX, physY);
        }

        this.scheduleDraw();
      }
    } else if (
      e.type === "pointerup" ||
      e.type === "pointercancel" ||
      e.type === "lostpointercapture" ||
      (e.type === "pointerleave" && e.pointerType === "touch")
    ) {
      const ptr = this.activePointers.get(e.pointerId);
      if (ptr && this.subMode === "draw" && ptr.history.length > 1) {
        this.completedPaths.push({
          color: ptr.color,
          points: [...ptr.history],
        });
        if (this.completedPaths.length > 80) {
          this.completedPaths.shift();
        }
      }

      this.activePointers.delete(e.pointerId);
      this.emitStatus();
      this.scheduleDraw();
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public setSubMode(mode: TouchSubMode): void {
    if (this.subMode === mode) return;
    // ล้างจุดสัมผัสทั้งหมดออกทันทีเมื่อเปลี่ยนโหมด ป้องกันจุดสัมผัสเดิมรั่วไหลข้ามโหมด
    this.activePointers.clear();
    this.subMode = mode;
    this.emitStatus();
    this.scheduleDraw();
  }

  public getSubMode(): TouchSubMode {
    return this.subMode;
  }

  public cycleSubMode(): void {
    if (this.subMode === "points") this.setSubMode("draw");
    else if (this.subMode === "draw") this.setSubMode("grid");
    else this.setSubMode("points");
  }

  public resetCurrentMode(): void {
    if (this.subMode === "draw") {
      this.completedPaths = [];
      this.activePointers.clear();
    } else if (this.subMode === "grid") {
      this.resetGrid();
      this.activePointers.clear();
    } else {
      this.peakTouches = this.activePointers.size;
    }
    this.emitStatus();
    this.scheduleDraw();
  }

  public resetGrid(): void {
    const total = this.gridCols * this.gridRows;
    this.gridCellsTouched = new Array(total).fill(false);
  }

  public getGridTouchedCount(): number {
    return this.gridCellsTouched.filter(Boolean).length;
  }

  public getTotalGridCells(): number {
    return this.gridCols * this.gridRows;
  }

  private markGridAt(physX: number, physY: number): void {
    if (!this.canvas) return;
    const colW = this.canvas.width / this.gridCols;
    const rowH = this.canvas.height / this.gridRows;
    const col = Math.floor(physX / colW);
    const row = Math.floor(physY / rowH);

    if (col >= 0 && col < this.gridCols && row >= 0 && row < this.gridRows) {
      const idx = row * this.gridCols + col;
      if (!this.gridCellsTouched[idx]) {
        this.gridCellsTouched[idx] = true;
        this.emitStatus();
      }
    }
  }

  private markGridLine(x0: number, y0: number, x1: number, y1: number): void {
    if (!this.canvas) return;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stepSize = Math.max(8, Math.min(this.canvas.width / this.gridCols, this.canvas.height / this.gridRows) / 4);
    const steps = Math.max(1, Math.ceil(dist / stepSize));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      this.markGridAt(x, y);
    }
  }

  private getSubModeTabsLayout(w: number, dpr: number) {
    const tabs = [
      { id: "points" as const, label: "[1] จุดสัมผัส (Multi-touch)" },
      { id: "draw" as const, label: "[2] โหมดวาดเส้น (Draw)" },
      { id: "grid" as const, label: "[3] ตารางเช็คทั่วจอ (Grid 16×12)" },
    ];

    const tabH = Math.round(44 * dpr);
    const totalW = Math.min(w - Math.round(30 * dpr), Math.round(660 * dpr));
    const startX = (w - totalW) / 2;
    const startY = Math.round(12 * dpr);
    const tabW = totalW / tabs.length;
    return { tabs, tabH, totalW, startX, startY, tabW };
  }

  private handleOnScreenButtons(
    physX: number,
    physY: number,
    w: number,
    h: number,
    dpr: number
  ): boolean {
    // 1. ตรวจสอบแถบแท็บด้านบน
    const { tabs, tabH, totalW, startX, startY, tabW } = this.getSubModeTabsLayout(w, dpr);
    const hitPadding = Math.round(8 * dpr);

    if (
      physY >= startY - hitPadding &&
      physY <= startY + tabH + hitPadding &&
      physX >= startX - hitPadding &&
      physX <= startX + totalW + hitPadding
    ) {
      const clampedX = Math.max(startX, Math.min(startX + totalW - 1, physX));
      const idx = Math.floor((clampedX - startX) / tabW);
      const target = tabs[idx];
      if (target) {
        this.setSubMode(target.id);
        return true;
      }
    }

    // 2. ตรวจสอบปุ่มล้างผล/รีเซ็ตมุมขวาล่าง
    const btnW = Math.round(160 * dpr);
    const btnH = Math.round(48 * dpr);
    const btnX = w - btnW - Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(20 * dpr);

    if (
      physX >= btnX - hitPadding &&
      physX <= btnX + btnW + hitPadding &&
      physY >= btnY - hitPadding &&
      physY <= btnY + btnH + hitPadding
    ) {
      if (this.subMode === "points") {
        this.resetCurrentMode();
        return true;
      } else if (this.subMode === "draw") {
        this.resetCurrentMode();
        return true;
      } else if (this.subMode === "grid") {
        this.resetGrid();
        this.emitStatus();
        this.scheduleDraw();
        return true;
      }
    }

    return false;
  }

  private emitStatus(): void {
    const active = this.activePointers.size;
    const hwMax = navigator.maxTouchPoints ?? 0;
    let modeText = "";

    if (this.subMode === "points") {
      modeText = `สัมผัสขณะนี้: ${active} จุด | สูงสุดที่ตรวจพบ: ${this.peakTouches} จุด (ฮาร์ดแวร์: ${hwMax} จุด)`;
    } else if (this.subMode === "draw") {
      modeText = `โหมดวาดเส้นต่อเนื่อง (Active: ${active} นิ้ว | เส้นสะสม: ${this.completedPaths.length})`;
    } else if (this.subMode === "grid") {
      const touched = this.getGridTouchedCount();
      const total = this.getTotalGridCells();
      const pct = ((touched / total) * 100).toFixed(1);
      modeText = `ตาราง Grid ครอบคลุม: ${touched}/${total} ช่อง (${pct}%)`;
    }

    this.onStatusChange?.(`${modeText}`);
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

    // พื้นหลังสีมืดสนิท
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    if (this.subMode === "grid") {
      this.drawGridMode(ctx, width, height, dpr);
    } else if (this.subMode === "draw") {
      this.drawDrawMode(ctx, width, height, dpr);
    } else {
      this.drawPointsMode(ctx, width, height, dpr);
    }

    // แถบสลับโหมดยอดนิยมด้านบนจอ (แตะเปลี่ยนโหมดด้วยนิ้วได้ทันที)
    this.drawSubModeNavBar(ctx, width, dpr);
  }

  private drawPointsMode(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const hwMax = navigator.maxTouchPoints ?? 0;
    const activeCount = this.activePointers.size;

    // วาดตารางพื้นหลังจาง ๆ
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    const gridStep = Math.round(60 * dpr);
    ctx.beginPath();
    for (let x = 0; x < w; x += gridStep) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // วาดเส้นเชื่อมโยงระหว่างจุดสัมผัสทั้งหมด (Multi-touch Constellation)
    const points = Array.from(this.activePointers.values());
    if (points.length >= 2) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = Math.max(1, Math.round(1.5 * dpr));
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const p1 = points[i]!;
          const p2 = points[j]!;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
      }
      ctx.stroke();
    }

    // วาดข้อมูลและวงกลมขยายของแต่ละนิ้ว
    points.forEach((ptr, idx) => {
      const radius = Math.max(
        Math.round(28 * dpr),
        Math.round((ptr.width || 40) / 2)
      );

      // วงกลมหลักโปร่งแสง
      ctx.fillStyle = ptr.color + "33";
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // ขอบวงแหวน
      ctx.strokeStyle = ptr.color;
      ctx.lineWidth = Math.max(2, Math.round(3 * dpr));
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // จุดศูนย์กลาง
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, Math.round(4 * dpr), 0, Math.PI * 2);
      ctx.fill();

      // การ์ดข้อมูลสดข้างนิ้ว (พิกัด, Pressure, ขนาด, ID)
      const badgeW = Math.round(180 * dpr);
      const badgeH = Math.round(72 * dpr);
      let badgeX = ptr.x + radius + Math.round(12 * dpr);
      let badgeY = ptr.y - badgeH / 2;

      // จัดให้อยู่ในจอ
      if (badgeX + badgeW > w - 10) badgeX = ptr.x - radius - badgeW - Math.round(12 * dpr);
      if (badgeY < 70) badgeY = 70;
      if (badgeY + badgeH > h - 10) badgeY = h - badgeH - 10;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = ptr.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // หัวข้อจุด
      ctx.fillStyle = ptr.color;
      ctx.font = `bold ${Math.round(12 * dpr)}px monospace`;
      ctx.fillText(
        `จุดที่ #${idx + 1} (ID: ${ptr.id})`,
        badgeX + Math.round(10 * dpr),
        badgeY + Math.round(8 * dpr)
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.round(11 * dpr)}px monospace`;
      ctx.fillText(
        `X: ${ptr.x}  Y: ${ptr.y} px`,
        badgeX + Math.round(10 * dpr),
        badgeY + Math.round(28 * dpr)
      );

      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.round(10 * dpr)}px monospace`;
      const pressureText = `Pressure: ${ptr.pressure.toFixed(2)}`;
      const sizeText = ptr.width > 0 ? ` Size: ${ptr.width}px` : "";
      ctx.fillText(
        `${pressureText}${sizeText}`,
        badgeX + Math.round(10 * dpr),
        badgeY + Math.round(48 * dpr)
      );
    });

    // สรุปสถิติใหญ่กลางจอเมื่อยังไม่มีการสัมผัส
    if (activeCount === 0) {
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#38bdf8";
      ctx.font = `bold ${Math.round(22 * dpr)}px sans-serif`;
      ctx.fillText("แตะนิ้วพร้อมกันบนหน้าจอ (Multi-Touch Test)", cx, cy - Math.round(30 * dpr));

      ctx.fillStyle = "#a1a1aa";
      ctx.font = `${Math.round(14 * dpr)}px sans-serif`;
      ctx.fillText(
        `ฮาร์ดแวร์รองรับสัมผัสสูงสุด: ${hwMax} จุดพร้อมกัน | ตรวจพบสูงสุดในรอบนี้: ${this.peakTouches} จุด`,
        cx,
        cy + Math.round(10 * dpr)
      );

      ctx.fillStyle = "#71717a";
      ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
      ctx.fillText(
        "สามารถแตะได้พร้อมกันหลายนิ้วตามขีดจำกัดของหน้าจอทัชสกรีน",
        cx,
        cy + Math.round(40 * dpr)
      );
    }

    // ปุ่มรีเซ็ตสถิติมุมขวาล่าง
    const btnW = Math.round(160 * dpr);
    const btnH = Math.round(48 * dpr);
    const btnX = w - btnW - Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(20 * dpr);

    ctx.fillStyle = "rgba(39, 39, 42, 0.9)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔄 รีเซ็ตสถิติ (R)", btnX + btnW / 2, btnY + btnH / 2);
  }

  private drawDrawMode(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    // วาดเส้นที่วาดเสร็จแล้วทั้งหมด (Completed Paths)
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.completedPaths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = Math.max(3, Math.round(4 * dpr));
      ctx.beginPath();
      ctx.moveTo(path.points[0]!.x, path.points[0]!.y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i]!.x, path.points[i]!.y);
      }
      ctx.stroke();
    });

    // วาดเส้นที่กำลังวาดอยู่สด ๆ (Active Strokes)
    this.activePointers.forEach((ptr) => {
      if (ptr.history.length >= 2) {
        ctx.strokeStyle = ptr.color;
        ctx.lineWidth = Math.max(3, Math.round(4 * dpr));
        ctx.beginPath();
        ctx.moveTo(ptr.history[0]!.x, ptr.history[0]!.y);
        for (let i = 1; i < ptr.history.length; i++) {
          ctx.lineTo(ptr.history[i]!.x, ptr.history[i]!.y);
        }
        ctx.stroke();
      }

      // วาดหัวปากกา/ปลายนิ้ว
      ctx.fillStyle = ptr.color;
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, Math.round(8 * dpr), 0, Math.PI * 2);
      ctx.fill();
    });

    // ปุ่มล้างเส้นวาดมุมขวาล่าง
    const btnW = Math.round(160 * dpr);
    const btnH = Math.round(48 * dpr);
    const btnX = w - btnW - Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(20 * dpr);

    ctx.fillStyle = "rgba(39, 39, 42, 0.9)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🗑️ ล้างเส้นวาด (C)", btnX + btnW / 2, btnY + btnH / 2);
  }

  private drawGridMode(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const colW = w / this.gridCols;
    const rowH = h / this.gridRows;

    const touchedCount = this.getGridTouchedCount();
    const totalCount = this.getTotalGridCells();

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const idx = r * this.gridCols + c;
        const isTouched = this.gridCellsTouched[idx];
        const x = c * colW;
        const y = r * rowH;

        // ช่องที่สัมผัสแล้ว: สีเขียวมรกตสว่าง
        // ช่องที่ยังไม่ถูกแตะ: สีเทาเข้ม
        ctx.fillStyle = isTouched ? "rgba(16, 185, 129, 0.85)" : "#18181b";
        ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);

        ctx.strokeStyle = isTouched ? "#059669" : "#27272a";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, rowH - 1);
      }
    }

    // วาดนิ้วที่กำลังแตะอยู่บน Grid ปัจจุบัน
    this.activePointers.forEach((ptr) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, Math.round(16 * dpr), 0, Math.PI * 2);
      ctx.fill();
    });

    // แถบสรุปความครอบคลุมด้านล่าง
    const barW = Math.min(w - Math.round(200 * dpr), Math.round(480 * dpr));
    const barH = Math.round(48 * dpr);
    const barX = Math.round(20 * dpr);
    const barY = h - barH - Math.round(20 * dpr);

    ctx.fillStyle = "rgba(9, 9, 11, 0.92)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = touchedCount === totalCount ? "#10b981" : "#eab308";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = touchedCount === totalCount ? "#10b981" : "#ffffff";
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
    const pct = ((touchedCount / totalCount) * 100).toFixed(1);
    ctx.fillText(
      `ครอบคลุม: ${touchedCount}/${totalCount} ช่อง (${pct}%)`,
      barX + Math.round(16 * dpr),
      barY + barH / 2
    );

    // ปุ่มล้างตารางมุมขวาล่าง
    const btnW = Math.round(160 * dpr);
    const btnH = Math.round(48 * dpr);
    const btnX = w - btnW - Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(20 * dpr);

    ctx.fillStyle = "rgba(39, 39, 42, 0.92)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔄 ล้างตาราง (R)", btnX + btnW / 2, btnY + btnH / 2);
  }

  private drawSubModeNavBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    dpr: number
  ): void {
    const { tabs, tabH, startX, startY, tabW } = this.getSubModeTabsLayout(w, dpr);

    tabs.forEach((t, i) => {
      const tx = startX + i * tabW;
      const isSelected = this.subMode === t.id;

      ctx.fillStyle = isSelected ? "#0284c7" : "rgba(24, 24, 27, 0.92)";
      ctx.fillRect(tx, startY, tabW, tabH);

      ctx.strokeStyle = isSelected ? "#38bdf8" : "#3f3f46";
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, startY, tabW, tabH);

      ctx.fillStyle = isSelected ? "#ffffff" : "#d4d4d8";
      ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.label, tx + tabW / 2, startY + tabH / 2);
    });
  }
}
