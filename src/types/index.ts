export type UserRole = 'seller' | 'coordinator' | 'sales_manager' | 'admin';
export type EmploymentStatus = 'active' | 'detached' | 'medical_leave' | 'vacation';

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  active: 'Activo/a',
  detached: 'Desvinculado/a',
  medical_leave: 'Licencia',
  vacation: 'Vacaciones',
};

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
  birthDate?: string;
  employmentStatus: EmploymentStatus;
  active: boolean;
  mustChangePassword: boolean;
}

export type SnapshotKind =
  | 'commercial'
  | 'sales'
  | 'emission'
  | 'senior'
  | 'category'
  | 'delinquency'
  | 'sauce'
  | 'salesforce'
  | 'ranking';

export const snapshotKindLabels: Record<SnapshotKind, string> = {
  commercial: 'Avance comercial',
  sales: 'Venta emitida',
  emission: 'Emisión',
  senior: 'Senior',
  category: 'Categorización',
  delinquency: 'Mora',
  sauce: 'Sauce',
  salesforce: 'Salesforce',
  ranking: 'Ranking',
};

export const snapshotRefreshCadence: Record<SnapshotKind, string> = {
  commercial: 'Panel anual y mes comercial',
  sales: 'Diaria o cada 2 días',
  emission: '1 vez por semana',
  senior: 'Según vigencia de la carrera',
  category: 'Según cierre del mes comercial',
  delinquency: '1 vez por semana',
  sauce: '2 veces al mes',
  salesforce: 'Según actualización operativa',
  ranking: 'Se calcula automáticamente',
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
  cancellationCount?: number;
  sungUf?: number;
  quarterTotalUf?: number;
  eligibleTotalUf?: number;
  businessCount?: number;
  productivity?: number;
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
  lastSaleDate?: string;
  debtInstallmentsCount?: number;
  debtUf0?: number;
  debtUf8?: number;
  seniorStatus?: 'open' | 'closed';
}

export interface VisibleProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  teamId: string;
  supervisorId: string;
  salesManagerId: string;
  birthDate?: string;
  employmentStatus: EmploymentStatus;
  active: boolean;
}

export interface DashboardData {
  profiles: VisibleProfile[];
  snapshots: MetricSnapshot[];
  latestByUser: Record<string, Partial<MetricSnapshot>>;
  annualEmittedUfByUser: Record<string, number>;
  monthlyEmittedUfByUser: Record<string, number>;
  periodLabel: string;
  seniorOpen: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  rut: string;
  role: UserRole;
  employmentStatus: EmploymentStatus;
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
export type RankingPeriod = 'annual' | 'monthly';
