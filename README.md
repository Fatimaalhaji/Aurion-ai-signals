# Aurion AI Signals

Live crypto signals dashboard powered by Binance public market data and deterministic AURION market-analysis engines.

## Centers

- **Dashboard (`/`)** — high-level live signal dashboard using the shared market signal service.
- **Signals Center (`/signals`)** — signal-board view over the same generated AURION signal results.
- **Backtest Center (`/backtest`)** — entry point documenting the deterministic CLI backtest workflow; no browser order execution is provided.
- **Signal History (`/history`)** — presentation entry point for the existing signal-history domain model.
- **Markets Center (`/markets`)** — asset-discovery and market-analysis page for configured symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, and `XRPUSDT`.
- **Settings (`/settings`)** — public market-data configuration surface only; no exchange private keys or trading credentials.

## Markets Center

The Markets Center is a presentation layer over the existing domain engines. It consumes generated signal results from the shared market-data/signal service and displays:

- current price, 24h change, and volume from public Binance market data;
- final AURION signal, confidence, and reason from the signal engine;
- 4H regime, 1H confirmation, and 15M entry state from the existing MTF result;
- canonical structure and SMC events returned by the existing structure/SMC engines;
- indicators already exposed by signal results: EMA 50, EMA 200, EMA slope, RSI, and momentum.

The UI does not add indicators, duplicate Binance polling, create fake fallback data, execute orders, or calculate trading decisions.

## Run

```bash
npm start
```

Open <http://localhost:5173> to view the dashboard. Static routes are available at `/`, `/signals`, `/backtest`, `/history`, `/markets`, and `/settings`.

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

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Market Data → Indicators → Structure → SMC → MTF → Signal Engine → Risk → Backtest → Dashboard / Signals / Markets flow.
