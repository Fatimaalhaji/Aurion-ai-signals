export function calculateStopLoss() { return null; }
export function calculateTakeProfit() { return null; }
export function calculateRiskReward(entryPrice, stopLoss, takeProfit) { if (entryPrice === stopLoss) return null; return Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss); }
export function calculatePositionSize({ accountEquity, riskPercent, entryPrice, stopLoss }) { const riskAmount = accountEquity * (riskPercent / 100); const perUnitRisk = Math.abs(entryPrice - stopLoss); return perUnitRisk === 0 ? 0 : riskAmount / perUnitRisk; }
export function validateDailyRisk(requestedRiskPercent, maxDailyRiskPercent) { return requestedRiskPercent <= maxDailyRiskPercent; }
