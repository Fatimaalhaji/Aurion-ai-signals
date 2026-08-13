import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareCandles } from '../data/candles.mjs';

export const HISTORICAL_TIMEFRAMES = Object.freeze({ fourHour: '4h', oneHour: '1h', fifteenMinute: '15m' });
export const TIMEFRAME_MS = Object.freeze({ '4h': 4 * 60 * 60 * 1000, '1h': 60 * 60 * 1000, '15m': 15 * 60 * 1000 });
const REQUIRED = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];

function parseTimestamp(value, label) {
  if (value === undefined || value === null || value === '') throw new Error(`${label}: timestamp is missing`);
  if (typeof value === 'string' && /[a-z:-]/i.test(value)) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label}: timestamp is malformed`);
    return parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label}: timestamp is malformed`);
  return number < 10_000_000_000 ? number * 1000 : number;
}

function requireNumber(row, field, label) {
  if (row[field] === undefined || row[field] === null || row[field] === '') throw new Error(`${label}: ${field} is missing`);
  const number = Number(row[field]);
  if (!Number.isFinite(number)) throw new Error(`${label}: ${field} is malformed`);
  return number;
}

function splitCsvLine(line) {
  const cells = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  if (quoted) throw new Error('CSV contains an unterminated quoted value');
  return cells;
}

export function parseHistoricalCsv(text, source = 'CSV') {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (lines.length < 2) throw new Error(`${source}: CSV must include a header and at least one candle`);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (const field of REQUIRED) if (!header.includes(field)) throw new Error(`${source}: CSV missing ${field} column`);
  return lines.slice(1).map((line, index) => Object.fromEntries(splitCsvLine(line).map((cell, i) => [header[i], cell])));
}

export function parseHistoricalJson(text, source = 'JSON') {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.candles;
  if (!Array.isArray(rows)) throw new Error(`${source}: JSON must be an array or { candles: [] }`);
  return rows;
}

export function validateHistoricalRows(rows, timeframe, source, { from, to } = {}) {
  let previous = null; let skipped = 0;
  const durationMs = TIMEFRAME_MS[timeframe];
  const candles = rows.map((row, index) => {
    const label = `${source} row ${index + 1}`;
    const timestamp = parseTimestamp(row.timestamp ?? row.time ?? row.openTime ?? (Array.isArray(row) ? row[0] : undefined), label);
    const mapped = Array.isArray(row) ? { open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5], closeTime: row[6] } : row;
    const candle = { time: timestamp, open: requireNumber(mapped, 'open', label), high: requireNumber(mapped, 'high', label), low: requireNumber(mapped, 'low', label), close: requireNumber(mapped, 'close', label), volume: requireNumber(mapped, 'volume', label), closeTime: mapped.closeTime === undefined || mapped.closeTime === '' ? timestamp + durationMs - 1 : parseTimestamp(mapped.closeTime, label) };
    if (previous !== null) { if (candle.time <= previous) throw new Error(`${source}: ${candle.time === previous ? 'duplicate timestamps' : 'candles are not chronological'}`); if (candle.time - previous !== durationMs) throw new Error(`${source}: missing candles or invalid ${timeframe} spacing`); }
    if (candle.closeTime !== candle.time + durationMs - 1) throw new Error(`${source}: incomplete candle closeTime for ${new Date(candle.time).toISOString()}`);
    previous = candle.time;
    return candle;
  });
  const filtered = candles.filter((c) => { const keep = (!from || c.time >= from) && (!to || c.time < to); if (!keep) skipped += 1; return keep; });
  return { candles: prepareCandles(filtered, { now: Number.MAX_SAFE_INTEGER, excludeOpen: false }), skipped };
}

async function readFrame(dir, timeframe, fromTo) {
  const csv = path.join(dir, `${timeframe}.csv`); const json = path.join(dir, `${timeframe}.json`);
  try { const text = await readFile(csv, 'utf8'); return { ...validateHistoricalRows(parseHistoricalCsv(text, csv), timeframe, csv, fromTo), source: csv }; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  try { const text = await readFile(json, 'utf8'); return { ...validateHistoricalRows(parseHistoricalJson(text, json), timeframe, json, fromTo), source: json }; }
  catch (e) { if (e.code === 'ENOENT') throw new Error(`Missing ${timeframe} dataset in ${dir} (expected ${timeframe}.csv or ${timeframe}.json)`); throw e; }
}

export async function loadHistoricalDataset({ symbol, dataDir, from, to }) {
  const fromMs = from ? parseTimestamp(from, '--from') : undefined;
  const toMs = to ? parseTimestamp(to, '--to') : undefined;
  if (fromMs && toMs && fromMs >= toMs) throw new Error('--from must be before --to');
  const frames = await Promise.all(Object.values(HISTORICAL_TIMEFRAMES).map((tf) => readFrame(dataDir, tf, { from: fromMs, to: toMs })));
  return { symbol, dataSource: dataDir, fourHourCandles: frames[0].candles, oneHourCandles: frames[1].candles, fifteenMinuteCandles: frames[2].candles, dataQuality: { fourHourCandles: frames[0].candles.length, oneHourCandles: frames[1].candles.length, fifteenMinuteCandles: frames[2].candles.length, skippedInvalidCandles: frames.reduce((s, f) => s + f.skipped, 0), sources: frames.map((f) => f.source) } };
}
