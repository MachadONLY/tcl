import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { Window } from "happy-dom";

const viewportWidth = Number(process.argv[2] || 1366);
const viewportHeight = Number(process.argv[3] || 768);
const window = new Window({
  url: "http://127.0.0.1:5173/",
  width: viewportWidth,
  height: viewportHeight
});
window.document.body.innerHTML = '<div id="app"></div>';

const contextByCanvas = new WeakMap();
function gradient() {
  return { addColorStop() {} };
}
function canvasContext(canvas) {
  if (contextByCanvas.has(canvas)) return contextByCanvas.get(canvas);
  const values = {
    canvas,
    measureText(text) {
      return { width: String(text).length * 7 };
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern() {
      return null;
    },
    getImageData() {
      return { data: new Uint8ClampedArray(4) };
    }
  };
  const context = new Proxy(values, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
  contextByCanvas.set(canvas, context);
  return context;
}

window.HTMLCanvasElement.prototype.getContext = function getContext() {
  return canvasContext(this);
};
window.HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 620,
    width: 1200,
    height: 620
  };
};

let frameId = 0;
const requestAnimationFrame = () => ++frameId;
const cancelAnimationFrame = () => {};
class ResizeObserver {
  observe() {}
  disconnect() {}
}

Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLCanvasElement: window.HTMLCanvasElement,
  HTMLImageElement: window.HTMLImageElement,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  KeyboardEvent: window.KeyboardEvent,
  CustomEvent: window.CustomEvent,
  Image: window.Image,
  ResizeObserver,
  requestAnimationFrame,
  cancelAnimationFrame
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
Object.defineProperty(globalThis, "devicePixelRatio", { configurable: true, value: 1 });
window.ResizeObserver = ResizeObserver;
window.requestAnimationFrame = requestAnimationFrame;
window.cancelAnimationFrame = cancelAnimationFrame;
Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });

globalThis.fetch = async () => new Response(JSON.stringify({
  configured: false,
  provider: "football-data.org",
  competition: "PL"
}), {
  status: 200,
  headers: { "content-type": "application/json" }
});
window.fetch = globalThis.fetch;

const bundle = readdirSync(new URL("../dist/assets/", import.meta.url))
  .find(file => /^index-.*\.js$/.test(file));
assert.ok(bundle, "o build precisa gerar um bundle principal");
await import(new URL(`../dist/assets/${bundle}`, import.meta.url).href);
await new Promise(resolve => setTimeout(resolve, 30));

const app = document.querySelector("#app");
assert.ok(app.querySelector(".prematch-screen"), "deve iniciar na preparação");
assert.ok(app.querySelector(".matchday-scene"), "deve iniciar no hub de Matchday");
assert.match(app.textContent, /Matchweek 9/);
assert.match(app.textContent, /Stamford Bridge/);
assert.equal(app.textContent.includes("[object Object]"), false, "não deve vazar objetos na interface");
assert.match(app.textContent, /Man United/);

function click(selector) {
  const element = app.querySelector(selector);
  assert.ok(element, `elemento ausente: ${selector}`);
  element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

click('[data-action="prematch-tab"][data-tab="lineup"]');
assert.ok(app.querySelector(".squad-scene"));
assert.equal(app.querySelectorAll(".squad-player").length, 25, "deve mostrar o elenco completo");
assert.equal(app.querySelectorAll("[data-drag-player]").length, 11, "deve expor 11 peças arrastáveis");

const starter = app.querySelector(".squad-player.starter");
const reserve = app.querySelector(".squad-player:not(.starter)");
assert.ok(starter && reserve);
starter.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const reserveAfterRender = [...app.querySelectorAll(".squad-player")]
  .find(row => row.dataset.playerId === reserve.dataset.playerId);
reserveAfterRender.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
assert.equal(
  app.querySelector(`.squad-player[data-player-id="${reserve.dataset.playerId}"]`).classList.contains("starter"),
  true,
  "a troca de escalação precisa alterar o XI"
);

click('[data-action="prematch-tab"][data-tab="formation"]');
assert.ok(app.querySelector(".formation-scene"));
assert.equal(app.querySelectorAll(".formation-card").length, 4);
click('.formation-card[data-value="4-3-3"]');
assert.match(app.querySelector(".formation-scene").textContent, /4–3–3|4-3-3/);

const tacticalPitch = app.querySelector('[data-tactical-pitch="true"]');
const dragPiece = app.querySelector("[data-drag-player]");
assert.ok(tacticalPitch && dragPiece);
tacticalPitch.getBoundingClientRect = () => ({
  x: 100,
  y: 100,
  top: 100,
  left: 100,
  right: 1000,
  bottom: 600,
  width: 900,
  height: 500
});
const pointer = (type, x, y) => new window.PointerEvent(type, {
  bubbles: true,
  pointerId: 1,
  button: 0,
  clientX: x,
  clientY: y
});
dragPiece.dispatchEvent(pointer("pointerdown", 180, 350));
app.dispatchEvent(pointer("pointermove", 340, 360));
app.dispatchEvent(pointer("pointerup", 340, 360));
assert.ok(app.querySelector(".lineup-piece.custom-position"), "o arraste deve persistir posição personalizada");

click('[data-action="prematch-tab"][data-tab="roles"]');
assert.ok(app.querySelector(".roles-scene"));
assert.equal(app.querySelectorAll(".player-selector-strip button").length, 11);
assert.ok(app.querySelectorAll(".role-choice").length >= 1);

click('[data-action="prematch-tab"][data-tab="instructions"]');
assert.ok(app.querySelector(".instructions-scene"));
assert.equal(app.querySelectorAll('[data-action="apply-tactic-preset"]').length, 3);

click('[data-action="prematch-tab"][data-tab="opponent"]');
assert.ok(app.querySelector(".opponent-scene"));
assert.equal(app.textContent.includes("[object Object]"), false);
assert.match(app.textContent, /Palmer|Caicedo/);

click('[data-action="open-confirmation"]');
assert.ok(app.querySelector('[aria-labelledby="confirmation-title"]'));
click('[data-action="start-match"]');
assert.ok(app.querySelector(".match-screen"), "deve entrar na partida sem reload");
assert.ok(app.querySelector("#pitch-canvas"));
assert.match(app.textContent, /Área técnica/);

click('[data-action="open-surface"][data-surface="tactics"]');
assert.ok(app.querySelector('[aria-labelledby="live-tactics-title"]'));
click('[data-action="close-surface"]');
click('[data-action="open-surface"][data-surface="substitutions"]');
assert.ok(app.querySelector('[aria-labelledby="sub-title"]'));
assert.ok(app.querySelectorAll('[data-action="select-sub-out"]').length >= 10);
assert.ok(app.querySelectorAll('[data-action="select-sub-in"]').length >= 10);
click('[data-action="close-surface"]');
click('[data-action="open-surface"][data-surface="data"]');
assert.ok(app.querySelector(".bottom-sheet"));
click('[data-action="data-tab"][data-tab="timeline"]');
assert.match(app.textContent, /partida começou|eventos estruturados/i);

console.log(JSON.stringify({
  ok: true,
  viewport: `${viewportWidth}x${viewportHeight}`,
  rosterPlayers: 25,
  draggablePlayers: 11,
  scenes: 6,
  matchCanvas: true,
  technicalArea: true,
  substitutions: true,
  matchData: true
}, null, 2));
