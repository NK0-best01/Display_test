# บันทึกการทำงาน (Work Log) — โปรเจกต์ระบบทดสอบจอภาพ (Display Tester)

เอกสารนี้เก็บประวัติและรายละเอียดการทำงานในแต่ละ Part ตามแผน [display-tester-plan.md](file:///d:/Ai/โปรเจค_roboq\display_test\plan\display-tester-plan.md)

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
     - Grayscale ramp ต่อเนื่อง, Grayscale 16/32 ระดับ, Near-black/white (0-15 & 240-255), Gamma pattern (1px เทียบเทา 50%), Sharpness เส้น 1px และตารางหมากรุก 1px, Geometry สัดส่วน 1:1, Overscan 0px & 1px
  3. รองรับการควบคุม: คีย์บอร์ด `←`/`→`, `Space`, `Home`/`End`, ทัชปัดซ้าย/ขวา และแตะครึ่งซ้าย/ขวา
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build`: ผ่าน ไม่มี Type Error
  - ตรวจสอบเกณฑ์ตรวจรับ Part 3: **PASS 100% ทุกรายการ**

---

## Part 4: ทดสอบสี (Color)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-4-color` (Push ไปที่ `origin/feat/part-4-color` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`color.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/color.ts) สำหรับหัวข้อ "ทดสอบสี (Color Accuracy & Gradient)"
  2. ออกแบบภาพทดสอบครบทั้ง 5 หมวดหลัก (รวม 12 รูปแบบย่อย):
     - สีเต็มจอ 8 สี (แดง, เขียว, น้ำเงิน, ขาว, ดำ, ฟ้าอมเขียว, ม่วงแดง, เหลือง)
     - Color Bars แบบ SMPTE และ 8 แท่งมาตรฐาน พร้อม PLUGE Pulses
     - Gradient 5 ชั้น (R, G, B, CMY, Full Spectrum)
     - ช่องสีเทียบธรรมชาติ (สีผิวคน, ท้องฟ้า, ใบไม้หญ้า)
     - White & Gray Tint ตรวจสีเพี้ยน 4 โซน (ขาว 100%, เทา 75%, 50%, 25%)
  3. พัฒนาระบบ **Debug Color Inspector / Pixel Picker**: กดปุ่ม `D` อ่านค่าสีจริงผ่าน `ctx.getImageData()`
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build`: ผ่าน ไม่มี Type Error
  - ตรวจสอบเกณฑ์ตรวจรับ Part 4: **PASS 100% ทุกรายการ**

---

## Part 5: ทดสอบ Dead Pixel / Stuck Pixel
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-5-dead-pixel` (Push ไปที่ `origin/feat/part-5-dead-pixel` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`dead-pixel.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/dead-pixel.ts) สำหรับหัวข้อ "ตรวจจุดเสีย (Dead / Stuck Pixel)"
  2. วนสีเต็มจอ 5 สีหลักตามข้อกำหนด: ดำ (Black), ขาว (White), แดง (Red), เขียว (Green), น้ำเงิน (Blue)
  3. พัฒนาระบบ **Magnifier (แว่นขยายติดตามนิ้ว/เมาส์ 4x, 6x, 8x)**: แบบ Nearest-Neighbor พร้อมตาราง Pixel Grid และ Touch Offset
  4. พัฒนาระบบ **ตัวนับและมาร์กตำแหน่งจุดเสีย (In-Memory Only)**: กด Spacebar/Double-tap เพื่อมาร์ก และปุ่ม `C`/`Del` เพื่อล้าง
  5. ระบบ **ซ่อนเคอร์เซอร์อัตโนมัติเมื่อไม่ขยับ 3 วินาที**
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build`: ผ่าน ไม่มี Type Error
  - ตรวจสอบเกณฑ์ตรวจรับ Part 5: **PASS 100% ทุกรายการ**

---

## Part 6: ทดสอบแสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-6-light-bleed` (Push ไปที่ `origin/feat/part-6-light-bleed` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`light-bleed.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/light-bleed.ts) สำหรับหัวข้อ "ทดสอบแสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)"
  2. ออกแบบภาพทดสอบครบ 5 รูปแบบหลัก (รวม 10 พรีเซ็ต): ดำสนิท 0%, เทาเข้ม 5%, 10%, 15%, 20%, เทากลาง 50%, ขาวเต็มจอ 100%, ตารางโซน 3×3 และ 5×5
  3. ฟังก์ชันปรับระดับสีเทาละเอียดทีละ 1/255 (0 - 255) ด้วยปุ่ม `↑`/`↓` หรือ `+`/`-` และสไลเดอร์สัมผัส
  4. ฟังก์ชันซ่อน UI ทั้งหมดอัตโนมัติ 100% เมื่อหยุดนิ่ง 2.5 วินาที
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build`: ผ่าน ไม่มี Type Error
  - ตรวจสอบเกณฑ์ตรวจรับ Part 6: **PASS 100% ทุกรายการ**

---

## Part 7: ทดสอบ Touch (Multi-touch)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-7-multi-touch` (Push ไปที่ `origin/feat/part-7-multi-touch` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`multi-touch.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/multi-touch.ts) สำหรับหัวข้อ "ทดสอบระบบสัมผัส (Multi-touch & วาดเส้น)"
  2. พัฒนา 3 โหมดย่อย: ตรวจจับจุดสัมผัส (Multi-touch Points >= 10 จุด), วาดเส้นต่อเนื่อง (Coalesced Draw), และตารางเช็คพื้นที่ทัชทั่วจอ (Grid 16×12 = 192 ช่อง)
  3. แสดงข้อมูลสดข้างจุด: พิกัด, แรงกด, ขนาดสัมผัส, จำนวนจุดสูงสุดที่ตรวจพบ
  4. ตั้งค่า `usesTouchDirectly = true` และ `touchAction = 'none'` ป้องกัน Gesture ซ้อนทับ
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build`: ผ่าน ไม่มี Type Error
  - ตรวจสอบเกณฑ์ตรวจรับ Part 7: **PASS 100% ทุกรายการ**

---

## Part 8: เช็คทิศทาง Touch (Axis / Orientation)
- **สถานะ**: อัปโหลดขึ้น GitHub แล้ว (ยังไม่ merge เข้า `dev` ตามคำสั่งผู้ใช้)
- **Branch**: `feat/part-8-touch-axis` (Push ไปที่ `origin/feat/part-8-touch-axis` เรียบร้อย)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`touch-axis.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/touch-axis.ts) สำหรับหัวข้อ "เช็คทิศทางและแกนสัมผัส (Touch Axis / Orientation)"
  2. พัฒนาระบบทดสอบครบทั้ง 2 หน้า/สเตจตามข้อกำหนด:
     - **หน้าแรก (Stage 1: Calibration)**:
       - แสดงเป้าวงกลม 4 จุดที่ 10% จากขอบจอ ตามลำดับ: บนซ้าย → บนขวา → ล่างขวา → ล่างซ้าย
       - ผู้ใช้แตะทีละเป้า ระบบเก็บพิกัด Normalized (0-1)
       - ประมวลผลหาการแปลงที่ตรงที่สุดจาก **8 รูปแบบ**:
         1. ปกติ (Normal)
         2. กลับแกน X (Inverted X)
         3. กลับแกน Y (Inverted Y)
         4. หมุน 180° (Inverted X & Y)
         5. สลับแกน X ↔ Y (Swapped Axes)
         6. สลับแกน X/Y + กลับแกน X
         7. สลับแกน X/Y + กลับแกน Y
         8. สลับแกน X/Y + กลับทั้งสองแกน
       - แสดงผลลัพธ์เป็นข้อความชัดเจน พร้อมแผนภาพเปรียบเทียบจุดเป้ากับจุดที่แตะจริง เส้นประโยงแสดงความคลาดเคลื่อน และค่าความคลาดเคลื่อนเฉลี่ย (เป็นพิกเซลและเปอร์เซ็นต์)
       - กรณีแตะพลาด หรือสัญญาณไม่ชัดเจน (ความคลาดเคลื่อนเฉลี่ยเกิน 18% หรือแตะซ้ำจุดเดิม): ตัดสินเป็น **"ไม่แน่ใจ ลองใหม่"** แทนการเดาอย่างเด็ดขาดตามเกณฑ์ตรวจรับ
       - มีปุ่มทำซ้ำ (กดปุ่ม `R` หรือแตะปุ่ม "ทดสอบใหม่")
     - **หน้าที่สอง (Stage 2: Trail Direction Test)**:
       - โหมดทดสอบลากเส้นทแยงมุมจากบนซ้ายไปล่างขวา เพื่อให้ผู้ใช้เห็นด้วยสายตาจริงว่าเส้นการเคลื่อนที่วิ่งตามปลายนิ้วถูกต้องตามแกนหรือไม่
  3. เชื่อมโยงโมดูลผ่าน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts)
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่าน ไม่มี Type Error
  - รันชุดตรวจรับอัตโนมัติ Unit Test Part 8: **PASS 100% ทุกรายการ**
    - ตัดสินถูกต้อง 100% ครบทั้ง 8 รูปแบบการแปลงแกน
    - ทดสอบกรณีแตะพลาดซ้ำตรงกลาง: ระบบแสดง "ไม่แน่ใจ ลองใหม่" ถูกต้อง ไม่เดามั่ว

