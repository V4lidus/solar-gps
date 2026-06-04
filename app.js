// ── State ────────────────────────────────────────────────────────────────────

const state = {
  tracking: false,
  watchId: null,
  startTime: null,
  lastPos: null,        // { lat, lon, accuracy }
  totalMeters: 0,
  elapsedSeconds: 0,
  latitude: 0,
  points: [],           // log of GPS fixes
  timerInterval: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const resetBtn = $('resetBtn');
const statusDot = $('statusDot');
const statusLabel = $('statusLabel');
const accuracyInfo = $('accuracyInfo');
const accuracyLabel = $('accuracyLabel');

const earthDistanceEl = $('earthDistance');
const earthTimeEl = $('earthTime');
const orbitDistanceEl = $('orbitDistance');
const rotationDistanceEl = $('rotationDistance');
const rotationSubEl = $('rotationSub');
const galacticDistanceEl = $('galacticDistance');

const ratioBanner = $('ratioBanner');
const ratioText = $('ratioText');
const scaleSection = $('scaleSection');
const youBar = $('youBar');
const orbitBar = $('orbitBar');
const galacticBar = $('galacticBar');
const youBarLabel = $('youBarLabel');
const orbitBarLabel = $('orbitBarLabel');
const galacticBarLabel = $('galacticBarLabel');
const funFacts = $('funFacts');

const logSection = $('logSection');
const logEntries = $('logEntries');

// ── Canvas Renderer init ─────────────────────────────────────────────────────

const renderer = new SolarRenderer($('solarCanvas'));

// ── GPS Tracking ─────────────────────────────────────────────────────────────

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
resetBtn.addEventListener('click', resetTracking);

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

  // Live elapsed-time ticker
  state.timerInterval = setInterval(() => {
    if (state.startTime) {
      state.elapsedSeconds = (Date.now() - state.startTime) / 1000;
      updateDisplay();
    }
  }, 1000);

  const options = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  };

  state.watchId = navigator.geolocation.watchPosition(
    onPosition,
    onGeoError,
    options,
  );
}

function stopTracking() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  clearInterval(state.timerInterval);
  state.tracking = false;
  state.elapsedSeconds = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;

  setStatus('done', `Journey complete — ${formatTime(state.elapsedSeconds)}`);
  startBtn.disabled = false;
  stopBtn.disabled = true;

  accuracyInfo.style.display = 'none';
  updateDisplay();
  addLogEntry(`Journey stopped. Total: ${formatMeters(state.totalMeters)} in ${formatTime(state.elapsedSeconds)}`);
}

