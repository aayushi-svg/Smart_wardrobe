/**
 * Visual check for the UI. Start the dev server first, then:
 *   node scripts/screenshot.mjs ./shots
 * Writes the page PNGs and reports any console or page errors.
 */
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "./shots";
const BASE = process.env.BASE_URL ?? "http://localhost:5175";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const shots = [
  ["home", "/"],
  ["closet", "/closet"],
  ["calendar", "/calendar"],
];

for (const [name, path] of shots) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

// scrolled to the outfit feed, so a whole flat-lay card is in frame
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => window.scrollTo(0, 540));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/home-outfits.png` });

// open the Create Avatar modal from the home feed
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Create Avatar" }).first().click();
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/avatar-modal.png` });

console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