---

## Part 9: วัดความหน่วงการสัมผัส (Touch-to-Paint Latency)
- **สถานะ**: พัฒนาและทดสอบเสร็จสมบูรณ์ รอผู้ใช้ตรวจสอบและยืนยันก่อนอัปโหลดขึ้น GitHub
- **Branch**: `feat/part-9-touch-latency` (แตกสาขาจาก `feat/part-8-touch-axis`)
- **สิ่งที่ดำเนินการ**:
  1. สร้างโมดูลทดสอบจริง [`touch-latency.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/touch-latency.ts) สำหรับหัวข้อ "วัดความหน่วงการสัมผัส (Touch-to-Paint Latency)"
  2. จัดการความต่างของฐานเวลาด้วยฟังก์ชัน `normalizeEventTimeStamp(eTimestamp, currentNow)` เพื่อรองรับทั้ง High Resolution Time และ Epoch Time (> 1e11 ms)
  3. ออกแบบระบบประมวลผลประสิทธิภาพสูง **Zero Garbage Allocation**:
     - ใช้ Ring Buffer ขนาดคงที่ 200 ตัวอย่าง ด้วย `Float32Array(200)` และ `scratchSortBuffer`
     - ไม่มีการจัดสรรออบเจกต์ใหม่ (no object allocation) ภายใน Event Loop หรือ Animation Frame
  4. คำนวณและแสดงผลสถิติแม่นยำ:
     - ค่าเฉลี่ย (Avg), ต่ำสุด (Min), สูงสุด (Max), และ Percentile 95 (P95)
     - ระดับการประเมิน (Rating): ดีมาก (<20 ms สีเขียว), ดี (20-40 ms สีฟ้า), พอใช้ (40-80 ms สีส้ม), ช้า (>80 ms สีแดง)
  5. ระบบตรวจจับ Frame Drop: ตรวจนับเฟรมที่ `requestAnimationFrame` เว้นช่วงเกิน 20 ms เพื่อแจ้งเตือนอาการกระตุกของระบบเรนเดอร์
  6. อินเทอร์เฟซผู้ใช้และการตอบสนอง:
     - วงกลมรางวิ่งเป้าหมาย (Circle Track) เชิญชวนให้ลากนิ้วเป็นวงกลมต่อเนื่อง
     - ตัวติดตามปลายนิ้ว (Active Pointer Target) พร้อมป้ายแสดงความหน่วงสดข้างนิ้ว
     - แดชบอร์ดการ์ด 5 คอลัมน์ (AVG, P95, Min/Max, Rating, Frame Drops)
     - กราฟสด 200 ตัวอย่างล่าสุด (Live Waveform) พร้อมเส้นขีดระดับอ้างอิงแนวนอน 20 ms, 40 ms, 80 ms
     - ข้อความกำกับชัดเจนตามข้อกำหนด: *"ค่านี้เป็นความหน่วงฝั่งซอฟต์แวร์ ไม่รวมเวลาตอบสนองของพาเนลจอ"*
  7. รองรับปุ่ม `R` หรือ `C` เพื่อล้างสถิติ และเชื่อมโยงโมดูลจริงครบทั้ง 7 หัวข้อใน [`index.ts`](file:///d:/Ai/โปรเจค_roboq/display_test/src/tests/index.ts)
- **ผลการทดสอบ (Verification Results)**:
  - `npm run build` (`tsc && vite build`): ผ่านฉลุย ไม่มีข้อผิดพลาด (`dist/assets/index-Bsh7JRM0.js` 122.46 kB)
  - รันชุดตรวจรับอัตโนมัติ Unit Test Part 9 (`scratch/verify-part9.mjs`): **PASS 100% ทุกรายการ**
    - `normalizeEventTimeStamp`: คำนวณถูกต้องทั้งกรณีเวลา High-res ปกติ, Clock Skew, และ Epoch Timestamp
    - Ring Buffer 200 ตัวอย่าง: บันทึกและหมุนเวียนข้อมูลได้ถูกต้องแบบ Zero Allocation
    - สถิติ & ระดับประเมิน: ตรวจสอบความถูกต้องของ Avg, Min, Max, P95 และ Rating ครบทุกช่วงเกณฑ์
    - Keyboard / Reset: กดปุ่ม `R` รีเซ็ตค่าในบัฟเฟอร์และ Frame Drops เกลี้ยง

