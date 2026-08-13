"""Smoke and signal-engine tests for Aurion AI Signals."""

import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_OUTPUT = "aurion-ai-signals: ok"


def run_node(source: str) -> dict:
    """Run an ES module snippet and parse the final JSON line."""
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as handle:
        handle.write(source)
        path = Path(handle.name)
    try:
        result = subprocess.run(
            ["node", str(path)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)
        return json.loads(result.stdout.strip().splitlines()[-1])
    finally:
        path.unlink(missing_ok=True)


def candle_js(direction: str) -> str:
    """Return JavaScript that creates deterministic candles."""
    return textwrap.dedent(
        f"""
        (() => {{
        function candles(direction, count = 240) {{
          const rows = [];
          for (let i = 0; i < count; i += 1) {{
            const trend = direction === 'up' ? i * 1.2 : direction === 'down' ? (count - i) * 1.2 : 120;
            const wave = direction === 'flat' ? 0 : Math.sin(i / 5) * 0.8;
            const close = trend + wave + 100;
            rows.push({{ open: close - 0.3, high: close + 1, low: close - 1, close, volume: 1000 }});
          }}
          return rows;
        }}
        return candles('{direction}');
        }})
        """
    ).strip() + "()"


class ApplicationSmokeTest(unittest.TestCase):
    """Smoke tests for the application entry point."""

    def test_application_entry_point_outputs_health_text(self) -> None:
        """The entry point exits successfully and prints the health text."""
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT / "src")

        result = subprocess.run(
            [sys.executable, "-m", "aurion_ai_signals"],
            cwd=ROOT,
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), EXPECTED_OUTPUT)
        self.assertEqual(result.stderr, "")


