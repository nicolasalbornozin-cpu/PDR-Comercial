export type UserRole = 'executive' | 'coordinator' | 'sales_manager';

export interface User {
  id: string;
  name: string;
  email: string;
  rut: string;
  role: UserRole;
  avatar: string;
  teamId: string;
  supervisorId: string;
  salesManagerId: string;
  joinDate: string;
}

export interface ExecutiveMetrics {
  userId: string;
  ufSold: number;
  delinquencyRate: number;
  businessCount: number;
  salesforceRecords: number;
  rankingPosition: number;
  updatedAt: string;
}

export type GoalStatus = 'completed' | 'in_progress' | 'pending';
export type GoalMetric = 'uf' | 'businesses' | 'delinquency';

export interface Goal {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  metric: GoalMetric;
  currentValue: number;
  targetValue: number;
  unit: 'UF' | '%' | 'negocios';
  level: string;
  status: GoalStatus;
}

export interface Competition {
  id: string;
  name: string;
  type: 'category' | 'senior' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  metric: GoalMetric;
  active: boolean;
}

export interface RankingEntry {
  userId: string;
  name: string;
  avatar: string;
  value: number;
  position: number;
  teamId: string;
  subtitle?: string;
  isCurrentUser?: boolean;
}

export interface Team {
  id: string;
  name: string;
  salesManagerId: string;
  totalUF: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  body: string;
  image: string;
  date: string;
  featured: boolean;
  category: string;
}

export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  relativeDate: string;
  tone: 'success' | 'gold' | 'neutral';
}

export type RankingMode = 'sellers' | 'teams' | 'management';
