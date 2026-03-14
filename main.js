/* ============================================
   main.js — BIBLIO.SYS Galaxie Musicale
   Three.js r128 — Neon wireframe edition
   ============================================ */

// ── SETUP ──
const canvas      = document.getElementById('c');
const tooltip     = document.getElementById('tooltip');
const searchEl    = document.getElementById('search');
const searchRes   = document.getElementById('search-results');

const W = window.innerWidth, H = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x04040d, 1);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000);
camera.position.set(0, 0, 220);

// Lights — forts pour que les facettes cristal reflètent bien
scene.add(new THREE.AmbientLight(0xffffff, 0.08));
const keyLight = new THREE.PointLight(0xffffff, 2.5, 500);
keyLight.position.set(80, 80, 80);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x8844ff, 1.2, 400);
fillLight.position.set(-80, -40, -60);
scene.add(fillLight);
const rimLight = new THREE.PointLight(0x00ccff, 0.8, 300);
rimLight.position.set(0, -80, -40);
scene.add(rimLight);

// ── BACKGROUND STARS ──
(function () {
  const geo = new THREE.BufferGeometry();
  const pos = [], col = [];
  for (let i = 0; i < 4000; i++) {
    const r     = 350 + Math.random() * 650;
    const phi   = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    pos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    const t = Math.random();
    if      (t > 0.92) { col.push(1, 0.58, 0);    }   // amber
    else if (t > 0.84) { col.push(1, 0.18, 0.47); }   // magenta
    else if (t > 0.76) { col.push(0, 0.9, 1);     }   // cyan
    else { const b = 0.08 + Math.random() * 0.3; col.push(0, b, b * 0.35); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, sizeAttenuation: true })));
})();

// ── STATE ──
let mode          = 'galaxy';
let currentArtist = null;
let targetCamZ    = 220;
let rotY = 0, rotX = 0;
let isDragging    = false;
let lastMouse     = { x: 0, y: 0 };
const mouse       = new THREE.Vector2(-9, -9);

const galaxyGroup = new THREE.Group();
const artistGroup = new THREE.Group();
scene.add(galaxyGroup);
scene.add(artistGroup);
artistGroup.visible = false;

const raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 1.2 };

// ── STATS ──
const totalArtists = MUSIC_DATA.length;
const totalTracks  = MUSIC_DATA.reduce((s, a) => s + a.trackCount, 0);
document.getElementById('stat-artists').textContent = totalArtists;
document.getElementById('stat-tracks').textContent  = totalTracks.toLocaleString('fr-FR');

// ── FIBONACCI SPHERE ──
const GALAXY_R = 120;

function fibonacciSphere(n, r) {
  const pts = [], phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    pts.push(new THREE.Vector3(r * rad * Math.cos(phi * i), r * y, r * rad * Math.sin(phi * i)));
  }
  return pts;
}

const positions = fibonacciSphere(MUSIC_DATA.length, GALAXY_R);

// ── PLANET BUILDER ──
const planetMeshes = [];
const planetWires  = [];  // wireframe overlays

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return { r, g, b };
}

// ── BEAD SPRITE TEXTURE ──
// Génère une texture canvas simulant une petite sphère chromée/nacrée
// avec halo doux + reflet spéculaire — comme les beads de la vidéo CGR
function makeBeadTexture(hexColor) {
  const size = 64;
  const cv   = document.createElement('canvas');
  cv.width   = size; cv.height = size;
  const ctx  = cv.getContext('2d');
  const cx   = size / 2, cy = size / 2, r = size * 0.38;

  // Halo extérieur doux
  const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, size * 0.5);
  halo.addColorStop(0,   'rgba(255,255,255,0.18)');
  halo.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  halo.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Corps principal — sphère nacrée
  const body = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.05, cx, cy, r);
  body.addColorStop(0,    'rgba(255,255,255,0.95)');  // reflet spéculaire
  body.addColorStop(0.25, 'rgba(220,235,255,0.85)');  // nacré froid
  body.addColorStop(0.6,  hexToRgbaString(hexColor, 0.7));
  body.addColorStop(1,    hexToRgbaString(hexColor, 0.15));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Petit reflet secondaire (bas-droit)
  const spec2 = ctx.createRadialGradient(cx + r*0.3, cy + r*0.3, 0, cx + r*0.3, cy + r*0.3, r*0.3);
  spec2.addColorStop(0,   'rgba(255,255,255,0.25)');
  spec2.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = spec2;
  ctx.fill();

  return new THREE.CanvasTexture(cv);
}

