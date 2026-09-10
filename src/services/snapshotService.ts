import { currentUser, executiveMetrics, sellerRanking, teamRanking } from '@/data/mockData';
import { supabase } from '@/services/supabase';
import { DashboardData, MetricSnapshot, RankingEntry, RankingPeriod, User, VisibleProfile } from '@/types';
import { individualSheetService } from './individualSheetService';

interface SnapshotRequestOptions {
  preview?: boolean;
}

interface PreviewMetricSeed {
  businessCount: number;
  productivity: number;
  category: string;
  delinquencyRate: number;
  delinquentClientsCount: number;
  estimatedPrizeClp: number;
  productionUf: number;
  annualEmittedUf: number;
  monthlyEmittedUf: number;
  cancellationCount: number;
  lastSaleDate: string;
  debtInstallmentsCount: number;
  debtUf0: number;
  debtUf8: number;
  salesforceRecords: number;
  seniorLevel: string;
}

const previewSellerNames = [
  'Andrea Contreras',
  'Desiree Muñoz',
  'Maritza Araya',
  'Juan Ramírez',
  'Erika Sepúlveda',
  'Camila Rojas',
  'Felipe Soto',
  'Valentina Pérez',
];

const previewMetricSeeds: PreviewMetricSeed[] = [
  { productionUf: 2480, annualEmittedUf: 16840, monthlyEmittedUf: 1320, businessCount: 10, productivity: 1.42, delinquentClientsCount: 1, delinquencyRate: 12.4, cancellationCount: 1, lastSaleDate: '2026-09-02', debtInstallmentsCount: 3, debtUf0: 18, debtUf8: 9, salesforceRecords: 61, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 680000 },
  { productionUf: 2150, annualEmittedUf: 15310, monthlyEmittedUf: 1180, businessCount: 9, productivity: 1.18, delinquentClientsCount: 2, delinquencyRate: 21.6, cancellationCount: 2, lastSaleDate: '2026-08-31', debtInstallmentsCount: 5, debtUf0: 27, debtUf8: 14, salesforceRecords: 56, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 590000 },
  { productionUf: 1980, annualEmittedUf: 14180, monthlyEmittedUf: 1090, businessCount: 8, productivity: 0.86, delinquentClientsCount: 2, delinquencyRate: 32.1, cancellationCount: 3, lastSaleDate: '2026-08-28', debtInstallmentsCount: 8, debtUf0: 42, debtUf8: 22, salesforceRecords: 49, category: 'Oro', seniorLevel: 'Senior', estimatedPrizeClp: 510000 },
  { productionUf: 1910, annualEmittedUf: 13620, monthlyEmittedUf: 1020, businessCount: 7, productivity: 1.03, delinquentClientsCount: 3, delinquencyRate: 18.8, cancellationCount: 1, lastSaleDate: '2026-08-30', debtInstallmentsCount: 4, debtUf0: 21, debtUf8: 11, salesforceRecords: 47, category: 'Oro', seniorLevel: 'Senior', estimatedPrizeClp: 470000 },
  { productionUf: 1833, annualEmittedUf: 12940, monthlyEmittedUf: 960, businessCount: 6, productivity: 0.94, delinquentClientsCount: 3, delinquencyRate: 24.8, cancellationCount: 2, lastSaleDate: '2026-08-27', debtInstallmentsCount: 6, debtUf0: 34, debtUf8: 17, salesforceRecords: 43, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 450000 },
  { productionUf: 1690, annualEmittedUf: 11860, monthlyEmittedUf: 880, businessCount: 6, productivity: 1.08, delinquentClientsCount: 4, delinquencyRate: 16.3, cancellationCount: 2, lastSaleDate: '2026-09-01', debtInstallmentsCount: 5, debtUf0: 26, debtUf8: 13, salesforceRecords: 39, category: 'Plata', seniorLevel: 'Senior', estimatedPrizeClp: 360000 },
  { productionUf: 1540, annualEmittedUf: 10720, monthlyEmittedUf: 790, businessCount: 5, productivity: 0.72, delinquentClientsCount: 4, delinquencyRate: 30.8, cancellationCount: 4, lastSaleDate: '2026-08-24', debtInstallmentsCount: 9, debtUf0: 48, debtUf8: 25, salesforceRecords: 36, category: 'Plata', seniorLevel: 'Senior inicial', estimatedPrizeClp: 310000 },
  { productionUf: 1420, annualEmittedUf: 9940, monthlyEmittedUf: 710, businessCount: 5, productivity: 1.0, delinquentClientsCount: 5, delinquencyRate: 19.4, cancellationCount: 1, lastSaleDate: '2026-08-29', debtInstallmentsCount: 4, debtUf0: 20, debtUf8: 10, salesforceRecords: 32, category: 'Bronce', seniorLevel: 'En carrera', estimatedPrizeClp: 260000 },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function latestByUser(snapshots: MetricSnapshot[]): Record<string, Partial<MetricSnapshot>> {
  return [...snapshots]
    .sort((left, right) => left.publishedAt.localeCompare(right.publishedAt))
    .reduce<Record<string, Partial<MetricSnapshot>>>((result, snapshot) => {
      const definedValues = Object.fromEntries(
        Object.entries(snapshot).filter(([, value]) => value !== undefined && value !== null),
      );
      result[snapshot.userId] = { ...result[snapshot.userId], ...definedValues };
      return result;
    }, {});
}

function userToVisibleProfile(user: User): VisibleProfile {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    avatar: user.avatar || initials(user.name),
    teamId: user.teamId,
    supervisorId: user.supervisorId,
    salesManagerId: user.salesManagerId,
    birthDate: user.birthDate,
    employmentStatus: user.employmentStatus,
    active: user.active,
  };
}

