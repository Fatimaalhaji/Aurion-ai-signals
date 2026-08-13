export function createSignalHistory() { const records = []; return { add(signal) { records.push(signal); return signal; }, all() { return [...records]; }, clear() { records.length = 0; } }; }
export const signalHistory = createSignalHistory();
