import { runBacktest, formatBacktestReport } from '../src/aurion/backtest/index.mjs';
function candles(tfMs, count, slope = 0.45) {
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * slope + Math.sin(i / 7) * 1.5;
    return { time: start + i * tfMs, closeTime: start + (i + 1) * tfMs - 1, open: close - 0.2, high: close + 1.1, low: close - 1.1, close, volume: 1000 + i };
  });
}
const result = await runBacktest({
  symbol: 'BTCUSDT',
  fourHourCandles: candles(4 * 60 * 60 * 1000, 260),
  oneHourCandles: candles(60 * 60 * 1000, 1100),
  fifteenMinuteCandles: candles(15 * 60 * 1000, 4400),
});
console.log(formatBacktestReport(result));
