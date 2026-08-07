const SOURCE_SEASON = '2025/26';

const INTERNAL_PREMIER_LEAGUE = Object.freeze([
  ['ARS', 'Arsenal'], ['AVL', 'Aston Villa'], ['BOU', 'Bournemouth'], ['BRE', 'Brentford'],
  ['BHA', 'Brighton & Hove Albion'], ['CHE', 'Chelsea'], ['COV', 'Coventry City'],
  ['CRY', 'Crystal Palace'], ['EVE', 'Everton'], ['FUL', 'Fulham'], ['HUL', 'Hull City'],
  ['IPS', 'Ipswich Town'], ['LEE', 'Leeds United'], ['LIV', 'Liverpool'], ['MCI', 'Manchester City'],
  ['MUN', 'Manchester United'], ['NEW', 'Newcastle United'], ['NFO', 'Nottingham Forest'],
  ['SUN', 'Sunderland'], ['TOT', 'Tottenham Hotspur']
]);

const RAW_COUNTRIES = Object.freeze([
  ['ENG', 'Inglaterra', '#d9e8f5', [
    ['Premier League', 1, INTERNAL_PREMIER_LEAGUE],
    ['Championship', 2, ['Birmingham City','Blackburn Rovers','Bristol City','Charlton Athletic','Derby County','Leicester City','Middlesbrough','Millwall','Norwich City','Oxford United','Portsmouth','Preston North End','Queens Park Rangers','Sheffield United','Sheffield Wednesday','Southampton','Stoke City','Swansea City','Watford','West Bromwich Albion','Wrexham']],
    ['League One', 3, ['AFC Wimbledon','Barnsley','Blackpool','Bolton Wanderers','Bradford City','Burton Albion','Cardiff City','Doncaster Rovers','Exeter City','Huddersfield Town','Leyton Orient','Lincoln City','Luton Town','Mansfield Town','Northampton Town','Peterborough United','Plymouth Argyle','Reading','Rotherham United','Stevenage','Stockport County','Wigan Athletic','Wycombe Wanderers']]
  ]],
  ['FRA', 'França', '#6aa6ff', [
    ['Ligue 1', 1, ['Paris Saint-Germain','Marseille','Monaco','Lyon','Lille','Nice','Rennes','Lens','Strasbourg','Brest','Toulouse','Nantes','Auxerre','Angers','Le Havre','Lorient','Paris FC','Metz']],
    ['Ligue 2', 2, ['Saint-Étienne','Montpellier','Reims','Dunkerque','Guingamp','Annecy','Laval','Bastia','Grenoble','Amiens','Pau','Rodez','Red Star','Clermont','Troyes','Nancy','Le Mans','Boulogne']],
    ['National', 3, ['Caen','Dijon','Sochaux','Valenciennes','Orléans','Rouen','Nîmes','Versailles','Aubagne','Concarneau','Villefranche','Châteauroux','Quevilly-Rouen','Paris 13 Atletico','Bourg-en-Bresse','Le Puy']]
  ]],
  ['GER', 'Alemanha', '#f0bd58', [
    ['Bundesliga', 1, ['Bayern Munich','Bayer Leverkusen','Borussia Dortmund','RB Leipzig','Eintracht Frankfurt','VfB Stuttgart','Borussia Mönchengladbach','Wolfsburg','Freiburg','Mainz 05','Werder Bremen','Hoffenheim','Union Berlin','Augsburg','Hamburg','St. Pauli','Cologne','Heidenheim']],
    ['2. Bundesliga', 2, ['Schalke 04','Hertha Berlin','Hannover 96','Fortuna Düsseldorf','Kaiserslautern','Nürnberg','Karlsruher SC','Darmstadt 98','Paderborn','Holstein Kiel','Bochum','Arminia Bielefeld','Greuther Fürth','Magdeburg','Preußen Münster','Elversberg','Dynamo Dresden','Eintracht Braunschweig']],
    ['3. Liga', 3, ['1860 Munich','Alemannia Aachen','Energie Cottbus','Hansa Rostock','Ingolstadt','Osnabrück','Saarbrücken','Rot-Weiss Essen','Viktoria Köln','Wehen Wiesbaden','Erzgebirge Aue','Sandhausen','Verl','Waldhof Mannheim','Duisburg','Havelse']]
  ]],
  ['ESP', 'Espanha', '#ffb46c', [
    ['LaLiga', 1, ['Real Madrid','Barcelona','Atlético Madrid','Athletic Club','Villarreal','Real Betis','Real Sociedad','Sevilla','Valencia','Girona','Celta Vigo','Osasuna','Mallorca','Getafe','Rayo Vallecano','Espanyol','Alavés','Elche','Levante','Real Oviedo']],
    ['LaLiga 2', 2, ['Deportivo La Coruña','Granada','Almería','Cádiz','Málaga','Sporting Gijón','Real Zaragoza','Racing Santander','Eibar','Valladolid','Las Palmas','Leganés','Burgos','Albacete','Huesca','Córdoba','Castellón','Mirandés','Ceuta','Cultural Leonesa']],
    ['Primera Federación', 3, ['Tenerife','Ponferradina','Nàstic Tarragona','Murcia','Hércules','Recreativo Huelva','Sabadell','Real Unión','Barakaldo','Lugo','Ourense','Marbella','Ibiza','Alcorcón','Cartagena','Mérida']]
  ]],
  ['ITA', 'Itália', '#77d5a3', [
    ['Serie A', 1, ['Inter Milan','AC Milan','Juventus','Napoli','Roma','Lazio','Atalanta','Fiorentina','Bologna','Torino','Genoa','Udinese','Parma','Cagliari','Como','Verona','Lecce','Sassuolo','Pisa','Cremonese']],
    ['Serie B', 2, ['Sampdoria','Palermo','Bari','Empoli','Monza','Venezia','Spezia','Frosinone','Modena','Cesena','Catanzaro','Reggiana','Mantova','Südtirol','Avellino','Padova','Carrarese','Pescara','Juve Stabia','Virtus Entella']],
    ['Serie C', 3, ['Catania','Crotone','Benevento','Foggia','Salernitana','Vicenza','Triestina','Perugia','Ternana','Ascoli','Arezzo','Rimini','Pescara City','Padova B','Pro Vercelli','Novara','Alessandria','Taranto']]
  ]],
  ['POR', 'Portugal', '#79c87c', [
    ['Primeira Liga', 1, ['Benfica','Porto','Sporting CP','Braga','Vitória de Guimarães','Famalicão','Boavista','Rio Ave','Gil Vicente','Casa Pia','Estoril','Arouca','Moreirense','Nacional','Santa Clara','Alverca','Tondela','Estrela da Amadora']],
    ['Liga Portugal 2', 2, ['Marítimo','Paços de Ferreira','Académico de Viseu','Leixões','Penafiel','Feirense','Torreense','União de Leiria','Chaves','Portimonense','Vizela','Farense','Oliveirense','Felgueiras','Lusitânia de Lourosa','Benfica B','Porto B','Sporting B']],
    ['Liga 3', 3, ['Belenenses','Académica','Varzim','Sanjoanense','Amarante','Fafe','Trofense','Anadia','Caldas','1º Dezembro','Atlético CP','Sporting Covilhã','Lusitânia dos Açores','Oliveira do Hospital']]
  ]],
  ['NED', 'Países Baixos', '#f28f45', [
    ['Eredivisie', 1, ['Ajax','PSV','Feyenoord','AZ Alkmaar','Twente','Utrecht','Heerenveen','Groningen','NEC Nijmegen','Sparta Rotterdam','Heracles','Fortuna Sittard','Go Ahead Eagles','PEC Zwolle','NAC Breda','Willem II','Volendam','Excelsior']],
    ['Eerste Divisie', 2, ['ADO Den Haag','Roda JC','Cambuur','De Graafschap','Emmen','Den Bosch','MVV Maastricht','VVV-Venlo','Dordrecht','Helmond Sport','Eindhoven','TOP Oss','Telstar','Vitesse','Almere City','RKC Waalwijk','Jong Ajax','Jong PSV','Jong AZ','Jong Utrecht']]
  ]],
  ['BEL', 'Bélgica', '#d9bc59', [
    ['Pro League', 1, ['Club Brugge','Anderlecht','Union Saint-Gilloise','Genk','Gent','Antwerp','Standard Liège','Charleroi','Mechelen','Cercle Brugge','Westerlo','OH Leuven','Sint-Truiden','Zulte Waregem','Dender','La Louvière']],
    ['Challenger Pro League', 2, ['Beerschot','Kortrijk','RWDM','Lommel','Beveren','Lierse','Patro Eisden','Eupen','Francs Borains','Seraing','Lokeren-Temse','RFC Liège','Club NXT','RSCA Futures','Jong Genk']]
  ]],
  ['SCO', 'Escócia', '#7d9fe8', [
    ['Premiership', 1, ['Celtic','Rangers','Aberdeen','Hearts','Hibernian','Dundee United','Motherwell','Kilmarnock','St Mirren','Dundee FC','Falkirk','Livingston']],
    ['Championship', 2, ['Ross County','St Johnstone','Partick Thistle','Raith Rovers','Ayr United','Dunfermline Athletic','Greenock Morton','Queen’s Park','Arbroath','Airdrieonians']]
  ]],
  ['AUT', 'Áustria', '#e65d5d', [
    ['Bundesliga', 1, ['Red Bull Salzburg','Sturm Graz','Rapid Wien','Austria Wien','LASK','Wolfsberger AC','Hartberg','Austria Klagenfurt','WSG Tirol','Blau-Weiß Linz','Altach','Ried']],
    ['2. Liga', 2, ['Admira Wacker','First Vienna','St. Pölten','Floridsdorfer AC','Kapfenberger SV','Austria Lustenau','Schwarz-Weiß Bregenz','Rapid Wien II','Sturm Graz II','Austria Wien II','Liefering','Stripfing']]
  ]],
  ['SUI', 'Suíça', '#d95d5d', [
    ['Super League', 1, ['Young Boys','Basel','Zürich','Servette','Lugano','St. Gallen','Luzern','Lausanne-Sport','Grasshoppers','Sion','Winterthur','Thun']],
    ['Challenge League', 2, ['Aarau','Vaduz','Neuchâtel Xamax','Wil','Stade Nyonnais','Bellinzona','Étoile Carouge','Schaffhausen','Yverdon','Rapperswil-Jona']]
  ]],
  ['TUR', 'Turquia', '#e86767', [
    ['Süper Lig', 1, ['Galatasaray','Fenerbahçe','Beşiktaş','Trabzonspor','Başakşehir','Samsunspor','Göztepe','Konyaspor','Rizespor','Antalyaspor','Alanyaspor','Kasımpaşa','Gaziantep','Kayserispor','Eyüpspor','Gençlerbirliği','Kocaelispor','Fatih Karagümrük']],
    ['1. Lig', 2, ['Adana Demirspor','Ankaragücü','Sivasspor','Hatayspor','Sakaryaspor','Bandırmaspor','Erzurumspor','Boluspor','İstanbulspor','Ümraniyespor','Manisa FK','Pendikspor','Erokspor','Çorum FK','Iğdır FK','Bodrum FK']]
  ]],
  ['GRE', 'Grécia', '#70a6d8', [
    ['Super League', 1, ['Olympiacos','Panathinaikos','AEK Athens','PAOK','Aris','OFI Crete','Asteras Tripolis','Atromitos','Panetolikos','Levadiakos','Volos','Kifisia','Larissa','Panserraikos']],
    ['Super League 2', 2, ['Iraklis','Panionios','Kalamata','Niki Volos','Makedonikos','AEL Kalloni','Chania','Egaleo','Panachaiki','Diagoras','Kavala','Giannina']]
  ]],
  ['DEN', 'Dinamarca', '#df6f6f', [
    ['Superliga', 1, ['Copenhagen','Midtjylland','Brøndby','Nordsjælland','Aarhus','Randers','Silkeborg','Viborg','Sønderjyske','Vejle','Odense','Fredericia']],
    ['1st Division', 2, ['AaB','Horsens','Lyngby','Hvidovre','Esbjerg','Kolding','Hobro','Hillerød','HB Køge','B 93','Middelfart','Aarhus Fremad']]
  ]],
  ['NOR', 'Noruega', '#6a91d9', [
    ['Eliteserien', 1, ['Bodø/Glimt','Rosenborg','Molde','Brann','Viking','Tromsø','Sarpsborg 08','Fredrikstad','Strømsgodset','Kristiansund','HamKam','Sandefjord','Haugesund','KFUM Oslo','Bryne','Vålerenga']],
    ['1. divisjon', 2, ['Lillestrøm','Stabæk','Start','Aalesund','Sogndal','Ranheim','Kongsvinger','Mjøndalen','Raufoss','Moss','Egersund','Lyn','Hødd','Skeid','Åsane','Odd']]
  ]],
  ['SWE', 'Suécia', '#dfd35d', [
    ['Allsvenskan', 1, ['Malmö FF','Hammarby','AIK','Djurgården','Häcken','Elfsborg','Göteborg','Norrköping','Sirius','Mjällby','Brommapojkarna','Halmstad','Värnamo','GAIS','Degerfors','Öster']],
    ['Superettan', 2, ['Helsingborg','Örebro','Landskrona','Trelleborg','Örgryte','Utsikten','Östersund','Brage','Sandviken','Sundsvall','Falkenberg','Kalmar','Västerås','Varberg','Oddevold','Umeå']]
  ]],
  ['POL', 'Polônia', '#e58a8a', [
    ['Ekstraklasa', 1, ['Legia Warsaw','Lech Poznań','Raków Częstochowa','Jagiellonia Białystok','Pogoń Szczecin','Górnik Zabrze','Cracovia','Widzew Łódź','Śląsk Wrocław','Zagłębie Lubin','Piast Gliwice','Korona Kielce','Radomiak Radom','Motor Lublin','GKS Katowice','Arka Gdynia','Wisła Płock','Bruk-Bet Termalica']],
    ['I Liga', 2, ['Wisła Kraków','Ruch Chorzów','ŁKS Łódź','Miedź Legnica','Polonia Warsaw','Stal Rzeszów','GKS Tychy','Odra Opole','Znicz Pruszków','Puszcza Niepołomice','Stal Mielec','Wieczysta Kraków','Chrobry Głogów','Pogoń Siedlce']]
  ]],
  ['CZE', 'Tchéquia', '#7e9fd6', [
    ['First League', 1, ['Slavia Prague','Sparta Prague','Viktoria Plzeň','Baník Ostrava','Sigma Olomouc','Slovan Liberec','Mladá Boleslav','Bohemians 1905','Teplice','Jablonec','Hradec Králové','Slovácko','Pardubice','Karviná','Dukla Prague','Zlín']],
    ['National League', 2, ['Zbrojovka Brno','Vyškov','Opava','Líšeň','Vlašim','Prostějov','Varnsdorf','Táborsko','Chrudim','Jihlava','Žižkov','Sparta Prague B','Slavia Prague B','Artis Brno']]
  ]],
  ['CRO', 'Croácia', '#86a5e7', [
    ['HNL', 1, ['Dinamo Zagreb','Hajduk Split','Rijeka','Osijek','Lokomotiva Zagreb','Varaždin','Istra 1961','Slaven Belupo','Gorica','Vukovar 1991']],
    ['First League', 2, ['Rudeš','Cibalia','Orijent','Sesvete','Dugopolje','Jarun','Croatia Zmijavci','Dubrava Zagreb','Opatija','Karlovac']]
  ]],
  ['SRB', 'Sérvia', '#d86c6c', [
    ['SuperLiga', 1, ['Red Star Belgrade','Partizan','Vojvodina','Čukarički','TSC Bačka Topola','Radnički Niš','Novi Pazar','Mladost Lučani','Napredak','Spartak Subotica','Radnički Kragujevac','Železničar Pančevo','IMT','OFK Beograd','Javor','Dubocica']],
    ['First League', 2, ['Grafičar','Zemun','Mačva Šabac','Borac Čačak','Smederevo','Voždovac','Radnik Surdulica','Mladost GAT','Inđija','Sloboda Užice','Trajal Kruševac','Vršac']]
  ]],
  ['UKR', 'Ucrânia', '#e3d35c', [
    ['Premier League', 1, ['Dynamo Kyiv','Shakhtar Donetsk','Polissya Zhytomyr','Oleksandriya','Kryvbas','Rukh Lviv','Karpaty Lviv','Zorya Luhansk','Vorskla Poltava','LNZ Cherkasy','Kolos Kovalivka','Veres Rivne','Obolon Kyiv','Chornomorets Odesa','Epitsentr','Metalist 1925']],
    ['First League', 2, ['Metalist Kharkiv','Bukovyna Chernivtsi','Nyva Ternopil','Prykarpattia','Ahrobiznes Volochysk','Podillya Khmelnytskyi','Kremin Kremenchuk','Victoria Sumy','Dinaz Vyshhorod','Kudrivka']]
  ]]
]);

