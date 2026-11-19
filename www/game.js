import * as THREE from './three.module.js';

// ===================== Configuración =====================
const CHUNK = 16;
const WX = 96, WZ = 96, WY = 40;           // tamaño del mundo en bloques
const NCX = WX / CHUNK, NCZ = WZ / CHUNK;
const CLAVE_GUARDADO = 'rgcubos_mundo_v1';
const ALCANCE = 6;                          // distancia máxima para picar/poner

// ===================== Bloques =====================
const AIRE = 0, BASE = 10;
const BLOQUES = {
  1:  { nombre: 'Pasto',    top: 0,  side: 1,  bottom: 2 },
  2:  { nombre: 'Tierra',   top: 2,  side: 2,  bottom: 2 },
  3:  { nombre: 'Piedra',   top: 3,  side: 3,  bottom: 3 },
  4:  { nombre: 'Tronco',   top: 5,  side: 4,  bottom: 5 },
  5:  { nombre: 'Hojas',    top: 6,  side: 6,  bottom: 6 },
  6:  { nombre: 'Arena',    top: 7,  side: 7,  bottom: 7 },
  7:  { nombre: 'Ladrillo', top: 8,  side: 8,  bottom: 8 },
  8:  { nombre: 'Tablas',   top: 9,  side: 9,  bottom: 9 },
  9:  { nombre: 'Nieve',    top: 10, side: 11, bottom: 2 },
  10: { nombre: 'Base',     top: 12, side: 12, bottom: 12 },
};
const BARRA = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ===================== Texturas procedurales =====================
const TILE = 16, COLS = 4, ROWS = 4;
const atlas = document.createElement('canvas');
atlas.width = TILE * COLS; atlas.height = TILE * ROWS;
const actx = atlas.getContext('2d');

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function pintarTile(i, fn) {
  const ox = (i % COLS) * TILE, oy = Math.floor(i / COLS) * TILE;
  const img = actx.createImageData(TILE, TILE);
  const r = rng(1234 + i * 77);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const c = fn(x, y, r);
    const k = (y * TILE + x) * 4;
    img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
  }
  actx.putImageData(img, ox, oy);
}
const var_ = (c, r, v) => { const d = (r() - 0.5) * v; return [c[0] + d, c[1] + d, c[2] + d]; };
const tierra = (x, y, r) => var_([134, 96, 67], r, 34);

pintarTile(0, (x, y, r) => var_([96, 160, 60], r, 36));                                       // pasto arriba
pintarTile(1, (x, y, r) => { const borde = 3 + ((x * 7 + 3) % 3); return y < borde ? var_([96, 160, 60], r, 30) : tierra(x, y, r); }); // pasto lado
pintarTile(2, tierra);                                                                         // tierra
pintarTile(3, (x, y, r) => var_(r() < 0.12 ? [100, 100, 104] : [132, 132, 136], r, 22));      // piedra
pintarTile(4, (x, y, r) => var_((x % 4 === 0) ? [84, 60, 34] : [110, 80, 46], r, 16));       // tronco lado
pintarTile(5, (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); return var_(Math.floor(d) % 3 === 0 ? [120, 90, 55] : [168, 132, 82], r, 14); }); // tronco arriba
pintarTile(6, (x, y, r) => var_(r() < 0.2 ? [40, 92, 30] : [60, 128, 44], r, 26));           // hojas
pintarTile(7, (x, y, r) => var_([219, 205, 150], r, 22));                                     // arena
pintarTile(8, (x, y, r) => { const fila = Math.floor(y / 4), off = fila % 2 ? 4 : 0; const mortero = y % 4 === 3 || (x + off) % 8 === 7; return mortero ? var_([190, 182, 170], r, 10) : var_([160, 62, 48], r, 24); }); // ladrillo
pintarTile(9, (x, y, r) => { const linea = y % 4 === 3 || (y % 8 < 4 ? x === 11 : x === 4) && y % 4 !== 3 && r() < 0.6; return linea ? var_([120, 88, 48], r, 10) : var_([186, 146, 92], r, 18); }); // tablas
pintarTile(10, (x, y, r) => var_([240, 246, 250], r, 12));                                    // nieve arriba
pintarTile(11, (x, y, r) => { const borde = 3 + ((x * 5 + 1) % 3); return y < borde ? var_([240, 246, 250], r, 12) : tierra(x, y, r); }); // nieve lado
pintarTile(12, (x, y, r) => var_(r() < 0.5 ? [40, 40, 42] : [90, 90, 94], r, 20));            // base

