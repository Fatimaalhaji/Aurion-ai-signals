import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeCandle } from '../data/candles.mjs';
import { HISTORICAL_TIMEFRAMES, TIMEFRAME_MS, parseHistoricalCsv, parseHistoricalJson } from './historicalData.mjs';

export const DATASET_MANIFEST_FILE = 'manifest.json';
export const REQUIRED_DATASET_COLUMNS = Object.freeze(['timestamp', 'open', 'high', 'low', 'close', 'volume']);

function parseTimestampValue(value) {
  if (value === undefined || value === null || value === '') throw new Error('timestamp is missing');
  if (typeof value === 'string' && /[a-z:-]/i.test(value)) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error('timestamp is malformed');
    return parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('timestamp is malformed');
  return number < 10_000_000_000 ? number * 1000 : number;
}

function numberField(row, field) {
  if (row[field] === undefined || row[field] === null || row[field] === '') throw new Error(`${field} is missing`);
  const number = Number(row[field]);
  if (!Number.isFinite(number)) throw new Error(`${field} is malformed`);
  return number;
}

function inspectRows(rows, timeframe) {
  const durationMs = TIMEFRAME_MS[timeframe];
  const invalidRows = [];
  const valid = [];
  rows.forEach((row, index) => {
    try {
      const mapped = Array.isArray(row) ? { timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5], closeTime: row[6] } : row;
      const time = parseTimestampValue(mapped.timestamp ?? mapped.time ?? mapped.openTime);
      const candle = normalizeCandle({ time, open: numberField(mapped, 'open'), high: numberField(mapped, 'high'), low: numberField(mapped, 'low'), close: numberField(mapped, 'close'), volume: numberField(mapped, 'volume'), closeTime: mapped.closeTime === undefined || mapped.closeTime === '' ? time + durationMs - 1 : parseTimestampValue(mapped.closeTime) });
      if (candle.closeTime !== candle.time + durationMs - 1) throw new Error('closeTime does not match timeframe');
      valid.push(candle);
    } catch (error) {
      invalidRows.push({ row: index + 1, message: error.message });
    }
  });
  valid.sort((a, b) => a.time - b.time);
  let duplicates = 0; let missingIntervals = 0; let previous = null;
  for (const candle of valid) {
    if (previous !== null) {
      const delta = candle.time - previous;
      if (delta === 0) duplicates += 1;
      else if (delta > durationMs) missingIntervals += Math.floor(delta / durationMs) - 1;
      else if (delta < durationMs) invalidRows.push({ row: null, message: `non-${timeframe} spacing at ${new Date(candle.time).toISOString()}` });
    }
    previous = candle.time;
  }
  return { candles: valid.length, firstTimestamp: valid[0]?.time ?? null, lastTimestamp: valid.at(-1)?.time ?? null, missingIntervals, duplicates, invalidRows, pass: valid.length > 0 && missingIntervals === 0 && duplicates === 0 && invalidRows.length === 0 };
}

async function readRows(dataDir, timeframe) {
  const csv = path.join(dataDir, `${timeframe}.csv`); const json = path.join(dataDir, `${timeframe}.json`);
  try { return { source: csv, rows: parseHistoricalCsv(await readFile(csv, 'utf8'), csv) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { return { source: json, rows: parseHistoricalJson(await readFile(json, 'utf8'), json) }; }
  catch (error) { if (error.code === 'ENOENT') throw new Error(`Missing ${timeframe} dataset in ${dataDir} (expected ${timeframe}.csv or ${timeframe}.json)`); throw error; }
}

export async function validateDataset({ symbol, dataDir }) {
  const timeframes = {};
  for (const timeframe of Object.values(HISTORICAL_TIMEFRAMES)) {
    try {
      const { source, rows } = await readRows(dataDir, timeframe);
      timeframes[timeframe] = { source, ...inspectRows(rows, timeframe) };
    } catch (error) {
      timeframes[timeframe] = { source: null, candles: 0, firstTimestamp: null, lastTimestamp: null, missingIntervals: 0, duplicates: 0, invalidRows: [{ row: null, message: error.message }], pass: false };
    }
  }
  return { symbol, dataDir, pass: Object.values(timeframes).every((frame) => frame.pass), timeframes };
}

export async function readDatasetManifest(dataDir) {
  const file = path.join(dataDir, DATASET_MANIFEST_FILE);
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  return manifest;
}

export function summarizeManifest(manifest) {
  return { symbol: manifest.symbol, timeframes: manifest.timeframes, source: manifest.source, dateRange: manifest.dateRange, timezone: manifest.timezone, generatedAt: manifest.generatedAt, rowCounts: manifest.rowCounts };
}

export function formatDatasetValidationReport(result) {
  const lines = [`AURION DATASET VALIDATION`, `Symbol: ${result.symbol}`, `Data directory: ${result.dataDir}`, `Status: ${result.pass ? 'PASS' : 'FAIL'}`, ''];
  for (const [timeframe, frame] of Object.entries(result.timeframes)) {
    lines.push(`${timeframe.toUpperCase()}:`, `  candles: ${frame.candles}`, `  first timestamp: ${frame.firstTimestamp === null ? 'n/a' : new Date(frame.firstTimestamp).toISOString()} (${frame.firstTimestamp ?? 'n/a'})`, `  last timestamp: ${frame.lastTimestamp === null ? 'n/a' : new Date(frame.lastTimestamp).toISOString()} (${frame.lastTimestamp ?? 'n/a'})`, `  missing intervals: ${frame.missingIntervals}`, `  duplicates: ${frame.duplicates}`, `  invalid rows: ${frame.invalidRows.length}`, `  status: ${frame.pass ? 'PASS' : 'FAIL'}`);
    for (const invalid of frame.invalidRows.slice(0, 10)) lines.push(`    - row ${invalid.row ?? 'n/a'}: ${invalid.message}`);
    lines.push('');
  }
  return lines.join('\n');
}
