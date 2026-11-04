# บันทึกการทำงาน (Work Log) — โปรเจกต์ระบบทดสอบจอภาพ (Display Tester)

เอกสารนี้เก็บประวัติและรายละเอียดการทำงานในแต่ละ Part ตามแผน [display-tester-plan.md](file:///d:/Ai/โปรเจค_roboq/display_test/plan/display-tester-plan.md)

---

## โครงสร้าง Git Branch ที่ตกลงกับผู้ใช้

- รีโมท: `https://github.com/NK0-best01/Display_test.git`
- `main`: สาขาหลักเริ่มต้น
- `dev`: สาขาพัฒนารวม (แตกจาก `main`)
- สาขาฟีเจอร์ราย Part (แตกจาก `dev` และ merge กลับเข้า `dev` เมื่อผ่านการตรวจรับแต่ละ Part):
  - `feat/part-1-scaffold` — Part 1: สร้างโปรเจกต์และโครงแอป (Scaffold)
  - `feat/part-2-app-shell` — Part 2: โครงหลักของแอป (App Shell)
  - `feat/part-3-image-quality` — Part 3: ทดสอบคุณภาพของภาพ (Image Quality)
  - `feat/part-4-color` — Part 4: ทดสอบสี (Color)
  - `feat/part-5-dead-pixel` — Part 5: ทดสอบ Dead Pixel / Stuck Pixel
  - `feat/part-6-light-bleed` — Part 6: ทดสอบแสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)
  - `feat/part-7-multi-touch` — Part 7: ทดสอบ Touch (Multi-touch)
  - `feat/part-8-touch-axis` — Part 8: เช็คทิศทาง Touch (Axis / Orientation)
  - `feat/part-9-touch-latency` — Part 9: วัด Touch-to-Paint Latency
  - `feat/part-10-polish-package` — Part 10: ขัดเกลา ตรวจสอบ และแพ็กเกจ

---

