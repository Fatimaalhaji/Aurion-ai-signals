export const API_BASE = 'https://api.binance.com/api/v3';
export const CANDLE_LIMITS = { '4h': 240, '1h': 220, '15m': 220 };
export const MIN_ANALYSIS_CANDLES = 200;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Malformed candle: ${field} is not a finite number`);
  return number;
}

export function normalizeCandle(candle) {
  const normalized = Array.isArray(candle)
    ? {
        time: finiteNumber(candle[0], 'time'),
        open: finiteNumber(candle[1], 'open'),
        high: finiteNumber(candle[2], 'high'),
        low: finiteNumber(candle[3], 'low'),
        close: finiteNumber(candle[4], 'close'),
        volume: finiteNumber(candle[5], 'volume'),
        closeTime: candle[6] === undefined ? undefined : finiteNumber(candle[6], 'closeTime'),
      }
    : {
        ...candle,
        time: finiteNumber(candle.time ?? candle.openTime ?? 0, 'time'),
        open: finiteNumber(candle.open, 'open'),
        high: finiteNumber(candle.high, 'high'),
        low: finiteNumber(candle.low, 'low'),
        close: finiteNumber(candle.close, 'close'),
        volume: finiteNumber(candle.volume ?? 0, 'volume'),
        closeTime: candle.closeTime === undefined ? undefined : finiteNumber(candle.closeTime, 'closeTime'),
      };

  if (normalized.high < Math.max(normalized.open, normalized.close) || normalized.low > Math.min(normalized.open, normalized.close) || normalized.high < normalized.low) {
    throw new Error('Malformed candle: OHLC values are inconsistent');
  }
  return normalized;
}

export function prepareCandles(candles, options = {}) {
  const { now = Date.now(), excludeOpen = true } = options;
  return candles
    .map(normalizeCandle)
    .filter((candle) => !excludeOpen || candle.closeTime === undefined || candle.closeTime <= now)
    .sort((a, b) => a.time - b.time);
}

export async function getCandles(symbol, interval, options = {}) {
  const { limit = CANDLE_LIMITS[interval] ?? 200, fetcher = fetch, cache = new Map(), apiBase = API_BASE, now = Date.now() } = options;
  const key = `${symbol}:${interval}:${limit}`;
  if (cache.has(key)) return cache.get(key);
  const request = fetcher(`${apiBase}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Binance candle request failed for ${symbol} ${interval} (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error(`Binance candle request returned malformed data for ${symbol} ${interval}`);
      return prepareCandles(rows, { now, excludeOpen: true });
    })
    .catch((error) => { cache.delete(key); throw error; });
  cache.set(key, request);
  return request;
}

export async function getTicker(symbol, options = {}) {
  const { fetcher = fetch, cache = new Map(), apiBase = API_BASE } = options;
  const key = `${symbol}:ticker`;
  if (cache.has(key)) return cache.get(key);
  const request = fetcher(`${apiBase}/ticker/24hr?symbol=${symbol}`).then(async (response) => {
    if (!response.ok) throw new Error(`Binance ticker request failed for ${symbol} (${response.status})`);
    return response.json();
  }).catch((error) => { cache.delete(key); throw error; });
  cache.set(key, request);
  return request;
}

export function calculateRsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gainSum = 0; let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff > 0) gainSum += diff; else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let index = period + 1; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
  }
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

export function ema(values, period) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const output = Array(period - 1).fill(null);
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  output.push(previous);
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    output.push(previous);
  }
  return output;
}

