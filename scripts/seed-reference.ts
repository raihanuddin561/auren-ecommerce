/**
 * Installs the reference data a shop needs before it can take an order: the Bangladesh delivery
 * areas (divisions, districts, thanas) and the two default delivery zones. Safe to run again: it
 * only adds what is missing and never edits or removes a row, so an owner's changes survive.
 *
 *   pnpm db:seed:reference
 *
 * Run it once on a new production database after migrating (it needs DATABASE_URL, like the owner
 * script). It carries no demo data.
 */
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

const { db } = await import('../src/lib/db');
const { ensureReferenceData } = await import('../src/modules/shipping/service');
const { geoCoverage } = await import('../src/modules/shipping/geo-data');

try {
  const result = await db.$transaction((tx) => ensureReferenceData(tx), { timeout: 60_000 });
  const coverage = geoCoverage();
  console.log(
    `Delivery areas: ${result.areasAdded} added; default zones: ${result.zonesAdded} added. ` +
      `Coverage: ${coverage.divisions} divisions, ${coverage.districts} districts, ` +
      `${coverage.thanas} thanas and upazilas in ${coverage.districtsWithThanas} districts. ` +
      'Other districts take the thana as free text at checkout.',
  );
} finally {
  await db.$disconnect();
}
