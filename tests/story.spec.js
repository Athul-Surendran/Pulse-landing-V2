import { test, expect } from '@playwright/test';
import { advanceTraffic } from '../src/scene.js';

async function open(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__FORMA__?.getState().drawCalls > 0);
}

async function seek(page, time) {
  await page.evaluate(value => {
    window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * value / 8, behavior: 'instant' });
  }, time);
  await expect.poll(async () => (await page.evaluate(() => window.__FORMA__.getState())).time).toBeCloseTo(time, 1);
}

test('one reversible scene follows fault, repair, airflow, and the complete circuit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const state = () => page.evaluate(() => window.__FORMA__.getState());
  expect(await state()).toMatchObject({ chapter: 0, flow: 0, healthy: 0, obstructionVisible: true, downstreamFlowVisible: false });
  expect(await state()).toMatchObject({ district: 1, districtVisible: true, alarm: 0, alarmVisible: false, alarmHighlightOpacity: 0 });
  expect((await state()).districtBuildingCount).toBeGreaterThan(50);
  await expect(page.locator('body')).toHaveClass(/exterior/);
  await expect(page.locator('.system-card')).toBeHidden();
  await expect(page.locator('.scene-coordinate')).toBeHidden();
  await expect(page.locator('#alarm-panel')).toBeHidden();
  await expect(page.locator('#alarm-icon')).toHaveCount(0);
  const opening = await state();
  expect(Math.hypot(opening.cameraX - opening.targetX, opening.cameraY - opening.targetY, opening.cameraZ - opening.targetZ)).toBeLessThan(60);
  await seek(page, 0.26);
  expect(await state()).toMatchObject({ alarm: 1, alarmVisible: true, highlightColor: '#e80004' });
  await expect(page.locator('#alarm-panel')).toBeVisible();
  await expect(page.locator('.alarm-severity')).toHaveText('Cooling alarm active');
  await seek(page, 2.5);
  expect(await state()).toMatchObject({ chapter: 2, cutaway: 1, ceiling: 1, obstructionVisible: true, downstreamFlowVisible: false });
  expect(await state()).toMatchObject({ district: 0, districtVisible: false });
  await expect(page.locator('body')).not.toHaveClass(/exterior/);
  await expect(page.locator('#accessible-caption')).toHaveText('Chilled-water pipe blocked — cooling interrupted.');
  await seek(page, 3.42);
  const duringRepair = await state();
  expect(duringRepair.repair).toBeGreaterThan(0.4);
  expect(duringRepair.repair).toBeLessThan(0.6);
  expect(duringRepair.flow).toBe(0);
  expect(duringRepair.healthy).toBe(0);
  await seek(page, 4.2);
  expect(await state()).toMatchObject({ flow: 1, healthy: 0, obstructionVisible: false, downstreamFlowVisible: true });
  await expect(page.locator('#recovery-status')).toHaveText('Verifying circulation');
  await seek(page, 4.8);
  expect(await state()).toMatchObject({ chapter: 4, healthy: 1, flow: 1 });
  await expect(page.locator('#alarm-panel')).toHaveAttribute('data-state', 'resolved');
  expect((await state()).highlightColor).toBe('#19a877');
  await seek(page, 5.5);
  expect(await state()).toMatchObject({ chapter: 5, air: 1, airVisible: true });
  await seek(page, 7.8);
  expect(await state()).toMatchObject({ chapter: 7, network: 1, cutaway: 0, healthy: 1, downstreamFlowVisible: true });
  expect(await state()).toMatchObject({ district: 1, districtVisible: true });
  await expect(page.locator('body')).toHaveClass(/exterior/);
  await expect(page.locator('#alarm-panel')).toBeHidden();
  await expect(page.locator('#final-hero')).toBeVisible();
  await expect(page.locator('#accessible-caption')).toHaveText('Alarm resolved. Airflow restored. Chilled-water circulation verified.');
  await seek(page, 3.42);
  expect(await state()).toMatchObject({ healthy: 0, flow: 0, downstreamFlowVisible: false, airVisible: false, obstructionVisible: true });
  await seek(page, 0);
  expect(await state()).toMatchObject({ chapter: 0, repair: 0, healthy: 0, cutaway: 0, obstructionVisible: true });
  expect(await state()).toMatchObject({ district: 1, districtVisible: true });
  expect(await state()).toMatchObject({ alarm: 0, alarmVisible: false, alarmHighlightOpacity: 0 });
  await expect(page.locator('#alarm-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('chapter controls and motion toggle work', async ({ page }) => {
  await open(page);
  const moving = await page.evaluate(() => window.__FORMA__.getState());
  expect(moving.turbineAngles).toHaveLength(2);
  expect(moving.vehiclePositions).toHaveLength(6);
  await expect.poll(async () => (await page.evaluate(() => window.__FORMA__.getState())).turbineAngles[0]).toBeGreaterThan(moving.turbineAngles[0] + 0.03);
  await expect.poll(async () => (await page.evaluate(() => window.__FORMA__.getState())).vehiclePositions[0][0]).toBeGreaterThan(moving.vehiclePositions[0][0] + 0.1);
  await page.locator('#motion-button').click();
  await expect(page.locator('#motion-button')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__FORMA__.getState().paused)).toBe(true);
  const paused = await page.evaluate(() => window.__FORMA__.getState());
  await page.waitForTimeout(250);
  const still = await page.evaluate(() => window.__FORMA__.getState());
  expect(still.turbineAngles).toEqual(paused.turbineAngles);
  expect(still.vehiclePositions).toEqual(paused.vehiclePositions);
  await page.locator('[data-chapter="6"]').click();
  await expect(page.locator('[data-chapter="6"]')).toHaveAttribute('aria-current', 'step');
  await page.locator('[data-chapter="2"]').click();
  await expect(page.locator('[data-chapter="2"]')).toHaveAttribute('aria-current', 'step');
  await page.locator('.wordmark').click();
  await expect(page.locator('[data-chapter="0"]')).toHaveAttribute('aria-current', 'step');
});

