import { PREMIER_LEAGUE_PLAYERS, PLAYER_FACE_META } from "./data/premier-league-player-faces.js";

const MUN = "Manchester United";

const FALLBACK_SQUAD = [
  [101,"Altay Bayındır","MUN",MUN,"GK",28,78,81,20000000,70000,1,"Turkey"],
  [102,"André Onana","MUN",MUN,"GK",30,82,83,32000000,120000,24,"Cameroon"],
  [103,"Tom Heaton","MUN",MUN,"GK",40,72,72,800000,45000,22,"England"],
  [104,"Diogo Dalot","MUN",MUN,"RB",27,82,84,42000000,105000,2,"Portugal"],
  [105,"Noussair Mazraoui","MUN",MUN,"RB",28,81,81,30000000,110000,3,"Morocco"],
  [106,"Leny Yoro","MUN",MUN,"CB",20,82,90,62000000,95000,15,"France"],
  [107,"Matthijs de Ligt","MUN",MUN,"CB",26,84,86,55000000,175000,4,"Netherlands"],
  [108,"Lisandro Martínez","MUN",MUN,"CB",28,84,85,50000000,150000,6,"Argentina"],
  [109,"Harry Maguire","MUN",MUN,"CB",33,79,79,12000000,150000,5,"England"],
  [110,"Ayden Heaven","MUN",MUN,"CB",19,73,86,12000000,22000,26,"England"],
  [111,"Patrick Dorgu","MUN",MUN,"LWB",21,79,86,34000000,62000,13,"Denmark"],
  [112,"Luke Shaw","MUN",MUN,"LB",31,80,80,18000000,150000,23,"England"],
  [113,"Manuel Ugarte","MUN",MUN,"CDM",25,82,85,43000000,120000,25,"Uruguay"],
  [114,"Casemiro","MUN",MUN,"CDM",34,80,80,10000000,270000,18,"Brazil"],
  [115,"Kobbie Mainoo","MUN",MUN,"CM",21,82,90,62000000,70000,37,"England","https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Kobbie_Mainoo_England_v_Ghana_23_June_2026-042.jpg/330px-Kobbie_Mainoo_England_v_Ghana_23_June_2026-042.jpg"],
  [116,"Bruno Fernandes","MUN",MUN,"CAM",31,87,87,72000000,280000,8,"Portugal"],
  [117,"Mason Mount","MUN",MUN,"CAM",27,81,82,35000000,180000,7,"England"],
  [118,"Amad Diallo","MUN",MUN,"RW",24,83,87,52000000,90000,16,"Ivory Coast"],
  [119,"Bryan Mbeumo","MUN",MUN,"RW",26,84,85,62000000,145000,19,"Cameroon"],
  [120,"Matheus Cunha","MUN",MUN,"CF",27,84,85,60000000,155000,10,"Brazil"],
  [121,"Benjamin Šeško","MUN",MUN,"ST",23,83,89,68000000,125000,9,"Slovenia"],
  [122,"Rasmus Højlund","MUN",MUN,"ST",23,80,86,45000000,95000,11,"Denmark"],
  [123,"Alejandro Garnacho","MUN",MUN,"LW",22,82,88,58000000,90000,17,"Argentina"]
];

