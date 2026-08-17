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
        result = subprocess.run(['node', str(path)], cwd=ROOT, check=False, capture_output=True, text=True)
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)
        return json.loads(result.stdout.strip().splitlines()[-1])
    finally:
        path.unlink(missing_ok=True)


class SignalsCenterUITest(unittest.TestCase):
    def test_renders_actions_confidence_timeframes_structure_and_smc(self):
        data = run_node(f"""
            import {{ renderSignalCards }} from '{ROOT / 'src/components/signals/center.mjs'}';
            const base = {{
              symbol: 'BTC/USDT', rawSymbol: 'BTCUSDT', price: 50000, confidence: 82, timestamp: Date.UTC(2026, 0, 1), reason: 'domain reason',
              fourHour: {{ bias: 'BULLISH', status: 'NEUTRAL' }}, oneHour: {{ bias: 'BULLISH', status: 'CONFIRMED' }},
              fifteenMinute: {{ bias: 'BULLISH', status: 'CONFIRMED', entry: 'LONG', ema50: 10, ema200: 9, emaSlope: 0.2, rsi: 60, momentum: 1.5 }},
              structure: {{ latestStructure: {{ type: 'BOS' }}, bias: 'BULLISH', bos: [{{ direction: 'BULLISH', level: 10 }}], choch: [{{ direction: 'BEARISH', level: 8 }}], confirmed: true }},
              smcConfirmation: {{ fifteenMinute: {{ bos: [{{ direction: 'BULLISH', level: 10 }}], choch: [{{ direction: 'BEARISH', level: 8 }}], liquidityLevels: [{{ price: 9 }}], liquiditySweeps: [{{ direction: 'BULLISH', level: 9 }}], fairValueGaps: [{{ direction: 'BULLISH', price: 11, mitigated: true }}], orderBlocks: [{{ direction: 'BULLISH', price: 7 }}] }} }}
            }};
            const html = renderSignalCards([base, {{ ...base, symbol: 'ETH/USDT', rawSymbol: 'ETHUSDT', action: 'SHORT' }}, {{ ...base, symbol: 'SOL/USDT', rawSymbol: 'SOLUSDT', action: 'WAIT' }}].map((item, index) => ({{ ...item, action: item.action ?? 'LONG', price: item.price + index }})));
            console.log(JSON.stringify({{
              hasLong: html.includes('LONG'), hasShort: html.includes('SHORT'), hasWait: html.includes('WAIT'),
              confidence: html.includes('82%'), timeframes: ['4H', '1H', '15M', 'FINAL SIGNAL'].every((text) => html.includes(text)),
              structure: html.includes('Canonical market structure') && html.includes('BOS events') && html.includes('CHoCH events'),
              smc: ['Liquidity sweep', 'FVG mitigation', 'Order block'].every((text) => html.includes(text)),
              indicators: ['EMA 50', 'EMA 200', 'RSI', 'Momentum'].every((text) => html.includes(text))
            }}));
        """)
        self.assertTrue(data['hasLong'])
        self.assertTrue(data['hasShort'])
        self.assertTrue(data['hasWait'])
        self.assertTrue(data['confidence'])
        self.assertTrue(data['timeframes'])
        self.assertTrue(data['structure'])
        self.assertTrue(data['smc'])
        self.assertTrue(data['indicators'])

    def test_filters_and_empty_state(self):
        data = run_node(f"""
            import {{ filterSignals, renderSignalCards }} from '{ROOT / 'src/components/signals/center.mjs'}';
            const signals = [{{ symbol: 'BTC/USDT', rawSymbol: 'BTCUSDT', action: 'LONG' }}, {{ symbol: 'ETH/USDT', rawSymbol: 'ETHUSDT', action: 'SHORT' }}, {{ symbol: 'SOL/USDT', rawSymbol: 'SOLUSDT', action: 'WAIT' }}];
            console.log(JSON.stringify({{
              longCount: filterSignals(signals, 'LONG').length,
              shortCount: filterSignals(signals, 'SHORT').length,
              waitCount: filterSignals(signals, 'WAIT').length,
              symbolCount: filterSignals(signals, 'ALL', 'eth').length,
              empty: renderSignalCards([]).includes('No signals match')
            }}));
        """)
        self.assertEqual(data, {'longCount': 1, 'shortCount': 1, 'waitCount': 1, 'symbolCount': 1, 'empty': True})

    def test_loading_and_error_states_exist_in_entrypoint(self):
        source = (ROOT / 'src/main.js').read_text()
        self.assertIn('renderSkeletons', source)
        self.assertIn('Network failure or market-data unavailable', source)
        self.assertIn('No signals available.', source)


if __name__ == '__main__':
    unittest.main()
