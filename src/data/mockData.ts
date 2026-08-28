import {
  ActivityItem,
  AdminUser,
  Competition,
  ExecutiveMetrics,
  Goal,
  NewsArticle,
  RankingEntry,
  Team,
  User,
} from '@/types';

export const demoAdminUser: User = {
  id: 'demo-admin',
  name: 'Administrador PDR',
  email: 'administrador.demo@pdr.internal',
  rut: '123456785',
  role: 'admin',
  avatar: 'AP',
  teamId: '',
  supervisorId: '',
  salesManagerId: '',
  joinDate: '2018-01-15',
  active: true,
  mustChangePassword: false,
};

export const currentUser: User = {
  id: 'user-erika',
  name: 'Erika Sepúlveda',
  email: 'erika.sepulveda@parquedelrecuerdo.cl',
  rut: '15.842.761-8',
  role: 'seller',
  avatar: 'ES',
  teamId: 'team-cristian',
  supervisorId: 'cristian-hernandez',
  salesManagerId: 'karin-etcheverry',
  joinDate: '2022-03-14',
  active: true,
  mustChangePassword: false,
};

export const demoManagedUsers: AdminUser[] = [
  {
    id: demoAdminUser.id,
    name: demoAdminUser.name,
    rut: demoAdminUser.rut,
    role: demoAdminUser.role,
    active: true,
    teamId: '',
    supervisorId: '',
    salesManagerId: '',
    createdAt: '2018-01-15T12:00:00-03:00',
  },
  {
    id: 'demo-sales-manager',
    name: 'Karin Etcheverry',
    rut: '146789012',
    role: 'sales_manager',
    active: true,
    teamId: '',
    supervisorId: '',
    salesManagerId: '',
    createdAt: '2019-05-21T12:00:00-04:00',
  },
  {
    id: 'demo-coordinator',
    name: 'Cristian Hernández',
    rut: '132456789',
    role: 'coordinator',
    active: true,
    teamId: 'demo-team-cristian',
    supervisorId: '',
    salesManagerId: 'demo-sales-manager',
    createdAt: '2020-08-10T12:00:00-04:00',
  },
  {
    id: currentUser.id,
    name: currentUser.name,
    rut: currentUser.rut,
    role: currentUser.role,
    active: true,
    teamId: currentUser.teamId,
    supervisorId: 'demo-coordinator',
    salesManagerId: 'demo-sales-manager',
    createdAt: `${currentUser.joinDate}T12:00:00-03:00`,
  },
  {
    id: 'demo-seller-andrea',
    name: 'Andrea Contreras',
    rut: '163334440',
    role: 'seller',
    active: true,
    teamId: 'demo-team-cristian',
    supervisorId: 'demo-coordinator',
    salesManagerId: 'demo-sales-manager',
    createdAt: '2021-11-04T12:00:00-03:00',
  },
];

export const executiveMetrics: ExecutiveMetrics = {
  userId: currentUser.id,
  ufSold: 1833,
  delinquencyRate: 4.8,
  businessCount: 6,
  salesforceRecords: 43,
  rankingPosition: 7,
  updatedAt: '2026-08-23T18:30:00-04:00',
};

export const goals: Goal[] = [
  {
    id: 'goal-super-senior',
    name: 'Super Senior',
    type: 'senior',
    startDate: '2026-07-23',
    endDate: '2026-08-31',
    metric: 'uf',
    currentValue: 1833,
    targetValue: 1950,
    unit: 'UF',
    level: 'Diamante',
    status: 'in_progress',
  },
  {
    id: 'goal-category-august',
    name: 'Categoría Agosto',
    type: 'category',
    startDate: '2026-07-23',
    endDate: '2026-08-20',
    metric: 'uf',
    currentValue: 920,
    targetValue: 1000,
    unit: 'UF',
    level: 'Diamante',
    status: 'in_progress',
  },
  {
    id: 'goal-productivity',
    name: 'Productividad',
    type: 'productivity',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    metric: 'businesses',
    currentValue: 6,
    targetValue: 8,
    unit: 'negocios',
    level: 'Objetivo mensual',
    status: 'in_progress',
  },
  {
    id: 'goal-delinquency',
    name: 'Mora objetivo',
    type: 'quality',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    metric: 'delinquency',
    currentValue: 4.8,
    targetValue: 6,
    unit: '%',
    level: 'Dentro de objetivo',
    status: 'completed',
  },
];

export const competitions: Competition[] = [
  { id: 'august', name: 'Categoría Agosto', type: 'category', startDate: '2026-07-23', endDate: '2026-08-20', metric: 'uf', active: true },
  { id: 'senior', name: 'Senior', type: 'senior', startDate: '2026-07-01', endDate: '2026-09-30', metric: 'uf', active: true },
  { id: 'monthly', name: 'Mensual', type: 'monthly', startDate: '2026-08-01', endDate: '2026-08-31', metric: 'uf', active: true },
];

