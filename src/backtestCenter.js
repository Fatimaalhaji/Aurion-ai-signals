import { runBacktest, DEFAULT_BACKTEST_OPTIONS } from './aurion/backtest/index.mjs';

const UI_STATES = ['Idle', 'Validating data', 'Running backtest', 'Completed', 'No dataset', 'Invalid dataset', 'Insufficient history', 'Backtest error'];
const TRADE_RESULTS = ['TP', 'SL', 'SL_AMBIGUOUS'];

const MS = { '4h': 14_400_000, '1h': 3_600_000, '15m': 900_000 };
const fmt = (value) => value === null || value === undefined ? 'n/a' : value instanceof Date ? value.toISOString() : String(value);
const money = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);
const percent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : 'n/a';

function sampleCandles(tfMs, count, slope = 0.45) {
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * slope + Math.sin(i / 7) * 1.5;
    return { time: start + i * tfMs, closeTime: start + (i + 1) * tfMs - 1, open: close - 0.2, high: close + 1.1, low: close - 1.1, close, volume: 1000 + i };
  });
}

function inspectCandles(candles, tf, required = 220) {
  const errors = [];
  if (!candles?.length) errors.push('Missing timeframe');
  for (let i = 0; i < (candles ?? []).length; i += 1) {
    const c = candles[i];
    if (![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)) errors.push('Malformed candle');
    if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.volume < 0) errors.push('Invalid OHLCV');
    if (i && c.time === candles[i - 1].time) errors.push('Duplicate timestamp');
    if (i && c.time - candles[i - 1].time !== MS[tf]) errors.push('Missing interval');
    if (c.closeTime !== c.time + MS[tf] - 1) errors.push('Incomplete candle data');
  }
  if ((candles?.length ?? 0) < required) errors.push('Insufficient history');
  return { candles: candles?.length ?? 0, firstTimestamp: candles?.[0]?.time ?? null, lastTimestamp: candles?.at(-1)?.time ?? null, missingIntervals: errors.filter((e) => e === 'Missing interval').length, duplicates: errors.filter((e) => e === 'Duplicate timestamp').length, invalidRows: errors.filter((e) => !['Missing interval', 'Duplicate timestamp'].includes(e)).map((message) => ({ message })), pass: errors.length === 0, errors: [...new Set(errors)] };
}

function validationFor(input) {
  const timeframes = { '4h': inspectCandles(input.fourHourCandles, '4h'), '1h': inspectCandles(input.oneHourCandles, '1h'), '15m': inspectCandles(input.fifteenMinuteCandles, '15m') };
  return { pass: Object.values(timeframes).every((frame) => frame.pass), timeframes };
}

function metric(label, value) { return `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`; }

export function renderBacktestResult(result, documentRef = document) {
  const m = result.metrics ?? {};
  documentRef.querySelector('#results').classList.remove('hidden');
  documentRef.querySelector('#sampleWarning').classList.toggle('hidden', !result.synthetic);
  documentRef.querySelector('#metricsGrid').innerHTML = [
    metric('Period', `${new Date(result.period.start).toISOString()} → ${new Date(result.period.end).toISOString()}`), metric('Symbol', result.symbol), metric('Initial Equity', money(result.options.initialEquity)), metric('Final Equity', money(result.options.initialEquity + m.netPnl)), metric('Signals', m.totalSignals), metric('Trades', m.totalTrades), metric('Winning Trades', m.winningTrades), metric('Losing Trades', m.losingTrades), metric('Win Rate', percent(m.winRate)), metric('Net P&L', money(m.netPnl)), metric('Gross Profit', money(m.grossProfit)), metric('Gross Loss', money(m.grossLoss)), metric('Profit Factor', money(m.profitFactor)), metric('Maximum Drawdown', money(m.maxDrawdown)), metric('Average Trade', money(m.averageTrade)), metric('Consecutive Wins', m.consecutiveWins), metric('Consecutive Losses', m.consecutiveLosses)
  ].join('');
  documentRef.querySelector('#breakdownGrid').innerHTML = ['LONG', 'SHORT'].map((side) => { const p = side === 'LONG' ? m.longPerformance : m.shortPerformance; const signals = side === 'LONG' ? m.longSignals : m.shortSignals; return metric(side, `signals ${signals} · trades ${p.trades} · wins ${p.wins} · losses ${p.losses} · win ${percent(p.trades ? p.wins / p.trades : 0)} · P&L ${money(p.netPnl)}`); }).join('');
  documentRef.querySelector('#signalSummary').innerHTML = `<p>Total signals: ${m.totalSignals}</p><p>LONG signals: ${m.longSignals}</p><p>SHORT signals: ${m.shortSignals}</p><p>WAIT signals: ${m.waitSignals}</p><p>Ignored signals: ${m.ignoredSignals}</p><p>Ignored LONG/SHORT signals are reported by the engine, commonly as SIGNAL_IGNORED_OPEN_POSITION when one simulated position is already open.</p>`;
  documentRef.querySelector('#tradeRows').innerHTML = (result.trades ?? []).map((t) => `<tr><td>${new Date(t.entryTime).toISOString()}</td><td>${new Date(t.exitTime).toISOString()}</td><td>${result.symbol}</td><td>${t.action}</td><td>${money(t.entryPrice)}</td><td>${money(t.exitPrice)}</td><td>${money(t.stopLoss)}</td><td>${money(t.takeProfit)}</td><td>${money(t.pnl)}</td><td>${money(t.fees)}</td><td>${t.result}</td></tr>`).join('') || '<tr><td colspan="11">No simulated trades returned by the engine.</td></tr>';
  drawEquity(result.metrics.equityCurve ?? [], documentRef.querySelector('#equityChart'));
}

