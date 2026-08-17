# Aurion AI Signals

Live crypto signals dashboard powered by Binance market data and a deterministic multi-timeframe analysis engine.

## Current Status

Phase 1.5 prepares the production module boundaries for future AURION work without adding live trading, order execution, fake AI/ML, or advanced SMC logic.

## Run

```bash
npm start
```

Open <http://localhost:5173> to view the dashboard.

The Python health entry point remains available:

```bash
PYTHONPATH=src python -m aurion_ai_signals
```

Expected output:

```text
aurion-ai-signals: ok
```

## Test and Build

```bash
npm test
npm run build
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Market Data → Indicators → Structure → SMC → MTF → Signal Engine → Risk → Backtest → Dashboard flow.


## AURION application centers

- **Dashboard (`/`)** remains the home page for live market pulse and high-confidence signal cards.
- **Signals Center (`/signals/`)** preserves the live signal-board experience on a dedicated route.
- **Backtest Center (`/backtest/`)** is a dedicated historical simulation UI. It calls the existing `runBacktest` domain engine, which in turn uses the same AURION signal engine used by live analysis; the UI does not implement EMA, RSI, MTF, SMC, BOS/CHoCH, trade simulation, P&L, drawdown, or win-rate calculations.

Backtest Center validates historical candle availability and quality before showing results. Real-data runs remain offline/local-data based through the existing dataset adapter and validation workflow; the browser page does not download market data or add exchange credentials/order execution. If synthetic mode is used, it is labeled **SYNTHETIC SAMPLE — NOT REAL MARKET DATA** and is never presented as real market history.
