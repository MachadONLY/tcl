import { readFile, writeFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const MANIFEST_PATH = 'artifacts/official-club-logo-manifest.generated.json';
const REPORT_PATH = 'artifacts/official-club-logo-audit.json';
const UA = 'TouchlineFinalClubLogoResolver/2.0 (+https://github.com/MachadONLY/tcl)';
const COUNTRY_SLUGS = {ENG:'england',FRA:'france',GER:'germany',ESP:'spain',ITA:'italy',POR:'portugal',NED:'netherlands',BEL:'belgium',SCO:'scotland',AUT:'austria',SUI:'switzerland',TUR:'turkey',GRE:'greece',DEN:'denmark',NOR:'norway',SWE:'sweden',POL:'poland',CZE:'czech-republic',CRO:'croatia',SRB:'serbia',UKR:'ukraine',ROU:'romania',BUL:'bulgaria',HUN:'hungary',SVK:'slovakia',SVN:'slovenia',BIH:'bosnia-and-herzegovina',ALB:'albania',MKD:'north-macedonia',MNE:'montenegro',CYP:'cyprus',IRL:'republic-of-ireland',NIR:'northern-ireland',WAL:'wales',FIN:'finland',ISL:'iceland',LVA:'latvia',LTU:'lithuania',EST:'estonia',GEO:'georgia',ARM:'armenia',AZE:'azerbaijan',MDA:'moldova',KOS:'kosovo',MLT:'malta',LUX:'luxembourg',FRO:'faroe-islands',KAZ:'kazakhstan',ISR:'israel',AND:'andorra',SMR:'san-marino',GIB:'gibraltar',BLR:'belarus',RUS:'russia'};
const COUNTRY_NAMES = {ENG:'England',FRA:'France',GER:'Germany',ESP:'Spain',ITA:'Italy',POR:'Portugal',NED:'Netherlands',BEL:'Belgium',SCO:'Scotland',AUT:'Austria',SUI:'Switzerland',TUR:'Turkey',GRE:'Greece',DEN:'Denmark',NOR:'Norway',SWE:'Sweden',POL:'Poland',CZE:'Czech Republic',CRO:'Croatia',SRB:'Serbia',UKR:'Ukraine',ROU:'Romania',BUL:'Bulgaria',HUN:'Hungary',SVK:'Slovakia',SVN:'Slovenia',BIH:'Bosnia and Herzegovina',ALB:'Albania',MKD:'North Macedonia',MNE:'Montenegro',CYP:'Cyprus',IRL:'Ireland',NIR:'Northern Ireland',WAL:'Wales',FIN:'Finland',ISL:'Iceland',LVA:'Latvia',LTU:'Lithuania',EST:'Estonia',GEO:'Georgia',ARM:'Armenia',AZE:'Azerbaijan',MDA:'Moldova',KOS:'Kosovo',MLT:'Malta',LUX:'Luxembourg',FRO:'Faroe Islands',KAZ:'Kazakhstan',ISR:'Israel',AND:'Andorra',SMR:'San Marino',GIB:'Gibraltar',BLR:'Belarus',RUS:'Russia'};
const COMMON = new Set(['fc','cf','afc','ac','sc','fk','sk','sv','as','ss','cd','ud','nk','hnk','pfc','club','football','calcio','futbol','stade','rc','tsv','vfl','vfb','spvgg','de','do','da','del','the','1']);
const RESERVE = /(?:\b(?:u|under)[ -]?(?:18|19|20|21|23)\b|\b(?:ii|iii|b|c|reserves?|reserve|academy|akademia|nxt|jong|futures)\b)/i;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g,'ss').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ð/g,'d').replace(/þ/g,'th')
    .replace(/&/g,' and ').replace(/[’'`´]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function tokens(value, stripCommon = false) { return normalize(value).split(' ').filter(Boolean).filter(token => !stripCommon || !COMMON.has(token)); }
function stripped(value) { return tokens(value, true).join(' '); }
function parentName(value) { return stripped(String(value || '').replace(RESERVE, ' ')); }
function levenshtein(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  const prev = Array.from({length:b.length+1},(_,i)=>i), cur = new Array(b.length+1);
  for (let i=1;i<=a.length;i++) { cur[0]=i; for (let j=1;j<=b.length;j++) cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); for (let j=0;j<=b.length;j++) prev[j]=cur[j]; }
  return prev[b.length];
}
function similarity(a,b) {
  const left=normalize(a), right=normalize(b); if(!left||!right)return 0; if(left===right)return 100;
  const ls=stripped(left), rs=stripped(right); if(ls&&ls===rs)return 99;
  const lp=parentName(left), rp=parentName(right); if(lp&&lp===rp)return RESERVE.test(left)===RESERVE.test(right)?97:90;
  const lt=new Set(tokens(ls)), rt=new Set(tokens(rs)), inter=[...lt].filter(x=>rt.has(x)).length, union=new Set([...lt,...rt]).size||1;
  const edit=1-levenshtein(ls,rs)/(Math.max(ls.length,rs.length)||1), contains=Math.min(ls.length,rs.length)>=4&&(ls.includes(rs)||rs.includes(ls));
  return Math.round((inter/union*.64+edit*.36)*100+(contains?7:0));
}
function decodeHtml(value){return String(value||'').replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
async function fetchWithRetry(url, options = {}, attempts = 2) {
  let last;
  for (let attempt=0; attempt<attempts; attempt++) {
    try {
      const response=await fetch(url,{...options,headers:{'user-agent':UA,accept:'application/json,text/html,image/*,*/*;q=0.8',...(options.headers||{})},signal:AbortSignal.timeout(8000),redirect:'follow'});
      if(response.ok)return response;
      last=new Error(`HTTP ${response.status}`);
      if(response.status!==429&&response.status<500)throw last;
    } catch(error){last=error;}
    await sleep(180*(attempt+1));
  }
  throw last || new Error('fetch failed');
}
async function fetchJson(url, options){return (await fetchWithRetry(url,options)).json();}
async function fetchText(url, options){return (await fetchWithRetry(url,options)).text();}
async function concurrent(items, concurrency, worker) {
  const results=new Array(items.length); let cursor=0;
  async function run(){while(true){const index=cursor++;if(index>=items.length)return;try{results[index]=await worker(items[index],index);}catch(error){results[index]={error:error.message};}}}
  await Promise.all(Array.from({length:Math.min(concurrency,Math.max(1,items.length))},run)); return results;
}
function aliasesFor(club, reportAliases) {
  const values=[club.name,club.shortName,...(reportAliases.get(club.id)||[]),stripped(club.name)].filter(Boolean);
  if(RESERVE.test(club.name))values.push(parentName(club.name));
  return [...new Set(values.filter(Boolean))];
}
function scoreClub(candidateName,aliases){return Math.max(...aliases.map(alias=>similarity(alias,candidateName||'')));}
function unresolved(manifest){return EUROPEAN_CLUBS.filter(club=>!manifest[club.id]?.logoUrl);}
function cloneEntry(entry,club,confidence){return {...entry,name:club.name,countryCode:club.countryCode,confidence};}
function addResult(manifest,club,result){if(!result?.logoUrl)return false;manifest[club.id]={name:club.name,countryCode:club.countryCode,...result};return true;}

function shareKnownIdentity(manifest) {
  const byExact=new Map(), byParent=new Map();
  for(const club of EUROPEAN_CLUBS){const entry=manifest[club.id];if(!entry?.logoUrl)continue;byExact.set(`${club.countryCode}:${normalize(club.name)}`,entry);byParent.set(`${club.countryCode}:${parentName(club.name)}`,entry);}
  let added=0;
  for(const club of unresolved(manifest)){
    const exact=byExact.get(`${club.countryCode}:${normalize(club.name)}`);
    if(exact){manifest[club.id]=cloneEntry(exact,club,'shared-club-identity');added++;continue;}
    if(RESERVE.test(club.name)){const parent=byParent.get(`${club.countryCode}:${parentName(club.name)}`);if(parent){manifest[club.id]=cloneEntry(parent,club,'shared-reserve-crest');added++;}}
  }
  return added;
}

function extractCountryLogos(html) {
  const logos=[];
  for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const root=JSON.parse(decodeHtml(match[1]));
      const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=='object')return;if(value['@type']==='ImageObject'&&(value.contentUrl||value.thumbnailUrl)){logos.push({name:String(value.name||'').replace(/\s+Logo$/i,''),logoUrl:value.thumbnailUrl||value.contentUrl,sourcePage:String(value.mainEntityOfPage?.['@id']||value['@id']||'')});}Object.values(value).forEach(walk);};
      walk(root);
    }catch{}
  }
  return logos.filter(item=>item.name&&item.logoUrl);
}
async function relaxedCountryPass(manifest,reportAliases){
  const countries=[...new Set(unresolved(manifest).map(club=>club.countryCode))].filter(code=>COUNTRY_SLUGS[code]);
  const pages=await concurrent(countries,8,async countryCode=>({countryCode,logos:extractCountryLogos(await fetchText(`https://football-logos.cc/${COUNTRY_SLUGS[countryCode]}/`))}));
  let added=0;
  for(const page of pages){if(!page?.logos?.length)continue;for(const club of unresolved(manifest).filter(item=>item.countryCode===page.countryCode)){
    const aliases=aliasesFor(club,reportAliases), ranked=page.logos.map(item=>({...item,score:scoreClub(item.name,aliases)})).sort((a,b)=>b.score-a.score), best=ranked[0], second=ranked[1];
    if(!best)continue;const strong=best.score>=92||(best.score>=82&&best.score-(second?.score||0)>=7);if(!strong)continue;
    if(addResult(manifest,club,{sourceName:best.name,sourcePage:best.sourcePage||`https://football-logos.cc/${COUNTRY_SLUGS[club.countryCode]}/`,logoUrl:best.logoUrl,provider:'football-logos.cc',confidence:'relaxed-country-match',score:best.score}))added++;
  }}return added;
}

