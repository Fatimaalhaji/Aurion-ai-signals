import { SUPPORTED_SYMBOLS } from '../config/index.mjs';
import { signalHistory } from '../history/signalHistory.mjs';
import { generateSignal } from './engine.mjs';

export async function loadGeneratedSignals(options = {}) {
  const symbols = options.symbols ?? SUPPORTED_SYMBOLS;
  const cache = options.cache ?? new Map();
  const generator = options.generator ?? generateSignal;
  const settled = await Promise.allSettled(symbols.map((symbol) => generator(symbol, { ...options, cache })));
  const signals = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  if (options.store !== false) signalHistory.addMany(signals);
  return {
    signals,
    failures: settled.filter((result) => result.status === 'rejected'),
  };
}
