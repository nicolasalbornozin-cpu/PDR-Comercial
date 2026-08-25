import {
  competitions,
  executiveMetrics,
  goals,
  managementRanking,
  newsArticles,
  sellerRanking,
  teamRanking,
  teams,
} from '@/data/mockData';
import { Competition, ExecutiveMetrics, Goal, NewsArticle, RankingEntry, RankingMode, Team } from '@/types';

export interface CommercialDataSource {
  getExecutiveMetrics(userId: string): Promise<ExecutiveMetrics>;
  getGoals(userId: string): Promise<Goal[]>;
  getCompetitions(): Promise<Competition[]>;
  getRanking(mode: RankingMode, competitionId: string): Promise<RankingEntry[]>;
  getTeams(): Promise<Team[]>;
  getNews(): Promise<NewsArticle[]>;
}

/**
 * Contrato único para la información comercial. En la siguiente etapa un adaptador
 * de Supabase/API o de importación Excel puede reemplazar esta implementación sin
 * cambiar los componentes visuales.
 */
export const mockCommercialDataService: CommercialDataSource = {
  async getExecutiveMetrics() {
    return executiveMetrics;
  },
  async getGoals() {
    return goals;
  },
  async getCompetitions() {
    return competitions;
  },
  async getRanking(mode) {
    if (mode === 'teams') return teamRanking;
    if (mode === 'management') return managementRanking;
    return sellerRanking;
  },
  async getTeams() {
    return teams;
  },
  async getNews() {
    return newsArticles;
  },
};
