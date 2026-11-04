import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";

export type OrientationPatternId =
  | "normal"
  | "invert-x"
  | "invert-y"
  | "rotate-180"
  | "swap-xy"
  | "swap-xy-inv-x"
  | "swap-xy-inv-y"
  | "swap-xy-inv-both"
  | "uncertain";

export interface OrientationAnalysisResult {
  patternId: OrientationPatternId;
  label: string;
  description: string;
  averageErrorNormalized: number;
  averageErrorPixels: number;
  isReliable: boolean;
  expectedTransformedPoints: Array<{ x: number; y: number }>;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * 4 จุดเป้าหมาย 10% จากขอบจอ: บนซ้าย -> บนขวา -> ล่างขวา -> ล่างซ้าย
 */
export const TARGET_CORNERS_NORMALIZED: NormalizedPoint[] = [
  { x: 0.1, y: 0.1 }, // 1. บนซ้าย (Top-Left)
  { x: 0.9, y: 0.1 }, // 2. บนขวา (Top-Right)
  { x: 0.9, y: 0.9 }, // 3. ล่างขวา (Bottom-Right)
  { x: 0.1, y: 0.9 }, // 4. ล่างซ้าย (Bottom-Left)
];

/**
 * ฟังก์ชันประมวลผลหาการแปลงที่ตรงที่สุดจาก 8 รูปแบบ
 * (เขียนให้เป็น Pure function สำหรับ Unit Test ได้ 100%)
 */
export function evaluateTouchOrientation(
  targets: NormalizedPoint[],
  touches: NormalizedPoint[],
  screenW = 1024,
  screenH = 768
): OrientationAnalysisResult {
  if (targets.length !== 4 || touches.length !== 4) {
    return {
      patternId: "uncertain",
      label: "ไม่แน่ใจ ลองใหม่",
      description: "ข้อมูลจุดสัมผัสไม่ครบ 4 จุด",
      averageErrorNormalized: 1.0,
      averageErrorPixels: 1000,
      isReliable: false,
      expectedTransformedPoints: [],
    };
  }

  // นิยามการแปลงทั้ง 8 รูปแบบ (Transform Formulas)
  const transforms: Array<{
    id: OrientationPatternId;
    label: string;
    description: string;
    apply: (p: NormalizedPoint) => NormalizedPoint;
  }> = [
    {
      id: "normal",
      label: "ปกติ (Normal)",
      description: "ตำแหน่งสัมผัสตรงกับหน้าจอ แกน X และ Y ถูกทิศทาง",
      apply: (p) => ({ x: p.x, y: p.y }),
    },
    {
      id: "invert-x",
      label: "แกน X กลับด้าน (Inverted X)",
      description: "แกนแนวนอนสลับซ้าย-ขวา แต่แกนแนวตั้งปกติ",
      apply: (p) => ({ x: 1 - p.x, y: p.y }),
    },
    {
      id: "invert-y",
      label: "แกน Y กลับด้าน (Inverted Y)",
      description: "แกนแนวตั้งสลับบน-ล่าง แต่แกนแนวนอนปกติ",
      apply: (p) => ({ x: p.x, y: 1 - p.y }),
    },
    {
      id: "rotate-180",
      label: "หมุน 180° (Inverted X & Y)",
      description: "ทั้งแกน X และ Y กลับด้าน (หมุนกลับหัว 180 องศา)",
      apply: (p) => ({ x: 1 - p.x, y: 1 - p.y }),
    },
    {
      id: "swap-xy",
      label: "สลับแกน X ↔ Y (Swapped Axes)",
      description: "แกนแนวนอนและแนวตั้งสลับกัน",
      apply: (p) => ({ x: p.y, y: p.x }),
    },
    {
      id: "swap-xy-inv-x",
      label: "สลับแกน X/Y + กลับแกน X",
      description: "สลับแกน X↔Y และกลับด้านแกน X",
      apply: (p) => ({ x: 1 - p.y, y: p.x }),
    },
    {
      id: "swap-xy-inv-y",
      label: "สลับแกน X/Y + กลับแกน Y",
      description: "สลับแกน X↔Y และกลับด้านแกน Y",
      apply: (p) => ({ x: p.y, y: 1 - p.x }),
    },
    {
      id: "swap-xy-inv-both",
      label: "สลับแกน X/Y + กลับทั้งสองแกน",
      description: "สลับแกน X↔Y พร้อมกลับด้านทั้งสองแกน",
      apply: (p) => ({ x: 1 - p.y, y: 1 - p.x }),
    },
  ];

  let bestPattern = transforms[0]!;
  let lowestError = Number.POSITIVE_INFINITY;
  let bestTransformedPoints: NormalizedPoint[] = [];

  for (const t of transforms) {
    let totalDist = 0;
    const transformed: NormalizedPoint[] = [];

    for (let i = 0; i < 4; i++) {
      const expected = t.apply(targets[i]!);
      transformed.push(expected);
      const actual = touches[i]!;

      // คำนวณระยะ Euclidean distance ในสัดส่วน Normalized
      const dx = actual.x - expected.x;
      const dy = actual.y - expected.y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }

    const avgError = totalDist / 4;
    if (avgError < lowestError) {
      lowestError = avgError;
      bestPattern = t;
      bestTransformedPoints = transformed;
    }
  }

  // คำนวณความคลาดเคลื่อนเฉลี่ยเป็นพิกเซลจริง
  const avgPixelError = Math.round(
    lowestError * Math.sqrt(screenW * screenW + screenH * screenH) / 2
  );

  // เกณฑ์ตัดสิน: ถ้าความคลาดเคลื่อนมากกว่า 0.18 (18% ของจอ) หรือแตะซ้ำจุดเดิม ถือว่าสัญญาณไม่ชัดเจน
  const isReliable = lowestError <= 0.18;

  if (!isReliable) {
    return {
      patternId: "uncertain",
      label: "ไม่แน่ใจ ลองใหม่",
      description: "ตำแหน่งที่แตะคลาดเคลื่อนสูง หรือแตะไม่ตรงเป้า กรุณาลองใหม่อีกครั้ง",
      averageErrorNormalized: Number(lowestError.toFixed(3)),
      averageErrorPixels: avgPixelError,
      isReliable: false,
      expectedTransformedPoints: bestTransformedPoints,
    };
  }

  return {
    patternId: bestPattern.id,
    label: bestPattern.label,
    description: bestPattern.description,
    averageErrorNormalized: Number(lowestError.toFixed(3)),
    averageErrorPixels: avgPixelError,
    isReliable: true,
    expectedTransformedPoints: bestTransformedPoints,
  };
}

export class TouchAxisTestModule implements TestModule {
  public readonly id: TestModuleId = "touch-axis";
  public readonly title = "6. เช็คทิศทางและแกนสัมผัส (Touch Axis / Orientation)";
  public readonly description =
    "แตะเป้า 4 มุมเพื่อวิเคราะห์ว่าแกน X/Y ปกติ กลับด้าน หรือสลับแกน พร้อมโหมดลากเส้นทแยงมุม";
  public readonly controlsHint =
    "แตะเป้าตามลำดับ 1 → 2 → 3 → 4 | ปุ่ม Tab/2 สลับไปโหมดลากเส้น | R ทำซ้ำ | Esc กลับเมนู";
  public readonly usesTouchDirectly = true; // ปิดการปัดสลับหน้าของระบบกลาง

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private onStatusChange?: (status: string) => void;