test('glass alarm panel tracks the scene and recovery completes only after verified flow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('#alarm-panel')).toBeHidden();
  await expect(page.locator('#recovery-progress')).toBeHidden();
  await expect(page.locator('#alarm-connector')).toBeHidden();
  await expect(page.locator('#alarm-icon')).toHaveCount(0);
  await seek(page, 0.26);
  await expect(page.locator('#alarm-panel-title')).toHaveText('Alarm center');
  await expect(page.locator('#alarm-details')).toBeVisible();
  await expect(page.locator('.alarm-severity')).toHaveCSS('color', 'rgb(232, 0, 4)');
  await expect(page.locator('#alarm-connector')).toHaveCSS('color', 'rgb(232, 0, 4)');
  await expect(page.locator('#alarm-connector')).toBeVisible();
  const connectorStart = await page.locator('#alarm-connector-path').evaluate(path => {
    const point = path.getPointAtLength(0);
    return { x: point.x, y: point.y };
  });
  const panel = await page.locator('#alarm-panel').boundingBox();
  expect(connectorStart.x).toBeCloseTo(panel.x + panel.width, 0);
  const initialTarget = await page.locator('#alarm-connector-target').getAttribute('cx');
  await page.locator('#inspect-office').click();
  await expect(page.locator('#recovery-checklist')).toBeVisible();
  await expect(page.locator('#alarm-details')).toBeHidden();
  await expect(page.locator('#alarm-connector')).toBeVisible();
  expect(await page.locator('#alarm-connector-target').getAttribute('cx')).not.toBe(initialTarget);
  for (const [time, complete, min, max] of [
    [1.1, 0, 0, 1], [2.5, 1, 20, 39], [3.2, 2, 40, 59],
    [3.7, 3, 60, 79], [4.1, 4, 80, 99], [4.65, 4, 99, 99],
    [4.72, 5, 100, 100], [7.8, 5, 100, 100],
    [4.65, 4, 99, 99], [3.7, 3, 60, 79], [2.5, 1, 20, 39], [1.1, 0, 0, 1],
  ]) {
    await seek(page, time);
    const state = await page.evaluate(() => window.__FORMA__.getState());
    expect(state.recoveryProgress).toBeGreaterThanOrEqual(min);
    expect(state.recoveryProgress).toBeLessThanOrEqual(max);
    expect(state.completedChecks).toBe(complete);
    const checks = await page.locator('.recovery-steps input').evaluateAll(inputs => inputs.map(input => input.checked));
    expect(checks).toEqual(Array.from({ length: 5 }, (_, i) => i < complete));
    await expect(page.locator('#recovery-bar')).toHaveAttribute('aria-valuenow', String(state.recoveryProgress));
    await expect(page.locator('#alarm-panel')).toHaveAttribute('data-state', complete === 5 ? 'resolved' : 'active');
    if (complete === 5) {
      expect(state).toMatchObject({ flow: 1, healthy: 1, repair: 1, obstructionVisible: false, downstreamFlowVisible: true });
      await expect(page.locator('#recovery-status')).toHaveText('Issue solved. Cooling recovered.');
      await expect(page.locator('#recovery-fill')).toHaveCSS('background-color', 'rgb(25, 168, 119)');
      await expect(page.locator('#recovery-percent')).toHaveCSS('color', 'rgb(25, 168, 119)');
      await expect(page.locator('.recovery-steps input').first()).toHaveCSS('background-color', 'rgb(25, 168, 119)');
    }
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await seek(page, 3.7);
    await expect(page.locator('#alarm-panel')).toBeInViewport();
    await expect(page.locator('#recovery-progress')).toBeInViewport();
    const card = await page.locator('#alarm-panel').boundingBox();
    const progress = await page.locator('#recovery-progress').boundingBox();
    expect(card.y + card.height / 2).toBeCloseTo(viewport.height / 2, 0);
    expect(progress.x + progress.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(card.y + card.height <= progress.y || card.x + card.width <= progress.x).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
  await seek(page, 0);
  await expect(page.locator('#alarm-panel')).toBeHidden();
  await expect(page.locator('#recovery-progress')).toBeHidden();
  await expect(page.locator('#alarm-connector')).toBeHidden();
});

test('alarm card fits without an internal scrollbar or trapping page scroll', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of [
    { width: 1440, height: 1000 }, { width: 1440, height: 740 },
    { width: 1280, height: 640 }, { width: 390, height: 844 },
    { width: 320, height: 640 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await seek(page, 0.26);
    const card = await page.locator('#alarm-panel').boundingBox();
    expect(card.y + card.height / 2).toBeCloseTo(viewport.height / 2, 0);
    expect(card.y + card.height).toBeLessThanOrEqual(viewport.height - 8);
    expect(card.x + card.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator('#alarm-panel')).toHaveCSS('overflow-y', 'visible');
    await expect(page.locator('.other-alerts li').last()).toBeInViewport({ ratio: 1 });
    expect(await page.locator('#alarm-panel').evaluate(panel => panel.scrollHeight <= panel.clientHeight + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seek(page, 0.26);
  const before = await page.evaluate(() => scrollY);
  await page.locator('#alarm-panel-title').hover();
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  expect(await page.locator('#alarm-panel').evaluate(panel => panel.scrollTop)).toBe(0);
});

test('3D alarm inspection rotates, supports pause, and keeps the recovery UI clear', async ({ page }) => {
  await open(page);
  await expect(page.locator('#scroll-cue')).toBeVisible();
  await seek(page, 0.26);
  await expect(page.locator('#scroll-cue')).toBeHidden();
  await page.waitForFunction(() => window.__FORMA__.getState().preview?.drawCalls > 0);
  await expect(page.locator('#preview-error')).toBeHidden();
  await expect(page.locator('#valve-preview canvas')).toBeVisible();
  await expect(page.locator('#other-alerts-title')).toHaveText('Other sample alerts');
  await expect(page.locator('.other-alerts li')).toHaveCount(2);
  await expect(page.locator('.alarm-metadata')).toContainText('FCU-10');
  await expect(page.locator('#alarm-panel')).toHaveCSS('background-image', 'none');
  await expect(page.locator('#alarm-panel')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const angle = await page.evaluate(() => window.__FORMA__.getState().preview.angle);
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().preview.angle)).toBeGreaterThan(angle + 0.01);
  await page.locator('#preview-pause').click();
  const stopped = await page.evaluate(() => window.__FORMA__.getState().preview.angle);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__FORMA__.getState().preview.angle)).toBe(stopped);
  await page.locator('#valve-preview').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().preview.angle)).toBeGreaterThan(stopped + 0.1);
  await page.locator('#preview-pause').click();
  await page.locator('#motion-button').click();
  const globalPause = await page.evaluate(() => window.__FORMA__.getState().preview.angle);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__FORMA__.getState().preview.angle)).toBe(globalPause);
  await page.locator('#motion-button').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().reducedMotion)).toBe(true);
  const reduced = await page.evaluate(() => window.__FORMA__.getState().preview.angle);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__FORMA__.getState().preview.angle)).toBe(reduced);
  await seek(page, 3.7);
  await expect(page.locator('#alarm-panel')).toHaveClass(/checklist-mode/);
  await expect(page.locator('#alarm-panel')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#alarm-panel')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('#alarm-panel')).toHaveCSS('box-shadow', 'none');
  const card = await page.locator('#recovery-progress').boundingBox();
  expect(card.x + card.width / 2).toBeCloseTo(720, 0);
  await expect(page.locator('#scroll-cue')).toBeHidden();
  await seek(page, 0);
  await expect(page.locator('#scroll-cue')).toBeVisible();
});