const textura = new THREE.CanvasTexture(atlas);
textura.magFilter = THREE.NearestFilter;
textura.minFilter = THREE.NearestFilter;
textura.colorSpace = THREE.SRGBColorSpace;
textura.generateMipmaps = false;

function iconoBloque(id) {
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const t = BLOQUES[id].side;
  c.getContext('2d').drawImage(atlas, (t % COLS) * TILE, Math.floor(t / COLS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  return c;
}

// ===================== Mundo =====================
const mundo = new Uint8Array(WX * WY * WZ);
const idx = (x, y, z) => (y * WZ + z) * WX + x;
const dentro = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < WX && y < WY && z < WZ;
const obtener = (x, y, z) => dentro(x, y, z) ? mundo[idx(x, y, z)] : AIRE;
function solidoColision(x, y, z) {
  if (y < 0) return true;
  if (x < 0 || z < 0 || x >= WX || z >= WZ) return true;   // muros invisibles
  if (y >= WY) return false;
  return mundo[idx(x, y, z)] !== AIRE;
}

function hacerRuido(seed) {
  const hash = (x, y) => {
    let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
  const suave = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = suave(x - xi), v = suave(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function generar(seed) {
  mundo.fill(0);
  const ruido = hacerRuido(seed);
  const r = rng(seed ^ 0x9e3779b9);
  const alturas = new Int16Array(WX * WZ);
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    let n = ruido(x / 40, z / 40) * 0.6 + ruido(x / 17 + 100, z / 17) * 0.3 + ruido(x / 7 + 200, z / 7) * 0.1;
    n = Math.pow(n, 1.35);
    const h = Math.max(3, Math.min(WY - 9, Math.floor(6 + n * 30)));
    alturas[z * WX + x] = h;
    const playa = h <= 9, alto = h >= 25;
    for (let y = 0; y <= h; y++) {
      let id;
      if (y === 0) id = BASE;
      else if (y < h - 3) id = 3;
      else if (y < h) id = playa ? 6 : 2;
      else id = playa ? 6 : alto ? 9 : 1;
      mundo[idx(x, y, z)] = id;
    }
  }
  // Árboles
  for (let z = 3; z < WZ - 3; z++) for (let x = 3; x < WX - 3; x++) {
    const h = alturas[z * WX + x];
    if (mundo[idx(x, h, z)] !== 1 || r() > 0.018) continue;
    const alto = 4 + Math.floor(r() * 2);
    for (let i = 1; i <= alto; i++) mundo[idx(x, h + i, z)] = 4;
    const cima = h + alto;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy >= 0 ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && r() < 0.6) continue;
        const X = x + dx, Y = cima + dy, Z = z + dz;
        if (dentro(X, Y, Z) && mundo[idx(X, Y, Z)] === AIRE) mundo[idx(X, Y, Z)] = 5;
      }
    }
    if (dentro(x, cima + 2, z)) mundo[idx(x, cima + 2, z)] = 5;
  }
}

// ===================== Malla por chunks =====================
const CARAS = [
  { dir: [-1, 0, 0], luz: 0.75, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0],  luz: 0.75, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], luz: 0.5,  c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0],  luz: 1.0,  c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], luz: 0.85, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1],  luz: 0.85, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO = [0.45, 0.65, 0.82, 1.0];
const EPS = 0.002;

const escena = new THREE.Scene();
const CIELO = new THREE.Color(0x87b8e8);
escena.background = CIELO;
escena.fog = new THREE.Fog(CIELO, 30, 70);
const material = new THREE.MeshBasicMaterial({ map: textura, vertexColors: true });
const mallas = new Array(NCX * NCZ).fill(null);

