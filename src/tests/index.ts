import type { TestModule } from "../core/types";
import { ImageQualityTestModule } from "./image-quality";
import { MultiTouchTestModule } from "./multi-touch";
import { ColorTestModule } from "./color";
import { DeadPixelTestModule } from "./dead-pixel";
import { LightBleedTestModule } from "./light-bleed";
import { TouchAxisTestModule } from "./touch-axis";
import { createPlaceholderModules } from "./placeholder";

/**
 * สร้างรายการโมดูลทดสอบทั้งหมด 7 หัวข้อ
 * โดยหัวข้อที่พัฒนาแล้ว (เช่น ImageQuality, MultiTouch, Color, DeadPixel, LightBleed, TouchAxis) จะใช้ตัวจริง
 * ส่วนหัวข้อที่เหลือจะใช้ Placeholder เพื่อให้ระบบทั้งหมดยังคงทำงานได้สมบูรณ์
 */
export function getAllTestModules(
  onStatusChange?: (status: string) => void
): TestModule[] {
  const placeholders = createPlaceholderModules(onStatusChange);

  const imageQualityModule = new ImageQualityTestModule(onStatusChange);
  const multiTouchModule = new MultiTouchTestModule(onStatusChange);
  const colorModule = new ColorTestModule(onStatusChange);
  const deadPixelModule = new DeadPixelTestModule(onStatusChange);
  const lightBleedModule = new LightBleedTestModule(onStatusChange);
  const touchAxisModule = new TouchAxisTestModule(onStatusChange);

  // เรียงลำดับตาม 7 หัวข้อมาตรฐาน
  const touchLatencyPlaceholder = placeholders.find((m) => m.id === "touch-latency")!;

  return [
    imageQualityModule,      // 1. Image Quality (Real)
    multiTouchModule,        // 2. Multi-touch (Real)
    colorModule,             // 3. Color (Real)
    deadPixelModule,         // 4. Dead Pixel (Real)
    lightBleedModule,        // 5. Light Bleed (Real)
    touchAxisModule,         // 6. Touch Axis (Real)
    touchLatencyPlaceholder, // 7. Touch Latency (Placeholder)
  ];
}

