const formatUsd = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: value > 100 ? 0 : 4,
}).format(value);

const formatNumber = (value, digits = 2) => value == null ? 'Unavailable' : Number(value).toFixed(digits);
const formatTimestamp = (timestamp) => timestamp ? new Date(timestamp).toLocaleString() : 'Unavailable';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function signalIcon(action) {
  if (action === 'LONG') return '↗';
  if (action === 'SHORT') return '↘';
  return '◆';
}

export function filterSignals(signals, action = 'ALL', symbolQuery = '') {
  const query = symbolQuery.trim().toUpperCase();
  return signals.filter((signal) => (action === 'ALL' || signal.action === action) && (!query || signal.symbol.toUpperCase().includes(query) || signal.rawSymbol.toUpperCase().includes(query)));
}

function last(items) {
  return Array.isArray(items) && items.length ? items.at(-1) : null;
}

function eventPill(label, event) {
  if (!event) return '';
  const detail = event.direction ? `${event.direction} @ ${formatNumber(event.level ?? event.price, 2)}` : formatNumber(event.price ?? event.level, 2);
  return `<span>${escapeHtml(label)}: ${escapeHtml(detail)}</span>`;
}

function timeframeBlock(label, subtitle, analysis) {
  return `<div class="tf-block"><span>${label}</span><strong>${escapeHtml(subtitle)}</strong><small>Bias ${escapeHtml(analysis?.bias ?? 'Unavailable')} · ${escapeHtml(analysis?.status ?? analysis?.entry ?? 'Unavailable')}</small></div>`;
}

function indicatorList(signal) {
  const entry = signal.fifteenMinute ?? {};
  return [
    `EMA 50 ${formatNumber(entry.ema50, 2)}`,
    `EMA 200 ${formatNumber(entry.ema200, 2)}`,
    `EMA slope ${formatNumber(entry.emaSlope, 3)}%`,
    `RSI ${formatNumber(entry.rsi, 1)}`,
    `Momentum ${formatNumber(entry.momentum, 2)}%`,
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join('');
}

function smcList(signal) {
  const smc = signal.smcConfirmation?.fifteenMinute ?? signal.mtf?.smc?.fifteenMinute;
  if (!smc) return '<p class="muted">SMC unavailable from domain engine.</p>';
  const pills = [
    eventPill('BOS', last(smc.bos)),
    eventPill('CHoCH', last(smc.choch)),
    eventPill('Liquidity', last(smc.liquidityLevels)),
    eventPill('Liquidity sweep', last(smc.liquiditySweeps)),
    eventPill('FVG', last(smc.fairValueGaps)),
    eventPill('FVG mitigation', last((smc.fairValueGaps ?? []).filter((fvg) => fvg.mitigated))),
    eventPill('Order block', last(smc.orderBlocks)),
  ].filter(Boolean);
  return pills.length ? `<div class="indicators">${pills.join('')}</div>` : '<p class="muted">No current SMC events detected.</p>';
}

function structureSection(signal) {
  const structure = signal.structure ?? signal.smcConfirmation?.fifteenMinute;
  const latest = structure?.latestStructure;
  return `<div class="detail-section"><h4>Canonical market structure</h4><p class="muted">BOS/CHoCH events are displayed from the domain market-structure/SMC implementation.</p><div class="detail-grid"><div><span>Latest structure</span><strong>${escapeHtml(latest?.type ?? 'None')}</strong></div><div><span>Bias</span><strong>${escapeHtml(structure?.bias ?? 'NEUTRAL')}</strong></div><div><span>BOS events</span><strong>${structure?.bos?.length ?? 0}</strong></div><div><span>CHoCH events</span><strong>${structure?.choch?.length ?? 0}</strong></div><div><span>Confirmation</span><strong>${structure?.confirmed ? 'Confirmed' : 'Unconfirmed'}</strong></div></div></div>`;
}

export function renderSignalCards(signals) {
  if (!signals.length) return '<div class="empty-state">No signals match the current filters.</div>';
  return signals.map((signal) => `<article class="signal-card ${signal.action.toLowerCase()}"><div class="card-topline"><div><p class="pair">${escapeHtml(signal.symbol)}</p><h3>${formatUsd(signal.price)}</h3></div><div class="signal-badge">${signalIcon(signal.action)} ${signal.action}</div></div><div class="metric-row"><span>Confidence</span><strong>${formatNumber(signal.confidence, 0)}%</strong></div><div class="metric-row"><span>Timestamp</span><strong>${escapeHtml(formatTimestamp(signal.timestamp))}</strong></div><div class="meter" aria-label="Confidence ${formatNumber(signal.confidence, 0)} percent"><span style="width: ${signal.confidence}%"></span></div><div class="timeframe-grid signals-timeframes">${timeframeBlock('4H', 'Primary regime', signal.fourHour)}${timeframeBlock('1H', 'Confirmation', signal.oneHour)}${timeframeBlock('15M', 'Entry condition', signal.fifteenMinute)}<div><span>FINAL SIGNAL</span><strong>${escapeHtml(signal.action)}</strong></div></div><details><summary>Inspect signal</summary><div class="detail-section"><h4>${escapeHtml(signal.symbol)} · ${escapeHtml(signal.action)} · ${formatNumber(signal.confidence, 0)}%</h4><p class="muted">${escapeHtml(formatTimestamp(signal.timestamp))}</p><p>${escapeHtml(signal.reason)}</p></div>${structureSection(signal)}<div class="detail-section"><h4>SMC</h4>${smcList(signal)}</div><div class="detail-section"><h4>Indicators</h4><div class="indicators">${indicatorList(signal)}</div></div></details></article>`).join('');
}
