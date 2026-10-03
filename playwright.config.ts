import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);
const externalURL = process.env.E2E_BASE_URL;
const baseURL = externalURL ?? `http://localhost:${PORT}`;
// Second server with the test-only staff bypass (src/lib/test-bypass.ts), for admin screens that
// are rendered without a database. It is never started against a deployed preview.
const BYPASS_PORT = PORT + 1;
const bypassURL = `http://localhost:${BYPASS_PORT}`;
const withDatabase = process.env.E2E_WITH_DB === '1';
// Visual baselines are per platform (win32, linux). Opt in with E2E_VISUAL=1.
const withVisual = process.env.E2E_VISUAL === '1';

/**
 * *.db.spec.ts needs a migrated PostgreSQL (E2E_WITH_DB=1 and a throwaway DATABASE_URL).
 * *.local.spec.ts must not run against a deployed preview (E2E_BASE_URL), for example because
 * it would trip rate limits for a real address.
 * *.bypass.spec.ts runs against the bypass server only; *.visual.*.spec.ts only with E2E_VISUAL=1.
 */
function specPattern(kind: 'public' | 'bypass'): RegExp {
  const excluded = [
    withDatabase ? null : 'db',
    externalURL ? 'local' : null,
    withVisual ? null : 'visual',
    kind === 'public' ? 'bypass' : null,
  ].filter(Boolean);
  const negative = excluded.length > 0 ? `(?!.*\\.(${excluded.join('|')})\\.)` : '';
  const required = kind === 'bypass' ? '(?=.*\\.bypass\\.spec\\.ts$)' : '';
  return new RegExp(`^${required}${negative}.*\\.spec\\.ts$`);
}

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
const mobile = {
  ...devices['Desktop Chrome'],
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
};

const sharedEnv = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://auren:auren@localhost:5432/auren_e2e_test',
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? 'e2e-secret-0123456789abcdef0123456789abcdef',
  INNGEST_DEV: '1',
  // Production build served from localhost: the explicit opt-out of the production boot guards.
  LOCAL_PRODUCTION: '1',
  // The test client sets x-forwarded-for itself to get its own rate-limit bucket.
  TRUSTED_PROXY: 'forwarded',
  LOG_LEVEL: 'warn',
};

/** E2E runs against the production build (`pnpm test:e2e` builds first, then runs). */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL,
    // Vercel Deployment Protection bypass for preview runs (secret set in the workflow).
    // The bypass secret is only ever sent to Vercel preview hosts.
    extraHTTPHeaders:
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET &&
      /^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(process.env.E2E_BASE_URL ?? '')
        ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
        : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', testMatch: specPattern('public'), use: desktop },
    { name: 'mobile', testMatch: specPattern('public'), use: mobile },
    ...(externalURL
      ? []
      : [
          {
            name: 'desktop-admin',
            testMatch: specPattern('bypass'),
            use: { ...desktop, baseURL: bypassURL },
          },
          {
            name: 'mobile-admin',
            testMatch: specPattern('bypass'),
            use: { ...mobile, baseURL: bypassURL },
          },
        ]),
  ],
  // Against a deployed preview there is nothing to start.
  webServer: externalURL
    ? undefined
    : [
        {
          command: `pnpm exec next start -p ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { ...sharedEnv, APP_URL: baseURL, NEXT_PUBLIC_APP_URL: baseURL },
        },
        {
          command: `pnpm exec next start -p ${BYPASS_PORT}`,
          // Readiness probe on a console page: the first request of a per-request-rendered route
          // loads the whole server bundle, which can take a while on a cold machine.
          url: `${bypassURL}/admin/style-guide`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...sharedEnv,
            APP_URL: bypassURL,
            NEXT_PUBLIC_APP_URL: bypassURL,
            E2E_STAFF_BYPASS: '1',
          },
        },
      ],
});
