import { serve } from 'inngest/next';
import { env, isProduction } from '@/lib/env';
import { inngest } from '@/lib/jobs/client';
import { functions } from '@/lib/jobs/functions';
import { auditFunctions } from '@/modules/audit/queries';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...functions, ...auditFunctions],
  // Registration (PUT) needs a valid signature too once the client runs in cloud mode.
  enableUnauthedSync: false,
  // Never derive the callback origin from request headers in production.
  ...(isProduction ? { serveOrigin: env.APP_URL } : {}),
});
