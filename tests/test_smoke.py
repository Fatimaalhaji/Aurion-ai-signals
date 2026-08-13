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
        self.assertGreaterEqual(data["confidence"], 80)

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


if __name__ == "__main__":
    unittest.main()
