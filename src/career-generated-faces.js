let scanQueued = false;

function hash(value) {
  let result = 2166136261;
  for (const character of String(value || "Touchline")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function inferName(face) {
  const row = face.closest(".career-squad-row, .career-transfer-row, .career-market-row, .career-shortlist-row, .career-mail-row");
  const panel = face.closest(".career-player-profile, .career-transfer-profile, .career-offer-profile, .career-mail-reader");
  return String(
    face.dataset.playerName ||
    row?.querySelector("strong")?.textContent ||
    panel?.querySelector("h2")?.textContent ||
    face.querySelector("img")?.alt ||
    "Academy player"
  ).trim();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function generatedPortrait(name) {
  const seed = hash(name);
  const skinTones = ["#f2c9a5", "#dfaa7f", "#c9895e", "#a96642", "#7a442c", "#4f2d20"];
  const hairTones = ["#161513", "#31251d", "#5b3b26", "#8a5b35", "#b88a55"];
  const eyeTones = ["#2e211b", "#4b3525", "#31576c", "#426644"];
  const skin = skinTones[seed % skinTones.length];
  const hair = hairTones[(seed >>> 3) % hairTones.length];
  const eyes = eyeTones[(seed >>> 6) % eyeTones.length];
  const hairStyle = (seed >>> 9) % 4;
  const beardStyle = (seed >>> 12) % 4;
  const browTilt = ((seed >>> 15) % 5) - 2;
  const smile = (seed >>> 18) % 3;
  const safeName = escapeXml(name);

  const hairPath = [
    '<path d="M105 151c2-72 38-111 76-111 47 0 81 38 75 111-11-29-35-43-75-43-35 0-58 14-76 43Z" fill="HAIR"/>',
    '<path d="M103 151c-1-64 26-111 78-111 36 0 66 20 77 58-22-10-44-11-66-4-33 10-55 29-89 57Z" fill="HAIR"/>',
    '<path d="M105 151c3-65 32-111 77-111 42 0 72 29 76 84-17-19-35-29-57-30-39-2-67 17-96 57Z" fill="HAIR"/><path d="M112 83c20-30 44-45 73-45 26 0 49 11 66 32-21-7-44-5-69 5-28 11-51 13-70 8Z" fill="HAIR"/>',
    '<path d="M104 153c0-70 31-113 78-113 44 0 74 35 77 98-16-17-31-26-47-29-34-7-65 7-108 44Z" fill="HAIR"/><circle cx="125" cy="74" r="23" fill="HAIR"/><circle cx="160" cy="58" r="25" fill="HAIR"/><circle cx="200" cy="59" r="25" fill="HAIR"/><circle cx="235" cy="79" r="22" fill="HAIR"/>'
  ][hairStyle].replaceAll("HAIR", hair);

  const beard = [
    "",
    `<path d="M125 202c11 48 31 69 57 69 27 0 48-22 57-69-13 20-31 31-57 31-24 0-43-10-57-31Z" fill="${hair}" opacity=".78"/>`,
    `<path d="M142 224c9 23 22 35 40 35 19 0 33-12 41-35-11 8-24 12-41 12-16 0-29-4-40-12Z" fill="${hair}" opacity=".88"/>`,
    `<path d="M132 205c12 38 28 56 50 56 23 0 40-19 51-56-11 12-28 20-51 20-22 0-39-7-50-20Z" fill="${hair}" opacity=".9"/><path d="M158 201c8 5 16 8 24 8 9 0 17-3 25-8-4 12-12 18-25 18-12 0-20-6-24-18Z" fill="${hair}"/>`
  ][beardStyle];

  const mouth = smile === 0
    ? '<path d="M159 219c14 6 29 6 45 0" fill="none" stroke="#8f493f" stroke-width="5" stroke-linecap="round"/>'
    : smile === 1
      ? '<path d="M158 216c15 12 31 12 47 0" fill="none" stroke="#8f493f" stroke-width="5" stroke-linecap="round"/>'
      : '<path d="M159 221c14-4 29-4 44 0" fill="none" stroke="#8f493f" stroke-width="5" stroke-linecap="round"/>';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 360 420" role="img" aria-label="${safeName}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3f7f0"/><stop offset="1" stop-color="#dce8d7"/></linearGradient>
      <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d92a22"/><stop offset="1" stop-color="#9e1010"/></linearGradient>
    </defs>
    <rect width="360" height="420" rx="42" fill="url(#bg)"/>
    <ellipse cx="180" cy="405" rx="128" ry="119" fill="url(#shirt)"/>
    <path d="M145 254v54c8 15 20 23 37 23s29-8 38-23v-54Z" fill="${skin}"/>
    <ellipse cx="180" cy="156" rx="78" ry="103" fill="${skin}"/>
    <ellipse cx="105" cy="166" rx="13" ry="26" fill="${skin}"/><ellipse cx="255" cy="166" rx="13" ry="26" fill="${skin}"/>
    ${hairPath}
    <path d="M131 ${158 + browTilt}c15-9 28-9 42 0" fill="none" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
    <path d="M188 ${158 - browTilt}c15-9 28-9 42 0" fill="none" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="151" cy="174" rx="12" ry="8" fill="#fff"/><ellipse cx="209" cy="174" rx="12" ry="8" fill="#fff"/>
    <circle cx="151" cy="175" r="5" fill="${eyes}"/><circle cx="209" cy="175" r="5" fill="${eyes}"/>
    <circle cx="152" cy="173" r="1.5" fill="#fff"/><circle cx="210" cy="173" r="1.5" fill="#fff"/>
    <path d="M180 177c-8 18-10 32-4 40 5 5 13 5 21 0" fill="none" stroke="#a9634f" stroke-width="4" stroke-linecap="round"/>
    ${mouth}
    ${beard}
    <path d="M126 321c16 19 34 29 56 29 23 0 42-10 57-29" fill="none" stroke="#111611" stroke-width="12" stroke-linecap="round"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function needsGeneratedFace(face, image) {
  if (!image) return true;
  const source = String(image.currentSrc || image.src || "");
  if (!source) return true;
  if (source.startsWith("data:image/svg+xml") && !face.classList.contains("generated-player-face")) return true;
  return face.classList.contains("photo-failed") || image.naturalWidth === 0;
}

function ensureGeneratedFace(face) {
  const image = face.querySelector(":scope > img");
  if (!needsGeneratedFace(face, image)) return;

  const name = inferName(face);
  let target = image;
  if (!target) {
    target = document.createElement("img");
    face.insertBefore(target, face.querySelector(":scope > small") || null);
  }

  target.alt = name;
  target.decoding = "async";
  target.loading = face.classList.contains("hero") ? "eager" : "lazy";
  target.src = generatedPortrait(name);
  face.classList.add("generated-player-face", "has-photo", "photo-ready");
  face.classList.remove("photo-loading", "photo-failed");
}

function scan() {
  document.querySelectorAll(".career-face").forEach(face => {
    const image = face.querySelector(":scope > img");
    if (!image) {
      ensureGeneratedFace(face);
      return;
    }
    if (image.complete) ensureGeneratedFace(face);
    else image.addEventListener("error", () => ensureGeneratedFace(face), { once: true });
  });
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const observer = new MutationObserver(queueScan);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", queueScan, { once: true });
setTimeout(queueScan, 1400);
queueScan();
