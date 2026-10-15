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
  // A team sold when ANY seller in its scope last sold. Monthly zero-sales
  // headcount is a separate metric; missing dates do not erase known sales.
  const days=sellers.map(p=>daysWithoutSale(data.latestByUser[p.id]?.lastSaleDate,now))
    .filter((day):day is number=>day!==null);
  return days.length?Math.min(...days):null;
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
