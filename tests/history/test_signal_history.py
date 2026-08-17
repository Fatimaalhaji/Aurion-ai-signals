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

SIGNAL = """
const base = (action, symbol, timestamp) => ({ symbol, rawSymbol: symbol.replace('/', ''), action, timestamp, confidence: 80, price: 100, reason: 'stored signal', mtf: { fourHour: { bias: 'BULLISH', rsi: 55 }, oneHour: { status: 'CONFIRMED', rsi: 56 }, fifteenMinute: { entry: action, rsi: 57 }, smc: { fifteenMinute: { bos: [], choch: [], liquidityLevels: [], liquiditySweeps: [], fairValueGaps: [], orderBlocks: [] } } }, structure: { bias: 'BULLISH', bos: [], choch: [] }, smcConfirmation: null });
"""

class SignalHistoryTest(unittest.TestCase):
    def test_signal_stored_correctly_and_empty_history(self):
        data = run_node(f"""
            import {{ createSignalHistory }} from '{ROOT / 'src/aurion/history/signalHistory.mjs'}';
            {SIGNAL}
            const history = createSignalHistory();
            const empty = history.all().length;
            history.add(base('LONG', 'BTC/USDT', 2));
            console.log(JSON.stringify({{ empty, stored: history.all()[0].symbol }}));
        """)
        self.assertEqual(data, {'empty': 0, 'stored': 'BTC/USDT'})

    def test_multiple_signals_chronological_ordering_and_filters(self):
        data = run_node(f"""
            import {{ createSignalHistory }} from '{ROOT / 'src/aurion/history/signalHistory.mjs'}';
            {SIGNAL}
            const history = createSignalHistory();
            history.addMany([base('LONG', 'BTC/USDT', 2), base('SHORT', 'ETH/USDT', 3), base('WAIT', 'SOL/USDT', 1)]);
            console.log(JSON.stringify({{
              newest: history.all().map((s) => s.timestamp),
              oldest: history.query({{ sort: 'oldest' }}).map((s) => s.timestamp),
              long: history.query({{ action: 'LONG' }}).length,
              short: history.query({{ action: 'SHORT' }}).length,
              wait: history.query({{ action: 'WAIT' }}).length,
              symbol: history.query({{ symbol: 'eth' }}).map((s) => s.symbol)
            }}));
        """)
        self.assertEqual(data['newest'], [3, 2, 1])
        self.assertEqual(data['oldest'], [1, 2, 3])
        self.assertEqual((data['long'], data['short'], data['wait']), (1, 1, 1))
        self.assertEqual(data['symbol'], ['ETH/USDT'])

    def test_malformed_records_are_isolated_from_generation_logic(self):
        data = run_node(f"""
            import {{ createSignalHistory }} from '{ROOT / 'src/aurion/history/signalHistory.mjs'}';
            import {{ loadGeneratedSignals }} from '{ROOT / 'src/aurion/signals/signalService.mjs'}';
            {SIGNAL}
            const history = createSignalHistory();
            const rejected = history.add({{ symbol: 'BAD', action: 'LONG' }});
            const generated = await loadGeneratedSignals({{ symbols: ['BTCUSDT'], store: false, generator: async () => base('LONG', 'BTC/USDT', 9) }});
            console.log(JSON.stringify({{ rejected, count: history.all().length, generated: generated.signals.length }}));
        """)
        self.assertIsNone(data['rejected'])
        self.assertEqual(data['count'], 0)
        self.assertEqual(data['generated'], 1)

    def test_detail_page_contains_required_rendering_hooks(self):
        html = (ROOT / 'history/index.html').read_text()
        self.assertIn('id="historyRows"', html)
        self.assertIn('View Details', (ROOT / 'src/history.js').read_text())
        self.assertIn('Liquidity Sweep', (ROOT / 'src/history.js').read_text())

if __name__ == '__main__':
    unittest.main()
