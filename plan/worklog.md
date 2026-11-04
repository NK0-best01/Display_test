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
- **สถานะ**: พัฒนาและทดสอบเสร็จแล้ว รอผู้ใช้ยืนยันก่อน commit/merge
- **Branch**: `feat/part-2-app-shell`
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
  - ตรวจสอบเกณฑ์ตรวจรับ Part 1 & Part 2 อัตโนมัติ (17 รายการ + จำลองสลับเข้า-ออกหน้าทดสอบ 50 ครั้ง): **PASS ทั้งหมด 100%** (Listener ค้าง = 0, RAF ค้าง = 0)
