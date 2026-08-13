import json, subprocess, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def run_node(source, ok=True):
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as h:
        h.write(source); p=Path(h.name)
    try:
        r=subprocess.run(['node', str(p)], cwd=ROOT, capture_output=True, text=True)
        if ok and r.returncode: raise AssertionError(r.stderr or r.stdout)
        return r
    finally: p.unlink(missing_ok=True)

class HistoricalDataTest(unittest.TestCase):
 def test_csv_json_validation_date_filter_and_alignment(self):
  js=f"""import {{parseHistoricalCsv, parseHistoricalJson, validateHistoricalRows}} from '{ROOT/'src/aurion/backtest/historicalData.mjs'}';
  const csv='timestamp,open,high,low,close,volume\\n2025-01-01T00:00:00Z,1,2,1,1.5,10\\n2025-01-01T00:15:00Z,1.5,2,1,1.7,11';
  const j='{{"candles":[{{"timestamp":"2025-01-01T00:00:00Z","open":1,"high":2,"low":1,"close":1.5,"volume":10}},{{"timestamp":"2025-01-01T00:15:00Z","open":1,"high":2,"low":1,"close":1.6,"volume":10}}]}}';
  const a=validateHistoricalRows(parseHistoricalCsv(csv),'15m','csv');
  const b=validateHistoricalRows(parseHistoricalJson(j),'15m','json',{{from:Date.UTC(2025,0,1,0,15),to:Date.UTC(2025,0,1,0,30)}});
  console.log(JSON.stringify({{csv:a.candles.length,json:b.candles.length,skipped:b.skipped,time:a.candles[1].time-a.candles[0].time}}));"""
  d=json.loads(run_node(js).stdout.strip())
  self.assertEqual(d, {'csv':2,'json':1,'skipped':1,'time':900000})
 def test_malformed_duplicate_missing_candles_rejected(self):
  js=f"""import {{validateHistoricalRows}} from '{ROOT/'src/aurion/backtest/historicalData.mjs'}';
  const good=[{{timestamp:1,open:1,high:2,low:1,close:1,volume:1}},{{timestamp:901,open:1,high:2,low:1,close:1,volume:1}}];
  async function err(rows){{try{{validateHistoricalRows(rows,'15m','x')}}catch(e){{return e.message}}}}
  console.log(JSON.stringify({{bad:await err([{{timestamp:1,open:'x',high:2,low:1,close:1,volume:1}}]), dup:await err([good[0],good[0]]), missing:await err([good[0],{{...good[1],timestamp:1801}}])}}));"""
  d=json.loads(run_node(js).stdout.strip())
  self.assertIn('malformed', d['bad']); self.assertIn('duplicate', d['dup']); self.assertIn('missing candles', d['missing'])
 def test_cli_real_args_multiple_symbol_fee_slippage_and_missing_dataset(self):
  with tempfile.TemporaryDirectory() as td:
   base=Path(td); start=1735689600000
   for tf,step,count in [('15m',900000,220),('1h',3600000,220),('4h',14400000,240)]:
    rows=['timestamp,open,high,low,close,volume']
    for i in range(count): rows.append(f"{start+i*step},100,101,99,100.5,10")
    (base/f'{tf}.csv').write_text('\n'.join(rows))
   r=subprocess.run(['node','scripts/backtest.mjs','--symbol','ETHUSDT','--data',td,'--from','2025-01-01','--to','2025-02-15','--fee','0.002','--slippage','0.001'],cwd=ROOT,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr); self.assertIn('Symbol: ETHUSDT',r.stdout); self.assertIn('Fees: 0.002',r.stdout); self.assertIn('Slippage: 0.001',r.stdout)
   missing=subprocess.run(['node','scripts/backtest.mjs','--symbol','SOLUSDT','--data',str(base/'missing')],cwd=ROOT,capture_output=True,text=True)
   self.assertNotEqual(missing.returncode,0); self.assertIn('Missing 4h dataset',missing.stderr)
 def test_one_open_position_ignored_signals_and_sample_label(self):
  js=f"""import {{runBacktest}} from '{ROOT/'src/aurion/backtest/index.mjs'}';
  function c(tf,n){{let s=Date.UTC(2025,0,1);return Array.from({{length:n}},(_,i)=>{{let close=100+i*.5;return {{time:s+i*tf,closeTime:s+(i+1)*tf-1,open:close-.2,high:close+1,low:close-1,close,volume:1000}}}})}}
  const r=await runBacktest({{takeProfitPercent:.5,stopLossPercent:.5,fourHourCandles:c(14400000,260),oneHourCandles:c(3600000,1100),fifteenMinuteCandles:c(900000,4400)}});
  console.log(JSON.stringify({{trades:r.trades.length,ignored:r.ignoredSignals.length,metric:r.metrics.ignoredSignals,reason:r.ignoredSignals[0]?.ignoredReason}}));"""
  d=json.loads(run_node(js).stdout.strip())
  self.assertGreater(d['ignored'],0); self.assertEqual(d['ignored'],d['metric']); self.assertEqual(d['reason'],'SIGNAL_IGNORED_OPEN_POSITION')
  sample=subprocess.run(['npm','run','backtest:sample'],cwd=ROOT,capture_output=True,text=True)
  self.assertEqual(sample.returncode,0,sample.stderr); self.assertIn('SYNTHETIC TEST DATA — NOT REAL MARKET PERFORMANCE',sample.stdout)

