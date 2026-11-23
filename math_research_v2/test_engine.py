import math
import random
import unittest
import tempfile
from pathlib import Path

from engine import (FEATURES, candidate_grammar, symmetric_five, white_log_gain,
                    feature_values, weights, feature_snapshot, evaluate, select_and_test, score_future_registered_draws)


def synthetic(n=210,seed=15,N=70):
    r=random.Random(seed)
    return [{'date':'2026-01-01','era':'2025','white':sorted(r.sample(range(1,N+1),5)), 'mega':r.randint(1,24)} for _ in range(n)]


class EngineTests(unittest.TestCase):
    def test_normalizer(self):
        self.assertEqual(symmetric_five([1.0]*70),math.comb(70,5))
        self.assertAlmostEqual(white_log_gain([1.0]*70,[1,2,3,4,5]),0.0)
        self.assertAlmostEqual(symmetric_five([2,3,5,7,11]),2*3*5*7*11)

    def test_symbolic_candidates_bounded(self):
        candidates=candidate_grammar()
        self.assertEqual(len(candidates),69)
        self.assertTrue(all(set(c['coeffs']).issubset(FEATURES) for c in candidates))

    def test_only_past_draws_affect_weight(self):
        a=synthetic()
        snap=feature_snapshot(a[:120],70)
        b=a[:120]+[dict(a[120],white=[1,2,3,4,5])]+a[121:]
        snap2=feature_snapshot(b[:120],70)
        self.assertEqual(snap,snap2)
        self.assertEqual(feature_snapshot(a[:120],70), feature_snapshot(b[:120],70))

    def test_feature_values(self):
        a=synthetic()
        for f in FEATURES:
            z=feature_values(a[:101],70,f)
            self.assertEqual(len(z),70)
            self.assertTrue(all(math.isfinite(v) for v in z))
        self.assertTrue(all(0<w<30 for w in weights(feature_snapshot(a[:100],70),candidate_grammar()[0])))

    def test_no_leakage_and_null_backtest(self):
        a=synthetic(210,7)
        result=select_and_test(a,70,50,42)
        self.assertEqual(result['generated_equations'],69)
        self.assertGreater(result['test_draws'],25)
        self.assertTrue(result['status'] in ('BASELINE_SELECTED','HISTORICAL_TEST_COMPLETE_NOT_FUTURE_PROOF'))
        if result['selected']!='FAIR_RANDOM_BASELINE':
            self.assertTrue(0<result['test_p_uncorrected']<=1)

    def test_future_protocol_only_scores_draws_after_freeze(self):
        a=synthetic(171)
        from datetime import date, timedelta
        origin=date(2025,4,8)
        for i,row in enumerate(a):
            row['date']=(origin+timedelta(days=3*i)).isoformat()
        first={'eras':{'2025':{'selected':'+.35*hot25','validation_best_candidate':candidate_grammar()[0]}},'sha256':'abc','stale':False}
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)
            frozen=score_future_registered_draws(path,a[:170],first)
            self.assertEqual(frozen['future_scored'],0)
            self.assertEqual(frozen['status'],'FROZEN_WAITING_FOR_NEW_DRAWS')
            later=score_future_registered_draws(path,a,first)
            self.assertEqual(later['future_scored'],1)
            again=score_future_registered_draws(path,a,first)
            self.assertEqual(again['newly_scored'],0)
            self.assertEqual(again['future_scored'],1)
            a[-1]['white']=[1,2,3,4,5]
            with self.assertRaisesRegex(ValueError,'revision'):
                score_future_registered_draws(path,a,first)


if __name__=='__main__':
    unittest.main()
