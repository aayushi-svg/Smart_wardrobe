/**
 * End-to-end smoke test against a running dev server + API.
 *   node scripts/e2e.mjs <screenshot-dir> <fixture-dir>
 * Uploads an item through the real form, then walks every screen.
 */
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "./shots";
const FIXTURES = process.argv[3] ?? OUT;
const BASE = process.env.BASE_URL ?? "http://localhost:5175";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const step = async (name, fn) => {
  await fn();
  await page.screenshot({ path: `${OUT}/e2e-${name}.png` });
  console.log(`  ok  ${name}`);
};

await step("home", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await step("closet", async () => {
  await page.goto(BASE + "/closet", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await step("add-item-form", async () => {
  await page.goto(BASE + "/closet/add", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', `${FIXTURES}/tee.png`);
  await page.waitForTimeout(300);
  await page.locator("select").selectOption("outerwear");
  await page.getByPlaceholder("Zara").fill("E2E Brand");
  await page.getByPlaceholder("Black Snake Print Corset Top").fill("Test Jacket");
  // Cutout needs a live Gemini key; skip it so the test works without one.
  await page.getByText("Clean up the photo with AI", { exact: false }).click();
});

await step("after-save", async () => {
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL("**/closet", { timeout: 15000 });
  await page.waitForTimeout(800);
});

await step("profile", async () => {
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await step("calendar", async () => {
  await page.goto(BASE + "/calendar", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await step("avatar-modal", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: "Create Avatar" }).first();
  if (await button.count()) {
    await button.click();
    await page.waitForTimeout(2500);
  }
});

const uploaded = await page.evaluate(async () => {
  const items = await fetch("/api/items").then((r) => r.json());
  return items.some((i) => i.brand === "E2E Brand");
});

console.log(uploaded ? "\nupload round-trip: OK" : "\nupload round-trip: FAILED");
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
process.exit(errors.length || !uploaded ? 1 : 0);
