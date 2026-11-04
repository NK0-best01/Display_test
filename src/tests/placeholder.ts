import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";

interface PlaceholderSpec {
  id: TestModuleId;
  title: string;
  description: string;
  controlsHint: string;
  usesTouchDirectly: boolean;
  accentColor: string;
  subPages: string[];
}

export class PlaceholderTestModule implements TestModule {
  public readonly id: TestModuleId;
  public readonly title: string;
  public readonly description: string;
  public readonly controlsHint: string;
  public readonly usesTouchDirectly: boolean;

  private readonly accentColor: string;
  private readonly subPages: string[];
  private currentPageIndex = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private lastPointerPos: { x: number; y: number } | null = null;
  private swipeStartX: number | null = null;
  private onStatusChange?: (status: string) => void;

  constructor(spec: PlaceholderSpec, onStatusChange?: (status: string) => void) {
    this.id = spec.id;
    this.title = spec.title;
    this.description = spec.description;
    this.controlsHint = spec.controlsHint;
    this.usesTouchDirectly = spec.usesTouchDirectly;
    this.accentColor = spec.accentColor;
    this.subPages = spec.subPages;
    this.onStatusChange = onStatusChange;
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentPageIndex = 0;
    this.lastPointerPos = null;
    this.swipeStartX = null;
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
    this.lastPointerPos = null;
    this.swipeStartX = null;
  }

  public onKey(e: KeyboardEvent): void {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      this.nextPage();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.prevPage();
    }
  }

  public onPointer(e: PointerEvent): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.round(e.clientX * dpr);
    const y = Math.round(e.clientY * dpr);

    if (e.type === "pointerdown") {
      this.lastPointerPos = { x, y };
      this.swipeStartX = e.clientX;
      this.scheduleDraw();
    } else if (e.type === "pointermove") {
      if (e.buttons > 0 || e.pointerType === "touch") {
        this.lastPointerPos = { x, y };
        this.scheduleDraw();
      }
    } else if (e.type === "pointerup") {
      if (!this.usesTouchDirectly && this.swipeStartX !== null) {
        const dx = e.clientX - this.swipeStartX;
        if (Math.abs(dx) > 50) {
          if (dx < 0) this.nextPage();
          else this.prevPage();
        } else {
          // แตะครึ่งซ้าย / ครึ่งขวาของจอเพื่อเปลี่ยนภาพ
          if (e.clientX > window.innerWidth / 2) {
            this.nextPage();
          } else {
            this.prevPage();
          }
        }
      }
      this.swipeStartX = null;
    }
  }

  public onResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.draw();
  }

  private nextPage(): void {
    this.currentPageIndex = (this.currentPageIndex + 1) % this.subPages.length;
    this.emitStatus();
    this.scheduleDraw();
  }

  private prevPage(): void {
    this.currentPageIndex =
      (this.currentPageIndex - 1 + this.subPages.length) % this.subPages.length;
    this.emitStatus();
    this.scheduleDraw();
  }

  private emitStatus(): void {
    const pageName = this.subPages[this.currentPageIndex] ?? "";
    this.onStatusChange?.(
      `รูปแบบที่ ${this.currentPageIndex + 1}/${this.subPages.length}: ${pageName}`
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

    // พื้นหลังเต็มพิกเซลจริง
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // กรอบพิกเซลริมสุดของจอ (ตรวจว่าเต็มจอจริง ไม่มีแถบบัง)
    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // เส้นกากบาทกึ่งกลางจอ
    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(height / 2));
    ctx.lineTo(width, Math.floor(height / 2));
    ctx.moveTo(Math.floor(width / 2), 0);
    ctx.lineTo(Math.floor(width / 2), height);
    ctx.stroke();

    // ข้อความกลางจอแสดงสถานะหน้าทดสอบจำลอง (Placeholder สำหรับ Part 2)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const titleFont = Math.round(28 * dpr);
    const subFont = Math.round(18 * dpr);
    const smallFont = Math.round(14 * dpr);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = this.accentColor;
    ctx.font = `bold ${titleFont}px sans-serif`;
    ctx.fillText(this.title, centerX, centerY - Math.round(50 * dpr));

    ctx.fillStyle = "#f5f5f5";
    ctx.font = `${subFont}px sans-serif`;
    ctx.fillText(
      `โหมดย่อย (${this.currentPageIndex + 1}/${this.subPages.length}): ${this.subPages[this.currentPageIndex]}`,
      centerX,
      centerY
    );

    ctx.fillStyle = "#a3a3a3";
    ctx.font = `${smallFont}px monospace`;
    ctx.fillText(
      `ความละเอียด Canvas จริง: ${width} × ${height} px (DPR: ${dpr})`,
      centerX,
      centerY + Math.round(40 * dpr)
    );

    ctx.fillStyle = "#737373";
    ctx.font = `${smallFont}px sans-serif`;
    ctx.fillText(
      "กด Esc หรือกดค้างมุมซ้ายบน 1 วินาที เพื่อกลับเมนูหลัก | กด H หรือแตะ 3 นิ้ว เพื่อซ่อน/แสดง HUD",
      centerX,
      centerY + Math.round(75 * dpr)
    );

    // วาดจุดที่แตะ/คลิกล่าสุดเพื่อเช็คการตอบสนองของ Pointer
    if (this.lastPointerPos) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      ctx.beginPath();
      ctx.arc(
        this.lastPointerPos.x,
        this.lastPointerPos.y,
        Math.round(24 * dpr),
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.fillStyle = "#22c55e";
      ctx.font = `${smallFont}px monospace`;
      ctx.fillText(
        `(${this.lastPointerPos.x}, ${this.lastPointerPos.y})`,
        this.lastPointerPos.x,
        this.lastPointerPos.y - Math.round(34 * dpr)
      );
    }
  }
}

