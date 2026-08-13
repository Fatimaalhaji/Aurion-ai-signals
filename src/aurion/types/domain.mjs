/**
 * Central AURION domain type definitions for deterministic analysis modules.
 * These JSDoc typedefs keep the current JavaScript app strongly documented
 * without introducing a build step before a TypeScript migration.
 *
 * @typedef {'15m'|'1h'|'4h'} Timeframe
 * @typedef {'BULLISH'|'BEARISH'|'NEUTRAL'} MarketRegime
 * @typedef {'BULLISH'|'BEARISH'|'NEUTRAL'} TrendDirection
 * @typedef {'LONG'|'SHORT'|'WAIT'} SignalAction
 * @typedef {number} ConfidenceScore - 0 to 100 inclusive.
 * @typedef {string} MarketSymbol
 *
 * @typedef {object} Candle
 * @property {number} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 * @property {number=} closeTime
 *
 * @typedef {'HIGH'|'LOW'} SwingPointType
 * @typedef {object} SwingPoint
 * @property {SwingPointType} type
 * @property {number} value
 * @property {number} index
 * @property {number=} time
 *
 * @typedef {object} BOS
 * @property {TrendDirection} direction
 * @property {SwingPoint} brokenSwing
 * @property {number} breakIndex
 * @property {number} breakPrice
 *
 * @typedef {object} CHoCH
 * @property {TrendDirection} direction
 * @property {SwingPoint} brokenSwing
 * @property {number} breakIndex
 * @property {number} breakPrice
 *
 * @typedef {object} MarketStructure
 * @property {TrendDirection} bias
 * @property {SwingPoint[]} swings
 * @property {BOS[]} bos
 * @property {CHoCH[]} choch
 *
 * @typedef {'BUY_SIDE'|'SELL_SIDE'} LiquidityLevelSide
 * @typedef {object} LiquidityLevel
 * @property {LiquidityLevelSide} side
 * @property {number} price
 * @property {number} index
 * @property {boolean} swept
 *
 * @typedef {object} LiquiditySweep
 * @property {LiquidityLevel} level
 * @property {number} sweepIndex
 * @property {number} sweepPrice
 * @property {boolean} confirmed
 *
 * @typedef {object} FVG
 * @property {TrendDirection} direction
 * @property {number} startIndex
 * @property {number} endIndex
 * @property {number} high
 * @property {number} low
 * @property {boolean} mitigated
 *
 * @typedef {object} OrderBlock
 * @property {TrendDirection} direction
 * @property {number} index
 * @property {number} high
 * @property {number} low
 * @property {boolean} mitigated
 *
 * @typedef {object} TimeframeAnalysis
 * @property {string} timeframe
 * @property {TrendDirection} bias
 * @property {ConfidenceScore} confidence
 * @property {string} status
 * @property {number|null} ema50
 * @property {number|null} ema200
 * @property {number|null} emaSlope
 * @property {number|null} rsi
 * @property {number|null} momentum
 * @property {TrendDirection} structure
 *
 * @typedef {object} MTFAnalysis
 * @property {TimeframeAnalysis & {regime?: MarketRegime}} fourHour
 * @property {TimeframeAnalysis} oneHour
 * @property {TimeframeAnalysis & {entry?: SignalAction}} fifteenMinute
 *
 * @typedef {object} Signal
 * @property {MarketSymbol} symbol
 * @property {MarketSymbol=} rawSymbol
 * @property {Timeframe} timeframe
 * @property {SignalAction} action
 * @property {ConfidenceScore} confidence
 * @property {string} reason
 * @property {MTFAnalysis} mtf
 * @property {MarketStructure|null} structure
 * @property {object|null} smcConfirmation
 * @property {number} timestamp
 *
 * @typedef {object} RiskParameters
 * @property {number} accountEquity
 * @property {number} riskPercent
 * @property {number} maxDailyRiskPercent
 * @property {number} minimumRewardRiskRatio
 *
 * @typedef {object} BacktestResult
 * @property {Signal[]} signals
 * @property {number} trades
 * @property {number} wins
 * @property {number} losses
 * @property {number} winRate
 * @property {number} profitLoss
 * @property {number} maxDrawdown
 */

export const DOMAIN_TYPES_VERSION = '1.5.0';
