import { test, expect } from '@playwright/test';
import { fixture, metrics, number } from '../src/performance/data.js';

const section = page => page.locator('#pulse-performance');
const tab = (page, name) => section(page).getByRole('tab', { name });

async function open(page) {
  await page.goto('/#pulse-performance');
  await expect(section(page)).toBeInViewport();
}

test('fixture allocations, area, costs, intensity and end uses reconcile', () => {
  const total = metrics();
  expect(total.consumption).toBe(fixture.hourly.reduce((a, b) => a + b, 0));
  expect(total.cost).toBe(total.consumption * fixture.rate);
  expect(total.intensity).toBe(total.consumption / total.area);
  expect(total.peak).toBe(Math.max(...fixture.hourly));
  expect(fixture.floors.reduce((sum, f) => sum + metrics(f.id).consumption, 0)).toBeCloseTo(total.consumption, 8);
  expect(fixture.floors.reduce((sum, f) => sum + f.area, 0)).toBe(total.area);
  expect(fixture.systems.reduce((sum, s) => sum + s.share * total.consumption, 0)).toBeCloseTo(total.consumption, 8);
  for (let hour = 0; hour < 24; hour++) {
    expect(fixture.floors.reduce((sum, f) => sum + metrics(f.id).hourly[hour], 0)).toBeCloseTo(fixture.hourly[hour], 8);
  }
});

test('tabs switch by mouse and keyboard, keep focus, and mount only one model', async ({ page }) => {
  await page.goto('/');
  await expect(section(page).locator('canvas')).toHaveCount(0);
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator('canvas')).toHaveCount(1);
  await tab(page, 'Energy to Action').click();
  await expect(tab(page, 'Energy to Action')).toHaveAttribute('aria-selected', 'true');
  await expect(section(page).getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('#pp-panel-performance')).toBeEmpty();
  await expect(section(page).locator('canvas')).toHaveCount(1);
  await tab(page, 'Energy to Action').press('ArrowRight');
  await expect(tab(page, 'Building Performance')).toBeFocused();
  await expect(tab(page, 'Building Performance')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Building Performance').press('End');
  await expect(tab(page, 'Energy to Action')).toBeFocused();
  await tab(page, 'Energy to Action').press('Home');
  await expect(tab(page, 'Building Performance')).toBeFocused();
  await tab(page, 'Building Performance').press('ArrowLeft');
  await expect(tab(page, 'Energy to Action')).toBeFocused();
});

test('floor scope, chart, data table and derived metrics update together and reset', async ({ page }) => {
  await open(page);
  await page.getByLabel('Explore a floor').selectOption('10');
  await expect(page.getByLabel('Explore a floor')).toBeFocused();
  const weight = fixture.floors[9].weight / fixture.floors.reduce((sum, f) => sum + f.weight, 0);
  const consumption = fixture.hourly.reduce((a, b) => a + b, 0) * weight;
  await expect(section(page).getByRole('heading', { name: 'Level 10', exact: true })).toBeVisible();
  await expect(section(page).locator('[data-pp-metric="consumption"]')).toHaveText(`${number(consumption, 1)} kWh`);
  await expect(section(page).locator('[data-pp-metric="cost"]')).toHaveText(`£${number(consumption * fixture.rate, 2)}`);
  await expect(section(page).locator('[data-pp-metric="intensity"]')).toHaveText(`${number(consumption / 720, 3)} kWh/m²`);
  await expect(section(page).locator('[data-pp-metric="peak"]')).toHaveText(`${number(Math.max(...fixture.hourly) * weight, 1)} kW`);
  await expect(section(page).getByRole('img', { name: /Level 10: hourly average demand/ })).toBeVisible();
  await section(page).getByText('View hourly data', { exact: true }).click();
  await expect(section(page).locator('tbody tr')).toHaveCount(24);
  await expect(section(page).locator('tbody tr').first()).toContainText(number(fixture.hourly[0] * weight, 2));
  await section(page).getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Explore a floor')).toHaveValue('');
  await expect(section(page).locator('[data-pp-metric="consumption"]')).toHaveText(`${number(metrics().consumption, 1)} kWh`);
});

test('clicking the architectural model selects the same accessible floor scope', async ({ page }) => {
  await open(page);
  await expect(section(page).locator('.pp-model-status')).toContainText('Click a floor');
  const canvas = section(page).locator('canvas');
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  const floor = Number(await page.getByLabel('Explore a floor').inputValue());
  expect(floor).toBeGreaterThan(0);
  await expect(section(page).locator('[data-pp-metric="consumption"]')).toHaveText(`${number(metrics(floor).consumption, 1)} kWh`);
  await expect(section(page).locator('.pp-scope')).toHaveText(`Level ${String(floor).padStart(2, '0')}`);
});

test('work filters and energy observation reveal contextual sample work', async ({ page }) => {
  await open(page);
  await tab(page, 'Energy to Action').click();
  await expect(section(page).locator('[data-pp-work]')).toHaveCount(4);
  for (const [filter, title] of [
    ['Work orders', 'Inspect supply-fan drive'],
    ['PPM', 'Monthly filter inspection'],
    ['Assigned tasks', 'Confirm meter floor mapping'],
  ]) {
    await section(page).getByRole('button', { name: filter, exact: true }).click();
    await expect(section(page).locator('[data-pp-work]')).toHaveCount(1);
    const item = section(page).getByRole('button', { name: new RegExp(title) });
    await item.click();
    await expect(item).toHaveAttribute('aria-expanded', 'true');
    await expect(section(page).getByText('Next step', { exact: true })).toBeVisible();
    await expect(section(page).getByText('Sample assignment only · no changes are sent.')).toBeVisible();
  }
  await section(page).getByRole('button', { name: 'Review the AHU-10 schedule' }).click();
  const review = section(page).getByRole('button', { name: /Review overnight AHU schedule/ });
  await expect(review).toBeFocused();
  await expect(review).toHaveAttribute('aria-expanded', 'true');
  await expect(section(page).getByText(/Overnight demand is not automatically waste/)).toBeVisible();
  await expect(section(page).getByRole('button', { name: 'Notifications', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(section(page).getByText(/Due 21 Oct 2026/)).toBeVisible();
});

test('no-WebGL and reduced motion preserve independent section and floor controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await open(page);
  await expect(section(page).locator('.pp-model-status')).toContainText('3D unavailable');
  await expect(section(page).locator('.pp-model-fallback')).toBeVisible();
  await page.getByLabel('Explore a floor').selectOption('6');
  await expect(section(page).locator('.pp-scope')).toHaveText('Level 06');
  await expect(section(page).locator('[data-pp-floor-shape="6"]')).toHaveAttribute('fill', '#2789a7');
  await tab(page, 'Energy to Action').click();
  await expect(section(page).locator('.pp-model-status')).toContainText('3D unavailable');
  await section(page).getByRole('button', { name: 'Review the AHU-10 schedule' }).click();
  await expect(section(page).locator('#pp-detail-review')).toBeVisible();
});

test('390px and tablet layouts fit both alternatives with readable controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    for (const name of ['Building Performance', 'Energy to Action']) {
      await tab(page, name).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const bounds = await section(page).boundingBox();
      expect(bounds.width).toBeLessThanOrEqual(width);
      await expect(section(page).getByRole('tabpanel')).toBeVisible();
      await expect(section(page).locator('.pp-profile svg')).toBeVisible();
    }
  }
});
