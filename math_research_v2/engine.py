#!/usr/bin/env python3
"""Fun Industrial Math Research V2: reproducible autonomous hypothesis discovery.

Research only; no purchase, betting, model or infrastructure operations. Uses
external official open data or a validated cache, never privileged integrations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from source_v1 import ERAS, load_bytes, parse

FEATURES = ('hot25', 'hot50', 'hot100', 'momentum', 'last', 'gap')
BURNIN = 100
MAX_CANDIDATES = 80


def normalize(vals):
    mean = sum(vals) / len(vals)
    variance = sum((v-mean)**2 for v in vals) / len(vals)
    scale = math.sqrt(variance) if variance > 1e-12 else 1.0
    return [(v-mean)/scale for v in vals]


def feature_values(history, N, which):
    """Compute observations strictly before the target drawing; one ball at a time."""
    if not history:
        return [0.0]*N
    if which in ('hot25', 'hot50', 'hot100'):
        window = int(which.removeprefix('hot'))
        sample = history[-window:]
        totals = [0]*N
        for row in sample:
            for ball in row['white']:
                totals[ball-1] += 1
        return normalize(totals)
    if which == 'momentum':
        recent = feature_values(history, N, 'hot25')
        long_term = feature_values(history, N, 'hot100')
        return normalize([a-b for a, b in zip(recent, long_term)])
    if which == 'last':
        present = set(history[-1]['white'])
        return normalize([1.0 if (i+1) in present else 0.0 for i in range(N)])
    if which == 'gap':
        gaps = [min(len(history), 100)] * N
        for age, row in enumerate(reversed(history[-100:]), start=1):
            for ball in row['white']:
                if gaps[ball-1] > age:
                    gaps[ball-1] = age
        return normalize(gaps)
    raise ValueError('Unrecognized feature: '+which)


def candidate_grammar():
    """Deterministic symbolic grammar, not code execution or Qwen generation.

    Every expression uses bounded coefficients so model exploration cannot
    induce numerical overflow or arbitrary code execution.
    """
    candidates = []
    for f in FEATURES:
        for beta in (-0.7, -0.35, 0.35, 0.7):
            candidates.append({'name': f'{beta:+.2f}*{f}', 'coeffs': {f: beta}, 'terms': 1})
    for i, f in enumerate(FEATURES):
        for g in FEATURES[i+1:]:
            candidates.append({'name': f'+.35*{f} +.35*{g}', 'coeffs': {f: 0.35, g: 0.35}, 'terms': 2})
            candidates.append({'name': f'+.35*{f} -.35*{g}', 'coeffs': {f: 0.35, g: -0.35}, 'terms': 2})
            candidates.append({'name': f'-.35*{f} +.35*{g}', 'coeffs': {f: -0.35, g: 0.35}, 'terms': 2})
    assert len(candidates) <= MAX_CANDIDATES
    return candidates


def feature_snapshot(history, N):
    return {f: feature_values(history, N, f) for f in FEATURES}


def weights(snapshot, candidate):
    terms = candidate['coeffs']
    N = len(next(iter(snapshot.values())))
    exponents = [sum(a*snapshot[f][i] for f,a in terms.items()) for i in range(N)]
    # No arbitrary maximization of confidence in the selected numbers.
    return [math.exp(max(-3.0, min(3.0, x))) for x in exponents]


def symmetric_five(values):
    """Exact sum of products of all 5-subsets, O(5N)."""
    e = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    for i,v in enumerate(values):
        for k in range(min(5,i+1),0,-1):
            e[k] += v*e[k-1]
    return e[5]


def white_log_gain(w, white):
    """log(P_model(draw)/P_uniform(draw)); P_model proportional to prod weights."""
    partition = symmetric_five(w)
    return sum(math.log(w[x-1]) for x in white) - math.log(partition) + math.log(math.comb(len(w),5))


def evaluate(draws, N, candidate, start, end, keep_rows=False):
    """Walk-forward. Feature snapshot is computed before observed draw i."""
    gains = []
    for i in range(start,end):
        snap = feature_snapshot(draws[:i],N)
        w = weights(snap,candidate)
        gains.append(white_log_gain(w, draws[i]['white']))
    return gains


def select_and_test(draws, N, simulations, seed):
    count=len(draws)
    # This makes the 2025 rules cohort relatively small (42 test draws).
    start=max(BURNIN, int(count*0.5))
    stop=max(start+20, int(count*0.75))
    if count - stop < 25 or stop-start<15:
        return {'status':'INSUFFICIENT_SEPARATE_VALIDATION_AND_TEST', 'draws':count}
    candidates=candidate_grammar()
    trials=[]
    for candidate in candidates:
        values=evaluate(draws,N,candidate,start,stop)
        score=sum(values)/len(values)
        trials.append((score,candidate))
    trials.sort(key=lambda v:(-v[0],v[1]['name']))
    best_val, best_candidate=trials[0]
    # The baseline is always eligible; no invented improvement if all fail.
    selected=best_candidate if best_val>0 else None
    if selected is None:
        return {'status':'BASELINE_SELECTED', 'draws':count,'training_draws':start,
                'validation_draws':stop-start,'test_draws':count-stop,
                'generated_equations':len(candidates),'validation_best_mean_gain':round(best_val,6),
                'validation_best_candidate':best_candidate,
                'selected':'FAIR_RANDOM_BASELINE','test_mean_log_gain':0.0,'test_total_log_gain':0.0,
                'test_p_uncorrected':None}
    real=evaluate(draws,N,selected,stop,count)
    observed=sum(real)
    # Null simulation reproduces *walk-forward* history updates, rather than
    # shuffling outcome labels while inadvertently retaining real future state.
    rng=random.Random(seed)
    tail=0
    null_scores=[]
    for _ in range(simulations):
        experiment=draws[:stop].copy()
        score=0.0
        for i in range(stop,count):
            snap=feature_snapshot(experiment,N)
            w=weights(snap,selected)
            balls=sorted(rng.sample(range(1,N+1),5))
            score+=white_log_gain(w,balls)
            experiment.append({'white':balls})
        null_scores.append(score)
        if score>=observed-1e-12:
            tail+=1
    # Uniform subset model is fixed; p is exploratory due limited sample and
    # repeated inspections of historical holdouts across software versions.
    result={'status':'HISTORICAL_TEST_COMPLETE_NOT_FUTURE_PROOF','draws':count,
         'training_draws':start,'validation_draws':stop-start,'test_draws':count-stop,
         'generated_equations':len(candidates),
         'validation_best_mean_gain':round(best_val,6),
         'validation_best_candidate':best_candidate,
         'selected':selected['name'], 'selected_coefficients':selected['coeffs'],
         'test_mean_log_gain':round(observed/(count-stop),6),
         'test_total_log_gain':round(observed,6),
         'test_p_uncorrected':round((tail+1)/(simulations+1),5),
         'simulations':simulations, 'historical_null_mean_total_gain':round(sum(null_scores)/len(null_scores),6)}
    return result


def run(draws, sha, source, stale, simulations):
    groups=defaultdict(list)
    for row in draws:
        groups[row['era']].append(row)
    periods={}
    for index,(era,_start,_end,N,B) in enumerate(ERAS):
        d=groups.get(era,[])
        if not d:
            continue
        state=select_and_test(d,N,simulations,int(sha[:8],16)+index)
        state.update({'first':d[0]['date'],'last':d[-1]['date'],'white_pool':N,'mega_pool':B})
        periods[era]=state
    # Bonferroni across all five era experiments; repeated analysis remains exploratory.
    tests=sum(1 for x in periods.values() if x.get('test_p_uncorrected') is not None)
    for state in periods.values():
        p=state.get('test_p_uncorrected')
        state['corrected_across_eras_p']=round(min(1,p*tests),5) if p is not None else None
        state['interpretation']='NO_VERIFIED_PREDICTIVE_EDGE; AWAIT_TRULY_FUTURE_DRAWS'
    return {'system':'Fun Industrial','version':'math-research-v2',
            'authority':'statistical_research_only','source':source,'sha256':sha,
            'stale':stale,'utc':datetime.now(timezone.utc).isoformat(),
            'draws':len(draws),'last':draws[-1]['date'],
            'equation_grammar':len(candidate_grammar()),'eras':periods,
            'conclusion':'NO_GUARANTEED_OR_VERIFIED_PREDICTION','tickets_or_bets':0,
            'services_touched':0,'elektron_touched':False}



def score_future_registered_draws(target, draws, report):
    """Freeze a formula before observing subsequent official drawings.

    Registry and scorecard are independent of repeatedly explored historical
    holdouts. They are never used for selection, even as history grows.
    """
    registry = target / 'frozen_future_protocol.json'
    scorecard = target / 'prospective_scorecard.jsonl'
    if report['stale']:
        return {'status': 'OFFLINE_STALE_NO_FUTURE_SCORING'}
    if not registry.exists():
        cohort=report['eras'].get('2025')
        if not cohort or not cohort.get('selected'):
            return {'status':'NOT_ENOUGH_DATA_TO_FREEZE'}
        # Validation selects the candidate; the historical test is never
        # allowed to alter what will be prospectively evaluated.
        if len([r for r in draws if r['era']=='2025'])<125:
            return {'status':'NOT_ENOUGH_DATA_TO_FREEZE'}
        picked=cohort.get('validation_best_candidate')
        if not picked:
            return {'status':'NO_VALIDATION_CANDIDATE_TO_FREEZE'}
        protocol={'version':'future-protocol-v2','frozen_at_date':draws[-1]['date'],
                  'first_dataset_sha256':report['sha256'],'rule_era':'2025',
                  'candidate':picked,'white_pool':70,
                  'rules':'NEVER_RESELECT_ON_FUTURE_DATA; no betting or live prediction claims'}
        registry.write_text(json.dumps(protocol,indent=2)+'\n',encoding='utf-8')
        return {'status':'FROZEN_WAITING_FOR_NEW_DRAWS','frozen_at_date':protocol['frozen_at_date'],
                'frozen_equation':picked['name'],'future_scored':0}
    protocol=json.loads(registry.read_text(encoding='utf-8'))
    if protocol.get('version')!='future-protocol-v2' or protocol.get('rule_era')!='2025':
        raise ValueError('Unknown frozen protocol; manual review required')
    existing=[]
    if scorecard.exists():
        for line in scorecard.read_text(encoding='utf-8').splitlines():
            if line.strip():
                existing.append(json.loads(line))
    observed={r['date']:r for r in draws}
    for entry in existing:
        x=observed.get(entry['date'])
        if not x or x['white'] != entry['observed_white']:
            raise ValueError('Historical data revision detected; prospective ledger not overwritten')
    existing_dates={x['date'] for x in existing}
    pending=[]
    for i,draw in enumerate(draws):
        if draw['date']<=protocol['frozen_at_date'] or draw['era']!=protocol['rule_era'] or draw['date'] in existing_dates:
            continue
        history=[x for x in draws[:i] if x['era']==protocol['rule_era']]
        if len(history)<100:
            continue
        w=weights(feature_snapshot(history,protocol['white_pool']),protocol['candidate'])
        gain=white_log_gain(w,draw['white'])
        pending.append({'date':draw['date'],'observed_white':draw['white'],
                        'frozen_equation':protocol['candidate']['name'],
                        'white_log_gain_vs_fair_random':round(gain,8),
                        'source_sha256':report['sha256']})
    if pending:
        with scorecard.open('a',encoding='utf-8') as handle:
            for e in pending:
                handle.write(json.dumps(e,separators=(',',':'))+'\n')
    scored=existing+pending
    total=round(sum(x['white_log_gain_vs_fair_random'] for x in scored),6)
    return {'status':'FROZEN_FUTURE_EVALUATION_ONLY','frozen_at_date':protocol['frozen_at_date'],
            'frozen_equation':protocol['candidate']['name'],
            'future_scored':len(scored),'newly_scored':len(pending),
            'cumulative_log_gain_vs_fair_random':total,
            'conclusion':'NOT_PROOF_OF_PREDICTABILITY'}


def publish(target, report):
    (target/'latest_report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    lines=['# Fun Industrial — autonomous mathematical discovery V2', '',
           '**Scientific hypothesis exploration only; not evidence of a lottery prediction system.**', '',
           f"Source: {report['source']}",f"Source SHA-256: `{report['sha256']}`",
           f"Drawings: {report['draws']}, latest: {report['last']}, stale: {report['stale']}",
           f"Equations generated per eligible rules period: {report['equation_grammar']}", '',
           '| Era | Validation winner | Validation mean log gain | Unseen historical mean log gain | Corrected p |',
           '|---|---|---:|---:|---:|']
    for era,d in report['eras'].items():
        lines.append(f"| {era} | {d.get('selected',d['status'])} | {d.get('validation_best_mean_gain','—')} | {d.get('test_mean_log_gain','—')} | {d.get('corrected_across_eras_p','—')} |")
    lines+=['', '## Frozen future-only protocol', '',
            json.dumps(report.get('future_protocol',{}),indent=2), '',
            '## Interpretation','',
            '- Equation grammar searches frequencies, momentum, most recent appearance, and gaps.',
            '- The model is selected **only** on earlier validation results and scored once on later historical drawings.',
            '- Exact five-ball joint probabilities are normalized via elementary symmetric polynomials.',
            '- The null simulations redraw each test period, advancing the model on its own simulated history.',
            '- Reusing these historical test sets, changing protocols, or selecting favorable periods invalidates confirmatory claims.',
            '- Evidence of a repeatable effect requires genuinely future data after the model is frozen.',
            '- White ball analysis only; Mega Ball is deliberately not optimized in V2.',
            '- No tickets, money, login, REA/Qwen calls, web interfaces, or changes to Elektron and existing services.', '']
    (target/'latest_summary.md').write_text('\n'.join(lines),encoding='utf-8')
    with (target/'evidence_ledger.jsonl').open('a',encoding='utf-8') as f:
        f.write(json.dumps({'utc':report['utc'],'sha256':report['sha256'],
                            'draws':report['draws'],'last':report['last'],
                            'grammar':report['equation_grammar'],
                            'results':{era:d.get('status') for era,d in report['eras'].items()}},
                           separators=(',',':'))+'\n')


def main(argv=None):
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--out',default=str(Path.home()/'AppData'/'Local'/'FunIndustrial'/'MathResearchV2'))
    cli.add_argument('--file',help='CSV input path for a local test (no external download)')
    cli.add_argument('--offline',action='store_true',help='Read V2 cached file, explicitly stale')
    cli.add_argument('--simulations',type=int,default=200)
    cli.add_argument('--force',action='store_true')
    a=cli.parse_args(argv)
    if not 50<=a.simulations<=500:
        cli.error('--simulations must be 50..500 for resource-aware operation')
    out=Path(a.out).resolve()
    out.mkdir(parents=True,exist_ok=True)
    raw,source,stale=load_bytes(out,a.file,a.offline)
    draws=parse(raw)
    sha=hashlib.sha256(raw).hexdigest()
    reportpath=out/'latest_report.json'
    if reportpath.exists() and not a.force:
        try:
            old=json.loads(reportpath.read_text(encoding='utf-8'))
            if sha==old.get('sha256') and stale==old.get('stale') and old.get('version')=='math-research-v2':
                print('FUN_MATH_V2=UNCHANGED_VALIDATED_CACHE_NO_RECOMPUTE')
                return 0
        except (ValueError,OSError):
            pass
    report=run(draws,sha,source,stale,a.simulations)
    if not a.file and not stale:
        (out/'official_source.csv').write_bytes(raw)
    report['future_protocol']=score_future_registered_draws(out,draws,report)
    publish(out,report)
    print(f"FUN_MATH_V2=PASS DRAWS={len(draws)} LAST={draws[-1]['date']} STALE={stale}")
    print('EQUATIONS_GENERATED='+str(report['equation_grammar']))
    for era,state in report['eras'].items():
        print('FUN_MATH_V2_ERA='+era+' SELECTED='+str(state.get('selected',state['status']))+' TEST_GAIN='+str(state.get('test_mean_log_gain','NA')))
    print('FUN_MATH_V2_REPORT='+str(out/'latest_summary.md'))
    print('FUN_ONLY=TRUE ELEKTRON_TOUCHED=FALSE PROTECTED_SERVICES_UNCHANGED=TRUE')
    return 0


if __name__=='__main__':
    try:
        sys.exit(main())
    except (OSError,ValueError,RuntimeError) as e:
        print('FUN_MATH_V2_HOLD='+str(e),file=sys.stderr)
        sys.exit(1)