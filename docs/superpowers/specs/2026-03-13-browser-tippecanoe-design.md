# Browser Tippecanoe — Design Spec

## Summary

Single-page HTML app that runs tippecanoe (compiled to WASM) entirely in the browser. Users upload GeoJSON, configure tiling parameters, and get live vector tile preview on an OpenLayers map. Supports PMTiles and MBTiles output with download.

## Architecture

Three layers:

1. **Browser WASM build** — tippecanoe recompiled with `-s ENVIRONMENT=web,worker`
2. **Single HTML page** (`web/index.html`) — no build tools, CDN deps, inline CSS/JS
3. **Two Web Workers:**
   - Tippecanoe worker: loads tippecanoe.wasm, runs processing
   - MBTiles worker: sql.js for serving tiles from MBTiles output

## UI Layout

Fixed 35/65 split. Left sidebar with controls, right panel with OpenLayers map. Dark developer tool aesthetic (GitHub dark theme colors).

### Left Sidebar Controls

- Drag-and-drop file upload zone + file picker
- Output format toggle: PMTiles / MBTiles
- Min/max zoom sliders (0–14)
- Checkboxes: drop densest, no tile size limit, coalesce densest, simplify geometry
- Layer name text input (optional)
- Generate button
- Progress log (tippecanoe stderr output)
- Download button (appears after generation)

### Right Panel

- OpenLayers map with dark basemap (CartoDB dark matter)
- Generated vector tile layer overlay
- Zoom controls
- Status bar: tile count, file size, zoom range
- Auto-fits bounds to generated data

## Data Flow

```
User drops GeoJSON
  → Main thread reads as ArrayBuffer
  → Posts to tippecanoe worker with CLI args
  → Worker: writes to MEMFS, calls main(), reads output
  → Posts result bytes back to main thread
  → PMTiles path: pmtiles.js protocol from Blob URL
  → MBTiles path: sql.js worker, custom OL tile source queries {z,x,y}
  → OpenLayers renders vector tiles
  → Download button saves blob
```

## Dependencies (CDN)

- OpenLayers (latest)
- ol-pmtiles (PMTiles protocol for OpenLayers)
- pmtiles.js
- sql.js (SQLite WASM for MBTiles serving)
- protomaps-themes-base (vector tile styling)

## Key Decisions

- No bundler — single self-contained HTML file
- Web Workers for tippecanoe and MBTiles tile serving
- stderr captured via Emscripten printErr callback for progress display
- Dark theme matching GitHub dark color palette
- Single-threaded WASM (no SharedArrayBuffer/COOP headers needed)

## Files to Create/Modify

- `tippecanoe/Makefile.wasm` — add browser build target
- `web/index.html` — the app
- `web/tippecanoe-worker.js` — tippecanoe WASM worker
- `web/mbtiles-worker.js` — sql.js MBTiles tile server worker
- `web/tippecanoe.js` + `web/tippecanoe.wasm` — browser build output
