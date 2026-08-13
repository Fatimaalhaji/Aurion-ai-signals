import { prepareCandles } from '../data/candles.mjs';
import { findSwingPoints } from '../structure/swings.mjs';

const DEFAULTS = { pivotSpan: 2, equalTolerancePercent: 0.08, mitigationMode: 'wick' };
const pctDistance = (a, b) => (b === 0 ? 0 : Math.abs((a - b) / b) * 100);

function prepared(candles, options = {}) { return prepareCandles(candles, options); }
function eventBase(type, direction, candle, index, level, swing) { return { type, direction, index, time: candle.time, price: candle.close, level, swingIndex: swing.index, swingTime: swing.time }; }

export function findConfirmedSwings(candles, options = {}) {
  const normalized = prepared(candles, options);
  const pivotSpan = options.pivotSpan ?? DEFAULTS.pivotSpan;
  return findSwingPoints(normalized, pivotSpan).map((swing) => ({ ...swing, confirmedIndex: swing.index + pivotSpan, confirmedTime: normalized[swing.index + pivotSpan]?.time ?? swing.time }));
}

export function detectBOS(candles, swings = findConfirmedSwings(candles), options = {}) {
  const normalized = prepared(candles, options);
  const events = [];
  const broken = new Set();
  for (let index = 0; index < normalized.length; index += 1) {
    const candle = normalized[index];
    const available = swings.filter((s) => s.confirmedIndex < index);
    const lastHigh = available.filter((s) => s.type === 'HIGH').at(-1);
    const lastLow = available.filter((s) => s.type === 'LOW').at(-1);
    if (lastHigh && candle.close > lastHigh.value && !broken.has(`HIGH:${lastHigh.index}`)) { events.push(eventBase('BOS', 'BULLISH', candle, index, lastHigh.value, lastHigh)); broken.add(`HIGH:${lastHigh.index}`); }
    if (lastLow && candle.close < lastLow.value && !broken.has(`LOW:${lastLow.index}`)) { events.push(eventBase('BOS', 'BEARISH', candle, index, lastLow.value, lastLow)); broken.add(`LOW:${lastLow.index}`); }
  }
  return events;
}

export function detectCHoCH(candles, swings = findConfirmedSwings(candles), bosEvents = detectBOS(candles, swings), options = {}) {
  let bias = 'NEUTRAL';
  return bosEvents.reduce((events, event) => {
    if (bias !== 'NEUTRAL' && event.direction !== bias) events.push({ ...event, type: 'CHoCH', previousBias: bias });
    bias = event.direction;
    return events;
  }, []);
}

export function findLiquidityLevels(candles = [], options = {}) {
  const swings = options.swings ?? findConfirmedSwings(candles, options);
  const tolerance = options.equalTolerancePercent ?? DEFAULTS.equalTolerancePercent;
  const groups = [];
  for (const swing of swings) {
    let group = groups.find((item) => item.side === swing.type && pctDistance(item.price, swing.value) <= tolerance);
    if (!group) { group = { id: `${swing.type}-${groups.length}`, side: swing.type, price: swing.value, touches: [], swept: false }; groups.push(group); }
    group.touches.push({ index: swing.index, time: swing.time, confirmedIndex: swing.confirmedIndex, price: swing.value });
    group.price = group.touches.reduce((sum, touch) => sum + touch.price, 0) / group.touches.length;
  }
  return groups.filter((group) => group.touches.length >= (options.minTouches ?? 2));
}

export function detectLiquiditySweeps(candles = [], levels = null, options = {}) {
  const activeLevels = levels ?? findLiquidityLevels(candles, options);
  const normalized = prepared(candles, options);
  const sweeps = [];
  for (const level of activeLevels) {
    const confirmedAfter = Math.max(...level.touches.map((touch) => touch.confirmedIndex));
    for (let index = confirmedAfter + 1; index < normalized.length; index += 1) {
      const candle = normalized[index];
      const bullish = level.side === 'LOW' && candle.low < level.price && candle.close > level.price;
      const bearish = level.side === 'HIGH' && candle.high > level.price && candle.close < level.price;
      if (bullish || bearish) { sweeps.push({ type: 'LIQUIDITY_SWEEP', direction: bullish ? 'BULLISH' : 'BEARISH', levelId: level.id, level: level.price, index, time: candle.time, price: candle.close }); break; }
    }
  }
  return sweeps;
}

