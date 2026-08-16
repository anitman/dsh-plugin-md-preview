// 层叠探针：视频模式 vs 纯色模式下，背景设置框位置最上层元素分别是谁
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 可选覆盖：CHROME_PATH（chrome 可执行文件，默认用 playwright 自带 chromium）、
// PROBE_VIDEO（背景视频路径）、PROBE_OUT（截图输出目录）
const CHROME = process.env.CHROME_PATH;
const VIDEO = process.env.PROBE_VIDEO || path.join(HERE, "probe-vid.mp4");
const OUT = process.env.PROBE_OUT || path.join(HERE, "probe-out");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
await page.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".mdpv-btn", { timeout: 20000 });
await page.click(".mdpv-btn");
await page.waitForSelector(".mdpv-panel", { timeout: 10000 });
await page.waitForTimeout(800);

// 展开背景选择面板
await page.locator(".mdpv-bgwrap > button").first().click();
await page.waitForSelector(".mdpv-bgpick", { timeout: 5000 });
await page.waitForTimeout(300);
console.log("picker open");

async function stackAt(name) {
  const info = await page.evaluate(() => {
    const pick = document.querySelector(".mdpv-bgpick");
    const r = pick.getBoundingClientRect();
    const describe = (el) => {
      if (!el) return "null";
      const tag = el.tagName.toLowerCase();
      const cls = typeof el.className === "string" ? el.className.split(" ").filter(Boolean).slice(0, 3).join(".") : "";
      const txt = (el.textContent || "").trim().slice(0, 16);
      return tag + (cls ? "." + cls : "") + (txt ? " [" + txt + "]" : "");
    };
    const pts = [
      ["center", r.left + r.width / 2, r.top + r.height / 2],
      ["topRow", r.left + r.width / 2, r.top + 20],
      ["bottomRow", r.left + r.width / 2, r.top + r.height - 14]
    ];
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { sel, pos: s.position, z: s.zIndex, ov: s.overflow };
    };
    return {
      pickerBox: { x: r.left, y: r.top, w: r.width, h: r.height },
      pts: pts.map(([n, x, y]) => ({
        n,
        top: describe(document.elementFromPoint(x, y)),
        stack: document.elementsFromPoint(x, y).slice(0, 4).map(describe)
      })),
      panel: cs(".mdpv-panel"),
      head: cs(".mdpv-head"),
      body: cs(".mdpv-body"),
      video: cs("video.mdpv-video"),
      scrim: cs(".mdpv-video-scrim"),
      bgpick: cs(".mdpv-bgpick")
    };
  });
  console.log("\n===== " + name + " =====");
  console.log("pickerBox:", JSON.stringify(info.pickerBox));
  for (const p of info.pts) {
    console.log("  @" + p.n + " top=" + p.top);
    console.log("      stack=" + JSON.stringify(p.stack));
  }
  for (const k of ["panel", "head", "body", "video", "scrim", "bgpick"]) {
    const v = info[k];
    console.log("  " + k + ": " + (v ? "pos=" + v.pos + " z=" + v.z + " ov=" + v.ov : "(absent)"));
  }
  await page.screenshot({ path: path.join(OUT, name + ".png") });
}

// --- 模式 A：纯色背景 ---
await page.locator(".mdpv-bgpick input[type=color]").first().evaluate((el) => {
  el.value = "#7a4de8";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(500);
await stackAt("A-color");

// --- 模式 B：视频背景 ---
await page.setInputFiles('.mdpv-bgpick input[type=file][accept="video/*"]', VIDEO);
await page.waitForTimeout(4000);
const videoState = await page.evaluate(() => {
  const v = document.querySelector("video.mdpv-video");
  return v ? { readyState: v.readyState, paused: v.paused, w: v.videoWidth, h: v.videoHeight, t: v.currentTime } : null;
});
console.log("\nvideo state:", JSON.stringify(videoState));
await stackAt("B-video");

await browser.close();
console.log("\nprobe done, screenshots in " + OUT);