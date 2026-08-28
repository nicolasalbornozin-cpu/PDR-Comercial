import { currentUser, executiveMetrics, sellerRanking } from '@/data/mockData';
import { supabase } from '@/services/supabase';
import { DashboardData, MetricSnapshot, RankingEntry, SnapshotKind, User, UserRole, VisibleProfile } from '@/types';

interface SnapshotRequestOptions {
  preview?: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  team_id: number | null;
  supervisor_id: string | null;
  sales_manager_id: string | null;
  active: boolean;
}

interface SnapshotRow {
  id: number;
  batch_id: string;
  user_id: string;
  kind: SnapshotKind;
  period_start: string;
  period_end: string;
  source_name: string;
  published_at: string;
  production_uf: number | null;
  gross_uf: number | null;
  sepultura_uf: number | null;
  ssff_uf: number | null;
  cinerario_uf: number | null;
  ssaa_uf: number | null;
  emitted_uf: number | null;
  not_emitted_uf: number | null;
  not_uploaded_uf: number | null;
  cancellation_uf: number | null;
  quarter_total_uf: number | null;
  eligible_total_uf: number | null;
  business_count: number | null;
  smad_count: number | null;
  rest_count: number | null;
  ssff_count: number | null;
  delinquent_clients_count: number | null;
  delinquency_rate: number | null;
  salesforce_records: number | null;
  tenure_months: number | null;
  ranking_position: number | null;
  category: string | null;
  senior_level: string | null;
  estimated_prize_clp: number | null;
}

