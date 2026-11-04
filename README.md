# ระบบทดสอบจอภาพและจอสัมผัส (Display Tester)

แอปพลิเคชันเดสก์ท็อปสำหรับทดสอบคุณภาพจอภาพ (Display) และจอสัมผัส (Touchscreen) พัฒนาด้วย **Tauri v2**, **TypeScript**, **Vite**, และ **Tailwind CSS v3.4** รองรับทั้ง **Linux (X11)** และ **Windows**

---

## รายการทดสอบทั้งหมด (7 หัวข้อ)

1. **คุณภาพของภาพ (Image Quality)** — Grayscale ramp, Near-black/white, Gamma, Sharpness 1px, Geometry, Overscan
2. **ทดสอบ Touch (Multi-touch และการวาด)** — รองรับหลายจุดสัมผัสพร้อมกัน, วาดเส้นต่อเนื่อง, ตารางเช็คพื้นที่สัมผัส (Grid)
3. **ทดสอบสี (Color)** — สีเต็มจอ, SMPTE Color Bars, Gradient R/G/B, สีเทียบธรรมชาติ, White/Gray tint
4. **Dead Pixel / Stuck Pixel** — วนสีเต็มจอพร้อมแว่นขยาย (Magnifier) และตัวนับมาร์กตำแหน่งจุดเสีย
5. **แสงรั่วและความสม่ำเสมอของแสง (Light Bleed / Mura)** — จอดำสนิท, เทาเข้มละเอียดทีละระดับ, ตารางเทียบความสว่าง
6. **เช็คทิศทาง Touch (Axis / Orientation)** — ตรวจสอบแกน X/Y กลับด้านหรือสลับแกนอัตโนมัติ (8 รูปแบบ)
7. **วัดความหน่วงสัมผัส (Touch-to-Paint Latency)** — วัดเวลาตอบสนองฝั่งซอฟต์แวร์พร้อมกราฟสดและตรวจจับ Frame Drop

---

## การติดตั้งเครื่องมือเตรียมความพร้อม (Prerequisites)

### 1. เครื่องมือพื้นฐาน (ทั้ง Linux และ Windows)
- **Node.js** (แนะนำ v18 หรือใหม่กว่า) และ `npm`
- **Rust** (`rustup`, `cargo`, `rustc`) — ติดตั้งจาก [https://rustup.rs](https://rustup.rs)

### 2. สำหรับ Linux (Ubuntu / Debian — X11)
ติดตั้งแพ็กเกจระบบและ `webkit2gtk-4.1` ตามเอกสารทางการของ Tauri v2:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### 3. สำหรับ Windows (Windows 10 / 11)
1. **Microsoft C++ Build Tools**:
   - ติดตั้งผ่าน Visual Studio Installer หรือรันคำสั่ง:
     ```powershell
     winget install Microsoft.VisualStudio.2022.BuildTools
     ```
   - เลือกติ๊กหัวข้อ **"Desktop development with C++"**
2. **Microsoft Edge WebView2 Runtime**:
   - มีติดตั้งมาให้แล้วใน Windows 10/11 รุ่นปัจจุบัน (หากไม่มีสามารถดาวน์โหลด Evergreen Bootstrapper ได้จากเว็บไซต์ Microsoft)
3. **Rust**:
   ```powershell
   winget install Rustlang.Rustup
   ```

---

## วิธีติดตั้งและรันโปรเจกต์

1. **ติดตั้ง Dependencies ฝั่ง Frontend**:
   ```bash
   npm install
   ```

2. **รันโหมดพัฒนาแบบเต็มจอจริง (ค่าเริ่มต้นตาม `tauri.conf.json`)**:
   ```bash
   npm run tauri dev
   # หรือ
   npm run tauri:dev
   ```

3. **รันโหมดหน้าต่างปกติที่ปรับขนาดได้ (สำหรับพัฒนาและทดสอบ Responsive บนจอขนาดใหญ่)**:
   ```bash
   npm run tauri:dev:window
   ```

4. **รันเฉพาะ Frontend ผ่าน Vite (สำหรับเช็ค UI อย่างรวดเร็วในเบราว์เซอร์)**:
   ```bash
   npm run dev
   ```

5. **การสร้างไฟล์ติดตั้ง (Build Production Package)**:
   ```bash
   npm run tauri build
   ```

---

## ปุ่มลัดและการควบคุมมาตรฐาน

| การกระทำ | คีย์บอร์ด | ทัช / เมาส์ |
|---|---|---|
| สลับโหมดเต็มจอ (Fullscreen) | `F11` | ปุ่มสลับเต็มจอในเมนู |
| ออกจากโหมดเต็มจอ / กลับเมนูหลัก | `Esc` | กดค้างมุมซ้ายบน 1 วินาที |
| ซ่อน / แสดง HUD | `H` | แตะสามนิ้วพร้อมกัน |
| เปลี่ยนภาพทดสอบถัดไป / ก่อนหน้า | `←` / `→` | ปัดซ้าย/ขวา หรือแตะครึ่งซ้าย/ขวาของจอ |

