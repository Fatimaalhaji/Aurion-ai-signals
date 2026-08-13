export const SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
export const TIMEFRAMES = { REGIME: '4h', SETUP: '1h', ENTRY: '15m' };
export const DISPLAY_TIMEFRAMES = { REGIME: '4H', SETUP: '1H', ENTRY: '15M' };
export const API_CONFIG = { binanceBaseUrl: 'https://api.binance.com/api/v3', pollMs: 15000 };
export const INDICATOR_PERIODS = { rsi: 14, emaFast: 50, emaSlow: 200, emaSlopeLookback: 8, momentumDefault: 10, momentumRegime: 6 };
export const MINIMUM_CANDLES = { analysis: 200, byTimeframe: { '4h': 240, '1h': 220, '15m': 220 } };
export const CONFIDENCE_THRESHOLDS = { neutralDelta: 18, waitMaximum: 45, conflictMaximum: 40 };
