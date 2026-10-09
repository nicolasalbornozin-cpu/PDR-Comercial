import { DashboardData, User, VisibleProfile } from '../types';
import { daysWithoutSale, hasMonthWithoutSale } from './commercialRules';

export function scopedSellers(data: DashboardData, user: User, scope?: VisibleProfile) {
  return data.profiles.filter(p => p.role === 'seller' && p.active && p.employmentStatus === 'active'
    && (user.role === 'admin' || ['commercial_manager','sales_director'].includes(user.role)
      || user.role === 'sales_manager' && p.salesManagerId === user.id
      || user.role === 'coordinator' && p.supervisorId === user.id
      || user.role === 'seller' && p.id === user.id)
    && (!scope || scope.role === 'coordinator' && p.supervisorId === scope.id
      || scope.role === 'sales_manager' && p.salesManagerId === scope.id));
}

export function teamDaysWithoutSale(sellers: VisibleProfile[], data: Pick<DashboardData,'latestByUser'>, now = new Date()) {
  // The team's last sale is the most recent seller sale, not their average or maximum inactivity.
  const dates = sellers.map(p => data.latestByUser[p.id]?.lastSaleDate)
    .filter((date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date))).sort();
  return daysWithoutSale(dates.at(-1), now);
}

export function teamSummary(sellers: VisibleProfile[], data: DashboardData) {
  const metrics = sellers.map(p => data.latestByUser[p.id]);
  const productivity = metrics.map(m => m?.productivity).filter((n): n is number => n !== undefined);
  return {
    debt: metrics.reduce((sum,m) => sum + (m?.debtSalesCount ?? 0),0),
    productivity: productivity.length ? productivity.reduce((sum,n) => sum+n,0)/productivity.length : undefined,
    zero: metrics.filter(m => hasMonthWithoutSale(m)).length,
    days: teamDaysWithoutSale(sellers,data),
  };
}