export const sellerRanking: RankingEntry[] = [
  { userId: 'andrea', name: 'Andrea Contreras', avatar: 'AC', value: 2480, position: 1, teamId: 'team-rodolfo', subtitle: 'Equipo Rodolfo Bravo' },
  { userId: 'desiree', name: 'Desiree Muñoz', avatar: 'DM', value: 2150, position: 2, teamId: 'team-mauricio', subtitle: 'Equipo Mauricio Segura' },
  { userId: 'maritza', name: 'Maritza Araya', avatar: 'MA', value: 1980, position: 3, teamId: 'team-karin', subtitle: 'Equipo Karin Etcheverry' },
  { userId: 'juan', name: 'Juan Ramírez', avatar: 'JR', value: 1910, position: 4, teamId: 'team-cristian', subtitle: 'Equipo Cristian Hernández' },
  { userId: currentUser.id, name: 'Erika Sepúlveda', avatar: 'ES', value: 1833, position: 7, teamId: 'team-cristian', subtitle: 'Equipo Cristian Hernández', isCurrentUser: true },
];

export const teams: Team[] = [
  { id: 'team-rodolfo', name: 'Equipo Rodolfo Bravo', salesManagerId: 'manager-north', totalUF: 14960 },
  { id: 'team-mauricio', name: 'Equipo Mauricio Segura', salesManagerId: 'manager-center', totalUF: 13740 },
  { id: 'team-karin', name: 'Equipo Karin Etcheverry', salesManagerId: 'manager-east', totalUF: 12680 },
  { id: 'team-cristian', name: 'Equipo Cristian Hernández', salesManagerId: 'manager-east', totalUF: 11920 },
];

export const teamRanking: RankingEntry[] = teams.map((team, index) => ({
  userId: team.id,
  name: team.name,
  avatar: `E${index + 1}`,
  value: team.totalUF,
  position: index + 1,
  teamId: team.id,
  subtitle: `${18 - index} ejecutivos`,
  isCurrentUser: team.id === currentUser.teamId,
}));

export const managementRanking: RankingEntry[] = [
  { userId: 'manager-north', name: 'Jefatura Zona Norte', avatar: 'ZN', value: 34210, position: 1, teamId: 'north', subtitle: '4 equipos' },
  { userId: 'manager-east', name: 'Jefatura Zona Oriente', avatar: 'ZO', value: 31940, position: 2, teamId: 'east', subtitle: '3 equipos', isCurrentUser: true },
  { userId: 'manager-center', name: 'Jefatura Zona Centro', avatar: 'ZC', value: 29580, position: 3, teamId: 'center', subtitle: '3 equipos' },
];

export const activities: ActivityItem[] = [
  { id: 'positions', icon: 'trending-up-outline', title: 'Subiste 3 posiciones', description: '¡Felicidades! Sigue así.', relativeDate: 'Hoy', tone: 'success' },
  { id: 'race', icon: 'diamond-outline', title: 'Nueva carrera activa', description: 'Super Senior', relativeDate: 'Ayer', tone: 'gold' },
  { id: 'event', icon: 'calendar-outline', title: 'Evento senior este viernes', description: 'No olvides confirmar tu asistencia.', relativeDate: 'Hace 2 días', tone: 'neutral' },
];

export const newsArticles: NewsArticle[] = [
  {
    id: 'paseo-senior-2026',
    title: 'Paseo Senior 2026',
    summary: 'Revisa las fotos y novedades del evento.',
    body: 'Una jornada para celebrar el compromiso, la excelencia y los logros de nuestros equipos comerciales. Compartimos en un entorno natural, reconocimos a quienes marcaron la diferencia y renovamos la energía para los próximos desafíos.',
    image: 'seniorEvent',
    date: '2026-08-21',
    featured: true,
    category: 'Eventos',
  },
  {
    id: 'nueva-carrera-activa',
    title: 'Nueva carrera activa',
    summary: 'Sumamos una nueva categoría para seguir avanzando juntos.',
    body: 'La nueva carrera comercial ya está disponible. Revisa tus metas, el período de evaluación y los avances directamente en la sección Mis metas.',
    image: 'park',
    date: '2026-08-20',
    featured: false,
    category: 'Carreras',
  },
  {
    id: 'ganadores-del-mes',
    title: 'Ganadores del mes',
    summary: 'Conoce a los Super Seniors que destacaron en julio.',
    body: 'Celebramos a los ejecutivos que alcanzaron resultados sobresalientes y mantuvieron una gestión comercial de calidad durante julio.',
    image: 'gardenTable',
    date: '2026-08-18',
    featured: false,
    category: 'Reconocimientos',
  },
  {
    id: 'categorizacion-agosto',
    title: 'Categorización agosto: fechas y metas',
    summary: 'Revisa el calendario, requisitos y tips para subir de categoría.',
    body: 'La medición de agosto considera el período entre el 23 de julio y el 20 de agosto. Revisa tus indicadores a diario para enfocar tu gestión.',
    image: 'park',
    date: '2026-08-15',
    featured: false,
    category: 'Información comercial',
  },
];

export const galleryImages = ['seniorEvent', 'gardenTable', 'park', 'gardenTable', 'seniorEvent', 'park'] as const;
