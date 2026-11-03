// Condições de elegibilidade e requisitos de registro de candidatura (CF art. 14; Lei 9.504/97).
// Cada verificação devolve a regra e a fonte para a interface explicar o bloqueio.

import { ageAt, formatIsoPt } from '../calendar';
import type { MunicipalRulePack } from '../data/rulepack';

export type MunicipalOffice = 'vereador' | 'prefeito' | 'vice_prefeito';

export interface EligibilityInput {
  office: MunicipalOffice;
  birthDate: string;
  brazilian: boolean;
  politicalRightsOk: boolean;
  domicileMunicipalityId: string;
  domicileSince: string;
  targetMunicipalityId: string;
  /** Data de filiação ao partido atual (null = sem partido). */
  filiationDate: string | null;
  /** Mandatos consecutivos já exercidos como titular do cargo executivo pretendido. */
  consecutiveTermsSameOffice: number;
  chosenInConvention: boolean;
}

export interface EligibilityCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  source: string;
}

export function checkEligibility(input: EligibilityInput, rp: MunicipalRulePack): EligibilityCheck[] {
  const checks: EligibilityCheck[] = [];
  const ageRule = input.office === 'vereador' ? rp.minAge.vereador : input.office === 'prefeito' ? rp.minAge.prefeito : rp.minAge.vicePrefeito;
  const checkDate = ageRule.value.checkedAt === 'registration' ? rp.registrationDeadline.value : rp.posseDate.value;
  const age = ageAt(input.birthDate, checkDate);

  checks.push({
    id: 'nacionalidade', ok: input.brazilian, label: 'Nacionalidade brasileira',
    detail: input.brazilian ? 'Cumprido.' : 'Somente brasileiros podem se candidatar.',
    source: 'CF art. 14 §3º, I',
  });
  checks.push({
    id: 'direitos_politicos', ok: input.politicalRightsOk, label: 'Pleno exercício dos direitos políticos',
    detail: input.politicalRightsOk ? 'Cumprido.' : 'Direitos políticos suspensos ou perdidos.',
    source: 'CF art. 14 §3º, II',
  });
  checks.push({
    id: 'idade', ok: age >= ageRule.value.age, label: `Idade mínima: ${ageRule.value.age} anos`,
    detail: `Aferida em ${formatIsoPt(checkDate)} (${ageRule.value.checkedAt === 'registration' ? 'data-limite do registro' : 'data da posse'}): você terá ${age} anos.`,
    source: ageRule.source,
  });
  const domicileOk = input.domicileMunicipalityId === input.targetMunicipalityId && input.domicileSince <= rp.domicileDeadline.value;
  checks.push({
    id: 'domicilio', ok: domicileOk, label: 'Domicílio eleitoral na circunscrição',
    detail: domicileOk ? `Domicílio no município desde antes de ${formatIsoPt(rp.domicileDeadline.value)}.` : `Exige domicílio eleitoral no município até ${formatIsoPt(rp.domicileDeadline.value)}.`,
    source: rp.domicileDeadline.source,
  });
  const filiationOk = input.filiationDate !== null && input.filiationDate <= rp.filiationDeadline.value;
  checks.push({
    id: 'filiacao', ok: filiationOk, label: 'Filiação partidária no prazo',
    detail: input.filiationDate === null
      ? `Sem filiação. É preciso estar filiado até ${formatIsoPt(rp.filiationDeadline.value)}.`
      : filiationOk ? `Filiado desde ${formatIsoPt(input.filiationDate)}.` : `Filiação em ${formatIsoPt(input.filiationDate)}, depois do prazo de ${formatIsoPt(rp.filiationDeadline.value)}.`,
    source: rp.filiationDeadline.source,
  });
  if (input.office === 'prefeito') {
    const maxTerms = rp.maxConsecutiveTermsExecutive.value;
    const ok = input.consecutiveTermsSameOffice < maxTerms;
    checks.push({
      id: 'reeleicao', ok, label: 'Limite de reeleição',
      detail: ok ? 'Cumprido.' : 'Já exerceu dois mandatos consecutivos como prefeito: vedado um terceiro consecutivo.',
      source: rp.maxConsecutiveTermsExecutive.source,
    });
  }
  checks.push({
    id: 'convencao', ok: input.chosenInConvention, label: 'Escolha em convenção partidária',
    detail: input.chosenInConvention ? 'Candidatura aprovada na convenção.' : `O partido precisa escolher você na convenção (${formatIsoPt(rp.conventionsStart.value)} a ${formatIsoPt(rp.conventionsEnd.value)}).`,
    source: rp.conventionsStart.source,
  });
  return checks;
}

export function isEligible(checks: EligibilityCheck[]): boolean {
  return checks.every((c) => c.ok);
}
