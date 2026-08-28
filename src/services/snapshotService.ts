import { currentUser, executiveMetrics } from '@/data/mockData';
import { supabase } from '@/services/supabase';
import { DashboardData, MetricSnapshot, RankingEntry, SnapshotKind, User, UserRole, VisibleProfile } from '@/types';

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
  async getDashboard(user: User): Promise<DashboardData> {
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

  async getSellerRanking(currentUserId: string): Promise<RankingEntry[]> {
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
      isCurrentUser: row.user_id === currentUserId,
    }));
  },
};
