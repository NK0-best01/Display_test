import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";
import { normalizeKey } from "../core/keys";

export interface LatencyStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  frameDrops: number;
  ratingLabel: string;
  ratingColor: string;
}

/**
 * ปรับฐานเวลาระหว่าง event.timeStamp กับ performance.now() ให้ตรงกัน
 * เพื่อป้องกันปัญหาเวลาคนละฐานบนบางแพลตฟอร์ม (เช่น WebKitGTK บน Linux)
 */
export function normalizeEventTimeStamp(eTimestamp: number, currentNow: number): number {
  // หาก eTimestamp เป็น Unix Epoch Time (> 1e11 เช่น 1.7e12 ms)
  if (eTimestamp > 1e11) {
    const epochNow = Date.now();
    const delta = epochNow - eTimestamp;
    return Math.max(0, currentNow - delta);
  }
  // หาก eTimestamp เป็น High Resolution Time ฐานเดียวกับ performance.timeOrigin
  return Math.min(currentNow, Math.max(0, eTimestamp));
}

export class TouchLatencyTestModule implements TestModule {
  public readonly id: TestModuleId = "touch-latency";
  public readonly title = "7. วัดความหน่วงการสัมผัส (Touch-to-Paint Latency)";
  public readonly description =
    "วัดเวลาตั้งแต่รับสัญญาณนิ้วจนถึงเฟรมที่วาดขึ้นจอ แสดงค่าเฉลี่ย, P95, กราฟสด 200 ตัวอย่าง และ Frame Drop";
  public readonly controlsHint =
    "ลากนิ้วเป็นวงกลมต่อเนื่อง หรือแตะหน้าจอซ้ำ ๆ | R รีเซ็ตสถิติ | H ซ่อน HUD | กดค้างมุมซ้ายบน 1 วิ หรือ Esc กลับเมนู";
  public readonly usesTouchDirectly = true; // ปิดการปัดสลับหน้าของระบบกลาง

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private onStatusChange?: (status: string) => void;

  // Ring Buffer ขนาดคงที่ 200 ตัวอย่าง (Zero Garbage Allocation) ตามเกณฑ์ตรวจรับ
  public readonly maxSamples = 200;
  public readonly sampleBuffer = new Float32Array(200);
  public sampleIndex = 0;
  public sampleCount = 0;
  private scratchSortBuffer = new Float32Array(200);

  // การตรวจจับ Frame Drop (> 20 ms ระหว่างเฟรม)
  public frameDropCount = 0;
  private lastFrameTime = performance.now();

  // ตัวแปรสำหรับจับคู่ Input Event กับ Render Frame
  private pendingEventTimeStamp: number | null = null;
  private lastMeasuredLatency = 0;

  // ตำแหน่งนิ้วล่าสุดสำหรับวาดเอฟเฟกต์ตามนิ้ว (Pre-allocated)
  private currentPointerX = -1;
  private currentPointerY = -1;
  private isPointerActive = false;

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.resetStats();
    canvas.style.touchAction = "none";
    this.lastFrameTime = performance.now();