function previewSellerProfile(
  owner: User,
  index: number,
  supervisorId: string,
  salesManagerId: string,
  teamId: string,
): VisibleProfile {
  const name = previewSellerNames[index] ?? `Vendedor ${index + 1}`;
  return {
    id: `preview-${owner.id}-seller-${index + 1}`,
    name,
    role: 'seller',
    avatar: initials(name),
    teamId,
    supervisorId,
    salesManagerId,
    birthDate: index === 4 ? '1990-09-03' : `198${index}-0${(index % 8) + 1}-15`,
    employmentStatus: 'active',
    active: true,
  };
}

function previewProfiles(user: User): VisibleProfile[] {
  const currentProfile = userToVisibleProfile(user);
  if (user.role === 'seller') return [currentProfile];

  const managerId = user.role === 'sales_manager'
    ? user.id
    : user.salesManagerId || `preview-${user.id}-sales-manager`;

  if (user.role === 'coordinator') {
    const teamId = user.teamId || `preview-${user.id}-team`;
    return [
      currentProfile,
      ...previewSellerNames.slice(0, 6).map((_, index) => previewSellerProfile(user, index, user.id, managerId, teamId)),
    ];
  }

  if (user.role === 'sales_manager') {
    const coordinatorOneId = `preview-${user.id}-coordinator-1`;
    const coordinatorTwoId = `preview-${user.id}-coordinator-2`;
    const teamOneId = `preview-${user.id}-team-1`;
    const teamTwoId = `preview-${user.id}-team-2`;
    const coordinatorOneName = 'Cristian Hernández';
    const coordinatorTwoName = 'Mauricio Segura';
    const coordinators: VisibleProfile[] = [
      { id: coordinatorOneId, name: coordinatorOneName, role: 'coordinator', avatar: initials(coordinatorOneName), teamId: teamOneId, supervisorId: '', salesManagerId: user.id, birthDate: '1984-02-18', employmentStatus: 'active', active: true },
      { id: coordinatorTwoId, name: coordinatorTwoName, role: 'coordinator', avatar: initials(coordinatorTwoName), teamId: teamTwoId, supervisorId: '', salesManagerId: user.id, birthDate: '1988-11-07', employmentStatus: 'active', active: true },
    ];
    const sellers = previewSellerNames.map((_, index) => previewSellerProfile(
      user,
      index,
      index < 4 ? coordinatorOneId : coordinatorTwoId,
      user.id,
      index < 4 ? teamOneId : teamTwoId,
    ));
    return [currentProfile, ...coordinators, ...sellers];
  }

  return [currentProfile];
}

