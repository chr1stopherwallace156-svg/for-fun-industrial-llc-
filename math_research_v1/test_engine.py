"""Pure Python unit tests; no internet or live Fun Industrial dependencies."""
import csv
import io
import random
import unittest
from datetime import date, timedelta
from engine import find_era, parse, prospective_backtest, research


def fake_csv(seed=7, total=1000):
    rng = random.Random(seed)
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['Draw Date', 'Winning Numbers', 'Mega Ball', 'Multiplier'])
    d = date(2002, 5, 17)
    for _ in range(total):
        while d.weekday() not in (1, 4):
            d += timedelta(days=1)
        _, n, b = find_era(d.isoformat())
        w.writerow([d.strftime('%m/%d/%Y'), ' '.join(str(x) for x in rng.sample(range(1, n+1), 5)), rng.randint(1,b), '02'])
        d += timedelta(days=1)
    return out.getvalue().encode()


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = fake_csv()
        cls.rows = parse(cls.fixture)

    def test_history_validated(self):
        self.assertEqual(len(self.rows), 1000)
        self.assertEqual(self.rows[0]['date'], '2002-05-17')
        self.assertTrue(self.rows[-1]['date'] < '2026-11-22')

    def test_duplicate_rejected(self):
        a = self.fixture.decode().splitlines()
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            parse(('\n'.join(a + [a[-1]])).encode())

    def test_out_of_range_rejected(self):
        s = self.fixture.decode().replace('1 2 3 4 5', '1 2 3 4 5')
        lines = s.splitlines()
        cols = lines[1].split(',')
        cols[1] = '1 2 3 4 999'
        lines[1] = ','.join(cols)
        with self.assertRaisesRegex(ValueError, 'Invalid'):
            parse(('\n'.join(lines)).encode())

    def test_stale_era_is_not_cross_pooled(self):
        data = [r for r in self.rows if r['era'] == '2005']
        if len(data) > 30:
            trial = prospective_backtest(data, 56, 25, 'hot')
            self.assertTrue(trial is not None)
            self.assertEqual(trial['heldout_drawings'], len(data)-max(25, int(.7*len(data))))

    def test_null_synthetic_not_all_flagged(self):
        _, family = research(self.rows, simulations=50)
        self.assertGreater(family, 0)


if __name__ == '__main__':
    unittest.main()