// ── Solar System Physics Constants ──────────────────────────────────────────

const SOLAR = {
  // Earth's mean orbital speed around the Sun (km/s)
  EARTH_ORBITAL_SPEED_KMS: 29.78,

  // Earth's equatorial rotation speed (km/s)
  EARTH_EQUATORIAL_ROTATION_KMS: 0.4651,

  // Solar System's speed around the Milky Way galactic center (km/s)
  GALACTIC_SPEED_KMS: 220,

  // Milky Way speed relative to the cosmic microwave background (km/s)
  CMB_SPEED_KMS: 600,

  // Earth's orbital radius (mean distance from Sun, in km)
  AU_KM: 149_597_870.7,

  // Earth's circumference at equator (km)
  EARTH_CIRCUMFERENCE_KM: 40_075,

  // Earth's mean orbital period (seconds)
  ORBITAL_PERIOD_S: 365.25 * 24 * 3600,
};

/**
 * Given elapsed seconds and user latitude, compute distances for each frame of reference.
 * All return values in km.
 */
function computeSolarDistances(elapsedSeconds, latitudeDeg = 0) {
  const latRad = (latitudeDeg * Math.PI) / 180;

  // Earth orbital arc (km)
  const orbitalKm = SOLAR.EARTH_ORBITAL_SPEED_KMS * elapsedSeconds;

  // Earth rotation arc at the user's latitude (slower near poles)
  const rotationSpeedAtLat = SOLAR.EARTH_EQUATORIAL_ROTATION_KMS * Math.cos(latRad);
  const rotationKm = rotationSpeedAtLat * elapsedSeconds;

  // Galactic travel (km)
  const galacticKm = SOLAR.GALACTIC_SPEED_KMS * elapsedSeconds;

  // CMB frame travel (km)
  const cmbKm = SOLAR.CMB_SPEED_KMS * elapsedSeconds;

  // Orbital angle swept (radians and degrees)
  const orbitalAngleRad = (2 * Math.PI * elapsedSeconds) / SOLAR.ORBITAL_PERIOD_S;
  const orbitalAngleDeg = orbitalAngleRad * (180 / Math.PI);

  return { orbitalKm, rotationKm, galacticKm, cmbKm, orbitalAngleRad, orbitalAngleDeg };
}

/**
 * Format a km distance into a human-readable string with appropriate units.
 */
function formatKm(km) {
  if (km < 0.001) return `${(km * 1_000_000).toFixed(0)} m`;
  if (km < 1) return `${(km * 1000).toFixed(1)} m`;
  if (km < 1_000) return `${km.toFixed(2)} km`;
  if (km < 1_000_000) return `${(km / 1_000).toFixed(1)}k km`;
  if (km < 1_000_000_000) return `${(km / 1_000_000).toFixed(3)}M km`;
  return `${(km / 1_000_000_000).toFixed(3)}B km`;
}

/**
 * Format meters into a human-readable string.
 */
