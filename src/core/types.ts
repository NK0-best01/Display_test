export type TestModuleId =
  | "image-quality"
  | "multi-touch"
  | "color"
  | "dead-pixel"
  | "light-bleed"
  | "touch-axis"
  | "touch-latency"
  | "video";

export type PointerAction = "down" | "move" | "up" | "cancel";

/**
 * อินเทอร์เฟซมาตรฐานสำหรับทุกโมดูลทดสอบ (ตามหัวข้อ 3 ในแผน)
 */
export interface TestModule {
  /** รหัสอ้างอิงโมดูล */
  readonly id: TestModuleId;
  /** ชื่อภาษาไทยสำหรับแสดงบนเมนูและ HUD */
  readonly title: string;
  /** คำอธิบายสั้นสำหรับแสดงบนการ์ดในเมนูหลัก */
  readonly description: string;
  /** คำแนะนำการใช้งาน/ปุ่มลัดสำหรับแสดงใน HUD */
  readonly controlsHint: string;
  /** โมดูลนี้ใช้การทัชเป็นตัวทดสอบโดยตรงหรือไม่ (ถ้า true จะปิดการปัดซ้าย/ขวาเพื่อเปลี่ยนภาพของระบบกลาง) */
  readonly usesTouchDirectly?: boolean;

  /** เริ่มการทำงานของโมดูล วาดลง canvas ที่กำหนด */
  start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
  /** หยุดการทำงาน ล้าง timer, listener และ requestAnimationFrame ทั้งหมด */
  stop(): void;
  /** รับเหตุการณ์คีย์บอร์ดเมื่ออยู่ในหน้าทดสอบนี้ */
  onKey(e: KeyboardEvent): void;
  /** รับเหตุการณ์ Pointer (เมาส์ / ทัช) เมื่ออยู่ในหน้าทดสอบนี้ */
  onPointer(e: PointerEvent): void;
  /** รับการแจ้งเตือนเมื่อขนาดหน้าจอเปลี่ยน (optional) */
  onResize?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
}
