# Aurion AI Signals

Live crypto signals dashboard powered by Binance market data and a deterministic multi-timeframe analysis engine.

## Current Status

Phase 4C adds a dedicated Signal History page without changing MTF, SMC, BOS/CHoCH, or signal-generation logic. The product still does not include live trading, order execution, fake AI/ML claims, API secrets, or database persistence.

## Pages

- `/` — Dashboard using the existing live signal-generation path.
- `/signals` — Signals view using the same dashboard signal path.
- `/backtest` — Backtest entry page.
- `/history` — Signal History view of stored AURION Signal records.
- `/markets` — Markets entry page.
- `/settings` — Settings entry page.

## Signal History

Signal History is implemented in `src/aurion/history/signalHistory.mjs` as an in-memory domain boundary. It stores only valid existing Signal records emitted by the shared signal service and exposes deterministic query filters for action, symbol, and chronological sorting.

The current implementation intentionally has no database and no browser-local persistence. A persistent adapter can be added later behind the same history boundary without moving trading logic into the UI.

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
npm run backtest:sample
PYTHONPATH=src python3 -m aurion_ai_signals
git diff --check
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Market Data → Indicators → Structure → SMC → MTF → Signal Engine → Signal History → Dashboard flow.
