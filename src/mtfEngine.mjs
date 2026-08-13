export { API_CONFIG as _API_CONFIG } from './aurion/config/index.mjs';
export { API_CONFIG } from './aurion/config/index.mjs';
export const API_BASE = 'https://api.binance.com/api/v3';
export { MINIMUM_CANDLES } from './aurion/config/index.mjs';
export const CANDLE_LIMITS = { '4h': 240, '1h': 220, '15m': 220 };
export const MIN_ANALYSIS_CANDLES = 200;
export { normalizeCandle, prepareCandles, normalizeCandles } from './aurion/data/candles.mjs';
export { getCandles, getTicker } from './services/binance/client.mjs';
export { clamp, calculateRsi, ema, slopePercent, momentumPercent } from './aurion/indicators/index.mjs';
export { structureBias, findSwingPoints, analyzeMarketStructure } from './aurion/structure/index.mjs';
export { findConfirmedSwings, detectBOS, detectCHoCH, findLiquidityLevels, detectLiquiditySweeps, findFairValueGaps, detectFVGMitigations, findOrderBlocks, analyzeSMC, analyzeMTFSMC } from './aurion/smc/index.mjs';
export { analyzeCandles, analyze4HCandles, analyze1HCandles, analyze15MCandles, calculateMTFConfidence, decideMTFAction, analyzeMTF } from './aurion/mtf/analyzer.mjs';
export { generateMTFSignal, generateSignal } from './aurion/signals/engine.mjs';
export async function analyze4H(symbol, options = {}) { const { getCandles } = await import('./services/binance/client.mjs'); const { analyze4HCandles } = await import('./aurion/mtf/analyzer.mjs'); return { symbol, ...analyze4HCandles(await getCandles(symbol, '4h', options)) }; }
export async function analyze1H(symbol, fourHourBias, options = {}) { const { getCandles } = await import('./services/binance/client.mjs'); const { analyze1HCandles } = await import('./aurion/mtf/analyzer.mjs'); return { symbol, ...analyze1HCandles(await getCandles(symbol, '1h', options), fourHourBias) }; }
export async function analyze15M(symbol, fourHourBias, options = {}) { const { getCandles } = await import('./services/binance/client.mjs'); const { analyze15MCandles } = await import('./aurion/mtf/analyzer.mjs'); return { symbol, ...analyze15MCandles(await getCandles(symbol, '15m', options), fourHourBias) }; }
export { runBacktest, formatBacktestReport, DEFAULT_BACKTEST_OPTIONS } from './aurion/backtest/index.mjs';