test('valve popup supports full wheel rotation, drag, reset, and keyboard dismissal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await seek(page, 0.26);
  const preview = page.locator('#valve-preview');
  const bounds = await preview.boundingBox();
  await page.mouse.move(bounds.x + 30, bounds.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#valve-dialog')).not.toBeVisible();
  await preview.click();
  const dialog = page.getByRole('dialog', { name: '360° valve inspection' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#valve-dialog-error')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.drawCalls)).toBeGreaterThan(0);
  await expect(page.locator('#valve-dialog-view')).toBeFocused();
  const before = await page.evaluate(() => ({ y: scrollY, state: window.__FORMA__.getState() }));
  await page.locator('#valve-dialog-view').hover();
  await page.mouse.wheel(0, 1200);
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle))
    .toBeGreaterThan(before.state.valveInspection.angle + Math.PI * 2);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  expect((await page.evaluate(() => window.__FORMA__.getState())).time).toBeCloseTo(before.state.time, 4);
  await page.mouse.wheel(0, -1200);
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle)).toBeCloseTo(before.state.valveInspection.angle, 4);
  const view = await page.locator('#valve-dialog-view').boundingBox();
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
  await page.mouse.down();
  await page.mouse.move(view.x + view.width / 2 + 70, view.y + view.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle)).toBeGreaterThan(before.state.valveInspection.angle + 0.7);
  await page.locator('#valve-dialog-reset').click();
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle)).toBeCloseTo(-0.3, 4);
  await page.locator('#valve-dialog-view').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle)).toBeCloseTo(-0.15, 4);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(preview).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.locator('#valve-dialog-close').click();
  await expect(dialog).not.toBeVisible();
  await preview.hover();
  await page.mouse.wheel(0, 150);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.y);
  expect(errors).toEqual([]);
});

test('valve popup fits small screens and traps focus without duplicating its canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await seek(page, 0.26);
    await page.locator('#valve-preview').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#valve-dialog')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#valve-dialog-view canvas')).toHaveCount(1);
    await expect(page.locator('#valve-dialog-view canvas')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#valve-dialog-close')).toBeInViewport({ ratio: 1 });
    await page.locator('#valve-dialog-reset').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('#valve-dialog')))).toBe(true);
    const y = await page.evaluate(() => scrollY);
    await page.locator('#valve-dialog-view').dispatchEvent('wheel', { deltaY: 100, deltaMode: 1, bubbles: true, cancelable: true });
    await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().valveInspection.angle)).toBeGreaterThan(6);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await page.keyboard.press('Escape');
    await expect(page.locator('#valve-dialog')).not.toBeVisible();
  }
});

