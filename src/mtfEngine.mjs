export const API_BASE = 'https://api.binance.com/api/v3';
export const CANDLE_LIMITS = { '4h': 240, '1h': 220, '15m': 220 };

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeCandle(candle) {
  if (Array.isArray(candle)) {
    return { time: Number(candle[0]), open: Number(candle[1]), high: Number(candle[2]), low: Number(candle[3]), close: Number(candle[4]), volume: Number(candle[5]) };
  }
  return { ...candle, open: Number(candle.open), high: Number(candle.high), low: Number(candle.low), close: Number(candle.close), volume: Number(candle.volume ?? 0) };
}

export async function getCandles(symbol, interval, options = {}) {
  const { limit = CANDLE_LIMITS[interval] ?? 200, fetcher = fetch, cache = new Map(), apiBase = API_BASE } = options;
  const key = `${symbol}:${interval}:${limit}`;
  if (cache.has(key)) return cache.get(key);
  const request = fetcher(`${apiBase}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Binance candle request failed for ${symbol} ${interval} (${response.status})`);
      return (await response.json()).map(normalizeCandle);
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
  if (closes.length <= period) return 50;
  let gains = 0; let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff >= 0) gains += diff; else losses += Math.abs(diff);
  }
  if (gains === 0 && losses === 0) return 50;
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

export function ema(values, period) {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const output = [values[0]];
  for (let index = 1; index < values.length; index += 1) output.push((values[index] - output.at(-1)) * multiplier + output.at(-1));
  return output;
}

function slopePercent(values, lookback = 8) {
  if (values.length <= lookback) return 0;
  const current = values.at(-1); const previous = values.at(-1 - lookback);
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

function structureBias(candles, lookback = 5) {
  if (candles.length < lookback * 2 + 3) return 'NEUTRAL';
  const recent = candles.slice(-lookback);
  const prior = candles.slice(-(lookback * 2), -lookback);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));
  const priorHigh = Math.max(...prior.map((c) => c.high));
  const priorLow = Math.min(...prior.map((c) => c.low));
  if (recentHigh > priorHigh && recentLow > priorLow) return 'BULLISH';
  if (recentHigh < priorHigh && recentLow < priorLow) return 'BEARISH';
  return 'NEUTRAL';
}

