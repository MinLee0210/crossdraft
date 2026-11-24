import { expect, test, type Page } from '@playwright/test';
import { EN } from '../lib/i18n';

const t = (k: string) => EN[k] as string;

async function open(page: Page) {
  await page.goto('/app');
  await page
    .getByRole('button', { name: t('onb.close') })
    .click({ timeout: 4000 })
    .catch(() => {}); // the tour is not shown on every viewport
  await expect(page.locator('canvas#cv')).toBeVisible();
}
async function tab(page: Page, id: 'boards' | 'wind' | 'results' | 'compare' | 'layouts') {
  // On a phone the side panel starts closed.
  const show = page.getByRole('button', { name: t('side.show') });
  if (await show.isVisible()) await show.click();
  await page.getByRole('tab', { name: t('tab.' + id) }).click();
}
/** Opens the Save and load box and returns the current layout code. */
async function exportCode(page: Page): Promise<string> {
  await tab(page, 'layouts');
  const box = page.getByLabel(t('code.label'));
  if (!(await box.isVisible())) await page.getByText(t('code.title'), { exact: true }).click();
  await page.getByRole('button', { name: t('code.export'), exact: true }).click();
  return box.inputValue();
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const b = (await page.locator('canvas#cv').boundingBox())!;
  await page.mouse.move(b.x + from[0], b.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + (from[0] + to[0]) / 2, b.y + (from[1] + to[1]) / 2, { steps: 5 });
  await page.mouse.move(b.x + to[0], b.y + to[1], { steps: 5 });
  await page.mouse.up();
}

test('the app loads and shows a drawing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.waitForTimeout(500);
  expect(await exportCode(page)).not.toBe('');
  expect(errors).toEqual([]);
});

test('drawing a wall changes the layout, and undo restores it', async ({ page }) => {
  await open(page);
  const before = await exportCode(page);
  await page.keyboard.press('2'); // Line tool
  await drag(page, [300, 500], [520, 500]);
  const after = await exportCode(page);
  expect(after).not.toBe(before);
  await page.getByRole('button', { name: t('run.undo') }).click();
  expect(await exportCode(page)).toBe(before);
});

test('the drawing survives a reload', async ({ page }) => {
  await open(page);
  await page.keyboard.press('2');
  await drag(page, [300, 520], [540, 520]);
  const drawn = await exportCode(page);
  await page.waitForTimeout(900); // the engine saves 600 ms after the last edit
  await page.reload();
  await page
    .getByRole('button', { name: t('onb.close') })
    .click({ timeout: 2000 })
    .catch(() => {});
  expect(await exportCode(page)).toBe(drawn);
});

test('an exported code loads again', async ({ page }) => {
  await open(page);
  const code = await exportCode(page);
  await page.keyboard.press('2');
  await drag(page, [300, 500], [520, 500]);
  expect(await exportCode(page)).not.toBe(code);
  await page.getByLabel(t('code.label')).fill(code);
  await page.getByRole('button', { name: t('code.import'), exact: true }).click();
  await expect(page.getByText(t('msg.loaded'))).toBeVisible();
  expect(await exportCode(page)).toBe(code);
});

test('drawing works from the keyboard alone', async ({ page }) => {
  await open(page);
  const before = await exportCode(page);
  await page.keyboard.press('2'); // Line tool
  await page.locator('canvas#cv').focus();
  await page.keyboard.press('Enter'); // start at the cursor
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Enter'); // finish
  expect(await exportCode(page)).not.toBe(before);
});

test('a linked copy follows its source and refuses drawing', async ({ page }) => {
  await open(page);
  await tab(page, 'boards');
  await page
    .getByRole('button', { name: t('boards.link') })
    .first()
    .click();
  await expect(page.getByText(t('boards.follows').replace('{name}', '')).first()).toBeVisible();
  await expect(page.getByRole('button', { name: t('boards.unlink') })).toBeVisible();
  // the copy is selected: drawing on it shows the hint instead of changing it
  await page.getByRole('button', { name: t('side.hide') }).click();
  await page.keyboard.press('2');
  await page.locator('canvas#cv').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toBeVisible();
});

test('the theme toggle switches data-theme', async ({ page }) => {
  await open(page);
  const html = page.locator('html');
  await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
  const a = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
  const b = await html.getAttribute('data-theme');
  expect([a, b].sort()).toEqual(['dark', 'light']);
});

test('a storage error shows the warning instead of failing silently', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'crossdraft.v3') throw new DOMException('full', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  await open(page);
  await page.keyboard.press('2');
  await drag(page, [300, 520], [540, 520]);
  await expect(page.locator('.savewarn')).toContainText(t('msg.saveFull'));
});

test('the wind sweep finishes, using workers', async ({ page }) => {
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  await open(page);
  await tab(page, 'compare');
  await page.getByLabel(t('sweep.len')).selectOption('30');
  await page.getByRole('button', { name: t('sweep.run') }).click();
  await expect(page.locator('svg.rose')).toBeVisible({ timeout: 100_000 });
  expect(workers.length).toBeGreaterThan(0);
});

test('drawing works by touch @phone', async ({ page }) => {
  await open(page);
  const before = await exportCode(page);
  await page.getByRole('button', { name: t('side.hide') }).click(); // the panel covers the canvas on a phone
  await page.getByRole('button', { name: t('tool.line.name') }).tap();
  const b = (await page.locator('canvas#cv').boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const y = b.y + b.height / 2;
  const pt = (x: number) => [{ x: b.x + x, y }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(60) });
  for (let x = 80; x <= 220; x += 20) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await exportCode(page)).not.toBe(before);
});
