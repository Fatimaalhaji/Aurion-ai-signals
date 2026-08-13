import { findSwingPoints, structureBias } from './swings.mjs';
export { findSwingPoints, structureBias };
export function detectBOS() { return []; }
export function detectCHoCH() { return []; }
export function analyzeMarketStructure(candles, options = {}) { const swings = findSwingPoints(candles, options.pivotSpan ?? 2); return { bias: structureBias(candles, options.pivotSpan ?? 2), swings, bos: detectBOS(candles, swings), choch: detectCHoCH(candles, swings) }; }
