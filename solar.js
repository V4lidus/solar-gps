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

// ── Canvas Renderer ──────────────────────────────────────────────────────────

class SolarRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.angleRad = 0;    // how far Earth swept on its orbit
    this.startAngle = Math.PI * 1.1; // starting position on orbit circle
    this.animFrame = null;
    this.animProgress = 0;
    this.targetAngle = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.W = rect.width;
    this.H = rect.height;
  }

  setAngle(rad) {
    this.targetAngle = Math.min(rad, Math.PI * 1.95); // cap at ~350 degrees
  }

  _loop() {
    this.animProgress += (this.targetAngle - this.animProgress) * 0.08;
    this._draw(this.animProgress);
    requestAnimationFrame(() => this._loop());
  }

  _draw(arcAngle) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const orbitR = Math.min(W, H) * 0.38;
    const sunR = Math.min(W, H) * 0.06;
    const earthR = 6;

    ctx.clearRect(0, 0, W, H);

    // Starfield
    this._drawStars(W, H);

    // Orbit ring (full ellipse, faint)
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sun
    const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 1.5);
    sunGrad.addColorStop(0, '#fff7cc');
    sunGrad.addColorStop(0.3, '#ffd700');
    sunGrad.addColorStop(0.7, '#ff9500');
    sunGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();

    // Sun label
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.font = `bold ${Math.max(10, sunR * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Sun', cx, cy + sunR + 14);

    // Earth journey arc (orange glow)
    if (arcAngle > 0.001) {
      const arcStart = this.startAngle;
      const arcEnd = arcStart + arcAngle;

      // Glowing trail
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, arcStart, arcEnd);
      ctx.strokeStyle = '#ff7c43';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff7c43';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Start marker (small dot)
      const sx = cx + orbitR * Math.cos(arcStart);
      const sy = cy + orbitR * Math.sin(arcStart);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,124,67,0.5)';
      ctx.fill();

      // Start label
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const startLabelX = cx + (orbitR + 18) * Math.cos(arcStart);
      const startLabelY = cy + (orbitR + 18) * Math.sin(arcStart);
      ctx.fillText('Start', startLabelX, startLabelY);

      // Current Earth position
      const ex = cx + orbitR * Math.cos(arcEnd);
      const ey = cy + orbitR * Math.sin(arcEnd);

      // Earth glow
      const earthGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 18);
      earthGlow.addColorStop(0, 'rgba(74,158,255,0.4)');
      earthGlow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(ex, ey, 18, 0, Math.PI * 2);
      ctx.fillStyle = earthGlow;
      ctx.fill();

      // Earth
      ctx.beginPath();
      ctx.arc(ex, ey, earthR, 0, Math.PI * 2);
      ctx.fillStyle = '#4a9eff';
      ctx.fill();

      // Earth label
      ctx.fillStyle = '#4a9eff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const labelOffset = earthR + 14;
      const labelAngle = arcEnd + (arcEnd > Math.PI * 1.5 ? -0.3 : 0.3);
      ctx.fillText('Now', ex + labelOffset * Math.cos(labelAngle) * 0.5, ey - labelOffset);
    } else {
      // Default Earth position when no tracking
      const ex = cx + orbitR * Math.cos(this.startAngle);
      const ey = cy + orbitR * Math.sin(this.startAngle);
      ctx.beginPath();
      ctx.arc(ex, ey, earthR, 0, Math.PI * 2);
      ctx.fillStyle = '#4a9eff';
      ctx.fill();
    }
  }

  _drawStars(W, H) {
    // Seeded star positions (deterministic)
    if (!this._stars) {
      this._stars = [];
      const seed = 42;
      let s = seed;
      const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
      for (let i = 0; i < 120; i++) {
        this._stars.push({ x: rand(), y: rand(), r: rand() * 1.5 + 0.3, a: rand() * 0.6 + 0.2 });
      }
    }
    this.ctx.save();
    for (const star of this._stars) {
      this.ctx.beginPath();
      this.ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255,255,255,${star.a})`;
      this.ctx.fill();
    }
    this.ctx.restore();
  }
}
