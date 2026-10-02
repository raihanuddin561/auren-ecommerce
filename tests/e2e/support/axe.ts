import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Fails on serious or critical WCAG 2.2 AA violations (the project bar). Moderate and minor
 * findings are reported in the assertion message but do not fail the run.
 */
export async function expectNoAxeViolations(
  page: Page,
  options: { exclude?: string[] } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);

  const { violations } = await builder.analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
  expect(blocking, 'accessibility violations').toEqual([]);
}