function analyzeCandles(candles, timeframe, expectedBias = null) {
  const normalized = candles.map(normalizeCandle);
  const closes = normalized.map((c) => c.close);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const latestClose = closes.at(-1) ?? 0;
  const fast = ema50.at(-1) ?? latestClose;
  const slow = ema200.at(-1) ?? latestClose;
  const slope = slopePercent(ema50);
  const rsi = calculateRsi(closes);
  const momentum = slopePercent(closes, timeframe === '4H' ? 6 : 10);
  const structure = structureBias(normalized);
  let bullish = 0; let bearish = 0;
  if (fast > slow) bullish += 24; else if (fast < slow) bearish += 24;
  if (slope > 0.05) bullish += 18; else if (slope < -0.05) bearish += 18;
  if (rsi >= 55) bullish += 18; else if (rsi <= 45) bearish += 18;
  if (momentum > 0.15) bullish += 16; else if (momentum < -0.15) bearish += 16;
  if (structure === 'BULLISH') bullish += 24; else if (structure === 'BEARISH') bearish += 24;
  const bias = Math.abs(bullish - bearish) < 18 ? 'NEUTRAL' : bullish > bearish ? 'BULLISH' : 'BEARISH';
  const confidence = clamp(50 + Math.abs(bullish - bearish) / 2, 0, 100);
  const agrees = expectedBias && expectedBias !== 'NEUTRAL' && bias === expectedBias;
  const conflicts = expectedBias && expectedBias !== 'NEUTRAL' && bias !== 'NEUTRAL' && bias !== expectedBias;
  return { timeframe, bias, confidence, status: conflicts ? 'CONFLICT' : agrees ? 'CONFIRMED' : 'NEUTRAL', ema50: fast, ema200: slow, emaSlope: slope, rsi, momentum, structure, scoreParts: { ema: fast > slow ? 'BULLISH' : fast < slow ? 'BEARISH' : 'NEUTRAL', slope: slope > 0.05 ? 'BULLISH' : slope < -0.05 ? 'BEARISH' : 'NEUTRAL', rsi: rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NEUTRAL', momentum: momentum > 0.15 ? 'BULLISH' : momentum < -0.15 ? 'BEARISH' : 'NEUTRAL', structure } };
}

export function analyze4HCandles(candles) {
  const analysis = analyzeCandles(candles, '4H');
  return { ...analysis, regime: analysis.bias };
}
export const analyze1HCandles = (candles, fourHourBias) => analyzeCandles(candles, '1H', fourHourBias);
export const analyze15MCandles = (candles, fourHourBias) => {
  const analysis = analyzeCandles(candles, '15M', fourHourBias);
  return { ...analysis, entry: analysis.status === 'CONFIRMED' ? (analysis.bias === 'BULLISH' ? 'LONG' : 'SHORT') : 'WAIT' };
};

export async function analyze4H(symbol, options = {}) { return { symbol, ...analyze4HCandles(await getCandles(symbol, '4h', options)) }; }
export async function analyze1H(symbol, fourHourBias, options = {}) { return { symbol, ...analyze1HCandles(await getCandles(symbol, '1h', options), fourHourBias) }; }
export async function analyze15M(symbol, fourHourBias, options = {}) { return { symbol, ...analyze15MCandles(await getCandles(symbol, '15m', options), fourHourBias) }; }

export function calculateMTFConfidence(fourHour, oneHour, fifteenMinute) {
  let score = 0;
  score += fourHour.bias === 'NEUTRAL' ? 8 : 25 * (fourHour.confidence / 100);
  score += oneHour.status === 'CONFIRMED' ? 25 * (oneHour.confidence / 100) : oneHour.status === 'CONFLICT' ? 0 : 8;
  score += fifteenMinute.status === 'CONFIRMED' ? 25 * (fifteenMinute.confidence / 100) : fifteenMinute.status === 'CONFLICT' ? 0 : 8;
  const alignedParts = [fourHour, oneHour, fifteenMinute].flatMap((a) => Object.values(a.scoreParts ?? {})).filter((part) => part === fourHour.bias).length;
  score += fourHour.bias === 'NEUTRAL' ? 0 : alignedParts * 2.5;
  return Math.round(clamp(score, 0, 100));
}

export async function generateMTFSignal(symbol, options = {}) {
  const cache = options.cache ?? new Map();
  const shared = { ...options, cache };
  const [ticker, fourHourCandles, oneHourCandles, fifteenMinuteCandles] = await Promise.all([getTicker(symbol, shared), getCandles(symbol, '4h', shared), getCandles(symbol, '1h', shared), getCandles(symbol, '15m', shared)]);
  const fourHour = analyze4HCandles(fourHourCandles);
  const oneHour = analyze1HCandles(oneHourCandles, fourHour.bias);
  const fifteenMinute = analyze15MCandles(fifteenMinuteCandles, fourHour.bias);
  let action = 'WAIT';
  if (fourHour.bias === 'BULLISH' && oneHour.status === 'CONFIRMED' && fifteenMinute.entry === 'LONG') action = 'LONG';
  if (fourHour.bias === 'BEARISH' && oneHour.status === 'CONFIRMED' && fifteenMinute.entry === 'SHORT') action = 'SHORT';
  const confidence = calculateMTFConfidence(fourHour, oneHour, fifteenMinute);
  const explanation = `${fourHour.timeframe} ${fourHour.bias.toLowerCase()} + 1H ${oneHour.status.toLowerCase()} + 15M ${fifteenMinute.entry === 'WAIT' ? 'wait' : `${fifteenMinute.bias.toLowerCase()} breakout`}`;
  return { symbol: symbol.replace('USDT', '/USDT'), rawSymbol: symbol, price: Number(ticker.lastPrice), change24h: Number(ticker.priceChangePercent), volume: Number(ticker.quoteVolume), action, confidence, fourHour, oneHour, fifteenMinute, explanation };
}
