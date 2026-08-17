import { signalHistory } from './aurion/history/signalHistory.mjs';

const elements = {
  tbody: document.querySelector('#historyRows'),
  empty: document.querySelector('#historyEmpty'),
  error: document.querySelector('#historyError'),
  action: document.querySelector('#actionFilter'),
  symbol: document.querySelector('#symbolFilter'),
  sort: document.querySelector('#sortFilter'),
};

const formatUsd = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value > 100 ? 0 : 4 }).format(value);
const formatTime = (timestamp) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
const text = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const count = (items) => Array.isArray(items) ? String(items.length) : '—';

function structureSummary(signal) {
  if (signal.structure?.bias) return signal.structure.bias;
  return signal.mtf?.smc?.bias ?? signal.smcConfirmation?.bias ?? '—';
}

function smc(signal) {
  return signal.smcConfirmation ?? signal.mtf?.smc ?? null;
}

function renderDetails(signal) {
  const smartMoney = smc(signal);
  return `
    <div class="history-detail-grid">
      <div><span>Symbol</span><strong>${text(signal.symbol)}</strong></div>
      <div><span>Action</span><strong>${text(signal.action)}</strong></div>
      <div><span>Confidence</span><strong>${signal.confidence.toFixed(0)}%</strong></div>
      <div><span>Timestamp</span><strong>${formatTime(signal.timestamp)}</strong></div>
      <div><span>Price</span><strong>${formatUsd(signal.price)}</strong></div>
      <div><span>Reason</span><strong>${text(signal.reason)}</strong></div>
      <div><span>4H</span><strong>${text(signal.mtf?.fourHour?.bias ?? signal.fourHour?.bias)}</strong></div>
      <div><span>1H</span><strong>${text(signal.mtf?.oneHour?.status ?? signal.oneHour?.status)}</strong></div>
      <div><span>15M</span><strong>${text(signal.mtf?.fifteenMinute?.entry ?? signal.fifteenMinute?.entry)}</strong></div>
      <div><span>Market Structure</span><strong>${structureSummary(signal)}</strong></div>
      <div><span>BOS</span><strong>${count(signal.structure?.bos ?? smartMoney?.fifteenMinute?.bos)}</strong></div>
      <div><span>CHoCH</span><strong>${count(signal.structure?.choch ?? smartMoney?.fifteenMinute?.choch)}</strong></div>
      <div><span>Liquidity</span><strong>${count(smartMoney?.fifteenMinute?.liquidityLevels)}</strong></div>
      <div><span>Liquidity Sweep</span><strong>${count(smartMoney?.fifteenMinute?.liquiditySweeps)}</strong></div>
      <div><span>FVG</span><strong>${count(smartMoney?.fifteenMinute?.fairValueGaps)}</strong></div>
      <div><span>FVG Mitigation</span><strong>${count(smartMoney?.fifteenMinute?.fairValueGaps?.filter((fvg) => fvg.mitigated))}</strong></div>
      <div><span>Order Block</span><strong>${count(smartMoney?.fifteenMinute?.orderBlocks)}</strong></div>
      <div><span>Indicators</span><strong>4H RSI ${text(signal.mtf?.fourHour?.rsi ?? signal.fourHour?.rsi)} · 1H RSI ${text(signal.mtf?.oneHour?.rsi ?? signal.oneHour?.rsi)} · 15M RSI ${text(signal.mtf?.fifteenMinute?.rsi ?? signal.fifteenMinute?.rsi)}</strong></div>
    </div>`;
}

function row(signal, index) {
  return `<tr class="history-row ${signal.action.toLowerCase()}">
    <td data-label="Time">${formatTime(signal.timestamp)}</td>
    <td data-label="Symbol">${text(signal.symbol)}</td>
    <td data-label="Signal"><span class="signal-badge">${text(signal.action)}</span></td>
    <td data-label="Confidence">${signal.confidence.toFixed(0)}%</td>
    <td data-label="Price">${formatUsd(signal.price)}</td>
    <td data-label="4H">${text(signal.mtf?.fourHour?.bias ?? signal.fourHour?.bias)}</td>
    <td data-label="1H">${text(signal.mtf?.oneHour?.status ?? signal.oneHour?.status)}</td>
    <td data-label="15M">${text(signal.mtf?.fifteenMinute?.entry ?? signal.fifteenMinute?.entry)}</td>
    <td data-label="Structure">${structureSummary(signal)}</td>
    <td data-label="Actions"><button class="detail-toggle" type="button" aria-expanded="false" data-index="${index}">View Details</button></td>
  </tr><tr class="detail-row hidden" id="detail-${index}"><td colspan="10">${renderDetails(signal)}</td></tr>`;
}

export function renderHistory() {
  try {
    elements.error.classList.add('hidden');
    const records = signalHistory.query({ action: elements.action.value, symbol: elements.symbol.value, sort: elements.sort.value });
    elements.empty.classList.toggle('hidden', records.length > 0);
    elements.tbody.innerHTML = records.map(row).join('');
  } catch (error) {
    elements.error.textContent = error.message;
    elements.error.classList.remove('hidden');
  }
}

elements.tbody.addEventListener('click', (event) => {
  const button = event.target.closest('.detail-toggle');
  if (!button) return;
  const detail = document.querySelector(`#detail-${button.dataset.index}`);
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  button.textContent = expanded ? 'View Details' : 'Hide Details';
  detail.classList.toggle('hidden', expanded);
});
[elements.action, elements.symbol, elements.sort].forEach((element) => element.addEventListener('input', renderHistory));
renderHistory();