function resetTracking() {
  stopTracking();
  state.totalMeters = 0;
  state.elapsedSeconds = 0;
  state.startTime = null;
  state.lastPos = null;
  state.points = [];

  setStatus('ready', 'Ready to track');
  startBtn.disabled = false;
  stopBtn.disabled = true;

  earthDistanceEl.textContent = '0 m';
  earthTimeEl.textContent = '0s elapsed';
  orbitDistanceEl.textContent = '0 km';
  rotationDistanceEl.textContent = '0 km';
  galacticDistanceEl.textContent = '0 km';

  ratioBanner.style.display = 'none';
  scaleSection.style.display = 'none';
  logSection.style.display = 'none';
  logEntries.innerHTML = '';
  renderer.setAngle(0);
  accuracyInfo.style.display = 'none';
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;

  state.latitude = latitude;
  accuracyLabel.textContent = `GPS accuracy: ±${accuracy.toFixed(0)} m`;
  accuracyInfo.style.display = 'block';

  // Only count movement if accuracy is reasonable
  if (state.lastPos) {
    const dist = haversineMeters(state.lastPos.lat, state.lastPos.lon, latitude, longitude);
    // Filter out GPS noise: skip if distance is less than the accuracy (likely stationary)
    if (dist > Math.min(accuracy, 15)) {
      state.totalMeters += dist;
      addLogEntry(`+${dist.toFixed(1)} m (accuracy ±${accuracy.toFixed(0)} m)`, latitude, longitude);
    }
  } else {
    setStatus('active', 'Tracking your journey');
    addLogEntry(`Journey started at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  }

  state.lastPos = { lat: latitude, lon: longitude, accuracy };
  state.points.push({ lat: latitude, lon: longitude, t: Date.now() });

  updateDisplay();
}

function onGeoError(err) {
  const messages = {
    1: 'Location access denied. Please allow location access.',
    2: 'Location unavailable. Check device settings.',
    3: 'Location request timed out.',
  };
  setStatus('error', messages[err.code] || 'Location error');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearInterval(state.timerInterval);
}

// ── Display Update ────────────────────────────────────────────────────────────

function updateDisplay() {
  const elapsed = state.elapsedSeconds;
  const earthKm = state.totalMeters / 1000;

  // Earth distance
  earthDistanceEl.textContent = formatMeters(state.totalMeters);
  earthTimeEl.textContent = formatTime(elapsed) + ' elapsed';

  // Solar calculations
  const solar = computeSolarDistances(elapsed, state.latitude);

  orbitDistanceEl.textContent = formatKm(solar.orbitalKm);
  rotationDistanceEl.textContent = formatKm(solar.rotationKm);
  rotationSubEl.textContent = `at ${state.latitude.toFixed(1)}° lat`;
  galacticDistanceEl.textContent = formatKm(solar.galacticKm);

  // Update canvas arc
  renderer.setAngle(solar.orbitalAngleRad);

  // Ratio banner (show once there's some data)
  if (elapsed > 5 || state.totalMeters > 0) {
    ratioBanner.style.display = 'block';
    const ratio = solar.orbitalKm / Math.max(earthKm, 0.001);

    let bannerHtml = '';
    if (state.totalMeters > 0) {
      bannerHtml += `While you travelled <strong>${formatMeters(state.totalMeters)}</strong> on Earth, `;
    } else {
      bannerHtml += `In <strong>${formatTime(elapsed)}</strong>, `;
    }
    bannerHtml += `Earth swept <strong>${formatKm(solar.orbitalKm)}</strong> along its orbital path around the Sun`;
    if (state.totalMeters > 0 && ratio > 1) {
      bannerHtml += ` — that's <strong>${ratio.toFixed(0)}× farther</strong>`;
    }
    bannerHtml += `.`;
    ratioText.innerHTML = bannerHtml;
  }

  // Scale section
  if (elapsed > 5 || state.totalMeters > 0) {
    scaleSection.style.display = 'block';
    const max = solar.galacticKm;

    const youPct = max > 0 ? Math.min(100, (earthKm / max) * 100) : 0;
    const orbitPct = max > 0 ? Math.min(100, (solar.orbitalKm / max) * 100) : 0;
    const galacticPct = 100;

    // Minimum visible bar for non-zero values
    youBar.style.width = earthKm > 0 ? `${Math.max(youPct, 0.3)}%` : '0';
    orbitBar.style.width = solar.orbitalKm > 0 ? `${Math.max(orbitPct, 0.3)}%` : '0';
    galacticBar.style.width = `${galacticPct}%`;

    youBarLabel.textContent = formatMeters(state.totalMeters);
    orbitBarLabel.textContent = formatKm(solar.orbitalKm);
    galacticBarLabel.textContent = formatKm(solar.galacticKm);

    // Fun facts
    const facts = generateFacts(state.totalMeters, solar.orbitalKm, solar.galacticKm, elapsed);
    funFacts.innerHTML = facts.map(f => `<div class="fun-fact">${f}</div>`).join('');
  }
}

// ── Status helper ─────────────────────────────────────────────────────────────

function setStatus(type, text) {
  statusLabel.textContent = text;
  statusDot.className = 'status-dot';
  if (type === 'active') statusDot.classList.add('active');
  if (type === 'error') statusDot.classList.add('error');
}

// ── Journey Log ───────────────────────────────────────────────────────────────

function addLogEntry(msg, lat, lon) {
  logSection.style.display = 'block';
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span>${time}</span> — ${msg}${lat !== undefined ? ` (${lat.toFixed(5)}, ${lon.toFixed(5)})` : ''}`;
  logEntries.prepend(entry);

  // Keep last 50 entries
  while (logEntries.children.length > 50) {
    logEntries.removeChild(logEntries.lastChild);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

setStatus('ready', 'Ready to track');