async function resolveFotMob(club,reportAliases){
  const aliases=aliasesFor(club,reportAliases), queries=[...new Set([...aliases.slice(0,3),`${club.name} ${COUNTRY_NAMES[club.countryCode]||club.league||''}`.trim()])], candidates=new Map();
  for(const query of queries){try{const data=await fetchJson(`https://www.fotmob.com/api/searchData?term=${encodeURIComponent(query)}`,{headers:{referer:'https://www.fotmob.com/'}});for(const candidate of data.team||[]){if(!candidate?.id||!candidate?.name)continue;const score=scoreClub(candidate.name,aliases),old=candidates.get(String(candidate.id));if(!old||score>old.score)candidates.set(String(candidate.id),{...candidate,score});}}catch{}}
  const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score),best=ranked[0],second=ranked[1];if(!best||best.score<78||(best.score<90&&second&&best.score-second.score<4))return null;
  const logoUrl=`https://images.fotmob.com/image_resources/logo/teamlogo/${best.id}.png`;try{await fetchWithRetry(logoUrl,{headers:{accept:'image/*,*/*;q=0.8',referer:'https://www.fotmob.com/'}},1);}catch{return null;}
  return {sourceName:best.name,sourcePage:`https://www.fotmob.com/teams/${best.id}/overview/${normalize(best.name).replace(/ /g,'-')}`,logoUrl,provider:'FotMob',providerId:String(best.id),confidence:'fotmob-resilient',score:best.score};
}
async function fotmobPass(manifest,reportAliases){const clubs=unresolved(manifest),results=await concurrent(clubs,10,club=>resolveFotMob(club,reportAliases));let added=0;results.forEach((result,index)=>{if(addResult(manifest,clubs[index],result))added++;});return added;}

