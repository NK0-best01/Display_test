/**
 * src/core/keys.ts
 *
 * ระบบจัดการคีย์บอร์ดแบบไม่ขึ้นกับภาษา (Language-independent Keyboard Handler)
 * อ่านจาก event.code เป็นหลักเพื่อระบุตำแหน่งปุ่มทางกายภาพ (Physical Key)
 * พร้อมระบบ Fallback แปลงตัวอักษรไทย (Kedmanee) เป็นปุ่ม QWERTY มาตรฐาน
 */

/**
 * ตารางแปลงตัวอักษรภาษาไทยแบบ Kedmanee เป็นปุ่มมาตรฐาน (Fallback เมื่อ event.code ไม่พร้อมใช้งาน)
 */
const THAI_KEDMANEE_FALLBACK_MAP: Record<string, string> = {
      // แถวตัวเลข 0 - 9 และสัญลักษณ์ Kedmanee
      "ๅ": "1",
      "/": "2", "๑": "2",
      "-": "3", "๒": "3",
      "ภ": "4", "๓": "4",
      "ถ": "5", "๔": "5",
      "ุ": "6", "ู": "6",
      "ึ": "7", "฿": "7",
      "ค": "8", "๕": "8",
      "ต": "9", "๖": "9",
      "จ": "0", "๗": "0",
      "ข": "-", "๘": "-",
      "ช": "=", "๙": "=",

      // แถวตัวอักษรบน (Q - P)
      "ๆ": "q", "๐": "q",
      "ไ": "w", '"': "w",
      "ำ": "e", "ฎ": "e",
      "พ": "r", "ฑ": "r",
      "ะ": "t", "ธ": "t",
      "ั": "y", "ํ": "y",
      "ี": "u", "๊": "u",
      "ร": "i", "ณ": "i",
      "น": "o", "ฯ": "o",
      "ย": "p", "ญ": "p",
      "บ": "[", "ฐ": "[",
      "ล": "]",
      "ฃ": "\\", "ฅ": "\\",

      // แถวตัวอักษรกลาง (A - L)
      "ฟ": "a", "ฤ": "a",
      "ห": "s", "ฆ": "s",
      "ก": "d", "ฏ": "d",
      "ด": "f", "โ": "f",
      "เ": "g", "ฌ": "g",
      "้": "h", "็": "h",
      "่": "j", "๋": "j",
      "า": "k", "ษ": "k",
      "ส": "l", "ศ": "l",
      "ว": ";", "ซ": ";",
      "ง": "'",

      // แถวตัวอักษรล่าง (Z - M)
      "ผ": "z", "ฉ": "z",
      "ป": "x", "ฮ": "x",
      "แ": "c", "ฺ": "c",
      "อ": "v", "์": "v",
      "ิ": "b",
      "ท": "n", "ฒ": "n",
      "ม": "m", "ฬ": "m",
      "ใ": ",",
      "ฝ": ".", "ฦ": ".",
};

/**
 * แมป event.code ทางกายภาพเป็น Normalized Key Name
 */
const CODE_MAP: Record<string, string> = {
      // ปุ่มตัวอักษร A-Z
      KeyA: "a", KeyB: "b", KeyC: "c", KeyD: "d", KeyE: "e",
      KeyF: "f", KeyG: "g", KeyH: "h", KeyI: "i", KeyJ: "j",
      KeyK: "k", KeyL: "l", KeyM: "m", KeyN: "n", KeyO: "o",
      KeyP: "p", KeyQ: "q", KeyR: "r", KeyS: "s", KeyT: "t",
      KeyU: "u", KeyV: "v", KeyW: "w", KeyX: "x", KeyY: "y",
      KeyZ: "z",

      // ปุ่มตัวเลขแถวบน (Digits 0-9)
      Digit0: "0", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4",
      Digit5: "5", Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9",

      // ปุ่มตัวเลข Numpad (Numpad 0-9 ให้ผลเหมือน Digit)
      Numpad0: "0", Numpad1: "1", Numpad2: "2", Numpad3: "3", Numpad4: "4",
      Numpad5: "5", Numpad6: "6", Numpad7: "7", Numpad8: "8", Numpad9: "9",

      // ปุ่มเครื่องหมาย + และ -
      Equal: "+",
      NumpadAdd: "+",
      Minus: "-",
      NumpadSubtract: "-",

      // ปุ่มนำทางและการควบคุมทั่วไป
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      Escape: "Escape",
      Space: "Space",
      Enter: "Enter",
      NumpadEnter: "Enter",
      Tab: "Tab",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Delete: "Delete",
      Backspace: "Backspace",

      // ปุ่มฟังก์ชัน
      F11: "F11",
};

/**
 * ปรับค่า KeyboardEvent ให้ได้ชื่อปุ่มแบบมาตรฐาน ไม่ขึ้นกับภาษาที่กำลังพิมพ์
 *
 * @param e KeyboardEvent จากเบราว์เซอร์
 * @returns ชื่อปุ่มมาตรฐาน เช่น "h", "d", "r", "c", "1"-"8", "+", "-", "ArrowLeft", "Escape" 
 *          หรือ "" หากมีการกดร่วมกับคีย์ลัดของระบบ (Ctrl, Alt, Meta)
 */
export function normalizeKey(e: KeyboardEvent): string {
      // หากมี Modifier ของระบบ (ยกเว้น Shift สำหรับกดเครื่องหมาย) ให้ปล่อยผ่าน ไม่ดักจับเป็นปุ่มลัดของแอป
      if (e.ctrlKey || e.altKey || e.metaKey) {
            return "";
      }

      // 1. อ่านจาก event.code ทางกายภาพก่อนเป็นลำดับแรก (แม่นยำที่สุด)
      const code = e.code;
      if (code && code !== "Unidentified" && CODE_MAP[code]) {
            return CODE_MAP[code];
      }

      // 2. หาก event.code ว่างหรือไม่ระบุ (Unidentified) ให้ใช้ e.key ร่วมกับ Fallback Map
      const key = e.key;
      if (!key) return "";

      // ตรวจสอบปุ่มมาตรฐานตาม e.key
      if (key === "Escape") return "Escape";
      if (key === " " || key === "Spacebar") return "Space";
      if (key === "Enter") return "Enter";
      if (key === "Tab") return "Tab";
      if (key === "F11") return "F11";
      if (key === "ArrowLeft") return "ArrowLeft";
      if (key === "ArrowRight") return "ArrowRight";
      if (key === "ArrowUp") return "ArrowUp";
      if (key === "ArrowDown") return "ArrowDown";
      if (key === "Home") return "Home";
      if (key === "End") return "End";
      if (key === "PageUp") return "PageUp";
      if (key === "PageDown") return "PageDown";
      if (key === "Delete" || key === "Del") return "Delete";
      if (key === "Backspace") return "Backspace";

      // เครื่องหมาย + และ -
      if (key === "+" || key === "=") return "+";
      if (key === "-" || key === "_") return "-";

      // ตัวเลขภาษาอังกฤษปกติ
      if (/^[0-9]$/.test(key)) return key;

      // ตัวอักษรภาษาอังกฤษ A-Z
      if (/^[a-zA-Z]$/.test(key)) return key.toLowerCase();

      // ตรวจสอบตาราง Kedmanee Fallback สำหรับตัวอักษร/ตัวเลขไทย
      if (THAI_KEDMANEE_FALLBACK_MAP[key]) {
            return THAI_KEDMANEE_FALLBACK_MAP[key];
      }

      return key.toLowerCase();
}