  // ขั้นตอนในหน้าทดสอบ (Stage 1: Calibration, Stage 2: Trail test)
  public stage: "calibration" | "trail" = "calibration";

  // สถานะการแตะเป้า 4 จุด
  public currentStep = 0; // 0: รอเป้า 1, 1: รอเป้า 2, 2: รอเป้า 3, 3: รอเป้า 4, 4: วิเคราะห์ผลเสร็จ
  public touchedPoints: NormalizedPoint[] = [];
  public rawTouchedPixels: Array<{ x: number; y: number }> = [];
  public analysisResult: OrientationAnalysisResult | null = null;

  // สำหรับโหมดลากเส้นทแยงมุม (Stage 2)
  private completedStrokes: Array<Array<{ x: number; y: number }>> = [];
  private activeStrokes: Map<number, Array<{ x: number; y: number }>> = new Map();

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.resetCalibration();
    canvas.style.touchAction = "none";
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
  }

  public onKey(e: KeyboardEvent): void {
    const isR = e.code === "KeyR" || e.key === "r" || e.key === "R" || e.key === "พ";
    const isC = e.code === "KeyC" || e.key === "c" || e.key === "C" || e.key === "แ";
    const is1 = e.code === "Digit1" || e.code === "Numpad1" || e.key === "1" || e.key === "ArrowLeft";
    const is2 = e.code === "Digit2" || e.code === "Numpad2" || e.key === "2" || e.key === "ArrowRight" || e.key === "Tab";

    if (isR || isC) {
      e.preventDefault();
      if (this.stage === "calibration") {
        this.resetCalibration();
      } else {
        this.clearTrailStrokes();
      }
    } else if (is1) {
      e.preventDefault();
      this.setStage("calibration");
    } else if (is2) {
      e.preventDefault();
      this.setStage("trail");
    }
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas) return;
    e.preventDefault();

