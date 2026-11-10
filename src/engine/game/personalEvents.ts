// Acontecimentos da vida pessoal (Fase 8). Personagens do jogo; regras reais citadas onde se aplicam.

import { monthIndex } from '../calendar';
import { next, type RngState } from '../rng';
import { TEAM_LIMITS, hireRelative } from './team';
import { adultRelatives, characterAge, children, divorce, firstName, marry, memberAge, partner, startLeave, leaveBlock, type FamilyMember } from './personal';
import type { EventOption, EventTemplate } from './events';
import type { GameState } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const now = (s: GameState) => monthIndex(s.month);
const P = (s: GameState) => s.personal!;
const grow = (cur: number, gain: number) => clamp(cur + gain * Math.pow(1 - cur / 100, 1.6));

const lowChild = (s: GameState) => children(s).filter((c) => memberAge(s, c) < 18).sort((a, b) => a.mood - b.mood)[0] as FamilyMember | undefined;
const problemAdult = (s: GameState) => children(s).find((c) => memberAge(s, c) >= 18 && c.trait === 'problematico');
const oldParent = (s: GameState) => P(s).family.find((m) => (m.relation === 'pai' || m.relation === 'mae') && memberAge(s, m) >= 70);
const jobSeeker = (s: GameState) => adultRelatives(s).find((m) => !m.employedByPlayer && m.relation !== 'conjuge' && m.relation !== 'companheiro') ?? adultRelatives(s).find((m) => !m.employedByPlayer);
const ambitiousChild = (s: GameState) => children(s).find((c) => memberAge(s, c) >= 18 && c.politicalInterest >= 45 && P(s).heirId !== c.id && !c.politics);

