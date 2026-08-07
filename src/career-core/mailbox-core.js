import {
  PLAYER_BY_ID,
  addDays,
  hashString,
  nextUserFixture,
  squadFor
} from './career-core.js';
import { CLUB_BY_CODE } from './season-2026-27-live.js';

const SEED_VERSION = 1;
const OFFER_CLUBS = Object.freeze([
  'Ajax', 'Real Betis', 'Atalanta', 'Borussia Dortmund', 'Olympique de Marseille', 'Villarreal'
]);
const INJURY_TYPES = Object.freeze([
  ['Distensão na coxa', 14],
  ['Entorse no tornozelo', 10],
  ['Lesão muscular leve', 7],
  ['Contusão no joelho', 18],
  ['Sobrecarga na panturrilha', 6]
]);
const PRIORITY_SCORE = Object.freeze({ urgent: 4, high: 3, normal: 2, low: 1 });

const clone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function amountLabel(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function dateScore(value) {
  const score = Date.parse(`${value || '1970-01-01'}T12:00:00Z`);
  return Number.isFinite(score) ? score : 0;
}

function messageDefaults(message, index = 0) {
  const id = message.id || `legacy-${index}-${hashString(`${message.sender}:${message.subject}:${message.date}`)}`;
  const matchReport = String(id).startsWith('match-report-');
  const welcome = id === 'welcome';
  const pack = id === 'pack';
  return {
    id,
    date: message.date || '2026-08-10',
    createdAt: message.createdAt || `${message.date || '2026-08-10'}T12:00:00.000Z`,
    sender: message.sender || 'Clube',
    senderRole: message.senderRole || (matchReport ? 'Análise de desempenho' : welcome ? 'Diretoria' : pack ? 'Operações' : 'Clube'),
    subject: message.subject || 'Nova mensagem',
    body: message.body || '',
    preview: message.preview || message.body || '',
    category: message.category || (matchReport ? 'match' : welcome ? 'board' : pack ? 'system' : 'club'),
    kind: message.kind || (matchReport ? 'match-report' : welcome ? 'welcome' : pack ? 'system' : 'notice'),
    priority: message.priority || (matchReport ? 'normal' : 'low'),
    read: Boolean(message.read),
    archived: Boolean(message.archived),
    requiresResponse: Boolean(message.requiresResponse),
    status: message.status || 'open',
    actions: Array.isArray(message.actions) ? clone(message.actions) : [],
    entity: message.entity ? clone(message.entity) : null,
    data: message.data ? clone(message.data) : {},
    response: message.response ? clone(message.response) : null
  };
}

function pushMessage(career, message) {
  if (career.inbox.some(item => item.id === message.id)) return null;
  const normalized = messageDefaults(message, career.inbox.length);
  career.inbox.unshift(normalized);
  return normalized;
}

function playerInitials(player) {
  return String(player?.name || 'Jogador').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function lowestConditionPlayers(career, limit = 3) {
  return squadFor(career.clubCode)
    .map(player => ({ player, state: career.playerState?.[player.id] }))
    .filter(entry => entry.state)
    .sort((left, right) => Number(left.state.condition || 100) - Number(right.state.condition || 100))
    .slice(0, limit);
}

function bestBenchPlayer(career) {
  const selected = new Set(career.lineup || []);
  return squadFor(career.clubCode)
    .filter(player => !selected.has(player.id))
    .sort((left, right) => right.rating - left.rating || right.value - left.value)[0] || null;
}

function transferCandidate(career) {
  const selected = new Set(career.lineup || []);
  return squadFor(career.clubCode)
    .filter(player => !selected.has(player.id))
    .sort((left, right) => right.value - left.value || right.rating - left.rating)[0] || null;
}

function fillLineupAfterRemoval(career, removedId) {
  const remaining = (career.lineup || []).filter(id => id !== removedId && PLAYER_BY_ID.has(id));
  const blocked = new Set(remaining);
  const replacement = squadFor(career.clubCode)
    .filter(player => !blocked.has(player.id) && !career.playerState?.[player.id]?.departurePending && !career.injuries?.[player.id]?.active)
    .sort((left, right) => right.rating - left.rating)[0];
  if (replacement) remaining.push(replacement.id);
  career.lineup = remaining.slice(0, 11);
}

function seedMailbox(career) {
  if (Number(career.mailboxSeedVersion || 0) >= SEED_VERSION) return;
  const player = bestBenchPlayer(career);
  const medical = lowestConditionPlayers(career, 3);
  const transferPlayer = transferCandidate(career);
  const fixture = nextUserFixture(career);
  const opponentCode = fixture ? (fixture.home === career.clubCode ? fixture.away : fixture.home) : null;
  const opponent = opponentCode ? CLUB_BY_CODE.get(opponentCode) : null;

  if (player) {
    pushMessage(career, {
      id: `player-minutes-${player.id}`,
      date: career.currentDate,
      sender: player.name,
      senderRole: 'Jogador do elenco principal',
      subject: 'Quero uma oportunidade na equipe titular',
      body: 'Mister, tenho treinado bem e acredito que posso ajudar mais. Gostaria de saber se terei minutos nas próximas partidas.',
      preview: 'O jogador quer clareza sobre seu espaço e espera uma resposta.',
      category: 'player',
      kind: 'player-minutes',
      priority: 'high',
      requiresResponse: true,
      entity: { type: 'player', playerId: player.id, initials: playerInitials(player) },
      data: { playerId: player.id, deadline: addDays(career.currentDate, 5) },
      actions: [
        { id: 'promise-minutes', label: 'Prometer minutos', kind: 'primary' },
        { id: 'be-honest', label: 'Ser honesto', kind: 'secondary' },
        { id: 'loan-list', label: 'Considerar empréstimo', kind: 'quiet' }
      ]
    });
  }

  if (medical.length) {
    pushMessage(career, {
      id: `medical-load-${career.currentDate}`,
      date: career.currentDate,
      sender: 'Dra. Helena Costa',
      senderRole: 'Chefe do departamento médico',
      subject: `${medical.length} jogadores exigem controle de carga`,
      body: `${medical.map(entry => entry.player.name).join(', ')} apresentam os menores índices de condição do elenco. A recomendação é reduzir a intensidade por alguns dias.`,
      preview: 'A equipe médica recomenda ajuste imediato na carga de treino.',
      category: 'medical',
      kind: 'medical-load',
      priority: medical.some(entry => Number(entry.state.condition || 100) < 72) ? 'urgent' : 'high',
      requiresResponse: true,
      entity: { type: 'staff', initials: 'HC' },
      data: { playerIds: medical.map(entry => entry.player.id) },
      actions: [
        { id: 'recovery-plan', label: 'Aplicar recuperação', kind: 'primary' },
        { id: 'monitor-load', label: 'Apenas monitorar', kind: 'secondary' }
      ]
    });
  }

  if (transferPlayer) {
    const offerId = `offer-${transferPlayer.id}-${career.currentDate}`;
    const amount = Math.max(2500000, Math.round((transferPlayer.value * 1.08) / 250000) * 250000);
    const buyer = OFFER_CLUBS[hashString(`${career.clubCode}:${transferPlayer.id}`) % OFFER_CLUBS.length];
    career.transferOffers[offerId] = {
      id: offerId, playerId: transferPlayer.id, buyer, amount, status: 'received',
      receivedAt: career.currentDate, deadline: addDays(career.currentDate, 6)
    };
    pushMessage(career, {
      id: `transfer-offer-${offerId}`,
      date: career.currentDate,
      sender: buyer,
      senderRole: 'Departamento de futebol',
      subject: `Proposta por ${transferPlayer.name}`,
      body: `${buyer} apresentou uma proposta de ${amountLabel(amount)} pela transferência definitiva de ${transferPlayer.name}. A oferta expira em seis dias.`,
      preview: `${amountLabel(amount)} por ${transferPlayer.name}.`,
      category: 'transfer',
      kind: 'transfer-offer',
      priority: 'urgent',
      requiresResponse: true,
      entity: { type: 'player', playerId: transferPlayer.id, initials: playerInitials(transferPlayer) },
      data: { offerId, playerId: transferPlayer.id, buyer, amount, deadline: addDays(career.currentDate, 6) },
      actions: [
        { id: 'accept-offer', label: 'Aceitar proposta', kind: 'primary' },
        { id: 'negotiate-offer', label: 'Negociar', kind: 'secondary' },
        { id: 'reject-offer', label: 'Recusar', kind: 'danger' }
      ]
    });
  }

  if (opponent) {
    pushMessage(career, {
      id: `opponent-report-${fixture.id}`,
      date: career.currentDate,
      sender: 'Jason McCarthy',
      senderRole: 'Analista de desempenho',
      subject: `Relatório: como atacar o ${opponent.shortName || opponent.name}`,
      body: `O ${opponent.name} deixa espaço entre o lateral e o zagueiro quando perde a posse. Nossa recomendação é acelerar por fora e atacar a segunda bola.`,
      preview: 'Relatório do próximo adversário disponível para a comissão.',
      category: 'staff',
      kind: 'opponent-report',
      priority: 'normal',
      requiresResponse: false,
      entity: { type: 'staff', initials: 'JM' },
      data: { fixtureId: fixture.id, opponentCode },
      actions: [{ id: 'open-tactics', label: 'Abrir táticas', kind: 'primary' }]
    });
  }

  career.mailboxSeedVersion = SEED_VERSION;
}

function processPlayerPromises(career, result) {
  for (const promise of Object.values(career.playerPromises || {})) {
    if (promise.status !== 'active') continue;
    const appeared = [...(result.lineups?.home || []), ...(result.lineups?.away || [])].includes(promise.playerId);
    if (!appeared) continue;
    promise.status = 'fulfilled';
    promise.fulfilledAt = result.date;
    const player = PLAYER_BY_ID.get(promise.playerId);
    if (career.playerState?.[promise.playerId]) {
      career.playerState[promise.playerId].morale = Math.min(100, Number(career.playerState[promise.playerId].morale || 70) + 5);
    }
    pushMessage(career, {
      id: `promise-fulfilled-${promise.playerId}-${result.fixtureId}`,
      date: result.date,
      sender: player?.name || 'Jogador',
      senderRole: 'Jogador do elenco principal',
      subject: 'Obrigado pela oportunidade',
      body: 'Mister, obrigado por cumprir o que combinamos. Vou continuar trabalhando para aproveitar cada minuto.',
      category: 'player', kind: 'player-feedback', priority: 'low', read: false,
      entity: { type: 'player', playerId: promise.playerId, initials: playerInitials(player) }
    });
  }
}

function processResultInjury(career, result) {
  const userSide = result.home === career.clubCode ? 'home' : result.away === career.clubCode ? 'away' : null;
  if (!userSide) return;
  const lineup = (result.lineups?.[userSide] || []).map(id => ({ id, state: career.playerState?.[id] })).filter(entry => entry.state);
  if (!lineup.length) return;
  const risk = hashString(`${result.fixtureId}:${career.clubCode}:injury`) % 100;
  const candidate = lineup.sort((left, right) => Number(left.state.condition || 100) - Number(right.state.condition || 100))[0];
  const condition = Number(candidate.state.condition || 100);
  if (risk >= 24 && condition >= 66) return;
  if (career.injuries[candidate.id]?.active) return;

  const [type, baseDays] = INJURY_TYPES[hashString(`${result.fixtureId}:${candidate.id}`) % INJURY_TYPES.length];
  const days = baseDays + (hashString(`${candidate.id}:${result.fixtureId}:days`) % 5);
  const returnDate = addDays(result.date, days);
  const player = PLAYER_BY_ID.get(candidate.id);
  career.injuries[candidate.id] = { active: true, type, injuredAt: result.date, returnDate, days, fixtureId: result.fixtureId };
  candidate.state.injury = type;
  candidate.state.unavailable = true;
  fillLineupAfterRemoval(career, candidate.id);

  pushMessage(career, {
    id: `injury-${candidate.id}-${result.fixtureId}`,
    date: result.date,
    sender: 'Dra. Helena Costa',
    senderRole: 'Chefe do departamento médico',
    subject: `${player?.name || 'Jogador'} sofreu uma lesão`,
    body: `${player?.name || 'O atleta'} sofreu ${type.toLowerCase()} e ficará indisponível por aproximadamente ${days} dias. Retorno estimado: ${returnDate.split('-').reverse().join('/')}.`,
    preview: `${type} · previsão de ${days} dias fora.`,
    category: 'medical', kind: 'injury', priority: 'urgent', requiresResponse: true,
    entity: { type: 'player', playerId: candidate.id, initials: playerInitials(player) },
    data: { playerId: candidate.id, type, days, returnDate },
    actions: [
      { id: 'injury-recovery', label: 'Definir recuperação', kind: 'primary' },
      { id: 'acknowledge', label: 'Ciente', kind: 'secondary' }
    ]
  });
}

function processNewResults(career) {
  const results = Object.values(career.results || {}).sort((left, right) => String(left.date).localeCompare(String(right.date)));
  for (const result of results) {
    if (!result?.fixtureId || career.mailboxProcessedResults[result.fixtureId]) continue;
    processPlayerPromises(career, result);
    processResultInjury(career, result);
    career.mailboxProcessedResults[result.fixtureId] = true;
  }
}

function processReturns(career) {
  for (const [playerId, injury] of Object.entries(career.injuries || {})) {
    if (!injury?.active || String(career.currentDate) < String(injury.returnDate)) continue;
    injury.active = false;
    injury.clearedAt = career.currentDate;
    const player = PLAYER_BY_ID.get(playerId);
    const state = career.playerState?.[playerId];
    if (state) {
      state.injury = null;
      state.unavailable = false;
      state.condition = Math.max(72, Number(state.condition || 72));
    }
    pushMessage(career, {
      id: `medical-clearance-${playerId}-${injury.returnDate}`,
      date: career.currentDate,
      sender: 'Dra. Helena Costa',
      senderRole: 'Chefe do departamento médico',
      subject: `${player?.name || 'Jogador'} voltou aos treinos`,
      body: `${player?.name || 'O atleta'} concluiu a recuperação de ${String(injury.type || 'lesão').toLowerCase()} e está liberado para treinar com o grupo. A recomendação é retorno gradual aos minutos de jogo.`,
      preview: 'Atleta liberado, com recomendação de retorno gradual.',
      category: 'medical', kind: 'medical-clearance', priority: 'high', requiresResponse: false,
      entity: { type: 'player', playerId, initials: playerInitials(player) },
      data: { playerId, injuryType: injury.type }
    });
  }
}

function expireOffers(career) {
  for (const offer of Object.values(career.transferOffers || {})) {
    if (offer.status !== 'received' && offer.status !== 'countered') continue;
    if (String(career.currentDate) <= String(offer.deadline)) continue;
    offer.status = 'expired';
    const message = career.inbox.find(item => item.data?.offerId === offer.id && item.requiresResponse);
    if (message) {
      message.requiresResponse = false;
      message.status = 'expired';
      message.response = { actionId: 'expired', label: 'Oferta expirada', date: career.currentDate };
    }
  }
}

export function reconcileMailbox(career) {
  if (!career || typeof career !== 'object') return career;
  career.inbox = Array.isArray(career.inbox)
    ? career.inbox.map((message, index) => messageDefaults(message, index))
    : [];
  career.transferOffers = career.transferOffers && typeof career.transferOffers === 'object' ? career.transferOffers : {};
  career.playerPromises = career.playerPromises && typeof career.playerPromises === 'object' ? career.playerPromises : {};
  career.injuries = career.injuries && typeof career.injuries === 'object' ? career.injuries : {};
  career.mailboxProcessedResults = career.mailboxProcessedResults && typeof career.mailboxProcessedResults === 'object'
    ? career.mailboxProcessedResults
    : {};
  career.transferLedger = Array.isArray(career.transferLedger) ? career.transferLedger : [];
  seedMailbox(career);
  processNewResults(career);
  processReturns(career);
  expireOffers(career);
  career.inbox.sort((left, right) =>
    dateScore(right.date) - dateScore(left.date) ||
    Number(Boolean(right.requiresResponse)) - Number(Boolean(left.requiresResponse)) ||
    (PRIORITY_SCORE[right.priority] || 0) - (PRIORITY_SCORE[left.priority] || 0)
  );
  return career;
}

export function careerInboxItems(career, { filter = 'all', limit = Infinity, query = '' } = {}) {
  reconcileMailbox(career);
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');
  const items = career.inbox
    .filter(message => !message.archived)
    .filter(message => filter === 'all' ||
      (filter === 'unread' && !message.read) ||
      (filter === 'required' && message.requiresResponse) ||
      message.category === filter)
    .filter(message => !normalizedQuery || [message.sender, message.subject, message.body]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery)))
    .sort((left, right) =>
      Number(Boolean(right.requiresResponse)) - Number(Boolean(left.requiresResponse)) ||
      Number(!right.read) - Number(!left.read) ||
      dateScore(right.date) - dateScore(left.date) ||
      (PRIORITY_SCORE[right.priority] || 0) - (PRIORITY_SCORE[left.priority] || 0)
    );
  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

export function mailboxSummary(career) {
  const items = careerInboxItems(career);
  return {
    total: items.length,
    unread: items.filter(message => !message.read).length,
    required: items.filter(message => message.requiresResponse).length,
    urgent: items.filter(message => message.priority === 'urgent' && message.status === 'open').length
  };
}

export function markMailboxRead(career, messageId, read = true) {
  reconcileMailbox(career);
  const message = career.inbox.find(item => item.id === messageId);
  if (message) message.read = Boolean(read);
  return message || null;
}

function resolveMessage(message, actionId, label, date) {
  message.read = true;
  message.requiresResponse = false;
  message.status = 'resolved';
  message.response = { actionId, label, date };
}

export function respondToMailboxMessage(career, messageId, actionId) {
  reconcileMailbox(career);
  const message = career.inbox.find(item => item.id === messageId);
  if (!message) return { career, message: null, route: null };
  const date = career.currentDate;
  const playerId = message.data?.playerId;
  const player = PLAYER_BY_ID.get(playerId);
  const state = playerId ? career.playerState?.[playerId] : null;
  let route = null;

  if (actionId === 'open-tactics') {
    message.read = true;
    route = 'tactics';
    return { career, message, route };
  }

  if (message.kind === 'player-minutes') {
    if (actionId === 'promise-minutes') {
      career.playerPromises[playerId] = { playerId, type: 'minutes', status: 'active', promisedAt: date, dueBy: addDays(date, 14) };
      if (state) state.morale = Math.min(100, Number(state.morale || 70) + 4);
      resolveMessage(message, actionId, 'Minutos prometidos nas próximas partidas', date);
    } else if (actionId === 'loan-list') {
      if (state) state.loanListed = true;
      resolveMessage(message, actionId, 'Possível empréstimo será avaliado', date);
    } else {
      if (state) state.morale = Math.max(20, Number(state.morale || 70) - 2);
      resolveMessage(message, actionId, 'Sem promessa de minutos', date);
    }
  } else if (message.kind === 'medical-load') {
    if (actionId === 'recovery-plan') {
      career.trainingFocus = 'Recuperação';
      career.medicalPlan = { type: 'recovery', playerIds: clone(message.data?.playerIds || []), startedAt: date };
      resolveMessage(message, actionId, 'Plano de recuperação aplicado', date);
    } else {
      resolveMessage(message, actionId, 'Carga será monitorada', date);
    }
  } else if (message.kind === 'injury') {
    if (actionId === 'injury-recovery') career.trainingFocus = 'Recuperação';
    resolveMessage(message, actionId, actionId === 'injury-recovery' ? 'Recuperação individual definida' : 'Relatório médico confirmado', date);
  } else if (message.kind === 'transfer-offer') {
    const offer = career.transferOffers?.[message.data?.offerId];
    if (!offer) {
      resolveMessage(message, actionId, 'Oferta indisponível', date);
    } else if (actionId === 'accept-offer') {
      offer.status = 'accepted';
      offer.resolvedAt = date;
      career.transferBudget = Number(career.transferBudget || 0) + Number(offer.amount || 0);
      career.transferLedger.push({ ...clone(offer), type: 'sale' });
      if (state) state.departurePending = true;
      fillLineupAfterRemoval(career, playerId);
      resolveMessage(message, actionId, `Proposta aceita por ${amountLabel(offer.amount)}`, date);
      pushMessage(career, {
        id: `transfer-accepted-${offer.id}`,
        date,
        sender: 'Diretor de Futebol', senderRole: 'Operações de futebol',
        subject: `Venda de ${player?.name || 'jogador'} aprovada`,
        body: `O acordo com ${offer.buyer} foi aprovado por ${amountLabel(offer.amount)}. O valor foi incorporado ao orçamento de transferências e a documentação seguirá para conclusão.`,
        category: 'transfer', kind: 'transfer-update', priority: 'high', read: false,
        entity: { type: 'player', playerId, initials: playerInitials(player) }
      });
    } else if (actionId === 'negotiate-offer') {
      offer.status = 'countered';
      offer.amount = Math.round((Number(offer.amount || 0) * 1.12) / 250000) * 250000;
      offer.deadline = addDays(date, 4);
      message.data.amount = offer.amount;
      message.data.deadline = offer.deadline;
      message.body = `A contraproposta de ${amountLabel(offer.amount)} foi enviada ao ${offer.buyer}. O clube respondeu que analisará os novos termos antes do prazo.`;
      resolveMessage(message, actionId, `Contraproposta enviada: ${amountLabel(offer.amount)}`, date);
      pushMessage(career, {
        id: `transfer-counter-${offer.id}`,
        date,
        sender: offer.buyer, senderRole: 'Departamento de futebol',
        subject: `Nova resposta por ${player?.name || 'jogador'}`,
        body: `${offer.buyer} aceita avançar com ${amountLabel(offer.amount)}. Esta é a proposta final e exige uma decisão.`,
        category: 'transfer', kind: 'transfer-offer', priority: 'urgent', requiresResponse: true,
        entity: { type: 'player', playerId, initials: playerInitials(player) },
        data: { offerId: offer.id, playerId, buyer: offer.buyer, amount: offer.amount, deadline: offer.deadline },
        actions: [
          { id: 'accept-offer', label: 'Aceitar proposta', kind: 'primary' },
          { id: 'reject-offer', label: 'Encerrar negociação', kind: 'danger' }
        ]
      });
    } else {
      offer.status = 'rejected';
      offer.resolvedAt = date;
      resolveMessage(message, actionId, 'Proposta recusada', date);
    }
  } else {
    resolveMessage(message, actionId, 'Mensagem confirmada', date);
  }

  return { career, message, route };
}
