import { MetricSnapshot } from '../types';

export interface GoalRule { label: string; uf: number; smad: number; prize: number; rest?: number; ssff?: number }

export function seniorProgress(uf: number | undefined, smad: number | undefined, rest: number | undefined, ssff: number | undefined, rules: GoalRule[]): Partial<MetricSnapshot> {
  if ([uf,smad,rest,ssff].some(n=>n===undefined) || !rules.length) return {};
  const qualified=(r:GoalRule)=>uf!>=r.uf&&smad!>=r.smad&&rest!>=(r.rest??0)&&ssff!>=(r.ssff??0);
  const distance=(r:GoalRule)=>Math.max(r.uf-uf!,0)/Math.max(r.uf,1)+Math.max(r.smad-smad!,0)/Math.max(r.smad,1)+Math.max((r.rest??0)-rest!,0)+Math.max((r.ssff??0)-ssff!,0);
  const ordered=rules.filter(r=>r.prize>0).sort((a,b)=>a.prize-b.prize||distance(a)-distance(b));
  if (!ordered.length) return {};
  const current=ordered.filter(qualified).at(-1);
  const next=ordered.find(r=>r.prize>(current?.prize??-1)&&!qualified(r));
  if (!next) return { seniorLevel:current!.label, seniorTargetUf:current!.uf, smadRemaining:0,seniorSmadRemaining:0,restRemaining:0,ssffRemaining:0,seniorRemaining:'Tramo máximo cumplido' };
  const missingUf=Math.max(Math.round((next.uf-uf!)*100)/100,0),missingSmad=Math.max(next.smad-smad!,0),missingRest=Math.max((next.rest??0)-rest!,0),missingSsff=Math.max((next.ssff??0)-ssff!,0);
  const detail=[missingUf?`${missingUf.toLocaleString('es-CL')} UF`:'',missingSmad?`${missingSmad} SMAD`:'',missingRest?`${missingRest} descanso(s)`:'',missingSsff?`${missingSsff} SSFF`:''].filter(Boolean).join(' y ');
  return { seniorLevel:current?.label??'En carrera',nextGoalLevel:next.label,seniorTargetUf:next.uf,smadRemaining:missingSmad,seniorSmadRemaining:missingSmad,restRemaining:missingRest,ssffRemaining:missingSsff,seniorRemaining:`Faltan ${detail} para ${next.label}` };
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
