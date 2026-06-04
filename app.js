// ── Demo Route ───────────────────────────────────────────────────────────────
// London South Bank: Tower Bridge → London Eye, ~3.7 km, 48 minutes
// Same coordinates as demo.gpx (embedded so no fetch needed)

const DEMO_ROUTE = {
  name: 'London South Bank Walk',
  intervalSeconds: 120,
  startTimeMs: new Date('2024-06-04T08:00:00Z').getTime(),
  coords: [
    [51.50550, -0.07540], // Tower Bridge
    [51.50590, -0.07750],
    [51.50620, -0.07960],
    [51.50650, -0.08170],
    [51.50670, -0.08380], // Borough Market area
    [51.50700, -0.08610],
    [51.50730, -0.08840],
    [51.50760, -0.09080], // Southwark area
    [51.50780, -0.09320],
    [51.50790, -0.09550], // Southwark Bridge
    [51.50780, -0.09750], // Tate Modern
    [51.50760, -0.09930],
    [51.50740, -0.10120], // Blackfriars area
    [51.50730, -0.10310],
    [51.50710, -0.10490],
    [51.50690, -0.10680], // towards Waterloo
    [51.50650, -0.10860],
    [51.50610, -0.11040],
    [51.50570, -0.11210], // Waterloo Bridge
    [51.50520, -0.11370],
    [51.50470, -0.11510],
    [51.50420, -0.11650], // Jubilee Gardens
    [51.50380, -0.11780],
    [51.50350, -0.11880],
    [51.50320, -0.11970], // London Eye
  ],
};

function getDemoPoints() {
  return DEMO_ROUTE.coords.map(([lat, lon], i) => ({
    lat,
    lon,
    timeMs: DEMO_ROUTE.startTimeMs + i * DEMO_ROUTE.intervalSeconds * 1000,
  }));
}

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  mode: 'live',           // 'live' | 'upload'
  // live tracking
  tracking: false,
  watchId: null,
  startTime: null,
  lastPos: null,
  timerInterval: null,
  // shared display state (populated by both modes)
  totalMeters: 0,
  elapsedSeconds: 0,
  latitude: 0,
  points: [],
};

// ── DOM refs ─────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const modeTabLive   = $('modeTabLive');
const modeTabUpload = $('modeTabUpload');
const livePanel     = $('livePanel');
const uploadPanel   = $('uploadPanel');

const startBtn    = $('startBtn');
const stopBtn     = $('stopBtn');
const resetBtn    = $('resetBtn');
const statusDot   = $('statusDot');
const statusLabel = $('statusLabel');
const accuracyInfo  = $('accuracyInfo');
const accuracyLabel = $('accuracyLabel');

const dropZone   = $('dropZone');
const fileInput  = $('fileInput');
const demoBtn    = $('demoBtn');
const fileInfo   = $('fileInfo');
const fileName   = $('fileName');
const filePoints = $('filePoints');
const fileDuration = $('fileDuration');
const fileDistance = $('fileDistance');
const fileTimeWarning = $('fileTimeWarning');
const clearFileBtn = $('clearFileBtn');

const earthDistanceEl   = $('earthDistance');
const earthTimeEl       = $('earthTime');
const orbitDistanceEl   = $('orbitDistance');
const rotationDistanceEl = $('rotationDistance');
const rotationSubEl     = $('rotationSub');
const galacticDistanceEl = $('galacticDistance');

const ratioBanner   = $('ratioBanner');
const ratioText     = $('ratioText');
const scaleSection  = $('scaleSection');
const youBar        = $('youBar');
const orbitBar      = $('orbitBar');
const galacticBar   = $('galacticBar');
const youBarLabel   = $('youBarLabel');
const orbitBarLabel = $('orbitBarLabel');
const galacticBarLabel = $('galacticBarLabel');
const funFacts      = $('funFacts');

const logSection = $('logSection');
const logEntries = $('logEntries');

// ── Canvas Renderer ───────────────────────────────────────────────────────────

const renderer = new SolarRenderer($('solarCanvas'));

// ── Mode Switching ────────────────────────────────────────────────────────────

modeTabLive.addEventListener('click', () => switchMode('live'));
modeTabUpload.addEventListener('click', () => switchMode('upload'));

function switchMode(mode) {
  if (state.mode === mode) return;
  // Stop any live tracking before switching away
  if (state.mode === 'live') stopTracking();

  state.mode = mode;
  modeTabLive.classList.toggle('active', mode === 'live');
  modeTabUpload.classList.toggle('active', mode === 'upload');
  livePanel.style.display = mode === 'live' ? '' : 'none';
  uploadPanel.style.display = mode === 'upload' ? '' : 'none';

  resetDisplay();
}