const op = (x, y, z) => obtener(x, y, z) !== AIRE ? 1 : 0;

function construirChunk(cx, cz) {
  const pos = [], uv = [], col = [], ind = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let y = 0; y < WY; y++) for (let z = z0; z < z0 + CHUNK; z++) for (let x = x0; x < x0 + CHUNK; x++) {
    const id = mundo[idx(x, y, z)];
    if (id === AIRE) continue;
    const def = BLOQUES[id];
    for (const cara of CARAS) {
      const [dx, dy, dz] = cara.dir;
      if (obtener(x + dx, y + dy, z + dz) !== AIRE) continue;
      const tile = dy === 1 ? def.top : dy === -1 ? def.bottom : def.side;
      const tx = tile % COLS, ty = Math.floor(tile / COLS);
      const eje = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
      const a = (eje + 1) % 3, b = (eje + 2) % 3;
      const base = ind.length ? pos.length / 3 : 0;
      for (const [px, py, pz, u, v] of cara.c) {
        pos.push(x + px, y + py, z + pz);
        uv.push((tx + EPS + u * (1 - 2 * EPS)) / COLS, 1 - (ty + 1 - (EPS + v * (1 - 2 * EPS))) / ROWS);
        // oclusión ambiental por vértice
        const p = [px, py, pz], vec = [x + dx, y + dy, z + dz];
        const sa = p[a] ? 1 : -1, sb = p[b] ? 1 : -1;
        const s1 = vec.slice(), s2 = vec.slice(), sc = vec.slice();
        s1[a] += sa; s2[b] += sb; sc[a] += sa; sc[b] += sb;
        const o1 = op(...s1), o2 = op(...s2), oc = op(...sc);
        const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
        const l = cara.luz * AO[ao];
        col.push(l, l, l);
      }
      ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const k = cz * NCX + cx;
  if (mallas[k]) { escena.remove(mallas[k]); mallas[k].geometry.dispose(); mallas[k] = null; }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, material);
  escena.add(m);
  mallas[k] = m;
}

function construirTodo() { for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) construirChunk(cx, cz); }

function reconstruirAlrededor(x, z) {
  const set = new Set();
  for (const [ox, oz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    const cx = Math.floor((x + ox) / CHUNK), cz = Math.floor((z + oz) / CHUNK);
    if (cx >= 0 && cz >= 0 && cx < NCX && cz < NCZ) set.add(cz * NCX + cx);
  }
  for (const k of set) construirChunk(k % NCX, Math.floor(k / NCX));
}

// ===================== Guardado =====================
let semilla = 0;
let cambios = new Map();
let temporizadorGuardar = null;

function guardar() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify({
      semilla, cambios: Array.from(cambios), jugador: [jug.pos.x, jug.pos.y, jug.pos.z, yaw, pitch], volar,
    }));
  } catch (e) { /* almacenamiento no disponible */ }
}
function programarGuardado() { clearTimeout(temporizadorGuardar); temporizadorGuardar = setTimeout(guardar, 800); }
function cargar() {
  try { const t = localStorage.getItem(CLAVE_GUARDADO); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}

function ponerBloque(x, y, z, id) {
  if (!dentro(x, y, z)) return;
  const i = idx(x, y, z);
  if (mundo[i] === BASE) return;
  mundo[i] = id;
  cambios.set(i, id);
  reconstruirAlrededor(x, z);
  programarGuardado();
}

// ===================== Cámara, jugador =====================
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('juego'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const camara = new THREE.PerspectiveCamera(75, 1, 0.08, 200);
camara.rotation.order = 'YXZ';
function ajustarTamano() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
}
window.addEventListener('resize', ajustarTamano);
ajustarTamano();

const ANCHO = 0.3, ALTO = 1.75, OJOS = 1.6;
const jug = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), suelo: false };
let yaw = 0, pitch = 0, volar = false;

function aparecer() {
  const x = Math.floor(WX / 2), z = Math.floor(WZ / 2);
  let y = WY - 1;
  while (y > 0 && obtener(x, y, z) === AIRE) y--;
  jug.pos.set(x + 0.5, y + 1.01, z + 0.5);
  jug.vel.set(0, 0, 0);
}