function formatMeters(m) {
  if (m < 1000) return `${m.toFixed(1)} m`;
  if (m < 100_000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Format seconds into h/m/s string.
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Haversine formula — distance in meters between two GPS coordinates.
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Generate comparison facts given earth distance (meters) and orbital km.
 */
function generateFacts(earthMeters, orbitalKm, galacticKm, elapsedSeconds) {
  const facts = [];
  const earthKm = earthMeters / 1000;
  const ratio = orbitalKm / Math.max(earthKm, 0.001);

  if (ratio >= 1) {
    facts.push(`Earth's orbital path is <strong>${ratio.toFixed(0)}x</strong> longer than your journey.`);
  }

  // Moon distance: 384,400 km
  if (orbitalKm > 384_400) {
    const moons = Math.floor(orbitalKm / 384_400);
    facts.push(`Earth's orbital arc equals <strong>${moons}x</strong> the distance to the Moon.`);
  } else {
    const pct = ((orbitalKm / 384_400) * 100).toFixed(1);
    facts.push(`Earth's orbital arc is <strong>${pct}%</strong> of the distance to the Moon.`);
  }

  // Speed comparison: Earth orbits at ~29.78 km/s vs avg human ~1.4 m/s
  if (elapsedSeconds > 0) {
    const yourSpeedMs = earthMeters / elapsedSeconds;
    const earthOrbitalSpeedMs = SOLAR.EARTH_ORBITAL_SPEED_KMS * 1000;
    const speedRatio = earthOrbitalSpeedMs / Math.max(yourSpeedMs, 0.01);
    if (speedRatio > 1) {
      facts.push(`Earth orbits the Sun <strong>${speedRatio.toFixed(0)}x faster</strong> than you moved.`);
    }
  }

  // Galactic context
  if (galacticKm > 1_000) {
    facts.push(`The entire Solar System moved <strong>${formatKm(galacticKm)}</strong> through the Milky Way while you journeyed.`);
  }

  return facts;
}

// ── Route File Parsing ───────────────────────────────────────────────────────

/**
 * Detect format from filename extension or XML root tag, then parse.
 * Returns { points, name } — same shape from both parsers.
 */
function parseRouteFile(content, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'tcx') return parseTCX(content);
  // Detect TCX by root element in case extension is missing/wrong
  if (/<TrainingCenterDatabase[\s>]/.test(content)) return parseTCX(content);
  return parseGPX(content);
}

/**
 * Parse a TCX XML string (Garmin Training Center format).
 * Skips trackpoints without <Position> (e.g. indoor pause markers).
 */
function parseTCX(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid TCX file — could not parse XML.');
  }

  const trackpointEls = Array.from(doc.getElementsByTagName('Trackpoint'));
  if (trackpointEls.length === 0) {
    throw new Error('No trackpoints found. Make sure this is a valid TCX file.');
  }

  const points = trackpointEls
    .map(el => {
      const posEl = el.getElementsByTagName('Position')[0];
      if (!posEl) return null; // indoor pauses have no position
      const latEl = posEl.getElementsByTagName('LatitudeDegrees')[0];
      const lonEl = posEl.getElementsByTagName('LongitudeDegrees')[0];
      if (!latEl || !lonEl) return null;
      const lat = parseFloat(latEl.textContent.trim());
      const lon = parseFloat(lonEl.textContent.trim());
      const timeEl = el.getElementsByTagName('Time')[0];
      const timeMs = timeEl ? new Date(timeEl.textContent.trim()).getTime() : null;
      return { lat, lon, timeMs };
    })
    .filter(p => p !== null && !isNaN(p.lat) && !isNaN(p.lon));

  if (points.length < 2) {
    throw new Error('TCX file needs at least 2 trackpoints with position data.');
  }

  // Name: prefer "Sport Activity" label, fall back to the activity Id timestamp
  const activityEl = doc.getElementsByTagName('Activity')[0];
  const sport = activityEl ? activityEl.getAttribute('Sport') : null;
  const idEl = doc.getElementsByTagName('Id')[0];
  const name = sport
    ? `${sport} Activity`
    : (idEl ? idEl.textContent.trim() : null);

  return { points, name };
}

/**
 * Parse a GPX XML string into an array of {lat, lon, timeMs} points.
 * Tries trkpt → rtept → wpt in order. timeMs is null when absent.
 */
