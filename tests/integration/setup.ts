import os from 'node:os';
import path from 'node:path';
import { inject } from 'vitest';

// Runs before any test file imports application code, so lib/env and lib/db see the test database.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.DIRECT_URL = '';
process.env.BETTER_AUTH_SECRET ??= 'integration-secret-0123456789abcdef0123456789';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'silent';
// No email provider: auth mail is captured in memory (see getLoggedEmails).
process.env.RESEND_API_KEY = '';
process.env.SMTP_URL = '';
// Uploaded media goes to a throwaway folder, never into the working tree.
process.env.MEDIA_LOCAL_DIR ??= path.join(os.tmpdir(), 'auren-test-media');
