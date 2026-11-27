import { expect, test } from './fixtures';

test('the app name and mark sit at the very top of the sidebar', async ({ launch }) => {
  const { sidebar } = await launch();
  const name = sidebar.getByRole('heading', { level: 1 });
  await expect(name).toBeVisible();
  await expect(sidebar.locator('.brand-logo')).toBeVisible();

  const aside = await sidebar.locator('aside').boundingBox();
  const title = await name.boundingBox();
  const logo = await sidebar.locator('.brand-logo').boundingBox();
  if (!aside || !title || !logo) throw new Error('the sidebar header is not laid out');

  // Nothing but the header sits above the name: no gap of dead space.
  expect(title.y - aside.y).toBeLessThan(48);
  // The mark comes first, then the name, both on one line.
  expect(logo.x).toBeLessThan(title.x);
  expect(Math.abs(logo.y + logo.height / 2 - (title.y + title.height / 2))).toBeLessThan(6);
  // The name is larger than the account names below it.
  const accountSize = await sidebar
    .locator('.account .name')
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  const titleSize = await name.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(titleSize).toBeGreaterThan(accountSize);
});
