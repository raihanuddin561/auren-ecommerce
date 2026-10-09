import 'server-only';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import type { ExpenseFilterInput, PAndLFilterInput } from './schemas';
import * as service from './service';
import type {
  ExpenseCategoryItem,
  ExpenseListResult,
  FinanceOverviewMetrics,
  MarketingCampaignItem,
  ProductProfitabilityRow,
  ProfitAndLossReport,
  RecurringExpenseItem,
} from './types';

export async function getExpenseCategoriesForAdmin(): Promise<ExpenseCategoryItem[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getExpenseCategories();
}

export async function getMarketingCampaignsForAdmin(): Promise<MarketingCampaignItem[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getMarketingCampaigns();
}

export async function getRecurringExpensesForAdmin(): Promise<RecurringExpenseItem[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getRecurringExpenses();
}

export async function getExpensesForAdmin(params: ExpenseFilterInput): Promise<ExpenseListResult> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getExpenses(params);
}

export async function getProfitAndLossReportForAdmin(
  params: PAndLFilterInput,
): Promise<ProfitAndLossReport> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getProfitAndLossReport(params);
}

export async function getProductProfitabilityForAdmin(
  limit = 50,
): Promise<ProductProfitabilityRow[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getProductProfitability(limit);
}

export async function getFinanceOverviewForAdmin(): Promise<FinanceOverviewMetrics> {
  const staff = await requireStaff();
  assertPermission(staff, 'finance.read');
  return service.getFinanceOverview();
}
