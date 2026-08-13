import * as binance from '../../services/binance/client.mjs';
export { normalizeCandle, normalizeCandles, prepareCandles } from './candles.mjs';
export function createMarketDataProvider(adapter = binance) { return { getCandles: adapter.getCandles, getTicker: adapter.getTicker }; }
export const marketDataProvider = createMarketDataProvider();
