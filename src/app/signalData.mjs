import { API_CONFIG, SUPPORTED_SYMBOLS } from '../aurion/config/index.mjs';
import { generateSignal } from '../aurion/signals/engine.mjs';

export const SIGNAL_REFRESH_MS = API_CONFIG.pollMs;
export const SIGNAL_SYMBOLS = SUPPORTED_SYMBOLS;

export async function fetchCurrentSignals(options = {}) {
  const symbols = options.symbols ?? SIGNAL_SYMBOLS;
  const cache = options.cache ?? new Map();
  const settled = await Promise.allSettled(symbols.map((symbol) => generateSignal(symbol, { ...options, cache })));
  const failures = settled.filter((result) => result.status === 'rejected');
  const signals = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => b.confidence - a.confidence);

  return { signals, failures, symbols };
}