interface PreviewMetricSeed {
  businessCount: number;
  category: string;
  delinquencyRate: number;
  delinquentClientsCount: number;
  estimatedPrizeClp: number;
  productionUf: number;
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
  { productionUf: 2480, businessCount: 10, delinquentClientsCount: 1, delinquencyRate: 2.1, salesforceRecords: 61, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 680000 },
  { productionUf: 2150, businessCount: 9, delinquentClientsCount: 2, delinquencyRate: 3.2, salesforceRecords: 56, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 590000 },
  { productionUf: 1980, businessCount: 8, delinquentClientsCount: 2, delinquencyRate: 3.9, salesforceRecords: 49, category: 'Oro', seniorLevel: 'Senior', estimatedPrizeClp: 510000 },
  { productionUf: 1910, businessCount: 7, delinquentClientsCount: 3, delinquencyRate: 4.4, salesforceRecords: 47, category: 'Oro', seniorLevel: 'Senior', estimatedPrizeClp: 470000 },
  { productionUf: 1833, businessCount: 6, delinquentClientsCount: 3, delinquencyRate: 4.8, salesforceRecords: 43, category: 'Diamante', seniorLevel: 'Super Senior', estimatedPrizeClp: 450000 },
  { productionUf: 1690, businessCount: 6, delinquentClientsCount: 4, delinquencyRate: 5.3, salesforceRecords: 39, category: 'Plata', seniorLevel: 'Senior', estimatedPrizeClp: 360000 },
  { productionUf: 1540, businessCount: 5, delinquentClientsCount: 4, delinquencyRate: 5.7, salesforceRecords: 36, category: 'Plata', seniorLevel: 'Senior inicial', estimatedPrizeClp: 310000 },
  { productionUf: 1420, businessCount: 5, delinquentClientsCount: 5, delinquencyRate: 6.1, salesforceRecords: 32, category: 'Bronce', seniorLevel: 'En carrera', estimatedPrizeClp: 260000 },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function optionalNumber(value: number | null): number | undefined {
  return value === null ? undefined : Number(value);
}

function mapSnapshot(row: SnapshotRow): MetricSnapshot {
  return {
    id: row.id,
    batchId: row.batch_id,
    userId: row.user_id,
    kind: row.kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    sourceName: row.source_name,
    publishedAt: row.published_at,
    productionUf: optionalNumber(row.production_uf),
    grossUf: optionalNumber(row.gross_uf),
    sepulturaUf: optionalNumber(row.sepultura_uf),
    ssffUf: optionalNumber(row.ssff_uf),
    cinerarioUf: optionalNumber(row.cinerario_uf),
    ssaaUf: optionalNumber(row.ssaa_uf),
    emittedUf: optionalNumber(row.emitted_uf),
    notEmittedUf: optionalNumber(row.not_emitted_uf),
    notUploadedUf: optionalNumber(row.not_uploaded_uf),
    cancellationUf: optionalNumber(row.cancellation_uf),
    quarterTotalUf: optionalNumber(row.quarter_total_uf),
    eligibleTotalUf: optionalNumber(row.eligible_total_uf),
    businessCount: optionalNumber(row.business_count),
    smadCount: optionalNumber(row.smad_count),
    restCount: optionalNumber(row.rest_count),
    ssffCount: optionalNumber(row.ssff_count),
    delinquentClientsCount: optionalNumber(row.delinquent_clients_count),
    delinquencyRate: optionalNumber(row.delinquency_rate),
    salesforceRecords: optionalNumber(row.salesforce_records),
    tenureMonths: optionalNumber(row.tenure_months),
    rankingPosition: optionalNumber(row.ranking_position),
    category: row.category ?? undefined,
    seniorLevel: row.senior_level ?? undefined,
    estimatedPrizeClp: optionalNumber(row.estimated_prize_clp),
  };
}

function mapProfile(row: ProfileRow): VisibleProfile {
  return {
    id: row.id,
    name: row.full_name,
    role: row.role,
    avatar: row.avatar_url ?? initials(row.full_name),
    teamId: row.team_id?.toString() ?? '',
    supervisorId: row.supervisor_id ?? '',
    salesManagerId: row.sales_manager_id ?? '',
    active: row.active,
  };
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

function profileIsVisibleTo(user: User, profile: VisibleProfile): boolean {
  if (user.role === 'admin') return true;
  if (profile.id === user.id) return true;
  if (user.role === 'coordinator') return profile.supervisorId === user.id;
  if (user.role === 'sales_manager') return profile.salesManagerId === user.id;
  return false;
}

function scopeDashboard(user: User, profiles: VisibleProfile[], snapshots: MetricSnapshot[]) {
  const visibleProfiles = profiles.filter((profile) => profileIsVisibleTo(user, profile));
  const visibleIds = new Set(visibleProfiles.map((profile) => profile.id));
  return {
    profiles: visibleProfiles,
    snapshots: snapshots.filter((snapshot) => visibleIds.has(snapshot.userId)),
  };
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
      { id: coordinatorOneId, name: coordinatorOneName, role: 'coordinator', avatar: initials(coordinatorOneName), teamId: teamOneId, supervisorId: '', salesManagerId: user.id, active: true },
      { id: coordinatorTwoId, name: coordinatorTwoName, role: 'coordinator', avatar: initials(coordinatorTwoName), teamId: teamTwoId, supervisorId: '', salesManagerId: user.id, active: true },
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
        batchId: 'preview-documents-august-2026',
        userId: profile.id,
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };
      return [
        {
          ...common,
          id: baseId + 1,
          kind: 'commercial' as const,
          sourceName: 'Avance_Comercial_Agosto_2026.xlsx',
          publishedAt: '2026-08-23T09:00:00-04:00',
          productionUf: seed.productionUf,
          grossUf: Math.round(seed.productionUf * 1.08),
          sepulturaUf: Math.round(seed.productionUf * 0.58),
          ssffUf: Math.round(seed.productionUf * 0.17),
          cinerarioUf: Math.round(seed.productionUf * 0.1),
          ssaaUf: Math.round(seed.productionUf * 0.15),
          businessCount: seed.businessCount,
        },
        {
          ...common,
          id: baseId + 2,
          kind: 'delinquency' as const,
          sourceName: 'Mora_Sauce_Agosto_2026.xlsx',
          publishedAt: '2026-08-23T09:05:00-04:00',
          delinquentClientsCount: seed.delinquentClientsCount,
          delinquencyRate: seed.delinquencyRate,
        },
        {
          ...common,
          id: baseId + 3,
          kind: 'salesforce' as const,
          sourceName: 'Salesforce_Agosto_2026.xlsx',
          publishedAt: '2026-08-23T09:10:00-04:00',
          salesforceRecords: seed.salesforceRecords,
        },
        {
          ...common,
          id: baseId + 4,
          kind: 'category' as const,
          sourceName: 'Categorizacion_Agosto_2026.xlsx',
          publishedAt: '2026-08-23T09:15:00-04:00',
          category: seed.category,
          estimatedPrizeClp: seed.estimatedPrizeClp,
        },
        {
          ...common,
          id: baseId + 5,
          kind: 'senior' as const,
          sourceName: 'Senior_Q3_2026.xlsx',
          publishedAt: '2026-08-23T09:20:00-04:00',
          quarterTotalUf: Math.round(seed.productionUf * 2.82),
          eligibleTotalUf: Math.round(seed.productionUf * 0.94),
          tenureMonths: 28 + index * 5,
          seniorLevel: seed.seniorLevel,
        },
        {
          ...common,
          id: baseId + 6,
          kind: 'ranking' as const,
          sourceName: 'Ranking_Agosto_2026.xlsx',
          publishedAt: '2026-08-23T09:25:00-04:00',
          rankingPosition: index + 1,
        },
      ];
    });
}

