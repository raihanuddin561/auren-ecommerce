// Default environment for unit tests. Real values come from the test container in integration runs.
process.env.DATABASE_URL ??= 'postgresql://auren:auren@localhost:5432/auren_test';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL ??= 'silent';