const FALLBACK_MARKET = [
  [201,"Bukayo Saka","ARS","Arsenal","RW",24,89,91,145000000,220000,7,"England"],
  [202,"William Saliba","ARS","Arsenal","CB",25,88,90,115000000,190000,2,"France"],
  [203,"Martin Ødegaard","ARS","Arsenal","CAM",27,88,88,105000000,240000,8,"Norway"],
  [204,"Declan Rice","ARS","Arsenal","CDM",27,88,89,110000000,250000,41,"England"],
  [205,"Erling Haaland","MCI","Manchester City","ST",26,92,94,210000000,420000,9,"Norway"],
  [206,"Phil Foden","MCI","Manchester City","CAM",26,89,91,145000000,300000,47,"England"],
  [207,"Rodri","MCI","Manchester City","CDM",30,91,91,130000000,350000,16,"Spain"],
  [208,"Joško Gvardiol","MCI","Manchester City","CB",24,87,90,98000000,210000,24,"Croatia"],
  [209,"Cole Palmer","CHE","Chelsea","CAM",24,89,93,150000000,180000,20,"England"],
  [210,"Moisés Caicedo","CHE","Chelsea","CDM",24,86,89,90000000,160000,25,"Ecuador"],
  [211,"Levi Colwill","CHE","Chelsea","CB",23,82,87,52000000,110000,6,"England"],
  [212,"Enzo Fernández","CHE","Chelsea","CM",25,86,89,92000000,180000,8,"Argentina"],
  [213,"Alexander Isak","NEW","Newcastle","ST",26,88,89,125000000,180000,14,"Sweden"],
  [214,"Anthony Gordon","NEW","Newcastle","LW",25,84,87,70000000,120000,10,"England"],
  [215,"Bruno Guimarães","NEW","Newcastle","CM",28,86,87,85000000,180000,39,"Brazil"],
  [216,"Sandro Tonali","NEW","Newcastle","CM",26,85,87,76000000,160000,8,"Italy"],
  [217,"Mohamed Salah","LIV","Liverpool","RW",34,89,89,68000000,350000,11,"Egypt"],
  [218,"Virgil van Dijk","LIV","Liverpool","CB",35,88,88,35000000,280000,4,"Netherlands"],
  [219,"Alexis Mac Allister","LIV","Liverpool","CM",27,86,87,80000000,180000,10,"Argentina"],
  [220,"Dominik Szoboszlai","LIV","Liverpool","CAM",25,85,88,76000000,165000,8,"Hungary"],
  [221,"Cristian Romero","TOT","Tottenham","CB",28,86,86,65000000,180000,17,"Argentina"],
  [222,"James Maddison","TOT","Tottenham","CAM",29,84,84,48000000,180000,10,"England"],
  [223,"Micky van de Ven","TOT","Tottenham","CB",25,84,88,72000000,130000,37,"Netherlands"],
  [224,"Morgan Rogers","AVL","Aston Villa","CAM",24,84,89,76000000,110000,27,"England"],
  [225,"Ollie Watkins","AVL","Aston Villa","ST",30,85,85,60000000,160000,11,"England"],
  [226,"Youri Tielemans","AVL","Aston Villa","CM",29,84,84,50000000,150000,8,"Belgium"],
  [227,"João Pedro","BHA","Brighton","CF",24,83,88,68000000,90000,9,"Brazil"],
  [228,"Carlos Baleba","BHA","Brighton","CDM",22,81,88,55000000,75000,20,"Cameroon"],
  [229,"Eberechi Eze","CRY","Crystal Palace","CAM",28,84,84,56000000,130000,10,"England"],
  [230,"Marc Guéhi","CRY","Crystal Palace","CB",26,84,86,62000000,120000,6,"England"],
  [231,"Antoine Semenyo","BOU","Bournemouth","LW",26,82,85,48000000,85000,24,"Ghana"],
  [232,"Jarrad Branthwaite","EVE","Everton","CB",24,83,88,65000000,90000,32,"England"],
  [233,"Murillo","NFO","Nottingham Forest","CB",24,83,87,60000000,85000,5,"Brazil"],
  [234,"Morgan Gibbs-White","NFO","Nottingham Forest","CAM",26,83,85,52000000,100000,10,"England"],
  [235,"Milos Kerkez","BOU","Bournemouth","LB",22,82,88,58000000,80000,3,"Hungary"],
  [236,"Bryan Mbeumo","BRE","Brentford","RW",26,84,85,62000000,120000,19,"Cameroon"]
];

