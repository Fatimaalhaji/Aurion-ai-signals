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
Risk
↓
Backtest
↓
Dashboard
```

## Layers

- `src/services/binance/` contains exchange-specific HTTP adapters. Core strategy modules do not consume Binance response rows directly.
- `src/aurion/data/` normalizes and validates candles before analysis.
- `src/aurion/indicators/` contains pure EMA, RSI, momentum, and slope functions.
- `src/aurion/structure/` owns swing-point and market-structure boundaries. BOS and CHoCH signatures are present for Phase 2 implementation.
- `src/aurion/smc/` defines liquidity, sweep, FVG, mitigation, and order-block boundaries without speculative SMC logic.
- `src/aurion/mtf/` preserves the current 4H regime, 1H setup confirmation, and 15M entry confirmation behavior.
- `src/aurion/signals/` exposes `generateSignal()`, the single live-analysis signal entry point.
- `src/aurion/risk/` contains offline risk calculation helpers only. It does not place orders or connect to live trading.
- `src/aurion/backtest/` uses the same MTF/signal logic path as live analysis to avoid strategy forks and look-ahead bias.
- `src/aurion/history/` provides an in-memory signal history model.
- `src/components/` and `src/app/` are dashboard/UI boundaries and must render domain results instead of recalculating trading logic.

## Pure and Backtestable Modules

The data normalization, indicator, structure, MTF, risk, and backtest modules are deterministic when supplied historical inputs. Network access is isolated behind the market data provider and Binance service adapter.

## Current Constraints

Phase 1.5 intentionally does not implement live trading, fake AI/ML, or advanced SMC logic. SMC modules return explicit empty analysis structures until Phase 2 adds validated rules.


## AURION application centers

- **Dashboard (`/`)** remains the home page for live market pulse and high-confidence signal cards.
- **Signals Center (`/signals/`)** preserves the live signal-board experience on a dedicated route.
- **Backtest Center (`/backtest/`)** is a dedicated historical simulation UI. It calls the existing `runBacktest` domain engine, which in turn uses the same AURION signal engine used by live analysis; the UI does not implement EMA, RSI, MTF, SMC, BOS/CHoCH, trade simulation, P&L, drawdown, or win-rate calculations.

Backtest Center validates historical candle availability and quality before showing results. Real-data runs remain offline/local-data based through the existing dataset adapter and validation workflow; the browser page does not download market data or add exchange credentials/order execution. If synthetic mode is used, it is labeled **SYNTHETIC SAMPLE — NOT REAL MARKET DATA** and is never presented as real market history.
