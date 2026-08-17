import { SUPPORTED_SYMBOLS } from './aurion/config/index.mjs';
import { filterMarkets, formatCompact, formatUsd, marketStatus, renderMarketDetail, renderMarketOverview, sharedMarketSignalService } from './markets/markets.mjs';

const elements = {
  app: document.querySelector('#app'),
};

let selectedSymbol = SUPPORTED_SYMBOLS[0];
let query = '';
let filter = 'ALL';

function nav() {
  const items = [['/', 'Dashboard'], ['/signals', 'Signals'], ['/backtest', 'Backtest'], ['/history', 'Signal History'], ['/markets', 'Markets'], ['/settings', 'Settings']];
  return `<nav class="top-nav">${items.map(([href, label]) => `<a href="${href}" class="${location.pathname === href ? 'active' : ''}">${label}</a>`).join('')}</nav>`;
}

function signalIcon(action) { return action === 'LONG' ? '↗' : action === 'SHORT' ? '↘' : '◆'; }

function renderSignalCards(signals) {
  if (!signals.length) return '<div class="state-card">Empty market list</div>';
  return signals.map((signal) => `<article class="signal-card ${signal.action.toLowerCase()}"><div class="card-topline"><div><p class="pair">${signal.symbol}</p><h3>${formatUsd(signal.price)}</h3></div><div class="signal-badge">${signalIcon(signal.action)} ${signal.action}</div></div><div class="metric-row"><span>24h move</span><strong class="${signal.change24h >= 0 ? 'positive' : 'negative'}">${signal.change24h.toFixed(2)}%</strong></div><div class="metric-row"><span>Confidence</span><strong>${signal.confidence.toFixed(0)}%</strong></div><div class="meter"><span style="width: ${signal.confidence}%"></span></div><div class="timeframe-grid"><div><span>4H</span><strong>${signal.fourHour.bias}</strong></div><div><span>1H</span><strong>${signal.oneHour.status}</strong></div><div><span>15M</span><strong>${signal.fifteenMinute.entry}</strong></div><div><span>Final</span><strong>${signal.action}</strong></div></div><p class="explanation">${signal.explanation}</p><div class="indicators"><span>4H RSI ${signal.fourHour.rsi?.toFixed(1)}</span><span>1H RSI ${signal.oneHour.rsi?.toFixed(1)}</span><span>15M RSI ${signal.fifteenMinute.rsi?.toFixed(1)}</span><span>Vol ${formatCompact(signal.volume)}</span></div></article>`).join('');
}

function summary(signals) {
  const average = signals.length ? signals.reduce((sum, signal) => sum + signal.change24h, 0) / signals.length : 0;
  return `<aside class="pulse-panel"><div class="panel-title">▰ Market pulse</div><strong>${signals.filter((signal) => signal.action !== 'WAIT').length || 'Wait'}</strong><p>${signals.length ? `${average.toFixed(2)}% average 24h move across tracked assets` : 'Waiting for live crypto data...'}</p><div class="pulse-grid"><div><span>Long</span><b>${signals.filter((signal) => signal.action === 'LONG').length}</b></div><div><span>Short</span><b>${signals.filter((signal) => signal.action === 'SHORT').length}</b></div><div><span>Assets</span><b>${SUPPORTED_SYMBOLS.length}</b></div></div></aside>`;
}

function renderShell(content) { elements.app.innerHTML = `${nav()}${content}<footer>Signals are informational only, not financial advice. Public market-data access only; no order execution is provided.</footer>`; bind(); }

function currentSignals() { return sharedMarketSignalService.state.signals; }
function selectedSignal() { return currentSignals().find((signal) => signal.rawSymbol === selectedSymbol) ?? currentSignals()[0] ?? null; }