class MTFEngineTest(unittest.TestCase):
    """Tests for multi-timeframe signal decisions."""

    def test_bullish_alignment_generates_long(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles, calculateMTFConfidence }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('up')});
            const oneHour = analyze1HCandles({candle_js('up')}, fourHour.bias);
            const fifteenMinute = analyze15MCandles({candle_js('up')}, fourHour.bias);
            console.log(JSON.stringify({{ bias: fourHour.bias, one: oneHour.status, entry: fifteenMinute.entry, confidence: calculateMTFConfidence(fourHour, oneHour, fifteenMinute) }}));
        """)
        self.assertEqual(data["bias"], "BULLISH")
        self.assertEqual(data["one"], "CONFIRMED")
        self.assertEqual(data["entry"], "LONG")
        self.assertGreaterEqual(data["confidence"], 75)

    def test_bearish_alignment_generates_short(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('down')});
            const oneHour = analyze1HCandles({candle_js('down')}, fourHour.bias);
            const fifteenMinute = analyze15MCandles({candle_js('down')}, fourHour.bias);
            console.log(JSON.stringify({{ bias: fourHour.bias, one: oneHour.status, entry: fifteenMinute.entry }}));
        """)
        self.assertEqual(data, {"bias": "BEARISH", "one": "CONFIRMED", "entry": "SHORT"})

    def test_conflicting_timeframes_wait(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('up')});
            const oneHour = analyze1HCandles({candle_js('down')}, fourHour.bias);
            const fifteenMinute = analyze15MCandles({candle_js('up')}, fourHour.bias);
            const action = fourHour.bias === 'BULLISH' && oneHour.status === 'CONFIRMED' && fifteenMinute.entry === 'LONG' ? 'LONG' : 'WAIT';
            console.log(JSON.stringify({{ one: oneHour.status, action }}));
        """)
        self.assertEqual(data["one"], "CONFLICT")
        self.assertEqual(data["action"], "WAIT")

    def test_neutral_regime_waits(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('flat')});
            const oneHour = analyze1HCandles({candle_js('up')}, fourHour.bias);
            console.log(JSON.stringify({{ bias: fourHour.bias, one: oneHour.status }}));
        """)
        self.assertEqual(data["bias"], "NEUTRAL")
        self.assertEqual(data["one"], "NEUTRAL")

    def test_confidence_drops_on_conflict(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles, calculateMTFConfidence }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('up')});
            const confirmed = calculateMTFConfidence(fourHour, analyze1HCandles({candle_js('up')}, fourHour.bias), analyze15MCandles({candle_js('up')}, fourHour.bias));
            const conflicted = calculateMTFConfidence(fourHour, analyze1HCandles({candle_js('down')}, fourHour.bias), analyze15MCandles({candle_js('down')}, fourHour.bias));
            console.log(JSON.stringify({{ confirmed, conflicted }}));
        """)
        self.assertGreater(data["confirmed"], data["conflicted"])


class MTFEngineAuditTest(unittest.TestCase):
    """Regression tests for audited MTF engine edge cases."""

    def test_prepare_candles_sorts_and_drops_open_candle(self) -> None:
        data = run_node(f"""
            import {{ prepareCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const rows = [
              [2000, '2', '3', '1', '2.5', '20', 3000],
              [1000, '1', '2', '0.5', '1.5', '10', 1500],
              [3000, '3', '4', '2', '3.5', '30', 9999]
            ];
            console.log(JSON.stringify(prepareCandles(rows, {{ now: 4000 }}).map((c) => c.time)));
        """)
        self.assertEqual(data, [1000, 2000])

    def test_malformed_candle_rejected(self) -> None:
        data = run_node(f"""
            import {{ normalizeCandle }} from '{ROOT / 'src/mtfEngine.mjs'}';
            try {{ normalizeCandle([1, 'bad', 2, 1, 1.5, 10]); }} catch (error) {{ console.log(JSON.stringify({{ ok: true, message: error.message }})); }}
        """)
        self.assertTrue(data["ok"])
        self.assertIn("Malformed candle", data["message"])

    def test_insufficient_candles_are_neutral(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const rows = Array.from({{ length: 199 }}, (_, i) => ({{ time: i, open: 1 + i, high: 2 + i, low: 0.5 + i, close: 1 + i, volume: 10 }}));
            console.log(JSON.stringify(analyze4HCandles(rows)));
        """)
        self.assertEqual(data["bias"], "NEUTRAL")
        self.assertEqual(data["confidence"], 0)

    def test_standard_ema_seed_uses_sma_after_period(self) -> None:
        data = run_node(f"""
            import {{ ema }} from '{ROOT / 'src/mtfEngine.mjs'}';
            console.log(JSON.stringify(ema([1, 2, 3, 4, 5], 3)));
        """)
        self.assertEqual(data[:2], [None, None])
        self.assertAlmostEqual(data[2], 2)
        self.assertAlmostEqual(data[3], 3)
        self.assertAlmostEqual(data[4], 4)

    def test_rsi_extremes_and_flat_market(self) -> None:
        data = run_node(f"""
            import {{ calculateRsi }} from '{ROOT / 'src/mtfEngine.mjs'}';
            console.log(JSON.stringify({{
              up: calculateRsi(Array.from({{ length: 30 }}, (_, i) => i + 1)),
              down: calculateRsi(Array.from({{ length: 30 }}, (_, i) => 30 - i)),
              flat: calculateRsi(Array.from({{ length: 30 }}, () => 100))
            }}));
        """)
        self.assertEqual(data, {"up": 100, "down": 0, "flat": 50})

    def test_conflicts_cap_confidence_and_wait_score(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles, calculateMTFConfidence, decideMTFAction }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('up')});
            const bearishOne = analyze1HCandles({candle_js('down')}, fourHour.bias);
            const bullish15 = analyze15MCandles({candle_js('up')}, fourHour.bias);
            const action = decideMTFAction(fourHour, bearishOne, bullish15);
            console.log(JSON.stringify({{ action, confidence: calculateMTFConfidence(fourHour, bearishOne, bullish15), one: bearishOne.status }}));
        """)
        self.assertEqual(data["one"], "CONFLICT")
        self.assertEqual(data["action"], "WAIT")
        self.assertLessEqual(data["confidence"], 45)

    def test_neutral_4h_blocks_lower_timeframe_override(self) -> None:
        data = run_node(f"""
            import {{ analyze4HCandles, analyze1HCandles, analyze15MCandles, decideMTFAction, calculateMTFConfidence }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fourHour = analyze4HCandles({candle_js('flat')});
            const oneHour = analyze1HCandles({candle_js('up')}, fourHour.bias);
            const fifteenMinute = analyze15MCandles({candle_js('up')}, fourHour.bias);
            console.log(JSON.stringify({{ action: decideMTFAction(fourHour, oneHour, fifteenMinute), confidence: calculateMTFConfidence(fourHour, oneHour, fifteenMinute) }}));
        """)
        self.assertEqual(data, {"action": "WAIT", "confidence": 0})

    def test_missing_binance_data_rejected(self) -> None:
        data = run_node(f"""
            import {{ getCandles }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const fetcher = async () => ({{ ok: true, json: async () => ({{ bad: true }}) }});
            try {{ await getCandles('BTCUSDT', '15m', {{ fetcher, cache: new Map() }}); }} catch (error) {{ console.log(JSON.stringify({{ message: error.message }})); }}
        """)
        self.assertIn("malformed", data["message"])

    def test_insufficient_swing_points_are_neutral(self) -> None:
        data = run_node(f"""
            import {{ structureBias }} from '{ROOT / 'src/mtfEngine.mjs'}';
            const rows = Array.from({{ length: 30 }}, (_, i) => ({{ high: i + 10, low: i + 9 }}));
            console.log(JSON.stringify({{ structure: structureBias(rows) }}));
        """)
        self.assertEqual(data["structure"], "NEUTRAL")

if __name__ == "__main__":
    unittest.main()
