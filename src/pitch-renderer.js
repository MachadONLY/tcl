const TAU = Math.PI * 2;
const EVENT_LABEL_DURATION = 3400;
const MAX_DPR = 2;

const DEFAULT_PALETTES = [
  {
    primary: "#184785",
    light: "#4f79b2",
    dark: "#0d2b57",
    goalkeeper: "#d3a83b"
  },
  {
    primary: "#c63f43",
    light: "#e06b6e",
    dark: "#7e2428",
    goalkeeper: "#3d9d82"
  }
];

const LABEL_EVENTS = new Set([
  "goal",
  "shotOnTarget",
  "yellowCard",
  "redCard",
  "injury",
  "substitution"
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function seededUnit(index, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function hexShade(color, amount) {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const value = Number.parseInt(color.slice(1), 16);
  const red = clamp((value >> 16) + amount, 0, 255);
  const green = clamp(((value >> 8) & 255) + amount, 0, 255);
  const blue = clamp((value & 255) + amount, 0, 255);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPolygon(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
}

function playerName(playerState) {
  return String(
    playerState?.player?.name ??
    playerState?.name ??
    playerState?.fullName ??
    "Jogador"
  );
}

function playerNumber(playerState, fallback) {
  return playerState?.player?.shirtNumber ??
    playerState?.shirtNumber ??
    playerState?.number ??
    fallback;
}

function compactName(name, maxLength = 24) {
  if (name.length <= maxLength) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    const shortened = `${parts[0][0]}. ${parts.at(-1)}`;
    if (shortened.length <= maxLength) return shortened;
  }
  return `${name.slice(0, maxLength - 1).trim()}…`;
}

function resolveExplicitPalette(teamState) {
  const team = teamState?.team ?? teamState ?? {};
  const palette = teamState?.palette ?? team.palette ?? team.colors;
  if (palette && typeof palette === "object" && !Array.isArray(palette)) {
    const primary = palette.primary ?? palette.main ?? palette.home;
    if (primary) {
      return {
        primary,
        light: palette.light ?? hexShade(primary, 42),
        dark: palette.dark ?? hexShade(primary, -54),
        goalkeeper: palette.goalkeeper
      };
    }
  }
  if (Array.isArray(palette) && palette[0]) {
    return {
      primary: palette[0],
      light: palette[1] ?? hexShade(palette[0], 42),
      dark: palette[2] ?? hexShade(palette[0], -54),
      goalkeeper: palette[3]
    };
  }
  return null;
}

/**
 * Canvas renderer for MatchEngine snapshots.
 *
 * Supported integration styles:
 *   renderer.start(engine)
 *   renderer.start(() => engine.getSnapshot())
 *   renderer.render(engine.getSnapshot())
 *   renderer.setSnapshot(snapshot)
 */
export class PitchRenderer {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("PitchRenderer requires a canvas element.");
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!this.ctx) throw new Error("Canvas 2D is not available.");

    const ownerDocument = canvas.ownerDocument ?? globalThis.document;
    this.staticCanvas = ownerDocument?.createElement?.("canvas") ?? null;
    this.staticCtx = this.staticCanvas?.getContext("2d", { alpha: false }) ?? null;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.geometry = null;
    this.source = null;
    this.snapshot = null;
    this.running = false;
    this.frameRequest = 0;
    this.lastFrameAt = 0;
    this.lastEventKey = null;
    this.eventHighlight = null;
    this.hoverKey = null;
    this.focusKey = null;
    this.canvasHasFocus = false;
    this.visualPlayers = new Map();
    this.renderEntries = [];
    this.hitPlayers = [];
    this.ballTrail = [];
    this.lastBallPoint = null;

    this._frame = this._frame.bind(this);
    this._handleResize = this.resize.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleFocus = this._handleFocus.bind(this);
    this._handleBlur = this._handleBlur.bind(this);

    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "application");
    if (!canvas.hasAttribute("aria-label")) {
      canvas.setAttribute(
        "aria-label",
        "Campo tático da partida. Use as setas para percorrer os jogadores."
      );
    }

    canvas.addEventListener("pointermove", this._handlePointerMove);
    canvas.addEventListener("pointerleave", this._handlePointerLeave);
    canvas.addEventListener("pointerdown", this._handlePointerDown);
    canvas.addEventListener("keydown", this._handleKeyDown);
    canvas.addEventListener("focus", this._handleFocus);
    canvas.addEventListener("blur", this._handleBlur);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this._handleResize);
      this.resizeObserver.observe(canvas);
    } else {
      globalThis.addEventListener?.("resize", this._handleResize);
    }

    this.resize(true);
  }

  setSource(source) {
    this.source = source;
    const snapshot = this._resolveSnapshot(source);
    if (snapshot) this.snapshot = snapshot;
    return this;
  }

  connect(source, { autoStart = true } = {}) {
    this.setSource(source);
    if (autoStart) this.start();
    return this;
  }

  setSnapshot(snapshot) {
    this.snapshot = snapshot?.state?.teams ? snapshot.state : snapshot;
    this._observeLatestEvent(this.snapshot, nowMs());
    if (!this.running) this.render();
    return this;
  }

  start(source) {
    if (source !== undefined) this.setSource(source);
    if (this.running) return this;
    this.running = true;
    this.lastFrameAt = nowMs();
    this.frameRequest = this._requestFrame(this._frame);
    return this;
  }

  stop() {
    this.running = false;
    if (this.frameRequest) this._cancelFrame(this.frameRequest);
    this.frameRequest = 0;
    return this;
  }

  destroy() {
    this.stop();
    this.resizeObserver?.disconnect();
    globalThis.removeEventListener?.("resize", this._handleResize);
    this.canvas.removeEventListener("pointermove", this._handlePointerMove);
    this.canvas.removeEventListener("pointerleave", this._handlePointerLeave);
    this.canvas.removeEventListener("pointerdown", this._handlePointerDown);
    this.canvas.removeEventListener("keydown", this._handleKeyDown);
    this.canvas.removeEventListener("focus", this._handleFocus);
    this.canvas.removeEventListener("blur", this._handleBlur);
    this.visualPlayers.clear();
    this.hitPlayers.length = 0;
    this.ballTrail.length = 0;
  }

  resize(force = false) {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 960));
    const cssHeight = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 540));
    const dpr = clamp(finite(globalThis.devicePixelRatio, 1), 1, MAX_DPR);

    if (!force && cssWidth === this.width && cssHeight === this.height && dpr === this.dpr) {
      return false;
    }

    this.width = cssWidth;
    this.height = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;

    if (this.staticCanvas && this.staticCtx) {
      this.staticCanvas.width = Math.round(cssWidth * dpr);
      this.staticCanvas.height = Math.round(cssHeight * dpr);
      this.staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.staticCtx.imageSmoothingEnabled = true;
    }

    this._computeGeometry();
    this._buildStaticScene();
    if (!this.running) this.render();
    return true;
  }

  render(snapshotOrSource, deltaSeconds) {
    if (!this.width || !this.height) return this;

    let snapshot;
    if (snapshotOrSource !== undefined) {
      snapshot = this._resolveSnapshot(snapshotOrSource);
      if (snapshotOrSource?.getSnapshot || typeof snapshotOrSource === "function") {
        this.source = snapshotOrSource;
      }
      if (snapshot) this.snapshot = snapshot;
    } else {
      snapshot = this._resolveSnapshot(this.source) ?? this.snapshot;
      if (snapshot) this.snapshot = snapshot;
    }

    const timestamp = nowMs();
    const delta = clamp(
      finite(deltaSeconds, this.lastFrameAt ? (timestamp - this.lastFrameAt) / 1000 : 1 / 60),
      0,
      0.08
    );
    this.lastFrameAt = timestamp;

    this._observeLatestEvent(snapshot, timestamp);
    const entries = this._normalisePlayers(snapshot, timestamp);
    const renderPlayers = this._updateVisualPlayers(entries, delta);
    this.renderEntries = renderPlayers;
    this._updateBallTrail(snapshot?.ball, timestamp);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.staticCanvas) {
      ctx.drawImage(this.staticCanvas, 0, 0, this.width, this.height);
    } else {
      this._drawStaticScene(ctx);
    }

    this._drawBallTrail(ctx, timestamp);
    this.hitPlayers.length = 0;

    const ballEntry = this._normaliseBall(snapshot?.ball);
    const drawables = renderPlayers.map(entry => ({
      type: "player",
      depth: this.project(entry.visualX, entry.visualY).depth,
      entry
    }));
    if (ballEntry) {
      drawables.push({
        type: "ball",
        depth: this.project(ballEntry.x, ballEntry.y).depth + 0.002,
        entry: ballEntry
      });
    }
    drawables.sort((left, right) => left.depth - right.depth);

    for (const drawable of drawables) {
      if (drawable.type === "player") this._drawPlayer(ctx, drawable.entry, timestamp);
      else this._drawBall(ctx, drawable.entry);
    }

    this._drawActiveLabels(ctx, renderPlayers, timestamp);
    return this;
  }

  setHighlight(playerId, { teamIndex = null, duration = EVENT_LABEL_DURATION } = {}) {
    if (playerId == null) return this;
    this.eventHighlight = {
      key: teamIndex == null ? null : `${teamIndex}:${playerId}`,
      playerId: String(playerId),
      teamIndex,
      type: "manual",
      until: nowMs() + duration
    };
    if (!this.running) this.render();
    return this;
  }

  getHoveredPlayer() {
    const entry = this.renderEntries.find(player => player.key === this.hoverKey);
    if (!entry) return null;
    return {
      id: entry.id,
      teamIndex: entry.teamIndex,
      playerState: entry.raw,
      player: entry.raw?.player ?? entry.raw
    };
  }

  project(x, y, z = 0) {
    const geometry = this.geometry;
    if (!geometry) return { x: 0, y: 0, groundY: 0, scale: 1, depth: 0 };

    const pitchY = clamp(finite(y, 0.5), 0, 1);
    const perspective = Math.pow(pitchY, 1.075);
    const left = lerp(geometry.farLeft, geometry.nearLeft, perspective);
    const right = lerp(geometry.farRight, geometry.nearRight, perspective);
    const groundY = lerp(geometry.farY, geometry.nearY, perspective);
    const scale = lerp(0.68, 1.18, perspective);
    const lift = finite(z, 0) * geometry.pitchHeight * 1.42;

    return {
      x: lerp(left, right, finite(x, 0.5)),
      y: groundY - lift,
      groundY,
      scale,
      depth: perspective
    };
  }

  _frame(timestamp) {
    if (!this.running) return;
    const delta = clamp((timestamp - this.lastFrameAt) / 1000, 0, 0.08);
    this.render(undefined, delta);
    this.frameRequest = this._requestFrame(this._frame);
  }

  _requestFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback);
    }
    return globalThis.setTimeout(() => callback(nowMs()), 16);
  }

  _cancelFrame(handle) {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(handle);
    } else {
      globalThis.clearTimeout(handle);
    }
  }

  _resolveSnapshot(source) {
    if (!source) return null;
    if (typeof source === "function") return this._resolveSnapshot(source());
    if (typeof source.getSnapshot === "function") return source.getSnapshot();
    if (source.state?.teams) return source.state;
    return source;
  }

  _computeGeometry() {
    const side = clamp(this.width * 0.032, 12, 52);
    const inset = clamp(this.width * 0.09, 48, 164);
    const farY = clamp(this.height * 0.205, 70, 160);
    const nearY = this.height - clamp(this.height * 0.058, 22, 54);

    this.geometry = {
      farLeft: side + inset,
      farRight: this.width - side - inset,
      nearLeft: side,
      nearRight: this.width - side,
      farY,
      nearY,
      pitchHeight: Math.max(1, nearY - farY)
    };
  }

  _buildStaticScene() {
    if (!this.staticCtx) return;
    const ctx = this.staticCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this._drawStaticScene(ctx);
  }

  _drawStaticScene(ctx) {
    this._drawBackdrop(ctx);
    this._drawGrandstand(ctx);
    this._drawPitchApron(ctx);
    this._drawPitchSurface(ctx);
    this._drawPitchMarkings(ctx);
    this._drawGoals(ctx);
    this._drawForegroundEdge(ctx);
  }

  _drawBackdrop(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#0c100d");
    gradient.addColorStop(0.48, "#172019");
    gradient.addColorStop(1, "#263128");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    const light = ctx.createRadialGradient(
      this.width * 0.5,
      this.geometry.farY * 0.82,
      2,
      this.width * 0.5,
      this.geometry.farY * 0.8,
      this.width * 0.54
    );
    light.addColorStop(0, "rgba(222,230,216,.12)");
    light.addColorStop(0.55, "rgba(222,230,216,.025)");
    light.addColorStop(1, "rgba(222,230,216,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, this.width, this.geometry.farY * 1.4);
  }

  _drawGrandstand(ctx) {
    const { farLeft, farRight, farY } = this.geometry;
    const standTop = Math.max(8, farY * 0.08);
    const stand = [
      { x: Math.max(0, farLeft - this.width * 0.18), y: standTop },
      { x: Math.min(this.width, farRight + this.width * 0.18), y: standTop },
      { x: Math.min(this.width, farRight + this.width * 0.11), y: farY - 8 },
      { x: Math.max(0, farLeft - this.width * 0.11), y: farY - 8 }
    ];

    drawPolygon(ctx, stand);
    const standGradient = ctx.createLinearGradient(0, standTop, 0, farY);
    standGradient.addColorStop(0, "#101511");
    standGradient.addColorStop(1, "#202a22");
    ctx.fillStyle = standGradient;
    ctx.fill();

    ctx.save();
    drawPolygon(ctx, stand);
    ctx.clip();

    const rowCount = 8;
    for (let row = 0; row < rowCount; row += 1) {
      const y = lerp(standTop + 12, farY - 14, row / (rowCount - 1));
      ctx.strokeStyle = row % 2
        ? "rgba(227,232,222,.045)"
        : "rgba(0,0,0,.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    const crowdCount = Math.round(clamp(this.width / 5, 170, 390));
    for (let index = 0; index < crowdCount; index += 1) {
      const x = seededUnit(index, 1) * this.width;
      const y = lerp(standTop + 7, farY - 13, seededUnit(index, 2));
      const radius = 0.55 + seededUnit(index, 3) * 1.15;
      const colorRoll = seededUnit(index, 4);
      ctx.fillStyle = colorRoll > 0.92
        ? "rgba(103,166,51,.24)"
        : colorRoll > 0.72
          ? "rgba(218,221,214,.17)"
          : "rgba(98,110,99,.2)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const tunnelWidth = clamp(this.width * 0.056, 48, 96);
    const tunnelHeight = clamp(farY * 0.38, 28, 62);
    const tunnelX = this.width / 2 - tunnelWidth / 2;
    const tunnelY = farY - tunnelHeight - 8;
    ctx.fillStyle = "#080b09";
    roundedRect(ctx, tunnelX, tunnelY, tunnelWidth, tunnelHeight + 8, 4);
    ctx.fill();
    const tunnelLight = ctx.createLinearGradient(0, tunnelY, 0, farY);
    tunnelLight.addColorStop(0, "rgba(238,239,225,.02)");
    tunnelLight.addColorStop(1, "rgba(238,239,225,.18)");
    ctx.fillStyle = tunnelLight;
    roundedRect(ctx, tunnelX + tunnelWidth * 0.24, tunnelY + 5, tunnelWidth * 0.52, tunnelHeight, 2);
    ctx.fill();

    const boardTop = farY - clamp(this.height * 0.018, 8, 16);
    ctx.fillStyle = "#171d18";
    ctx.fillRect(farLeft - 22, boardTop, farRight - farLeft + 44, farY - boardTop + 5);
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(farLeft - 18, boardTop + 1);
    ctx.lineTo(farRight + 18, boardTop + 1);
    ctx.stroke();
  }

  _drawPitchApron(ctx) {
    const farLeft = this.project(0, 0);
    const farRight = this.project(1, 0);
    const nearLeft = this.project(0, 1);
    const nearRight = this.project(1, 1);

    ctx.fillStyle = "#263c28";
    drawPolygon(ctx, [
      { x: Math.max(0, nearLeft.x - 24), y: nearLeft.y - 3 },
      { x: Math.min(this.width, nearRight.x + 24), y: nearRight.y - 3 },
      { x: this.width, y: this.height },
      { x: 0, y: this.height }
    ]);
    ctx.fill();

    ctx.fillStyle = "#19271b";
    drawPolygon(ctx, [
      { x: Math.max(0, farLeft.x - 14), y: farLeft.y },
      nearLeft,
      { x: Math.max(0, nearLeft.x - 14), y: nearLeft.y + 7 },
      { x: Math.max(0, farLeft.x - 7), y: farLeft.y + 3 }
    ]);
    ctx.fill();
    drawPolygon(ctx, [
      farRight,
      { x: Math.min(this.width, farRight.x + 14), y: farRight.y },
      { x: Math.min(this.width, nearRight.x + 14), y: nearRight.y + 7 },
      nearRight
    ]);
    ctx.fill();
  }

  _drawPitchSurface(ctx) {
    const pitch = [
      this.project(0, 0),
      this.project(1, 0),
      this.project(1, 1),
      this.project(0, 1)
    ];

    ctx.save();
    drawPolygon(ctx, pitch);
    ctx.clip();

    const grass = ctx.createLinearGradient(0, this.geometry.farY, 0, this.geometry.nearY);
    grass.addColorStop(0, "#477d39");
    grass.addColorStop(0.52, "#4d873d");
    grass.addColorStop(1, "#406f35");
    ctx.fillStyle = grass;
    ctx.fillRect(0, this.geometry.farY, this.width, this.geometry.pitchHeight);

    const stripeCount = 14;
    for (let index = 0; index < stripeCount; index += 1) {
      const x0 = index / stripeCount;
      const x1 = (index + 1) / stripeCount;
      drawPolygon(ctx, [
        this.project(x0, 0),
        this.project(x1, 0),
        this.project(x1, 1),
        this.project(x0, 1)
      ]);
      ctx.fillStyle = index % 2
        ? "rgba(255,255,255,.026)"
        : "rgba(9,38,12,.045)";
      ctx.fill();
    }

    for (let band = 0; band < 5; band += 1) {
      const y0 = band / 5;
      const y1 = (band + 1) / 5;
      drawPolygon(ctx, [
        this.project(0, y0),
        this.project(1, y0),
        this.project(1, y1),
        this.project(0, y1)
      ]);
      ctx.fillStyle = band % 2
        ? "rgba(240,248,233,.011)"
        : "rgba(0,16,1,.014)";
      ctx.fill();
    }

    const textureCount = Math.round(clamp(this.width / 7, 110, 260));
    for (let index = 0; index < textureCount; index += 1) {
      const x = seededUnit(index, 8);
      const y = seededUnit(index, 9);
      const point = this.project(x, y);
      ctx.strokeStyle = seededUnit(index, 10) > 0.52
        ? "rgba(230,239,220,.045)"
        : "rgba(10,42,13,.055)";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + point.scale * 2.4, point.y + point.scale * 0.28);
      ctx.stroke();
    }

    const farShade = ctx.createLinearGradient(0, this.geometry.farY, 0, this.geometry.nearY);
    farShade.addColorStop(0, "rgba(4,13,5,.23)");
    farShade.addColorStop(0.16, "rgba(4,13,5,.035)");
    farShade.addColorStop(0.8, "rgba(255,255,255,0)");
    farShade.addColorStop(1, "rgba(3,15,4,.08)");
    ctx.fillStyle = farShade;
    ctx.fillRect(0, this.geometry.farY, this.width, this.geometry.pitchHeight);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.2)";
    ctx.lineWidth = 1;
    drawPolygon(ctx, pitch);
    ctx.stroke();
  }

  _drawPitchMarkings(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(246,248,239,.84)";
    ctx.fillStyle = "rgba(246,248,239,.88)";
    ctx.lineWidth = clamp(this.width / 950, 1.05, 1.8);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    this._pitchPolyline(ctx, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0]
    ]);
    this._pitchPolyline(ctx, [[0.5, 0], [0.5, 1]]);

    this._pitchCircle(ctx, 0.5, 0.5, 0.0872, 0.1346);
    this._pitchDot(ctx, 0.5, 0.5, 1.8);

    this._pitchPolyline(ctx, [
      [0, 0.2035],
      [0.1571, 0.2035],
      [0.1571, 0.7965],
      [0, 0.7965]
    ]);
    this._pitchPolyline(ctx, [
      [1, 0.2035],
      [0.8429, 0.2035],
      [0.8429, 0.7965],
      [1, 0.7965]
    ]);

    this._pitchPolyline(ctx, [
      [0, 0.365],
      [0.0524, 0.365],
      [0.0524, 0.635],
      [0, 0.635]
    ]);
    this._pitchPolyline(ctx, [
      [1, 0.365],
      [0.9476, 0.365],
      [0.9476, 0.635],
      [1, 0.635]
    ]);

    this._pitchDot(ctx, 0.1048, 0.5, 1.65);
    this._pitchDot(ctx, 0.8952, 0.5, 1.65);
    this._pitchFilteredCircle(ctx, 0.1048, 0.5, 0.0872, 0.1346, point => point[0] >= 0.1571);
    this._pitchFilteredCircle(ctx, 0.8952, 0.5, 0.0872, 0.1346, point => point[0] <= 0.8429);

    this._cornerArc(ctx, 0, 0, 1, 1);
    this._cornerArc(ctx, 0, 1, 1, -1);
    this._cornerArc(ctx, 1, 0, -1, 1);
    this._cornerArc(ctx, 1, 1, -1, -1);
    ctx.restore();
  }

  _drawGoals(ctx) {
    this._drawGoal(ctx, 0);
    this._drawGoal(ctx, 1);
  }

  _drawGoal(ctx, side) {
    const direction = side === 0 ? -1 : 1;
    const frontNear = this.project(side, 0.635);
    const frontFar = this.project(side, 0.365);
    const depth = clamp(this.width * 0.013, 10, 21);
    const rise = clamp(this.height * 0.012, 5, 11);
    const backNear = { x: frontNear.x + direction * depth, y: frontNear.y - rise };
    const backFar = { x: frontFar.x + direction * depth, y: frontFar.y - rise };

    ctx.save();
    ctx.strokeStyle = "rgba(239,242,233,.76)";
    ctx.lineWidth = clamp(this.width / 850, 1.15, 2);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(frontFar.x, frontFar.y);
    ctx.lineTo(backFar.x, backFar.y);
    ctx.lineTo(backNear.x, backNear.y);
    ctx.lineTo(frontNear.x, frontNear.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(232,236,226,.24)";
    ctx.lineWidth = 0.7;
    const meshLines = 5;
    for (let index = 1; index < meshLines; index += 1) {
      const amount = index / meshLines;
      ctx.beginPath();
      ctx.moveTo(
        lerp(frontFar.x, frontNear.x, amount),
        lerp(frontFar.y, frontNear.y, amount)
      );
      ctx.lineTo(
        lerp(backFar.x, backNear.x, amount),
        lerp(backFar.y, backNear.y, amount)
      );
      ctx.stroke();
    }
    for (let index = 1; index < 4; index += 1) {
      const amount = index / 4;
      ctx.beginPath();
      ctx.moveTo(
        lerp(frontFar.x, backFar.x, amount),
        lerp(frontFar.y, backFar.y, amount)
      );
      ctx.lineTo(
        lerp(frontNear.x, backNear.x, amount),
        lerp(frontNear.y, backNear.y, amount)
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawForegroundEdge(ctx) {
    const left = this.project(0, 1);
    const right = this.project(1, 1);
    const edgeHeight = clamp(this.height * 0.026, 10, 23);
    const gradient = ctx.createLinearGradient(0, left.y, 0, left.y + edgeHeight);
    gradient.addColorStop(0, "rgba(7,18,8,.5)");
    gradient.addColorStop(1, "rgba(5,10,6,.88)");
    ctx.fillStyle = gradient;
    ctx.fillRect(left.x, left.y + 2, right.x - left.x, edgeHeight);

    ctx.strokeStyle = "rgba(233,238,229,.13)";
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.width * 0.37, left.y + edgeHeight * 0.62);
    ctx.lineTo(this.width * 0.63, left.y + edgeHeight * 0.62);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _pitchPolyline(ctx, coordinates) {
    if (!coordinates.length) return;
    const first = this.project(coordinates[0][0], coordinates[0][1]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < coordinates.length; index += 1) {
      const point = this.project(coordinates[index][0], coordinates[index][1]);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  _pitchCircle(ctx, centerX, centerY, radiusX, radiusY) {
    ctx.beginPath();
    for (let index = 0; index <= 64; index += 1) {
      const angle = index / 64 * TAU;
      const point = this.project(
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      );
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  _pitchFilteredCircle(ctx, centerX, centerY, radiusX, radiusY, predicate) {
    ctx.beginPath();
    let drawing = false;
    for (let index = 0; index <= 80; index += 1) {
      const angle = index / 80 * TAU;
      const coordinate = [
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      ];
      const point = this.project(coordinate[0], coordinate[1]);
      if (predicate(coordinate)) {
        if (!drawing) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
        drawing = true;
      } else {
        drawing = false;
      }
    }
    ctx.stroke();
  }

  _pitchDot(ctx, x, y, radius) {
    const point = this.project(x, y);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * point.scale, 0, TAU);
    ctx.fill();
  }

  _cornerArc(ctx, x, y, directionX, directionY) {
    const radiusX = 0.0095;
    const radiusY = 0.0147;
    ctx.beginPath();
    for (let index = 0; index <= 16; index += 1) {
      const angle = index / 16 * Math.PI / 2;
      const point = this.project(
        x + Math.cos(angle) * radiusX * directionX,
        y + Math.sin(angle) * radiusY * directionY
      );
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  _normalisePlayers(snapshot, timestamp) {
    if (!snapshot) return [];
    const teams = Array.isArray(snapshot.teams) ? snapshot.teams : null;
    const entries = [];

    if (teams) {
      teams.forEach((teamState, teamIndex) => {
        const palette = this._resolveTeamPalette(teamState, teamIndex);
        const players = Array.isArray(teamState?.players) ? teamState.players : [];
        players.forEach((playerState, index) => {
          const id = playerState?.id ?? playerState?.player?.id ?? index;
          const key = `${teamIndex}:${id}`;
          const dismissed = Boolean(playerState?.redCard);
          const highlighted = this._isEventKeyActive(key, id, teamIndex, timestamp);
          if (dismissed && !highlighted) return;
          entries.push({
            key,
            id: String(id),
            teamIndex,
            teamState,
            raw: playerState,
            x: clamp(finite(playerState?.x, 0.5), 0, 1),
            y: clamp(finite(playerState?.y, 0.5), 0, 1),
            name: playerName(playerState),
            number: playerNumber(playerState, index + 1),
            role: playerState?.role ?? playerState?.position ?? "",
            palette,
            dismissed,
            injured: Boolean(playerState?.injured),
            yellowCards: finite(playerState?.yellowCards, 0),
            isCarrier: String(snapshot?.ball?.carrierId) === String(id)
          });
        });
      });
      return entries;
    }

    const flatPlayers = Array.isArray(snapshot.players) ? snapshot.players : [];
    flatPlayers.forEach((playerState, index) => {
      const teamIndex = finite(playerState.teamIndex ?? playerState.team, 0);
      const id = playerState.id ?? playerState.player?.id ?? index;
      const key = `${teamIndex}:${id}`;
      const palette = this._resolveTeamPalette(null, teamIndex);
      entries.push({
        key,
        id: String(id),
        teamIndex,
        raw: playerState,
        x: clamp(finite(playerState.x, 0.5), 0, 1),
        y: clamp(finite(playerState.y, 0.5), 0, 1),
        name: playerName(playerState),
        number: playerNumber(playerState, index % 11 + 1),
        role: playerState.role ?? "",
        palette,
        dismissed: Boolean(playerState.redCard),
        injured: Boolean(playerState.injured),
        yellowCards: finite(playerState.yellowCards, 0),
        isCarrier: String(snapshot?.ball?.carrierId ?? snapshot?.ball?.carrier) === String(id)
      });
    });
    return entries;
  }

  _resolveTeamPalette(teamState, teamIndex) {
    const explicit = resolveExplicitPalette(teamState);
    const fallback = DEFAULT_PALETTES[teamIndex % DEFAULT_PALETTES.length];
    return {
      primary: explicit?.primary ?? fallback.primary,
      light: explicit?.light ?? fallback.light,
      dark: explicit?.dark ?? fallback.dark,
      goalkeeper: explicit?.goalkeeper ?? fallback.goalkeeper
    };
  }

  _updateVisualPlayers(entries, delta) {
    const visibleKeys = new Set();
    const response = 1 - Math.exp(-delta * 14);

    for (const entry of entries) {
      visibleKeys.add(entry.key);
      let visual = this.visualPlayers.get(entry.key);
      if (!visual) {
        visual = { x: entry.x, y: entry.y };
        this.visualPlayers.set(entry.key, visual);
      }

      if (!entry.dismissed) {
        const distance = Math.hypot(entry.x - visual.x, entry.y - visual.y);
        if (distance > 0.62) {
          visual.x = entry.x;
          visual.y = entry.y;
        } else {
          visual.x = lerp(visual.x, entry.x, response);
          visual.y = lerp(visual.y, entry.y, response);
        }
      }

      entry.visualX = visual.x;
      entry.visualY = visual.y;
    }

    for (const key of this.visualPlayers.keys()) {
      if (!visibleKeys.has(key)) this.visualPlayers.delete(key);
    }
    return entries;
  }

  _normaliseBall(ball) {
    if (!ball) return null;
    return {
      x: clamp(finite(ball.x, 0.5), -0.04, 1.04),
      y: clamp(finite(ball.y, 0.5), -0.04, 1.04),
      z: clamp(finite(ball.z, 0), 0, 0.18),
      moving: Boolean(ball.moving ?? ball.pass)
    };
  }

  _updateBallTrail(ball, timestamp) {
    const normalised = this._normaliseBall(ball);
    this.ballTrail = this.ballTrail.filter(point => timestamp - point.at < 330);
    if (!normalised) {
      this.lastBallPoint = null;
      return;
    }

    const previous = this.lastBallPoint;
    const distance = previous
      ? Math.hypot(normalised.x - previous.x, normalised.y - previous.y)
      : 0;
    if (distance > 0.42) this.ballTrail.length = 0;

    if (
      normalised.moving &&
      (!previous || distance > 0.003 || Math.abs(normalised.z - previous.z) > 0.002)
    ) {
      this.ballTrail.push({ ...normalised, at: timestamp });
      if (this.ballTrail.length > 18) this.ballTrail.shift();
    }
    this.lastBallPoint = normalised;
  }

  _drawBallTrail(ctx, timestamp) {
    if (this.ballTrail.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    for (let index = 1; index < this.ballTrail.length; index += 1) {
      const from = this.ballTrail[index - 1];
      const to = this.ballTrail[index];
      const age = clamp(1 - (timestamp - to.at) / 330, 0, 1);
      const fromPoint = this.project(from.x, from.y, from.z);
      const toPoint = this.project(to.x, to.y, to.z);
      ctx.strokeStyle = `rgba(245,247,239,${age * 0.2})`;
      ctx.lineWidth = clamp(0.8 + toPoint.scale * 1.1, 1, 2.2);
      ctx.beginPath();
      ctx.moveTo(fromPoint.x, fromPoint.y);
      ctx.lineTo(toPoint.x, toPoint.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPlayer(ctx, entry, timestamp) {
    const point = this.project(entry.visualX, entry.visualY);
    const baseSize = clamp(Math.min(this.width, this.height) * 0.0145, 7.3, 12.8);
    const size = baseSize * point.scale;
    const isGoalkeeper = /^(GK|Goalkeeper)$/i.test(String(entry.role));
    const primary = isGoalkeeper ? entry.palette.goalkeeper : entry.palette.primary;
    const light = isGoalkeeper ? hexShade(primary, 40) : entry.palette.light;
    const dark = isGoalkeeper ? hexShade(primary, -52) : entry.palette.dark;
    const eventActive = this._isEventKeyActive(
      entry.key,
      entry.id,
      entry.teamIndex,
      timestamp
    );
    const alpha = entry.dismissed
      ? clamp((this.eventHighlight?.until - timestamp) / 900, 0.18, 0.78)
      : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "rgba(3,11,4,.3)";
    ctx.beginPath();
    ctx.ellipse(
      point.x + size * 0.46,
      point.y + size * 0.67,
      size * 1.08,
      size * 0.48,
      -0.13,
      0,
      TAU
    );
    ctx.fill();

    if (entry.isCarrier || eventActive) {
      const pulse = eventActive ? 1 + Math.sin(timestamp / 120) * 0.08 : 1;
      ctx.strokeStyle = eventActive
        ? "rgba(239,245,232,.94)"
        : "rgba(238,242,232,.7)";
      ctx.lineWidth = eventActive ? 1.8 : 1.25;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (size + 4.2) * pulse, 0, TAU);
      ctx.stroke();
    }

    const body = ctx.createRadialGradient(
      point.x - size * 0.38,
      point.y - size * 0.43,
      size * 0.08,
      point.x,
      point.y,
      size * 1.2
    );
    body.addColorStop(0, light);
    body.addColorStop(0.56, primary);
    body.addColorStop(1, dark);
    ctx.fillStyle = body;
    ctx.strokeStyle = "rgba(248,249,244,.94)";
    ctx.lineWidth = Math.max(1.25, size * 0.14);
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(250,250,246,.94)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, size * 0.47, 0, TAU);
    ctx.fill();

    const number = String(entry.number ?? "");
    ctx.fillStyle = dark;
    ctx.font = `760 ${Math.max(5.2, size * (number.length > 1 ? 0.48 : 0.56))}px "Manrope Variable", "Segoe UI Variable", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, point.x, point.y + 0.2);

    if (entry.yellowCards > 0) {
      ctx.fillStyle = "#f0c84b";
      roundedRect(
        ctx,
        point.x + size * 0.62,
        point.y - size * 0.94,
        Math.max(3, size * 0.31),
        Math.max(4.5, size * 0.46),
        0.8
      );
      ctx.fill();
    }

    if (entry.injured) {
      ctx.strokeStyle = "rgba(187,52,52,.94)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size + 2.2, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
    this.hitPlayers.push({
      key: entry.key,
      x: point.x,
      y: point.y,
      radius: Math.max(12, size * 1.45),
      depth: point.depth
    });
  }

  _drawBall(ctx, ball) {
    const ground = this.project(ball.x, ball.y);
    const point = this.project(ball.x, ball.y, ball.z);
    const radius = clamp(2.65 * ground.scale, 2.35, 4.6);
    const altitude = clamp(ball.z / 0.04, 0, 1);

    ctx.save();
    ctx.fillStyle = `rgba(3,9,3,${0.34 - altitude * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(
      ground.x + radius * 0.85,
      ground.y + radius * 0.94,
      radius * (1.34 + altitude * 0.2),
      radius * 0.57,
      -0.18,
      0,
      TAU
    );
    ctx.fill();

    const ballGradient = ctx.createRadialGradient(
      point.x - radius * 0.35,
      point.y - radius * 0.42,
      radius * 0.12,
      point.x,
      point.y,
      radius * 1.2
    );
    ballGradient.addColorStop(0, "#ffffff");
    ballGradient.addColorStop(0.72, "#f0f0e9");
    ballGradient.addColorStop(1, "#bfc1ba");
    ctx.fillStyle = ballGradient;
    ctx.strokeStyle = "rgba(27,31,27,.95)";
    ctx.lineWidth = Math.max(0.8, radius * 0.28);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#242824";
    ctx.beginPath();
    ctx.arc(
      point.x - radius * 0.18,
      point.y - radius * 0.16,
      radius * 0.26,
      0,
      TAU
    );
    ctx.fill();
    ctx.restore();
  }

  _drawActiveLabels(ctx, entries, timestamp) {
    const active = new Map();
    if (this.hoverKey) active.set(this.hoverKey, "hover");
    if (this.canvasHasFocus && this.focusKey) active.set(this.focusKey, "focus");

    if (this.eventHighlight && this.eventHighlight.until > timestamp) {
      const eventEntry = entries.find(entry =>
        this.eventHighlight.key
          ? entry.key === this.eventHighlight.key
          : entry.id === this.eventHighlight.playerId &&
            (this.eventHighlight.teamIndex == null ||
              entry.teamIndex === this.eventHighlight.teamIndex)
      );
      if (eventEntry) active.set(eventEntry.key, "event");
    }

    const labelled = entries
      .filter(entry => active.has(entry.key))
      .sort((left, right) => {
        const priority = { hover: 3, focus: 2, event: 4 };
        return priority[active.get(left.key)] - priority[active.get(right.key)];
      });

    for (const entry of labelled) {
      this._drawNameLabel(ctx, entry, active.get(entry.key));
    }
  }

  _drawNameLabel(ctx, entry, reason) {
    const point = this.project(entry.visualX, entry.visualY);
    const fontSize = clamp(this.width / 108, 10.5, 12.5);
    const name = compactName(entry.name);
    const suffix = reason === "event" && this.eventHighlight?.type === "goal"
      ? "  •  GOL"
      : "";
    const label = `${name}${suffix}`;

    ctx.save();
    ctx.font = `650 ${fontSize}px "Manrope Variable", "Segoe UI Variable", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const horizontalPadding = 10;
    const width = textWidth + horizontalPadding * 2;
    const height = fontSize + 10;
    let x = point.x - width / 2;
    let y = point.y - clamp(fontSize * 2.7, 28, 36);
    x = clamp(x, 7, this.width - width - 7);
    y = clamp(y, 7, this.height - height - 7);

    ctx.shadowColor = "rgba(0,0,0,.24)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = reason === "event"
      ? "rgba(21,25,20,.96)"
      : "rgba(18,22,18,.91)";
    roundedRect(ctx, x, y, width, height, 7);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = entry.palette.primary;
    roundedRect(ctx, x + 3, y + 4, 3, height - 8, 1.5);
    ctx.fill();

    ctx.fillStyle = "#f7f8f4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2 + 1, y + height / 2 + 0.2);
    ctx.restore();
  }

  _observeLatestEvent(snapshot, timestamp) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    if (!events.length) return;
    const latest = events.reduce((current, event) => {
      if (!current) return event;
      const currentId = finite(current.id, -Infinity);
      const eventId = finite(event.id, -Infinity);
      return eventId >= currentId ? event : current;
    }, null);
    if (!latest) return;

    const eventKey = latest.id != null
      ? String(latest.id)
      : `${latest.type}:${latest.minute}:${latest.teamIndex}:${latest.playerId}`;
    if (eventKey === this.lastEventKey) return;
    this.lastEventKey = eventKey;

    if (latest.playerId == null || !LABEL_EVENTS.has(latest.type)) return;
    const teamIndex = latest.teamIndex ?? latest.team;
    this.eventHighlight = {
      key: teamIndex == null ? null : `${teamIndex}:${latest.playerId}`,
      playerId: String(latest.playerId),
      teamIndex: teamIndex == null ? null : Number(teamIndex),
      type: latest.type,
      until: timestamp + EVENT_LABEL_DURATION
    };
  }

  _isEventKeyActive(key, playerId, teamIndex, timestamp) {
    const highlight = this.eventHighlight;
    if (!highlight || highlight.until <= timestamp) return false;
    if (highlight.key) return highlight.key === key;
    return highlight.playerId === String(playerId) &&
      (highlight.teamIndex == null || highlight.teamIndex === teamIndex);
  }

  _pointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  _hitTest(x, y) {
    let best = null;
    for (const hit of this.hitPlayers) {
      const distance = Math.hypot(x - hit.x, y - hit.y);
      if (distance > hit.radius) continue;
      if (!best || distance < best.distance || hit.depth > best.depth) {
        best = { ...hit, distance };
      }
    }
    return best;
  }

  _handlePointerMove(event) {
    const point = this._pointerPosition(event);
    const hit = this._hitTest(point.x, point.y);
    const nextKey = hit?.key ?? null;
    if (nextKey === this.hoverKey) return;
    this.hoverKey = nextKey;
    this.canvas.style.cursor = nextKey ? "pointer" : "default";
    if (!this.running) this.render();
  }

  _handlePointerLeave() {
    if (!this.hoverKey) return;
    this.hoverKey = null;
    this.canvas.style.cursor = "default";
    if (!this.running) this.render();
  }

  _handlePointerDown(event) {
    const point = this._pointerPosition(event);
    const hit = this._hitTest(point.x, point.y);
    if (!hit) return;
    this.focusKey = hit.key;
    this.canvas.focus({ preventScroll: true });
    if (!this.running) this.render();
  }

  _handleFocus() {
    this.canvasHasFocus = true;
    if (!this.focusKey) {
      this.focusKey = this.hitPlayers.find(hit => {
        const [teamIndex, id] = hit.key.split(":");
        return this.snapshot?.ball?.carrierId != null &&
          String(this.snapshot.ball.carrierId) === id &&
          teamIndex !== "";
      })?.key ?? this.hitPlayers[0]?.key ?? null;
    }
    if (!this.running) this.render();
  }

  _handleBlur() {
    this.canvasHasFocus = false;
    if (!this.running) this.render();
  }

  _handleKeyDown(event) {
    const navigationKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
    if (event.key === "Escape") {
      this.focusKey = null;
      if (!this.running) this.render();
      return;
    }
    if (!navigationKeys.has(event.key) || !this.hitPlayers.length) return;

    event.preventDefault();
    const ordered = [...this.hitPlayers].sort((left, right) => {
      if (Math.abs(left.x - right.x) > 12) return left.x - right.x;
      return left.y - right.y;
    });
    let index = ordered.findIndex(hit => hit.key === this.focusKey);
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = ordered.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      index = index <= 0 ? ordered.length - 1 : index - 1;
    } else {
      index = index < 0 || index >= ordered.length - 1 ? 0 : index + 1;
    }
    this.focusKey = ordered[index]?.key ?? null;
    if (!this.running) this.render();
  }
}

export default PitchRenderer;
