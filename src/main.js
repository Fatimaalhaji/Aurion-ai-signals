const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
const POLL_MS = 15000;
const API_BASE = 'https://api.binance.com/api/v3';

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function calculateRsi(closes, period = 14) {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function sma(values, period) {
  if (values.length < period) return values.at(-1) ?? 0;
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

function buildSignal(ticker, candles) {
  const closes = candles.map((candle) => Number(candle[4]));
  const highs = candles.map((candle) => Number(candle[2]));
  const lows = candles.map((candle) => Number(candle[3]));
  const price = Number(ticker.lastPrice);
  const change24h = Number(ticker.priceChangePercent);
  const volume = Number(ticker.quoteVolume);
  const rsi = calculateRsi(closes);
  const fast = sma(closes, 8);
  const slow = sma(closes, 21);
  const high = Math.max(...highs.slice(-24));
  const low = Math.min(...lows.slice(-24));
  const rangePosition = high === low ? 50 : ((price - low) / (high - low)) * 100;
  const momentum = ((fast - slow) / slow) * 100;
  const score = clamp(50 + momentum * 9 + change24h * 1.7 + (rsi - 50) * 0.55 + (rangePosition - 50) * 0.25, 0, 100);

  let action = 'HOLD';
  if (score >= 68 && rsi < 78) action = 'BUY';
  if (score <= 32 && rsi > 22) action = 'SELL';

  const risk = Math.max(price * 0.008, (high - low) * 0.18);
  const direction = action === 'SELL' ? -1 : 1;
  const target = action === 'HOLD' ? null : price + direction * risk * 1.8;
  const stop = action === 'HOLD' ? null : price - direction * risk;
  const confidence = action === 'HOLD' ? clamp(100 - Math.abs(score - 50) * 1.2, 42, 72) : clamp(Math.abs(score - 50) * 1.75, 55, 94);

  return {
    symbol: ticker.symbol.replace('USDT', '/USDT'), rawSymbol: ticker.symbol, price, change24h, volume,
    rsi, fast, slow, action, target, stop, confidence,
  };
}

async function fetchSignal(symbol) {
  const [tickerResponse, candlesResponse] = await Promise.all([
    fetch(`${API_BASE}/ticker/24hr?symbol=${symbol}`),
    fetch(`${API_BASE}/klines?symbol=${symbol}&interval=15m&limit=96`),
  ]);
  if (!tickerResponse.ok || !candlesResponse.ok) throw new Error(`Market data request failed for ${symbol}`);
  return buildSignal(await tickerResponse.json(), await candlesResponse.json());
}

function renderSkeletons() {
  elements.grid.innerHTML = Array.from({ length: 8 }, () => '<div class="signal-card skeleton"></div>').join('');
}

function renderSignals(signals) {
  elements.grid.innerHTML = signals.map((signal) => `
    <article class="signal-card ${signal.action.toLowerCase()}">
      <div class="card-topline">
        <div><p class="pair">${signal.symbol}</p><h3>${formatUsd(signal.price)}</h3></div>
        <div class="signal-badge">${signal.action === 'BUY' ? '↗' : signal.action === 'SELL' ? '↘' : '◆'} ${signal.action}</div>
      </div>
      <div class="metric-row"><span>24h move</span><strong class="${signal.change24h >= 0 ? 'positive' : 'negative'}">${signal.change24h.toFixed(2)}%</strong></div>
      <div class="metric-row"><span>AI confidence</span><strong>${signal.confidence.toFixed(0)}%</strong></div>
      <div class="meter" aria-label="Confidence ${signal.confidence.toFixed(0)} percent"><span style="width: ${signal.confidence}%"></span></div>
      <div class="trade-plan">
        <div><span>Entry</span><strong>${formatUsd(signal.price)}</strong></div>
        <div><span>Target</span><strong>${signal.target ? formatUsd(signal.target) : 'Wait'}</strong></div>
        <div><span>Stop</span><strong>${signal.stop ? formatUsd(signal.stop) : 'Wait'}</strong></div>
      </div>
      <div class="indicators"><span>RSI ${signal.rsi.toFixed(1)}</span><span>Trend ${signal.fast >= signal.slow ? 'Bullish' : 'Bearish'}</span><span>Vol ${formatCompact(signal.volume)}</span></div>
    </article>
  `).join('');
}

function renderPulse(signals) {
  const average = signals.reduce((sum, signal) => sum + signal.change24h, 0) / signals.length;
  elements.pulseBias.textContent = average >= 0 ? 'Risk-on' : 'Risk-off';
  elements.pulseAverage.textContent = `${average.toFixed(2)}% average 24h move across tracked assets`;
  elements.buyCount.textContent = signals.filter((signal) => signal.action === 'BUY').length;
  elements.sellCount.textContent = signals.filter((signal) => signal.action === 'SELL').length;
}

async function loadSignals() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.classList.add('loading');
  elements.error.classList.add('hidden');
  if (!elements.grid.children.length) renderSkeletons();

  try {
    const settled = await Promise.allSettled(SYMBOLS.map(fetchSignal));
    const signals = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .sort((a, b) => b.confidence - a.confidence);
    if (!signals.length) throw new Error('No live crypto data was returned.');
    renderSignals(signals);
    renderPulse(signals);
    elements.refreshStatus.textContent = `Updated ${new Date().toLocaleTimeString()} from Binance spot data`;
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
