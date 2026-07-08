// @ts-check
import { authedTest } from "../../fixtures/test.js";
import { expect } from "@playwright/test";

const test = authedTest("SUPER_ADMIN");

// Third-party realtime/media/dev noise we don't own.
const IGNORE = [
  /favicon/i, /ResizeObserver/i, /livekit/i, /socket/i, /websocket/i,
  /Failed to load resource/i, /net::ERR/i, /\[vite\]/i, /Download the React DevTools/i,
];

// Known pre-existing React dev warnings in the app (tracked, not gating).
// These are reported as annotations so regressions elsewhere still surface.
const KNOWN_WARNINGS = [
  /value` prop to a form field without an `onChange`/i,
  /each child in a list should have a unique "key"/i,
  /validateDOMNesting/i,
];

const CORE_PAGES = ["/dashboard", "/leads", "/settings"];

test.describe("Console error budget (core pages)", () => {
  for (const path of CORE_PAGES) {
    test(`${path} logs no *unexpected* console errors`, async ({ page }, testInfo) => {
      const unexpected = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (IGNORE.some((re) => re.test(text))) return;
        if (KNOWN_WARNINGS.some((re) => re.test(text))) {
          testInfo.annotations.push({ type: "known-warning", description: text.slice(0, 160) });
          return;
        }
        unexpected.push(text);
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(unexpected, `unexpected console errors on ${path}:\n${unexpected.join("\n")}`).toEqual([]);
    });
  }
});
