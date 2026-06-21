import { defineConfig, devices } from "@playwright/test";

const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const serverUrl = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  preserveOutput: "always",
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${serverPort}`,
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
