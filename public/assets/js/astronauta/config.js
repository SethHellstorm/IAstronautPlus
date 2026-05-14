export const APP_BASE = String(window.APP_BASE || "").replace(/\/$/, "");

export const ENDPOINT = `${APP_BASE}/actions/chat-astronauta.php`;
export const BG_IMAGE = `${APP_BASE}/assets/img/universe-vr.jpg`;

export const MAX_BUBBLES = 20;

// Panel (Canvas2D -> textura Three)
export const PANEL_CANVAS_W = 1400;
export const PANEL_CANVAS_H = 1120;

// Distancia del panel al usuario (zoom)
export const PANEL_DISTANCE_DEFAULT = 1.85;
export const PANEL_DISTANCE_MIN = 0.7;
export const PANEL_DISTANCE_MAX = 3.5;

// Hand pinch thresholds
export const PINCH_ON  = 0.03;
export const PINCH_OFF = 0.04;

// Sprites flotantes
export const FLOATING_ASSETS = [
  { id: "astronaut", url: `${APP_BASE}/assets/img/astronaut.png`, size: 0.95, radius: 2.15, height: 1.55, speed: 0.10, bobAmp: 0.09, bobSpeed: 0.85, phase: 0.0, opacity: 1.0 },
  { id: "planet1",   url: `${APP_BASE}/assets/img/planet1.png`,   size: 1.25, radius: 3.70, height: -1.20, speed: -0.15, bobAmp: 0.03, bobSpeed: 0.55, phase: 1.05, opacity: 1.0 },
  { id: "moon",      url: `${APP_BASE}/assets/img/moon.png`,      size: 0.55, radius: 3.10, height: 2.05, speed: 0.075, bobAmp: 0.06, bobSpeed: 1.0,  phase: 2.10, opacity: 1.0 },
  { id: "satellite", url: `${APP_BASE}/assets/img/satellite.png`, size: 1.50, radius: 2.85, height: 3.00, speed: -0.35, bobAmp: 0.035, bobSpeed: 1.35, phase: 3.14, opacity: 0.98 },
  { id: "planet2",   url: `${APP_BASE}/assets/img/planet2.png`,   size: 5.10, radius: 4.25, height: 1.55, speed: 0.005, bobAmp: 0.025, bobSpeed: 0.50, phase: 4.19, opacity: 1.0 },
  { id: "asteroid",  url: `${APP_BASE}/assets/img/asteroid.png`,  size: 0.48, radius: 2.55, height: -1.35, speed: -0.20, bobAmp: 0.05,  bobSpeed: 1.55, phase: 5.24, opacity: 1.0 },
];

// Astronauta anclado al panel
export const ASTRONAUT_SIDE_OFFSET = { x: -1.22, y: 0.08, z: 0.04 };
export const ASTRONAUT_SCALE_MULT = 1.0;

// Hit-zones en coordenadas de canvas
export const HIT_ZONES = Object.freeze({
  exit:     { x: 48,   y: 42,   w: 230,  h: 80 },
  recenter: { x: 900,  y: 42,   w: 352,  h: 80 },
  header:   { x: 18,   y: 18,   w: 1364, h: 140 },
  grab:     { x: 1275, y: 42,   w: 80,   h: 80 },
  talk:     { x: 48,   y: 984,  w: 1304, h: 96 },
  chat:     { x: 48,   y: 148,  w: 1304, h: 816 },
});
