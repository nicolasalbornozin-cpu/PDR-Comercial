export type UserRole = 'seller' | 'coordinator' | 'sales_manager' | 'admin';

export const roleLabels: Record<UserRole, string> = {
  seller: 'Vendedor/a',
  coordinator: 'Coordinador/a',
  sales_manager: 'Jefe/a de ventas',
  admin: 'Administrador/a',
};

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
  active: boolean;
  mustChangePassword: boolean;
}

export type SnapshotKind =
  | 'commercial'
  | 'senior'
  | 'category'
  | 'delinquency'
  | 'salesforce'
  | 'ranking';

export const snapshotKindLabels: Record<SnapshotKind, string> = {
  commercial: 'Avance comercial',
  senior: 'Senior',
  category: 'Categorización',
  delinquency: 'Mora / Sauce',
  salesforce: 'Salesforce',
  ranking: 'Ranking',
};

export interface MetricSnapshot {
  id: number;
  batchId: string;
  userId: string;
  kind: SnapshotKind;
  periodStart: string;
  periodEnd: string;
  sourceName: string;
  publishedAt: string;
  productionUf?: number;
  grossUf?: number;
  sepulturaUf?: number;
  ssffUf?: number;
  cinerarioUf?: number;
  ssaaUf?: number;
  emittedUf?: number;
  notEmittedUf?: number;
  notUploadedUf?: number;
  cancellationUf?: number;
  quarterTotalUf?: number;
  eligibleTotalUf?: number;
  businessCount?: number;
  smadCount?: number;
  restCount?: number;
  ssffCount?: number;
  delinquentClientsCount?: number;
  delinquencyRate?: number;
  salesforceRecords?: number;
  tenureMonths?: number;
  rankingPosition?: number;
  category?: string;
  seniorLevel?: string;
  estimatedPrizeClp?: number;
}

export interface VisibleProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  teamId: string;
  supervisorId: string;
  salesManagerId: string;
  active: boolean;
}

export interface DashboardData {
  profiles: VisibleProfile[];
  snapshots: MetricSnapshot[];
  latestByUser: Record<string, Partial<MetricSnapshot>>;
  periodLabel: string;
}

export interface AdminUser {
  id: string;
  name: string;
  rut: string;
  role: UserRole;
  active: boolean;
  teamId: string;
  supervisorId: string;
  salesManagerId: string;
  createdAt: string;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  status: 'pending' | 'resolved' | 'dismissed';
  requestCount: number;
  requestedAt: string;
  lastRequestedAt: string;
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
