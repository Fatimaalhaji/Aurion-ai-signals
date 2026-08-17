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


STRUCTURE_CANDLES = """
[
 {time:0,open:100,high:103,low:99,close:101,volume:1},
 {time:1,open:101,high:106,low:100,close:105,volume:1},
 {time:2,open:105,high:111,low:104,close:110,volume:1},
 {time:3,open:110,high:111,low:101,close:102,volume:1},
 {time:4,open:102,high:104,low:94,close:96,volume:1},
 {time:5,open:96,high:103,low:95,close:101,volume:1},
 {time:6,open:101,high:113,low:100,close:112,volume:1},
 {time:7,open:112,high:114,low:102,close:103,volume:1},
 {time:8,open:103,high:105,low:95,close:97,volume:1},
 {time:9,open:97,high:107,low:96,close:106,volume:1},
 {time:10,open:106,high:116,low:105,close:115,volume:1},
 {time:11,open:115,high:115,low:107,close:108,volume:1},
 {time:12,open:108,high:110,low:93,close:94,volume:1},
 {time:13,open:94,high:100,low:92,close:98,volume:1},
 {time:14,open:98,high:99,low:89,close:90,volume:1}
]
"""


class StructureEngineTest(unittest.TestCase):
    def test_detects_bullish_bos_from_confirmed_swing_high(self):
        data = run_node(f"""
            import {{ analyzeMarketStructure }} from '{ROOT / 'src/aurion/structure/index.mjs'}';
            const result = analyzeMarketStructure({STRUCTURE_CANDLES}, {{ pivotSpan: 1 }});
            console.log(JSON.stringify(result));
        """)
        bullish = [event for event in data['bos'] if event['direction'] == 'BULLISH']
        self.assertEqual(len(bullish), 1)
        self.assertEqual(bullish[0]['index'], 10)
        self.assertEqual(bullish[0]['level'], 114)

    def test_detects_bearish_bos_from_confirmed_swing_low(self):
        data = run_node(f"""
            import {{ detectBOS }} from '{ROOT / 'src/aurion/structure/index.mjs'}';
            const bos = detectBOS({STRUCTURE_CANDLES}, undefined, {{ pivotSpan: 1 }});
            console.log(JSON.stringify(bos));
        """)
        bearish = [event for event in data if event['direction'] == 'BEARISH']
        self.assertEqual(len(bearish), 1)
        self.assertEqual(bearish[0]['index'], 12)
        self.assertEqual(bearish[0]['level'], 95)

    def test_detects_choch_and_includes_structure_in_analysis(self):
        data = run_node(f"""
            import {{ analyzeMarketStructure }} from '{ROOT / 'src/aurion/structure/index.mjs'}';
            const result = analyzeMarketStructure({STRUCTURE_CANDLES}, {{ pivotSpan: 1 }});
            console.log(JSON.stringify({{ choch: result.choch, bias: result.bias, latestStructure: result.latestStructure, confirmed: result.confirmed }}));
        """)
        self.assertEqual(len(data['choch']), 1)
        self.assertEqual(data['choch'][0]['direction'], 'BEARISH')
        self.assertEqual(data['choch'][0]['previousBias'], 'BULLISH')
        self.assertEqual(data['bias'], 'BEARISH')
        self.assertTrue(data['confirmed'])
        self.assertEqual(data['latestStructure']['type'], 'CHoCH')


if __name__ == '__main__':
    unittest.main()