export const PERSONAL_EVENTS: EventTemplate[] = [
  {
    id: 'ameaca',
    title: (_s, v) => `Ameaça contra você (nível ${v.level}/5)`,
    body: (s) => {
      const t = P(s).threats[P(s).threats.length - 1];
      const fem = t?.gendered ? ' Ameaçar ou perseguir uma mulher com mandato ou candidatura por ser mulher é crime de violência política (Código Eleitoral, art. 326-B; Lei 14.192/2021).' : '';
      return `${t?.text ?? 'Você recebeu ameaças.'} Quanto mais você aparece, mais isso acontece. Ameaça é crime (Código Penal, art. 147).${fem} O que você faz?`;
    },
    weight: 0, condition: () => false,
    options: (s, v) => {
      const lvl = Number(v.level ?? 1);
      const fem = P(s).threats[P(s).threats.length - 1]?.gendered;
      const opts: EventOption[] = [
        {
          label: fem ? 'Registrar ocorrência (violência política de gênero)' : 'Registrar ocorrência e representar', hint: 'A polícia investiga; o estresse cai um pouco',
          apply: (st: GameState) => { const p = P(st); p.occurrences++; p.stress = clamp(p.stress - 4); p.heat = clamp(p.heat - 3); st.player.credibility = clamp((st.player.credibility ?? 60) + 1); markResponse(st, 'ocorrência'); return 'Boletim registrado e representação feita. O caso foi para investigação.'; },
        },
        {
          label: 'Tornar público e denunciar', hint: 'Solidariedade e reconhecimento; mais exposição, e a família sente',
          apply: (st: GameState) => { const p = P(st); st.player.recognition = grow(st.player.recognition, 2); st.character.attributes.popularity = grow(st.character.attributes.popularity, 1.5); if (st.player.mandate) st.player.mandate.approval = clamp(st.player.mandate.approval + 1); p.heat = clamp(p.heat + 6); for (const m of p.family) if (!m.ex) m.mood = clamp(m.mood - (m.trait === 'reservado' ? 6 : 2)); markResponse(st, 'denúncia pública'); return 'Você denunciou as ameaças em público. Recebeu apoio de colegas de vários partidos.'; },
        },
      ];
      if (lvl >= 3) opts.push({
        label: 'Pedir proteção policial', hint: 'Depende da avaliação das autoridades',
        apply: (st: GameState, rng) => { const ok = next(rng) < (lvl >= 4 ? 0.8 : 0.45); markResponse(st, 'proteção policial'); if (ok) { P(st).securityUntil = now(st) + 6; P(st).security = 'policial'; return 'Pedido aceito: você terá proteção policial pelos próximos seis meses (prazo do jogo).'; } return 'As autoridades avaliaram o risco e negaram proteção por enquanto. Você pode contratar segurança privada.'; },
      });
      if (!P(s).privateSecurity) opts.push({
        label: 'Contratar segurança privada', hint: 'R$ 18 mil/mês (parâmetro)',
        apply: (st: GameState) => { P(st).privateSecurity = true; markResponse(st, 'segurança privada'); return 'Segurança privada contratada para você e a família.'; },
      });
      if (lvl >= 3 && !leaveBlock(s)) opts.push({
        label: 'Afastar-se do cargo por 2 meses', hint: 'Licença: exposição cai; o substituto assume',
        apply: (st: GameState) => { markResponse(st, 'licença'); return startLeave(st, 2, 'ameaca'); },
      });
      opts.push({
        label: 'Ignorar', hint: lvl >= 4 ? 'Arriscado sem segurança' : 'Segue a vida',
        apply: (st: GameState, rng) => {
          const p = P(st); p.stress = clamp(p.stress + 3); markResponse(st, 'ignorou');
          if (lvl >= 4 && p.security === 'nenhuma' && next(rng) < 0.25) { p.health = clamp(p.health - 10); p.stress = clamp(p.stress + 12); for (const m of p.family) if (!m.ex) m.mood = clamp(m.mood - 10); return 'A situação piorou: houve um incidente sério perto da sua casa. Ninguém se feriu, mas o susto pesou em todos.'; }
          return 'Você seguiu a agenda normalmente.';
        },
      });
      return opts;
    },
  },
  {
    id: 'saude_estresse',
    title: () => 'O corpo cobrou a conta',
    body: (s) => `Exames de rotina e um mal-estar na agenda: o médico diz que o ritmo está alto demais (estresse ${Math.round(P(s).stress)}, saúde ${Math.round(P(s).health)}). O jogo não simula doenças específicas — só o desgaste.`,
    weight: 0, condition: () => false,
    options: (s) => [
      { label: 'Reduzir a agenda por 2 meses', hint: 'Menos compromissos, estresse cai rápido', apply: (st: GameState) => { P(st).reducedAgendaUntil = now(st) + 2; P(st).stress = clamp(P(st).stress - 10); return 'Agenda enxuta pelos próximos dois meses.'; } },
      ...(!leaveBlock(s) ? [{ label: 'Licença médica de 1 mês', hint: 'Com salário; o substituto assume', apply: (st: GameState) => { P(st).health = clamp(P(st).health + 8); return startLeave(st, 1, 'saude'); } }] : []),
      {
        label: 'Seguir em frente', hint: 'Pode piorar',
        apply: (st: GameState, rng) => {
          P(st).health = clamp(P(st).health - 8);
          if (next(rng) < 0.3) { P(st).reducedAgendaUntil = now(st) + 2; P(st).stress = clamp(P(st).stress - 15); return 'Você ignorou o aviso e acabou internado(a) por alguns dias. Dois meses de agenda reduzida, à força.'; }
          return 'Você seguiu no ritmo. Por enquanto, deu.';
        },
      },
    ],
  },
  {
    id: 'crise_casamento',
    title: (s) => `Crise em casa com ${partner(s)?.name.split(' ')[0] ?? 'seu par'}`,
    body: (s) => `${partner(s)?.name} diz que você virou uma visita em casa. A conversa foi dura.`,
    weight: 0.25, condition: (s) => !!partner(s) && partner(s)!.mood < 30,
    options: () => [
      { label: 'Terapia de casal', hint: 'R$ 6 mil', apply: (st: GameState) => { st.finances.cash -= 6000; const pt = partner(st)!; pt.mood = clamp(pt.mood + 22); return 'A terapia ajudou a reabrir o diálogo.'; } },
      { label: 'Prometer mais tempo em casa', hint: 'Cumpra nos próximos 3 meses', apply: (st: GameState) => { const pt = partner(st)!; pt.mood = clamp(pt.mood + 10); P(st).promisedTimeUntil = now(st) + 3; return 'Você prometeu. Agora precisa cumprir.'; } },
      { label: 'Separar-se', hint: 'Partilha de bens e notícia', apply: (st: GameState) => divorce(st) },
    ],
  },
  {
    id: 'conjuge_campanha',
    title: () => 'A família na campanha',
    body: (s) => `A coordenação quer ${partner(s)?.name} na propaganda e na agenda. ${partner(s)?.trait === 'reservado' ? 'Só que essa pessoa prefere privacidade.' : 'A ideia agrada.'}`,
    weight: 0.2, condition: (s) => s.player.candidacy?.status === 'registrada' && !!partner(s) && !s.flags[`famCampanha_${s.player.candidacy.year}`],
    options: () => [
      { label: 'Colocar na campanha', apply: (st: GameState) => { st.flags[`famCampanha_${st.player.candidacy!.year}`] = true; const pt = partner(st)!; const ok = pt.trait !== 'reservado'; st.player.candidacy!.campaignPoints += ok ? 5 : 2; pt.mood = clamp(pt.mood + (ok ? 3 : -12)); return ok ? `${pt.name} virou trunfo da campanha.` : `${pt.name} aceitou a contragosto. Em casa, o clima pesou.`; } },
      { label: 'Preservar a família', apply: (st: GameState) => { st.flags[`famCampanha_${st.player.candidacy!.year}`] = true; partner(st)!.mood = clamp(partner(st)!.mood + 5); return 'Você deixou a família fora da propaganda.'; } },
    ],
  },
  {
    id: 'filho_escola',
    title: (s) => `${lowChild(s)?.name.split(' ')[0] ?? 'Seu filho'} não está bem na escola`,
    body: (s) => `A escola chamou: ${lowChild(s)?.name} anda desanimado(a) e sente sua falta.`,
    weight: 0.12, condition: (s) => !!lowChild(s) && lowChild(s)!.mood < 45,
    options: () => [
      { label: 'Ir pessoalmente e reorganizar a semana', hint: 'Custa 1 compromisso pessoal', apply: (st: GameState) => { const c = lowChild(st)!; c.mood = clamp(c.mood + 18); st.actionPoints = Math.max(0, st.actionPoints - 1); P(st).lastFamilyTime = now(st); return `Você foi à escola e passou a tarde com ${c.name.split(' ')[0]}.`; } },
      { label: 'Pedir para outra pessoa da família ir', apply: (st: GameState) => { const c = lowChild(st)!; c.mood = clamp(c.mood - 5); return 'Resolvido por enquanto, mas a ausência foi notada.'; } },
    ],
  },
  {
    id: 'filho_escandalo',
    title: (s) => `${problemAdult(s)?.name} vira notícia`,
    body: (s) => `${problemAdult(s)?.name}, seu(sua) filho(a), se envolveu numa confusão que foi parar nas redes. Jornalistas querem sua posição.`,
    weight: 0.05, condition: (s) => !!problemAdult(s) && s.player.recognition >= 20,
    options: () => [
      { label: 'Defender publicamente', apply: (st: GameState) => { const c = problemAdult(st)!; c.mood = clamp(c.mood + 10); st.player.credibility = clamp((st.player.credibility ?? 60) - 3); st.character.attributes.popularity = clamp(st.character.attributes.popularity - 1); return 'Você defendeu seu filho(a). Parte do público achou corporativismo.'; } },
      { label: 'Pedir desculpas e cobrar responsabilidade', apply: (st: GameState) => { const c = problemAdult(st)!; c.mood = clamp(c.mood - 15); st.player.credibility = clamp((st.player.credibility ?? 60) + 1); return 'Você reconheceu o erro em público. Em casa, a relação esfriou.'; } },
      { label: 'Não comentar', apply: (st: GameState) => { st.player.recognition = clamp(st.player.recognition + 0.5); return 'Você não comentou; o assunto morreu em alguns dias.'; } },
    ],
  },
  {
    id: 'pais_saude',
    title: (s) => `${oldParent(s)?.relation === 'mae' ? 'Sua mãe' : 'Seu pai'} precisa de cuidados`,
    body: (s) => `${oldParent(s)?.name}, ${oldParent(s) ? memberAge(s, oldParent(s)!) : ''} anos, precisa de mais atenção e acompanhamento.`,
    weight: 0.04, condition: (s) => !!oldParent(s),
    options: () => [
      { label: 'Acompanhar de perto', hint: 'Custa 2 compromissos pessoais', apply: (st: GameState) => { const m = oldParent(st)!; m.mood = clamp(m.mood + 15); st.actionPoints = Math.max(0, st.actionPoints - 2); P(st).stress = clamp(P(st).stress + 3); return `Você esteve ao lado de ${m.name.split(' ')[0]} nesta fase.`; } },
      { label: 'Contratar cuidador(a)', hint: 'R$ 8 mil', apply: (st: GameState) => { const m = oldParent(st)!; st.finances.cash -= 8000; m.mood = clamp(m.mood + 4); return 'Você contratou ajuda profissional.'; } },
    ],
  },
  {
    id: 'parente_emprego',
    title: (s) => `${jobSeeker(s)?.name} pede um emprego no gabinete`,
    body: (s) => `${jobSeeker(s)?.name} está sem trabalho e pede um cargo de confiança com você. Nomear parente em cargo comissionado — inclusive por troca de nomeações com outro gabinete — é vedado (Súmula Vinculante 13 do STF) e pode ser improbidade (Lei 8.429/92, art. 11, XI).`,
    weight: 0.04, condition: (s) => !!s.player.mandate && !!TEAM_LIMITS[s.player.mandate.office] && !!jobSeeker(s) && !s.personal?.family.some((m) => m.employedByPlayer),
    options: () => [
      { label: 'Nomear na sua equipe (ILEGAL)', hint: 'Ocupa uma vaga da equipe; agrada em casa; risco de escândalo', apply: (st: GameState, rng) => { const m = jobSeeker(st)!; const r = hireRelative(st, rng, m.id); if (m.employedByPlayer) return r; m.employedByPlayer = 'direto'; m.mood = clamp(m.mood + 15); return `${m.name} foi nomeado(a) num cargo comissionado do gabinete. Se vier a público, é nepotismo.`; } },
      { label: 'Pedir a um colega que contrate, em troca de um favor (ILEGAL)', hint: 'Nepotismo cruzado: mais difícil de descobrir', apply: (st: GameState) => { const m = jobSeeker(st)!; m.employedByPlayer = 'cruzado'; m.mood = clamp(m.mood + 12); return `${m.name} foi contratado(a) no gabinete de um colega, que agora espera retribuição.`; } },
      { label: 'Recusar e explicar a regra', apply: (st: GameState) => { const m = jobSeeker(st)!; m.mood = clamp(m.mood - 8); return `${m.name} não gostou, mas entendeu.`; } },
    ],
  },
  {
    id: 'filho_politica',
    title: (s) => `${ambitiousChild(s)?.name} quer entrar na política`,
    body: (s) => `${ambitiousChild(s)?.name}, ${ambitiousChild(s) ? memberAge(s, ambitiousChild(s)!) : ''} anos, quer seguir seus passos.`,
    weight: 0.05, condition: (s) => !!ambitiousChild(s),
    options: () => [
      { label: 'Apoiar e orientar', hint: 'Vira seu(sua) herdeiro(a) político(a)', apply: (st: GameState) => { const c = ambitiousChild(st)!; c.politicalInterest = Math.max(c.politicalInterest, 75); c.mood = clamp(c.mood + 10); P(st).heirId = c.id; return `${c.name} vai se preparar para uma candidatura. Use "Lançar um parente na política" num ano eleitoral.`; } },
      { label: 'Desencorajar', apply: (st: GameState) => { const c = ambitiousChild(st)!; c.politicalInterest = Math.max(0, c.politicalInterest - 30); c.mood = clamp(c.mood - 8); return `${c.name} desistiu por enquanto.`; } },
    ],
  },
  {
    id: 'planejar_filho',
    title: () => 'A família vai crescer?',
    body: (s) => `Você e ${partner(s)?.name.split(' ')[0]} conversam sobre ${children(s).length ? 'ter mais um filho' : 'ter um filho'}. A rotina política não ajuda, mas a vontade existe.`,
    weight: 0.05,
    condition: (s) => !!partner(s) && partner(s)!.mood >= 50 && !s.personal!.babyDue && children(s).length < 5 && characterAge(s) <= 50 && (s.character.gender !== 'Feminino' || characterAge(s) <= 45) && memberAge(s, partner(s)!) <= 50 && !children(s).some((c) => memberAge(s, c) < 1),
    options: (s) => {
      const fem = s.character.gender === 'Feminino';
      const ptF = partner(s)?.gender === 'F';
      return [
        ...(fem || ptF ? [{ label: 'Sim, vamos ter um filho', hint: 'Nasce em cerca de 9 meses', apply: (st: GameState) => { P(st).babyDue = now(st) + 9; P(st).babyBy = fem ? 'player' : 'partner'; partner(st)!.mood = clamp(partner(st)!.mood + 10); return `${fem ? 'Você está grávida' : `${partner(st)!.name.split(' ')[0]} está grávida`}! O bebê chega em uns 9 meses.`; } }] : []),
        { label: 'Adotar uma criança', hint: 'Processo de adoção: cerca de 12 meses (parâmetro)', apply: (st: GameState) => { P(st).babyDue = now(st) + 12; P(st).babyBy = 'adocao'; partner(st)!.mood = clamp(partner(st)!.mood + 10); return 'Vocês entraram com o pedido de adoção (Estatuto da Criança e do Adolescente, Lei 8.069/90). A chegada deve levar cerca de um ano.'; } },
        { label: 'Agora não', apply: (st: GameState) => { partner(st)!.mood = clamp(partner(st)!.mood - 4); return 'Vocês decidiram esperar.'; } },
      ];
    },
  },
  {
    id: 'nascimento',
    title: (_s, v) => `${String(v.name ?? 'O bebê')} chegou!`,
    body: (s) => `A família cresceu. ${s.player.mandate ? 'E o mandato? Você pode tirar uns dias ou seguir a agenda.' : 'As primeiras semanas vão ser puxadas.'} Trabalhadoras têm licença-gestante de 120 dias e trabalhadores, licença-paternidade (CF art. 7º, XVIII e XIX); para quem tem mandato, quem regula é a própria Casa ou o Executivo — o jogo usa uma licença remunerada.`,
    weight: 0, condition: () => false,
    options: (s) => {
      const gave = s.character.gender === 'Feminino' && s.personal?.babyBy !== 'adocao';
      const opts = [] as { label: string; hint?: string; apply: (st: GameState) => string }[];
      if (!leaveBlock(s)) opts.push({ label: `Tirar licença de ${gave ? '4 meses' : '1 mês'}`, hint: 'Com salário; o substituto assume', apply: (st: GameState) => { P(st).lastFamilyTime = now(st); return startLeave(st, gave ? 4 : 1, 'nascimento'); } });
      opts.push({ label: 'Ficar em casa nas primeiras semanas', hint: 'Custa 2 compromissos pessoais', apply: (st: GameState) => { st.actionPoints = Math.max(0, st.actionPoints - 2); P(st).stress = clamp(P(st).stress - 5); const pt = partner(st); if (pt) pt.mood = clamp(pt.mood + 8); return 'Você ficou com a família nas primeiras semanas.'; } });
      opts.push({ label: 'Voltar logo para a agenda', apply: (st: GameState) => { const pt = partner(st); if (pt) pt.mood = clamp(pt.mood - 12); P(st).stress = clamp(P(st).stress + 6); return 'Você voltou ao trabalho no dia seguinte. Em casa, isso pesou.'; } });
      return opts;
    },
  },
  {
    id: 'novo_amor',
    title: () => 'Alguém interessante',
    body: () => 'Num evento, você conheceu uma pessoa interessante (personagem do jogo). A conversa fluiu.',
    weight: 0.04, condition: (s) => !!s.personal && !partner(s) && !s.personal.romance,
    options: () => [
      { label: 'Chamar para sair', apply: (st: GameState, rng) => { const g = next(rng) < 0.5 ? 'F' : 'M'; P(st).romance = { name: `${firstName(rng, g)} ${['Lima', 'Mota', 'Pires', 'Reis', 'Viana'][Math.floor(next(rng) * 5)]}`, gender: g, birthYear: Number(st.character.birthDate.slice(0, 4)) + Math.round((next(rng) - 0.5) * 8), affinity: 40, stage: 'conhecendo', since: now(st), public: false }; return `Vocês marcaram de sair. Use "Encontro" para continuar.`; } },
      { label: 'Agora não é hora', apply: () => 'Você deixou para depois.' },
    ],
  },
  {
    id: 'namoro_publico',
    title: (s) => `Assumir o namoro com ${s.personal?.romance?.name}?`,
    body: () => 'Uma foto de vocês juntos circulou. A imprensa de celebridades pergunta.',
    weight: 0.15, condition: (s) => !!s.personal?.romance && s.personal.romance.stage === 'namoro' && !s.personal.romance.public && s.player.recognition >= 15,
    options: () => [
      { label: 'Assumir publicamente', apply: (st: GameState) => { const r = P(st).romance!; r.public = true; r.affinity = clamp(r.affinity + 8); st.player.recognition = grow(st.player.recognition, 1); return `Você e ${r.name} assumiram o namoro.`; } },
      { label: 'Manter discreto', apply: (st: GameState) => { const r = P(st).romance!; r.affinity = clamp(r.affinity - 6); return 'Vocês preferiram discrição.'; } },
    ],
  },
  {
    id: 'casamento',
    title: (s) => `Casar com ${s.personal?.romance?.name}?`,
    body: () => 'O relacionamento ficou sério e o assunto apareceu.',
    weight: 0.12, condition: (s) => !!s.personal?.romance && s.personal.romance.stage === 'namoro' && s.personal.romance.affinity >= 75 && now(s) - s.personal.romance.since >= 8,
    options: () => [
      { label: 'Casar', hint: 'Festa: R$ 30 mil', apply: (st: GameState) => marry(st, 'conjuge') },
      { label: 'União estável, sem festa', hint: 'Registro em cartório', apply: (st: GameState) => marry(st, 'companheiro') },
      { label: 'Ainda não', apply: (st: GameState) => { const r = P(st).romance!; r.affinity = clamp(r.affinity - 15); return 'Você pediu mais tempo.'; } },
    ],
  },
  {
    id: 'amigo_favor',
    title: (s) => `${s.personal?.friends.find((f) => f.kind !== 'mentor')?.name} pede um favor`,
    body: (s) => `${s.personal?.friends.find((f) => f.kind !== 'mentor')?.name}, ${s.personal?.friends.find((f) => f.kind !== 'mentor')?.kind === 'ex_socio' ? 'seu ex-sócio' : 'amigo de longa data'}, quer ajuda para a empresa dele fechar um contrato com o poder público.`,
    weight: 0.04, condition: (s) => !!s.player.mandate && !!s.personal?.friends.some((f) => f.kind !== 'mentor'),
    options: () => [
      { label: 'Orientar dentro da lei', hint: 'Explicar a licitação, sem interferir', apply: (st: GameState) => { const f = P(st).friends.find((x) => x.kind !== 'mentor')!; f.trust = clamp(f.trust + 3); return `Você explicou como funciona a licitação. ${f.name} vai participar como qualquer empresa.`; } },
      {
        label: 'Interferir para favorecer (ILEGAL)', hint: 'Vantagem para o amigo; risco alto',
        apply: (st: GameState, rng) => {
          const f = P(st).friends.find((x) => x.kind !== 'mentor')!; f.trust = clamp(f.trust + 15);
          st.flags.vantagemIndevida = Number(st.flags.vantagemIndevida ?? 0) + 1;
          if (next(rng) < 0.35) { st.player.credibility = clamp((st.player.credibility ?? 60) - 15); st.character.attributes.popularity = clamp(st.character.attributes.popularity - 4); if (st.player.mandate) st.player.mandate.approval = clamp(st.player.mandate.approval - 8); return `A imprensa descobriu sua interferência para favorecer a empresa de ${f.name}. Escândalo.`; }
          return `${f.name} ficou devendo um grande favor. Por enquanto, ninguém percebeu.`;
        },
      },
      { label: 'Recusar', apply: (st: GameState) => { const f = P(st).friends.find((x) => x.kind !== 'mentor')!; f.trust = clamp(f.trust - 15); return `${f.name} se afastou.`; } },
    ],
  },
  {
    id: 'adversario_pessoal',
    title: () => 'Um adversário pessoal',
    body: () => `Um influenciador político (personagem do jogo) passou a atacar você toda semana nas redes, com insinuações sobre sua vida e sua família.`,
    weight: 0.05, condition: (s) => !!s.personal && !s.personal.rival && s.personal.exposure >= 30,
    options: () => [
      { label: 'Responder à altura', hint: 'Engaja a base, aumenta a tensão', apply: (st: GameState, rng) => { setRival(st, rng, 45); st.player.base = grow(st.player.base, 1.5); P(st).heat = clamp(P(st).heat + 5); return 'Você rebateu. O embate virou assunto.'; } },
      { label: 'Ignorar', hint: 'Desgaste lento', apply: (st: GameState, rng) => { setRival(st, rng, 30); st.character.attributes.popularity = clamp(st.character.attributes.popularity - 1); return 'Você ignorou. Os ataques continuam por um tempo.'; } },
    ],
  },
];

function setRival(s: GameState, r: RngState, intensity: number) {
  P(s).rival = { name: `${firstName(r, next(r) < 0.5 ? 'F' : 'M')} ${['Tavares', 'Macedo', 'Furtado', 'Bittencourt', 'Paiva'][Math.floor(next(r) * 5)]}`, intensity, since: now(s) };
}
function markResponse(s: GameState, r: string) { const t = P(s).threats[P(s).threats.length - 1]; if (t) t.response = r; }
