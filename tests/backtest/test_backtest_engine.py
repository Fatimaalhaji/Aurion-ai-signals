import json, subprocess, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def run_node(source):
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as h:
        h.write(source); p=Path(h.name)
    try:
        r=subprocess.run(['node', str(p)], cwd=ROOT, capture_output=True, text=True)
        if r.returncode: raise AssertionError(r.stderr or r.stdout)
        return json.loads(r.stdout.strip().splitlines()[-1])
    finally: p.unlink(missing_ok=True)

GEN = """
function candles(tf, count, dir='up', start=Date.UTC(2025,0,1), step=.5) {
 const rows=[]; for (let i=0;i<count;i++){ const base=dir==='up'?100+i*step:300-i*step; const close=base+Math.sin(i/6); rows.push({time:start+i*tf, closeTime:start+(i+1)*tf-1, open:close-.2, high:close+1, low:close-1, close, volume:1000}); } return rows;
}
"""

class BacktestEngineTest(unittest.TestCase):
 def test_chronological_processing_no_lookahead_and_signal_generation(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  const r=await runBacktest({{fourHourCandles:candles(14400000,260), oneHourCandles:candles(3600000,1100), fifteenMinuteCandles:candles(900000,4400)}});
  console.log(JSON.stringify({{ordered:r.signals.every((s,i,a)=>i===0||a[i-1].timestamp<s.timestamp), first:r.signals[0].timestamp, start:r.period.start, signals:r.metrics.totalSignals, actions:[...new Set(r.signals.map(s=>s.action))]}}));""")
  self.assertTrue(d['ordered']); self.assertGreater(d['first'], d['start']); self.assertGreater(d['signals'], 0); self.assertIn('LONG', d['actions'])
 def test_long_tp_and_fees_slippage(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  const r=await runBacktest({{feeRate:.001, slippageRate:.001, stopLossPercent:.01, takeProfitPercent:.01, fourHourCandles:candles(14400000,260), oneHourCandles:candles(3600000,1100), fifteenMinuteCandles:candles(900000,4400)}});
  const t=r.trades[0]; console.log(JSON.stringify({{action:t.action,outcome:t.outcome,fees:t.fees>0,slip:t.entryPrice>r.signals.find(s=>s.timestamp===t.entryTime).entryPrice}}));""")
  self.assertEqual(d['action'],'LONG'); self.assertEqual(d['outcome'],'TP'); self.assertTrue(d['fees']); self.assertTrue(d['slip'])
 def test_short_tp(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  const r=await runBacktest({{stopLossPercent:.05,takeProfitPercent:.005,fourHourCandles:candles(14400000,260,'down',Date.UTC(2025,0,1),.05), oneHourCandles:candles(3600000,1100,'down',Date.UTC(2025,0,1),.05), fifteenMinuteCandles:candles(900000,4400,'down',Date.UTC(2025,0,1),.05)}});
  console.log(JSON.stringify({{action:r.trades[0]?.action,outcome:r.trades[0]?.outcome,shorts:r.metrics.shortPerformance.trades}}));""")
  self.assertEqual(d['action'],'SHORT'); self.assertEqual(d['outcome'],'TP'); self.assertGreater(d['shorts'],0)
 def test_sl_hit_same_candle_ambiguity_drawdown_consecutive(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  const f=candles(14400000,260), h=candles(3600000,1100), m=candles(900000,4400); const base=await runBacktest({{stopLossPercent:.01,takeProfitPercent:.01,fourHourCandles:f, oneHourCandles:h, fifteenMinuteCandles:m}}); const idx=m.findIndex(c=>c.time===base.trades[0].entryTime)+1; m[idx].low=0; m[idx].high=10000;
  const r=await runBacktest({{stopLossPercent:.01,takeProfitPercent:.01,fourHourCandles:f, oneHourCandles:h, fifteenMinuteCandles:m}});
  console.log(JSON.stringify({{outcome:r.trades[0].outcome, dd:r.metrics.maxDrawdown>0, cl:r.metrics.consecutiveLosses>=1}}));""")
  self.assertEqual(d['outcome'],'SL_AMBIGUOUS'); self.assertTrue(d['dd']); self.assertTrue(d['cl'])
 def test_wait_signals_no_trades(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  const r=await runBacktest({{fourHourCandles:candles(14400000,260,'up'), oneHourCandles:candles(3600000,1100,'down'), fifteenMinuteCandles:candles(900000,4400,'up')}});
  console.log(JSON.stringify({{signals:r.metrics.totalSignals,trades:r.metrics.totalTrades,onlyWait:r.signals.every(s=>s.action==='WAIT')}}));""")
  self.assertGreater(d['signals'],0); self.assertEqual(d['trades'],0); self.assertTrue(d['onlyWait'])
 def test_validation_errors(self):
  d=run_node(f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}'; {GEN}
  async function err(args){{try{{await runBacktest(args)}}catch(e){{return e.message}}}}
  const good={{fourHourCandles:candles(14400000,260), oneHourCandles:candles(3600000,1100), fifteenMinuteCandles:candles(900000,4400)}};
  console.log(JSON.stringify({{empty:await err({{}}), insufficient:await err({{...good,fourHourCandles:candles(14400000,10)}}), malformed:await err({{...good,fourHourCandles:[...good.fourHourCandles,{{time:999999999999,open:2,high:1,low:3,close:2,volume:1}}]}}), duplicate:await err({{...good,fourHourCandles:[good.fourHourCandles[0],good.fourHourCandles[0],...good.fourHourCandles.slice(2)]}}), conflicting:await err({{...good,strictSpacing:true,fourHourCandles:[...good.fourHourCandles.slice(0,10),...good.fourHourCandles.slice(11)]}})}}));""")
  for k in ['empty','insufficient','malformed','duplicate','conflicting']: self.assertTrue(d[k])

if __name__=='__main__': unittest.main()