const TEAM_BUDGETS = {
  ARS: 180000000, MCI: 220000000, CHE: 190000000, MUN: 180000000,
  LIV: 165000000, NEW: 150000000, TOT: 135000000, AVL: 105000000,
  BHA: 85000000, BOU: 70000000, FUL: 65000000, CRY: 70000000,
  BRE: 65000000, WHU: 75000000, EVE: 60000000, NFO: 70000000,
  WOL: 55000000, LEE: 50000000, BUR: 45000000, SUN: 45000000
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function generatedMetrics(player) {
  const seed = hash(`${player.name}|${player.teamName}|${player.position}`);
  const age = Number(player.age) || 24;
  const ageCurve = age <= 22 ? 3 : age <= 27 ? 5 : age <= 31 ? 2 : -2;
  const base = 67 + (seed % 16) + ageCurve;
  const rating = clamp(base, 67, 88);
  const potential = clamp(rating + (age <= 21 ? 7 : age <= 24 ? 4 : 1), rating, 92);
  const ageFactor = age <= 23 ? 1.35 : age <= 27 ? 1.1 : age <= 30 ? .84 : .55;
  const value = Math.round((Math.pow(rating - 58, 2.15) * 90000 * ageFactor) / 500000) * 500000;
  const wage = Math.round((rating * rating * 18 + (seed % 18000)) / 5000) * 5000;
  return { rating, potential, value: Math.max(1000000, value), wage: Math.max(10000, wage) };
}

function fromTuple(tuple) {
  const [id,name,teamCode,teamName,position,age,rating,potential,value,wage,number,nationality,photo] = tuple;
  return { id:String(id),name,teamCode,teamName,position,age,rating,potential,value,wage,number,nationality,photo:photo||null };
}

function fromApi(player) {
  const metrics = generatedMetrics(player);
  return {
    id: String(player.id),
    name: player.name,
    teamCode: player.teamCode || String(player.teamId || "CLB"),
    teamName: player.teamName || "Premier League",
    position: normalizePosition(player.position),
    age: player.age || 24,
    rating: metrics.rating,
    potential: metrics.potential,
    value: metrics.value,
    wage: metrics.wage,
    number: player.number,
    nationality: player.nationality || "—",
    photo: player.photo || null,
    teamLogo: player.teamLogo || null,
    live: true
  };
}

export function normalizePosition(value) {
  const position = String(value || "").toUpperCase();
  if (position.includes("GOAL")) return "GK";
  if (position.includes("DEFENDER")) return "CB";
  if (position.includes("MIDFIELDER")) return "CM";
  if (position.includes("ATTACK")) return "ST";
  return position || "CM";
}

const fallback = [...FALLBACK_SQUAD, ...FALLBACK_MARKET].map(fromTuple);
const apiPlayers = PREMIER_LEAGUE_PLAYERS.map(fromApi);
const apiByName = new Map(apiPlayers.map(player => [player.name.toLowerCase(), player]));

export const CAREER_PLAYERS = Object.freeze([
  ...fallback.map(player => ({ ...player, ...(apiByName.get(player.name.toLowerCase()) || {}) })),
  ...apiPlayers.filter(player => !fallback.some(item => item.name.toLowerCase() === player.name.toLowerCase()))
]);

export const USER_SQUAD = Object.freeze(CAREER_PLAYERS.filter(player => player.teamCode === "MUN" || player.teamName === MUN));
export const TRANSFER_MARKET = Object.freeze(CAREER_PLAYERS.filter(player => player.teamCode !== "MUN" && player.teamName !== MUN));

export const CAREER_META = Object.freeze({
  source: PLAYER_FACE_META,
  liveCatalog: apiPlayers.length > 0,
  transferBudget: TEAM_BUDGETS.MUN,
  wageBudget: 3900000,
  teamBudgets: TEAM_BUDGETS
});

export const FORMATIONS = Object.freeze({
  "4-2-3-1": [
    ["GK",50,91],["LB",14,72],["LCB",38,78],["RCB",62,78],["RB",86,72],
    ["LDM",39,57],["RDM",61,57],["LAM",24,35],["CAM",50,30],["RAM",76,35],["ST",50,13]
  ],
  "4-3-3": [
    ["GK",50,91],["LB",14,72],["LCB",38,78],["RCB",62,78],["RB",86,72],
    ["LCM",31,52],["CDM",50,60],["RCM",69,52],["LW",20,25],["ST",50,15],["RW",80,25]
  ],
  "3-4-2-1": [
    ["GK",50,91],["LCB",27,75],["CB",50,79],["RCB",73,75],
    ["LWB",14,53],["LCM",40,55],["RCM",60,55],["RWB",86,53],
    ["LAM",34,31],["RAM",66,31],["ST",50,13]
  ]
});

export const DEFAULT_XI = Object.freeze([
  "André Onana","Diogo Dalot","Leny Yoro","Matthijs de Ligt","Patrick Dorgu",
  "Manuel Ugarte","Kobbie Mainoo","Bryan Mbeumo","Bruno Fernandes","Matheus Cunha","Benjamin Šeško"
]);

export const SCOUTS = Object.freeze([
  { id:"s1",name:"Rui Faria",experience:5,judgement:4,region:"Portugal & Spain",status:"available" },
  { id:"s2",name:"Michael Edwards",experience:5,judgement:5,region:"England",status:"active" },
  { id:"s3",name:"Jean-Paul Laurent",experience:4,judgement:5,region:"France & Belgium",status:"available" },
  { id:"s4",name:"Matteo Ricci",experience:4,judgement:4,region:"Italy",status:"available" }
]);

export const CAREER_MAIL = Object.freeze([
  { id:"m1",sender:"Kobbie Mainoo",role:"Jogador · Meio-campista",subject:"Quero uma oportunidade na equipe principal",preview:"Mister, sinto que estou pronto para assumir mais minutos.",time:"18:04",category:"Elenco",body:["Mister,","Tenho trabalhado forte nos treinos e sinto que estou pronto para ajudar mais a equipe.","Respeito a concorrência, mas gostaria de receber uma oportunidade na próxima sequência de jogos."],action:"Conversar com jogador" },
  { id:"m2",sender:"Dra. Helena Costa",role:"Preparação física",subject:"Três jogadores não estão aptos para iniciar",preview:"Shaw, Mount e Ugarte exigem controle de carga.",time:"16:18",category:"Performance",body:["Gabriel,","Luke Shaw e Mason Mount não atingiram os critérios para iniciar. Ugarte pode atuar por aproximadamente 55 minutos.","Recomendo ajustar a escalação e preparar substituições preventivas."],action:"Abrir táticas" },
  { id:"m3",sender:"Jason McCarthy",role:"Assistente técnico",subject:"O espaço que podemos atacar em Stamford Bridge",preview:"O Chelsea deixa um corredor vulnerável quando o lateral avança.",time:"Ontem",category:"Análise",body:["Gabriel,","Identificamos espaço nas costas do lateral direito. Cunha pode receber por dentro e liberar Dorgu no corredor.","Também recomendo orientar nossa pressão para o lado esquerdo deles."],action:"Abrir análise" },
  { id:"m4",sender:"Omar Berrada",role:"Diretoria executiva",subject:"Expectativas para a sequência da temporada",preview:"A classificação para a Champions League continua sendo a prioridade.",time:"Terça",category:"Diretoria",body:["Gabriel,","A direção reconhece a evolução recente da equipe.","A expectativa principal continua sendo a classificação para a Champions League, com responsabilidade esportiva e financeira."],action:"Confirmar leitura" }
]);

export function formatMoney(value, compact = false) {
  const amount = Number(value) || 0;
  if (compact) {
    if (amount >= 1000000000) return `€${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `€${(amount / 1000000).toFixed(amount >= 100000000 ? 0 : 1)}M`;
    if (amount >= 1000) return `€${Math.round(amount / 1000)}K`;
  }
  return new Intl.NumberFormat("pt-BR", { style:"currency",currency:"EUR",maximumFractionDigits:0 }).format(amount);
}

export function playerInitials(name) {
  return String(name || "?").split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
}