function slug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rowToClub(countryCode, countryName, color, leagueName, division, row, index) {
  const internal = Array.isArray(row);
  const code = internal ? row[0] : null;
  const name = internal ? row[1] : row;
  const strengthBase = division === 1 ? 79 : division === 2 ? 71 : 65;
  const rating = Math.max(58, strengthBase - Math.floor(index / 4));
  return Object.freeze({
    id: code || `${countryCode.toLowerCase()}-${division}-${slug(name)}`,
    code,
    name,
    shortName: name,
    countryCode,
    country: countryName,
    league: leagueName,
    division,
    rating,
    reputation: Math.max(1, Math.min(5, Math.round((rating - 55) / 7))),
    color,
    sourceSeason: SOURCE_SEASON,
    internal: Boolean(code)
  });
}

export const EUROPE_COUNTRIES = Object.freeze(RAW_COUNTRIES.map(([code, name, color, leagues]) => Object.freeze({
  code,
  name,
  color,
  divisions: Object.freeze(leagues.map(([league, division]) => Object.freeze({ league, division })))
})));

export const EUROPEAN_CLUBS = Object.freeze(RAW_COUNTRIES.flatMap(([countryCode, country, color, leagues]) =>
  leagues.flatMap(([league, division, rows]) => rows.map((row, index) =>
    rowToClub(countryCode, country, color, league, division, row, index)
  ))
));

export const EUROPEAN_CLUB_BY_ID = new Map(EUROPEAN_CLUBS.map(club => [club.id, club]));
export const EUROPEAN_CLUB_BY_CODE = new Map(EUROPEAN_CLUBS.filter(club => club.code).map(club => [club.code, club]));

export function clubsByCountry(countryCode) {
  return EUROPEAN_CLUBS.filter(club => club.countryCode === countryCode);
}

export function clubsByCountryDivision(countryCode, division) {
  return EUROPEAN_CLUBS.filter(club => club.countryCode === countryCode && club.division === Number(division));
}

export function findEuropeanClub(value) {
  const key = String(value || '');
  return EUROPEAN_CLUB_BY_ID.get(key) || EUROPEAN_CLUB_BY_CODE.get(key) || null;
}

export const EUROPEAN_CATALOG_META = Object.freeze({
  source: 'OpenFootball-compatible offline seed',
  sourceSeason: SOURCE_SEASON,
  countries: EUROPE_COUNTRIES.length,
  clubs: EUROPEAN_CLUBS.length,
  runtimeNetworkRequired: false
});
