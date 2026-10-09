import { serve } from 'inngest/next';
import { env, isProduction } from '@/lib/env';
import { inngest } from '@/lib/jobs/client';
import { functions } from '@/lib/jobs/functions';
import { auditFunctions } from '@/modules/audit/queries';
import { cartFunctions } from '@/modules/cart/queries';
import { notificationFunctions } from '@/modules/notifications/queries';
import { orderFunctions } from '@/modules/orders/queries';
import { inventoryFunctions } from '@/modules/inventory/queries';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...functions,
    ...auditFunctions,
    ...inventoryFunctions,
    ...cartFunctions,
    ...orderFunctions,
    ...notificationFunctions,
  ],
  // Registration (PUT) needs a valid signature too once the client runs in cloud mode.
  enableUnauthedSync: false,
  // Never derive the callback origin from request headers in production.
  ...(isProduction ? { serveOrigin: env.APP_URL } : {}),
});