function hexToRgbaString(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Texture bead blanche pour la vue artiste (points de musiques)
const beadTexWhite = makeBeadTexture('#a0c8ff');

// ── CRYSTAL PLANET GEOMETRY ──
// Crée une sphère low-poly dont chaque face est déplacée
// vers l'extérieur aléatoirement → effet gemme/cristal explosé
function makeCrystalGeo(radius, segments, explodeMin, explodeMax) {
  // Partir d'une IcosahedronGeometry (faces triangulaires régulières)
  // puis convertir en BufferGeometry non-indexée pour que chaque face
  // ait ses propres vertices → normales plates → look facetté
  const base = new THREE.IcosahedronGeometry(radius, segments);
  // Convertir en non-indexé (chaque triangle = 3 vertices indépendants)
  const nonIndexed = base.toNonIndexed();
  const pos = nonIndexed.attributes.position;
  const count = pos.count; // multiple de 3 (triplets de vertices)

  for (let i = 0; i < count; i += 3) {
    // Centroïde de la face
    const cx = (pos.getX(i) + pos.getX(i+1) + pos.getX(i+2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i+1) + pos.getY(i+2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i+1) + pos.getZ(i+2)) / 3;
    // Normale de la face = direction du centroïde normalisée
    const len = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
    const nx = cx/len, ny = cy/len, nz = cz/len;
    // Déplacement aléatoire le long de la normale
    const d = explodeMin + Math.random() * (explodeMax - explodeMin);
    for (let v = 0; v < 3; v++) {
      pos.setXYZ(i+v,
        pos.getX(i+v) + nx * d,
        pos.getY(i+v) + ny * d,
        pos.getZ(i+v) + nz * d
      );
    }
  }
  pos.needsUpdate = true;
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

// Matériau cristal : sombre + émissif + metalness élevé + flat shading
function makeCrystalMat(col) {
  return new THREE.MeshStandardMaterial({
    color:       col.clone().multiplyScalar(0.28),
    emissive:    col.clone().multiplyScalar(0.18),
    roughness:   0.12,
    metalness:   0.92,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}

// ── IRIDESCENT TORUS RING ──
// Simule le verre holographique : tore avec 3 couches superposées
// (base sombre transparente + iridescence arc-en-ciel + reflet blanc)
function makeIridescentRing(radius, tubeR, col, tiltX, tiltZ) {
  const group = new THREE.Group();
  group.rotation.x = tiltX;
  group.rotation.z = tiltZ;

  // Couche 1 — corps principal semi-transparent
  group.add(new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeR, 32, 128),
    new THREE.MeshStandardMaterial({
      color:       col.clone().multiplyScalar(0.4),
      emissive:    col.clone().multiplyScalar(0.1),
      roughness:   0.08,
      metalness:   0.6,
      transparent: true,
      opacity:     0.55,
      side:        THREE.DoubleSide,
    })
  ));

  // Couche 2 — iridescence arc-en-ciel (couleurs décalées HSL)
  const iriColors = [0, 0.08, 0.16, 0.28, 0.45, 0.6, 0.75];
  iriColors.forEach((hShift, idx) => {
    const iriCol = col.clone().offsetHSL(hShift, 0.3, 0.15);
    group.add(new THREE.Mesh(
      new THREE.TorusGeometry(radius, tubeR * 0.82, 16, 128),
      new THREE.MeshStandardMaterial({
        color:       iriCol,
        emissive:    iriCol.clone().multiplyScalar(0.25),
        roughness:   0.05,
        metalness:   0.9,
        transparent: true,
        opacity:     0.12,
        side:        THREE.DoubleSide,
        depthWrite:  false,
      })
    ));
  });

  // Couche 3 — reflet blanc sur le dessus (highlight spéculaire)
  group.add(new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeR * 0.35, 16, 128),
    new THREE.MeshStandardMaterial({
      color:       new THREE.Color(1, 1, 1),
      roughness:   0.0,
      metalness:   1.0,
      transparent: true,
      opacity:     0.18,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    })
  ));

  return group;
}

