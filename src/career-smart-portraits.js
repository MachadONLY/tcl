const VISION_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";
const VISION_WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
const DB_NAME = "touchline-player-portraits";
const DB_VERSION = 1;
const STORE_NAME = "portraits";
const PIPELINE_VERSION = "smart-face-v4";
const objectUrls = new Set();
const processing = new WeakSet();
const observed = new WeakSet();

let detectorPromise = null;
let dbPromise = null;
let scanQueued = false;

function openPortraitDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function readCachedPortrait(key) {
  try {
    const database = await openPortraitDb();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeCachedPortrait(key, blob) {
  try {
    const database = await openPortraitDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(blob, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Cache is an optimization, not a rendering dependency.
  }
}

async function createDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const { FilesetResolver, FaceDetector } = await import(/* @vite-ignore */ VISION_MODULE_URL);
    const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_ROOT);

    const instantiate = delegate => FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
        delegate
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.52,
      minSuppressionThreshold: 0.3
    });

    try {
      return await instantiate("GPU");
    } catch {
      return instantiate("CPU");
    }
  })();
  return detectorPromise;
}

function inferName(face, image) {
  const row = face.closest(".career-squad-row, .career-transfer-row, .career-market-row, .career-shortlist-row, .career-mail-row");
  const panel = face.closest(".career-player-profile, .career-transfer-profile, .career-offer-profile, .career-mail-reader");
  return String(
    face.dataset.playerName ||
    row?.querySelector("strong")?.textContent ||
    panel?.querySelector("h2")?.textContent ||
    image.alt ||
    "Premier League player"
  ).trim();
}

function desiredOutputSize(face) {
  if (face.classList.contains("hero") || face.classList.contains("transfer")) return 512;
  if (face.classList.contains("medium")) return 320;
  return 224;
}

function liveSource(image) {
  return String(image.currentSrc || image.src || "");
}