function drawEquity(curve, canvas) {
  if (!canvas?.getContext) return; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); if (!curve.length) return;
  const values = curve.map((p) => p.equity); const min = Math.min(...values); const max = Math.max(...values); ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 3; ctx.beginPath();
  curve.forEach((p, i) => { const x = (i / Math.max(curve.length - 1, 1)) * (canvas.width - 40) + 20; const y = canvas.height - 20 - ((p.equity - min) / Math.max(max - min, 1)) * (canvas.height - 40); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
}

function renderValidation(validation, documentRef = document) {
  documentRef.querySelector('#validationGrid').innerHTML = Object.entries(validation.timeframes).map(([tf, f]) => `<article class="metric-card ${f.pass ? 'pass' : 'fail'}"><span>${tf.toUpperCase()}</span><strong>${f.pass ? 'PASS' : 'FAIL'}</strong><p>candles: ${f.candles}</p><p>first: ${f.firstTimestamp ? new Date(f.firstTimestamp).toISOString() : 'n/a'}</p><p>last: ${f.lastTimestamp ? new Date(f.lastTimestamp).toISOString() : 'n/a'}</p><p>${f.errors.join(', ') || 'Validated'}</p></article>`).join('');
  documentRef.querySelector('#qualityReport').innerHTML = `<p>Valid candles: ${Object.values(validation.timeframes).reduce((s, f) => s + f.candles, 0)}</p><p>Invalid rows: ${Object.values(validation.timeframes).reduce((s, f) => s + f.invalidRows.length, 0)}</p><p>Duplicates: ${Object.values(validation.timeframes).reduce((s, f) => s + f.duplicates, 0)}</p><p>Missing intervals: ${Object.values(validation.timeframes).reduce((s, f) => s + f.missingIntervals, 0)}</p><p>Incomplete candles and timeframe alignment are included in each timeframe status.</p>`;
}

async function init() {
  const form = document.querySelector('#backtestForm'); if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); document.querySelector('#stateLabel').textContent = 'Validating data'; document.querySelector('#error').classList.add('hidden');
    const sample = document.querySelector('#sampleMode').checked;
    if (!sample) { document.querySelector('#stateLabel').textContent = 'No dataset'; document.querySelector('#error').textContent = 'No real historical dataset is available to the browser UI. Use the existing local dataset workflow via npm run backtest -- --data <dir>, or run clearly labeled synthetic sample mode.'; document.querySelector('#error').classList.remove('hidden'); renderValidation(validationFor({}), document); return; }
    const input = { symbol: document.querySelector('#symbol').value, synthetic: true, dataSource: 'generated deterministic candles', initialEquity: Number(document.querySelector('#initialEquity').value || DEFAULT_BACKTEST_OPTIONS.initialEquity), feeRate: Number(document.querySelector('#fee').value), slippageRate: Number(document.querySelector('#slippage').value), fourHourCandles: sampleCandles(MS['4h'], 260), oneHourCandles: sampleCandles(MS['1h'], 1100), fifteenMinuteCandles: sampleCandles(MS['15m'], 4400), dataQuality: { skippedInvalidCandles: 0 } };
    const validation = validationFor(input); renderValidation(validation, document); if (!validation.pass) { document.querySelector('#stateLabel').textContent = 'Invalid dataset'; return; }
    document.querySelector('#stateLabel').textContent = 'Running backtest';
    try { renderBacktestResult(await runBacktest(input), document); document.querySelector('#stateLabel').textContent = 'Completed'; } catch (error) { document.querySelector('#stateLabel').textContent = 'Backtest error'; document.querySelector('#error').textContent = error.message; document.querySelector('#error').classList.remove('hidden'); }
  });
}

void UI_STATES; void TRADE_RESULTS;
init();