class DatasetValidationWorkflowTest(unittest.TestCase):
 def write_dataset(self, base, broken=False):
  start=1735689600000
  for tf,step,count in [('15m',900000,4),('1h',3600000,4),('4h',14400000,4)]:
   rows=['timestamp,open,high,low,close,volume']
   for i in range(count):
    ts=start+i*step
    if broken and tf=='1h' and i==2: ts=start+(i+1)*step
    rows.append(f"{ts},100,101,99,100.5,10")
   (base/f'{tf}.csv').write_text('\n'.join(rows))

 def test_validate_data_cli_pass_and_fail(self):
  with tempfile.TemporaryDirectory() as td:
   base=Path(td); self.write_dataset(base)
   r=subprocess.run(['npm','run','validate:data','--','--symbol','BTCUSDT','--data',td],cwd=ROOT,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr); self.assertIn('Status: PASS',r.stdout); self.assertIn('4H:',r.stdout); self.assertIn('missing intervals: 0',r.stdout)
  with tempfile.TemporaryDirectory() as td:
   base=Path(td); self.write_dataset(base, broken=True)
   r=subprocess.run(['npm','run','validate:data','--','--symbol','BTCUSDT','--data',td],cwd=ROOT,capture_output=True,text=True)
   self.assertNotEqual(r.returncode,0); self.assertIn('Status: FAIL',r.stdout); self.assertIn('missing intervals: 1',r.stdout)

 def test_manifest_summary_and_backtest_refuses_invalid_real_data(self):
  with tempfile.TemporaryDirectory() as td:
   base=Path(td); self.write_dataset(base, broken=True)
   (base/'manifest.json').write_text(json.dumps({'symbol':'BTCUSDT','timeframes':['4h','1h','15m'],'source':'unit-test','dateRange':{'start':'2025-01-01T00:00:00Z','end':'2025-01-01T12:00:00Z'},'timezone':'UTC','generatedAt':'2026-08-13T00:00:00Z','rowCounts':{'4h':4,'1h':4,'15m':4}}))
   js=f"""import {{readDatasetManifest, summarizeManifest}} from '{ROOT/'src/aurion/backtest/datasetValidation.mjs'}';
   const manifest=await readDatasetManifest('{td}');
   console.log(JSON.stringify(summarizeManifest(manifest)));"""
   d=json.loads(run_node(js).stdout.strip())
   self.assertEqual(d['source'],'unit-test'); self.assertEqual(d['rowCounts']['15m'],4)
   r=subprocess.run(['node','scripts/backtest.mjs','--symbol','BTCUSDT','--data',td],cwd=ROOT,capture_output=True,text=True)
   self.assertNotEqual(r.returncode,0); self.assertIn('Real-data backtest refused',r.stderr); self.assertIn('Status: FAIL',r.stderr)

if __name__=='__main__': unittest.main()
