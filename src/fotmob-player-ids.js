// Verified identity bridge for the current Manchester United career roster.
// IDs resolve to FotMob's transparent, face-only player portraits.

const IDS = Object.freeze({
  "altay bayindir": 866967,
  "andre onana": 611491,
  "a onana": 611491,
  "tom heaton": 24155,
  "senne lammens": 1178602,
  "karl darlow": 163604,
  "dermot mee": 1367699,
  "elyh harrison": 1422743,

  "diogo dalot": 751550,
  "noussair mazraoui": 775539,
  "matthijs de ligt": 769895,
  "harry maguire": 255610,
  "lisandro martinez": 847983,
  "leny yoro": 1358581,
  "luke shaw": 362694,
  "ayden heaven": 1559639,
  "tyler fredricson": 1403351,
  "patrick dorgu": 1526560,
  "harry amass": 1430832,
  "diego leon": 1661695,
  "jaydan kamason": 1473693,
  "daniel armer": 1726964,

  "manuel ugarte": 1035614,
  "mason mount": 750032,
  "bruno fernandes": 422685,
  "amad diallo": 1070052,
  "amad": 1070052,
  "andrey santos": 1372921,
  "youri tielemans": 465960,
  "kobbie mainoo": 1292810,
  "toby collyer": 1421810,
  "daniel gore": 1292838,
  "jack fletcher": 1575707,
  "jim thwaites": 1610953,
  "jack moorhouse": 1315314,
  "finley mcallister": 1557072,

  "marcus rashford": 696365,
  "matheus cunha": 863098,
  "bryan mbeumo": 923312,
  "joshua zirkzee": 950830,
  "benjamin sesko": 1073977,
  "benjamin sesko": 1073977,
  "chido obi": 1557220,
  "shea lacey": 1436260,
  "ethan wheatley": 1398915,
  "enzo kana biyik": 1714514,
  "victor musa": 1436333,
  "jj gabriel": 1737914,
  "joseph junior andreou gabriel": 1737914,
  "joseph junior gabriel": 1737914
});

export function normalizePlayerIdentity(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`-]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFotmobPlayerId(name) {
  return IDS[normalizePlayerIdentity(name)] || null;
}

export function fotmobPortraitUrl(name) {
  const id = getFotmobPlayerId(name);
  return id ? `https://images.fotmob.com/image_resources/playerimages/${id}.png` : null;
}

export const FOTMOB_PLAYER_IDS = IDS;