function parseGPX(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX file — could not parse XML.');
  }

  let pointEls = Array.from(doc.getElementsByTagName('trkpt'));
  if (pointEls.length === 0) pointEls = Array.from(doc.getElementsByTagName('rtept'));
  if (pointEls.length === 0) pointEls = Array.from(doc.getElementsByTagName('wpt'));

  if (pointEls.length === 0) {
    throw new Error('No track points found. Make sure this is a valid GPX file.');
  }

  const points = pointEls
    .map(el => {
      const lat = parseFloat(el.getAttribute('lat'));
      const lon = parseFloat(el.getAttribute('lon'));
      const timeEl = el.getElementsByTagName('time')[0];
      const timeMs = timeEl ? new Date(timeEl.textContent.trim()).getTime() : null;
      return { lat, lon, timeMs };
    })
    .filter(p => !isNaN(p.lat) && !isNaN(p.lon));

  if (points.length < 2) {
    throw new Error('GPX file needs at least 2 valid points.');
  }

  // Extract route name from <trk><name> or <metadata><name>
  const trkName = doc.getElementsByTagName('name')[0];
  const name = trkName ? trkName.textContent.trim() : null;

  return { points, name };
}

/**
 * Process an array of {lat, lon, timeMs} points into route summary stats.
 * If no timestamps present, estimates elapsed time from distance at walking pace.
 */
function processRoute(points) {
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += haversineMeters(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon,
    );
  }

  const hasTime = points.every(p => p.timeMs !== null && !isNaN(p.timeMs));
  let elapsedSeconds;
  if (hasTime) {
    elapsedSeconds = (points[points.length - 1].timeMs - points[0].timeMs) / 1000;
  } else {
    // Estimate at average walking speed: 1.4 m/s
    elapsedSeconds = totalMeters / 1.4;
  }

  return {
    totalMeters,
    elapsedSeconds: Math.max(elapsedSeconds, 1),
    latitude: points[0].lat,
    hasTime,
    pointCount: points.length,
  };
}

// ── Canvas Renderers ─────────────────────────────────────────────────────────

// Shared seeded starfield (deterministic, cached per seed)
const _STAR_CACHE = new Map();
function _drawStarfield(ctx, W, H, count, seed) {
  const key = `${seed}-${count}`;
  if (!_STAR_CACHE.has(key)) {
    const stars = [];
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
    for (let i = 0; i < count; i++) {
      stars.push({ x: rand(), y: rand(), r: rand() * 1.4 + 0.2, a: rand() * 0.55 + 0.15 });
    }
    _STAR_CACHE.set(key, stars);
  }
  ctx.save();
  for (const s of _STAR_CACHE.get(key)) {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  }
  ctx.restore();
}

// Shared canvas setup helper
function _initCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1;
  function resize() {
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = rect.width;
    H = rect.height;
  }
  resize();
  window.addEventListener('resize', resize);
  return { ctx, getW: () => W, getH: () => H };
}

// ── Orbital Arc Renderer ─────────────────────────────────────────────────────
// Dynamically zooms so the arc is always visible regardless of duration.
// For a 48-min walk the arc is only 0.028° of the full orbit — invisible at
// full-orbit scale — so we zoom in until the arc spans at least ~18% of canvas.

class OrbitalRenderer {
  constructor(canvas) {
    this._c = _initCanvas(canvas);
    this.targetAngle = 0;
    this.animAngle   = 0;
    this._loop();
  }

  setValues(orbitalAngleRad) {
    this.targetAngle = Math.min(orbitalAngleRad, Math.PI * 1.95);
  }

  _loop() {
    this.animAngle += (this.targetAngle - this.animAngle) * 0.06;
    const { getW, getH } = this._c;
    if (getW() > 1) this._draw(this.animAngle, getW(), getH());
    requestAnimationFrame(() => this._loop());
  }