export function slopePercent(series, lookback = 8) {
  const defined = series.filter((value) => value !== null && value !== undefined && Number.isFinite(value));
  if (defined.length <= lookback) return null;
  const current = defined.at(-1); const previous = defined.at(-1 - lookback);
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export function momentumPercent(closes, lookback = 10) {
  if (closes.length <= lookback) return null;
  const current = closes.at(-1); const previous = closes.at(-1 - lookback);
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export function structureBias(candles, pivotSpan = 2) {
  if (candles.length < (pivotSpan * 2) + 5) return 'NEUTRAL';
  const swings = [];
  for (let index = pivotSpan; index < candles.length - pivotSpan; index += 1) {
    const window = candles.slice(index - pivotSpan, index + pivotSpan + 1);
    const candle = candles[index];
    if (window.every((item, offset) => offset === pivotSpan || candle.high > item.high)) swings.push({ type: 'HIGH', value: candle.high, index });
    if (window.every((item, offset) => offset === pivotSpan || candle.low < item.low)) swings.push({ type: 'LOW', value: candle.low, index });
  }
  const highs = swings.filter((swing) => swing.type === 'HIGH').slice(-2);
  const lows = swings.filter((swing) => swing.type === 'LOW').slice(-2);
  if (highs.length < 2 || lows.length < 2) return 'NEUTRAL';
  if (highs[1].value > highs[0].value && lows[1].value > lows[0].value) return 'BULLISH';
  if (highs[1].value < highs[0].value && lows[1].value < lows[0].value) return 'BEARISH';
  return 'NEUTRAL';
}

function neutralAnalysis(timeframe, reason) {
  return { timeframe, bias: 'NEUTRAL', confidence: 0, status: 'NEUTRAL', ema50: null, ema200: null, emaSlope: null, rsi: null, momentum: null, structure: 'NEUTRAL', reason, scoreParts: { ema: 'NEUTRAL', slope: 'NEUTRAL', rsi: 'NEUTRAL', momentum: 'NEUTRAL', structure: 'NEUTRAL' } };
}

function analyzeCandles(candles, timeframe, expectedBias = null, options = {}) {
  const normalized = prepareCandles(candles, options);
  if (normalized.length < MIN_ANALYSIS_CANDLES) return neutralAnalysis(timeframe, `Need at least ${MIN_ANALYSIS_CANDLES} completed candles`);
  const closes = normalized.map((c) => c.close);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const fast = ema50.at(-1);
  const slow = ema200.at(-1);
  const slope = slopePercent(ema50);
  const rsi = calculateRsi(closes);
  const momentum = momentumPercent(closes, timeframe === '4H' ? 6 : 10);
  const structure = structureBias(normalized);
  let bullish = 0; let bearish = 0;
  if (fast > slow) bullish += 24; else if (fast < slow) bearish += 24;
  if (slope > 0.05) bullish += 18; else if (slope < -0.05) bearish += 18;
  if (rsi >= 55 && rsi < 80) bullish += 18; else if (rsi <= 45 && rsi > 20) bearish += 18;
  if (momentum > 0.15) bullish += 16; else if (momentum < -0.15) bearish += 16;
  if (structure === 'BULLISH') bullish += 24; else if (structure === 'BEARISH') bearish += 24;
  const bias = Math.abs(bullish - bearish) < 18 ? 'NEUTRAL' : bullish > bearish ? 'BULLISH' : 'BEARISH';
  const confidence = bias === 'NEUTRAL' ? 0 : clamp(50 + Math.abs(bullish - bearish) / 2, 0, 100);
  const agrees = expectedBias && expectedBias !== 'NEUTRAL' && bias === expectedBias;
  const conflicts = expectedBias && expectedBias !== 'NEUTRAL' && bias !== 'NEUTRAL' && bias !== expectedBias;
  return { timeframe, bias, confidence, status: conflicts ? 'CONFLICT' : agrees ? 'CONFIRMED' : 'NEUTRAL', ema50: fast, ema200: slow, emaSlope: slope, rsi, momentum, structure, completedCandles: normalized.length, scoreParts: { ema: fast > slow ? 'BULLISH' : fast < slow ? 'BEARISH' : 'NEUTRAL', slope: slope > 0.05 ? 'BULLISH' : slope < -0.05 ? 'BEARISH' : 'NEUTRAL', rsi: rsi >= 55 && rsi < 80 ? 'BULLISH' : rsi <= 45 && rsi > 20 ? 'BEARISH' : 'NEUTRAL', momentum: momentum > 0.15 ? 'BULLISH' : momentum < -0.15 ? 'BEARISH' : 'NEUTRAL', structure } };
}

export function analyze4HCandles(candles, options = {}) {
  const analysis = analyzeCandles(candles, '4H', null, options);
  return { ...analysis, regime: analysis.bias };
}
export const analyze1HCandles = (candles, fourHourBias, options = {}) => analyzeCandles(candles, '1H', fourHourBias, options);
export const analyze15MCandles = (candles, fourHourBias, options = {}) => {
  const analysis = analyzeCandles(candles, '15M', fourHourBias, options);
  return { ...analysis, entry: analysis.status === 'CONFIRMED' ? (analysis.bias === 'BULLISH' ? 'LONG' : 'SHORT') : 'WAIT' };
};

export async function analyze4H(symbol, options = {}) { return { symbol, ...analyze4HCandles(await getCandles(symbol, '4h', options)) }; }
export async function analyze1H(symbol, fourHourBias, options = {}) { return { symbol, ...analyze1HCandles(await getCandles(symbol, '1h', options), fourHourBias) }; }
export async function analyze15M(symbol, fourHourBias, options = {}) { return { symbol, ...analyze15MCandles(await getCandles(symbol, '15m', options), fourHourBias) }; }

export function calculateMTFConfidence(fourHour, oneHour, fifteenMinute) {
  if (fourHour.bias === 'NEUTRAL') return 0;
  if (oneHour.status === 'CONFLICT' || fifteenMinute.status === 'CONFLICT') return Math.min(40, Math.round(fourHour.confidence * 0.4));
  if (oneHour.status !== 'CONFIRMED' || fifteenMinute.status !== 'CONFIRMED' || fifteenMinute.entry === 'WAIT') return Math.min(45, Math.round(fourHour.confidence * 0.45));
  const score = (fourHour.confidence * 0.4) + (oneHour.confidence * 0.3) + (fifteenMinute.confidence * 0.3);
  return Math.round(clamp(score, 0, 100));
}

export function decideMTFAction(fourHour, oneHour, fifteenMinute) {
  if (fourHour.bias === 'BULLISH' && oneHour.status === 'CONFIRMED' && fifteenMinute.entry === 'LONG') return 'LONG';
  if (fourHour.bias === 'BEARISH' && oneHour.status === 'CONFIRMED' && fifteenMinute.entry === 'SHORT') return 'SHORT';
  return 'WAIT';
}

export async function generateMTFSignal(symbol, options = {}) {
  const cache = options.cache ?? new Map();
  const shared = { ...options, cache };
  const [ticker, fourHourCandles, oneHourCandles, fifteenMinuteCandles] = await Promise.all([getTicker(symbol, shared), getCandles(symbol, '4h', shared), getCandles(symbol, '1h', shared), getCandles(symbol, '15m', shared)]);
  const fourHour = analyze4HCandles(fourHourCandles);
  const oneHour = analyze1HCandles(oneHourCandles, fourHour.bias);
  const fifteenMinute = analyze15MCandles(fifteenMinuteCandles, fourHour.bias);
  const action = decideMTFAction(fourHour, oneHour, fifteenMinute);
  const confidence = action === 'WAIT' ? Math.min(45, calculateMTFConfidence(fourHour, oneHour, fifteenMinute)) : calculateMTFConfidence(fourHour, oneHour, fifteenMinute);
  const explanation = `${fourHour.timeframe} ${fourHour.bias.toLowerCase()} + 1H ${oneHour.status.toLowerCase()} + 15M ${fifteenMinute.entry === 'WAIT' ? 'wait' : `${fifteenMinute.bias.toLowerCase()} setup`}`;
  return { symbol: symbol.replace('USDT', '/USDT'), rawSymbol: symbol, price: Number(ticker.lastPrice), change24h: Number(ticker.priceChangePercent), volume: Number(ticker.quoteVolume), action, confidence, fourHour, oneHour, fifteenMinute, explanation };
}