test('Pulse branding uses local Barlow and landing copy clears during the story', async ({ page }) => {
  await open(page);
  await expect(page.locator('.wordmark img')).toHaveAttribute('src', '/pulse-logo.png');
  expect(await page.locator('.wordmark img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.load('500 12px Barlow'));
  expect(await page.evaluate(() => document.fonts.check('500 12px Barlow'))).toBe(true);
  await expect(page.locator('#scroll-cue')).toHaveCSS('font-family', 'Barlow, sans-serif');
  const dock = await page.locator('.chapter-bar').boundingBox();
  expect(dock.x).toBeGreaterThan(1440 * 0.9);
  expect(dock.height).toBeGreaterThan(dock.width * 4);
  for (const time of [0, 2.5, 5.5, 7.8]) {
    await seek(page, time);
    const text = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector('#experience'), NodeFilter.SHOW_TEXT);
      const labels = [];
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (node.textContent.trim() && !parent.closest('.sr-only, #alarm-panel, #recovery-progress') && parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) labels.push(node.textContent.trim());
      }
      return labels;
    });
    const navigation = ['Platform', 'Solutions', 'Resources', 'Multi-site', 'Intelligence', 'Contact'];
    const hero = ['One platform.', 'Smarter buildings.', 'Book your live demo', 'Explore the platform'];
    const finale = ['Explore Pulse Building Management Solution', 'Connected systems. Complete visibility.', 'Smarter control. More comfortable spaces.', 'Request for a demo'];
    expect(text).toEqual([...navigation, ...(time === 0 ? [...hero, 'Scroll'] : time === 7.8 ? finale : [])]);
  }
});

