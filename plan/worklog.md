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
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-4-color` (Push ไปที่ `origin/feat/part-4-color` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`color.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/color.ts) สำหรับหัวข้อ "ทดสอบสี (Color Accuracy & Gradient)"
  2. ออกแบบภาพทดสอบครบทั้ง 5 หมวดหลักตามข้อกำหนด (รวมเป็น 12 รูปแบบย่อย):
     - **หมวดที่ 1 (สีเต็มจอ 8 สี)**: แดง (#FF0000), เขียว (#00FF00), น้ำเงิน (#0000FF), ขาว (#FFFFFF), ดำ (#000000), ฟ้าอมเขียว (#00FFFF), ม่วงแดง (#FF00FF), เหลือง (#FFFF00)
     - **หมวดที่ 2 (Color Bars)**: แถบสีมาตรฐาน SMPTE และ 8 Color Bars พร้อมแถบ Cast Bars และแท่ง PLUGE Pulses
     - **หมวดที่ 3 (Gradient แยกช่องสี & สีผสม)**: แถบ Gradient 5 ชั้น: Red, Green, Blue, Cyan/Magenta/Yellow Blend และ Full Spectrum Rainbow
     - **หมวดที่ 4 (ช่องสีเทียบธรรมชาติ)**: ช่องสีเทียบอ้างอิง ColorChecker สำหรับดูด้วยสายตา: สีผิวคน 4 โทน, สีท้องฟ้า/น้ำ 4 โทน, สีใบไม้/ดิน/หินธรรมชาติ 4 โทน
     - **หมวดที่ 5 (White & Gray Tint ตรวจสีเพี้ยน)**: แบ่ง 4 โซนบน-ล่าง: ขาว 100%, เทา 75%, 50%, 25%
  3. พัฒนาระบบ **Debug Color Inspector / Pixel Picker**:
     - กดปุ่ม `D` เพื่อเปิด/ปิดโหมดตรวจสี
     - ใช้ฟังก์ชัน `readPixelAt(x, y)` อ่านค่าพิกเซลตรงจาก Canvas ผ่าน `ctx.getImageData()`
     - แสดงการ์ดแสดงค่า HEX, RGB, พิกัดตำแหน่งพิกเซล และตัวอย่างสีจริงสด ๆ บนหน้าจอ
  4. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts) ให้หัวข้อที่ 1 และ 3 ทำงานด้วยคลาสจริง
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-CTdojBz5.js` 79.81 kB)
  - รันชุดตรวจรับอัตโนมัติ Part 4 (`scratch/verify-part4.mjs`): **PASS 100% ทุกรายการ**

---

## Part 5: ทดสอบ Dead Pixel / Stuck Pixel
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-5-dead-pixel` (Push ไปที่ `origin/feat/part-5-dead-pixel` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`dead-pixel.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/dead-pixel.ts) สำหรับหัวข้อ "ตรวจจุดเสีย (Dead / Stuck Pixel)"
  2. วนสีเต็มจอ 5 สีหลักตามข้อกำหนด: ดำ (Black), ขาว (White), แดง (Red), เขียว (Green), น้ำเงิน (Blue)
     - จุดดำบนพื้นสีสว่าง = Dead pixel
     - จุดสว่าง/สีบนพื้นดำ = Stuck / Hot pixel
     - เติมสีเต็มทุกพิกเซลจริงด้วย `ctx.fillRect(0, 0, width, height)` ครอบคลุมทั้งจอโดยไม่มีขอบเว้น
  3. พัฒนาระบบ **Magnifier (แว่นขยายติดตามนิ้ว/เมาส์ 4x, 6x, 8x)**:
     - ปิด Image Smoothing (`ctx.imageSmoothingEnabled = false`) เพื่อแสดงผลแบบ Nearest-Neighbor เห็นแต่ละเม็ดพิกเซลเป็นช่องสี่เหลี่ยมคมชัด
     - มีเส้นตารางพิกเซลจริง (Pixel Grid) ในเลนส์ ช่วยแยกแยะ Subpixel เสีย
     - รองรับจอสัมผัส: มี Touch Offset เลื่อนเลนส์ขึ้นด้านบน 100px พร้อมเส้นประโยง เพื่อไม่ให้นิ้วของผู้ใช้บดบังพื้นที่ขยาย
     - ปรับระดับการซูมได้ 4x, 6x, 8x ด้วยปุ่ม `+` / `-`
  4. พัฒนาระบบ **ตัวนับและมาร์กตำแหน่งจุดเสีย (In-Memory Only)**:
     - ผู้ใช้สามารถกด Spacebar / Enter หรือแตะสองครั้ง (Double-tap) เพื่อมาร์กตำแหน่งจุดเสีย
     - แสดงวงแหวนเป้าเล็งและลำดับเลขกำกับพร้อมพิกัด `(x, y)` บนหน้าจอ
     - มีแถบสรุปจำนวนจุดเสียด้านล่าง พร้อมปุ่มล้างมาร์กเกอร์ (ปุ่ม `C` หรือ `Del`)
     - ข้อมูลถูกเก็บในหน่วยความจำเท่านั้น ไม่บันทึกลงไฟล์ตามข้อกำหนด
  5. ระบบ **ซ่อนเคอร์เซอร์และ HUD**:
     - ปิดการแสดงเคอร์เซอร์อัตโนมัติเมื่อไม่มีการขยับ 3 วินาที เพื่อให้มองเห็นทุกพิกเซลบนจออย่างหมดจด
     - ซ่อนเคอร์เซอร์ขณะใช้งานแว่นขยาย
     - กดปุ่ม `H` หรือแตะ 3 นิ้วเพื่อซ่อน HUD
  6. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts) ให้หัวข้อที่ 1, 3 และ 4 ทำงานด้วยคลาสจริง
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-DRTW_mSK.js` 89.58 kB)
  - รันชุดตรวจรับอัตโนมัติ Part 5 (`scratch/verify-part5.mjs`): **PASS 100% ทุกรายการ**