## Part 1: สร้างโปรเจกต์และโครงแอป (Scaffold)
- **สถานะ**: เสร็จสมบูรณ์ (Merged เข้า `dev` แล้ว)
- **Branch**: `feat/part-1-scaffold`
- **สิ่งที่ดำเนินการ**:
  1. สร้างโครงสร้างโปรเจกต์ **Tauri v2** (`src-tauri/`) คู่กับ **Vite + Vanilla TypeScript** (`src/`)
  2. ตั้งค่า [tauri.conf.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/tauri.conf.json) ให้เปิดแบบเต็มจอ (`fullscreen: true`), ปิดขอบหน้าต่าง (`decorations: false`), และปรับขนาดได้ (`resizable: true`)
  3. เพิ่มไฟล์ตั้งค่าสำหรับโหมดหน้าต่างพัฒนา [tauri.dev-window.conf.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/tauri.dev-window.conf.json) (`npm run tauri:dev:window`) สำหรับการพัฒนาและทดสอบ Responsive บนจอขนาดใหญ่
  4. ติดตั้งและตั้งค่า **Tailwind CSS v3.4** ([tailwind.config.js](file:///d:/Ai/โปรเจค_roboq/display_test/tailwind.config.js), [postcss.config.js](file:///d:/Ai/โปรเจค_roboq/display_test/postcss.config.js), [style.css](file:///d:/Ai/โปรเจค_roboq/display_test/src/style.css)) พร้อมคลาส `.touch-btn` ขนาดไม่ต่ำกว่า `64x64 px` และคลาส `.test-canvas` ที่บังคับปิด filter, backdrop-blur, shadow, opacity และ transition
  5. ตั้งค่า Capabilities ใน [default.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/capabilities/default.json) ให้สามารถเรียกใช้ `setFullscreen`, `isFullscreen`, `currentMonitor`, `availableMonitors` และอ่านค่า `scaleFactor` ได้
  6. สร้างโมดูล [fullscreen.ts](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/fullscreen.ts) รองรับปุ่มลัด `F11` (สลับ Fullscreen), `Esc` (ออกจาก Fullscreen) และปิด Context Menu / การลากเลือกข้อความ / Pinch Zoom
  7. เขียนเอกสาร [README.md](file:///d:/Ai/โปรเจค_roboq/display_test/README.md) อธิบายวิธีติดตั้ง Prerequisites บน Linux (`webkit2gtk-4.1`) และ Windows (C++ Build Tools, WebView2, Rust) พร้อมคำสั่งรันและ build

---

## Part 2: โครงหลักของแอป (App Shell)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-2-app-shell` (Push ไปที่ `origin/feat/part-2-app-shell` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. กำหนดอินเทอร์เฟซมาตรฐาน [`TestModule`](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/types.ts) มีเมธอด `start(canvas, ctx)`, `stop()`, `onKey(e)`, `onPointer(e)` และ `onResize(canvas, ctx)`
  2. สร้างตัวรวบรวมข้อมูลจอภาพและระบบ [`display-info.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/display-info.ts) แสดงความละเอียดจริง (Physical Resolution), `devicePixelRatio`, ชื่อ Monitor, `navigator.maxTouchPoints`, และ OS พร้อมฟังก์ชัน `syncCanvasPhysicalSize` ให้ `<canvas>` มีขนาดเท่าพิกเซลจริงเสมอ
  3. สร้างหน้าเมนูหลัก [`menu.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/ui/menu.ts) แสดงปุ่มขนาดใหญ่สำหรับทดสอบ 7 หัวข้อ + การ์ดข้อมูลจอภาพ (Info) ออกแบบให้ Responsive พอดีกับทั้งจอ 1024×768 (4:3) และจอขนาดใหญ่ รองรับทั้งเมาส์ ทัช และคีย์ลัดเลข `1`-`7`
  4. สร้างหน้าต่างข้อมูลระบบ [`info-modal.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/ui/info-modal.ts) แสดงรายละเอียดจอภาพและฮาร์ดแวร์ครบถ้วน
  5. สร้างระบบ HUD มุมจอ [`hud.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/hud.ts) แสดงชื่อหัวข้อทดสอบ สถานะย่อย และคำแนะนำปุ่มลัด ซ่อน/แสดงได้ด้วยปุ่ม `H` หรือ **การแตะสามนิ้วพร้อมกัน**
  6. สร้างระบบ Router [`router.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/router.ts) สลับระหว่างเมนูหลักกับหน้าทดสอบ รองรับการย้อนกลับเมนูด้วยปุ่ม `Esc` หรือ **การกดค้างมุมซ้ายบนของจอเป็นเวลา 1 วินาที** (มีแถบ Progress แสดงขณะกดค้าง) และล้าง Event Listener / `requestAnimationFrame` ทุกครั้งใน `teardownActiveTest()` + `stop()`
  7. สร้างโมดูลทดสอบจำลอง (Placeholder) ครบทั้ง 7 หัวข้อใน [`placeholder.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/placeholder.ts) เพื่อทดสอบการเข้า-ออกและการควบคุมทั้งหมด
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-COaluXhU.js` 50.52 kB)
  - ตรวจสอบเกณฑ์ตรวจรับ Part 1 & Part 2 อัตโนมัติ: **PASS ทั้งหมด 100%** (Listener ค้าง = 0, RAF ค้าง = 0)

---

## Part 3: ทดสอบคุณภาพของภาพ (Image Quality)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-3-image-quality` (Push ไปที่ `origin/feat/part-3-image-quality` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`image-quality.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/image-quality.ts) สำหรับหัวข้อ "คุณภาพของภาพ (Image Quality)"
  2. ออกแบบภาพทดสอบครบทั้ง 6 หมวดหลัก (7 รูปแบบย่อย) แบบ Pixel-Perfect:
     - **รูปแบบที่ 1 (Ramp Smooth)**: Grayscale ramp ต่อเนื่องแนวนอน 0-255 และแถบย้อนกลับ 255-0 เพื่อตรวจดู Banding
     - **รูปแบบที่ 2 (Ramp Stepped)**: Grayscale แบบขั้นบันได 16 ระดับ และ 32 ระดับ เพื่อตรวจการแยกแยะระดับสีเทา
     - **รูปแบบที่ 3 (Near-Black & Near-White)**: กล่องสี่เหลี่ยมระดับ 0-15 (พื้นดำ) และระดับ 240-255 (พื้นขาว) เพื่อตรวจ Dark clipping และ Highlight clipping
     - **รูปแบบที่ 4 (Gamma Calibration)**: ลายเส้นขาวดำสลับทีละ 1 พิกเซลจริง (1px black / 1px white ทางกายภาพ) เทียบกับบล็อกสีเทาทึบค่า Gamma ต่าง ๆ (1.8, 2.0, 2.2, 2.4, 2.6)
     - **รูปแบบที่ 5 (Sharpness 1px)**: เส้น 1px แนวนอน, เส้น 1px แนวตั้ง, ตารางหมากรุก 1x1 พิกเซล (วาดผ่าน `createImageData` แบบไม่ติด anti-aliasing) และบล็อกทดสอบ Micro-text ภาษาไทย/อังกฤษ (ขนาด 7px - 16px)
     - **รูปแบบที่ 6 (Geometry & Aspect Ratio)**: ตาราง Grid ละเอียดพร้อมวงกลมสมบูรณ์กลางจอ และวงกลม 4 มุมจอ สำหรับตรวจการบิดเบี้ยวและสัดส่วนพิกเซล 1:1
     - **รูปแบบที่ 7 (Overscan & Edge)**: กรอบเส้น 1px ที่ขอบสุดของจอ (เส้นสีเขียว 0px, เส้นสีแดง 1px), เส้นมาร์ก 1%, 2%, 3%, 5% จากขอบจอ และลูกศรชี้ขอบจอทั้ง 4 ทิศ เพื่อตรวจดูขอบจอถูกตัดทิ้ง
  3. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts) ให้หัวข้อที่ 1 ใช้งานคลาสจริง และหัวข้อที่เหลือยังคงเรียก Placeholder ได้อย่างราบรื่น
  4. รองรับการควบคุมสลับภาพทดสอบ:
     - คีย์บอร์ด: ลูกศร `←` / `→`, `Space`, `PageUp` / `PageDown`, `Home` (ภาพแรก), `End` (ภาพสุดท้าย)
     - สัมผัส / เมาส์: ปัดซ้าย/ขวา (Swipe > 40px) หรือแตะครึ่งซ้ายจอ (ย้อนกลับ) / แตะครึ่งขวาจอ (ถัดไป)
     - HUD แสดงลำดับภาพ ชื่อรูปแบบ และคำแนะนำว่าต้องสังเกตอะไรในแต่ละภาพ
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-mPDVtD-z.js` 64.59 kB)
  - รันชุดตรวจรับอัตโนมัติ Part 3: **PASS 100% ทุกหัวข้อ** (ทั้ง 7 รูปแบบ, Pixel-Perfect Image Data, การควบคุมคีย์บอร์ด/ทัช และจำลองการวาดบน scale 100%, 125%, 150%, 200%)

---

## Part 4: ทดสอบสี (Color)
- **สถานะ**: พัฒนาและทดสอบเสร็จสมบูรณ์ รอผู้ใช้ตรวจสอบและยืนยันก่อนอัปโหลดขึ้น GitHub
- **Branch**: `feat/part-4-color` (แตกสาขาจาก `feat/part-3-image-quality`)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`color.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/color.ts) สำหรับหัวข้อ "ทดสอบสี (Color Accuracy & Gradient)"
  2. ออกแบบภาพทดสอบครบทั้ง 5 หมวดหลักตามข้อกำหนด (รวมเป็น 12 รูปแบบย่อย):
     - **หมวดที่ 1 (สีเต็มจอ 8 สี)**:
       - 1. แดง (Red: #FF0000 / rgb(255, 0, 0))
       - 2. เขียว (Green: #00FF00 / rgb(0, 255, 0))
       - 3. น้ำเงิน (Blue: #0000FF / rgb(0, 0, 255))
       - 4. ขาว (White: #FFFFFF / rgb(255, 255, 255))
       - 5. ดำ (Black: #000000 / rgb(0, 0, 0))
       - 6. ฟ้าอมเขียว (Cyan: #00FFFF / rgb(0, 255, 255))
       - 7. ม่วงแดง (Magenta: #FF00FF / rgb(255, 0, 255))
       - 8. เหลือง (Yellow: #FFFF00 / rgb(255, 255, 0))
     - **หมวดที่ 2 (Color Bars)**:
       - 9. แถบสีมาตรฐาน SMPTE และ 8 Color Bars พร้อมแถบ Cast Bars และแท่ง PLUGE Pulses (-2%, 0%, +2% black)
     - **หมวดที่ 3 (Gradient แยกช่องสี & สีผสม)**:
       - 10. แถบ Gradient แยก 5 ชั้น: Red (0-255), Green (0-255), Blue (0-255), Cyan/Magenta/Yellow Blend และ Full Spectrum Rainbow
     - **หมวดที่ 4 (ช่องสีเทียบธรรมชาติ)**:
       - 11. ช่องสีเทียบอ้างอิง ColorChecker สำหรับดูด้วยสายตา: สีผิวคน 4 โทน (Fair, Medium/Tan, Deep Tan, Dark), สีท้องฟ้า/น้ำ 4 โทน, สีใบไม้/ดิน/หินธรรมชาติ 4 โทน
     - **หมวดที่ 5 (White & Gray Tint ตรวจสีเพี้ยน)**:
       - 12. แบ่ง 4 โซนบน-ล่าง: ขาวบริสุทธิ์ 100% (255), เทาสว่าง 75% (191), เทากลาง 50% (128), เทาเข้ม 25% (64)
  3. พัฒนาระบบ **Debug Color Inspector / Pixel Picker**:
     - กดปุ่ม `D` เพื่อเปิด/ปิดโหมดตรวจสี
     - ใช้ฟังก์ชัน `readPixelAt(x, y)` อ่านค่าพิกเซลตรงจาก Canvas ผ่าน `ctx.getImageData()`
     - แสดงการ์ดแสดงค่า HEX, RGB, พิกัดตำแหน่งพิกเซล และตัวอย่างสีจริงสด ๆ บนหน้าจอ
  4. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts) ให้หัวข้อที่ 1 และ 3 ทำงานด้วยคลาสจริง
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-CTdojBz5.js` 79.81 kB)
  - รันชุดตรวจรับอัตโนมัติ Part 4 (`scratch/verify-part4.mjs`): **PASS 100% ทุกรายการ**
    - ตรวจสอบค่าสีดิบ RGB ครบทุกสีตรงตามนิยาม 100% (Red, Green, Blue, White, Black, Cyan, Magenta, Yellow, 100%, 75%, 50%, 25% Gray)
    - ตรวจสอบระบบ `readPixelAt` ผ่าน `getImageData`
    - ตรวจสอบว่า Canvas ปลอดจาก filter, shadow, opacity, transition อย่างเด็ดขาด
