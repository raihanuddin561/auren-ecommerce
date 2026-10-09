import 'server-only';
import * as service from './service';
import type { StaffMemberRecord } from './types';

export async function getStaffDirectoryForAdmin(): Promise<StaffMemberRecord[]> {
  return service.listStaff();
}