MUSIC_DATA.forEach((artist, i) => {
  const planetR = 1.2 + (artist.trackCount / 133) * 3.2;
  const col     = new THREE.Color(artist.color);

  // ── Crystal planet — segments=3 + extrusion plus marquée ──
  const crystalGeo = makeCrystalGeo(planetR, 3, -planetR * 0.05, planetR * 0.55);
  const sphere = new THREE.Mesh(crystalGeo, makeCrystalMat(col));
  sphere.position.copy(positions[i]);
  sphere.userData = { artist, index: i, radius: planetR * 1.6 };
  galaxyGroup.add(sphere);
  planetMeshes.push(sphere);

  // ── Wireframe sur la même géo (léger) ──
  const wireMat = new THREE.MeshBasicMaterial({
    color: col, wireframe: true, transparent: true, opacity: 0.22,
  });
  const wire = new THREE.Mesh(crystalGeo, wireMat);
  sphere.add(wire);
  planetWires.push(wire);

  // ── Outer glow shell ──
  const glowGeo = new THREE.SphereGeometry(planetR * 1.35, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
  });
  sphere.add(new THREE.Mesh(glowGeo, glowMat));

  // ── Anneau iridescent (tore en verre holographique) ──
  const ringTiltX = Math.PI * 0.5 + (Math.random() - 0.5) * 0.5;
  const ringTiltZ = (Math.random() - 0.5) * 0.5;
  const iriRing = makeIridescentRing(
    planetR * 1.7,          // rayon du tore
    planetR * 0.18,         // épaisseur du tube
    col, ringTiltX, ringTiltZ
  );
  sphere.add(iriRing);

  // ── Satellite beads (tracks preview) ──
  const satPos = [];
  const displayN = Math.min(artist.trackCount, 24);
  for (let t = 0; t < displayN; t++) {
    const phi2   = Math.acos(2 * Math.random() - 1);
    const theta2 = Math.random() * Math.PI * 2;
    const d = planetR + 2.2 + Math.random() * 2.2;
    satPos.push(d * Math.sin(phi2) * Math.cos(theta2), d * Math.sin(phi2) * Math.sin(theta2), d * Math.cos(phi2));
  }
  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute('position', new THREE.Float32BufferAttribute(satPos, 3));
  const beadTex = makeBeadTexture(artist.color);
  sphere.add(new THREE.Points(satGeo, new THREE.PointsMaterial({
    map:          beadTex,
    size:         0.55,
    transparent:  true,
    opacity:      0.82,
    sizeAttenuation: true,
    depthWrite:   false,
    alphaTest:    0.01,
  })));
});

// ── ARTIST VIEW ──
let artistTrackPoints = null;
let artistTrackData   = [];

