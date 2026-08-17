# AURION AI Signals Architecture

AURION is organized so market analysis remains deterministic, testable, and independent of presentation pages.

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
Shared Market Signal Service
↓
Dashboard / Signals Center / Markets Center

Risk + Backtest consume the same signal path for offline validation.
Signal History remains a separate in-memory domain model.
```

## Layers

- `src/services/binance/` contains exchange-specific HTTP adapters for public market data. Core strategy modules do not consume Binance response rows directly.
- `src/aurion/config/` owns the supported symbol list and timeframe constants. The Markets Center reads symbols from this centralized configuration.
- `src/aurion/data/` normalizes and validates candles before analysis.
- `src/aurion/indicators/` contains pure EMA, RSI, momentum, and slope functions.
- `src/aurion/structure/` owns swing-point and market-structure boundaries.
- `src/aurion/smc/` returns canonical liquidity, sweep, FVG, mitigation, order-block, BOS, and CHoCH analysis.
- `src/aurion/mtf/` preserves the current 4H regime, 1H setup confirmation, and 15M entry confirmation behavior.
- `src/aurion/signals/` exposes `generateSignal()`, the single live-analysis signal entry point.
- `src/markets/markets.mjs` provides the shared browser market signal service plus Markets Center render helpers. It reuses `generateSignal()` and does not recalculate strategy decisions in the UI.
- `src/aurion/risk/` contains offline risk calculation helpers only. It does not place orders or connect to live trading.
- `src/aurion/backtest/` uses the same MTF/signal logic path as live analysis to avoid strategy forks and look-ahead bias.
- `src/aurion/history/` provides an in-memory signal history model.
- `src/components/` and `src/app/` remain UI boundaries and must render domain results instead of recalculating trading logic.

## Presentation Centers

- **Dashboard (`/`)** summarizes live market pulse and signal cards from the shared market signal service.
- **Signals Center (`/signals`)** reuses the dashboard signal-board presentation and the same shared service state.
- **Backtest Center (`/backtest`)** points users to the deterministic CLI backtest workflow rather than live trading.
- **Signal History (`/history`)** keeps the existing history boundary visible without introducing browser persistence or fabricated records.
- **Markets Center (`/markets`)** is an asset-discovery and analysis presentation layer over existing market-data, MTF, structure, SMC, and signal-engine modules. It displays only fields/events returned by those engines.
- **Settings (`/settings`)** is limited to public market-data configuration messaging. It must not store browser secrets or exchange private keys.

## Shared Data Flow

Dashboard, Signals Center, and Markets Center use one shared browser service instance that requests configured symbols through `generateSignal()`. That service owns refresh state, cache reuse, loading/error states, and the polling interval so the UI does not create multiple independent Binance polling loops.

## Pure and Backtestable Modules

The data normalization, indicator, structure, SMC, MTF, risk, and backtest modules are deterministic when supplied historical inputs. Network access is isolated behind the market data provider and Binance service adapter.

## Current Constraints

AURION does not implement live trading, order execution, exchange private-key storage, browser secrets, fake AI/ML, fake market data, or UI-side strategy logic. Public market-data access is read-only.
