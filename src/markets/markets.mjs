import { API_CONFIG, SUPPORTED_SYMBOLS } from '../aurion/config/index.mjs';
import { generateSignal } from '../aurion/signals/engine.mjs';

export const MARKET_FILTERS = ['ALL', 'LONG', 'SHORT', 'WAIT'];

export function isSupportedSymbol(symbol) {
  return SUPPORTED_SYMBOLS.includes(String(symbol).toUpperCase());
}

export function formatUsd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number(value) > 100 ? 0 : 4 }).format(Number(value));
}

export function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Number(value));
}

export function marketStatus(error) {
  const message = error?.message ?? String(error ?? 'Network failure');
  if (/unsupported/i.test(message)) return 'Unsupported symbol';
  if (/binance|rate limit|unavailable/i.test(message)) return 'Binance unavailable';
  return 'Network failure';
}

export class SharedMarketSignalService extends EventTarget {
  constructor({ symbols = SUPPORTED_SYMBOLS, signalGenerator = generateSignal, pollMs = API_CONFIG.pollMs } = {}) {
    super();
    this.symbols = symbols;
    this.signalGenerator = signalGenerator;
    this.pollMs = pollMs;
    this.cache = new Map();
    this.timer = null;
    this.inFlight = null;
    this.state = { status: 'idle', signals: [], errors: [], updatedAt: null };
  }

