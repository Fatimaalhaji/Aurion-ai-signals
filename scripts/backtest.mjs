import { runBacktest, formatBacktestReport } from '../src/aurion/backtest/index.mjs';
import { loadHistoricalDataset } from '../src/aurion/backtest/historicalData.mjs';

function candles(tfMs, count, slope = 0.45) {
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * slope + Math.sin(i / 7) * 1.5;
    return { time: start + i * tfMs, closeTime: start + (i + 1) * tfMs - 1, open: close - 0.2, high: close + 1.1, low: close - 1.1, close, volume: 1000 + i };
  });
}

function parseArgs(argv) {
  const args = { sample: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sample') args.sample = true;
    else if (arg.startsWith('--')) args[arg.slice(2)] = argv[++i];
  }
  return args;
}

const BACKTEST_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const args = parseArgs(process.argv.slice(2));
const symbol = args.symbol ?? 'BTCUSDT';
if (!BACKTEST_SYMBOLS.includes(symbol)) throw new Error(`Unsupported symbol ${symbol}. Supported: ${BACKTEST_SYMBOLS.join(', ')}`);
const common = { symbol, feeRate: args.fee === undefined ? undefined : Number(args.fee), slippageRate: args.slippage === undefined ? undefined : Number(args.slippage) };
Object.keys(common).forEach((key) => common[key] === undefined && delete common[key]);

let input;
if (args.data && !args.sample) {
  input = { ...await loadHistoricalDataset({ symbol, dataDir: args.data, from: args.from, to: args.to }), ...common, strictSpacing: true };
} else {
  input = { ...common, symbol, synthetic: true, dataSource: 'generated deterministic candles', fourHourCandles: candles(4 * 60 * 60 * 1000, 260), oneHourCandles: candles(60 * 60 * 1000, 1100), fifteenMinuteCandles: candles(15 * 60 * 1000, 4400), dataQuality: { fourHourCandles: 260, oneHourCandles: 1100, fifteenMinuteCandles: 4400, skippedInvalidCandles: 0 } };
}
console.log(formatBacktestReport(await runBacktest(input)));