export function findFairValueGaps(candles = [], options = {}) {
  const normalized = prepared(candles, options);
  const gaps = [];
  for (let index = 2; index < normalized.length; index += 1) {
    const first = normalized[index - 2]; const third = normalized[index];
    if (third.low > first.high) gaps.push({ type: 'FVG', direction: 'BULLISH', index, time: third.time, startIndex: index - 2, low: first.high, high: third.low, midpoint: (first.high + third.low) / 2, mitigated: false, mitigatedIndex: null, mitigatedTime: null });
    if (third.high < first.low) gaps.push({ type: 'FVG', direction: 'BEARISH', index, time: third.time, startIndex: index - 2, low: third.high, high: first.low, midpoint: (third.high + first.low) / 2, mitigated: false, mitigatedIndex: null, mitigatedTime: null });
  }
  return gaps;
}

export function detectFVGMitigations(candles = [], fvgs = findFairValueGaps(candles), options = {}) {
  const normalized = prepared(candles, options);
  const mode = options.mitigationMode ?? DEFAULTS.mitigationMode;
  return fvgs.map((fvg) => {
    const mitigated = { ...fvg };
    for (let index = fvg.index + 1; index < normalized.length; index += 1) {
      const candle = normalized[index];
      const price = mode === 'close' ? candle.close : (fvg.direction === 'BULLISH' ? candle.low : candle.high);
      const hit = fvg.direction === 'BULLISH' ? price <= fvg.high : price >= fvg.low;
      if (hit) return { ...mitigated, mitigated: true, mitigatedIndex: index, mitigatedTime: candle.time };
    }
    return mitigated;
  });
}

export function findOrderBlocks(candles = [], structureEvents = detectBOS(candles), options = {}) {
  const normalized = prepared(candles, options);
  return structureEvents.map((event) => {
    for (let index = event.index - 1; index >= Math.max(0, event.index - (options.lookback ?? 10)); index -= 1) {
      const candle = normalized[index];
      const bearishCandle = candle.close < candle.open; const bullishCandle = candle.close > candle.open;
      if ((event.direction === 'BULLISH' && bearishCandle) || (event.direction === 'BEARISH' && bullishCandle)) return { type: 'ORDER_BLOCK', direction: event.direction, sourceEvent: event.type, index, time: candle.time, low: candle.low, high: candle.high, mitigationIndex: null };
    }
    return null;
  }).filter(Boolean);
}

export function analyzeSMC(candles = [], options = {}) {
  const swings = findConfirmedSwings(candles, options);
  const bos = detectBOS(candles, swings, options);
  const choch = detectCHoCH(candles, swings, bos, options);
  const liquidityLevels = findLiquidityLevels(candles, { ...options, swings });
  const liquiditySweeps = detectLiquiditySweeps(candles, liquidityLevels, options);
  const fairValueGaps = detectFVGMitigations(candles, findFairValueGaps(candles, options), options);
  const orderBlocks = findOrderBlocks(candles, [...bos, ...choch], options);
  const latestStructure = [...bos, ...choch].sort((a, b) => a.index - b.index).at(-1);
  return { swings, bos, choch, liquidityLevels, liquiditySweeps, fairValueGaps, orderBlocks, bias: latestStructure?.direction ?? 'NEUTRAL', confirmed: Boolean(latestStructure), latestStructure: latestStructure ?? null };
}

export function analyzeMTFSMC(fourHourCandles = [], oneHourCandles = [], fifteenMinuteCandles = [], options = {}) {
  const fourHour = analyzeSMC(fourHourCandles, options.fourHour ?? options);
  const oneHour = analyzeSMC(oneHourCandles, options.oneHour ?? options);
  const fifteenMinute = analyzeSMC(fifteenMinuteCandles, options.fifteenMinute ?? options);
  const aligned = fourHour.bias !== 'NEUTRAL' && oneHour.bias === fourHour.bias && fifteenMinute.bias === fourHour.bias;
  return { fourHour, oneHour, fifteenMinute, aligned, bias: aligned ? fourHour.bias : 'NEUTRAL', entryFilter: aligned ? (fourHour.bias === 'BULLISH' ? 'LONG' : 'SHORT') : 'WAIT' };
}