function previewSnapshots(profiles: VisibleProfile[]): MetricSnapshot[] {
  return profiles
    .filter((profile) => profile.role === 'seller')
    .flatMap((profile, index) => {
      const seed = previewMetricSeeds[index % previewMetricSeeds.length];
      const baseId = 10000 + index * 10;
      const common = {
        batchId: 'preview-documents-september-2026',
        userId: profile.id,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
      };
      return [
        {
          ...common,
          id: baseId + 1,
          kind: 'commercial' as const,
          sourceName: 'Ventas_Emitidas_Septiembre_2026.xlsx',
          publishedAt: '2026-09-03T09:00:00-04:00',
          productionUf: seed.productionUf,
          emittedUf: seed.monthlyEmittedUf,
          grossUf: Math.round(seed.productionUf * 1.08),
          sepulturaUf: Math.round(seed.productionUf * 0.58),
          ssffUf: Math.round(seed.productionUf * 0.17),
          cinerarioUf: Math.round(seed.productionUf * 0.1),
          ssaaUf: Math.round(seed.productionUf * 0.15),
          businessCount: seed.businessCount,
          productivity: seed.productivity,
          cancellationCount: seed.cancellationCount,
          cancellationUf: seed.cancellationCount * 18,
          lastSaleDate: seed.lastSaleDate,
        },
        {
          ...common,
          id: baseId + 2,
          kind: 'delinquency' as const,
          sourceName: 'Mora_Septiembre_2026.xlsx',
          publishedAt: '2026-09-03T09:05:00-04:00',
          delinquentClientsCount: seed.delinquentClientsCount,
          delinquencyRate: seed.delinquencyRate,
          debtInstallmentsCount: seed.debtInstallmentsCount,
          debtUf0: seed.debtUf0,
          debtUf8: seed.debtUf8,
        },
        {
          ...common,
          id: baseId + 3,
          kind: 'salesforce' as const,
          sourceName: 'Salesforce_Agosto_2026.xlsx',
          publishedAt: '2026-09-03T09:10:00-04:00',
          salesforceRecords: seed.salesforceRecords,
        },
        {
          ...common,
          id: baseId + 4,
          kind: 'category' as const,
          sourceName: 'Categorizacion_Agosto_2026.xlsx',
          publishedAt: '2026-09-03T09:15:00-04:00',
          category: seed.category,
          estimatedPrizeClp: seed.estimatedPrizeClp,
        },
        {
          ...common,
          id: baseId + 5,
          kind: 'senior' as const,
          sourceName: 'Senior_Q3_2026.xlsx',
          publishedAt: '2026-09-03T09:20:00-04:00',
          quarterTotalUf: Math.round(seed.productionUf * 2.82),
          eligibleTotalUf: Math.round(seed.productionUf * 0.94),
          sungUf: Math.round(seed.productionUf * 2.82),
          emittedUf: Math.round(seed.productionUf * 0.94),
          tenureMonths: 28 + index * 5,
          seniorLevel: seed.seniorLevel,
          seniorStatus: 'open' as const,
        },
        {
          ...common,
          id: baseId + 6,
          kind: 'ranking' as const,
          sourceName: 'Ranking_Agosto_2026.xlsx',
          publishedAt: '2026-09-03T09:25:00-04:00',
          rankingPosition: index + 1,
        },
      ];
    });
}

function previewDashboard(user: User): DashboardData {
  const profiles = previewProfiles(user);
  const snapshots = previewSnapshots(profiles);
  const sellers = profiles.filter((profile) => profile.role === 'seller');
  return {
    profiles,
    snapshots,
    latestByUser: latestByUser(snapshots),
    annualEmittedUfByUser: Object.fromEntries(sellers.map((profile, index) => [profile.id, previewMetricSeeds[index % previewMetricSeeds.length].annualEmittedUf])),
    monthlyEmittedUfByUser: Object.fromEntries(sellers.map((profile, index) => [profile.id, previewMetricSeeds[index % previewMetricSeeds.length].monthlyEmittedUf])),
    periodLabel: '01 sep — 30 sep 2026 · datos de ejemplo',
    seniorOpen: true,
  };
}

