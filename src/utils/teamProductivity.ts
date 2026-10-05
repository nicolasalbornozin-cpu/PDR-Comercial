import { DashboardData, User } from '../types';

export function teamProductivityRows(data: DashboardData, user: User) {
  if (!['coordinator', 'sales_manager', 'commercial_manager', 'sales_director', 'admin'].includes(user.role)) return [];
  return data.profiles.filter(person => person.role === 'seller' && person.active && person.employmentStatus === 'active'
    && (user.role === 'admin' || user.role === 'commercial_manager' || user.role === 'sales_director' || user.role === 'coordinator' && person.supervisorId === user.id
      || user.role === 'sales_manager' && person.salesManagerId === user.id))
    .map(person => ({ person, metric: data.latestByUser[person.id] }))
    .sort((a, b) => (b.metric?.productivity ?? -1) - (a.metric?.productivity ?? -1) || a.person.name.localeCompare(b.person.name, 'es'));
}