function choca() {
  const p = jug.pos;
  const x0 = Math.floor(p.x - ANCHO), x1 = Math.floor(p.x + ANCHO - 1e-4);
  const y0 = Math.floor(p.y), y1 = Math.floor(p.y + ALTO - 1e-4);
  const z0 = Math.floor(p.z - ANCHO), z1 = Math.floor(p.z + ANCHO - 1e-4);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    if (solidoColision(x, y, z)) return true;
  return false;
}
function moverEje(eje, d) {
  const pasos = Math.max(1, Math.ceil(Math.abs(d) / 0.15));
  const s = d / pasos;
  for (let i = 0; i < pasos; i++) {
    jug.pos.setComponent(eje, jug.pos.getComponent(eje) + s);
    if (choca()) {
      jug.pos.setComponent(eje, jug.pos.getComponent(eje) - s);
      if (eje === 1) { if (s < 0) jug.suelo = true; jug.vel.y = 0; }
      return;
    }
  }
}

// ===================== Rayo (bloque señalado) =====================
function rayo() {
  const o = camara.position, d = new THREE.Vector3();
  camara.getWorldDirection(d);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tmx = sx > 0 ? (x + 1 - o.x) * tdx : (o.x - x) * tdx;
  let tmy = sy > 0 ? (y + 1 - o.y) * tdy : (o.y - y) * tdy;
  let tmz = sz > 0 ? (z + 1 - o.z) * tdz : (o.z - z) * tdz;
  let n = [0, 0, 0], t = 0;
  while (t <= ALCANCE) {
    if (obtener(x, y, z) !== AIRE) return { x, y, z, n };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}

const marco = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
);
marco.visible = false;
escena.add(marco);
let objetivo = null;

let seleccion = 0;
function picar() {
  if (!objetivo) return;
  ponerBloque(objetivo.x, objetivo.y, objetivo.z, AIRE);
  vibrar(15);
}
function poner() {
  if (!objetivo) return;
  const x = objetivo.x + objetivo.n[0], y = objetivo.y + objetivo.n[1], z = objetivo.z + objetivo.n[2];
  if (!dentro(x, y, z) || obtener(x, y, z) !== AIRE) return;
  // no poner un bloque dentro del jugador
  const p = jug.pos;
  if (x + 1 > p.x - ANCHO && x < p.x + ANCHO && z + 1 > p.z - ANCHO && z < p.z + ANCHO && y + 1 > p.y && y < p.y + ALTO) return;
  ponerBloque(x, y, z, BARRA[seleccion]);
  vibrar(10);
}
function vibrar(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ===================== Interfaz =====================
const $ = id => document.getElementById(id);
const esTactil = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (esTactil) document.body.classList.add('es-tactil');
document.querySelectorAll(esTactil ? '.solo-pc' : '.solo-tactil').forEach(e => e.style.display = 'none');

const barra = $('barra');
const botonesBarra = BARRA.map((id, i) => {
  const b = document.createElement('button');
  b.appendChild(iconoBloque(id));
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); elegir(i); });
  barra.appendChild(b);
  return b;
});
let tNombre = null;
function elegir(i) {
  seleccion = (i + BARRA.length) % BARRA.length;
  botonesBarra.forEach((b, k) => b.classList.toggle('sel', k === seleccion));
  const nb = $('nombreBloque');
  nb.textContent = BLOQUES[BARRA[seleccion]].nombre;
  nb.style.opacity = 1;
  clearTimeout(tNombre); tNombre = setTimeout(() => nb.style.opacity = 0, 1200);
}
elegir(0);

const entrada = { adelante: 0, lado: 0, saltar: false, bajar: false };
const teclas = {};

function botonMantener(el, alPresionar, alSoltar) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('activo'); alPresionar(); });
  const fin = e => { el.classList.remove('activo'); alSoltar && alSoltar(); };
  el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin); el.addEventListener('pointerleave', fin);
}
botonMantener($('bSaltar'), () => entrada.saltar = true, () => entrada.saltar = false);
botonMantener($('bBajar'), () => entrada.bajar = true, () => entrada.bajar = false);

