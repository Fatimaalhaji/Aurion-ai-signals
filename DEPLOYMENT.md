# AURION Production Web Deployment

This project is a static browser dashboard that serves `index.html`, `src/styles.css`, and native ES modules from `src/`. The production deployment keeps the existing dashboard, MTF analysis, deterministic SMC layer, signal engine, and historical backtesting scripts unchanged.

## Production build

Use the repository root as the Vercel project root.

- Framework preset: `Other`
- Install command: none required unless your Vercel project enforces one
- Build command: `npm run build`
- Output directory: `.`

The build command performs syntax validation for all JavaScript and MJS modules. There is no bundling step and no generated `dist/` directory.

## Runtime architecture

The deployed dashboard runs completely in the browser and requests public Binance market-data endpoints directly through `src/services/binance/client.mjs`. It does not provide live trading, real-money order execution, account access, or authenticated exchange operations.

The historical backtesting and dataset validation workflows are command-line tools for local or CI use. They are not exposed as production web endpoints.

## Environment variables

No production environment variables are required for the current application.

Do **not** configure or expose private exchange credentials such as API keys, API secrets, account identifiers, wallet keys, or order-execution tokens. The current dashboard only uses unauthenticated public Binance market-data endpoints configured in application source.

If future server-side functionality is added, any secret must be stored only as a server-side Vercel Environment Variable and must not use a browser-exposed prefix such as `VITE_`, `NEXT_PUBLIC_`, or similar.

## Vercel configuration

`vercel.json` pins the static deployment behavior for this repository:

- Runs `npm run build` before deployment.
- Serves the repository root as the static output directory.
- Enables clean URLs while preserving the root dashboard route.
- Adds basic security headers.
- Disables caching for `index.html` so the dashboard shell updates promptly after deployments.

## Required verification commands

Run these commands before promoting a deployment:

```bash
npm test
npm run build
npm run backtest:sample
npm run validate:data -- --symbol BTCUSDT --data ./data/BTCUSDT
```

If `./data/BTCUSDT` is absent, dataset validation is expected to fail because the repository does not include licensed historical BTCUSDT data. Do not fabricate historical data to make validation pass.

## Deployment verification checklist

After deployment, verify all of the following before claiming production success:

1. Vercel deployment completed successfully and produced a deployment URL.
2. The homepage loads from the deployment URL.
3. The dashboard renders the hero, market pulse panel, and signal board.
4. Browser console has no deployment-caused JavaScript errors.
5. Public Binance candle and ticker requests either succeed or show the existing graceful dashboard error state if Binance blocks or rate-limits the deployment environment.
6. No private API key or secret appears in browser JavaScript, network requests, page source, or Vercel client-side environment variables.
