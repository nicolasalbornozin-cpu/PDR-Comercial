import type { MetricSnapshot } from '../types';

export interface GoalRule { label: string; uf: number; smad: number; prize: number; rest?: number; ssff?: number }

const companionLabel = 'Acompañante Senior';
const isCompanion = (label: string) => /^acompa[ñn]ante senior$/i.test(label.trim());

export function seniorProgress(uf: number | undefined, smad: number | undefined, rest: number | undefined, ssff: number | undefined, rules: GoalRule[], tenureMonths?: number): Partial<MetricSnapshot> {
  // The loaded Senior rules reserve this track for sellers with up to ten months of tenure.
  const companion = tenureMonths !== undefined && tenureMonths >= 0 && tenureMonths <= 10;
  if (uf === undefined || smad === undefined) return companion
    ? { seniorTrack:companionLabel, seniorLevel:'En carrera', seniorRemaining:'Avance pendiente de confirmar' } : {};
  const eligible = companion
    ? [rules.find(rule => isCompanion(rule.label)) ?? { label:companionLabel, uf:1350, smad:10, prize:0 }]
    : rules.filter(rule => !isCompanion(rule.label) && rule.prize>0);
  if (!eligible.length || (!companion && (rest === undefined || ssff === undefined))) return {};
  const meets = (rule: GoalRule) => uf >= rule.uf && smad >= rule.smad && (rest ?? 0) >= (rule.rest ?? 0) && (ssff ?? 0) >= (rule.ssff ?? 0);
  // UF thresholds order the levels. A prize supplement for a lower level must not hide a higher level.
  const ordered = [...eligible].sort((a,b) => a.uf-b.uf || a.prize-b.prize);
  const current = ordered.filter(meets).at(-1);
  const distance = (r:GoalRule) => Math.max(r.uf-uf,0)/Math.max(r.uf,1) + Math.max(r.smad-smad,0)/Math.max(r.smad,1)
    + Math.max((r.rest??0)-(rest??0),0) + Math.max((r.ssff??0)-(ssff??0),0);
  const next = eligible.filter(r => (!current || r.uf >= current.uf && r.prize > current.prize) && !meets(r))
    .sort((a,b) => a.prize-b.prize || distance(a)-distance(b))[0];
  const seniorTrack = companion ? companionLabel : undefined;
  const seniorLevel = current ? (companion ? companionLabel : current.label) : 'En carrera';
  if (!next) return { seniorTrack, seniorLevel, seniorTargetUf:current?.uf, smadRemaining:0, seniorSmadRemaining:0, restRemaining:0, ssffRemaining:0, seniorRemaining:'Tramo máximo cumplido' };
  const missingUf = Math.max(Math.round((next.uf-uf)*100)/100,0);
  const missingSmad = Math.max(next.smad-smad,0);
  const missingRest = Math.max((next.rest??0)-(rest??0),0);
  const missingSsff = Math.max((next.ssff??0)-(ssff??0),0);
  const detail = [missingUf ? missingUf.toLocaleString('es-CL')+' UF' : '', missingSmad ? missingSmad+' SMAD' : '', missingRest ? missingRest+' descanso(s)' : '', missingSsff ? missingSsff+' SSFF' : ''].filter(Boolean).join(' y ');
  const nextGoalLevel = companion ? companionLabel : next.label;
  return { seniorTrack, seniorLevel, nextGoalLevel, seniorTargetUf:next.uf, smadRemaining:missingSmad, seniorSmadRemaining:missingSmad, restRemaining:missingRest, ssffRemaining:missingSsff, seniorRemaining:'Faltan '+detail+' para '+nextGoalLevel };
}

export function goalStatusLabel(goal: Partial<MetricSnapshot> | undefined, kind: 'senior'|'category'): string {
  if (!goal || goal.goalPending) return kind === 'senior' ? 'Tramo sin publicar' : 'Categoría sin publicar';
  if (kind === 'category') {
    if (!goal.category || /^(no categoriza|sin categoría)$/i.test(goal.category)) return 'Aún sin categoría';
    return /^revisar|^pendiente/i.test(goal.category) ? goal.category : 'Categoría '+goal.category;
  }
  if (goal.seniorTrack && goal.seniorLevel !== goal.seniorTrack) return goal.seniorTrack+' · En carrera';
  return goal.seniorLevel || 'Tramo sin publicar';
}

export function categoryProgress(uf: number | undefined, smad: number | undefined, rules: GoalRule[]) {
  if (uf === undefined || smad === undefined) return {};
  const ordered = [...rules].sort((a,b) => a.uf-b.uf);
  const next = ordered.find(rule => uf < rule.uf || smad < rule.smad);
  if (!ordered.length) return {};
  if (!next) return { categoryTargetUf: ordered.at(-1)!.uf, smadRemaining: 0, categoryRemaining: 'Tramo máximo cumplido' };
  const missingUf = Math.max(Math.round((next.uf-uf)*100)/100,0);
  const missingSmad = Math.max(next.smad-smad,0);
  return { categoryTargetUf: next.uf, smadRemaining: missingSmad, nextGoalLevel: next.label,
    categoryRemaining: [missingUf ? `${missingUf.toLocaleString('es-CL')} UF` : '',missingSmad ? `${missingSmad} SMAD` : ''].filter(Boolean).join(' y ') + ` para ${next.label}` };
}

export function seniorPeriodLabel(periodStart: string) {
  // Labels identify commercial campaigns; do not display unconfirmed closing dates.
  const month = Number(periodStart.slice(5,7));
  const quarter = Math.ceil(month/3);
  return `Senior · ${['primer','segundo','tercer','cuarto'][quarter-1] ?? ''} trimestre ${periodStart.slice(0,4)}`;
}

export function goalRemainingUf(goal: Partial<MetricSnapshot> | undefined, kind: 'category'|'senior') {
  const target = kind === 'category' ? goal?.categoryTargetUf : goal?.seniorTargetUf;
  const actual = kind === 'category' ? goal?.categoryUf : goal?.eligibleTotalUf;
  return target !== undefined && actual !== undefined ? Math.max(Math.round((target-actual)*100)/100,0) : undefined;
}
