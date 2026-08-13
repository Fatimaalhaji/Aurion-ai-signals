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

CANDLES = """
[
 {time:0,open:100,high:103,low:99,close:101,volume:1},
 {time:1,open:101,high:106,low:100,close:105,volume:1},
 {time:2,open:105,high:111,low:104,close:110,volume:1},
 {time:3,open:110,high:111,low:101,close:102,volume:1},
 {time:4,open:102,high:104,low:94,close:96,volume:1},
 {time:5,open:96,high:103,low:95,close:101,volume:1},
 {time:6,open:101,high:113,low:100,close:111,volume:1},
 {time:7,open:111,high:112,low:102,close:103,volume:1},
 {time:8,open:103,high:105,low:95,close:97,volume:1},
 {time:9,open:97,high:107,low:96,close:106,volume:1},
 {time:10,open:106,high:116,low:105,close:114,volume:1},
 {time:11,open:114,high:115,low:107,close:108,volume:1},
 {time:12,open:108,high:110,low:93,close:94,volume:1},
 {time:13,open:94,high:100,low:92,close:98,volume:1},
 {time:15,open:90,high:91,low:88,close:89,volume:1},
 {time:14,open:98,high:99,low:89,close:90,volume:1}
]
"""

class SMCEngineTest(unittest.TestCase):
    def test_swing_bos_and_choch_are_confirmed_without_lookahead(self):
        data = run_node(f"""
            import {{ findConfirmedSwings, detectBOS, detectCHoCH }} from '{ROOT / 'src/aurion/smc/index.mjs'}';
            const candles = {CANDLES};
            const swings = findConfirmedSwings(candles, {{ pivotSpan: 1 }});
            const bos = detectBOS(candles, swings, {{ pivotSpan: 1 }});
            const choch = detectCHoCH(candles, swings, bos, {{ pivotSpan: 1 }});
            console.log(JSON.stringify({{ swings, bos, choch }}));
        """)
        self.assertTrue(all(s['confirmedIndex'] > s['index'] for s in data['swings']))
        self.assertIn('BULLISH', [e['direction'] for e in data['bos']])
        self.assertIn('BEARISH', [e['direction'] for e in data['choch']])

    def test_liquidity_sweeps_fvgs_mitigation_and_order_blocks(self):
        data = run_node(f"""
            import {{ findLiquidityLevels, detectLiquiditySweeps, findFairValueGaps, detectFVGMitigations, findOrderBlocks, analyzeSMC }} from '{ROOT / 'src/aurion/smc/index.mjs'}';
            const candles = {CANDLES};
            const options = {{ pivotSpan: 1, equalTolerancePercent: 2 }};
            const levels = findLiquidityLevels(candles, options);
            const sweeps = detectLiquiditySweeps(candles, levels, options);
            const fvgs = detectFVGMitigations(candles, findFairValueGaps(candles, options), options);
            const smc = analyzeSMC(candles, options);
            console.log(JSON.stringify({{ levels: levels.length, sweeps: sweeps.length, fvgs: fvgs.length, mitigated: fvgs.filter(f => f.mitigated).length, orderBlocks: findOrderBlocks(candles, smc.bos, options).length, bias: smc.bias }}));
        """)
        self.assertGreaterEqual(data['levels'], 1)
        self.assertGreaterEqual(data['sweeps'], 1)
        self.assertGreaterEqual(data['fvgs'], 1)
        self.assertGreaterEqual(data['mitigated'], 1)
        self.assertGreaterEqual(data['orderBlocks'], 1)
        self.assertIn(data['bias'], ['BULLISH', 'BEARISH'])

    def test_mtf_smc_is_nested_and_does_not_replace_mtf_action(self):
        data = run_node(f"""
            import {{ analyzeMTF }} from '{ROOT / 'src/aurion/mtf/analyzer.mjs'}';
            const candles = {CANDLES};
            const result = analyzeMTF(candles, candles, candles);
            console.log(JSON.stringify({{ hasSmc: Boolean(result.smc.fourHour), hasMtf: Boolean(result.fourHour && result.oneHour && result.fifteenMinute), action: result.action }}));
        """)
        self.assertTrue(data['hasSmc'])
        self.assertTrue(data['hasMtf'])
        self.assertIn(data['action'], ['LONG', 'SHORT', 'WAIT'])

if __name__ == '__main__':
    unittest.main()