  async refresh() {
    if (this.inFlight) return this.inFlight;
    this.state = { ...this.state, status: this.state.signals.length ? 'refreshing' : 'loading' };
    this.emit();
    this.inFlight = Promise.allSettled(this.symbols.map((symbol) => this.signalGenerator(symbol, { cache: this.cache })))
      .then((settled) => {
        const signals = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value).sort((a, b) => b.confidence - a.confidence);
        const errors = settled.filter((result) => result.status === 'rejected').map((result) => result.reason);
        if (!signals.length && errors.length) throw errors[0];
        this.state = { status: 'loaded', signals, errors, updatedAt: new Date() };
        this.emit();
        return this.state;
      })
      .catch((error) => {
        this.state = { ...this.state, status: 'error', errors: [error] };
        this.emit();
        return this.state;
      })
      .finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  start() {
    if (!this.timer) this.timer = window.setInterval(() => { this.refresh(); }, this.pollMs);
    return this.refresh();
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  emit() { this.dispatchEvent(new CustomEvent('change', { detail: this.state })); }
}

export const sharedMarketSignalService = new SharedMarketSignalService();

export function filterMarkets(signals, query = '', filter = 'ALL') {
  const normalizedQuery = query.trim().toUpperCase();
  return signals.filter((signal) => {
    const symbol = signal.rawSymbol ?? signal.symbol?.replace('/', '');
    const matchesQuery = !normalizedQuery || symbol.includes(normalizedQuery) || signal.symbol.toUpperCase().includes(normalizedQuery);
    const matchesFilter = filter === 'ALL' || signal.action === filter;
    return matchesQuery && matchesFilter;
  });
}

const val = (value) => value === null || value === undefined ? 'Not returned' : String(value);
const number = (value, digits = 2) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'Not returned' : Number(value).toFixed(digits);
const list = (items, mapItem, empty = 'None returned') => !items?.length ? `<li>${empty}</li>` : items.slice(-6).map(mapItem).join('');

export function renderMarketOverview(signals) {
  if (!signals.length) return '<div class="state-card">Empty market list</div>';
  return signals.map((signal) => `<button class="market-row ${signal.action.toLowerCase()}" data-symbol="${signal.rawSymbol}" type="button"><b>${signal.symbol}</b><span>${formatUsd(signal.price)}</span><span class="${signal.change24h >= 0 ? 'positive' : 'negative'}">${number(signal.change24h)}%</span><span>${formatCompact(signal.volume)}</span><span>${signal.action}</span><span>${number(signal.confidence, 0)}%</span><span>${val(signal.mtf?.fourHour?.bias)}</span><span>${val(signal.mtf?.oneHour?.status)}</span><span>${val(signal.mtf?.fifteenMinute?.entry)}</span></button>`).join('');
}

export function renderMarketDetail(signal) {
  if (!signal) return '<section class="detail-panel"><h2>Select a market</h2><p>Choose a supported asset to inspect canonical AURION analysis.</p></section>';
  const smc = signal.mtf?.smc?.fifteenMinute ?? signal.smcConfirmation?.fifteenMinute;
  const structure = smc ?? {};
  const frame = (label, data, primary) => `<div><span>${label}</span><strong>${primary}</strong><small>${val(data?.bias)} · ${val(data?.status ?? data?.entry)}</small></div>`;
  const indicatorRows = [signal.fourHour, signal.oneHour, signal.fifteenMinute].map((tf) => `<li>${tf.timeframe}: EMA50 ${number(tf.ema50)} · EMA200 ${number(tf.ema200)} · EMA slope ${number(tf.emaSlope, 4)} · RSI ${number(tf.rsi, 1)} · Momentum ${number(tf.momentum, 2)}</li>`).join('');
  return `<section class="detail-panel"><div class="detail-head"><div><p class="eyebrow">Selected market</p><h2>${signal.symbol}</h2></div><div class="signal-badge">${signal.action}</div></div><div class="detail-stats"><div><span>Price</span><b>${formatUsd(signal.price)}</b></div><div><span>24h change</span><b>${number(signal.change24h)}%</b></div><div><span>Volume</span><b>${formatCompact(signal.volume)}</b></div></div><h3>AURION SIGNAL</h3><p><b>${signal.action}</b> · ${number(signal.confidence, 0)}% confidence</p><p>${signal.reason}</p><h3>Multi-timeframe analysis</h3><div class="timeframe-grid three">${frame('4H Primary market regime', signal.mtf?.fourHour, signal.mtf?.fourHour?.bias)}${frame('1H Setup confirmation', signal.mtf?.oneHour, signal.mtf?.oneHour?.status)}${frame('15M Entry condition', signal.mtf?.fifteenMinute, signal.mtf?.fifteenMinute?.entry)}</div><p>Final AURION signal: <b>${signal.action}</b></p><h3>Canonical structure engine</h3><ul><li>Current structure: ${val(structure.latestStructure?.type ?? signal.fifteenMinute?.structure)}</li><li>Structure bias: ${val(structure.bias)}</li><li>Confirmation status: ${structure.confirmed ? 'Confirmed' : 'Unconfirmed'}</li><li>Recent BOS events: ${structure.bos?.length ?? 0}</li><li>Recent CHoCH events: ${structure.choch?.length ?? 0}</li><li>Swing highs: ${structure.swings?.filter((s) => s.type === 'HIGH').length ?? 0}</li><li>Swing lows: ${structure.swings?.filter((s) => s.type === 'LOW').length ?? 0}</li></ul><h3>SMC analysis</h3><ul><li>Liquidity levels: ${structure.liquidityLevels?.length ?? 0}</li><li>Liquidity sweeps: ${structure.liquiditySweeps?.length ?? 0}</li><li>Fair Value Gaps: ${structure.fairValueGaps?.length ?? 0}</li><li>FVG mitigation: ${structure.fairValueGaps?.filter((gap) => gap.mitigated).length ?? 0}</li><li>Order blocks: ${structure.orderBlocks?.length ?? 0}</li><li>BOS: ${structure.bos?.length ?? 0}</li><li>CHoCH: ${structure.choch?.length ?? 0}</li></ul><div class="event-columns"><div><h4>BOS</h4><ul>${list(structure.bos, (e) => `<li>${e.direction} at ${number(e.level)}</li>`)}</ul></div><div><h4>CHoCH</h4><ul>${list(structure.choch, (e) => `<li>${e.direction} from ${e.previousBias}</li>`)}</ul></div></div><h3>Indicators returned by signal result</h3><ul>${indicatorRows}</ul></section>`;
}
