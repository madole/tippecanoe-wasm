// mbtiles-worker.js
// Web Worker that serves vector tiles from an in-memory MBTiles database using sql.js.
// Messages:
//   IN:  { type: 'load', data: Uint8Array }          — load an MBTiles file
//   IN:  { type: 'getTile', z: number, x: number, y: number, requestId: number }
//   OUT: { type: 'loaded', metadata: object }
//   OUT: { type: 'tile', data: Uint8Array|null, requestId: number }
//   OUT: { type: 'error', message: string }

importScripts('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js');

let db = null;

self.onmessage = async function (e) {
  const msg = e.data;

  if (msg.type === 'load') {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/' + file,
      });
      db = new SQL.Database(msg.data);

      // Read metadata
      const metadata = {};
      try {
        const rows = db.exec('SELECT name, value FROM metadata');
        if (rows.length > 0) {
          for (const row of rows[0].values) {
            metadata[row[0]] = row[1];
          }
        }
      } catch (_) {
        // metadata table may not exist
      }

      self.postMessage({ type: 'loaded', metadata });
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Failed to load MBTiles: ' + err.message });
    }
    return;
  }

  if (msg.type === 'getTile') {
    if (!db) {
      self.postMessage({ type: 'tile', data: null, requestId: msg.requestId });
      return;
    }

    try {
      // MBTiles uses TMS y-coordinate (flipped)
      const tmsY = (1 << msg.z) - 1 - msg.y;
      const stmt = db.prepare(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
      );
      stmt.bind([msg.z, msg.x, tmsY]);

      let data = null;
      if (stmt.step()) {
        data = stmt.get()[0];
      }
      stmt.free();

      if (data) {
        const bytes = new Uint8Array(data);
        self.postMessage({ type: 'tile', data: bytes, requestId: msg.requestId }, [bytes.buffer]);
      } else {
        self.postMessage({ type: 'tile', data: null, requestId: msg.requestId });
      }
    } catch (err) {
      self.postMessage({ type: 'tile', data: null, requestId: msg.requestId });
    }
    return;
  }
};
