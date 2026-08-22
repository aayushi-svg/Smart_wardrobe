/**
 * End-to-end smoke test against a running dev server + API.
 *   node scripts/e2e.mjs <screenshot-dir> <fixture-dir>
 *
 * Registers a fresh account, walks the onboarding wizard, then exercises every
 * signed-in screen. A new email per run keeps the test independent of whatever
 * is already in the database.
 */
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "./shots";
const FIXTURES = process.argv[3] ?? OUT;
const BASE = process.env.BASE_URL ?? "http://localhost:5173";

const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = "e2e-password-123";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
// The app probes /api/auth/me on load to decide signed-in vs signed-out, so a
// 401 there is the expected answer, not a failure.
const expected = (text) => text.includes("401");
page.on("console", (m) => {
  if (m.type() === "error" && !expected(m.text())) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

const step = async (name, fn) => {
  await fn();
  await page.screenshot({ path: `${OUT}/e2e-${name}.png` });
  console.log(`  ok  ${name}`);
};

await step("login", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForURL("**/login", { timeout: 15000 });
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByPlaceholder("Alex Rivera").fill("E2E Tester");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("At least 8 characters").fill(PASSWORD);
});

await step("onboarding-you", async () => {
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 20000 });
  await page.getByRole("button", { name: "woman", exact: true }).click();
});

await step("onboarding-fit", async () => {
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByPlaceholder("170").fill("172");
  await page.getByRole("button", { name: "minimal", exact: true }).click();
});

await step("onboarding-avatar", async () => {
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(400);
});

await step("onboarding-item", async () => {
  await page.getByRole("button", { name: /Skip for now|^Continue/ }).click();
  await page.setInputFiles('input[type="file"]', `${FIXTURES}/tee.png`);
  // Auto-tagging calls Gemini; give it a moment but don't depend on it.
  await page.waitForTimeout(3000);
});

await step("home", async () => {
  await page.getByRole("button", { name: /Add and finish|^Finish/ }).click();
  await page.waitForURL(BASE + "/", { timeout: 30000 });
  // The piece added during onboarding must survive into the signed-in app —
  // an empty-closet message here means the store never refetched.
  await page.getByRole("heading", { name: /Evening|Weekend|Night|Weekday/ }).first()
    .waitFor({ timeout: 30000 });
});

await step("closet", async () => {
  await page.getByRole("link", { name: "Closet" }).click();
  await page.getByText(/^1 item$/).waitFor({ timeout: 30000 });
});

await step("closet-filters", async () => {
  await page.getByRole("button", { name: /Filter/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Show results" }).click();
});

await step("search", async () => {
  await page.getByRole("link", { name: "Search" }).click();
  await page.waitForTimeout(600);
});

await step("calendar", async () => {
  await page.goto(BASE + "/calendar", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
});

await step("calendar-settings", async () => {
  await page.getByRole("button", { name: "Calendar settings" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Monday" }).click();
  await page.getByRole("button", { name: "medium" }).click();
  await page.waitForTimeout(600);
});

await step("profile", async () => {
  await page.keyboard.press("Escape");
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
});

await step("avatars", async () => {
  await page.goto(BASE + "/avatars", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await step("settings", async () => {
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await step("chat", async () => {
  await page.goto(BASE + "/chat", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Ask Closei what to wear…").fill("What should I wear today?");
  await page.getByRole("button", { name: "Send message" }).click();
  // Streaming replies arrive in chunks; wait for the composer to re-enable.
  await page.waitForSelector('button[aria-label="Send message"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
});

await step("signed-out", async () => {
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login", { timeout: 15000 });
});

await browser.close();

if (errors.length) {
  console.error(`\n${errors.length} console error(s):`);
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}
console.log("\nall steps passed with no console errors");