  _draw(angle, W, H) {
    const { ctx } = this._c;
    ctx.clearRect(0, 0, W, H);
    _drawStarfield(ctx, W, H, 70, 42);

    const START = Math.PI * 1.1;
    const end   = START + angle;
    const mid   = START + angle / 2;

    // Zoom so the arc always fills ≥18% of the smaller canvas dimension.
    // For angle=0 show a fixed default view (0.4 rad of orbit).
    const MIN_ARC_PX = Math.min(W, H) * 0.18;
    const orbitR = angle > 1e-9
      ? Math.max(MIN_ARC_PX / angle, Math.min(W, H) * 0.35)
      : Math.min(W, H) * 0.38;

    // How much of the orbit arc fits inside the canvas at this zoom
    const halfChord = Math.min(W, H) * 0.44;
    const viewAngle = angle > 1e-9
      ? 2 * Math.asin(Math.min(halfChord / orbitR, 0.9999))
      : 0.4;

    // Keep the arc midpoint at canvas centre
    const cx = W * 0.5 - orbitR * Math.cos(mid);
    const cy = H * 0.5 - orbitR * Math.sin(mid);

    // Faint dashed orbit track (only visible portion)
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, mid - viewAngle / 2, mid + viewAngle / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Journey arc
    if (angle > 1e-9) {
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, START, end);
      ctx.strokeStyle = '#ff7c43';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ff7c43';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Start dot
    const sx = cx + orbitR * Math.cos(START);
    const sy = cy + orbitR * Math.sin(START);
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = angle > 1e-9 ? 'rgba(255,124,67,0.85)' : '#4a9eff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Start', sx, sy - 10);

    // Earth dot at current position
    const ex = cx + orbitR * Math.cos(end);
    const ey = cy + orbitR * Math.sin(end);
    if (angle > 1e-9) {
      const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 16);
      glow.addColorStop(0, 'rgba(74,158,255,0.45)');
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(ex, ey, 16, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4a9eff';
      ctx.fill();
      ctx.fillStyle = '#4a9eff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Now', ex, ey - 12);
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4a9eff';
      ctx.fill();
    }

    // Sun: draw it if on-screen, otherwise show a directional arrow
    const sunOnScreen = cx > -30 && cx < W + 30 && cy > -30 && cy < H + 30;
    if (!sunOnScreen) {
      const dx = cx - W / 2, dy = cy - H / 2;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const reach = Math.min(W, H) * 0.26;
      const ax = W / 2 + (dx / d) * reach;
      const ay = H / 2 + (dy / d) * reach;
      ctx.fillStyle = 'rgba(255,215,0,0.8)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('☀', ax, ay + 4);
      ctx.fillStyle = 'rgba(255,215,0,0.45)';
      ctx.font = '9px sans-serif';
      ctx.fillText('Sun →', ax, ay + 16);
    } else {
      const sr = Math.min(W, H) * 0.07;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 1.6);
      g.addColorStop(0, '#fff7cc');
      g.addColorStop(0.35, '#ffd700');
      g.addColorStop(0.7, '#ff9500');
      g.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, sr * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,215,0,0.6)';
      ctx.font = `bold ${Math.max(9, sr * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Sun', cx, cy + sr + 13);
    }

    // Info bar
    const pct    = (angle / (2 * Math.PI)) * 100;
    const pctStr = pct < 0.0001 ? pct.toExponential(2) + '%'
                 : pct < 0.01   ? pct.toFixed(5) + '%'
                 :                 pct.toFixed(3) + '%';
    const zoom = Math.max(1, Math.round(orbitR / (Math.min(W, H) * 0.38)));

    ctx.fillStyle = 'rgba(8,8,18,0.75)';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = '#ff7c43';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${pctStr} of full orbit`, 10, H - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = '9px sans-serif';
    ctx.fillText(zoom > 1 ? `${zoom}× zoom to show arc` : 'Full orbit view', 10, H - 7);
  }
}

// ── Earth Rotation Renderer ──────────────────────────────────────────────────
// Top-down (north-pole) view of Earth. Shows how far Earth has rotated during
// the journey. 48 min = 12° of rotation — clearly visible at this scale.

class RotationRenderer {
  constructor(canvas) {
    this._c = _initCanvas(canvas);
    this.targetAngle = 0;
    this.animAngle   = 0;
    this.latitude    = 0;
    this._loop();
  }

  setValues(rotationAngleRad, latitudeDeg) {
    this.targetAngle = Math.min(rotationAngleRad, Math.PI * 1.95);
    this.latitude    = latitudeDeg || 0;
  }

