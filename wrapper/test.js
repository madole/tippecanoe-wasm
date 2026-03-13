const { runTippecanoe } = require('./index.js');
const fs = require('fs');

const geojson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [151.2093, -33.8688] },
      properties: { name: 'Sydney' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [144.9631, -37.8136] },
      properties: { name: 'Melbourne' },
    },
  ],
});

async function main() {
  console.log('Running Tippecanoe via WASM...');
  const mbtiles = await runTippecanoe(
    Buffer.from(geojson),
    ['-z', '5', '--no-tile-size-limit', '-f']
  );
  console.log(`Success! .mbtiles size: ${mbtiles.byteLength} bytes`);

  const outPath = '/tmp/test-output.mbtiles';
  fs.writeFileSync(outPath, mbtiles);
  console.log(`Written to ${outPath}`);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