    const dpr = window.devicePixelRatio || 1;
    const physX = Math.round(e.clientX * dpr);
    const physY = Math.round(e.clientY * dpr);
    const normX = Math.max(0, Math.min(1, physX / this.canvas.width));
    const normY = Math.max(0, Math.min(1, physY / this.canvas.height));

    // ตรวจสอบการกดปุ่มเปลี่ยนแท็บหรือปุ่มควบคุมล่างจอ
    if (e.type === "pointerdown") {
      if (this.handleButtonsPointerDown(physX, physY, this.canvas.width, this.canvas.height, dpr)) {
        return;
      }
    }

    if (this.stage === "calibration") {
      if (e.type === "pointerdown") {
        if (this.currentStep < 4) {
          this.touchedPoints.push({ x: normX, y: normY });
          this.rawTouchedPixels.push({ x: physX, y: physY });
          this.currentStep++;

          if (this.currentStep === 4) {
            this.analysisResult = evaluateTouchOrientation(
              TARGET_CORNERS_NORMALIZED,
              this.touchedPoints,
              this.canvas.width,
              this.canvas.height
            );
          }

          this.emitStatus();
          this.scheduleDraw();
        }
      }
    } else if (this.stage === "trail") {
      if (e.type === "pointerdown") {
        // เริ่ม Stroke ใหม่เฉพาะนิ้ว/พอยน์เตอร์นี้ (แยก stroke ป้องกันเส้นโผล่เชื่อมเอง 15.1)
        this.activeStrokes.set(e.pointerId, [{ x: physX, y: physY }]);
        this.scheduleDraw();
      } else if (e.type === "pointermove") {
        const stroke = this.activeStrokes.get(e.pointerId);
        if (stroke && (e.buttons > 0 || e.pointerType === "touch")) {
          stroke.push({ x: physX, y: physY });
          if (stroke.length > 300) stroke.shift();
          this.scheduleDraw();
        }
      } else if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        const stroke = this.activeStrokes.get(e.pointerId);
        if (stroke && stroke.length > 0) {
          this.completedStrokes.push(stroke);
          if (this.completedStrokes.length > 30) this.completedStrokes.shift();
        }
        this.activeStrokes.delete(e.pointerId);
        this.scheduleDraw();
      }
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scheduleDraw();
  }

  public resetCalibration(): void {
    this.currentStep = 0;
    this.touchedPoints = [];
    this.rawTouchedPixels = [];
    this.analysisResult = null;
    this.emitStatus();
    this.scheduleDraw();
  }

  public clearTrailStrokes(): void {
    this.completedStrokes = [];
    this.activeStrokes.clear();
    this.emitStatus();
    this.scheduleDraw();
  }

  public setStage(stage: "calibration" | "trail"): void {
    if (this.stage === stage) return;
    this.stage = stage;
    if (stage === "trail") {
      this.clearTrailStrokes();
    }
    this.emitStatus();
    this.scheduleDraw();
  }

  private emitStatus(): void {
    if (this.stage === "calibration") {
      if (this.currentStep < 4) {
        this.onStatusChange?.(
          `ขั้นตอน ${this.currentStep + 1}/4: กรุณาแตะที่เป้าหมายหมายเลข ${this.currentStep + 1}`
        );
      } else if (this.analysisResult) {
        this.onStatusChange?.(
          `ผลการวิเคราะห์: ${this.analysisResult.label} (ความคลาดเคลื่อน ${this.analysisResult.averageErrorPixels} px / ${(this.analysisResult.averageErrorNormalized * 100).toFixed(1)}%)`
        );
      }
    } else {
      this.onStatusChange?.("โหมดลากเส้นทแยงมุม: ลากนิ้วจากมุมซ้ายบนไปล่างขวาเพื่อดูทิศทางของเส้น");
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

    // พื้นหลังสีเข้ม
    ctx.fillStyle = "#0c0a09";
    ctx.fillRect(0, 0, width, height);

    if (this.stage === "calibration") {
      this.drawCalibrationStage(ctx, width, height, dpr);
    } else {
      this.drawTrailStage(ctx, width, height, dpr);
    }

    // แถบสลับแท็บโหมดด้านบน
    this.drawTopNavTabs(ctx, width, dpr);
  }

  private drawCalibrationStage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const stepNames = ["1. บนซ้าย", "2. บนขวา", "3. ล่างขวา", "4. ล่างซ้าย"];

    // 1. วาดเป้าหมาย 4 จุด
    TARGET_CORNERS_NORMALIZED.forEach((t, idx) => {
      const tx = Math.round(t.x * w);
      const ty = Math.round(t.y * h);
      const isCurrent = idx === this.currentStep;
      const isDone = idx < this.currentStep;

      const targetRadius = Math.round(36 * dpr);

      // วงแหวนเป้า
      ctx.beginPath();
      ctx.arc(tx, ty, targetRadius, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent
        ? "rgba(249, 115, 22, 0.25)"
        : isDone
          ? "rgba(34, 197, 94, 0.15)"
          : "rgba(39, 39, 42, 0.4)";
      ctx.fill();

      ctx.strokeStyle = isCurrent ? "#f97316" : isDone ? "#22c55e" : "#52525b";
      ctx.lineWidth = Math.max(2, Math.round(3 * dpr));
      ctx.stroke();

      // วงกลมชั้นใน
      ctx.beginPath();
      ctx.arc(tx, ty, Math.round(10 * dpr), 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? "#f97316" : isDone ? "#22c55e" : "#71717a";
      ctx.fill();

      // เส้นกากบาทเล็ง
      ctx.beginPath();
      ctx.moveTo(tx - targetRadius - 8, ty);
      ctx.lineTo(tx + targetRadius + 8, ty);
      ctx.moveTo(tx, ty - targetRadius - 8);
      ctx.lineTo(tx, ty + targetRadius + 8);
      ctx.stroke();

      // หมายเลขลำดับเป้า
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(18 * dpr)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${idx + 1}`, tx, ty - Math.round(48 * dpr));

      ctx.fillStyle = isCurrent ? "#f97316" : "#a1a1aa";
      ctx.font = `${Math.round(11 * dpr)}px sans-serif`;
      ctx.fillText(stepNames[idx] ?? "", tx, ty + Math.round(48 * dpr));
    });

    // 2. วาดจุดที่ผู้ใช้แตะจริง (Touched Points) และเส้นโยงความคลาดเคลื่อน
    this.rawTouchedPixels.forEach((tp, idx) => {
      const targetNorm = TARGET_CORNERS_NORMALIZED[idx]!;
      const targetX = Math.round(targetNorm.x * w);
      const targetY = Math.round(targetNorm.y * h);

      // จุดที่แตะจริง
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, Math.round(10 * dpr), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // เส้นประโยงระหว่างเป้ากับจุดที่แตะ
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = Math.max(1, Math.round(1.5 * dpr));
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(tp.x, tp.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 3. แสดงการ์ดผลการวิเคราะห์กลางจอ (เมื่อแตะครบ 4 จุด)
    if (this.currentStep >= 4 && this.analysisResult) {
      this.drawAnalysisSummaryCard(ctx, w, h, dpr, this.analysisResult);
    } else {
      // แนะนำขั้นตอนปัจจุบัน
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#f97316";
      ctx.font = `bold ${Math.round(20 * dpr)}px sans-serif`;
      ctx.fillText(
        `กรุณาแตะเป้าหมายที่ ${this.currentStep + 1} (${stepNames[this.currentStep]})`,
        cx,
        cy
      );

      ctx.fillStyle = "#a1a1aa";
      ctx.font = `${Math.round(13 * dpr)}px sans-serif`;
      ctx.fillText("แตะจุดกึ่งกลางของเป้าหมายให้แม่นยำที่สุดทีละจุด", cx, cy + Math.round(30 * dpr));
    }
  }

  private drawAnalysisSummaryCard(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    res: OrientationAnalysisResult
  ): void {
    const cardW = Math.min(w - Math.round(40 * dpr), Math.round(620 * dpr));
    const cardH = Math.round(240 * dpr);
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;

    ctx.fillStyle = "rgba(24, 24, 27, 0.94)";
    ctx.fillRect(cardX, cardY, cardW, cardH);

    const isOk = res.patternId === "normal";
    ctx.strokeStyle = isOk ? "#22c55e" : res.isReliable ? "#f97316" : "#ef4444";
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // หัวข้อผลลัพธ์
    ctx.fillStyle = isOk ? "#22c55e" : res.isReliable ? "#f97316" : "#ef4444";
    ctx.font = `bold ${Math.round(22 * dpr)}px sans-serif`;
    ctx.fillText(`ผลการวิเคราะห์: ${res.label}`, cardX + cardW / 2, cardY + Math.round(20 * dpr));

    // คำอธิบาย
    ctx.fillStyle = "#e4e4e7";
    ctx.font = `${Math.round(14 * dpr)}px sans-serif`;
    ctx.fillText(res.description, cardX + cardW / 2, cardY + Math.round(58 * dpr));

    // ค่าความคลาดเคลื่อน
    ctx.fillStyle = "#a1a1aa";
    ctx.font = `${Math.round(12 * dpr)}px monospace`;
    ctx.fillText(
      `ความคลาดเคลื่อนเฉลี่ย: ${res.averageErrorPixels} px (${(res.averageErrorNormalized * 100).toFixed(1)}% ของจอ)`,
      cardX + cardW / 2,
      cardY + Math.round(86 * dpr)
    );

    // ปุ่มกดทำซ้ำ และไปโหมดลากเส้น
    const btnW = Math.round(160 * dpr);
    const btnH = Math.round(42 * dpr);
    const btnGap = Math.round(20 * dpr);
    const btnY = cardY + cardH - btnH - Math.round(20 * dpr);

    // ปุ่มทดสอบใหม่
    const btn1X = cardX + cardW / 2 - btnW - btnGap / 2;
    ctx.fillStyle = "#27272a";
    ctx.fillRect(btn1X, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btn1X, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText("ทดสอบใหม่ (R)", btn1X + btnW / 2, btnY + btnH / 2);

    // ปุ่มไปโหมดลากเส้น
    const btn2X = cardX + cardW / 2 + btnGap / 2;
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(btn2X, btnY, btnW, btnH);
    ctx.strokeStyle = "#38bdf8";
    ctx.strokeRect(btn2X, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("ทดสอบลากเส้น →", btn2X + btnW / 2, btnY + btnH / 2);
  }

  private drawTrailStage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    // 1. วาดเส้นบอกทิศทางอ้างอิงทแยงมุมจากบนซ้ายไปล่างขวา
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    ctx.beginPath();
    ctx.moveTo(Math.round(0.1 * w), Math.round(0.1 * h));
    ctx.lineTo(Math.round(0.9 * w), Math.round(0.9 * h));
    ctx.stroke();

    // หัวลูกศรอ้างอิง
    ctx.fillStyle = "#3f3f46";
    ctx.beginPath();
    const endX = Math.round(0.9 * w);
    const endY = Math.round(0.9 * h);
    ctx.arc(endX, endY, Math.round(12 * dpr), 0, Math.PI * 2);
    ctx.fill();

    // 2. วาดรอยเส้นลากนิ้วของผู้ใช้ (User Trail) แยกแต่ละ Stroke ชัดเจน ป้องกันเส้นโผล่เชื่อมจุด (15.1)
    const allStrokes = [...this.completedStrokes, ...this.activeStrokes.values()];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of allStrokes) {
      if (stroke.length === 1) {
        // แตะจุดเดียว วาดวงกลมจุดสัมผัส
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(stroke[0]!.x, stroke[0]!.y, Math.round(4 * dpr), 0, Math.PI * 2);
        ctx.fill();
      } else if (stroke.length > 1) {
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = Math.max(3, Math.round(5 * dpr));
        ctx.beginPath();
        ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
        }
        ctx.stroke();
      }
    }

    // คำแนะนำโหมดลากเส้น
    const cx = Math.floor(w / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#f97316";
    ctx.font = `bold ${Math.round(16 * dpr)}px sans-serif`;
    ctx.fillText(
      "ทดสอบลากนิ้ว: วางนิ้วแล้วลากเป็นแนวทแยงมุมหรือวงกลม",
      cx,
      Math.round(70 * dpr)
    );

    ctx.fillStyle = "#a1a1aa";
    ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.fillText(
      "สังเกตว่าเส้นสีส้มวิ่งตามปลายนิ้วถูกต้องตามแกนหรือไม่ (หากกลับแกน เส้นจะวิ่งไปคนละทิศ)",
      cx,
      Math.round(95 * dpr)
    );

    // 3. วาดปุ่มควบคุมล่างจอสำหรับหน้า 6.2 (15.2: ปุ่มเฉพาะหน้า ล้างเส้น + กลับไปแตะ 4 มุม)
    this.drawTrailActionButtons(ctx, w, h, dpr);
  }

  private drawTrailActionButtons(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number
  ): void {
    const btnW = Math.round(200 * dpr);
    const btnH = Math.round(48 * dpr);
    const btnGap = Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(28 * dpr);

    // ปุ่ม ล้างเส้น (R)
    const btn1X = w / 2 - btnW - btnGap / 2;
    ctx.fillStyle = "#27272a";
    ctx.fillRect(btn1X, btnY, btnW, btnH);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(btn1X, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ล้างเส้น (R)", btn1X + btnW / 2, btnY + btnH / 2);

    // ปุ่ม กลับไปแตะ 4 มุม (1)
    const btn2X = w / 2 + btnGap / 2;
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(btn2X, btnY, btnW, btnH);
    ctx.strokeStyle = "#f97316";
    ctx.strokeRect(btn2X, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("← กลับไปแตะ 4 มุม [1]", btn2X + btnW / 2, btnY + btnH / 2);
  }

  private handleButtonsPointerDown(
    px: number,
    py: number,
    w: number,
    h: number,
    dpr: number
  ): boolean {
    // 1. ตรวจสอบแท็บด้านบน
    const tabH = Math.round(44 * dpr);
    const totalW = Math.min(w - Math.round(40 * dpr), Math.round(520 * dpr));
    const startX = (w - totalW) / 2;
    const startY = Math.round(10 * dpr);
    const tabW = totalW / 2;

    if (py >= startY && py <= startY + tabH) {
      if (px >= startX && px < startX + tabW) {
        this.setStage("calibration");
        return true;
      } else if (px >= startX + tabW && px <= startX + totalW) {
        this.setStage("trail");
        return true;
      }
    }

    // 2. ตรวจสอบปุ่มล่างจอ
    const btnW = Math.round(200 * dpr);
    const btnH = Math.round(56 * dpr); // ขยายขอบเขตสัมผัสให้แตะง่าย
    const btnGap = Math.round(20 * dpr);
    const btnY = h - btnH - Math.round(24 * dpr);

    if (py >= btnY && py <= h) {
      const btn1X = w / 2 - btnW - btnGap / 2;
      const btn2X = w / 2 + btnGap / 2;

      if (px >= btn1X && px <= btn1X + btnW) {
        if (this.stage === "calibration") {
          this.resetCalibration();
        } else {
          this.clearTrailStrokes();
        }
        return true;
      } else if (px >= btn2X && px <= btn2X + btnW) {
        if (this.stage === "calibration") {
          this.setStage("trail");
        } else {
          this.setStage("calibration");
        }
        return true;
      }
    }

    return false;
  }

  private drawTopNavTabs(
    ctx: CanvasRenderingContext2D,
    w: number,
    dpr: number
  ): void {
    const tabs = [
      { id: "calibration", label: "[1] แตะเป้า 4 มุมวิเคราะห์แกน" },
      { id: "trail", label: "[2] ทดสอบลากเส้นทิศทาง (Trail)" },
    ];

    const tabH = Math.round(36 * dpr);
    const totalW = Math.min(w - Math.round(40 * dpr), Math.round(520 * dpr));
    const startX = (w - totalW) / 2;
    const startY = Math.round(14 * dpr);
    const tabW = totalW / tabs.length;

    tabs.forEach((t, i) => {
      const tx = startX + i * tabW;
      const isSelected = this.stage === t.id;

      ctx.fillStyle = isSelected ? "#ea580c" : "rgba(28, 25, 23, 0.88)";
      ctx.fillRect(tx, startY, tabW, tabH);

      ctx.strokeStyle = isSelected ? "#f97316" : "#44403c";
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, startY, tabW, tabH);

      ctx.fillStyle = isSelected ? "#ffffff" : "#a8a29e";
      ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.label, tx + tabW / 2, startY + tabH / 2);
    });
  }
}

