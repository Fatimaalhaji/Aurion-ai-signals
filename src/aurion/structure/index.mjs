import { findSwingPoints, structureBias } from './swings.mjs';
import { findConfirmedSwings, detectBOS as detectSMCBOS, detectCHoCH as detectSMCCHoCH } from '../smc/index.mjs';

export { findSwingPoints, structureBias };

export function detectBOS(candles = [], swings = null, options = {}) {
  const confirmedSwings = swings ?? findConfirmedSwings(candles, options);
  return detectSMCBOS(candles, confirmedSwings, options);
}

export function detectCHoCH(candles = [], swings = null, bosEvents = null, options = {}) {
  const confirmedSwings = swings ?? findConfirmedSwings(candles, options);
  const structureBreaks = bosEvents ?? detectBOS(candles, confirmedSwings, options);
  return detectSMCCHoCH(candles, confirmedSwings, structureBreaks, options);
}

export function analyzeMarketStructure(candles = [], options = {}) {
  const pivotSpan = options.pivotSpan ?? 2;
  const swings = findConfirmedSwings(candles, options);
  const bos = detectBOS(candles, swings, options);
  const choch = detectCHoCH(candles, swings, bos, options);
  const latestStructure = [...bos, ...choch].sort((a, b) => a.index - b.index).at(-1);
  return {
    bias: latestStructure?.direction ?? structureBias(candles, pivotSpan),
    swings,
    bos,
    choch,
    latestStructure: latestStructure ?? null,
    confirmed: Boolean(latestStructure),
  };
}