// Picar/poner: un toque = una acción; mantener = repetir
function botonRepetir(el, accion) {
  let t = null;
  botonMantener(el, () => { accion(); clearInterval(t); t = setInterval(accion, 260); }, () => clearInterval(t));
}
botonRepetir($('bPicar'), picar);
botonRepetir($('bPoner'), poner);

function cambiarVuelo(v) {
  volar = v;
  jug.vel.y = 0;
  $('bVolar').classList.toggle('activo', volar);
  $('bBajar').classList.toggle('oculto', !volar);
  programarGuardado();
}
$('bVolar').addEventListener('click', () => cambiarVuelo(!volar));

// --- Táctil: joystick a la izquierda, mirar a la derecha ---
const canvas = renderer.domElement;
const joyBase = $('joyBase'), joyPunta = $('joyPunta');
let joyId = null, joyCentro = [0, 0], miraId = null, miraUlt = [0, 0];
const RADIO_JOY = 50;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < window.innerWidth * 0.42 && joyId === null) {
      joyId = t.identifier; joyCentro = [t.clientX, t.clientY];
      joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px'; joyBase.style.display = 'block';
      joyPunta.style.transform = 'translate(0,0)';
    } else if (miraId === null) {
      miraId = t.identifier; miraUlt = [t.clientX, t.clientY];
    }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      let dx = t.clientX - joyCentro[0], dy = t.clientY - joyCentro[1];
      const l = Math.hypot(dx, dy);
      if (l > RADIO_JOY) { dx *= RADIO_JOY / l; dy *= RADIO_JOY / l; }
      joyPunta.style.transform = `translate(${dx}px,${dy}px)`;
      entrada.lado = dx / RADIO_JOY; entrada.adelante = -dy / RADIO_JOY;
    } else if (t.identifier === miraId) {
      girar(t.clientX - miraUlt[0], t.clientY - miraUlt[1], 0.0055);
      miraUlt = [t.clientX, t.clientY];
    }
  }
}, { passive: false });
const finToque = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { joyId = null; entrada.lado = entrada.adelante = 0; joyBase.style.display = 'none'; }
    if (t.identifier === miraId) miraId = null;
  }
};
canvas.addEventListener('touchend', finToque);
canvas.addEventListener('touchcancel', finToque);

function girar(dx, dy, sens) {
  yaw -= dx * sens;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - dy * sens));
}

// --- PC: ratón y teclado ---
function bloquearRaton() { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
canvas.addEventListener('mousedown', e => {
  if (esTactil && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
  if (document.pointerLockElement !== canvas) { bloquearRaton(); return; }
  if (e.button === 0) picar(); else if (e.button === 2) poner();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) girar(e.movementX, e.movementY, 0.0025); });
window.addEventListener('keydown', e => {
  teclas[e.code] = true;
  if (e.code === 'KeyF') cambiarVuelo(!volar);
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) elegir(n - 1); }
  if (e.code === 'Escape') abrirMenu();
});
window.addEventListener('keyup', e => { teclas[e.code] = false; });
window.addEventListener('wheel', e => elegir(seleccion + (e.deltaY > 0 ? 1 : -1)));

// --- Menú ---
let enPausa = true;
function abrirMenu() { enPausa = true; $('menu').classList.remove('oculto'); guardar(); if (document.exitPointerLock) document.exitPointerLock(); }
function cerrarMenu() {
  enPausa = false; $('menu').classList.add('oculto');
  if (!esTactil) bloquearRaton();
  reloj.getDelta();
}
$('bMenu').addEventListener('click', abrirMenu);
$('bJugar').addEventListener('click', cerrarMenu);
$('bNuevo').addEventListener('click', () => {
  if (cambios.size && !confirmarNuevo()) return;
  nuevoMundo(Math.floor(Math.random() * 1e9));
  cerrarMenu();
});
let avisoNuevo = 0;
function confirmarNuevo() {
  // segundo toque en 3 s confirma (evita diálogos del navegador)
  const ahora = Date.now();
  if (ahora - avisoNuevo < 3000) return true;
  avisoNuevo = ahora;
  $('bNuevo').textContent = 'Toca otra vez para borrar tu mundo';
  setTimeout(() => $('bNuevo').textContent = 'Nuevo mundo', 3000);
  return false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { guardar(); if (!enPausa) abrirMenu(); } });