function previewDashboard(user: User): DashboardData {
  const profiles = previewProfiles(user);
  const snapshots = previewSnapshots(profiles);
  return {
    profiles,
    snapshots,
    latestByUser: latestByUser(snapshots),
    periodLabel: '01 ago — 31 ago 2026 · datos de ejemplo',
  };
}

function previewRanking(user: User): RankingEntry[] {
  if (user.role !== 'seller') return sellerRanking.map((entry) => ({ ...entry, isCurrentUser: false }));
  return sellerRanking.map((entry) => entry.userId === currentUser.id
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
      active: true,
    }],
    snapshots: [demoSnapshot],
    latestByUser: { [currentUser.id]: demoSnapshot },
    periodLabel: '01 ago — 31 ago 2026',
  };
}

export const snapshotService = {
  async getDashboard(user: User, options: SnapshotRequestOptions = {}): Promise<DashboardData> {
    if (options.preview) return previewDashboard(user);
    if (!supabase) return demoDashboard();

    const [profilesResult, snapshotsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,full_name,role,avatar_url,team_id,supervisor_id,sales_manager_id,active')
        .eq('active', true),
      supabase.from('latest_metric_snapshots').select('*'),
    ]);

    if (profilesResult.error) throw new Error(`No fue posible cargar el equipo: ${profilesResult.error.message}`);
    if (snapshotsResult.error) throw new Error(`No fue posible cargar los indicadores: ${snapshotsResult.error.message}`);

    const allProfiles = (profilesResult.data as ProfileRow[]).map(mapProfile);
    const allSnapshots = (snapshotsResult.data as SnapshotRow[]).map(mapSnapshot);
    const { profiles, snapshots } = scopeDashboard(user, allProfiles, allSnapshots);
    const latest = snapshots.reduce<MetricSnapshot | null>((found, row) => {
      if (!found || row.publishedAt > found.publishedAt) return row;
      return found;
    }, null);

    return {
      profiles,
      snapshots,
      latestByUser: latestByUser(snapshots),
      periodLabel: latest ? `${latest.periodStart} — ${latest.periodEnd}` : 'Sin carga publicada',
    };
  },

  async getSellerRanking(user: User, options: SnapshotRequestOptions = {}): Promise<RankingEntry[]> {
    if (options.preview) return previewRanking(user);
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('ranking_leaderboard');
    if (error) throw new Error(`No fue posible cargar el ranking: ${error.message}`);
    return ((data ?? []) as {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      team_id: number | null;
      team_name: string | null;
      value: number;
      position: number | null;
    }[]).map((row, index) => ({
      userId: row.user_id,
      name: row.display_name,
      avatar: row.avatar_url ?? initials(row.display_name),
      value: Number(row.value),
      position: row.position ?? index + 1,
      teamId: row.team_id?.toString() ?? '',
      subtitle: row.team_name ?? 'Sin equipo asignado',
      isCurrentUser: row.user_id === user.id,
    }));
  },
};