function renderDashboard() { const signals = currentSignals(); renderShell(`<main><section class="hero"><div class="hero-copy"><div class="eyebrow">◉ Live crypto signal engine</div><h1>Real-time AI-style crypto signals from live Binance market data.</h1><p>Aurion refreshes prices, candles, momentum, RSI, volume, MTF, structure, SMC, and signals through shared domain services.</p><div class="hero-actions"><button id="refreshButton" type="button">↻ Refresh live signals</button><span id="refreshStatus">${sharedMarketSignalService.state.status === 'loaded' ? 'Loaded from shared market service' : 'Connecting to live market data...'}</span></div></div>${summary(signals)}</section><div id="error" class="error ${sharedMarketSignalService.state.status === 'error' ? '' : 'hidden'}">${marketStatus(sharedMarketSignalService.state.errors[0])}</div><section class="signals-header"><div><p class="eyebrow">⚡ Signal board</p><h2>Highest-confidence opportunities</h2></div><p>▣ Existing AURION MTF signal engine.</p></section><section class="signals-grid">${sharedMarketSignalService.state.status === 'loading' ? '<div class="signal-card skeleton"></div><div class="signal-card skeleton"></div>' : renderSignalCards(signals)}</section></main>`); }

function renderMarkets() { const state = sharedMarketSignalService.state; const filtered = filterMarkets(state.signals, query, filter); const detail = selectedSignal(); const incomplete = state.signals.some((signal) => !signal.mtf?.fourHour || !signal.mtf?.oneHour || !signal.mtf?.fifteenMinute); renderShell(`<main><section class="signals-header"><div><p class="eyebrow">◎ Markets Center</p><h1>Asset discovery and market analysis.</h1></div><p>Presentation layer over existing market-data, MTF, structure, SMC, and signal engines.</p></section><div class="toolbar"><input id="marketSearch" placeholder="Search symbol" value="${query}" /><select id="marketFilter"><option>ALL</option><option>LONG</option><option>SHORT</option><option>WAIT</option></select><button id="refreshButton" type="button">↻ Refresh</button></div><div id="error" class="error ${state.status === 'error' || incomplete ? '' : 'hidden'}">${state.status === 'error' ? marketStatus(state.errors[0]) : 'Incomplete market analysis'}</div><section class="markets-layout"><div class="market-table"><div class="market-head"><span>Symbol</span><span>Price</span><span>24h</span><span>Volume</span><span>Signal</span><span>Conf.</span><span>4H</span><span>1H</span><span>15M</span></div>${state.status === 'loading' ? '<div class="state-card">Loading market analysis...</div>' : renderMarketOverview(filtered)}</div>${renderMarketDetail(detail)}</section></main>`); const select = document.querySelector('#marketFilter'); if (select) select.value = filter; }

function renderSimple(title, body) { renderShell(`<main><section class="hero-copy"><p class="eyebrow">AURION</p><h1>${title}</h1><p>${body}</p></section></main>`); }

function renderRoute() { if (location.pathname === '/markets') renderMarkets(); else if (location.pathname === '/signals') renderDashboard(); else if (location.pathname === '/backtest') renderSimple('Backtest Center', 'Use npm run backtest:sample or the CLI backtest module for deterministic historical validation.'); else if (location.pathname === '/history') renderSimple('Signal History', 'Signal history remains available through the existing in-memory domain model.'); else if (location.pathname === '/settings') renderSimple('Settings', 'Public market-data configuration only. No exchange private keys or order endpoints are stored.'); else renderDashboard(); }

function bind() {
  document.querySelector('#refreshButton')?.addEventListener('click', () => sharedMarketSignalService.refresh());
  document.querySelector('#marketSearch')?.addEventListener('input', (event) => { query = event.target.value; renderMarkets(); });
  document.querySelector('#marketFilter')?.addEventListener('change', (event) => { filter = event.target.value; renderMarkets(); });
  document.querySelectorAll('[data-symbol]').forEach((button) => button.addEventListener('click', () => { selectedSymbol = button.dataset.symbol; renderMarkets(); }));
}

sharedMarketSignalService.addEventListener('change', renderRoute);
renderRoute();
sharedMarketSignalService.start();
