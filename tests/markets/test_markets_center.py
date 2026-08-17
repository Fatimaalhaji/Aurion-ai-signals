import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def run_node(source: str):
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as handle:
        handle.write(source)
        path = Path(handle.name)
    try:
        result = subprocess.run(['node', str(path)], cwd=ROOT, capture_output=True, text=True)
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)
        return json.loads(result.stdout.strip().splitlines()[-1])
    finally:
        path.unlink(missing_ok=True)

SIGNAL_JS = """
const baseFrame = { timeframe: '15M', bias: 'BULLISH', status: 'CONFIRMED', entry: 'LONG', ema50: 101, ema200: 99, emaSlope: 0.12, rsi: 58, momentum: 1.5, structure: 'BULLISH' };
const smc = { bias: 'BULLISH', confirmed: true, latestStructure: { type: 'BOS' }, swings: [{ type: 'HIGH' }, { type: 'LOW' }], bos: [{ direction: 'BULLISH', level: 100 }], choch: [{ direction: 'BEARISH', previousBias: 'BULLISH' }], liquidityLevels: [{ price: 100 }], liquiditySweeps: [{ type: 'LIQUIDITY_SWEEP' }], fairValueGaps: [{ mitigated: true }], orderBlocks: [{ type: 'ORDER_BLOCK' }] };
const signal = (rawSymbol, action) => ({ symbol: rawSymbol.replace('USDT', '/USDT'), rawSymbol, price: 100, change24h: 1.2, volume: 1000000, action, confidence: action === 'WAIT' ? 35 : 80, reason: '4H bullish + 1H confirmed + 15M setup', explanation: 'reason', fourHour: { ...baseFrame, timeframe: '4H', entry: undefined }, oneHour: { ...baseFrame, timeframe: '1H', entry: undefined }, fifteenMinute: baseFrame, mtf: { fourHour: { ...baseFrame, timeframe: '4H', entry: undefined }, oneHour: { ...baseFrame, timeframe: '1H', entry: undefined }, fifteenMinute: baseFrame, smc: { fifteenMinute: smc } }, smcConfirmation: { fifteenMinute: smc } });
"""

class MarketsCenterTest(unittest.TestCase):
    def test_symbol_configuration_and_unsupported_symbol(self):
        data = run_node(f"""import {{ SUPPORTED_SYMBOLS }} from '{ROOT/'src/aurion/config/index.mjs'}'; import {{ isSupportedSymbol }} from '{ROOT/'src/markets/markets.mjs'}'; console.log(JSON.stringify({{ symbols: SUPPORTED_SYMBOLS, unsupported: isSupportedSymbol('ADAUSDT') }}));""")
        self.assertEqual(data['symbols'], ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'])
        self.assertFalse(data['unsupported'])

    def test_market_list_price_and_actions_render(self):
        data = run_node(f"""import {{ renderMarketOverview }} from '{ROOT/'src/markets/markets.mjs'}'; {SIGNAL_JS} const html = renderMarketOverview([signal('BTCUSDT','LONG'), signal('ETHUSDT','SHORT'), signal('SOLUSDT','WAIT')]); console.log(JSON.stringify({{ hasPrice: html.includes('$100.0000') || html.includes('$100'), long: html.includes('LONG'), short: html.includes('SHORT'), wait: html.includes('WAIT') }}));""")
        self.assertTrue(data['hasPrice']); self.assertTrue(data['long']); self.assertTrue(data['short']); self.assertTrue(data['wait'])

    def test_mtf_structure_bos_choch_and_smc_display(self):
        data = run_node(f"""import {{ renderMarketDetail }} from '{ROOT/'src/markets/markets.mjs'}'; {SIGNAL_JS} const html = renderMarketDetail(signal('BTCUSDT','LONG')); console.log(JSON.stringify({{ mtf: html.includes('4H Primary market regime') && html.includes('1H Setup confirmation') && html.includes('15M Entry condition'), structure: html.includes('Canonical structure engine'), bos: html.includes('Recent BOS events') && html.includes('BOS</h4>'), choch: html.includes('Recent CHoCH events') && html.includes('CHoCH</h4>'), smc: html.includes('Liquidity levels') && html.includes('Fair Value Gaps') && html.includes('Order blocks'), indicators: html.includes('EMA50') && html.includes('RSI') && html.includes('Momentum') }}));""")
        self.assertTrue(all(data.values()))

    def test_filtering_loading_empty_and_error_states(self):
        data = run_node(f"""import {{ filterMarkets, marketStatus, renderMarketOverview }} from '{ROOT/'src/markets/markets.mjs'}'; {SIGNAL_JS} const signals = [signal('BTCUSDT','LONG'), signal('ETHUSDT','SHORT'), signal('SOLUSDT','WAIT')]; console.log(JSON.stringify({{ longOnly: filterMarkets(signals, '', 'LONG').length, search: filterMarkets(signals, 'eth', 'ALL')[0].rawSymbol, empty: renderMarketOverview([]).includes('Empty market list'), binance: marketStatus(new Error('Binance unavailable')).includes('Binance'), network: marketStatus(new Error('fetch failed')).includes('Network'), unsupported: marketStatus(new Error('Unsupported symbol')).includes('Unsupported') }}));""")
        self.assertEqual(data['longOnly'], 1); self.assertEqual(data['search'], 'ETHUSDT')
        self.assertTrue(data['empty']); self.assertTrue(data['binance']); self.assertTrue(data['network']); self.assertTrue(data['unsupported'])

if __name__ == '__main__':
    unittest.main()
