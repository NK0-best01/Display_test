import type { TestModule } from "../core/types";
import { ImageQualityTestModule } from "./image-quality";
import { createPlaceholderModules } from "./placeholder";

/**
 * สร้างรายการโมดูลทดสอบทั้งหมด 7 หัวข้อ
 * โดยหัวข้อที่พัฒนาแล้ว (เช่น ImageQualityTestModule) จะใช้ตัวจริง
 * ส่วนหัวข้อที่เหลือจะใช้ Placeholder เพื่อให้ระบบทั้งหมดยังคงทำงานได้สมบูรณ์
 */
export function getAllTestModules(
  onStatusChange?: (status: string) => void
): TestModule[] {
  const placeholders = createPlaceholderModules(onStatusChange);

  // แทนที่หัวข้อที่ 1 (image-quality) ด้วย ImageQualityTestModule ตัวจริง
  const imageQualityModule = new ImageQualityTestModule(onStatusChange);

  return [
    imageQualityModule,
    ...placeholders.filter((m) => m.id !== "image-quality"),
  ];
}

