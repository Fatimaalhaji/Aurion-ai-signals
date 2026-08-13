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