---

## Part 6: ทดสอบแสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)
- **สถานะ**: พัฒนาและทดสอบเสร็จสมบูรณ์ รอผู้ใช้ตรวจสอบและยืนยันก่อนอัปโหลดขึ้น GitHub
- **Branch**: `feat/part-6-light-bleed` (แตกสาขาจาก `feat/part-5-dead-pixel`)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`light-bleed.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/light-bleed.ts) สำหรับหัวข้อ "ทดสอบแสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)"
  2. ออกแบบภาพทดสอบครบทั้ง 5 รูปแบบหลักตามข้อกำหนด (รวมเป็น 10 พรีเซ็ต):
     - **รูปแบบที่ 1 (จอดำสนิท)**: RGB 0, 0, 0 สำหรับตรวจ Backlight Bleed แสงรั่วตามขอบและมุมจอ
     - **รูปแบบที่ 2 (เทาเข้มหลายระดับ)**: เทา 5% (13), 10% (26), 15% (38), 20% (51) เพื่อตรวจหาจุดด่างขาว (Clouding) และริ้วรอยความสว่างในที่มืด
     - **รูปแบบที่ 3 (เทากลาง 50%)**: RGB 128, 128, 128 สำหรับตรวจ Mura (รอยด่างเป็นปื้นหรือความไม่สม่ำเสมอของพาเนล)
     - **รูปแบบที่ 4 (ขาวเต็มจอ 100%)**: RGB 255, 255, 255 สำหรับตรวจความสว่างไม่เท่ากันและขอบมืด (Vignetting)
     - **รูปแบบที่ 5 (โหมดตารางโซน 3×3 และ 5×5)**: แบ่งหน้าจอเป็น 9 โซน และ 25 โซน โดยมีเส้นคั่นสีดำบางเพื่อช่วยเทียบความสว่างสัมพัทธ์ระหว่างโซนกลางจอกับขอบจอ
  3. ฟังก์ชัน **ปรับระดับสีเทาละเอียดทีละ 1/255 (0 - 255)**:
     - กดปุ่ม `↑` / `↓` หรือ `+` / `-` เพื่อปรับเพิ่ม/ลดทีละ 1/255
     - สไลเดอร์ลากสัมผัสด้านล่างจอ ปรับสีเทาได้ต่อเนื่องตั้งแต่ 0 ถึง 255
  4. ฟังก์ชัน **ซ่อน UI ทั้งหมดอัตโนมัติ (Auto-Hide 100%)**:
     - เมื่อหยุดนิ่งเกิน 2.5 วินาที ตัวหนังสือ HUD, แถบสไลเดอร์ และเคอร์เซอร์เมาส์จะถูกซ่อนทั้งหมด 100% เพื่อไม่ให้มีแสงสะท้อนรบกวนสายตา
     - ขยับเมาส์หรือแตะจอ UI จะกลับมาแสดงชั่วขณะ
     - มีข้อความแนะนำ: *"ควรทดสอบในห้องมืด ปรับความสว่างจอ 100% และมองจากหน้าตรง"*
  5. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts) ให้หัวข้อที่ 1, 3, 4 และ 5 ทำงานด้วยคลาสจริง
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error (`dist/assets/index-CdWWeXg5.js` 99.50 kB)
  - รันชุดตรวจรับอัตโนมัติ Part 6 (`scratch/verify-part6.mjs`): **PASS 100% ทุกรายการ**
    - ระดับสีเทาเปลี่ยนละเอียดทีละ 1/255 ได้ (0 - 255)
    - ค่าสีดำสนิท 0%, เทา 5%, 10%, 15%, 20%, 50%, ขาว 100% และโหมดตาราง 3x3, 5x5 ครบถ้วน
    - ระบบซ่อน UI และเคอร์เซอร์เมาส์ 100% เมื่อหยุดนิ่ง
