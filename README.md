# Solar GPS

**See your journey on a cosmic scale.**

Solar GPS tracks your movement via GPS and shows you how far Earth travelled through the solar system during the same time — because while you walked 2 km to the shops, Earth swept ~53,000 km along its orbital path.

## What it shows

| Metric | Source | Speed |
|---|---|---|
| Your distance | GPS (Haversine) | Your pace |
| Earth's orbital arc | Time × orbital speed | 29.78 km/s |
| Earth's rotation arc | Time × rotation speed × cos(latitude) | ~0.46 km/s at equator |
| Galactic travel | Time × Solar System speed | ~220 km/s |

The canvas renders a live top-down view of the solar system, with an orange arc showing exactly how far Earth moved along its orbit during your journey.

## Serving the site

> **HTTPS is required.** Browsers block the Geolocation API on plain `http://` or `file://`. You must serve over HTTPS for GPS tracking to work.

### Option 1 — GitHub Pages (recommended, free)

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to **Settings → Pages** in the GitHub repository.
3. Under *Source*, choose **Deploy from a branch**, select `main` (or whichever branch), root folder `/`.
4. Save. GitHub gives you a URL like `https://your-username.github.io/solar-gps/` within ~60 seconds.
5. No build step needed — pure static files.

### Option 2 — Netlify (free, drag-and-drop)

1. Go to [netlify.com](https://netlify.com) and sign in.
2. Drag the project folder onto the Netlify dashboard.
3. Get an instant HTTPS URL. Or connect your GitHub repo for auto-deploy on push.

### Option 3 — Vercel (free)

```bash
npm i -g vercel
vercel   # follow prompts, deploys in ~10s
```

### Option 4 — Local development (no GPS, but works for UI testing)

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# Then open http://localhost:8080 — GPS won't work (needs HTTPS)
# Use a local HTTPS tunnel for full testing:
npx localtunnel --port 8080
```

## File structure

```
solar-gps/
├── index.html   — markup and layout
├── style.css    — dark space theme, responsive grid
├── solar.js     — physics constants, distance calculations, GPX parser, canvas renderer
├── app.js       — GPS tracking, GPX upload, demo route, UI updates
└── demo.gpx     — sample route: London South Bank Walk (Tower Bridge → London Eye, 3.7 km)
```

## GPX file support

The **Upload GPX** tab accepts `.gpx` files exported from any app that follows the GPX 1.0 or 1.1 standard:

| App | How to export |
|---|---|
| Strava | Activity page → ··· → Export GPX |
| Garmin Connect | Activity → Export Original |
| AllTrails | Completed hike → Export → GPX |
| iPhone Health / Workouts | Use a third-party exporter app |
| Google Maps Timeline | Google Takeout → Location History → Semantic Location History |

Files without timestamps (e.g. planned routes) are supported — elapsed time is estimated from distance at a walking pace (1.4 m/s).

## Physics

- **Earth orbital speed:** 29.78 km/s (NASA planetary fact sheet)
- **Earth rotation at equator:** 0.4651 km/s, scales with `cos(latitude)`
- **Solar System galactic speed:** ~220 km/s around the Milky Way centre
- **GPS noise filter:** position updates smaller than the reported GPS accuracy radius are discarded to avoid counting jitter while stationary

---

## Changelog

### v0.2 — GPX file upload + demo route

- **Upload GPX** tab: drag-and-drop or browse for a `.gpx` file from Strava, Garmin, AllTrails, etc.
- **GPX parser** (`parseGPX` / `processRoute` in `solar.js`): handles GPX 1.0 & 1.1, track points, route points, and waypoints; gracefully handles files with no timestamps
- **Demo route**: built-in London South Bank Walk (Tower Bridge → London Eye, 3.7 km, 48 min) — try the site instantly with no GPS or file needed
- `demo.gpx` file included in the repo as a download / format reference
- Mode switcher between **Live GPS** and **Upload GPX** — switching modes resets the display
- File info card shows point count, duration, distance, and a warning when timestamps are absent

### v0.1 — Initial release

- GPS tracking via `navigator.geolocation.watchPosition` with high-accuracy mode
- Live stats: your distance, Earth's orbital arc, rotation arc (latitude-adjusted), galactic travel
- Top-down solar system canvas renderer with animated Earth arc
- Proportional scale bars comparing your distance vs orbital vs galactic
- Auto-generated comparison facts (e.g. "Earth orbits 21,000× faster than you walked")
- GPS noise filtering — discards jitter smaller than reported accuracy
- Journey log with timestamps and coordinates
- Responsive layout, works on mobile