async function resolveSportsDb(club,reportAliases){
  const aliases=aliasesFor(club,reportAliases);let best=null;
  for(const query of aliases.slice(0,3)){try{const data=await fetchJson(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(query)}`);for(const team of data.teams||[]){if(normalize(team.strSport)!=='soccer'||!team.strBadge)continue;let score=scoreClub(team.strTeam,aliases);const country=normalize(team.strCountry),expected=normalize(COUNTRY_NAMES[club.countryCode]||'');if(country&&expected){if(country===expected||country.includes(expected)||expected.includes(country))score+=8;else score-=15;}if(!best||score>best.score)best={team,score};}}catch{}}
  if(!best||best.score<80)return null;return {sourceName:best.team.strTeam,sourcePage:best.team.strWebsite||'',logoUrl:best.team.strBadge,provider:'TheSportsDB',providerId:String(best.team.idTeam||''),confidence:'sportsdb-final',score:Math.min(100,best.score)};
}
async function sportsDbPass(manifest,reportAliases){const clubs=unresolved(manifest),results=await concurrent(clubs,8,club=>resolveSportsDb(club,reportAliases));let added=0;results.forEach((result,index)=>{if(addResult(manifest,clubs[index],result))added++;});return added;}

async function resolveWikipedia(club,reportAliases){
  const aliases=aliasesFor(club,reportAliases);let best=null;
  for(const alias of aliases.slice(0,3)){const query=`${alias} football club ${COUNTRY_NAMES[club.countryCode]||''}`.trim();try{const data=await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=256`);for(const page of Object.values(data.query?.pages||{})){if(!page.thumbnail?.source)continue;const cleaned=String(page.title||'').replace(/\b(?:F\.?C\.?|football club)\b/gi,''),score=scoreClub(cleaned,aliases)+(/football|fc|club/i.test(page.title||'')?3:0);if(!best||score>best.score)best={page,score};}}catch{}}
  if(!best||best.score<78)return null;return {sourceName:best.page.title,sourcePage:best.page.fullurl||'',logoUrl:best.page.thumbnail.source,provider:'Wikipedia',providerId:String(best.page.pageid||''),confidence:'wikipedia-final',score:Math.min(100,best.score)};
}
async function wikipediaPass(manifest,reportAliases){const clubs=unresolved(manifest),results=await concurrent(clubs,8,club=>resolveWikipedia(club,reportAliases));let added=0;results.forEach((result,index)=>{if(addResult(manifest,clubs[index],result))added++;});return added;}