function previewRanking(user: User, period: RankingPeriod): RankingEntry[] {
  if (user.role === 'coordinator') {
    const exactIndex = teamRanking.findIndex((entry) => entry.teamId === user.teamId);
    const namedIndex = teamRanking.findIndex((entry) => entry.name.toLocaleLowerCase('es').includes(user.name.split(' ')[0].toLocaleLowerCase('es')));
    const currentIndex = exactIndex >= 0 ? exactIndex : namedIndex >= 0 ? namedIndex : 0;
    return teamRanking.map((entry, index) => ({
      ...entry,
      value: period === 'monthly' ? Math.round(entry.value * 0.08) : entry.value,
      ...(index === currentIndex && exactIndex < 0
        ? { userId: user.teamId || entry.userId, teamId: user.teamId || entry.teamId, name: `Equipo ${user.name.split(' ')[0]}` }
        : {}),
      isCurrentUser: index === currentIndex,
    })).sort((left, right) => right.value - left.value).map((entry, index) => ({ ...entry, position: index + 1 }));
  }
  if (user.role === 'sales_manager') {
    const multiplier = period === 'monthly' ? 0.08 : 1;
    return [
      { userId: `preview-${user.id}-team-1`, name: 'Equipo Cristian Hernández', avatar: 'CH', value: Math.round(26840 * multiplier), position: 1, teamId: `preview-${user.id}-team-1`, subtitle: '4 vendedores' },
      { userId: `preview-${user.id}-team-2`, name: 'Equipo Mauricio Segura', avatar: 'MS', value: Math.round(24120 * multiplier), position: 2, teamId: `preview-${user.id}-team-2`, subtitle: '4 vendedores' },
    ];
  }
  const source = sellerRanking.map((entry, index) => ({
    ...entry,
    value: period === 'monthly'
      ? previewMetricSeeds[index % previewMetricSeeds.length].monthlyEmittedUf
      : previewMetricSeeds[index % previewMetricSeeds.length].annualEmittedUf,
  })).sort((left, right) => right.value - left.value).map((entry, index) => ({ ...entry, position: index + 1 }));
  if (user.role !== 'seller') return source.map((entry) => ({ ...entry, isCurrentUser: false }));
  return source.map((entry) => entry.userId === currentUser.id
    ? {
      ...entry,
      userId: user.id,
      name: user.name,
      avatar: user.avatar || initials(user.name),
      teamId: user.teamId,
      isCurrentUser: true,
    }
    : { ...entry, isCurrentUser: false });
}

function demoDashboard(): DashboardData {
  const demoSnapshot: MetricSnapshot = {
    id: 1,
    batchId: 'demo',
    userId: currentUser.id,
    kind: 'commercial',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    sourceName: 'Demostración',
    publishedAt: executiveMetrics.updatedAt,
    productionUf: executiveMetrics.ufSold,
    emittedUf: executiveMetrics.ufSold,
    productivity: 1.15,
    cancellationCount: 1,
    lastSaleDate: '2026-09-02',
    delinquentClientsCount: 3,
    delinquencyRate: executiveMetrics.delinquencyRate,
    businessCount: executiveMetrics.businessCount,
    salesforceRecords: executiveMetrics.salesforceRecords,
    rankingPosition: executiveMetrics.rankingPosition,
    category: 'Diamante',
    seniorLevel: 'Super Senior',
  };
  return {
    profiles: [{
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      avatar: currentUser.avatar,
      teamId: currentUser.teamId,
      supervisorId: currentUser.supervisorId,
      salesManagerId: currentUser.salesManagerId,
      birthDate: currentUser.birthDate,
      employmentStatus: currentUser.employmentStatus,
      active: true,
    }],
    snapshots: [demoSnapshot],
    latestByUser: { [currentUser.id]: demoSnapshot },
    annualEmittedUfByUser: { [currentUser.id]: executiveMetrics.ufSold },
    monthlyEmittedUfByUser: { [currentUser.id]: executiveMetrics.ufSold },
    periodLabel: '01 ago — 31 ago 2026',
    seniorOpen: true,
  };
}

export const snapshotService = {
  async getDashboard(user: User, options: SnapshotRequestOptions = {}): Promise<DashboardData> {
    if (options.preview && user.id.startsWith('preview-')) return previewDashboard(user);
    if (!supabase) return demoDashboard();
    return individualSheetService.dashboard(user);

  },

  async getRanking(user: User, period: RankingPeriod, options: SnapshotRequestOptions = {}): Promise<RankingEntry[]> {
    if (options.preview && user.id.startsWith('preview-')) return previewRanking(user, period);
    if (!supabase) return [];
    const independent = await supabase.rpc('individual_sheet_ranking', {p_period:period,p_target:options.preview?user.id:null});
    if(independent.error)throw Error(independent.error.message);
    return independent.data??[];
  },

  async getSellerRanking(user: User, options: SnapshotRequestOptions = {}): Promise<RankingEntry[]> {
    return this.getRanking(user, 'annual', options);
  },
};
