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
  // Sum inactivity only for workers with zero monthly UF. Unknown dates stay unknown.
  const inactive=sellers.filter(p=>hasMonthWithoutSale(data.latestByUser[p.id],now));
  const days=inactive.map(p=>daysWithoutSale(data.latestByUser[p.id]?.lastSaleDate,now));
  return days.some(d=>d===null)?null:days.reduce<number>((sum,d)=>sum+(d??0),0);
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
