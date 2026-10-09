import { db } from '@/lib/db';
import { listPendingApprovals } from './service';

/** Requests waiting for a second person (admin read). */
export const getPendingApprovals = () => listPendingApprovals(db);
