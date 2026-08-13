import json
import subprocess
import tempfile
import textwrap
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

def candle_js(direction: str) -> str:
    return textwrap.dedent(f"""
    (() => {{
      const rows = [];
      for (let i = 0; i < 240; i += 1) {{
        const trend = '{direction}' === 'up' ? i * 1.2 : (240 - i) * 1.2;
        const close = trend + Math.sin(i / 5) * 0.8 + 100;
        rows.push({{ time: i, open: close - 0.3, high: close + 1, low: close - 1, close, volume: 1000 }});
      }}
      return rows;
    }})()
    """).strip()

class SignalEngineTest(unittest.TestCase):
    def test_generate_signal_uses_domain_provider(self):
        data = run_node(f"""
            import {{ generateSignal }} from '{ROOT / 'src/aurion/signals/engine.mjs'}';
            const provider = {{
              getTicker: async () => ({{ lastPrice: '100', priceChangePercent: '1.5', quoteVolume: '1000000' }}),
              getCandles: async (_symbol, timeframe) => timeframe === '4h' ? {candle_js('up')} : {candle_js('up')}
            }};
            const signal = await generateSignal('BTCUSDT', {{ marketDataProvider: provider }});
            console.log(JSON.stringify({{ action: signal.action, confidence: signal.confidence, reason: signal.reason, timeframe: signal.timeframe, hasMtf: Boolean(signal.mtf.fourHour && signal.mtf.oneHour && signal.mtf.fifteenMinute) }}));
        """)
        self.assertEqual(data['action'], 'LONG')
        self.assertGreaterEqual(data['confidence'], 75)
        self.assertEqual(data['timeframe'], '15m')
        self.assertTrue(data['hasMtf'])

if __name__ == '__main__':
    unittest.main()
