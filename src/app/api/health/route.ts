import { connection } from 'next/server';
import { runHealthChecks } from '@/lib/health.server';

/** Uptime monitor target: database and Redis reachability. Public, cheap, no personal data. */
export async function GET() {
  // Always evaluated per request, never prerendered at build time.
  await connection();
  const report = await runHealthChecks();
  return Response.json(report, {
    status: report.status === 'down' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
