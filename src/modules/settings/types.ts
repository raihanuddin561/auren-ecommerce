import type { CheckoutProtection } from './schemas';

export interface CheckoutSettingsView extends CheckoutProtection {
  codEnabled: boolean;
  /** Whole taka, for the form. */
  codMaxOrder: string;
}

export interface SystemHealthData {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  database: {
    status: 'connected' | 'disconnected';
    latencyMs: number;
  };
  outbox: {
    pending: number;
    dispatched: number;
    failed: number;
    oldestPendingAgeMinutes: number | null;
  };
  inbox: {
    processedCount: number;
  };
  services: {
    emailProvider: string;
    emailConfigured: boolean;
    storageProvider: string;
    inngestConfigured: boolean;
    redisConfigured: boolean;
    sentryConfigured: boolean;
    maintenanceMode: boolean;
  };
  environment: {
    nodeEnv: string;
    appUrl: string;
    serverTimeDhaka: string;
  };
}