function sourceIdentity(image, name, outputSize, source) {
  const originalSources = image.dataset.originalSources || "";
  const fplIdentity = image.dataset.fplPortraitIdentity || "";
  return `${PIPELINE_VERSION}|${name}|${outputSize}|${fplIdentity}|${source}|${originalSources}`;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function bestDetection(result) {
  return [...(result?.detections || [])]
    .filter(detection => detection?.boundingBox)
    .sort((a, b) => {
      const aBox = a.boundingBox;
      const bBox = b.boundingBox;
      const aArea = Number(aBox.width || 0) * Number(aBox.height || 0);
      const bArea = Number(bBox.width || 0) * Number(bBox.height || 0);
      const aScore = Number(a.categories?.[0]?.score || 0);
      const bScore = Number(b.categories?.[0]?.score || 0);
      return (bArea * bScore) - (aArea * aScore);
    })[0] || null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function computeFaceCrop(box, imageWidth, imageHeight) {
  const x = Number(box.originX ?? box.origin_x ?? 0);
  const y = Number(box.originY ?? box.origin_y ?? 0);
  const width = Number(box.width || 0);
  const height = Number(box.height || 0);

  // Extend the detected facial-feature box to include hair and ears, while
  // stopping just below the chin. This creates a consistent identity portrait
  // without exposing the source club shirt.
  let cropSize = Math.max(width * 1.82, height * 1.7);
  cropSize = Math.min(cropSize, imageWidth, imageHeight);

  const centerX = x + width * 0.5;
  const centerY = y + height * 0.39;
  const left = clamp(centerX - cropSize * 0.5, 0, Math.max(0, imageWidth - cropSize));
  const top = clamp(centerY - cropSize * 0.5, 0, Math.max(0, imageHeight - cropSize));

  return { left, top, size: cropSize };
}

function paintNeutralBackground(context, size) {
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f2f6ef");
  gradient.addColorStop(1, "#dfe9da");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const light = context.createRadialGradient(size * 0.5, size * 0.22, 0, size * 0.5, size * 0.22, size * 0.72);
  light.addColorStop(0, "rgba(255,255,255,.76)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = light;
  context.fillRect(0, 0, size, size);
}

async function imageBlob(source) {
  const response = await fetch(source, {
    credentials: "omit",
    cache: "force-cache"
  });
  if (!response.ok) throw new Error(`Portrait source returned ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Portrait source was not an image");
  return blob;
}

async function generatePortrait(image, face, source) {
  const name = inferName(face, image);
  const outputSize = desiredOutputSize(face);
  const cacheKey = await sha256(sourceIdentity(image, name, outputSize, source));

  const cached = await readCachedPortrait(cacheKey);
  if (cached instanceof Blob) return { blob: cached, cacheKey };

  const sourceBlob = await imageBlob(source);
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    const detector = await createDetector();
    const result = detector.detect(bitmap);
    const detection = bestDetection(result);
    if (!detection) return null;

    const crop = computeFaceCrop(detection.boundingBox, bitmap.width, bitmap.height);
    if (crop.size < 38) return null;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    paintNeutralBackground(context, outputSize);
    context.drawImage(
      bitmap,
      crop.left,
      crop.top,
      crop.size,
      crop.size,
      0,
      0,
      outputSize,
      outputSize
    );

    const normalizedBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!(normalizedBlob instanceof Blob)) return null;

    await writeCachedPortrait(cacheKey, normalizedBlob);
    return { blob: normalizedBlob, cacheKey };
  } finally {
    bitmap.close?.();
  }
}

function applyNormalizedBlob(image, face, blob, cacheKey) {
  const previous = image.dataset.smartPortraitObjectUrl;
  if (previous) {
    URL.revokeObjectURL(previous);
    objectUrls.delete(previous);
  }

  const objectUrl = URL.createObjectURL(blob);
  objectUrls.add(objectUrl);
  image.dataset.smartPortraitObjectUrl = objectUrl;
  image.dataset.smartPortraitKey = cacheKey;
  image.dataset.smartPortraitApplying = "true";

  image.addEventListener("load", () => {
    image.dataset.smartPortraitReady = "true";
    delete image.dataset.smartPortraitApplying;
    face.classList.add("smart-portrait-ready", "photo-ready", "has-photo");
    face.classList.remove("smart-portrait-processing", "smart-portrait-unresolved", "photo-loading", "photo-failed");
  }, { once: true });

  image.src = objectUrl;
}

function scheduleImage(image) {
  if (image.closest(".career-face.hero, .career-face.transfer")) {
    queueMicrotask(() => processPortrait(image));
  } else {
    visibilityObserver.observe(image);
  }
}

async function processPortrait(image) {
  const face = image.closest(".career-face");
  if (!face || processing.has(image)) {
    if (face) image.dataset.smartPortraitPending = "true";
    return;
  }
  if (image.dataset.smartPortraitReady === "true") return;
  if (!image.complete || image.naturalWidth < 48 || image.naturalHeight < 48) return;

  const source = liveSource(image);
  if (!source || source.startsWith("blob:") || source.startsWith("data:")) return;

  processing.add(image);
  face.classList.add("smart-portrait-processing");
  face.classList.remove("smart-portrait-unresolved");

  try {
    const result = await generatePortrait(image, face, source);
    if (liveSource(image) !== source) {
      image.dataset.smartPortraitPending = "true";
      return;
    }
    if (result) applyNormalizedBlob(image, face, result.blob, result.cacheKey);
    else face.classList.add("smart-portrait-unresolved");
  } catch {
    face.classList.add("smart-portrait-unresolved");
  } finally {
    processing.delete(image);
    face.classList.remove("smart-portrait-processing");

    if (image.dataset.smartPortraitPending === "true") {
      delete image.dataset.smartPortraitPending;
      image.dataset.smartPortraitReady = "false";
      queueMicrotask(() => scheduleImage(image));
    }
  }
}

const visibilityObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    visibilityObserver.unobserve(entry.target);
    processPortrait(entry.target);
  }
}, { rootMargin: "180px" });

function observeImage(image) {
  if (observed.has(image)) return;
  observed.add(image);
  image.crossOrigin = "anonymous";

  image.addEventListener("load", () => {
    const source = liveSource(image);
    if (image.dataset.smartPortraitApplying === "true" || source.startsWith("blob:")) return;

    image.dataset.smartPortraitReady = "false";
    if (processing.has(image)) {
      image.dataset.smartPortraitPending = "true";
      return;
    }
    scheduleImage(image);
  });

  if (image.complete && image.naturalWidth >= 48) scheduleImage(image);
}

function scan() {
  document.querySelectorAll(".career-face > img").forEach(observeImage);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const mutationObserver = new MutationObserver(queueScan);
mutationObserver.observe(document.body, { childList: true, subtree: true });
queueScan();

window.addEventListener("beforeunload", () => {
  for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
  objectUrls.clear();
});
