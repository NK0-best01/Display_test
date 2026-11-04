import type { TestModule } from "../core/types";
import { ImageQualityTestModule } from "./image-quality";
import { MultiTouchTestModule } from "./multi-touch";
import { ColorTestModule } from "./color";
import { DeadPixelTestModule } from "./dead-pixel";
import { LightBleedTestModule } from "./light-bleed";
import { TouchAxisTestModule } from "./touch-axis";
import { TouchLatencyTestModule } from "./touch-latency";
import { VideoTestModule } from "./video";

/**
 * สร้างรายการโมดูลทดสอบทั้งหมด 8 หัวข้อจริงครบถ้วนตามแผนงาน v2
 */
export function getAllTestModules(
  onStatusChange?: (status: string) => void
): TestModule[] {
  const imageQualityModule = new ImageQualityTestModule(onStatusChange);
  const multiTouchModule = new MultiTouchTestModule(onStatusChange);
  const colorModule = new ColorTestModule(onStatusChange);
  const deadPixelModule = new DeadPixelTestModule(onStatusChange);
  const lightBleedModule = new LightBleedTestModule(onStatusChange);
  const touchAxisModule = new TouchAxisTestModule(onStatusChange);
  const touchLatencyModule = new TouchLatencyTestModule(onStatusChange);
  const videoModule = new VideoTestModule(onStatusChange);

  // เรียงลำดับตาม 8 หัวข้อมาตรฐาน
  return [
    imageQualityModule, // 1. Image Quality (Real)
    multiTouchModule,   // 2. Multi-touch (Real)
    colorModule,        // 3. Color (Real)
    deadPixelModule,    // 4. Dead Pixel (Real)
    lightBleedModule,   // 5. Light Bleed (Real)
    touchAxisModule,    // 6. Touch Axis (Real)
    touchLatencyModule, // 7. Touch Latency (Real)
    videoModule,        // 8. Video (Real)
  ];
}