  _loop() {
    this.animAngle += (this.targetAngle - this.animAngle) * 0.06;
    const { getW, getH } = this._c;
    if (getW() > 1) this._draw(this.animAngle, this.latitude, getW(), getH());
    requestAnimationFrame(() => this._loop());
  }

  _draw(angle, latDeg, W, H) {
    const { ctx } = this._c;
    ctx.clearRect(0, 0, W, H);
    _drawStarfield(ctx, W, H, 50, 99);

    const cx = W * 0.5, cy = H * 0.5;
    const earthR  = Math.min(W, H) * 0.36;
    const latRad  = (latDeg * Math.PI) / 180;
    const arcR    = Math.abs(latDeg) > 3 ? earthR * Math.cos(latRad) : earthR;

    // Earth disc (night side shading)
    const eg = ctx.createRadialGradient(cx - earthR * 0.25, cy - earthR * 0.25, 0, cx, cy, earthR);
    eg.addColorStop(0, '#1e4a7a');
    eg.addColorStop(0.55, '#0d2a50');
    eg.addColorStop(1, '#060e20');
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,158,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Equator ring (faint)
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Latitude circle
    if (Math.abs(latDeg) > 3 && Math.abs(latDeg) < 87) {
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Rotation arc — Earth spins counterclockwise from north pole view,
    // but we show it clockwise in canvas coords for clarity (direction label explains)
    const START_A = -Math.PI / 2; // top = North
    const endA    = START_A + angle;

    if (angle > 0.001) {
      // Filled sector
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, arcR, START_A, endA);
      ctx.closePath();
      ctx.fillStyle = 'rgba(79,255,176,0.1)';
      ctx.fill();

      // Arc edge
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, START_A, endA);
      ctx.strokeStyle = '#4fffb0';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#4fffb0';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spoke lines
      const spoke = (a, alpha) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + arcR * Math.cos(a), cy + arcR * Math.sin(a));
        ctx.strokeStyle = `rgba(79,255,176,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      spoke(START_A, 0.35);
      spoke(endA, 0.7);

      // Current position dot
      const px = cx + arcR * Math.cos(endA);
      const py = cy + arcR * Math.sin(endA);
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4fffb0';
      ctx.shadowColor = '#4fffb0';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4fffb0';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const nl = arcR + 16;
      ctx.fillText('Now', cx + nl * Math.cos(endA), cy + nl * Math.sin(endA));
    }

    // Compass labels
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    const cp = earthR + 14;
    ctx.fillText('N', cx, cy - cp + 4);
    ctx.fillText('S', cx, cy + cp + 4);
    ctx.fillText('E', cx + cp, cy + 4);
    ctx.fillText('W', cx - cp, cy + 4);

    // Lat label
    if (Math.abs(latDeg) > 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? 'N' : 'S'}`, W - 8, 14);
    }

    // Info bar
    const pct    = (angle / (2 * Math.PI)) * 100;
    const pctStr = pct < 0.01 ? pct.toFixed(4) + '%' : pct.toFixed(2) + '%';

    ctx.fillStyle = 'rgba(8,8,18,0.75)';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = '#4fffb0';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${pctStr} of full rotation`, 10, H - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = '9px sans-serif';
    ctx.fillText('North-pole view · full rotation = 24 h', 10, H - 7);
  }
}

// ── Galactic Trail Renderer ──────────────────────────────────────────────────
// Linear trail showing how far the Solar System travelled through the Milky Way.
// The arc angle of the galactic orbit is ≈0 for any reasonable journey, so we
// visualise the raw km distance against a scale bar with reference markers.

class GalacticRenderer {
  constructor(canvas) {
    this._c = _initCanvas(canvas);
    this.targetKm = 0;
    this.animKm   = 0;
    this._loop();
  }

  setValues(galacticKm) {
    this.targetKm = galacticKm;
  }

  _loop() {
    this.animKm += (this.targetKm - this.animKm) * 0.06;
    const { getW, getH } = this._c;
    if (getW() > 1) this._draw(this.animKm, getW(), getH());
    requestAnimationFrame(() => this._loop());
  }

  _draw(km, W, H) {
    const { ctx } = this._c;
    ctx.clearRect(0, 0, W, H);

    // Starfield with horizontal motion streaks
    _drawStarfield(ctx, W, H, 65, 77);
    ctx.save();
    let rs = 9999;
    const rr = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 0xffffffff; };
    for (let i = 0; i < 22; i++) {
      const x = rr() * W, y = rr() * H;
      const len = rr() * 18 + 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len, y);
      ctx.strokeStyle = `rgba(255,255,255,${rr() * 0.2 + 0.04})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();

    // Scale: choose a round reference that fits nicely
    const MOON = 384_400;
    const AU   = 149_597_870;
    let scaleMax = MOON;
    if (km > AU)        scaleMax = km * 1.25;
    else if (km > MOON) scaleMax = AU   * 1.15;
    else                scaleMax = MOON * 1.15;

    const refs = [
      { km: MOON, label: 'Moon (384k km)', color: 'rgba(200,200,220,0.55)' },
      { km: AU,   label: '1 AU · Sun',     color: 'rgba(255,215,0,0.5)'   },
    ];

    // Track geometry
    const ty = H * 0.52;
    const th = Math.max(10, Math.min(H * 0.1, 14));
    const tx0 = W * 0.06, tx1 = W * 0.94;
    const tw  = tx1 - tx0;
    const toX = k => tx0 + (k / scaleMax) * tw;

    // Track background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(tx0, ty - th / 2, tw, th, 4);
    ctx.fill();

    // Reference markers
    for (const ref of refs) {
      if (ref.km > scaleMax * 1.02) continue;
      const rx = toX(ref.km);
      ctx.beginPath();
      ctx.moveTo(rx, ty - th - 2);
      ctx.lineTo(rx, ty + th + 2);
      ctx.strokeStyle = ref.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ref.color;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ref.label, rx, ty - th - 6);
    }

    // Filled trail
    const trailX = Math.min(toX(km), tx1 - 4);
    if (km > 0) {
      const tg = ctx.createLinearGradient(tx0, 0, trailX, 0);
      tg.addColorStop(0, 'rgba(180,122,255,0.25)');
      tg.addColorStop(1, '#b47aff');
      ctx.beginPath();
      ctx.roundRect(tx0, ty - th / 2, Math.max(trailX - tx0, 4), th, 4);
      ctx.fillStyle = tg;
      ctx.fill();
    }

    // Solar system dot
    const dx = Math.max(trailX, tx0 + 10);
    const glow = ctx.createRadialGradient(dx, ty, 0, dx, ty, 22);
    glow.addColorStop(0, 'rgba(180,122,255,0.55)');
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(dx, ty, 22, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀', dx, ty + 5);

    // Distance label above dot
    if (km > 0) {
      ctx.fillStyle = '#b47aff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatKm(km), dx, ty - 26);
    }

    // Axis start/end labels
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Start', tx0, ty + th + 14);
    ctx.textAlign = 'right';
    ctx.fillText(formatKm(scaleMax), tx1, ty + th + 14);

    // Galactic orbit context — show % only when it's meaningful (long journeys)
    const galPct = (km / (SOLAR.GALACTIC_SPEED_KMS * 225e6 * 365.25 * 86400)) * 100;

    // Info bar
    ctx.fillStyle = 'rgba(8,8,18,0.75)';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = '#b47aff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(km > 0 ? `${formatKm(km)} through the Milky Way` : 'Galactic trail', 10, H - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = '9px sans-serif';
    ctx.fillText('Solar System speed: ~220 km/s', 10, H - 7);
  }
}

