"""Fun Math V3 isolated tests; no service or network access."""
import itertools
import json
import math
import random
import tempfile
import unittest
from datetime import date,timedelta
from pathlib import Path

from engine import (ALL,TERMS,BY_NAME,candidates,terms_snapshot,model_weights,
    score_era,run_research,frozen_future,sha_of,SCHEMA,white_log_gain)
from engine_v2 import symmetric_five
from source_v1 import parse


def fake_draws(n=175, seed=90, era='2025', pool=70):
    rng=random.Random(seed)
    origin=date(2025,4,8)
    return [{'date':(origin+timedelta(days=3*i)).isoformat(),'era':era,
             'white':sorted(rng.sample(range(1,pool+1),5)), 'mega':rng.randint(1,24)}
            for i in range(n)]


class V3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows=fake_draws()

    def test_grammar_diverse_bounded_and_non_executable(self):
        self.assertEqual(len(ALL),138)
        self.assertEqual(len(BY_NAME),138)
        self.assertEqual(len(TERMS),27)
        self.assertTrue(any(x['name'].startswith('quadratic') for x in ALL))
        self.assertTrue(any(x['name'].startswith('interaction') for x in ALL))
        self.assertTrue(all(len(x['terms'])<=2 for x in ALL))

    def test_snapshot_never_sees_target_draw(self):
        a=self.rows[:101]
        b=[dict(x) for x in a]
        b[-1]=dict(b[-1],white=[1,2,3,4,5])
        self.assertEqual(terms_snapshot(a[:100],70),terms_snapshot(b[:100],70))
        snap=terms_snapshot(a[:100],70)
        self.assertEqual(len(snap),27)
        self.assertTrue(all(len(vals)==70 for vals in snap.values()))
        self.assertTrue(all(math.isfinite(v) for vals in snap.values() for v in vals))

    def test_exact_probability_normalization_martingale(self):
        w=[.5,1.1,2,1.3,.75,2.2,1.8]
        total=sum(math.exp(white_log_gain(w,subset)) for subset in itertools.combinations(range(1,8),5))
        self.assertAlmostEqual(total/math.comb(7,5),1.0,places=12)
        self.assertAlmostEqual(symmetric_five(w),sum(math.prod(w[i-1] for i in c) for c in itertools.combinations(range(1,8),5)))

    def test_all_historical_scores_reported_even_if_baseline_selected(self):
        item,ledger=score_era(self.rows,70)
        self.assertEqual(item['equations_generated'],138)
        self.assertEqual(len(ledger),138)
        self.assertTrue(item['baseline_zero_is_reference_not_all_equations_scored_zero'])
        self.assertTrue(any(abs(x['historical_test_mean_log_gain'])>0.00001 for x in ledger))
        self.assertTrue(any(x['historical_test_mean_log_gain']<0 for x in ledger))
        self.assertTrue(all('validation_mean_log_gain' in x for x in ledger))

    def test_all_eras_and_source_metadata(self):
        rows=self.rows
        report,ledger=run_research(rows,'a'*64,'synthetic_test',False)
        self.assertEqual(report['version'],SCHEMA)
        self.assertEqual(report['equations_generated_per_era'],138)
        self.assertEqual(len(ledger['2025']),138)
        self.assertEqual(report['services_touched'],0)
        self.assertIs(report['elektron_touched'],False)

    def test_future_freeze_idempotence_and_revision_hold(self):
        report, _=run_research(self.rows[:170],'a'*64,'synthetic_test',False)
        with tempfile.TemporaryDirectory() as d:
            directory=Path(d)
            frozen=frozen_future(directory,self.rows[:170],report)
            self.assertEqual(frozen['state'],'FROZEN_AWAITING_GENUINELY_FUTURE_DRAWINGS')
            self.assertEqual(frozen['future_scored'],0)
            result=frozen_future(directory,self.rows,report)
            self.assertEqual(result['newly_scored'],5)
            self.assertEqual(result['future_scored'],5)
            again=frozen_future(directory,self.rows,report)
            self.assertEqual(again['newly_scored'],0)
            self.assertAlmostEqual(again['mixture_evalue'],result['mixture_evalue'],places=8)
            altered=[dict(r) for r in self.rows]
            altered[-1]=dict(altered[-1],white=[1,2,3,4,5])
            with self.assertRaisesRegex(ValueError,'revised'):
                frozen_future(directory,altered,report)
            self.assertEqual(len((directory/'v3_future_scorecard.jsonl').read_text().splitlines()),5)

    def test_stale_source_never_updates_future_scorecard(self):
        report,_=run_research(self.rows[:170],'a'*64,'synthetic_test',False)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)
            frozen_future(path,self.rows[:170],report)
            stale=dict(report,stale=True)
            result=frozen_future(path,self.rows,stale)
            self.assertEqual(result['state'],'STALE_SOURCE_NO_PROSPECTIVE_UPDATES')
            self.assertFalse((path/'v3_future_scorecard.jsonl').exists())


if __name__=='__main__':unittest.main()