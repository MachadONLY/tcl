import { readFile, writeFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const UA = 'TouchlineOfficialLogoAudit/4.0 (+https://github.com/MachadONLY/tcl)';
const MANIFEST_PATH = 'artifacts/official-club-logo-manifest.generated.json';
const REPORT_PATH = 'artifacts/official-club-logo-audit.json';
const COMMON = new Set(['fc','cf','afc','ac','sc','fk','sk','sv','as','ss','cd','ud','nk','hnk','pfc','club','football','calcio','futbol','stade','rc','tsv','vfl','vfb','spvgg','de','do','da','del','the','1']);
const RESERVE = /(?:\b(?:u|under)[ -]?(?:18|19|20|21|23)\b|\b(?:ii|iii|b|c|reserves?|reserve|academy|akademia|futures|nxt|jong)\b)/i;
const COUNTRY_NAMES = {
  ENG:['England','United Kingdom'],FRA:['France'],GER:['Germany'],ESP:['Spain'],ITA:['Italy'],POR:['Portugal'],NED:['Netherlands'],BEL:['Belgium'],SCO:['Scotland','United Kingdom'],AUT:['Austria'],SUI:['Switzerland','Liechtenstein'],TUR:['Turkey','Türkiye'],GRE:['Greece'],DEN:['Denmark'],NOR:['Norway'],SWE:['Sweden'],POL:['Poland'],CZE:['Czech Republic','Czechia'],CRO:['Croatia'],SRB:['Serbia'],UKR:['Ukraine'],ROU:['Romania'],BUL:['Bulgaria'],HUN:['Hungary'],SVK:['Slovakia'],SVN:['Slovenia'],BIH:['Bosnia and Herzegovina'],ALB:['Albania'],MKD:['North Macedonia'],MNE:['Montenegro'],CYP:['Cyprus'],IRL:['Ireland'],NIR:['Northern Ireland','United Kingdom'],WAL:['Wales','United Kingdom'],FIN:['Finland'],ISL:['Iceland'],LVA:['Latvia'],LTU:['Lithuania'],EST:['Estonia'],GEO:['Georgia'],ARM:['Armenia'],AZE:['Azerbaijan'],MDA:['Moldova'],KOS:['Kosovo'],MLT:['Malta'],LUX:['Luxembourg'],FRO:['Faroe Islands'],KAZ:['Kazakhstan'],ISR:['Israel'],AND:['Andorra'],SMR:['San Marino'],GIB:['Gibraltar'],BLR:['Belarus'],RUS:['Russia']
};
const ALIASES = {
  'BEL:OH Leuven':['Oud-Heverlee Leuven'], 'SUI:Vaduz':['FC Vaduz'], 'GRE:AEL Kalloni':['Kalloni FC'],
  'CZE:Líšeň':['SK Líšeň'], 'CRO:Orijent':['HNK Orijent 1919'], 'CRO:Sesvete':['NK Sesvete'],
  'CRO:Dugopolje':['NK Dugopolje'], 'CRO:Jarun':['NK Jarun Zagreb'], 'CRO:Dubrava Zagreb':['NK Dubrava Zagreb'],
  'SRB:Grafičar':['RFK Grafičar Beograd'], 'SRB:Mladost GAT':['FK Mladost GAT Novi Sad'],
  'SRB:Trajal Kruševac':['FK Trajal Kruševac'], 'SRB:Vršac':['OFK Vršac'],
  'UKR:Victoria Sumy':['Viktoriya Sumy'], 'UKR:Dinaz Vyshhorod':['FC Dinaz Vyshhorod'],
  'ROU:CSM Reșița':['CSM Resita'], 'ROU:FCU Craiova':['FC U Craiova 1948'],
  'BUL:Belasitsa Petrich':['OFC Belasitsa Petrich'], 'BUL:Yantra Gabrovo':['FC Yantra Gabrovo'],
  'BUL:Strumska Slava':['FC Strumska Slava Radomir'], 'BUL:Sportist Svoge':['FC Sportist Svoge'],
  'HUN:Soroksár':['Soroksár SC'], 'HUN:Csákvár':['Aqvital FC Csákvár'], 'HUN:Kozármisleny':['Kozármisleny SE'],
  'HUN:BVSC-Zugló':['Budapesti VSC'], 'HUN:Tatabánya':['FC Tatabánya'],
  'SVK:Petržalka':['FC Petržalka'], 'SVK:Liptovský Mikuláš':['MFK Tatran Liptovský Mikuláš'],
  'SVK:Humenné':['FK Humenné'], 'SVK:Šamorín':['FC ŠTK 1914 Šamorín'],
  'SVK:Považská Bystrica':['MŠK Považská Bystrica'], 'SVK:Zvolen':['MFK Zvolen'],
  'SVK:Stará Ľubovňa':['Redfox FC Stará Ľubovňa'],
  'SVN:Triglav Kranj':['NK Triglav Kranj'], 'SVN:Beltinci':['ND Beltinci'], 'SVN:Krka':['NK Krka'],
  'SVN:Dravinja':['ND Dravinja'], 'SVN:Bilje':['ND Bilje'], 'SVN:Ilirija 1911':['ND Ilirija 1911'],
  'BIH:Sloboda Tuzla':['FK Sloboda Tuzla'], 'BIH:Stupčanica Olovo':['NK Stupčanica Olovo'],
  'BIH:Travnik':['NK Travnik'], 'BIH:Jedinstvo Bihać':['NK Jedinstvo Bihać'],
  'BIH:Gradina Srebrenik':['OFK Gradina Srebrenik'], 'BIH:Laktaši':['FK Laktaši'],
  'ALB:Elbasani':['AF Elbasani'], 'ALB:Korabi Peshkopi':['KF Korabi Peshkopi'], 'ALB:Burreli':['KS Burreli'],
  'MKD:Gostivar':['KF Gostivari'], 'MKD:Besa Dobërdoll':['KF Besa Dobërdoll'],
  'MKD:Bregalnica Štip':['FK Bregalnica Štip'], 'MKD:Detonit Plachkovica':['FK Detonit Plachkovica'],
  'MKD:Kozhuf':['FK Kozhuf Gevgelija'], 'MKD:Ohrid':['FK Ohrid'], 'MKD:Sasa':['FK Kamenica Sasa'],
  'MKD:Skopje':['FK Skopje'], 'MKD:Novaci':['FK Novaci'],
  'MNE:Jedinstvo Bijelo Polje':['FK Jedinstvo Bijelo Polje'], 'MNE:Otrant-Olympic':['FK Otrant-Olympic'],
  'MNE:Lovćen':['FK Lovćen'], 'MNE:Grbalj':['OFK Grbalj'], 'MNE:Igalo':['FK Igalo 1929'],
  'CYP:ASIL Lysi':['ASIL Lysi FC'], 'CYP:Digenis Morphou':['Digenis Akritas Morphou'],
  'CYP:Peyia 2014':['Peyia 2014 FC'], 'CYP:PAEEK':['PAEEK FC'], 'CYP:MEAP Nisou':['MEAP Nisou FC'],
  'CYP:Spartakos Kitiou':['Spartakos Kitiou FC'], 'CYP:Halkanoras Idaliou':['Halkanoras Idaliou FC'],
  'NIR:Loughgall':['Loughgall FC'], 'NIR:Annagh United':['Annagh United FC'], 'NIR:Dundela':['Dundela FC'],
  'NIR:H&W Welders':['Harland & Wolff Welders FC'], 'NIR:Ballinamallard United':['Ballinamallard United FC'],
  'NIR:Newington':['Newington FC'], 'NIR:Armagh City':['Armagh City FC'], 'NIR:Ballyclare Comrades':['Ballyclare Comrades FC'],
  'FIN:JIPPO':['JIPPO Joensuu'], 'FIN:SalPa':['Salon Palloilijat'], 'FIN:EIF':['Ekenäs IF'],
  'FIN:PK-35':['PK-35 Vantaa'], 'FIN:JäPS':['Järvenpään Palloseura'], 'FIN:KäPa':['Käpylän Pallo'],
  'FIN:SJK Akatemia':['SJK Academy'], 'FIN:Klubi 04':['HJK Klubi 04'],
  'ISL:Njarðvík':['UMF Njarðvík'], 'ISL:Dalvík/Reynir':['Dalvík Reynir'], 'ISL:Selfoss':['UMF Selfoss'],
  'LVA:JDFS Alberts':['JDFS Alberts Riga'], 'LVA:Skanste':['Skanstes SK'], 'LVA:Leevon PPK':['Leevon PPK Riga'],
  'LVA:Smiltene':['FK Smiltene BJSS'], 'LVA:Mārupe':['Mārupes SC'],
  'LTU:Be1 NFA':['Be1 National Football Academy'], 'LTU:Neptūnas':['FC Neptūnas Klaipėda'],
  'LTU:Babrungas':['FK Babrungas'], 'LTU:Minija':['FK Minija Kretinga'], 'LTU:Atmosfera':['FK Atmosfera'],
  'LTU:Garliava':['FK Garliava'], 'LTU:Žalgiris B':['FK Žalgiris B'],
  'EST:Viimsi':['Viimsi JK'], 'EST:Elva':['FC Elva'], 'EST:Tabasalu':['JK Tabasalu'],
  'EST:Tallinna Legion':['Tallinna JK Legion'], 'EST:Flora U21':['FC Flora U21'], 'EST:Tartu Welco':['Tartu JK Welco'],
  'GEO:Gareji':['FC Gareji Sagarejo'], 'GEO:Aragvi Dusheti':['FC Aragvi Dusheti'], 'GEO:Gonio':['FC Gonio'],
  'ARM:West Armenia':['FC West Armenia'], 'ARM:Lernayin Artsakh':['Lernayin Artsakh FC'],
  'ARM:BKMA II':['BKMA Yerevan II'], 'ARM:Andranik':['FC Andranik'], 'ARM:Mika':['Mika FC'],
  'AZE:Sumgayit':['Sumqayıt FK'], 'AZE:MOIK Baku':['MOIK Baku FK'], 'AZE:Mingachevir':['Mingəçevir FK'],
  'AZE:Difai Ağsu':['Difai Ağsu FK'], 'AZE:Baku Sporting':['Baku Sporting FK'], 'AZE:Jabrayil':['Cəbrayıl FK'],
  'AZE:Zaqatala':['Zaqatala PFK'], 'AZE:Imishli':['İmişli FK'], 'AZE:Energetik Mingachevir':['Energetik Mingəçevir FK'],
  'MDA:Spartanii Sportul':['FC Spartanii Sportul'], 'MDA:Bălți':['FC Bălți'],
  'MDA:Victoria Chișinău':['FC Victoria Chișinău'], 'MDA:Fălești':['FC Fălești'],
  'MDA:Iskra Rîbnița':['FC Iskra Rîbnița'], 'MDA:Ungheni':['FC Ungheni'],
  'MDA:Real Succes':['FC Real Succes'], 'MDA:Speranis Nisporeni':['FC Speranis Nisporeni'], 'MDA:Olimp Comrat':['FC Olimp Comrat'],
  'KOS:Malisheva':['FC Malisheva'], 'KOS:Suhareka':['FC Suhareka'], 'KOS:Besa Pejë':['KF Besa Pejë'],
  'KOS:Ramiz Sadiku':['KF Ramiz Sadiku'], 'KOS:Rilindja 1974':['KF Rilindja 1974'], 'KOS:2 Korriku':['KF 2 Korriku'],
  'MLT:Naxxar Lions':['Naxxar Lions FC'], 'MLT:Żabbar St. Patrick':['Żabbar St. Patrick FC'],
  'MLT:Sirens':['Sirens FC'], 'MLT:Swieqi United':['Swieqi United FC'], 'MLT:Zurrieq':['Żurrieq FC'], 'MLT:Fgura United':['Fgura United FC'],
  'LUX:Mondorf-les-Bains':['US Mondorf-les-Bains'], 'LUX:Wiltz 71':['FC Wiltz 71'], 'LUX:Rodange 91':['FC Rodange 91'],
  'LUX:Bettembourg':['Sporting Club Bettembourg'], 'LUX:Berdenia Berbourg':['Berdenia Berbourg'],
  'LUX:Mamer 32':['FC Mamer 32'], 'LUX:Canach':['FC Jeunesse Canach'], 'LUX:Koeppchen Wormeldange':['Koeppchen Wormeldange'],
  'LUX:Marisca Mersch':['FC Marisca Mersch'], 'LUX:Schifflange 95':['FC Schifflange 95'], 'LUX:Alisontia Steinsel':['FC Alisontia Steinsel'],
  'FRO:FC Hoyvík':['FC Hoyvík'], 'FRO:KÍ II':['KÍ Klaksvík II'], 'FRO:B36 II':['B36 Tórshavn II'],
  'KAZ:Ekibastuz':['FC Ekibastuz'], 'KAZ:Akademiya Ontustik':['Akademiya Ontustik'],
  'KAZ:Khan Tengri':['Khan Tengri FC'], 'KAZ:Altai':['Altay Semey'], 'KAZ:Arys':['FC Arys'],
  'KAZ:Akzhayik':['FC Akzhayik'], 'KAZ:SD Family':['SD Family FC'], 'KAZ:Jas Qyran':['Jas Qyran FC'], 'KAZ:Zhetisay':['FC Zhetisay'],
  'ISR:Hapoel Acre':['Hapoel Acre FC'], 'ISR:Maccabi Herzliya':['Maccabi Herzliya FC'],
  'ISR:Hapoel Nof HaGalil':['Hapoel Nof HaGalil FC'], 'ISR:Kafr Qasim':['MS Kafr Qasim'],
  'AND:Pas de la Casa':['FC Pas de la Casa'], 'AND:Esperança d’Andorra':['CF Esperança d’Andorra'],
  'AND:La Massana':['FS La Massana'], 'AND:Encamp':['FC Encamp'], 'AND:Atlètic Amèrica':['CF Atlètic Amèrica'],
  'SMR:Domagnano':['FC Domagnano'], 'SMR:Academy San Marino':['San Marino Academy'],
  'BLR:Molodechno':['FC Molodechno'], 'BLR:Belshina Bobruisk':['FC Belshina Bobruisk'],
  'BLR:Orsha':['FC Orsha'], 'BLR:Volna Pinsk':['FC Volna Pinsk'], 'BLR:Bumprom':['FC Bumprom'],
  'BLR:Ostrovets':['FC Ostrovets'], 'BLR:Niva Dolbizno':['FC Niva Dolbizno'], 'BLR:ABFF U19':['ABFF U19'], 'BLR:BATE II':['BATE Borisov II'],
  'RUS:Pari Nizhny Novgorod':['FC Pari Nizhny Novgorod'], 'RUS:Sokol Saratov':['FC Sokol Saratov'],
  'RUS:Tyumen':['FC Tyumen'], 'RUS:Alania Vladikavkaz':['FC Alania Vladikavkaz']
};

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/&/g, ' and ').replace(/[’'`´]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function words(value, stripCommon = false) { return normalize(value).split(' ').filter(Boolean).filter(token => !stripCommon || !COMMON.has(token)); }
function parentName(value) { return words(String(value).replace(RESERVE, ' '), true).join(' '); }
function levenshtein(a, b) {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}
function similarity(leftValue, rightValue) {
  const left = normalize(leftValue); const right = normalize(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const a = words(left, true).join(' '); const b = words(right, true).join(' ');
  if (a && a === b) return 99;
  const aTokens = new Set(words(a)); const bTokens = new Set(words(b));
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  const edit = 1 - levenshtein(a, b) / (Math.max(a.length, b.length) || 1);
  const contains = Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a));
  return Math.round((intersection / union * 0.6 + edit * 0.4) * 100 + (contains ? 8 : 0));
}
function aliasesFor(club) {
  const aliases = [club.name, club.shortName, ...(ALIASES[`${club.countryCode}:${club.name}`] || [])].filter(Boolean);
  if (RESERVE.test(club.name)) aliases.push(parentName(club.name));
  return [...new Set(aliases)];
}
function countryMatches(club, country) {
  if (!country) return true;
  const normalized = normalize(country);
  return (COUNTRY_NAMES[club.countryCode] || []).some(name => normalized.includes(normalize(name)) || normalize(name).includes(normalized));
}
async function fetchJson(url, timeout = 18_000) {
  const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json,text/plain,*/*' }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function fetchText(url, timeout = 18_000) {
  const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { html: await response.text(), url: response.url };
}
async function concurrent(items, concurrency, worker) {
  const results = new Array(items.length); let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = await worker(items[index]); } catch (error) { results[index] = { error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
function bestScore(club, name) { return Math.max(...aliasesFor(club).map(alias => similarity(alias, name))); }

async function sofascore(club) {
  let best = null;
  for (const query of aliasesFor(club).slice(0, 6)) {
    try {
      const data = await fetchJson(`https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(query)}&page=0`);
      for (const result of data.results || []) {
        const entity = result.entity || {};
        if (result.type !== 'team' || (entity.sport?.id !== 1 && entity.sport?.slug !== 'football') || entity.national) continue;
        let score = bestScore(club, entity.name || entity.shortName || entity.slug);
        if (countryMatches(club, entity.country?.name)) score += 12;
        else if (entity.country?.name) score -= 24;
        if (!best || score > best.score) best = { entity, score };
      }
    } catch {}
  }
  if (!best || best.score < 82 || !best.entity.id) return null;
  return {
    name: best.entity.name, logoUrl: `https://img.sofascore.com/api/v1/team/${best.entity.id}/image`,
    sourcePage: `https://www.sofascore.com/team/football/${best.entity.slug || normalize(best.entity.name).replace(/ /g, '-')}/${best.entity.id}`,
    provider: 'Sofascore', providerId: String(best.entity.id), score: Math.min(100, best.score)
  };
}

async function wikidata(club) {
  let best = null;
  for (const query of aliasesFor(club).slice(0, 5)) {
    try {
      const data = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&language=en&uselang=en&type=item&limit=10&search=${encodeURIComponent(query)}`);
      for (const candidate of data.search || []) {
        const combined = `${candidate.label || ''} ${candidate.aliases?.join(' ') || ''}`;
        let score = bestScore(club, combined);
        if (/football|soccer|club|team/i.test(candidate.description || '')) score += 10;
        if (!best || score > best.score) best = { candidate, score };
      }
    } catch {}
  }
  if (!best || best.score < 78 || !best.candidate.id) return null;
  try {
    const entityData = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${best.candidate.id}.json`);
    const entity = entityData.entities?.[best.candidate.id];
    const fileName = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    if (!fileName) return null;
    const commons = await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url&iiurlwidth=256`);
    const page = Object.values(commons.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    const logoUrl = info?.thumburl || info?.url;
    if (!logoUrl) return null;
    return { name: best.candidate.label, logoUrl, sourcePage: best.candidate.concepturi, provider: 'Wikidata/Commons', providerId: best.candidate.id, score: Math.min(100, best.score) };
  } catch { return null; }
}

async function commonsSearch(club) {
  for (const query of aliasesFor(club).slice(0, 5)) {
    try {
      const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${query} logo`)}&prop=imageinfo&iiprop=url&iiurlwidth=256`);
      let best = null;
      for (const page of Object.values(data.query?.pages || {})) {
        const title = String(page.title || '').replace(/^File:/i, '').replace(/\.(svg|png|webp|jpe?g)$/i, '').replace(/logo|crest|badge|emblem/gi, ' ');
        let score = bestScore(club, title);
        if (/logo|crest|badge|emblem/i.test(page.title || '')) score += 8;
        const info = page.imageinfo?.[0]; const logoUrl = info?.thumburl || info?.url;
        if (logoUrl && (!best || score > best.score)) best = { title, logoUrl, pageId: page.pageid, score };
      }
      if (best?.score >= 78) return { name: best.title, logoUrl: best.logoUrl, sourcePage: `https://commons.wikimedia.org/?curid=${best.pageId}`, provider: 'Wikimedia Commons', providerId: String(best.pageId), score: Math.min(100, best.score) };
    } catch {}
  }
  return null;
}

async function transfermarkt(club) {
  for (const query of aliasesFor(club).slice(0, 5)) {
    try {
      const { html } = await fetchText(`https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`);
      const candidates = [];
      for (const match of html.matchAll(/href="([^"]*\/startseite\/verein\/(\d+)[^"]*)"[^>]*>(?:<[^>]+>)*\s*([^<]{2,80})/gi)) {
        candidates.push({ href: match[1], id: match[2], name: match[3].trim() });
      }
      const best = candidates.map(candidate => ({ ...candidate, score: bestScore(club, candidate.name) })).sort((a, b) => b.score - a.score)[0];
      if (best?.score >= 82) return {
        name: best.name, logoUrl: `https://tmssl.akamaized.net/images/wappen/head/${best.id}.png`,
        sourcePage: `https://www.transfermarkt.com${best.href}`, provider: 'Transfermarkt', providerId: best.id, score: best.score
      };
    } catch {}
  }
  return null;
}

function parentManifestEntry(club, manifest, catalogById) {
  if (!RESERVE.test(club.name)) return null;
  const base = parentName(club.name);
  let best = null;
  for (const [id, entry] of Object.entries(manifest)) {
    const other = catalogById.get(id);
    if (!other || other.countryCode !== club.countryCode || RESERVE.test(other.name)) continue;
    const score = Math.max(similarity(base, other.name), similarity(base, entry.sourceName || entry.name));
    if (!best || score > best.score) best = { entry, score, other };
  }
  if (!best || best.score < 80) return null;
  return { ...best.entry, name: club.name, sourceName: `${best.other.name} (shared reserve crest)`, provider: best.entry.provider || 'shared-parent-crest', confidence: 'shared-reserve-crest', score: best.score };
}

async function imageWorks(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
    const type = response.headers.get('content-type') || '';
    return response.ok && (type.startsWith('image/') || /\.(svg|png|webp|jpe?g)(?:\?|$)/i.test(response.url));
  } catch { return false; }
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const priorReport = JSON.parse(await readFile(REPORT_PATH, 'utf8'));
const catalogById = new Map(EUROPEAN_CLUBS.map(club => [club.id, club]));

function unresolved() { return EUROPEAN_CLUBS.filter(club => !manifest[club.id]); }
function store(club, result, confidence) {
  if (!result?.logoUrl) return;
  manifest[club.id] = {
    name: club.name, countryCode: club.countryCode, sourceName: result.name || club.name,
    sourcePage: result.sourcePage || '', logoUrl: result.logoUrl, provider: result.provider,
    providerId: result.providerId || '', confidence, score: result.score || 0
  };
}

for (const club of unresolved()) {
  const parent = parentManifestEntry(club, manifest, catalogById);
  if (parent) manifest[club.id] = parent;
}
console.log(`shared parent crest: ${Object.keys(manifest).length}/${EUROPEAN_CLUBS.length}`);

for (const [label, provider, concurrency] of [
  ['Sofascore', sofascore, 4], ['Wikidata', wikidata, 4], ['Commons', commonsSearch, 4], ['Transfermarkt', transfermarkt, 3]
]) {
  const clubs = unresolved();
  const results = await concurrent(clubs, concurrency, provider);
  for (let index = 0; index < clubs.length; index += 1) {
    const result = results[index];
    if (!result?.logoUrl || result.error) continue;
    if (await imageWorks(result.logoUrl)) store(clubs[index], result, label.toLowerCase());
  }
  console.log(`${label}: ${Object.keys(manifest).length}/${EUROPEAN_CLUBS.length}`);
}

const remaining = unresolved().map(club => ({ id: club.id, name: club.name, countryCode: club.countryCode, league: club.league, division: club.division, aliases: aliasesFor(club) }));
const providerCounts = {};
for (const entry of Object.values(manifest)) providerCounts[entry.provider || 'football-logos.cc'] = (providerCounts[entry.provider || 'football-logos.cc'] || 0) + 1;
const report = {
  ...priorReport, schemaVersion: 4, generatedAt: new Date().toISOString(), catalogClubs: EUROPEAN_CLUBS.length,
  matched: Object.keys(manifest).length, unresolvedCount: remaining.length,
  coverage: Number((Object.keys(manifest).length / EUROPEAN_CLUBS.length * 100).toFixed(2)),
  providerCounts, unresolved: remaining
};

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
await writeFile('artifacts/official-club-logo-manifest.generated.js', `export const OFFICIAL_CLUB_LOGO_MANIFEST = Object.freeze(${JSON.stringify(manifest, null, 2)});\n`);
console.log(JSON.stringify({ catalog: EUROPEAN_CLUBS.length, matched: report.matched, unresolved: report.unresolvedCount, coverage: `${report.coverage}%`, providerCounts, remaining }, null, 2));
if (process.argv.includes('--require-complete') && remaining.length) process.exitCode = 1;
