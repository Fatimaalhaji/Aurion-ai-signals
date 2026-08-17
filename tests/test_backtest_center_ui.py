import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class BacktestCenterUITests(unittest.TestCase):
    def text(self, path):
        return (ROOT / path).read_text()

    def test_route_and_controls_exist(self):
        html = self.text('backtest/index.html')
        for expected in ['AURION BACKTEST', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'Run Backtest']:
            self.assertIn(expected, html)
        self.assertIn('src/backtestCenter.js', html)

    def test_ui_reuses_domain_engine_and_does_not_embed_strategy_logic(self):
        js = self.text('src/backtestCenter.js')
        self.assertIn("import { runBacktest, DEFAULT_BACKTEST_OPTIONS } from './aurion/backtest/index.mjs';", js)
        forbidden = ['generateMTFSignal', 'detectBOS', 'CHOCH', 'calculateRSI', 'calculateEMA']
        for token in forbidden:
            self.assertNotIn(token, js)

    def test_required_states_and_validation_reasons_are_renderable(self):
        js = self.text('src/backtestCenter.js')
        for state in ['Idle', 'Validating data', 'Running backtest', 'Completed', 'No dataset', 'Invalid dataset', 'Insufficient history', 'Backtest error']:
            self.assertIn(state, js)
        for reason in ['Missing timeframe', 'Malformed candle', 'Duplicate timestamp', 'Invalid OHLCV', 'Missing interval', 'Incomplete candle data']:
            self.assertIn(reason, js)

    def test_result_sections_are_present(self):
        html = self.text('backtest/index.html')
        for expected in ['Long / Short Breakdown', 'Equity Curve', 'Signal Summary', 'Simulated Trades', 'Entry Time', 'SL_AMBIGUOUS']:
            self.assertIn(expected, html + self.text('src/backtestCenter.js'))

    def test_synthetic_sample_warning_is_prominent(self):
        self.assertIn('SYNTHETIC SAMPLE — NOT REAL MARKET DATA', self.text('backtest/index.html'))

    def test_existing_routes_remain(self):
        self.assertIn('data-page="dashboard"', self.text('index.html'))
        self.assertIn('data-page="signals"', self.text('signals/index.html'))

if __name__ == '__main__':
    unittest.main()
