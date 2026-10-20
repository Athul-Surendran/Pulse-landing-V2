import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const edgeAvailable = process.platform === 'win32' && existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5182',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(edgeAvailable ? { channel: 'msedge' } : {}),
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182',
    reuseExistingServer: false,
  },
});
