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

class CandleDataLayerTest(unittest.TestCase):
    def test_normalization_sorts_and_excludes_open_candles(self):
        data = run_node(f"""
            import {{ prepareCandles }} from '{ROOT / 'src/aurion/data/candles.mjs'}';
            const rows = [[3000,3,4,2,3.5,30,9999],[1000,1,2,0.5,1.5,10,1500],[2000,2,3,1,2.5,20,3000]];
            console.log(JSON.stringify(prepareCandles(rows, {{ now: 4000 }}).map((c) => c.time)));
        """)
        self.assertEqual(data, [1000, 2000])

    def test_malformed_ohlc_is_rejected(self):
        data = run_node(f"""
            import {{ normalizeCandle }} from '{ROOT / 'src/aurion/data/candles.mjs'}';
            try {{ normalizeCandle({{ time: 1, open: 10, high: 9, low: 8, close: 10, volume: 1 }}); }}
            catch (error) {{ console.log(JSON.stringify({{ code: error.code, message: error.message }})); }}
        """)
        self.assertEqual(data['code'], 'INVALID_CANDLE')
        self.assertIn('Malformed candle', data['message'])

if __name__ == '__main__':
    unittest.main()
