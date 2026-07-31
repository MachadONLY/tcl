/**
 * Touchline News Desk
 *
 * Deterministic journalism layer for the career world. It receives structured
 * season events and turns them into an editorial feed. No result is invented
 * here: the desk only interprets match, table, injury and fixture state.
 */

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function teamPosition(table, team) {
  return table.find(item => item.name === team)?.pos ?? 20;
}

function scoreline(result) {
  return `${result.homeGoals}–${result.awayGoals}`;
}

function resultWeight(result, table) {
  const margin = Math.abs(result.homeGoals - result.awayGoals);
  const homePosition = teamPosition(table, result.home);
  const awayPosition = teamPosition(table, result.away);
  const winnerPosition = result.homeGoals > result.awayGoals ? homePosition : awayPosition;
  const loserPosition = result.homeGoals > result.awayGoals ? awayPosition : homePosition;
  const upset = winnerPosition > loserPosition ? Math.min(8, winnerPosition - loserPosition) : 0;
  const rivalry = result.rivalry ? 4 : 0;
  return margin * 3 + upset + rivalry + Number(result.featured || 0) * 6;
}

function resultArticle(result, table) {
  const homeWon = result.homeGoals > result.awayGoals;
  const draw = result.homeGoals === result.awayGoals;
  const winner = draw ? null : homeWon ? result.home : result.away;
  const loser = draw ? null : homeWon ? result.away : result.home;
  const margin = Math.abs(result.homeGoals - result.awayGoals);
  const upset = winner && teamPosition(table, winner) > teamPosition(table, loser);
  const statement = margin >= 3 ? "atropela" : margin === 2 ? "vence com autoridade" : "leva a melhor sobre";

  let title;
  let summary;

  if (draw) {
    title = `${result.home} e ${result.away} dividem pontos em ${scoreline(result)}`;
    summary = "O empate mexe no ritmo da corrida pela tabela e aumenta o peso da próxima rodada para as duas equipes.";
  } else if (upset) {
    title = `${winner} surpreende ${loser} e assina o resultado da rodada`;
    summary = `O ${scoreline(result)} altera o ambiente da competição e pressiona quem estava à frente antes da rodada.`;
  } else {
    title = `${winner} ${statement} ${loser}: ${scoreline(result)}`;
    summary = margin >= 3
      ? "A atuação dominante muda a leitura da disputa no topo e deve repercutir nas decisões dos próximos adversários."
      : "O resultado vale três pontos e também reposiciona a narrativa da equipe para a sequência do calendário.";
  }

  return {
    id: `result-${slug(result.home)}-${slug(result.away)}`,
    category: "league",
    label: result.rivalry ? "JOGO DA RODADA" : "PREMIER LEAGUE",
    title,
    summary,
    image: result.image,
    timestamp: result.timestamp || "Há 2 h",
    credit: result.credit || "Imagem editorial demonstrativa · Wikimedia Commons",
    priority: resultWeight(result, table)
  };
}

function injuryArticle(injury) {
  const severity = injury.daysOut >= 28 ? "desfalque importante" : injury.daysOut >= 10 ? "vira dúvida" : "será reavaliado";
  return {
    id: `injury-${slug(injury.player)}`,
    category: injury.team === injury.userTeam ? "club" : "league",
    label: "DEPARTAMENTO MÉDICO",
    title: `${injury.player} ${severity} após avaliação médica`,
    summary: `${injury.team} estima ${injury.daysOut} dias de recuperação. A ausência pode alterar funções, convocação e estratégia para os próximos jogos.`,
    image: injury.image,
    timestamp: injury.timestamp || "Há 4 h",
    credit: injury.credit || "Imagem editorial demonstrativa · Wikimedia Commons",
    priority: 12 + Math.min(12, injury.daysOut / 3)
  };
}

function fixtureArticle(fixture) {
  return {
    id: `fixture-${slug(fixture.home)}-${slug(fixture.away)}`,
    category: fixture.userTeam ? "club" : "league",
    label: fixture.userTeam ? "PRÓXIMO JOGO" : "AGENDA",
    title: fixture.userTeam
      ? `${fixture.away} fecha a preparação para visitar ${fixture.home}`
      : `${fixture.home} e ${fixture.away} carregam pressão para o próximo confronto`,
    summary: fixture.summary || "Tabela, momento recente e disponibilidade do elenco tornam o encontro um dos pontos centrais da próxima rodada.",
    image: fixture.image,
    timestamp: fixture.timestamp || "Hoje",
    credit: fixture.credit || "Imagem editorial demonstrativa · Wikimedia Commons",
    priority: fixture.userTeam ? 30 : 8
  };
}

export function buildNewsDeskFeed({ table = [], results = [], injuries = [], fixtures = [] } = {}) {
  const articles = [
    ...results.map(result => resultArticle(result, table)),
    ...injuries.map(injuryArticle),
    ...fixtures.map(fixtureArticle)
  ];

  return articles
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority, ...article }) => article);
}
