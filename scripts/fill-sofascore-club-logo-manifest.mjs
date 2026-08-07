import { readFile, writeFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const MANIFEST_PATH = 'artifacts/official-club-logo-manifest.generated.json';
const REPORT_PATH = 'artifacts/official-club-logo-audit.json';
const API_BASES = ['https://api.sofascore.com/api/v1', 'https://www.sofascore.com/api/v1'];
const COUNTRY_NAMES = {ENG:'England',FRA:'France',GER:'Germany',ESP:'Spain',ITA:'Italy',POR:'Portugal',NED:'Netherlands',BEL:'Belgium',SCO:'Scotland',AUT:'Austria',SUI:'Switzerland',TUR:'Turkey',GRE:'Greece',DEN:'Denmark',NOR:'Norway',SWE:'Sweden',POL:'Poland',CZE:'Czech Republic',CRO:'Croatia',SRB:'Serbia',UKR:'Ukraine',ROU:'Romania',BUL:'Bulgaria',HUN:'Hungary',SVK:'Slovakia',SVN:'Slovenia',BIH:'Bosnia and Herzegovina',ALB:'Albania',MKD:'North Macedonia',MNE:'Montenegro',CYP:'Cyprus',IRL:'Ireland',NIR:'Northern Ireland',WAL:'Wales',FIN:'Finland',ISL:'Iceland',LVA:'Latvia',LTU:'Lithuania',EST:'Estonia',GEO:'Georgia',ARM:'Armenia',AZE:'Azerbaijan',MDA:'Moldova',KOS:'Kosovo',MLT:'Malta',LUX:'Luxembourg',FRO:'Faroe Islands',KAZ:'Kazakhstan',ISR:'Israel',AND:'Andorra',SMR:'San Marino',GIB:'Gibraltar',BLR:'Belarus',RUS:'Russia'};
const COMMON = new Set(['fc','cf','afc','ac','sc','fk','sk','sv','as','ss','cd','ud','nk','hnk','pfc','club','football','calcio','futbol','stade','rc','tsv','vfl','vfb','spvgg','de','do','da','del','the','1']);
const RESERVE = /(?:\b(?:u|under)[ -]?(?:18|19|20|21|23)\b|\b(?:ii|iii|b|c|reserves?|reserve|academy|akademia|nxt|jong|futures)\b)/i;

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g,'ss').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ð/g,'d').replace(/þ/g,'th')
    .replace(/&/g,' and ').replace(/[’'`´]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function stripped(value) { return normalize(value).split(' ').filter(Boolean).filter(token => !COMMON.has(token)).join(' '); }
function parentName(value) { return stripped(String(value || '').replace(RESERVE, ' ')); }
function levenshtein(a,b){const left=normalize(a),right=normalize(b);if(left===right)return 0;const prev=Array.from({length:right.length+1},(_,i)=>i),cur=new Array(right.length+1);for(let i=1;i<=left.length;i++){cur[0]=i;for(let j=1;j<=right.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(left[i-1]===right[j-1]?0:1));for(let j=0;j<=right.length;j++)prev[j]=cur[j];}return prev[right.length];}
function similarity(a,b){const left=normalize(a),right=normalize(b);if(!left||!right)return 0;if(left===right)return 100;const ls=stripped(left),rs=stripped(right);if(ls&&ls===rs)return 99;const lp=parentName(left),rp=parentName(right);if(lp&&lp===rp)return 96;const lset=new Set(ls.split(' ').filter(Boolean)),rset=new Set(rs.split(' ').filter(Boolean)),inter=[...lset].filter(x=>rset.has(x)).length,union=new Set([...lset,...rset]).size||1,edit=1-levenshtein(ls,rs)/(Math.max(ls.length,rs.length)||1);return Math.round((inter/union*.66+edit*.34)*100);}
function aliasesFor(club, reportAliases){const values=[club.name,club.shortName,...(reportAliases.get(club.id)||[]),stripped(club.name)];if(RESERVE.test(club.name))values.push(parentName(club.name));return [...new Set(values.filter(Boolean))];}
function countryCompatible(expected, actual){const a=normalize(expected),b=normalize(actual);if(!a||!b)return false;return a===b||a.includes(b)||b.includes(a)||(a==='england'&&b==='united kingdom')||(a==='scotland'&&b==='united kingdom')||(a==='wales'&&b==='united kingdom')||(a==='northern ireland'&&b==='united kingdom');}
async function fetchJson(url){const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 TouchlineCareerOS/1.0','accept':'application/json,text/plain,*/*','origin':'https://www.sofascore.com','referer':'https://www.sofascore.com/'},signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
async function search(query){for(const base of API_BASES){try{return await fetchJson(`${base}/search/all?q=${encodeURIComponent(query)}&page=0`);}catch{}}return null;}
async function concurrent(items, concurrency, worker){const results=new Array(items.length);let cursor=0;async function run(){while(true){const index=cursor++;if(index>=items.length)return;try{results[index]=await worker(items[index]);}catch{results[index]=null;}}await Promise.all(Array.from({length:Math.min(concurrency,Math.max(1,items.length))},run));return results;}

async function resolveClub(club,reportAliases){
  const aliases=aliasesFor(club,reportAliases), expectedCountry=COUNTRY_NAMES[club.countryCode]||'';
  const queries=[...new Set([...aliases.slice(0,4),`${club.name} ${expectedCountry}`.trim()])];
  const candidates=new Map();
  for(const query of queries){
    const data=await search(query);if(!data)continue;
    for(const result of data.results||[]){
      const entity=result.entity||{};const type=String(result.type||entity.type||'').toLowerCase();
      if(type&&type!=='team')continue;if(!entity.id||!entity.name)continue;
      if(entity.sport&&entity.sport.id!==1&&entity.sport.slug!=='football')continue;if(entity.national)continue;
      let nameScore=Math.max(...aliases.map(alias=>similarity(alias,entity.name||entity.shortName||entity.slug||'')));
      const country=entity.country?.name||entity.category?.country?.name||'';const countryMatch=countryCompatible(expectedCountry,country);
      let score=nameScore+(countryMatch?12:0);
      if(!countryMatch&&country&&nameScore<97)score-=12;
      const old=candidates.get(String(entity.id));if(!old||score>old.score)candidates.set(String(entity.id),{entity,score,nameScore,countryMatch});
    }
  }
  const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score);const best=ranked[0],second=ranked[1];
  if(!best)return null;
  const exactish=best.nameScore>=97;
  if(!exactish&&best.score<86)return null;
  if(!exactish&&second&&best.score-second.score<5)return null;
  return {sourceName:best.entity.name,sourcePage:`https://www.sofascore.com/team/football/${best.entity.slug||normalize(best.entity.name).replace(/ /g,'-')}/${best.entity.id}`,logoUrl:`https://img.sofascore.com/api/v1/team/${best.entity.id}/image`,provider:'Sofascore',providerId:String(best.entity.id),confidence:exactish?'sofascore-name-exact':'sofascore-scored',score:Math.min(100,best.score)};
}

const manifest=JSON.parse(await readFile(MANIFEST_PATH,'utf8'));
const report=JSON.parse(await readFile(REPORT_PATH,'utf8'));
const reportAliases=new Map((report.unresolved||[]).map(item=>[item.id,item.aliases||[]]));
const unresolved=EUROPEAN_CLUBS.filter(club=>!manifest[club.id]?.logoUrl);
console.log(`sofascore input ${Object.keys(manifest).length}/${EUROPEAN_CLUBS.length}; unresolved=${unresolved.length}`);
const results=await concurrent(unresolved,8,club=>resolveClub(club,reportAliases));
let added=0;
for(let index=0;index<unresolved.length;index++){const result=results[index];if(!result?.logoUrl)continue;const club=unresolved[index];manifest[club.id]={name:club.name,countryCode:club.countryCode,...result};added++;}

// Re-use a newly resolved crest for exact duplicate club identities and reserve teams.
const byExact=new Map(),byParent=new Map();for(const club of EUROPEAN_CLUBS){const entry=manifest[club.id];if(!entry?.logoUrl)continue;byExact.set(`${club.countryCode}:${normalize(club.name)}`,entry);byParent.set(`${club.countryCode}:${parentName(club.name)}`,entry);}
for(const club of EUROPEAN_CLUBS){if(manifest[club.id]?.logoUrl)continue;const exact=byExact.get(`${club.countryCode}:${normalize(club.name)}`);const parent=RESERVE.test(club.name)?byParent.get(`${club.countryCode}:${parentName(club.name)}`):null;const source=exact||parent;if(source){manifest[club.id]={...source,name:club.name,countryCode:club.countryCode,confidence:exact?'shared-club-identity':'shared-reserve-crest'};added++;}}

const remaining=EUROPEAN_CLUBS.filter(club=>!manifest[club.id]?.logoUrl).map(club=>({id:club.id,name:club.name,countryCode:club.countryCode,league:club.league,division:club.division,aliases:aliasesFor(club,reportAliases)}));
const providerCounts={};for(const entry of Object.values(manifest))providerCounts[entry.provider||'unknown']=(providerCounts[entry.provider||'unknown']||0)+1;
const finalReport={...report,schemaVersion:8,generatedAt:new Date().toISOString(),catalogClubs:EUROPEAN_CLUBS.length,matched:Object.keys(manifest).length,unresolvedCount:remaining.length,coverage:Number((Object.keys(manifest).length/EUROPEAN_CLUBS.length*100).toFixed(2)),providerCounts,unresolved:remaining};
await writeFile(MANIFEST_PATH,`${JSON.stringify(manifest,null,2)}\n`);
await writeFile(REPORT_PATH,`${JSON.stringify(finalReport,null,2)}\n`);
await writeFile('artifacts/official-club-logo-manifest.generated.js',`export const OFFICIAL_CLUB_LOGO_MANIFEST = Object.freeze(${JSON.stringify(manifest,null,2)});\n`);
console.log(JSON.stringify({added,matched:finalReport.matched,unresolved:finalReport.unresolvedCount,coverage:`${finalReport.coverage}%`,remaining},null,2));
