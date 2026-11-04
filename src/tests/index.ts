import type { TestModule } from "../core/types";
import { ImageQualityTestModule } from "./image-quality";
import { ColorTestModule } from "./color";
import { createPlaceholderModules } from "./placeholder";

/**
 * สร้างรายการโมดูลทดสอบทั้งหมด 7 หัวข้อ
 * โดยหัวข้อที่พัฒนาแล้ว (เช่น ImageQualityTestModule, ColorTestModule) จะใช้ตัวจริง
 * ส่วนหัวข้อที่เหลือจะใช้ Placeholder เพื่อให้ระบบทั้งหมดยังคงทำงานได้สมบูรณ์
 */
export function getAllTestModules(
  onStatusChange?: (status: string) => void
): TestModule[] {
  const placeholders = createPlaceholderModules(onStatusChange);

  const imageQualityModule = new ImageQualityTestModule(onStatusChange);
  const colorModule = new ColorTestModule(onStatusChange);

  // เรียงลำดับตาม 7 หัวข้อมาตรฐาน
  const multiTouchPlaceholder = placeholders.find((m) => m.id === "multi-touch")!;
  const deadPixelPlaceholder = placeholders.find((m) => m.id === "dead-pixel")!;
  const lightBleedPlaceholder = placeholders.find((m) => m.id === "light-bleed")!;
  const touchAxisPlaceholder = placeholders.find((m) => m.id === "touch-axis")!;
  const touchLatencyPlaceholder = placeholders.find((m) => m.id === "touch-latency")!;

  return [
    imageQualityModule,      // 1. Image Quality (Real)
    multiTouchPlaceholder,   // 2. Multi-touch (Placeholder)
    colorModule,             // 3. Color (Real)
    deadPixelPlaceholder,    // 4. Dead Pixel (Placeholder)
    lightBleedPlaceholder,   // 5. Light Bleed (Placeholder)
    touchAxisPlaceholder,    // 6. Touch Axis (Placeholder)
    touchLatencyPlaceholder, // 7. Touch Latency (Placeholder)
  ];
}

