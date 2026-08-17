# AURION AI Signals Architecture

AURION is organized so market analysis remains deterministic, testable, and independent of the dashboard.

```text
Market Data
↓
Candle Processing
↓
Indicators
↓
Structure
↓
SMC
↓
MTF
↓
Signal Engine
↓
Signal History
↓
Risk
↓
Backtest
↓
Dashboard / Signals Center / Signal History
```

## Layers

- `src/services/binance/` contains exchange-specific HTTP adapters. Core strategy modules do not consume Binance response rows directly.
- `src/aurion/data/` normalizes and validates candles before analysis.
- `src/aurion/indicators/` contains pure EMA, RSI, momentum, and slope functions.
- `src/aurion/structure/` owns swing-point and market-structure boundaries. BOS and CHoCH signatures are present for Phase 2 implementation.
- `src/aurion/smc/` defines liquidity, sweep, FVG, mitigation, and order-block boundaries without speculative SMC logic.
- `src/aurion/mtf/` preserves the current 4H regime, 1H setup confirmation, and 15M entry confirmation behavior.
- `src/aurion/signals/` exposes `generateSignal()`, the single live-analysis signal entry point, plus a shared signal service used by Dashboard, Signals Center, and Signal History consumers.
- `src/aurion/risk/` contains offline risk calculation helpers only. It does not place orders or connect to live trading.
- `src/aurion/backtest/` uses the same MTF/signal logic path as live analysis to avoid strategy forks and look-ahead bias.
- `src/aurion/history/` provides an in-memory signal history model. It validates stored Signal records, filters existing records by action and symbol, and sorts by the original timestamp without mutating signal-generation output. It intentionally has no database or browser-local persistence in Phase 4C.
- `src/components/` and `src/app/` are dashboard/UI boundaries and must render domain results instead of recalculating trading logic.

## Pure and Backtestable Modules

The data normalization, indicator, structure, MTF, risk, and backtest modules are deterministic when supplied historical inputs. Network access is isolated behind the market data provider and Binance service adapter.

## Current Constraints

Phase 1.5 intentionally does not implement live trading, fake AI/ML, or advanced SMC logic. SMC modules return explicit empty analysis structures until Phase 2 adds validated rules.

## Signal History Data Flow

```text
Market Data
↓
Existing Signal Engine
↓
Signal
↓
Signal History
↓
/history
```

The `/history` page reads stored records from the history domain only. It renders timestamp, symbol, action, confidence, price, reason, MTF analysis, market structure, BOS, CHoCH, and existing SMC/indicator fields where those fields are present on the Signal. The UI does not calculate trading logic, does not poll Binance, and does not create a second signal-generation system.