async function resolveCommons(club,reportAliases){
  const aliases=aliasesFor(club,reportAliases);let best=null;
  for(const alias of aliases.slice(0,3)){const query=`${alias} ${COUNTRY_NAMES[club.countryCode]||''} logo`;try{const data=await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url&iiurlwidth=256`);for(const page of Object.values(data.query?.pages||{})){const info=page.imageinfo?.[0],url=info?.thumburl||info?.url;if(!url)continue;const title=String(page.title||'').replace(/^File:/i,'').replace(/\.(?:svg|png|webp|jpe?g)$/i,'').replace(/\blogo\b/ig,'').trim(),score=scoreClub(title,aliases)+(/logo/i.test(page.title||'')?4:0);if(!best||score>best.score)best={page,url,score};}}catch{}}
  if(!best||best.score<80)return null;return {sourceName:best.page.title,sourcePage:`https://commons.wikimedia.org/wiki/${encodeURIComponent(String(best.page.title||'').replace(/ /g,'_'))}`,logoUrl:best.url,provider:'Wikimedia Commons',providerId:String(best.page.pageid||''),confidence:'commons-final',score:Math.min(100,best.score)};
}
async function commonsPass(manifest,reportAliases){const clubs=unresolved(manifest),results=await concurrent(clubs,7,club=>resolveCommons(club,reportAliases));let added=0;results.forEach((result,index)=>{if(addResult(manifest,clubs[index],result))added++;});return added;}

const manifest=JSON.parse(await readFile(MANIFEST_PATH,'utf8'));
const report=JSON.parse(await readFile(REPORT_PATH,'utf8'));
const reportAliases=new Map((report.unresolved||[]).map(item=>[item.id,item.aliases||[]]));
console.log(`finalizer input ${Object.keys(manifest).length}/${EUROPEAN_CLUBS.length}`);
console.log(`shared identity +${shareKnownIdentity(manifest)} => ${Object.keys(manifest).length}`);
console.log(`relaxed country +${await relaxedCountryPass(manifest,reportAliases)} => ${Object.keys(manifest).length}`);
console.log(`shared identity +${shareKnownIdentity(manifest)} => ${Object.keys(manifest).length}`);
console.log(`fotmob +${await fotmobPass(manifest,reportAliases)} => ${Object.keys(manifest).length}`);
console.log(`shared identity +${shareKnownIdentity(manifest)} => ${Object.keys(manifest).length}`);
console.log(`sportsdb +${await sportsDbPass(manifest,reportAliases)} => ${Object.keys(manifest).length}`);
console.log(`wikipedia +${await wikipediaPass(manifest,reportAliases)} => ${Object.keys(manifest).length}`);
console.log(`commons +${await commonsPass(manifest,reportAliases)} => ${Object.keys(manifest).length}`);
console.log(`shared identity +${shareKnownIdentity(manifest)} => ${Object.keys(manifest).length}`);

const remaining=unresolved(manifest).map(club=>({id:club.id,name:club.name,countryCode:club.countryCode,league:club.league,division:club.division,aliases:aliasesFor(club,reportAliases)}));
const providerCounts={};for(const entry of Object.values(manifest))providerCounts[entry.provider||'unknown']=(providerCounts[entry.provider||'unknown']||0)+1;
const finalReport={...report,schemaVersion:7,generatedAt:new Date().toISOString(),catalogClubs:EUROPEAN_CLUBS.length,matched:Object.keys(manifest).length,unresolvedCount:remaining.length,coverage:Number((Object.keys(manifest).length/EUROPEAN_CLUBS.length*100).toFixed(2)),providerCounts,unresolved:remaining};
await writeFile(MANIFEST_PATH,`${JSON.stringify(manifest,null,2)}\n`);
await writeFile(REPORT_PATH,`${JSON.stringify(finalReport,null,2)}\n`);
await writeFile('artifacts/official-club-logo-manifest.generated.js',`export const OFFICIAL_CLUB_LOGO_MANIFEST = Object.freeze(${JSON.stringify(manifest,null,2)});\n`);
console.log(JSON.stringify({catalog:EUROPEAN_CLUBS.length,matched:finalReport.matched,unresolved:finalReport.unresolvedCount,coverage:`${finalReport.coverage}%`,providerCounts,remaining},null,2));
if(process.argv.includes('--require-complete')&&remaining.length)process.exitCode=1;
