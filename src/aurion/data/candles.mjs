import { AurionError, ERROR_CODES } from '../utils/errors.mjs';

function finiteNumber(value, field) { const number = Number(value); if (!Number.isFinite(number)) throw new AurionError(`Malformed candle: ${field} is not a finite number`, ERROR_CODES.INVALID_CANDLE, { field }); return number; }

export function normalizeCandle(candle) {
  const normalized = Array.isArray(candle) ? { time: finiteNumber(candle[0], 'time'), open: finiteNumber(candle[1], 'open'), high: finiteNumber(candle[2], 'high'), low: finiteNumber(candle[3], 'low'), close: finiteNumber(candle[4], 'close'), volume: finiteNumber(candle[5], 'volume'), closeTime: candle[6] === undefined ? undefined : finiteNumber(candle[6], 'closeTime') } : { ...candle, time: finiteNumber(candle.time ?? candle.openTime ?? 0, 'time'), open: finiteNumber(candle.open, 'open'), high: finiteNumber(candle.high, 'high'), low: finiteNumber(candle.low, 'low'), close: finiteNumber(candle.close, 'close'), volume: finiteNumber(candle.volume ?? 0, 'volume'), closeTime: candle.closeTime === undefined ? undefined : finiteNumber(candle.closeTime, 'closeTime') };
  if (normalized.high < Math.max(normalized.open, normalized.close) || normalized.low > Math.min(normalized.open, normalized.close) || normalized.high < normalized.low) throw new AurionError('Malformed candle: OHLC values are inconsistent', ERROR_CODES.INVALID_CANDLE);
  return normalized;
}

export function prepareCandles(candles, options = {}) { const { now = Date.now(), excludeOpen = true } = options; if (!Array.isArray(candles)) throw new AurionError('Candle input must be an array', ERROR_CODES.INVALID_CANDLE); return candles.map(normalizeCandle).filter((candle) => !excludeOpen || candle.closeTime === undefined || candle.closeTime <= now).sort((a, b) => a.time - b.time); }
export const normalizeCandles = prepareCandles;