// ── Live GPS Tracking ─────────────────────────────────────────────────────────

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
resetBtn.addEventListener('click', () => {
  stopTracking();
  resetDisplay();
  setStatus('ready', 'Ready to track');
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

function startTracking() {
  if (!navigator.geolocation) {
    setStatus('error', 'Geolocation not supported by this browser');
    return;
  }

  setStatus('waiting', 'Acquiring GPS signal...');
  startBtn.disabled = true;
  stopBtn.disabled = false;

  state.tracking = true;
  state.startTime = Date.now();
  state.lastPos = null;
  state.totalMeters = 0;
  state.elapsedSeconds = 0;
  state.points = [];

  state.timerInterval = setInterval(() => {
    if (state.startTime) {
      state.elapsedSeconds = (Date.now() - state.startTime) / 1000;
      updateDisplay();
    }
  }, 1000);

  state.watchId = navigator.geolocation.watchPosition(
    onPosition,
    onGeoError,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
}

function stopTracking() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  clearInterval(state.timerInterval);
  state.tracking = false;
  if (state.startTime) {
    state.elapsedSeconds = (Date.now() - state.startTime) / 1000;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  accuracyInfo.style.display = 'none';

  if (state.elapsedSeconds > 0) {
    setStatus('done', `Journey complete — ${formatTime(state.elapsedSeconds)}`);
    updateDisplay();
    addLogEntry(`Journey stopped. Total: ${formatMeters(state.totalMeters)} in ${formatTime(state.elapsedSeconds)}`);
  }
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  state.latitude = latitude;
  accuracyLabel.textContent = `GPS accuracy: ±${accuracy.toFixed(0)} m`;
  accuracyInfo.style.display = 'block';

  if (state.lastPos) {
    const dist = haversineMeters(state.lastPos.lat, state.lastPos.lon, latitude, longitude);
    if (dist > Math.min(accuracy, 15)) {
      state.totalMeters += dist;
      addLogEntry(`+${dist.toFixed(1)} m (±${accuracy.toFixed(0)} m accuracy)`, latitude, longitude);
    }
  } else {
    setStatus('active', 'Tracking your journey');
    addLogEntry(`Journey started at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  }

  state.lastPos = { lat: latitude, lon: longitude, accuracy };
  state.points.push({ lat: latitude, lon: longitude, timeMs: Date.now() });
  updateDisplay();
}

function onGeoError(err) {
  const messages = {
    1: 'Location access denied — please allow location access.',
    2: 'Location unavailable — check device settings.',
    3: 'Location request timed out.',
  };
  setStatus('error', messages[err.code] || 'Location error');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearInterval(state.timerInterval);
}

// ── GPX File Upload ───────────────────────────────────────────────────────────

demoBtn.addEventListener('click', () => loadRoute(getDemoPoints(), DEMO_ROUTE.name, true));

clearFileBtn.addEventListener('click', () => {
  fileInfo.style.display = 'none';
  fileInput.value = '';
  resetDisplay();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) readGPXFile(e.target.files[0]);
});

// Drag-and-drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) readGPXFile(file);
});

function readGPXFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const { points, name } = parseGPX(e.target.result);
      loadRoute(points, name || file.name.replace(/\.gpx$/i, ''), false);
    } catch (err) {
      showUploadError(err.message);
    }
  };
  reader.onerror = () => showUploadError('Could not read file.');
  reader.readAsText(file);
}

function showUploadError(msg) {
  fileInfo.style.display = 'block';
  fileName.textContent = `Error: ${msg}`;
  filePoints.textContent = '';
  fileDuration.textContent = '';
  fileDistance.textContent = '';
  fileTimeWarning.style.display = 'none';
}

// ── Route Loading (shared by demo + file upload) ──────────────────────────────

function loadRoute(points, name, isDemo) {
  resetDisplay();

  let result;
  try {
    result = processRoute(points);
  } catch (err) {
    showUploadError(err.message);
    return;
  }

  const { totalMeters, elapsedSeconds, latitude, hasTime, pointCount } = result;

  // Populate shared state
  state.totalMeters = totalMeters;
  state.elapsedSeconds = elapsedSeconds;
  state.latitude = latitude;
  state.points = points;

  // Show file info card
  fileInfo.style.display = 'block';
  fileName.textContent = isDemo ? `Demo — ${name}` : name;
  filePoints.textContent = `${pointCount} points`;
  fileDuration.textContent = formatTime(elapsedSeconds);
  fileDistance.textContent = formatMeters(totalMeters);
  fileTimeWarning.style.display = hasTime ? 'none' : 'inline';

  // Build journey log from route points
  addLogEntry(`Route loaded: ${name}`);
  addLogEntry(`Start: ${points[0].lat.toFixed(5)}, ${points[0].lon.toFixed(5)}`);
  addLogEntry(`End:   ${points[points.length - 1].lat.toFixed(5)}, ${points[points.length - 1].lon.toFixed(5)}`);
  addLogEntry(`Distance: ${formatMeters(totalMeters)} over ${formatTime(elapsedSeconds)}`);

  updateDisplay();
}

// ── Display Update (shared by both modes) ─────────────────────────────────────

function updateDisplay() {
  const elapsed = state.elapsedSeconds;
  const earthKm = state.totalMeters / 1000;

  earthDistanceEl.textContent = formatMeters(state.totalMeters);
  earthTimeEl.textContent = formatTime(elapsed) + ' elapsed';

  const solar = computeSolarDistances(elapsed, state.latitude);

  orbitDistanceEl.textContent = formatKm(solar.orbitalKm);
  rotationDistanceEl.textContent = formatKm(solar.rotationKm);
  rotationSubEl.textContent = `at ${state.latitude.toFixed(1)}° lat`;
  galacticDistanceEl.textContent = formatKm(solar.galacticKm);

  renderer.setAngle(solar.orbitalAngleRad);

  if (elapsed > 5 || state.totalMeters > 0) {
    ratioBanner.style.display = 'block';
    const ratio = solar.orbitalKm / Math.max(earthKm, 0.001);
    let html = '';
    if (state.totalMeters > 0) {
      html += `While you travelled <strong>${formatMeters(state.totalMeters)}</strong> on Earth, `;
    } else {
      html += `In <strong>${formatTime(elapsed)}</strong>, `;
    }
    html += `Earth swept <strong>${formatKm(solar.orbitalKm)}</strong> along its orbital path around the Sun`;
    if (state.totalMeters > 0 && ratio > 1) {
      html += ` — that's <strong>${ratio.toFixed(0)}× farther</strong>`;
    }
    html += '.';
    ratioText.innerHTML = html;
  }

  if (elapsed > 5 || state.totalMeters > 0) {
    scaleSection.style.display = 'block';
    const max = solar.galacticKm;
    const youPct     = max > 0 ? Math.min(100, (earthKm / max) * 100) : 0;
    const orbitPct   = max > 0 ? Math.min(100, (solar.orbitalKm / max) * 100) : 0;

    youBar.style.width     = earthKm > 0        ? `${Math.max(youPct, 0.3)}%`   : '0';
    orbitBar.style.width   = solar.orbitalKm > 0 ? `${Math.max(orbitPct, 0.3)}%` : '0';
    galacticBar.style.width = '100%';

    youBarLabel.textContent     = formatMeters(state.totalMeters);
    orbitBarLabel.textContent   = formatKm(solar.orbitalKm);
    galacticBarLabel.textContent = formatKm(solar.galacticKm);

    funFacts.innerHTML = generateFacts(state.totalMeters, solar.orbitalKm, solar.galacticKm, elapsed)
      .map(f => `<div class="fun-fact">${f}</div>`).join('');
  }
}

// ── Display Reset ─────────────────────────────────────────────────────────────

function resetDisplay() {
  state.totalMeters = 0;
  state.elapsedSeconds = 0;
  state.latitude = 0;
  state.points = [];

  earthDistanceEl.textContent   = '0 m';
  earthTimeEl.textContent       = '0s elapsed';
  orbitDistanceEl.textContent   = '0 km';
  rotationDistanceEl.textContent = '0 km';
  galacticDistanceEl.textContent = '0 km';

  ratioBanner.style.display  = 'none';
  scaleSection.style.display = 'none';
  logSection.style.display   = 'none';
  logEntries.innerHTML = '';
  renderer.setAngle(0);
}

// ── Status Helper ─────────────────────────────────────────────────────────────

function setStatus(type, text) {
  statusLabel.textContent = text;
  statusDot.className = 'status-dot';
  if (type === 'active') statusDot.classList.add('active');
  if (type === 'error')  statusDot.classList.add('error');
}

// ── Journey Log ───────────────────────────────────────────────────────────────

function addLogEntry(msg, lat, lon) {
  logSection.style.display = 'block';
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span>${time}</span> — ${msg}${lat !== undefined ? ` (${lat.toFixed(5)}, ${lon.toFixed(5)})` : ''}`;
  logEntries.prepend(entry);
  while (logEntries.children.length > 50) logEntries.removeChild(logEntries.lastChild);
}

// ── Init ──────────────────────────────────────────────────────────────────────

setStatus('ready', 'Ready to track');
