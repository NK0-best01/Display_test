import type { TestModule, TestModuleId } from "../core/types";
import { syncCanvasPhysicalSize } from "../core/display-info";

interface PatternItem {
  id: string;
  name: string;
  guide: string;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => void;
}

export class ImageQualityTestModule implements TestModule {
  public readonly id: TestModuleId = "image-quality";
  public readonly title = "1. คุณภาพของภาพ (Image Quality)";
  public readonly description =
    "Grayscale ramp, Near-black/white, Gamma, เส้นคมชัด 1 พิกเซล, วงกลม Geometry และขอบจอ Overscan";
  public readonly controlsHint =
    "ลูกศร ← / → หรือแตะซ้าย/ขวา เพื่อเปลี่ยนภาพ | H ซ่อน HUD | Esc กลับเมนู";
  public readonly usesTouchDirectly = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentIndex = 0;
  private rafId: number | null = null;
  private pointerStartX: number | null = null;
  private pointerStartY: number | null = null;
  private onStatusChange?: (status: string) => void;

  private patterns: PatternItem[] = [];

  constructor(onStatusChange?: (status: string) => void) {
    this.onStatusChange = onStatusChange;
    this.initPatterns();
  }

  public start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentIndex = 0;
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
  }

  public onKey(e: KeyboardEvent): void {
    if (
      e.key === "ArrowRight" ||
      e.key === " " ||
      e.code === "Space" ||
      e.key === "PageDown"
    ) {
      e.preventDefault();
      this.nextPattern();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      this.prevPattern();
    } else if (e.key === "Home") {
      e.preventDefault();
      this.currentIndex = 0;
      this.emitStatus();
      this.scheduleDraw();
    } else if (e.key === "End") {
      e.preventDefault();
      this.currentIndex = this.patterns.length - 1;
      this.emitStatus();
      this.scheduleDraw();
    }
  }

  public onPointer(e: PointerEvent): void {
    if (e.type === "pointerdown") {
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
    } else if (e.type === "pointerup") {
      if (this.pointerStartX !== null) {
        const dx = e.clientX - this.pointerStartX;
        const dy = e.clientY - (this.pointerStartY ?? e.clientY);

        // หากปัดนิ้วในแนวนอนมากกว่า 40px
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) {
            this.nextPattern();
          } else {
            this.prevPattern();
          }
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          // หากเป็นการแตะ (Tap) สลับตามฝั่งจอ ซ้าย=ก่อนหน้า ขวา=ถัดไป
          if (e.clientX > window.innerWidth / 2) {
            this.nextPattern();
          } else {
            this.prevPattern();
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
    this.emitStatus();
    this.scheduleDraw();
  }

  public prevPattern(): void {
    this.currentIndex =
      (this.currentIndex - 1 + this.patterns.length) % this.patterns.length;
    this.emitStatus();
    this.scheduleDraw();
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getPatternCount(): number {
    return this.patterns.length;
  }

  private emitStatus(): void {
    const cur = this.patterns[this.currentIndex];
    if (cur) {
      this.onStatusChange?.(
        `${this.currentIndex + 1}/${this.patterns.length}: ${cur.name} — ${cur.guide}`
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
  }

  // -------------------------------------------------------------
  // ชุดภาพทดสอบทั้ง 7 แบบสำหรับ Image Quality
  // -------------------------------------------------------------
  private initPatterns(): void {
    this.patterns = [
      // 1. Grayscale Ramp ต่อเนื่อง (Continuous Ramp)
      {
        id: "ramp-smooth",
        name: "Grayscale Ramp ต่อเนื่อง (Smooth Ramp)",
        guide: "ตรวจ Banding การไล่เฉดสีเทา ต้องเนียนเรียบ ไม่มีเส้นแถบกระโดด",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);

          const margin = Math.round(40 * dpr);
          const topBandH = Math.round((h - margin * 3) * 0.65);
          const bottomBandH = Math.round((h - margin * 3) * 0.35);

          // แถบไล่เฉดแนวนอนจาก 0 -> 255
          const grad = ctx.createLinearGradient(margin, 0, w - margin, 0);
          grad.addColorStop(0, "rgb(0,0,0)");
          grad.addColorStop(1, "rgb(255,255,255)");
          ctx.fillStyle = grad;
          ctx.fillRect(margin, margin, w - margin * 2, topBandH);

          // แถบย้อนกลับ 255 -> 0 ด้านล่างเพื่อเทียบ
          const gradRev = ctx.createLinearGradient(margin, 0, w - margin, 0);
          gradRev.addColorStop(0, "rgb(255,255,255)");
          gradRev.addColorStop(1, "rgb(0,0,0)");
          ctx.fillStyle = gradRev;
          ctx.fillRect(margin, margin * 2 + topBandH, w - margin * 2, bottomBandH);

          // ขอบบาง 1px ล้อมกรอบแถบ
          ctx.strokeStyle = "#404040";
          ctx.lineWidth = 1;
          ctx.strokeRect(margin, margin, w - margin * 2, topBandH);
          ctx.strokeRect(margin, margin * 2 + topBandH, w - margin * 2, bottomBandH);
        },
      },

      // 2. Stepped Grayscale Ramp (16 และ 32 ระดับ)
      {
        id: "ramp-stepped",
        name: "Grayscale ขั้นบันได 16 และ 32 ระดับ",
        guide: "ตรวจการแยกแยะระดับสีเทา แถบบน 16 ระดับ แถบล่าง 32 ระดับ ต้องเห็นรอยต่อชัดเจนทุกขั้น",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, w, h);

          const marginX = Math.round(30 * dpr);
          const marginY = Math.round(40 * dpr);
          const availableW = w - marginX * 2;
          const bandH = Math.floor((h - marginY * 3) / 2);

          // แถบบน: 16 ระดับ (0 ถึง 15)
          const steps16 = 16;
          const stepW16 = availableW / steps16;
          for (let i = 0; i < steps16; i++) {
            const val = Math.round((i / (steps16 - 1)) * 255);
            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(
              Math.floor(marginX + i * stepW16),
              marginY,
              Math.ceil(stepW16),
              bandH
            );
          }

          // แถบล่าง: 32 ระดับ (0 ถึง 31)
          const steps32 = 32;
          const stepW32 = availableW / steps32;
          const bottomY = marginY * 2 + bandH;
          for (let i = 0; i < steps32; i++) {
            const val = Math.round((i / (steps32 - 1)) * 255);
            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(
              Math.floor(marginX + i * stepW32),
              bottomY,
              Math.ceil(stepW32),
              bandH
            );
          }

          // ล้อมกรอบ
          ctx.strokeStyle = "#525252";
          ctx.lineWidth = 1;
          ctx.strokeRect(marginX, marginY, availableW, bandH);
          ctx.strokeRect(marginX, bottomY, availableW, bandH);

          // ป้ายกำกับ
          ctx.fillStyle = "#a3a3a3";
          ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText("16 ระดับ (0 → 255)", marginX, marginY - Math.round(10 * dpr));
          ctx.fillText("32 ระดับ (0 → 255)", marginX, bottomY - Math.round(10 * dpr));
        },
      },

      // 3. Near-Black & Near-White (0-15 และ 240-255)
      {
        id: "near-black-white",
        name: "Near-Black & Near-White (ตรวจ Black/White Clipping)",
        guide: "ฝั่งซ้ายพื้นดำตรวจส่วนมืด (ระดับ 0-15) ฝั่งขวาพื้นขาวตรวจส่วนสว่าง (ระดับ 240-255)",
        draw: (ctx, w, h, dpr) => {
          const halfW = Math.floor(w / 2);

          // ซีกซ้าย: พื้นดำสนิท RGB(0,0,0)
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, halfW, h);

          // ซีกขวา: พื้นขาวสนิท RGB(255,255,255)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(halfW, 0, w - halfW, h);

          // วาดบล็อก 16 ช่อง (4x4) ในแต่ละฝั่ง
          const cols = 4;
          const rows = 4;
          const boxSize = Math.min(
            Math.floor((halfW - Math.round(60 * dpr)) / cols),
            Math.floor((h - Math.round(100 * dpr)) / rows)
          );
          const pad = Math.round(8 * dpr);
          const startY = Math.floor((h - (rows * boxSize + (rows - 1) * pad)) / 2);

          const fontSize = Math.max(10, Math.round(11 * dpr));
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // ซีกซ้าย: Near-black (ค่า 0 ถึง 15)
          const leftStartX = Math.floor(
            (halfW - (cols * boxSize + (cols - 1) * pad)) / 2
          );
          for (let i = 0; i < 16; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = leftStartX + col * (boxSize + pad);
            const by = startY + row * (boxSize + pad);

            ctx.fillStyle = `rgb(${i},${i},${i})`;
            ctx.fillRect(bx, by, boxSize, boxSize);

            // ขอบบางเพื่อแยกช่อง
            ctx.strokeStyle = "#262626";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, boxSize, boxSize);

            ctx.fillStyle = i < 8 ? "#737373" : "#000000";
            ctx.fillText(`${i}`, bx + boxSize / 2, by + boxSize / 2);
          }

          // ซีกขวา: Near-white (ค่า 240 ถึง 255)
          const rightStartX =
            halfW +
            Math.floor((halfW - (cols * boxSize + (cols - 1) * pad)) / 2);
          for (let i = 0; i < 16; i++) {
            const val = 240 + i;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = rightStartX + col * (boxSize + pad);
            const by = startY + row * (boxSize + pad);

            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(bx, by, boxSize, boxSize);

            ctx.strokeStyle = "#d4d4d4";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, boxSize, boxSize);

            ctx.fillStyle = val > 248 ? "#a3a3a3" : "#ffffff";
            ctx.fillText(`${val}`, bx + boxSize / 2, by + boxSize / 2);
          }

          // ป้ายบอกฝั่ง
          const headerFont = Math.round(14 * dpr);
          ctx.font = `bold ${headerFont}px sans-serif`;
          ctx.fillStyle = "#737373";
          ctx.fillText("Near-Black (0 → 15)", halfW / 2, startY - Math.round(25 * dpr));
          ctx.fillStyle = "#525252";
          ctx.fillText(
            "Near-White (240 → 255)",
            halfW + halfW / 2,
            startY - Math.round(25 * dpr)
          );
        },
      },

      // 4. Gamma Pattern (เทียบเส้น 1px ขาวดำ กับเทา 50%)
      {
        id: "gamma-calibration",
        name: "Gamma Calibration Pattern (เทียบเส้น 1px กับค่าเทา)",
        guide: "มองจากระยะห่าง 1-2 เมตร แถบที่มีค่า Gamma ตรงกับจอจะกลืนเป็นเนื้อเดียวกับเส้นสลับ 1px",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#171717";
          ctx.fillRect(0, 0, w, h);

          const blockW = Math.min(Math.floor(w * 0.75), Math.round(640 * dpr));
          const blockH = Math.min(Math.floor(h * 0.7), Math.round(400 * dpr));
          const startX = Math.floor((w - blockW) / 2);
          const startY = Math.floor((h - blockH) / 2);

          // พื้นหลังของบล็อก: ลายเส้นขาวดำสลับทีละ 1 พิกเซลจริง (1px black, 1px white)
          // 50% luminance ทางกายภาพ
          const imgData = ctx.createImageData(blockW, blockH);
          const data = imgData.data;
          for (let y = 0; y < blockH; y++) {
            const isWhite = y % 2 === 0;
            const c = isWhite ? 255 : 0;
            for (let x = 0; x < blockW; x++) {
              const idx = (y * blockW + x) * 4;
              data[idx] = c;
              data[idx + 1] = c;
              data[idx + 2] = c;
              data[idx + 3] = 255;
            }
          }
          ctx.putImageData(imgData, startX, startY);

          // แทรกกล่องสีเทาทึบค่า Gamma ต่าง ๆ (1.8, 2.0, 2.2, 2.4, 2.6)
          // คำนวณค่า sRGB byte: Math.round(255 * Math.pow(0.5, 1 / gamma))
          const gammas = [
            { label: "γ 1.8", g: 1.8, val: Math.round(255 * Math.pow(0.5, 1 / 1.8)) }, // ~174
            { label: "γ 2.0", g: 2.0, val: Math.round(255 * Math.pow(0.5, 1 / 2.0)) }, // ~180
            { label: "γ 2.2 (Std)", g: 2.2, val: Math.round(255 * Math.pow(0.5, 1 / 2.2)) }, // ~186
            { label: "γ 2.4", g: 2.4, val: Math.round(255 * Math.pow(0.5, 1 / 2.4)) }, // ~191
            { label: "γ 2.6", g: 2.6, val: Math.round(255 * Math.pow(0.5, 1 / 2.6)) }, // ~195
          ];

          const patchCount = gammas.length;
          const patchW = Math.floor(blockW / (patchCount + 1));
          const patchH = Math.floor(blockH * 0.45);
          const patchY = startY + Math.floor((blockH - patchH) / 2);
          const gap = Math.floor((blockW - patchW * patchCount) / (patchCount + 1));

          const labelFont = Math.max(10, Math.round(12 * dpr));
          ctx.font = `bold ${labelFont}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          gammas.forEach((item, i) => {
            const px = startX + gap + i * (patchW + gap);
            ctx.fillStyle = `rgb(${item.val},${item.val},${item.val})`;
            ctx.fillRect(px, patchY, patchW, patchH);

            // ขอบบาง
            ctx.strokeStyle = "#404040";
            ctx.lineWidth = 1;
            ctx.strokeRect(px, patchY, patchW, patchH);

            // ป้ายบอกค่า
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px, patchY + patchH - Math.round(24 * dpr), patchW, Math.round(24 * dpr));
            ctx.fillStyle = "#000000";
            ctx.fillText(
              item.label,
              px + patchW / 2,
              patchY + patchH - Math.round(12 * dpr)
            );
          });

          // ขอบรอบ block
          ctx.strokeStyle = "#525252";
          ctx.lineWidth = 2;
          ctx.strokeRect(startX, startY, blockW, blockH);
        },
      },

      // 5. Sharpness: เส้น 1px, ตารางหมากรุก 1px, Micro-text
      {
        id: "sharpness-1px",
        name: "Sharpness & Pixel-Perfect 1px Test",
        guide: "เส้น 1px และตารางหมากรุกต้องคมกริบ ไม่เบลอ ไม่เกิดริ้ว Moiré และข้อความขนาดเล็กอ่านออก",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);

          const margin = Math.round(24 * dpr);
          const halfW = Math.floor((w - margin * 3) / 2);
          const halfH = Math.floor((h - margin * 3) / 2);

          // ช่อง 1 (บนซ้าย): เส้น 1px แนวนอนสลับขาวดำ
          const x1 = margin;
          const y1 = margin;
          const imgH = ctx.createImageData(halfW, halfH);
          const dH = imgH.data;
          for (let y = 0; y < halfH; y++) {
            const c = y % 2 === 0 ? 255 : 0;
            for (let x = 0; x < halfW; x++) {
              const idx = (y * halfW + x) * 4;
              dH[idx] = c;
              dH[idx + 1] = c;
              dH[idx + 2] = c;
              dH[idx + 3] = 255;
            }
          }
          ctx.putImageData(imgH, x1, y1);

          // ช่อง 2 (บนขวา): เส้น 1px แนวตั้งสลับขาวดำ
          const x2 = margin * 2 + halfW;
          const y2 = margin;
          const imgV = ctx.createImageData(halfW, halfH);
          const dV = imgV.data;
          for (let y = 0; y < halfH; y++) {
            for (let x = 0; x < halfW; x++) {
              const c = x % 2 === 0 ? 255 : 0;
              const idx = (y * halfW + x) * 4;
              dV[idx] = c;
              dV[idx + 1] = c;
              dV[idx + 2] = c;
              dV[idx + 3] = 255;
            }
          }
          ctx.putImageData(imgV, x2, y2);

          // ช่อง 3 (ล่างซ้าย): ตารางหมากรุก 1 พิกเซล (1x1 Checkerboard)
          const x3 = margin;
          const y3 = margin * 2 + halfH;
          const imgC = ctx.createImageData(halfW, halfH);
          const dC = imgC.data;
          for (let y = 0; y < halfH; y++) {
            for (let x = 0; x < halfW; x++) {
              const c = (x + y) % 2 === 0 ? 255 : 0;
              const idx = (y * halfW + x) * 4;
              dC[idx] = c;
              dC[idx + 1] = c;
              dC[idx + 2] = c;
              dC[idx + 3] = 255;
            }
          }
          ctx.putImageData(imgC, x3, y3);

          // ช่อง 4 (ล่างขวา): Micro-Text ความคมชัดตัวหนังสือขนาดเล็ก
          const x4 = margin * 2 + halfW;
          const y4 = margin * 2 + halfH;
          ctx.fillStyle = "#111111";
          ctx.fillRect(x4, y4, halfW, halfH);

          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";

          const sampleTexts = [
            { size: Math.max(7, Math.round(7 * dpr)), text: "7px: จอภาพคุณภาพสูง Display Sharpness Test 1234567890" },
            { size: Math.max(8, Math.round(8 * dpr)), text: "8px: จอภาพคุณภาพสูง Display Sharpness Test 1234567890" },
            { size: Math.max(9, Math.round(9 * dpr)), text: "9px: จอภาพคุณภาพสูง Display Sharpness Test 1234567890" },
            { size: Math.max(10, Math.round(10 * dpr)), text: "10px: The quick brown fox jumps over the lazy dog" },
            { size: Math.max(12, Math.round(12 * dpr)), text: "12px: ทดสอบความคมชัดตัวหนังสือภาษาไทยและอังกฤษ" },
            { size: Math.max(14, Math.round(14 * dpr)), text: "14px: Resolution & Pixel-Perfect Micro-text" },
            { size: Math.max(16, Math.round(16 * dpr)), text: "16px: ระบบทดสอบจอภาพ (Display Tester)" },
          ];

          let textY = y4 + Math.round(15 * dpr);
          for (const item of sampleTexts) {
            ctx.font = `${item.size}px monospace, sans-serif`;
            ctx.fillText(item.text, x4 + Math.round(15 * dpr), textY);
            textY += item.size + Math.round(8 * dpr);
            if (textY > y4 + halfH - Math.round(20 * dpr)) break;
          }

          // ป้ายและกรอบของทั้ง 4 ช่อง
          const drawFrame = (x: number, y: number, label: string) => {
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, halfW, halfH);
            ctx.fillStyle = "rgba(0,0,0,0.85)";
            ctx.fillRect(x + 4, y + 4, Math.round(190 * dpr), Math.round(22 * dpr));
            ctx.fillStyle = "#38bdf8";
            ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
            ctx.fillText(label, x + 8, y + 8);
          };

          drawFrame(x1, y1, "เส้นแนวนอน 1px (1px H-Lines)");
          drawFrame(x2, y2, "เส้นแนวตั้ง 1px (1px V-Lines)");
          drawFrame(x3, y3, "ตารางหมากรุก 1px (1x1 Checker)");
          drawFrame(x4, y4, "ความคมชัดตัวอักษร (Micro-Text)");
        },
      },

      // 6. Geometry: ตาราง Grid และวงกลมสัดส่วน 1:1
      {
        id: "geometry-aspect",
        name: "Geometry & Aspect Ratio (ตารางและวงกลม 1:1)",
        guide: "วงกลมต้องกลมสมบูรณ์ ไม่แบนหรือยืดรี และช่องตารางสี่เหลี่ยมต้องเป็นจัตุรัสเท่ากันทุกช่อง",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, w, h);

          // ตาราง Grid ทุก ๆ 50px หรือปรับตามขนาดจอ
          const gridSize = Math.round(50 * dpr);
          ctx.strokeStyle = "#1f2937";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x <= w; x += gridSize) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
          }
          for (let y = 0; y <= h; y += gridSize) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
          }
          ctx.stroke();

          // เส้นทแยงมุมหลัก (Diagonal X)
          ctx.strokeStyle = "#374151";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(w, h);
          ctx.moveTo(w, 0);
          ctx.lineTo(0, h);
          ctx.stroke();

          // เส้นกึ่งกลางจอแนวนอนและแนวตั้ง
          const cx = Math.floor(w / 2);
          const cy = Math.floor(h / 2);
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = Math.max(1, Math.round(1.5 * dpr));
          ctx.beginPath();
          ctx.moveTo(cx + 0.5, 0);
          ctx.lineTo(cx + 0.5, h);
          ctx.moveTo(0, cy + 0.5);
          ctx.lineTo(w, cy + 0.5);
          ctx.stroke();

          // วงกลมกลางจอ (รัศมี 20%, 35%, 45% ของความสูงจอ)
          const baseRadius = Math.min(cx, cy);
          const radii = [
            baseRadius * 0.3,
            baseRadius * 0.6,
            baseRadius * 0.85,
          ];

          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
          for (const r of radii) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // วงกลม 4 มุมจอ เพื่อตรวจการบิดเบี้ยวที่ขอบจอ
          const cornerR = baseRadius * 0.22;
          const cornerOffset = Math.round(80 * dpr);
          const corners = [
            { x: cornerOffset, y: cornerOffset },
            { x: w - cornerOffset, y: cornerOffset },
            { x: cornerOffset, y: h - cornerOffset },
            { x: w - cornerOffset, y: h - cornerOffset },
          ];

          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = Math.max(1.5, Math.round(1.5 * dpr));
          for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, cornerR, 0, Math.PI * 2);
            ctx.stroke();
          }

          // ข้อความกลางจอ
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(14 * dpr)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`สัดส่วนพิกเซล 1:1 (${w} × ${h} px)`, cx, cy - Math.round(18 * dpr));
          ctx.fillStyle = "#9ca3af";
          ctx.font = `${Math.round(12 * dpr)}px monospace`;
          ctx.fillText(`Grid Size: ${gridSize}px (Physical)`, cx, cy + Math.round(18 * dpr));
        },
      },

      // 7. Overscan & Edge: กรอบเส้น 1px ขอบสุดและเปอร์เซ็นต์ขอบจอ
      {
        id: "overscan-edge",
        name: "Overscan & Edge Framing (ตรวจขอบจอถูกตัด)",
        guide: "กรอบเส้นสีเขียวที่ขอบสุดของจอ (0px) ต้องมองเห็นครบทั้ง 4 ด้าน และไม่ถูกขอบจอหรือเคสบดบัง",
        draw: (ctx, w, h, dpr) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);

          // 1. เส้นขอบสุด 1 พิกเซลรอบจอ สีเขียวสว่าง (Edge 0px)
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 1;
          ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

          // 2. เส้นถัดเข้ามา 1 พิกเซล สีแดง (Edge 1px)
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1;
          ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

          // 3. เส้นขอบ 1%, 2%, 3%, 5% จากขอบ
          const percentages = [
            { pct: 0.01, color: "#38bdf8", label: "1%" },
            { pct: 0.02, color: "#a855f7", label: "2%" },
            { pct: 0.03, color: "#eab308", label: "3%" },
            { pct: 0.05, color: "#f97316", label: "5%" },
          ];

          ctx.lineWidth = 1;
          for (const item of percentages) {
            const ox = Math.round(w * item.pct);
            const oy = Math.round(h * item.pct);
            ctx.strokeStyle = item.color;
            ctx.strokeRect(ox + 0.5, oy + 0.5, w - ox * 2, h - oy * 2);

            // ป้ายบอก % ที่ขอบด้านบน
            ctx.fillStyle = item.color;
            ctx.font = `${Math.round(11 * dpr)}px monospace`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(item.label, ox + 4, oy + 4);
          }

          // ลูกศรชี้ขอบทั้ง 4 ทิศ (บน, ล่าง, ซ้าย, ขวา)
          const arrowSize = Math.round(20 * dpr);
          const cx = Math.floor(w / 2);
          const cy = Math.floor(h / 2);

          ctx.fillStyle = "#22c55e";
          // บน
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx - arrowSize, arrowSize * 1.5);
          ctx.lineTo(cx + arrowSize, arrowSize * 1.5);
          ctx.closePath();
          ctx.fill();

          // ล่าง
          ctx.beginPath();
          ctx.moveTo(cx, h);
          ctx.lineTo(cx - arrowSize, h - arrowSize * 1.5);
          ctx.lineTo(cx + arrowSize, h - arrowSize * 1.5);
          ctx.closePath();
          ctx.fill();

          // ซ้าย
          ctx.beginPath();
          ctx.moveTo(0, cy);
          ctx.lineTo(arrowSize * 1.5, cy - arrowSize);
          ctx.lineTo(arrowSize * 1.5, cy + arrowSize);
          ctx.closePath();
          ctx.fill();

          // ขวา
          ctx.beginPath();
          ctx.moveTo(w, cy);
          ctx.lineTo(w - arrowSize * 1.5, cy - arrowSize);
          ctx.lineTo(w - arrowSize * 1.5, cy + arrowSize);
          ctx.closePath();
          ctx.fill();

          // สรุปตรงกลาง
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(16 * dpr)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("การทดสอบ Overscan (ขอบพิกเซลจริง)", cx, cy - Math.round(16 * dpr));
          ctx.fillStyle = "#22c55e";
          ctx.font = `${Math.round(13 * dpr)}px sans-serif`;
          ctx.fillText("เส้นสีเขียว = ขอบสุด 0px | เส้นสีแดง = 1px", cx, cy + Math.round(14 * dpr));
        },
      },
    ];
  }
}