export function createTestModules(
  onStatusChange?: (status: string) => void
): TestModule[] {
  const specs: PlaceholderSpec[] = [
    {
      id: "image-quality",
      title: "1. คุณภาพของภาพ (Image Quality)",
      description: "Grayscale ramp, Near-black/white, Gamma, เส้นคมชัด 1 พิกเซล, วงกลม Geometry และขอบจอ Overscan",
      controlsHint: "ปุ่ม ← / → หรือแตะซ้าย/ขวา เพื่อเปลี่ยนภาพ | H ซ่อน HUD | Esc กลับเมนู",
      usesTouchDirectly: false,
      accentColor: "#38bdf8",
      subPages: [
        "Grayscale Ramp ต่อเนื่อง & 16/32 ระดับ",
        "Near-Black (0-15) & Near-White (240-255)",
        "Gamma Pattern (เทียบเทา 50%)",
        "Sharpness เส้นและตาราง 1 พิกเซล",
        "Geometry วงกลมและตารางเต็มจอ",
        "Overscan กรอบเส้นขอบจอ",
      ],
    },
    {
      id: "multi-touch",
      title: "2. ทดสอบระบบสัมผัส (Multi-touch & วาดเส้น)",
      description: "ตรวจจับหลายนิ้วพร้อมกัน วาดเส้นต่อเนื่อง (Coalesced) และโหมดตาราง Grid เช็คโซนทัชทั่วจอ",
      controlsHint: "แตะ/ลากหลายนิ้วบนจอ | กดค้างมุมซ้ายบน 1 วินาที หรือ Esc เพื่อกลับเมนู",
      usesTouchDirectly: true,
      accentColor: "#34d399",
      subPages: ["Multi-touch Points", "โหมดวาดเส้นต่อเนื่อง (Draw)", "โหมดตาราง (Grid 16×12)"],
    },
    {
      id: "color",
      title: "3. ทดสอบสี (Color Accuracy & Gradient)",
      description: "สีเต็มจอ 8 สี, แถบสีมาตรฐาน SMPTE, การไล่เฉด R/G/B, สีเทียบธรรมชาติ และตรวจสีเพี้ยน White/Gray Tint",
      controlsHint: "ปุ่ม ← / → หรือแตะซ้าย/ขวา เพื่อเปลี่ยนสี | H ซ่อน HUD | Esc กลับเมนู",
      usesTouchDirectly: false,
      accentColor: "#f472b6",
      subPages: [
        "สีเต็มจอ (แดง, เขียว, น้ำเงิน, ขาว, ดำ, Cyan, Magenta, เหลือง)",
        "แถบสีมาตรฐาน SMPTE / 8 Bars",
        "Gradient แยกช่องสี R, G, B และสีผสม",
        "ช่องสีเทียบธรรมชาติ (สีผิว, ท้องฟ้า, หญ้า)",
        "White / Gray Tint (25%, 50%, 75%)",
      ],
    },
    {
      id: "dead-pixel",
      title: "4. ตรวจจุดเสีย (Dead / Stuck Pixel)",
      description: "วนสีพื้นหลังเต็มจอพร้อมแว่นขยาย (Magnifier 4x-8x) และกดมาร์กนับตำแหน่งจุดเสีย",
      controlsHint: "คลิก/แตะเปลี่ยนสี | ปุ่ม M เปิดแว่นขยาย | H ซ่อน HUD | Esc กลับเมนู",
      usesTouchDirectly: false,
      accentColor: "#fbbf24",
      subPages: ["พื้นดำสนิท", "พื้นขาวสว่าง", "พื้นสีแดง", "พื้นสีเขียว", "พื้นสีน้ำเงิน"],
    },
    {
      id: "light-bleed",
      title: "5. แสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)",
      description: "จอดำสนิท เทาเข้มปรับละเอียดทีละ 1/255 และตาราง 3×3 / 5×5 เทียบความสม่ำเสมอของแสง",
      controlsHint: "ปุ่ม ← / → เปลี่ยนโหมด | +/- ปรับระดับสีเทา | H ซ่อน HUD | Esc กลับเมนู",
      usesTouchDirectly: false,
      accentColor: "#a78bfa",
      subPages: [
        "ดำสนิท (RGB 0,0,0)",
        "เทาเข้ม 5% - 20% (ตรวจ Clouding)",
        "เทากลาง 50% (ตรวจ Mura)",
        "ขาวสว่างเต็มจอ (ตรวจ Vignette)",
        "ตารางเทียบโซน 3×3 และ 5×5",
      ],
    },
    {
      id: "touch-axis",
      title: "6. เช็คทิศทางและแกนสัมผัส (Touch Axis / Orientation)",
      description: "แตะเป้า 4 มุมเพื่อวิเคราะห์ว่าแกน X/Y ปกติ กลับด้าน หรือสลับแกน พร้อมโหมดลากเส้นทแยงมุม",
      controlsHint: "แตะเป้าตามลำดับ 1 → 2 → 3 → 4 | กดค้างมุมซ้ายบน 1 วินาที หรือ Esc เพื่อกลับเมนู",
      usesTouchDirectly: true,
      accentColor: "#fb923c",
      subPages: ["แตะเป้า 4 มุมวิเคราะห์แกน", "ลากเส้นทดสอบทิศทาง"],
    },
    {
      id: "touch-latency",
      title: "7. วัดความหน่วงการสัมผัส (Touch-to-Paint Latency)",
      description: "วัดเวลาตั้งแต่รับสัญญาณนิ้วจนถึงเฟรมที่วาดขึ้นจอ แสดงค่าเฉลี่ย, P95, กราฟสด 200 ตัวอย่าง และ Frame Drop",
      controlsHint: "ลากนิ้วเป็นวงกลมต่อเนื่องบนจอ | กดค้างมุมซ้ายบน 1 วินาที หรือ Esc เพื่อกลับเมนู",
      usesTouchDirectly: true,
      accentColor: "#f87171",
      subPages: ["วัดความหน่วงขณะลากนิ้วต่อเนื่อง (Live Graph 200 Samples)"],
    },
  ];

  return specs.map((spec) => new PlaceholderTestModule(spec, onStatusChange));
}

