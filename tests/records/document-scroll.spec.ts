import { test, expect } from '../support/records-fixtures';
import { createRecordUI, reloadRecord } from '../support/records-ui';

test.use({ viewport: { width: 1440, height: 900 } });

test('the floating view selector does not clip the document while scrolling', async ({ page, records }) => {
  const category = await records.category(Array.from({ length: 24 }, (_, index) => ({
    id: `metric-${index}`,
    name: `metric_${index}`,
    label: `Metric ${index}`,
    type: 'number',
  })));
  const record = await createRecordUI(page, records, category);
  await reloadRecord(page, record.title);

  const documentTab = page.getByRole('tab', { name: 'Document', exact: true });
  const title = page.getByPlaceholder('Record Title', { exact: true });
  const scrollArea = page.getByTestId('record-document-scroll');
  const selector = (await documentTab.boundingBox())!;
  const initialTitle = (await title.boundingBox())!;
  expect(initialTitle.y).toBeGreaterThan(selector.y + selector.height);

  await scrollArea.evaluate((element, offset) => { element.scrollTop = offset; }, initialTitle.y - selector.y);
  await expect.poll(async () => (await title.boundingBox())!.y).toBeCloseTo(selector.y, 0);
  expect(await title.evaluate((input) => {
    const { left, top, height } = input.getBoundingClientRect();
    return document.elementFromPoint(left + 8, top + height / 2) === input;
  })).toBe(true);
  expect(await documentTab.boundingBox()).toEqual(selector);
});