function enterArtist(artist) {
  mode          = 'artist';
  currentArtist = artist;
  galaxyGroup.visible = false;
  artistGroup.visible = true;
  artistGroup.clear();
  artistTrackPoints = null;
  artistTrackData   = [];

  document.getElementById('back-btn').style.display     = 'block';
  document.getElementById('top-bar').style.display      = 'none';
  document.getElementById('hint').style.opacity         = '0';
  document.getElementById('artist-panel').style.display = 'block';
  document.getElementById('artist-panel').style.animation = 'fadeUp .4s ease both';
  document.getElementById('ap-genre').textContent = artist.genre.toUpperCase();
  document.getElementById('ap-name').textContent  = artist.name;
  document.getElementById('ap-meta').textContent  = `${artist.trackCount} TITRES · ${artist.albums.length} ALBUMS`;

  const col = new THREE.Color(artist.color);
  const R = 6;

  // Crystal planet — segments=4 en vue artiste, très détaillé
  const aGeo = makeCrystalGeo(R, 4, -R * 0.04, R * 0.52);
  artistGroup.add(new THREE.Mesh(aGeo, makeCrystalMat(col)));

  // Wireframe cristal léger
  artistGroup.add(new THREE.Mesh(aGeo,
    new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.25 })
  ));

  // Glow back-shell
  artistGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.035, side: THREE.BackSide })
  ));

  // 3 anneaux iridescents à angles différents — style image de référence
  const ringConfigs = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => ({
  radius: R * (1.35 + Math.random() * 0.5),
  tube:   R * (0.06 + Math.random() * 0.08),
  tx:     Math.random() * Math.PI,
  tz:     Math.random() * Math.PI,
}));
  
  ringConfigs.forEach(cfg => {
    artistGroup.add(makeIridescentRing(cfg.radius, cfg.tube, col, cfg.tx, cfg.tz));
  });

  // Track beads — sprite nacré avec couleur artiste
  const tPos = [], tColors = [];
  artist.tracks.forEach((track) => {
    const phi   = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const dist  = 11 + Math.random() * 10;
    tPos.push(dist * Math.sin(phi) * Math.cos(theta), dist * Math.sin(phi) * Math.sin(theta), dist * Math.cos(phi));
    const c = col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.3);
    tColors.push(c.r, c.g, c.b);
    artistTrackData.push({ artist: artist.name, track: track.name, album: track.album, year: track.year, color: artist.color });
  });

  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  tGeo.setAttribute('color',    new THREE.Float32BufferAttribute(tColors, 3));

  // Texture bead teintée couleur artiste
  const artistBeadTex = makeBeadTexture(artist.color);
  artistTrackPoints = new THREE.Points(tGeo, new THREE.PointsMaterial({
    map:          artistBeadTex,
    size:         1.4,
    vertexColors: true,
    transparent:  true,
    opacity:      0.92,
    sizeAttenuation: true,
    depthWrite:   false,
    alphaTest:    0.01,
  }));
  artistGroup.add(artistTrackPoints);

  targetCamZ = 34;
  rotY = 0; rotX = 0;
}

function backToGalaxy() {
  mode = 'galaxy';
  currentArtist = null;
  galaxyGroup.visible = true;
  artistGroup.visible = false;
  artistGroup.clear();
  artistTrackPoints = null;

  document.getElementById('back-btn').style.display     = 'none';
  document.getElementById('top-bar').style.display      = 'flex';
  document.getElementById('hint').style.opacity         = '1';
  document.getElementById('artist-panel').style.display = 'none';

  hideTooltip();
  targetCamZ = 220;
  rotY = 0; rotX = 0;
}

// ── OSCILLOSCOPE ──
let oscRAF = null, oscPhase = 0;

function buildWaveParams(name) {
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i) * (i + 1);
  const count = 2 + (seed % 3);
  return Array.from({ length: count }, (_, i) => ({
    freq:  0.7 + ((seed * (i + 1) * 41) % 100) / 55,
    amp:   0.22 + ((seed * (i + 1) * 17) % 100) / 200,
    phase: ((seed * (i + 1) * 11) % 100) / 15,
  }));
}

