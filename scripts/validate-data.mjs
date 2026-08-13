import { formatDatasetValidationReport, readDatasetManifest, validateDataset } from '../src/aurion/backtest/datasetValidation.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.symbol || !args.data) throw new Error('Usage: npm run validate:data -- --symbol BTCUSDT --data ./data/BTCUSDT');
const result = await validateDataset({ symbol: args.symbol, dataDir: args.data });
console.log(formatDatasetValidationReport(result));
try {
  const manifest = await readDatasetManifest(args.data);
  console.log(`Manifest: found (${manifest.symbol ?? 'unknown symbol'})`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.log('Manifest: not found (optional manifest.json)');
}
if (!result.pass) process.exitCode = 1;