test('landing actions and responsive menu preserve the scroll story', async ({ page }) => {
  await open(page);
  async function expectLeftCenteredHero() {
    const lines = await page.locator('#hero-title span').all();
    const firstLine = await lines[0].boundingBox();
    const secondLine = await lines[1].boundingBox();
    const demo = await page.locator('#landing-hero .demo-button').boundingBox();
    const explore = await page.locator('#explore-platform').boundingBox();
    expect(firstLine.x).toBeCloseTo(secondLine.x, 1);
    expect(secondLine.y).toBeGreaterThan(firstLine.y);
    await expect(page.locator('#landing-hero')).toHaveCSS('text-align', 'left');
    expect(demo.x).toBeCloseTo(firstLine.x, 1);
    const block = await page.locator('#landing-hero').boundingBox();
    expect(block.y + block.height / 2).toBeCloseTo(page.viewportSize().height / 2, 0);
    expect(demo.y).toBeGreaterThan(secondLine.y + secondLine.height);
    expect(explore.y).toBeCloseTo(demo.y, 1);
    expect(explore.x).toBeGreaterThan(demo.x + demo.width);
  }
  await expectLeftCenteredHero();
  await page.setViewportSize({ width: 1892, height: 1030 });
  await expectLeftCenteredHero();
  const spacing = await page.locator('#landing-hero').boundingBox();
  expect(spacing.y).toBeCloseTo(1030 - spacing.y - spacing.height, 0);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => window.__FORMA__.getState().viewOffsetX)).toBeCloseTo(-0.16, 3);
  const navBounds = await page.locator('#primary-nav').boundingBox();
  const contactBounds = await page.locator('.contact-button').boundingBox();
  expect(navBounds.height).toBe(44);
  expect(contactBounds.height).toBe(navBounds.height);
  for (const selector of ['#primary-nav', '.contact-button', '#explore-platform']) {
    await expect(page.locator(selector)).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(page.locator(selector)).toHaveCSS('backdrop-filter', 'blur(12px) saturate(1.3)');
  }
  await expect(page.locator('#primary-nav button').first()).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('#landing-hero .demo-button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('heading', { name: 'One platform. Smarter buildings.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book your live demo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Contact', exact: true })).toBeDisabled();
  await page.locator('#explore-platform').click();
  await expect(page.locator('[data-chapter="1"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#landing-hero')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().viewOffsetX)).toBeCloseTo(-0.10, 3);
  expect(await page.locator('#landing-hero').evaluate(hero => hero.inert)).toBe(true);
  await page.locator('.wordmark').click();
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().time)).toBeLessThan(0.015);
  await expect(page.locator('#landing-hero')).toBeVisible();
  expect(await page.locator('#landing-hero').evaluate(hero => hero.inert)).toBe(false);
  await expectLeftCenteredHero();
  expect(await page.evaluate(() => window.__FORMA__.getState().viewOffsetX)).toBeCloseTo(-0.16, 3);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expectLeftCenteredHero();
    await expect(page.locator('#explore-platform')).toBeInViewport();
    await expect(page.locator('.contact-button')).toBeInViewport();
    await expect(page.locator('#menu-toggle')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(page.locator('#menu-toggle')).toHaveCSS('backdrop-filter', 'blur(12px) saturate(1.3)');
    await expect(page.locator('#primary-nav')).toBeHidden();
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#primary-nav')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Intelligence', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#primary-nav')).toBeHidden();
    await expect(page.locator('#menu-toggle')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test('final call to action is bottom centered, responsive, and reversible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('#final-hero')).toBeHidden();
  for (const viewport of [{ width: 1892, height: 1030 }, { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await seek(page, 8);
    const finale = page.locator('#final-hero');
    await expect(finale).toBeVisible();
    await expect(finale).toHaveCSS('opacity', '1');
    await expect(finale).toHaveCSS('text-align', 'center');
    if (viewport.width > 760) await expect(page.locator('#final-title')).toHaveCSS('font-size', '35px');
    const titleLayout = await page.locator('#final-title').evaluate(element => ({
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
      fits: element.scrollWidth <= element.clientWidth,
    }));
    if (viewport.width > 1000) expect(titleLayout.height).toBeCloseTo(titleLayout.lineHeight, 0);
    expect(titleLayout.fits).toBe(true);
    const description = page.locator('.final-description');
    await expect(description).toHaveCSS('font-size', '14px');
    await expect(description).toHaveCSS('color', 'rgb(107, 116, 128)');
    const copyLayout = await description.evaluate(element => ({
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(copyLayout.height).toBeCloseTo(copyLayout.lineHeight * 2, 0);
    await expect(page.locator('#final-title')).toHaveText('Explore Pulse Building Management Solution');
    await expect(page.getByRole('button', { name: 'Request for a demo' })).toBeDisabled();
    const bounds = await finale.boundingBox();
    expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2, 0);
    const button = await finale.locator('button').boundingBox();
    expect(button.x + button.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(viewport.height - bounds.y - bounds.height).toBeCloseTo(Math.max(28, Math.min(72, viewport.height * 0.06)), 0);
    await expect(finale).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#alarm-panel')).toBeHidden();
    await expect(page.locator('#recovery-progress')).toBeHidden();
    await expect(page.locator('#alarm-connector')).toBeHidden();
    expect(await finale.evaluate(element => element.inert)).toBe(false);
    await seek(page, 7.3);
    await expect(finale).toBeHidden();
    expect(await finale.evaluate(element => element.inert)).toBe(true);
    await expect(page.locator('#alarm-panel')).toBeVisible();
    await expect(page.locator('#recovery-progress')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test('traffic varies arrivals without overlapping or wrapping within the visible streets', () => {
  const traffic = [
    { kind: 'car', x: -40, z: 12.4, direction: 1, length: 3.8, speed: 7, wait: 0, trips: 0 },
    { kind: 'bus', x: 0, z: 12.4, direction: 1, length: 10.5, speed: 4.5, wait: 0, trips: 0 },
    { kind: 'truck', x: 40, z: 15.6, direction: -1, length: 7.2, speed: 3, wait: 0, trips: 0 },
  ];
  let seed = 31;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const delays = new Set(), speeds = new Set();
  let minimumGap = Infinity, minimumAdvance = Infinity, maximumAdvance = 0;
  for (let frame = 0; frame < 5000; frame++) {
    const before = traffic.map(vehicle => ({ ...vehicle }));
    advanceTraffic(traffic, 0.05, random);
    traffic.forEach((vehicle, i) => {
      if (vehicle.trips > before[i].trips) {
        expect(vehicle.x * vehicle.direction).toBeGreaterThan(158);
        expect(vehicle.wait).toBeGreaterThanOrEqual(5);
        expect(vehicle.wait).toBeLessThanOrEqual(21);
        delays.add(vehicle.wait);
      }
      if (before[i].wait > 0 && vehicle.wait === 0) {
        expect(vehicle.x * vehicle.direction).toBeLessThan(-157);
        speeds.add(vehicle.speed);
      }
      if (before[i].wait === 0 && vehicle.wait === 0) {
        minimumAdvance = Math.min(minimumAdvance, (vehicle.x - before[i].x) * vehicle.direction);
        maximumAdvance = Math.max(maximumAdvance, Math.abs(vehicle.x - before[i].x));
      }
    });
    if (traffic[0].wait === 0 && traffic[1].wait === 0) {
      minimumGap = Math.min(minimumGap, Math.abs(traffic[0].x - traffic[1].x));
    }
  }
  expect(delays.size).toBeGreaterThan(3);
  expect(speeds.size).toBeGreaterThan(3);
  expect(minimumGap).toBeGreaterThan((3.8 + 10.5) / 2 + 3.9);
  expect(minimumAdvance).toBeGreaterThanOrEqual(0);
  expect(maximumAdvance).toBeLessThanOrEqual(0.3751);
  const paused = structuredClone(traffic);
  advanceTraffic(traffic, 0, random);
  expect(traffic).toEqual(paused);
});

test('vehicle-specific speeds persist on re-entry and move cars faster than buses and trucks', () => {
  for (const randomValue of [0, 0.5, 0.999]) {
    const traffic = ['car', 'bus', 'truck'].map((kind, i) => ({
      kind, x: 159, z: i * 4, direction: 1, length: 4, speed: 0, wait: 0.01, trips: 1,
    }));
    advanceTraffic(traffic, 0.02, () => randomValue);
    const ranges = [[6.2, 7.5], [3.5, 6], [2.6, 3.4]];
    traffic.forEach((vehicle, i) => {
      expect(vehicle.speed).toBeGreaterThanOrEqual(ranges[i][0]);
      expect(vehicle.speed).toBeLessThanOrEqual(ranges[i][1]);
    });
    const positions = traffic.map(vehicle => vehicle.x);
    advanceTraffic(traffic, 0.05, () => randomValue);
    const advances = traffic.map((vehicle, i) => vehicle.x - positions[i]);
    expect(advances[0]).toBeGreaterThan(advances[1]);
    expect(advances[1]).toBeGreaterThan(advances[2]);
  }
});

test('office devices, mixed vehicles, and river boat remain in the connected scene', async ({ page }) => {
  await open(page);
  const state = () => page.evaluate(() => window.__FORMA__.getState());
  const initial = await state();
  expect(initial.traffic.map(vehicle => vehicle.kind)).toEqual(['car', 'bus', 'truck', 'car', 'bus', 'truck']);
  const speedsFor = kind => initial.traffic.filter(vehicle => vehicle.kind === kind).map(vehicle => vehicle.speed);
  expect(Math.min(...speedsFor('car'))).toBeGreaterThan(Math.max(...speedsFor('bus')));
  expect(Math.min(...speedsFor('bus'))).toBeGreaterThan(Math.max(...speedsFor('truck')));
  expect(initial.boat.bridgeClearance).toBeGreaterThan(1);
  expect(initial.officeWallFinish).toBe('Honed silver limestone feature wall');
  expect(initial.officeWallTextured).toBe(true);
  expect(initial.roomDevices.map(device => device.name)).toEqual([
    'Smart room controller', 'Ceiling CCTV camera', 'Ceiling presence sensor',
  ]);
  expect(initial.roomController).toEqual({
    temperature: 26.5, setpoint: 21.5, features: ['HVAC +/-', 'Light toggle', 'Sound +/-', 'Fan +/-'], simulated: true,
  });
  initial.roomDevices.forEach(device => {
    expect(device.position[1]).toBeGreaterThan(initial.dimensions.officeY);
    expect(device.position[1]).toBeLessThan(initial.dimensions.ceilingY);
  });
  await expect.poll(async () => (await state()).boat.position[0]).toBeGreaterThan(initial.boat.position[0] + 0.1);
  await page.locator('#motion-button').click();
  const paused = await state();
  await page.waitForTimeout(200);
  expect((await state()).boat).toEqual(paused.boat);
  expect((await state()).traffic).toEqual(paused.traffic);
  await page.locator('#motion-button').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await state()).reducedMotion).toBe(true);
  const reduced = await state();
  await seek(page, 5.5);
  expect((await state()).roomController.temperature).toBe(22);
  expect((await state()).boat.position).toEqual(reduced.boat.position);
  expect((await state()).roomDevices).toEqual(initial.roomDevices);
  await seek(page, 8);
  expect((await state()).traffic).toEqual(reduced.traffic);
  await seek(page, 3.42);
  expect((await state()).roomController.temperature).toBe(26.5);
});

test('room equipment shows animated hover, keyboard, and touch descriptions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const tooltip = page.locator('#device-tooltip');
  await expect(page.locator('.device-hotspot:visible')).toHaveCount(0);
  await seek(page, 5.5);
  for (const [id, title, description] of [
    ['room-control', 'Smart room controller', 'Adjusts cooling, lights, sound and fan speed in this room.'],
    ['cctv', 'CCTV camera', 'Monitors the room to help keep people and spaces safe.'],
    ['presence', 'Presence sensor', 'Detects people so lighting and cooling can respond automatically.'],
    ['fire-extinguisher', 'Fire extinguisher', 'Emergency fire-safety equipment, kept within easy reach.'],
  ]) {
    const button = page.locator(`[data-device="${id}"]`);
    await expect(button).toBeVisible();
    await button.hover();
    await expect(tooltip).toBeVisible();
    await expect(page.locator('#device-tooltip-title')).toHaveText(title);
    await expect(page.locator('#device-tooltip-description')).toHaveText(description);
    await expect(page.locator('#device-health-value')).toHaveText(id === 'fire-extinguisher' ? 'Ready' : 'Healthy');
    await expect(page.locator('#device-active-count')).toHaveText('3');
    await expect(page.locator('#device-inactive-count')).toHaveText('0');
    await expect(page.locator('#device-total-count')).toHaveText('3');
    await expect(page.locator('.device-data-note')).toContainText('not live telemetry');
    if (id === 'room-control') {
      await expect(page.locator('#device-readings')).toContainText('22.0 C');
      await expect(page.locator('#device-readings')).toContainText('LightsOn');
      await expect(page.locator('#device-readings')).toContainText('PresenceDetected');
      await expect(page.locator('#device-trend')).toBeVisible();
    } else {
      await expect(page.locator('#device-trend')).toBeHidden();
    }
    await expect(tooltip).toBeInViewport({ ratio: 1 });
    await page.mouse.move(600, 5);
    await expect(tooltip).toBeHidden();
    await button.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await button.evaluate(element => element.blur());
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-device="room-control"]').hover();
  await expect(tooltip).toHaveCSS('transition-duration', '0.18s, 0.18s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(tooltip).toHaveCSS('transition-duration', '0s');
  await page.setViewportSize({ width: 390, height: 844 });
  await seek(page, 5.5);
  const mobileButton = page.locator('[data-device="room-control"]');
  await expect(mobileButton).toBeVisible();
  await mobileButton.click();
  await expect(page.locator('#device-tooltip-title')).toHaveText('Smart room controller');
  await expect(tooltip).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.__FORMA__.getState().time)).toBeCloseTo(5.5, 1);
  await page.locator('.wordmark').click();
  await expect(tooltip).toBeHidden();
  await expect(page.locator('.device-hotspot:visible')).toHaveCount(0);
});

test('mobile device taps select distinct devices without moving the story', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await open(page);
    await seek(page, 5.5);
    for (const id of ['room-control', 'cctv', 'presence', 'fire-extinguisher']) {
      await page.touchscreen.tap(5, 100);
      const button = page.locator(`[data-device="${id}"]`);
      await button.tap();
      await expect(page.locator('#device-tooltip-title')).toHaveText(await button.getAttribute('aria-label'));
      await expect(page.locator('#device-tooltip')).toBeInViewport({ ratio: 0.99999 });
      expect(await page.evaluate(() => window.__FORMA__.getState().time)).toBeCloseTo(5.5, 1);
    }
  } finally {
    await context.close();
  }
});

test('device health cards keep room counts and temperature consistent with the reversible simulation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const [time, temperature, cooling] of [[1.4, '26.5 C', 'Interrupted'], [5.5, '22.0 C', 'Recovered'], [1.4, '26.5 C', 'Interrupted']]) {
    await seek(page, time);
    await page.locator('[data-device="room-control"]').focus();
    await expect(page.locator('#device-tooltip')).toBeVisible();
    const readings = await page.locator('#device-readings>div').evaluateAll(rows =>
      Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
    expect(readings).toMatchObject({ 'Room temperature': temperature, Setpoint: '21.5 C', Cooling: cooling, Lights: 'On', Presence: 'Detected' });
    await expect(page.locator('#device-health-value')).toHaveText('Healthy');
    await expect(page.locator('#device-connection')).toHaveText('Online');
    const points = (await page.locator('#device-trend-line').getAttribute('points')).split(' ').map(point => point.split(',').map(Number));
    expect(points).toHaveLength(12);
    expect(points[0][1]).toBeCloseTo(11.75, 2);
    expect(points.at(-1)[1]).toBeCloseTo(temperature === '22.0 C' ? 36.5 : 11.75, 2);
    const status = await page.evaluate(() => window.__FORMA__.getState());
    expect(status.deviceStatus['room-control'].room).toEqual({ active: 3, inactive: 0, total: 3 });
    expect(status.deviceStatus['room-control'].temperatureTrend.at(-1)).toBe(status.roomController.temperature);
  }
  await seek(page, 5.5);
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await seek(page, 5.5);
    for (const id of ['room-control', 'cctv', 'presence', 'fire-extinguisher']) {
      const button = page.locator(`[data-device="${id}"]`);
      await expect(button).toBeVisible();
      await button.focus();
      await expect(page.locator('#device-tooltip-title')).toHaveText(await button.getAttribute('aria-label'));
      await expect(page.locator('#device-tooltip')).toBeInViewport({ ratio: 0.99999 });
      const bounds = await page.locator('#device-tooltip').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      await expect(page.locator('#device-readings')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.device-data-note')).toBeInViewport({ ratio: 1 });
    }
  }
});

test('ACP panels and reflective glazing follow the original cutaway story', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const state = () => page.evaluate(() => window.__FORMA__.getState());
  const opening = await state();
  expect(opening.facadeDetails.acpPanels).toBe(560);
  expect(opening.facadeDetails.reflectedEnvironment).toBe(true);
  expect(opening.facadeDetails.glassRoughness).toBeLessThan(0.2);
  expect(opening.facadeDetails.clearcoat).toBeGreaterThan(0.5);
  expect(opening.facadeDetails.officePanelOpacity).toBe(1);
  expect(opening.ceilingVisible).toBe(false);
  expect(opening.fireExtinguisher.height).toBeGreaterThan(0.45);
  expect(opening.fireExtinguisher.height).toBeLessThan(0.7);
  await seek(page, 0.75);
  expect((await state()).ceilingVisible).toBe(true);
  await seek(page, 2.5);
  expect((await state()).facadeDetails.officePanelOpacity).toBe(0);
  expect((await state()).ceilingVisible).toBe(false);
  expect((await state()).facadeDetails.upperPanelOpacity).toBe(0);
  await expect(page.locator('.device-hotspot:visible')).toHaveCount(0);
  await seek(page, 8);
  expect((await state()).facadeDetails.officePanelOpacity).toBeCloseTo(0.25, 3);
  expect((await state()).ceilingVisible).toBe(false);
  await seek(page, 0);
  expect((await state()).facadeDetails.officePanelOpacity).toBe(1);
  expect((await state()).ceilingVisible).toBe(false);
});

test('the red floor blinks only after scrolling', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__FORMA__.getState())).alarmHighlightOpacity).toBe(0);
  await seek(page, 0.26);
  const samples = [];
  for (let i = 0; i < 9; i++) {
    samples.push((await page.evaluate(() => window.__FORMA__.getState())).alarmHighlightOpacity);
    await page.waitForTimeout(170);
  }
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.1);
  expect(Math.max(...samples)).toBeLessThanOrEqual(0.58);
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.22);
});

