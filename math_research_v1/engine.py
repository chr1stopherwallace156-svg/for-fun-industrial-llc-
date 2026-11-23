#!/usr/bin/env python3
"""Fun Industrial Math Research V1. Independent, read-only Mega Millions hypothesis lab.

Scheduled invocation may refresh official open data; no lottery bets, predictions,
REAs, AI, production service changes, or external account actions are performed.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import random
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import NormalDist

SOURCE = 'https://data.ny.gov/resource/5xaw-6ayf.csv?$limit=5000&$order=draw_date%20ASC'
BACKUP = 'https://data.ny.gov/api/views/5xaw-6ayf/rows.csv?accessType=DOWNLOAD'
ERAS = [
    ('2002', '2002-05-17', '2005-06-23', 52, 52),
    ('2005', '2005-06-24', '2013-10-21', 56, 46),
    ('2013', '2013-10-22', '2017-10-30', 75, 15),
    ('2017', '2017-10-31', '2025-04-07', 70, 25),
    ('2025', '2025-04-08', '9999-12-31', 70, 24),
]
WINDOWS = (25, 50, 100, 200)


def find_era(day):
    for era, start, end, white, mega in ERAS:
        if start <= day <= end:
            return era, white, mega
    raise ValueError('Unsupported draw date: ' + day)


def load_bytes(out, path=None, offline=False):
    if path:
        return Path(path).read_bytes(), 'operator_supplied_csv', False
    cache = out / 'official_source.csv'
    if offline:
        if not cache.exists():
            raise RuntimeError('Offline cache missing. First run online or supply --file.')
        return cache.read_bytes(), 'cached_offline', True
    failures = []
    for url in (SOURCE, BACKUP):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'FunIndustrialMathResearchV1/1.0', 'Accept': 'text/csv'})
            with urllib.request.urlopen(request, timeout=30) as res:
                raw = res.read(10_000_001)
            if len(raw) > 10_000_000:
                raise ValueError('CSV too large')
            if b'winning' not in raw[:1000].lower() or b'draw' not in raw[:1000].lower():
                raise ValueError('Unexpected dataset header')
            # Replace the official cache only after validation in main().
            return raw, url, False
        except (OSError, ValueError) as exc:
            failures.append(str(exc))
    if cache.exists():
        return cache.read_bytes(), 'cached_after_refresh_failure', True
    raise RuntimeError('Official source unavailable: ' + '; '.join(failures))


def normalize_date(s):
    s = s.strip()
    if len(s) >= 10 and s[4] == '-':
        return s[:10]
    return datetime.strptime(s[:10], '%m/%d/%Y').strftime('%Y-%m-%d')


def parse(raw, minimum=1000):
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if reader.fieldnames is None:
        raise ValueError('CSV missing header')
    fields = {s.lower().strip().replace(' ', '_'): s for s in reader.fieldnames}
    for key in ('draw_date', 'winning_numbers', 'mega_ball'):
        if key not in fields:
            raise ValueError('Required field missing: ' + key)
    result, seen = [], set()
    for row in reader:
        date = normalize_date(row[fields['draw_date']]); era, N, B = find_era(date)
        white = sorted(int(x) for x in row[fields['winning_numbers']].replace('-', ' ').split())
        mega = int(row[fields['mega_ball']])
        if date in seen or len(white) != 5 or len(set(white)) != 5 or not all(1 <= x <= N for x in white) or not 1 <= mega <= B:
            raise ValueError('Invalid or duplicate draw: ' + date)
        seen.add(date)
        result.append({'date': date, 'era': era, 'white': white, 'mega': mega})
    result.sort(key=lambda x: x['date'])
    if len(result) < minimum or result[0]['date'] != '2002-05-17':
        raise ValueError('Incomplete official history. Received %d rows beginning %s.' % (len(result), result[0]['date'] if result else 'none'))
    if result[-1]['date'] > datetime.now(timezone.utc).strftime('%Y-%m-%d'):
        raise ValueError('Future-dated drawing')
    return result


def chi_square(counts, n, pool, balls):
    expected = n * balls / pool
    return sum((counts[x] - expected) ** 2 / expected for x in range(1, pool + 1))


def distribution_test(draws, N, B, simulations, seed):
    observed_white = Counter(v for r in draws for v in r['white'])
    observed_mega = Counter(r['mega'] for r in draws)
    observed_w = chi_square(observed_white, len(draws), N, 5)
    observed_b = chi_square(observed_mega, len(draws), B, 1)
    randomizer = random.Random(seed)
    w_tail = b_tail = 0
    for _ in range(simulations):
        wc = Counter(); bc = Counter()
        for _ in draws:
            wc.update(randomizer.sample(range(1, N + 1), 5))
            bc[randomizer.randrange(1, B + 1)] += 1
        w_tail += chi_square(wc, len(draws), N, 5) >= observed_w
        b_tail += chi_square(bc, len(draws), B, 1) >= observed_b
    return {
        'simulations': simulations, 'white_chi_square': round(observed_w, 4),
        'white_uniformity_p': round((w_tail + 1) / (simulations + 1), 5),
        'mega_chi_square': round(observed_b, 4),
        'mega_uniformity_p': round((b_tail + 1) / (simulations + 1), 5),
    }


def prospective_backtest(draws, N, window, direction):
    """Fixed protocol. Only draws preceding the test date are used for ranking."""
    start = max(window, int(len(draws) * 0.7))
    if len(draws) - start < 20:
        return None
    hits = 0
    for i in range(start, len(draws)):
        counts = Counter(v for r in draws[i-window:i] for v in r['white'])
        ordered = sorted(range(1, N + 1), key=lambda v: (-counts[v], v))
        candidates = set(ordered[:5] if direction == 'hot' else ordered[-5:])
        hits += len(candidates.intersection(draws[i]['white']))
    tests = len(draws) - start
    expectation = tests * 25 / N
    # Hypergeometric variance under fair, independent drawings with a
    # history-adaptive selection; Normal tail is exploratory/approximate.
    variance = tests * 5 * (5 / N) * (1 - 5 / N) * ((N - 5) / (N - 1))
    z = (hits - expectation) / math.sqrt(variance)
    one_sided_p = NormalDist().cdf(-z)
    return {
        'candidate': f'{direction}_previous_{window}_draws',
        'window': window, 'direction': direction, 'heldout_drawings': tests,
        'actual_matches': hits, 'expected_matches': round(expectation, 3),
        'observed_matches_per_draw': round(hits / tests, 4),
        'z_score': round(z, 4), 'one_sided_p_uncorrected': round(one_sided_p, 5),
    }


def research(draws, simulations):
    groups = defaultdict(list)
    for r in draws:
        groups[r['era']].append(r)
    eras = {}
    all_tests = []
    for idx, (era, _start, _end, N, B) in enumerate(ERAS):
        data = groups[era]
        if not data:
            continue
        whites = Counter(v for r in data for v in r['white'])
        balls = Counter(r['mega'] for r in data)
        tests = [prospective_backtest(data, N, w, direction)
                 for w in WINDOWS for direction in ('hot', 'cold')]
        tests = [t for t in tests if t]
        for t in tests:
            t['era'] = era
            all_tests.append(t)
        eras[era] = {
            'first': data[0]['date'], 'last': data[-1]['date'], 'drawings': len(data),
            'white_pool': N, 'mega_pool': B,
            'top_whites': [{'number': n, 'count': whites[n]} for n in sorted(range(1, N + 1), key=lambda x: (-whites[x], x))[:10]],
            'top_megas': [{'number': n, 'count': balls[n]} for n in sorted(range(1, B + 1), key=lambda x: (-balls[x], x))[:5]],
            'distribution': distribution_test(data, N, B, simulations, 20261122 + idx),
            'prospective_backtests': tests,
        }
    # Conservative familywise correction across all tested rolling strategies.
    family = max(1, len(all_tests))
    for t in all_tests:
        t['familywise_bonferroni_p'] = round(min(1.0, t['one_sided_p_uncorrected'] * family), 5)
        t['outcome'] = 'FOLLOW_UP_REQUIRED_NOT_PROVEN' if t['familywise_bonferroni_p'] < 0.05 else 'NO_CONFIRMED_ADVANTAGE'
    return eras, family


def write_outputs(out, obj):
    report = out / 'latest_report.json'
    report.write_text(json.dumps(obj, indent=2) + '\n', encoding='utf-8')
    lines = [
        '# Fun Industrial — independent mathematical hypothesis research', '',
        '**This is scientific exploration, not a lottery prediction or betting service.**', '',
        f"Source: {obj['source']}  ",
        f"Dataset SHA-256: `{obj['sha256']}`  ",
        f"Valid drawings: {obj['drawings']} ({obj['first']} to {obj['last']})  ",
        f"Offline/stale data: {obj['stale']}", '',
        '| Rules period | Drawings | White pool | Mega pool | White p | Mega p |',
        '|---|---:|---:|---:|---:|---:|',
    ]
    for era, d in obj['eras'].items():
        dist = d['distribution']
        lines.append(f"| {era} | {d['drawings']} | {d['white_pool']} | {d['mega_pool']} | {dist['white_uniformity_p']} | {dist['mega_uniformity_p']} |")
    lines.extend(['', '## Predefined hypothesis tests (latest 30% held out per rules period)', '',
                  '| Period | Hypothesis | Actual / expected matches | Adjusted p | Outcome |',
                  '|---|---|---:|---:|---|'])
    for era, d in obj['eras'].items():
        for t in d['prospective_backtests']:
            lines.append(f"| {era} | {t['candidate']} | {t['actual_matches']} / {t['expected_matches']} | {t['familywise_bonferroni_p']} | {t['outcome']} |")
    lines += ['', '## Scientific constraints', '',
              '- The rolling rules were specified before evaluating this batch. Results are still exploratory and need confirmation on *later, newly observed* draws.',
              '- The final 30% is evaluated chronologically, with each ranking computed from earlier draws only.',
              '- Changing lottery rules requires separate statistical eras; results must never be pooled indiscriminately.',
              '- A low p-value is not a winning-number prediction or proof of physical drawing bias.',
              '- No purchasing, ticket selection, REA actions, Qwen service calls, dashboard edits, or Elektron access.',
              '- This software writes only to its isolated research output directory.', '']
    (out / 'latest_summary.md').write_text('\n'.join(lines), encoding='utf-8')
    ledger = out / 'evidence_ledger.jsonl'
    with ledger.open('a', encoding='utf-8') as f:
        f.write(json.dumps({
            'utc': obj['utc'], 'sha256': obj['sha256'], 'drawings': obj['drawings'],
            'last': obj['last'], 'stale': obj['stale'],
            'hypotheses_tested': obj['total_candidate_tests'],
            'follow_up_flags': obj['follow_up_flags'],
        }, separators=(',', ':')) + '\n')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', default=str(Path.home() / 'AppData' / 'Local' / 'FunIndustrial' / 'MathResearchV1'))
    p.add_argument('--file', help='Use a local CSV for offline tests; no download')
    p.add_argument('--offline', action='store_true', help='Use cached CSV only, marked stale')
    p.add_argument('--simulations', type=int, default=300)
    p.add_argument('--force', action='store_true', help='Analyze again even when dataset SHA matches')
    a = p.parse_args(argv)
    if not 50 <= a.simulations <= 2000:
        p.error('--simulations must be 50..2000 to bound CPU use')
    out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    raw, source, stale = load_bytes(out, a.file, a.offline)
    data = parse(raw)
    digest = hashlib.sha256(raw).hexdigest()
    previous = out / 'latest_report.json'
    if previous.exists() and not a.force:
        try:
            old = json.loads(previous.read_text(encoding='utf-8'))
            if digest == old.get('sha256') and stale == old.get('stale'):
                print('FUN_MATH_RESEARCH=UNCHANGED_CACHE_HIT; no recomputation')
                return 0
        except (OSError, ValueError):
            pass
    eras, family = research(data, a.simulations)
    flags = [t for d in eras.values() for t in d['prospective_backtests'] if t['outcome'] == 'FOLLOW_UP_REQUIRED_NOT_PROVEN']
    obj = {
        'system': 'Fun Industrial', 'version': 'math-research-v1',
        'authority': 'read_only_statistical_research', 'utc': datetime.now(timezone.utc).isoformat(),
        'source': source, 'sha256': digest, 'stale': stale,
        'drawings': len(data), 'first': data[0]['date'], 'last': data[-1]['date'],
        'total_candidate_tests': family, 'follow_up_flags': len(flags),
        'conclusion': 'EXPLORATORY_ONLY_NO_PREDICTIVE_EDGE_VERIFIED',
        'eras': eras,
    }
    # Never overwrite the good cached download with malformed / truncated data.
    if not stale and not a.file:
        (out / 'official_source.csv').write_bytes(raw)
    write_outputs(out, obj)
    print(f"FUN_MATH_RESEARCH=PASS DRAWS={len(data)} LAST={data[-1]['date']} STALE={stale}")
    print(f"HYPOTHESES={family} FOLLOW_UP_ONLY={len(flags)}")
    print(f"REPORT={out / 'latest_summary.md'}")
    print('FUN_ONLY=TRUE ELEKTRON_TOUCHED=FALSE SERVICES_RESTARTED=FALSE')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print('FUN_MATH_RESEARCH_HOLD=' + str(exc), file=sys.stderr)
        sys.exit(1)