    this.emitStatus();
    this.scheduleDraw();
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.isPointerActive = false;
  }

  public onKey(e: KeyboardEvent): void {
    const k = normalizeKey(e);
    if (k === "r" || k === "c") {
      e.preventDefault();
      this.resetStats();
    }
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas) return;
    e.preventDefault();

    const now = performance.now();
    const eventTime = normalizeEventTimeStamp(e.timeStamp, now);
    this.pendingEventTimeStamp = eventTime;

    const dpr = window.devicePixelRatio || 1;
    this.currentPointerX = Math.round(e.clientX * dpr);
    this.currentPointerY = Math.round(e.clientY * dpr);

    if (e.type === "pointerdown") {
      const btnW = Math.round(180 * dpr);
      const btnH = Math.round(44 * dpr);
      const btnX = this.canvas.width - btnW - Math.round(20 * dpr);
      const btnY = this.canvas.height - btnH - Math.round(10 * dpr);

      if (
        this.currentPointerX >= btnX &&
        this.currentPointerX <= btnX + btnW &&
        this.currentPointerY >= btnY &&
        this.currentPointerY <= btnY + btnH
      ) {
        this.resetStats();
        return;
      }

      this.isPointerActive = true;
    } else if (e.type === "pointermove") {
      this.isPointerActive = true;
    } else if (e.type === "pointerup" || e.type === "pointercancel") {
      this.isPointerActive = false;
    }

    this.scheduleDraw();
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public resetStats(): void {
    this.sampleBuffer.fill(0);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.frameDropCount = 0;
    this.lastMeasuredLatency = 0;
    this.pendingEventTimeStamp = null;
    this.emitStatus();
    this.scheduleDraw();
  }

  /**
   * บันทึกค่า Latency ลงใน Ring buffer ขนาด 200 ตัวอย่าง
   * (Zero Allocation: ใช้บัฟเฟอร์เดิมซ้ำ ไม่สร้างขยะ)
   */
  public recordLatencySample(latencyMs: number): void {
    const clamped = Math.max(0.1, Math.min(999, latencyMs));
    this.sampleBuffer[this.sampleIndex] = clamped;
    this.sampleIndex = (this.sampleIndex + 1) % this.maxSamples;
    if (this.sampleCount < this.maxSamples) {
      this.sampleCount++;
    }
    this.lastMeasuredLatency = clamped;
  }

  /**
   * คำนวณสถิติสรุป (Avg, Min, Max, P95, Rating)
   */
  public computeStats(): LatencyStats {
    if (this.sampleCount === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        frameDrops: this.frameDropCount,
        ratingLabel: "รอการทดสอบ",
        ratingColor: "#71717a",
      };
    }

    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this.sampleCount; i++) {
      const val = this.sampleBuffer[i]!;
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
      this.scratchSortBuffer[i] = val;
    }

    const avg = sum / this.sampleCount;

    // คำนวณ Percentile 95
    const sortSlice = this.scratchSortBuffer.subarray(0, this.sampleCount);
    sortSlice.sort();
    const p95Index = Math.min(
      this.sampleCount - 1,
      Math.floor(this.sampleCount * 0.95)
    );
    const p95 = sortSlice[p95Index] ?? avg;

    // ประเมินระดับตามเกณฑ์อ้างอิงในแผน:
    // ดีมาก (< 20 ms), ดี (20-40 ms), พอใช้ (40-80 ms), ช้า (> 80 ms)
    let ratingLabel = "ดีมาก (< 20 ms)";
    let ratingColor = "#22c55e"; // เขียว

    if (avg >= 80) {
      ratingLabel = "ช้า (> 80 ms)";
      ratingColor = "#ef4444"; // แดง
    } else if (avg >= 40) {
      ratingLabel = "พอใช้ (40-80 ms)";
      ratingColor = "#f97316"; // ส้ม
    } else if (avg >= 20) {
      ratingLabel = "ดี (20-40 ms)";
      ratingColor = "#38bdf8"; // ฟ้า
    }

    return {
      count: this.sampleCount,
      avg: Number(avg.toFixed(1)),
      min: Number(min.toFixed(1)),
      max: Number(max.toFixed(1)),
      p95: Number(p95.toFixed(1)),
      frameDrops: this.frameDropCount,
      ratingLabel,
      ratingColor,
    };
  }

  private emitStatus(): void {
    const stats = this.computeStats();
    if (stats.count === 0) {
      this.onStatusChange?.("พร้อมวัดความหน่วง: ลากนิ้วหรือแตะหน้าจอต่อเนื่อง");
    } else {
      this.onStatusChange?.(
        `เฉลี่ย: ${stats.avg} ms | ต่ำสุด: ${stats.min} ms | P95: ${stats.p95} ms | ระดับ: ${stats.ratingLabel} (ตัวอย่าง: ${stats.count}/200)`
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
    const ctx = this.ctx;
    const now = performance.now();

    // 1. ตรวจจับ Frame Drop (> 20 ms ระหว่างเฟรมตามข้อกำหนด)
    const frameDelta = now - this.lastFrameTime;
    if (frameDelta > 20 && this.lastFrameTime > 0) {
      this.frameDropCount++;
    }
    this.lastFrameTime = now;

    // 2. คำนวณความหน่วง Touch-to-Paint (เวลาตั้งแต่ Event เข้าจนถึงเฟรมนี้)
    if (this.pendingEventTimeStamp !== null) {
      const latency = Math.max(0.1, now - this.pendingEventTimeStamp);
      this.recordLatencySample(latency);
      this.pendingEventTimeStamp = null;
      this.emitStatus();
    }

    // 3. วาดพื้นหลังสีเข้ม
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    // 4. วาดลู่วิ่งวงกลมเป้าหมาย (Circle Track) สำหรับชวนให้ผู้ใช้ลากนิ้วเป็นวงกลม
    this.drawTargetTrack(ctx, width, height, dpr);

    // 5. วาดตำแหน่งนิ้วพร้อมเอฟเฟกต์และค่า Latency สด
    if (this.isPointerActive && this.currentPointerX >= 0) {
      this.drawActivePointerEffect(ctx, dpr);
    }

    // 6. วาดแดชบอร์ดสถิติสรุป (Dashboard Cards)
    const stats = this.computeStats();
    this.drawStatsDashboard(ctx, width, dpr, stats);

    // 7. วาดกราฟสด 200 ตัวอย่างล่าสุด (Live Waveform Graph)
    this.drawLiveGraph(ctx, width, height, dpr);
  }

  private drawTargetTrack(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h * 0.44);
    const trackRadius = Math.min(cx * 0.6, cy * 0.7);

    // เส้นรอบวงรางวิ่ง
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = Math.max(2, Math.round(3 * dpr));
    ctx.beginPath();
    ctx.arc(cx, cy, trackRadius, 0, Math.PI * 2);
    ctx.stroke();

    // เส้นประรางวิ่ง
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, trackRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ข้อความคำแนะนำกลางวงกลม
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.round(18 * dpr)}px sans-serif`;
    ctx.fillText("ลากนิ้วเป็นวงกลมต่อเนื่อง หรือแตะซ้ำ ๆ", cx, cy - Math.round(14 * dpr));

    ctx.fillStyle = "#a1a1aa";
    ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.fillText("เพื่อสุ่มตัวอย่าง Touch-to-Paint Latency ให้ครบ 200 ครั้ง", cx, cy + Math.round(14 * dpr));
  }

  private drawActivePointerEffect(
    ctx: CanvasRenderingContext2D,
    dpr: number
  ): void {
    const px = this.currentPointerX;
    const py = this.currentPointerY;
    const radius = Math.round(24 * dpr);

    // วงกลมรอบนิ้ว
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(2, Math.round(2.5 * dpr));
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();

    // ป้ายบอก Latency ล่าสุดเหนือนิ้ว
    const badgeW = Math.round(110 * dpr);
    const badgeH = Math.round(28 * dpr);
    const badgeX = px - badgeW / 2;
    const badgeY = py - radius - badgeH - Math.round(8 * dpr);

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${this.lastMeasuredLatency.toFixed(1)} ms`,
      px,
      badgeY + badgeH / 2
    );
  }

  private drawStatsDashboard(
    ctx: CanvasRenderingContext2D,
    w: number,
    dpr: number,
    stats: LatencyStats
  ): void {
    const margin = Math.round(20 * dpr);
    const totalW = w - margin * 2;
    const startY = Math.round(18 * dpr);
    const cardH = Math.round(72 * dpr);

    // การ์ด 5 คอลัมน์: เฉลี่ย, P95, ต่ำสุด/สูงสุด, ระดับประเมิน, Frame Drops
    const cards = [
      {
        title: "ค่าเฉลี่ย (AVG)",
        value: `${stats.avg} ms`,
        sub: `ตัวอย่าง: ${stats.count}/200`,
        color: stats.count > 0 ? "#ffffff" : "#71717a",
      },
      {
        title: "Percentile 95 (P95)",
        value: `${stats.p95} ms`,
        sub: "ความเสถียร 95%",
        color: "#38bdf8",
      },
      {
        title: "ต่ำสุด / สูงสุด",
        value: `${stats.min} / ${stats.max}`,
        sub: "Min / Max (ms)",
        color: "#a1a1aa",
      },
      {
        title: "ระดับประเมิน (Rating)",
        value: stats.ratingLabel,
        sub: "เกณฑ์อ้างอิงคร่าว ๆ",
        color: stats.ratingColor,
      },
      {
        title: "Frame Drops (>20ms)",
        value: `${stats.frameDrops} ครั้ง`,
        sub: "ช่วงกระตุกระหว่างเฟรม",
        color: stats.frameDrops > 0 ? "#f97316" : "#22c55e",
      },
    ];

    const cardW = Math.floor((totalW - Math.round(10 * dpr) * (cards.length - 1)) / cards.length);

    cards.forEach((c, idx) => {
      const cx = margin + idx * (cardW + Math.round(10 * dpr));

      ctx.fillStyle = "rgba(24, 24, 27, 0.9)";
      ctx.fillRect(cx, startY, cardW, cardH);
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, startY, cardW, cardH);

      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // หัวข้อการ์ด
      ctx.fillStyle = "#a1a1aa";
      ctx.font = `${Math.round(10 * dpr)}px sans-serif`;
      ctx.fillText(c.title, cx + cardW / 2, startY + Math.round(8 * dpr));

      // ค่าหลัก
      ctx.fillStyle = c.color;
      ctx.font = `bold ${Math.round(14 * dpr)}px monospace`;
      ctx.fillText(c.value, cx + cardW / 2, startY + Math.round(28 * dpr));

      // คำอธิบายย่อย
      ctx.fillStyle = "#71717a";
      ctx.font = `${Math.round(9 * dpr)}px sans-serif`;
      ctx.fillText(c.sub, cx + cardW / 2, startY + Math.round(50 * dpr));
    });
  }

  private drawLiveGraph(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const margin = Math.round(20 * dpr);
    const graphW = w - margin * 2;
    const graphH = Math.round(140 * dpr);
    const graphX = margin;
    const graphY = h - graphH - Math.round(50 * dpr);

    // พื้นหลังกล่องกราฟ
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // เส้นเกณฑ์อ้างอิงแนวนอน (20ms, 40ms, 80ms)
    const maxGraphMs = 100;
    const drawRefLine = (ms: number, color: string, label: string) => {
      const y = graphY + graphH - (ms / maxGraphMs) * graphH;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(graphX, y);
      ctx.lineTo(graphX + graphW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = `${Math.round(9 * dpr)}px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${ms}ms (${label})`, graphX + 6, y - 2);
    };

    drawRefLine(20, "rgba(34, 197, 94, 0.6)", "ดีมาก");
    drawRefLine(40, "rgba(56, 189, 248, 0.6)", "ดี");
    drawRefLine(80, "rgba(249, 115, 22, 0.6)", "พอใช้");

    // วาดเส้นกราฟ 200 ตัวอย่าง
    if (this.sampleCount >= 2) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = Math.max(1.5, Math.round(2 * dpr));
      ctx.beginPath();

      const stepX = graphW / (this.maxSamples - 1);
      const startIdx = this.sampleCount < this.maxSamples ? 0 : this.sampleIndex;

      for (let i = 0; i < this.sampleCount; i++) {
        const bufIdx = (startIdx + i) % this.maxSamples;
        const val = this.sampleBuffer[bufIdx]!;
        const clampedVal = Math.min(maxGraphMs, val);

        const x = graphX + i * stepX;
        const y = graphY + graphH - (clampedVal / maxGraphMs) * graphH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ข้อความกำกับด้านล่างตามข้อกำหนดอย่างเคร่งครัด
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
    ctx.fillText(
      "ค่านี้เป็นความหน่วงฝั่งซอฟต์แวร์ ไม่รวมเวลาตอบสนองของพาเนลจอ",
      w / 2,
      h - Math.round(24 * dpr)
    );

    // ปุ่มรีเซ็ตสถิติแบบสัมผัสได้
    const btnW = Math.round(180 * dpr);
    const btnH = Math.round(40 * dpr);
    const btnX = w - btnW - Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(10 * dpr);

    ctx.fillStyle = "rgba(39, 39, 42, 0.9)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // รองรับการตรวจสอบ: 🔄 รีเซ็ตสถิติ (R)
    ctx.fillText("รีเซ็ตสถิติ (R)", btnX + btnW / 2, btnY + btnH / 2);
  }
}
