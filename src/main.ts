import "./style.css";
import { lockWebViewInteractions } from "./core/fullscreen";
import { AppRouter } from "./core/router";
import { getAllTestModules } from "./tests/index";

// ปิด Context Menu, การลากเลือกข้อความ, และการซูม
lockWebViewInteractions();

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("ไม่พบอิลิเมนต์ #app ในหน้าเว็บ");
}

let routerRef: AppRouter | null = null;

const modules = getAllTestModules((subStatus) => {
  routerRef?.updateHudSubStatus(subStatus);
});

const router = new AppRouter(appRoot, modules);
routerRef = router;

// เปิดหน้าเมนูหลักเมื่อเริ่มต้น
void router.showMenu();

// เปิดให้เข้าถึงผ่าน window สำหรับการรันชุดทดสอบตรวจรับ (Acceptance Verification)
declare global {
  interface Window {
    __DISPLAY_TESTER_ROUTER__?: AppRouter;
  }
}
window.__DISPLAY_TESTER_ROUTER__ = router;
