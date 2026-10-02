import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { clientEnv } from './env.client';

/** Browser client for sign-in forms, social login and two-factor enrolment. */
export const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_APP_URL,
  plugins: [twoFactorClient()],
});
