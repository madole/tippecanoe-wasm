// tippecanoe-worker.js
// Web Worker that loads the tippecanoe WASM module and runs processing jobs.
// Messages:
//   IN:  { type: 'run', inputData: Uint8Array, inputName: string, args: string[], outputFormat: 'pmtiles'|'mbtiles' }
//   OUT: { type: 'progress', message: string }
//   OUT: { type: 'done', output: Uint8Array, format: string }
//   OUT: { type: 'error', message: string }

importScripts('tippecanoe-web.js');

function getInputExtension(filename) {
  var lower = filename.toLowerCase();
  if (lower.endsWith('.geojson.gz') || lower.endsWith('.json.gz')) return '.geojson.gz';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return '.geojson';
  if (lower.endsWith('.geojsonl') || lower.endsWith('.geojsonld') || lower.endsWith('.ndjson')) return '.geojson';
  if (lower.endsWith('.fgb')) return '.fgb';
  if (lower.endsWith('.csv')) return '.csv';
  return '.geojson';
}

self.onmessage = async function (e) {
  const { type, inputData, inputName, args, outputFormat } = e.data;
  if (type !== 'run') return;

  try {
    const ext = outputFormat === 'pmtiles' ? '.pmtiles' : '.mbtiles';
    const inputExt = getInputExtension(inputName || 'input.geojson');
    const inputPath = '/input' + inputExt;
    const outputPath = '/output' + ext;

    const module = await Tippecanoe({
      print(text) {
        self.postMessage({ type: 'progress', message: text });
      },
      printErr(text) {
        self.postMessage({ type: 'progress', message: text });
      },
    });

    module.FS.writeFile(inputPath, inputData);

    const fullArgs = [
      'tippecanoe',
      '-o', outputPath,
      '-f',
      ...args,
      inputPath,
    ];

    try {
      module.callMain(fullArgs);
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'status' in err) {
        if (err.status !== 0) {
          self.postMessage({ type: 'error', message: 'Tippecanoe exited with code ' + err.status });
          return;
        }
      } else if (typeof err === 'number' && err !== 0) {
        self.postMessage({ type: 'error', message: 'Tippecanoe exited with code ' + err });
        return;
      } else if (typeof err !== 'number' && !(typeof err === 'object' && 'status' in err)) {
        throw err;
      }
    }

    let output;
    try {
      output = module.FS.readFile(outputPath);
    } catch (fsErr) {
      self.postMessage({ type: 'error', message: 'No output file produced. Check your input data.' });
      return;
    }

    self.postMessage(
      { type: 'done', output: output, format: outputFormat },
      [output.buffer]
    );
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