function nuevoMundo(s) {
  semilla = s; cambios = new Map();
  generar(semilla); construirTodo(); aparecer();
  yaw = 0; pitch = 0; cambiarVuelo(false);
  guardar();
}

// ===================== Arranque =====================
(function iniciar() {
  const g = cargar();
  if (g && typeof g.semilla === 'number') {
    semilla = g.semilla;
    generar(semilla);
    cambios = new Map(g.cambios || []);
    for (const [i, id] of cambios) if (i >= 0 && i < mundo.length) mundo[i] = id;
    construirTodo();
    if (g.jugador) { jug.pos.set(g.jugador[0], g.jugador[1], g.jugador[2]); yaw = g.jugador[3] || 0; pitch = g.jugador[4] || 0; }
    else aparecer();
    if (choca()) aparecer();
    cambiarVuelo(!!g.volar);
  } else {
    nuevoMundo(Math.floor(Math.random() * 1e9));
  }
})();

// ===================== Bucle principal =====================
const reloj = new THREE.Clock();
const info = $('info');
let fpsCont = 0, fpsT = 0;

function actualizar(dt) {
  let adelante = entrada.adelante, lado = entrada.lado;
  if (teclas.KeyW || teclas.ArrowUp) adelante += 1;
  if (teclas.KeyS || teclas.ArrowDown) adelante -= 1;
  if (teclas.KeyD || teclas.ArrowRight) lado += 1;
  if (teclas.KeyA || teclas.ArrowLeft) lado -= 1;
  const l = Math.hypot(adelante, lado);
  if (l > 1) { adelante /= l; lado /= l; }
  const vel = volar ? 10 : 4.6;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  jug.vel.x = (fx * adelante + rx * lado) * vel;
  jug.vel.z = (fz * adelante + rz * lado) * vel;
  const saltar = entrada.saltar || teclas.Space;
  if (volar) {
    jug.vel.y = ((saltar ? 1 : 0) - ((entrada.bajar || teclas.ShiftLeft || teclas.ShiftRight) ? 1 : 0)) * vel;
  } else {
    jug.vel.y = Math.max(-40, jug.vel.y - 24 * dt);
    if (saltar && jug.suelo) jug.vel.y = 8.2;
  }
  moverEje(0, jug.vel.x * dt);
  moverEje(2, jug.vel.z * dt);
  jug.suelo = false;
  moverEje(1, jug.vel.y * dt);
  if (jug.pos.y < -20) aparecer();

  camara.position.set(jug.pos.x, jug.pos.y + OJOS, jug.pos.z);
  camara.rotation.set(pitch, yaw, 0);

  objetivo = rayo();
  marco.visible = !!objetivo;
  if (objetivo) marco.position.set(objetivo.x + 0.5, objetivo.y + 0.5, objetivo.z + 0.5);
}

function bucle() {
  requestAnimationFrame(bucle);
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (!enPausa) actualizar(dt);
  else { camara.position.set(jug.pos.x, jug.pos.y + OJOS, jug.pos.z); camara.rotation.set(pitch, yaw += dt * 0.08, 0); }
  renderer.render(escena, camara);
  fpsCont++; fpsT += dt;
  if (fpsT >= 1) {
    info.textContent = `${fpsCont} fps · X ${Math.floor(jug.pos.x)}  Y ${Math.floor(jug.pos.y)}  Z ${Math.floor(jug.pos.z)}`;
    fpsCont = 0; fpsT = 0;
  }
}
bucle();
window.__rg = { jug, camara, mundo, obtener, picar, poner, get objetivo() { return objetivo; }, set pitch(v) { pitch = v; }, cerrarMenu };
