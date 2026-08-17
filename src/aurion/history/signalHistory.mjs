const ACTIONS = new Set(['LONG', 'SHORT', 'WAIT']);

export function isValidSignalRecord(signal) {
  return Boolean(
    signal
      && typeof signal === 'object'
      && typeof signal.timestamp === 'number'
      && Number.isFinite(signal.timestamp)
      && typeof signal.symbol === 'string'
      && ACTIONS.has(signal.action)
      && typeof signal.confidence === 'number'
      && Number.isFinite(signal.confidence)
      && typeof signal.price === 'number'
      && Number.isFinite(signal.price)
      && typeof signal.reason === 'string'
  );
}

export function createSignalHistory() {
  const records = [];
  return {
    add(signal) {
      if (!isValidSignalRecord(signal)) return null;
      records.push(signal);
      return signal;
    },
    addMany(signals) {
      return signals.map((signal) => this.add(signal)).filter(Boolean);
    },
    query(filters = {}) {
      const action = filters.action ?? 'ALL';
      const symbol = (filters.symbol ?? '').trim().toUpperCase();
      const sort = filters.sort ?? 'newest';
      return records
        .filter(isValidSignalRecord)
        .filter((signal) => action === 'ALL' || signal.action === action)
        .filter((signal) => !symbol || signal.symbol.toUpperCase().includes(symbol) || signal.rawSymbol?.toUpperCase().includes(symbol))
        .sort((a, b) => (sort === 'oldest' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));
    },
    all() {
      return this.query();
    },
    clear() {
      records.length = 0;
    },
  };
}

export const signalHistory = createSignalHistory();
