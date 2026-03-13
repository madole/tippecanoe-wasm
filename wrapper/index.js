const path = require('path');

// Resolve the Emscripten-generated module factory
const createTippecanoe = require(path.resolve(__dirname, '..', 'tippecanoe', 'tippecanoe.js'));

/**
 * Run Tippecanoe on in-memory GeoJSON input and produce an in-memory .mbtiles output.
 *
 * A fresh WASM module is created for each invocation to avoid state leakage.
 *
 * @param {Buffer|Uint8Array} geojsonInput - Raw GeoJSON bytes
 * @param {string[]} [args=[]] - Tippecanoe CLI args (excluding -o and input path)
 * @returns {Promise<Buffer>} The output .mbtiles file as a Buffer
 */
async function runTippecanoe(geojsonInput, args = []) {
  const module = await createTippecanoe();

  const inputPath = '/input.geojson';
  const outputPath = '/output.mbtiles';

  // Write input GeoJSON into the virtual filesystem
  module.FS.writeFile(inputPath, geojsonInput);

  // Build argv: tippecanoe -o /output.mbtiles [user args] /input.geojson
  const fullArgs = [
    'tippecanoe',
    '-o', outputPath,
    ...args,
    inputPath,
  ];

  try {
    module.callMain(fullArgs);
  } catch (e) {
    // Emscripten throws on exit() — only rethrow if it's not an exit
    if (typeof e === 'object' && e !== null && 'status' in e) {
      // ExitStatus — check code
      if (e.status !== 0) {
        throw new Error(`Tippecanoe exited with code ${e.status}`);
      }
    } else if (typeof e === 'number') {
      // Older Emscripten versions throw the exit code as a number
      if (e !== 0) {
        throw new Error(`Tippecanoe exited with code ${e}`);
      }
    } else {
      throw e;
    }
  }

  // Read the output from the virtual filesystem
  let result;
  try {
    result = module.FS.readFile(outputPath);
  } catch (fsError) {
    throw new Error(
      'Tippecanoe did not produce an output file. ' +
      'Check that the input is valid GeoJSON and the arguments are correct.'
    );
  }

  return Buffer.from(result);
}

module.exports = { runTippecanoe };
