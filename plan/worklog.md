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
- **สถานะ**: กำลังดำเนินการ / รอผู้ใช้ยืนยัน
- **Branch**: `feat/part-1-scaffold`
- **สิ่งที่ดำเนินการ**:
  1. สร้างโครงสร้างโปรเจกต์ **Tauri v2** (`src-tauri/`) คู่กับ **Vite + Vanilla TypeScript** (`src/`)
  2. ตั้งค่า [tauri.conf.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/tauri.conf.json) ให้เปิดแบบเต็มจอ (`fullscreen: true`), ปิดขอบหน้าต่าง (`decorations: false`), และปรับขนาดได้ (`resizable: true`)
  3. เพิ่มไฟล์ตั้งค่าสำหรับโหมดหน้าต่างพัฒนา [tauri.dev-window.conf.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/tauri.dev-window.conf.json) (`npm run tauri:dev:window`) สำหรับการพัฒนาและทดสอบ Responsive บนจอขนาดใหญ่
  4. ติดตั้งและตั้งค่า **Tailwind CSS v3.4** ([tailwind.config.js](file:///d:/Ai/โปรเจค_roboq/display_test/tailwind.config.js), [postcss.config.js](file:///d:/Ai/โปรเจค_roboq/display_test/postcss.config.js), [style.css](file:///d:/Ai/โปรเจค_roboq/display_test/src/style.css)) พร้อมคลาส `.touch-btn` ขนาดไม่ต่ำกว่า `64x64 px` และคลาส `.test-canvas` ที่บังคับปิด filter, backdrop-blur, shadow, opacity และ transition
  5. ตั้งค่า Capabilities ใน [default.json](file:///d:/Ai/โปรเจค_roboq/display_test/src-tauri/capabilities/default.json) ให้สามารถเรียกใช้ `setFullscreen`, `isFullscreen`, `currentMonitor`, `availableMonitors` และอ่านค่า `scaleFactor` ได้
  6. สร้างโมดูล [fullscreen.ts](file:///d:/Ai/โปรเจค_roboq/display_test/src/core/fullscreen.ts) และหน้าตรวจสอบเบื้องต้นใน [main.ts](file:///d:/Ai/โปรเจค_roboq/display_test/src/main.ts) รองรับปุ่มลัด `F11` (สลับ Fullscreen), `Esc` (ออกจาก Fullscreen) และปิด Context Menu / การลากเลือกข้อความ / Pinch Zoom
  7. เขียนเอกสาร [README.md](file:///d:/Ai/โปรเจค_roboq/display_test/README.md) อธิบายวิธีติดตั้ง Prerequisites บน Linux (`webkit2gtk-4.1`) และ Windows (C++ Build Tools, WebView2, Rust) พร้อมคำสั่งรันและ build

