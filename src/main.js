import { API_CONFIG, SUPPORTED_SYMBOLS } from './aurion/config/index.mjs';
import { loadGeneratedSignals } from './aurion/signals/signalService.mjs';

const SYMBOLS = SUPPORTED_SYMBOLS;
const POLL_MS = API_CONFIG.pollMs;

const elements = {
  grid: document.querySelector('#signalsGrid'),
  refreshButton: document.querySelector('#refreshButton'),
  refreshStatus: document.querySelector('#refreshStatus'),
  error: document.querySelector('#error'),
  pulseBias: document.querySelector('#pulseBias'),
  pulseAverage: document.querySelector('#pulseAverage'),
  buyCount: document.querySelector('#buyCount'),
  sellCount: document.querySelector('#sellCount'),
};

const formatUsd = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: value > 100 ? 0 : 4,
}).format(value);

const formatCompact = (value) => new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
}).format(value);

function renderSkeletons() {
  elements.grid.innerHTML = Array.from({ length: 8 }, () => '<div class="signal-card skeleton"></div>').join('');
}

function signalIcon(action) {
  if (action === 'LONG') return '↗';
  if (action === 'SHORT') return '↘';
  return '◆';
}

function renderSignals(signals) {
  elements.grid.innerHTML = signals.map((signal) => `
    <article class="signal-card ${signal.action.toLowerCase()}">
      <div class="card-topline">
        <div><p class="pair">${signal.symbol}</p><h3>${formatUsd(signal.price)}</h3></div>
        <div class="signal-badge">${signalIcon(signal.action)} ${signal.action}</div>
      </div>
      <div class="metric-row"><span>24h move</span><strong class="${signal.change24h >= 0 ? 'positive' : 'negative'}">${signal.change24h.toFixed(2)}%</strong></div>
      <div class="metric-row"><span>Confidence</span><strong>${signal.confidence.toFixed(0)}%</strong></div>
      <div class="meter" aria-label="Confidence ${signal.confidence.toFixed(0)} percent"><span style="width: ${signal.confidence}%"></span></div>
      <div class="timeframe-grid">
        <div><span>4H</span><strong>${signal.fourHour.bias}</strong></div>
        <div><span>1H</span><strong>${signal.oneHour.status}</strong></div>
        <div><span>15M</span><strong>${signal.fifteenMinute.entry}</strong></div>
        <div><span>Final</span><strong>${signal.action}</strong></div>
      </div>
      <p class="explanation">${signal.explanation}</p>
      <div class="indicators"><span>4H RSI ${signal.fourHour.rsi.toFixed(1)}</span><span>1H RSI ${signal.oneHour.rsi.toFixed(1)}</span><span>15M RSI ${signal.fifteenMinute.rsi.toFixed(1)}</span><span>Vol ${formatCompact(signal.volume)}</span></div>
    </article>
  `).join('');
}

function renderPulse(signals) {
  const actionable = signals.filter((signal) => signal.action !== 'WAIT');
  const average = signals.reduce((sum, signal) => sum + signal.change24h, 0) / signals.length;
  elements.pulseBias.textContent = actionable.length ? `${actionable.length} aligned` : 'Wait';
  elements.pulseAverage.textContent = `${average.toFixed(2)}% average 24h move across tracked assets`;
  elements.buyCount.textContent = signals.filter((signal) => signal.action === 'LONG').length;
  elements.sellCount.textContent = signals.filter((signal) => signal.action === 'SHORT').length;
}

async function loadSignals() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.classList.add('loading');
  elements.error.classList.add('hidden');
  if (!elements.grid.children.length) renderSkeletons();

  try {
    const { signals: generatedSignals, failures } = await loadGeneratedSignals({ symbols: SYMBOLS });
    const signals = generatedSignals.sort((a, b) => b.confidence - a.confidence);
    if (!signals.length) throw new Error('No live crypto data was returned. Binance may be rate limiting requests.');
    renderSignals(signals);
    renderPulse(signals);
    elements.refreshStatus.textContent = `Updated ${new Date().toLocaleTimeString()} from Binance MTF candle data${failures.length ? ` (${failures.length} symbols delayed)` : ''}`;
  } catch (error) {
    elements.error.textContent = error.message;
    elements.error.classList.remove('hidden');
    elements.refreshStatus.textContent = 'Live feed temporarily unavailable';
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.classList.remove('loading');
  }
}

elements.refreshButton.addEventListener('click', loadSignals);
loadSignals();
window.setInterval(loadSignals, POLL_MS);