function drawOsc(cvs, hexColor, waves, phase) {
  const W2 = cvs.width, H2 = cvs.height;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, W2, H2);
  ctx.fillStyle = '#04040d';
  ctx.fillRect(0, 0, W2, H2);

  // Grid
  ctx.strokeStyle = 'rgba(0,255,159,0.06)';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < 8; c++) { ctx.beginPath(); ctx.moveTo(W2/8*c,0); ctx.lineTo(W2/8*c,H2); ctx.stroke(); }
  for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(0,H2/4*r); ctx.lineTo(W2,H2/4*r); ctx.stroke(); }
  // Center lines
  ctx.strokeStyle = 'rgba(0,255,159,0.14)';
  ctx.beginPath(); ctx.moveTo(W2/2,0); ctx.lineTo(W2/2,H2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H2/2); ctx.lineTo(W2,H2/2); ctx.stroke();

  // Parse color
  const r = parseInt(hexColor.slice(1,3),16);
  const g = parseInt(hexColor.slice(3,5),16);
  const b = parseInt(hexColor.slice(5,7),16);

  // Ghost glow
  ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = 0; x < W2; x++) {
    const t = (x / W2) * Math.PI * 2;
    let y = 0;
    for (const w of waves) y += Math.sin(t * w.freq * 3.2 + phase * w.phase) * w.amp;
    const py = H2/2 + y * H2 * 0.36;
    x === 0 ? ctx.moveTo(x,py) : ctx.lineTo(x,py);
  }
  ctx.stroke();

  // Main line
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = `rgb(${r},${g},${b})`;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let x = 0; x < W2; x++) {
    const t = (x / W2) * Math.PI * 2;
    let y = 0;
    for (const w of waves) y += Math.sin(t * w.freq * 3.2 + phase * w.phase) * w.amp;
    const py = H2/2 + y * H2 * 0.36;
    x === 0 ? ctx.moveTo(x,py) : ctx.lineTo(x,py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Extrema markers
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  let prevPy = null, prevRising = null;
  for (let x = 2; x < W2-2; x += 3) {
    const t = (x/W2)*Math.PI*2;
    let y = 0;
    for (const w of waves) y += Math.sin(t*w.freq*3.2+phase*w.phase)*w.amp;
    const py = H2/2+y*H2*0.36;
    if (prevPy !== null) {
      const rising = py < prevPy;
      if (prevRising !== null && rising !== prevRising) {
        ctx.fillRect(x-3, prevPy-0.5, 6, 1);
        ctx.fillRect(x-0.5, prevPy-3, 1, 6);
      }
      prevRising = rising;
    }
    prevPy = py;
  }
}

function showTooltip(data, mx, my) {
  document.getElementById('tt-sig').textContent  = `SIG:${data.track.length.toString(16).toUpperCase().padStart(4,'0')}`;
  document.getElementById('tt-artist').textContent = data.artist;
  document.getElementById('tt-track').textContent  = data.track;
  document.getElementById('tt-album').textContent  = data.album + (data.year ? ` · ${data.year}` : '');

  const osc   = document.getElementById('tt-osc');
  const waves = buildWaveParams(data.track);
  if (oscRAF) { cancelAnimationFrame(oscRAF); oscRAF = null; }
  function loop() { oscPhase += 0.035; drawOsc(osc, data.color, waves, oscPhase); oscRAF = requestAnimationFrame(loop); }
  loop();

  tooltip.style.display = 'block';
  const tx = Math.min(mx + 18, window.innerWidth  - 295);
  const ty = Math.min(my - 12, window.innerHeight - 190);
  tooltip.style.left = tx + 'px';
  tooltip.style.top  = ty + 'px';
}

function hideTooltip() {
  tooltip.style.display = 'none';
  if (oscRAF) { cancelAnimationFrame(oscRAF); oscRAF = null; }
}

function showPlanetTooltip(artist, mx, my) {
  document.getElementById('tt-sig').textContent  = `PLT:${artist.name.length.toString(16).toUpperCase().padStart(4,'0')}`;
  document.getElementById('tt-artist').textContent = artist.genre.toUpperCase();
  document.getElementById('tt-track').textContent  = artist.name;
  document.getElementById('tt-album').textContent  = `${artist.trackCount} titres · cliquer pour explorer`;

  const osc   = document.getElementById('tt-osc');
  const waves = buildWaveParams(artist.name);
  if (oscRAF) { cancelAnimationFrame(oscRAF); oscRAF = null; }
  function loop() { oscPhase += 0.025; drawOsc(osc, artist.color, waves, oscPhase); oscRAF = requestAnimationFrame(loop); }
  loop();

  tooltip.style.display = 'block';
  const tx = Math.min(mx + 18, window.innerWidth  - 295);
  const ty = Math.min(my - 12, window.innerHeight - 190);
  tooltip.style.left = tx + 'px';
  tooltip.style.top  = ty + 'px';
}

// ── CURSOR ──
const cursorEl = document.getElementById('cursor');
document.addEventListener('mousemove', e => {
  cursorEl.style.left = e.clientX + 'px';
  cursorEl.style.top  = e.clientY + 'px';
});

// ── EVENTS ──
canvas.addEventListener('mousemove', e => {
  const mx = e.clientX, my = e.clientY;
  mouse.set((mx/W)*2-1, -(my/H)*2+1);

  if (isDragging) {
    rotY += (mx - lastMouse.x) * 0.004;
    rotX += (my - lastMouse.y) * 0.004;
    rotX = Math.max(-Math.PI/2.4, Math.min(Math.PI/2.4, rotX));
    lastMouse = { x: mx, y: my };
    hideTooltip();
    return;
  }
  lastMouse = { x: mx, y: my };
  raycaster.setFromCamera(mouse, camera);

  if (mode === 'artist' && artistTrackPoints) {
    const hits = raycaster.intersectObject(artistTrackPoints);
    if (hits.length > 0 && artistTrackData[hits[0].index]) {
      showTooltip(artistTrackData[hits[0].index], mx, my);
      cursorEl.classList.add('hover');
      return;
    }
    hideTooltip();
    cursorEl.classList.remove('hover');
  } else if (mode === 'galaxy') {
    const hits = raycaster.intersectObjects(planetMeshes, false);
    if (hits.length > 0) {
      showPlanetTooltip(hits[0].object.userData.artist, mx, my);
      cursorEl.classList.add('hover');
      return;
    }
    hideTooltip();
    cursorEl.classList.remove('hover');
  }
});

canvas.addEventListener('mousedown', e => { isDragging = true; lastMouse = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mouseup',    () => { isDragging = false; });
canvas.addEventListener('mouseleave', () => { isDragging = false; hideTooltip(); });

canvas.addEventListener('click', () => {
  if (isDragging) return;
  raycaster.setFromCamera(mouse, camera);
  if (mode === 'galaxy') {
    const hits = raycaster.intersectObjects(planetMeshes, false);
    if (hits.length > 0) enterArtist(hits[0].object.userData.artist);
  }
});

canvas.addEventListener('wheel', e => {
  const min = mode === 'artist' ? 14 : 55;
  const max = mode === 'artist' ? 60 : 360;
  targetCamZ = Math.max(min, Math.min(max, targetCamZ + e.deltaY * 0.08));
}, { passive: true });

// ── SEARCH ──
searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim().toLowerCase();
  searchRes.innerHTML = '';
  if (!q) { searchRes.classList.remove('open'); return; }
  const matches = MUSIC_DATA.filter(a => a.name.toLowerCase().includes(q)).slice(0, 12);
  if (!matches.length) { searchRes.classList.remove('open'); return; }
  matches.forEach(artist => {
    const item = document.createElement('div');
    item.className = 'sr-item';
    item.innerHTML = `
      <div class="sr-dot" style="background:${artist.color}"></div>
      <div class="sr-name">${artist.name}</div>
      <div class="sr-count">${artist.trackCount}</div>
    `;
    item.addEventListener('click', () => { searchEl.value = ''; searchRes.classList.remove('open'); enterArtist(artist); });
    searchRes.appendChild(item);
  });
  searchRes.classList.add('open');
});
document.addEventListener('click', e => { if (!e.target.closest('#search-wrap')) searchRes.classList.remove('open'); });

// ── RESIZE ──
window.addEventListener('resize', () => {
  const W2 = window.innerWidth, H2 = window.innerHeight;
  camera.aspect = W2 / H2;
  camera.updateProjectionMatrix();
  renderer.setSize(W2, H2);
});

// ── ANIMATE ──
let clock = 0;

function animate() {
  requestAnimationFrame(animate);
  clock += 0.003;

  camera.position.z += (targetCamZ - camera.position.z) * 0.07;

  if (!isDragging) rotY += mode === 'galaxy' ? 0.0012 : 0.0018;

  if (mode === 'galaxy') {
    galaxyGroup.rotation.y = rotY;
    galaxyGroup.rotation.x = rotX;
    // Rotate each planet + pulse wireframe opacity
    planetMeshes.forEach((m, i) => {
      m.rotation.y += 0.003 + i * 0.0001;
      m.rotation.x += 0.001;
      // Wireframe opacity breathing
      const wire = m.children[0];
      if (wire && wire.material && wire.material.wireframe) {
        wire.material.opacity = 0.4 + Math.sin(clock * 1.5 + i * 0.8) * 0.2;
      }
    });
  } else {
    artistGroup.rotation.y = rotY;
    artistGroup.rotation.x = rotX;
  }

  renderer.render(scene, camera);
}

animate();