test('airflow follows the room, grilles and coil with moving directional markers', async ({ page }) => {
  await open(page);
  await seek(page, 4.2);
  expect((await page.evaluate(() => window.__FORMA__.getState())).airVisible).toBe(false);
  await seek(page, 5.5);
  const initial = await page.evaluate(() => window.__FORMA__.getState());
  expect(initial.airVisible).toBe(true);
  expect(initial.airflow.supplyColor).not.toBe(initial.airflow.returnColor);
  expect(initial.airflow.coilPasses).toHaveLength(3);
  for (const gap of initial.airflow.connectionGaps) expect(gap).toBeLessThan(0.000001);
  for (const dot of initial.airflow.tangentDots) expect(dot).toBeGreaterThan(0.98);
  for (const [entry, exit] of initial.airflow.coilPasses) {
    expect(entry[1]).toBeCloseTo(initial.dimensions.serviceY + 0.02, 5);
    expect(exit[1]).toBe(entry[1]);
    expect(entry[2]).toBeLessThan(0.305);
    expect(exit[2]).toBeGreaterThan(0.455);
    expect(entry[0]).toBeGreaterThan(-0.66);
    expect(entry[0]).toBeLessThan(0.46);
  }
  for (const passes of initial.airflow.grillePasses) {
    passes.forEach((point, i) => {
      const grille = initial.airflow.grilles[i];
      expect(point[0]).toBeGreaterThan(grille.min[0]);
      expect(point[0]).toBeLessThan(grille.max[0]);
      expect(point[2]).toBeGreaterThan(grille.min[2]);
      expect(point[2]).toBeLessThan(grille.max[2]);
      expect(grille.min[1] - point[1]).toBeCloseTo(0.0175, 4);
    });
  }
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().airflow.arrowPositions)).not.toEqual(initial.airflow.arrowPositions);
  await page.locator('#motion-button').click();
  const paused = await page.evaluate(() => window.__FORMA__.getState().airflow.arrowPositions);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__FORMA__.getState().airflow.arrowPositions)).toEqual(paused);
  await seek(page, 7.8);
  expect((await page.evaluate(() => window.__FORMA__.getState())).airVisible).toBe(false);
  await seek(page, 3.42);
  expect((await page.evaluate(() => window.__FORMA__.getState())).airVisible).toBe(false);
  await page.locator('#motion-button').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seek(page, 5.5);
  const reduced = await page.evaluate(() => window.__FORMA__.getState().airflow.arrowPositions);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__FORMA__.getState().airflow.arrowPositions)).toEqual(reduced);
});

