import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { clientEnv } from './env.client';

/** Browser client for sign-in forms, social login and two-factor enrolment. */
// In the browser the client talks to the origin it was loaded from (works on any local port and
// for 127.0.0.1 as well as localhost); on the server it needs the configured public URL.
export const authClient = createAuthClient({
  ...(typeof window === 'undefined' ? { baseURL: clientEnv.NEXT_PUBLIC_APP_URL } : {}),
  plugins: [twoFactorClient()],
});
