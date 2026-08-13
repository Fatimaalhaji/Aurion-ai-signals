# AURION Historical OHLCV Data Guide

AURION can run a real-data backtest only when you provide a complete local historical dataset. The project does **not** automatically download market data and this guide does not endorse or configure a data vendor. Use data that you are licensed to use, then validate it before backtesting.

## Required symbols and timeframes

Provide one directory per symbol:

- `BTCUSDT`
- `ETHUSDT`
- `SOLUSDT`
- `BNBUSDT`
- `XRPUSDT`

Each symbol directory must contain all three timeframe files:

- `4h.csv` or `4h.json`
- `1h.csv` or `1h.json`
- `15m.csv` or `15m.json`

Example layout:

```text
data/
  BTCUSDT/
    4h.csv
    1h.csv
    15m.csv
    manifest.json
```

## Required candle columns

CSV files must include this header, with these exact column names:

```csv
timestamp,open,high,low,close,volume
```

JSON files may be either an array of candle objects or `{ "candles": [] }`. Each object must include:

```json
{
  "timestamp": 1735689600000,
  "open": 100.0,
  "high": 101.0,
  "low": 99.0,
  "close": 100.5,
  "volume": 10.0
}
```

## Timestamp format

The current parser accepts:

- Unix milliseconds, for example `1735689600000`.
- Unix seconds, for example `1735689600`; values below `10000000000` are treated as seconds and converted to milliseconds.
- ISO-8601 date/time strings, for example `2025-01-01T00:00:00Z`.

Use UTC timestamps. Candle timestamps are open times. If a JSON row includes `closeTime`, it must equal `timestamp + timeframe - 1ms`; otherwise AURION derives that close time automatically.

## Validation command

Validate one symbol directory with:

```bash
npm run validate:data -- --symbol BTCUSDT --data ./data/BTCUSDT
```

The command reports for `4H`, `1H`, and `15M`:

- candle count
- first timestamp
- last timestamp
- missing intervals
- duplicate timestamps
- invalid rows
- PASS/FAIL status

A real-data backtest refuses to run unless validation passes.

## Dataset manifest

Optionally add `manifest.json` beside the timeframe files so future users can audit the dataset origin. Recommended format:

```json
{
  "symbol": "BTCUSDT",
  "timeframes": ["4h", "1h", "15m"],
  "source": "Name of your licensed data source or internal export",
  "dateRange": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-12-31T23:59:59Z"
  },
  "timezone": "UTC",
  "generatedAt": "2026-08-13T00:00:00Z",
  "rowCounts": {
    "4h": 2190,
    "1h": 8760,
    "15m": 35040
  }
}
```

The manifest records metadata only; validation is based on the actual candle files.