test('scroll catch-up advances smoothly and reverses without a timeline jump', async ({ page }) => {
  await open(page);
  // ScrollTrigger deliberately bypasses scrubbing during its first 500 ms.
  await page.waitForTimeout(650);
  for (const [target, direction] of [[2.5, 1], [0, -1]]) {
    const samples = await page.evaluate(async time => {
      const frames = [window.__FORMA__.getState().time];
      window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * time / 8, behavior: 'instant' });
      const started = performance.now();
      while (performance.now() - started < 1600) {
        await new Promise(requestAnimationFrame);
        frames.push(window.__FORMA__.getState().time);
      }
      return frames;
    }, target);
    expect(samples.filter(time => time > 0.05 && time < 2.45).length).toBeGreaterThan(2);
    for (let i = 1; i < samples.length; i++) {
      expect((samples[i] - samples[i - 1]) * direction).toBeGreaterThanOrEqual(-0.00001);
    }
    await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().time)).toBeCloseTo(target, 1);
  }
});

test('high-density displays keep the canvas within its rendering budget', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1890, height: 928 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await open(page);
    const size = await page.locator('#scene canvas').evaluate(canvas => ({
      pixels: canvas.width * canvas.height,
      cssWidth: canvas.getBoundingClientRect().width,
      cssHeight: canvas.getBoundingClientRect().height,
    }));
    expect(size.pixels).toBeLessThanOrEqual(3000000);
    expect(size.cssWidth).toBe(1890);
    expect(size.cssHeight).toBe(928);
    expect(await page.evaluate(() => window.__FORMA__.getState().drawCalls)).toBeLessThan(500);
  } finally {
    await context.close();
  }
});

test('FCU fits above a human-scale room and the water circuit has no disconnected joints', async ({ page }) => {
  await open(page);
  const { dimensions, pipeConnectionGaps } = await page.evaluate(() => window.__FORMA__.getState());
  expect(dimensions.clearRoomHeight).toBeCloseTo(2.72, 2);
  expect(dimensions.fcuBottom).toBeGreaterThan(dimensions.ceilingY + 0.025);
  expect(dimensions.fcuTop).toBeLessThan(dimensions.upperSlabY);
  expect(dimensions.fcuTop - dimensions.fcuBottom).toBeCloseTo(0.32, 2);
  expect(dimensions.fcuWidth).toBe(1.5);
  expect(dimensions.fcuDepth).toBe(0.9);
  expect(dimensions.diffuserHeight).toBeCloseTo(dimensions.ceilingY - 0.025, 3);
  expect(dimensions.branchRadius * 2).toBeLessThan(0.06);
  expect(dimensions.coilRadius * 2).toBeLessThan(0.02);
  for (const gap of pipeConnectionGaps) expect(gap).toBeLessThan(0.000001);
});

test('mobile layout stays within the viewport and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => window.__FORMA__.getState())).toMatchObject({ paused: true, reducedMotion: true });
  await page.locator('[data-chapter="5"]').click();
  await expect(page.locator('[data-chapter="5"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#alarm-panel')).toBeInViewport();
  await expect(page.locator('#scroll-cue')).toBeHidden();
  const fixed = await page.evaluate(() => window.__FORMA__.getState());
  await page.waitForTimeout(200);
  const fixedAfter = await page.evaluate(() => window.__FORMA__.getState());
  expect(fixedAfter.turbineAngles).toEqual(fixed.turbineAngles);
  expect(fixedAfter.vehiclePositions).toEqual(fixed.vehiclePositions);
  await page.locator('[data-chapter="0"]').click();
  await expect(page.locator('[data-chapter="0"]')).toHaveAttribute('aria-current', 'step');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__FORMA__.getState().reducedMotion)).toBe(false);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.locator('.chapter-bar')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.chapter-bar')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
});
