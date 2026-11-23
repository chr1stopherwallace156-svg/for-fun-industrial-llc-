#!/usr/bin/env python3
"""Fun Industrial Mathematical Research V3: bounded symbolic discovery and future e-process.

Research only; no execution authority, wagers, model-weight changes, dashboard
processes, external tool calls, or Elektron interactions. Standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from source_v1 import ERAS, load_bytes, parse
from engine_v2 import FEATURES as BASE_FEATURES, feature_snapshot, white_log_gain

SCHEMA = 'fun-math-research-v3'
BURNIN = 100
MAX_EQUATIONS = 160
FUTURE_FAMILY_SIZE = 5


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def sha_of(obj):
    return hashlib.sha256(canonical(obj).encode('utf-8')).hexdigest()


def normalized(array):
    avg = sum(array) / len(array)
    dev = math.sqrt(sum((x-avg)**2 for x in array) / len(array))
    return [(x-avg)/(dev if dev > 1e-10 else 1.0) for x in array]


def vocabulary():
    terms = list(BASE_FEATURES)
    terms += [f'square:{f}' for f in BASE_FEATURES]
    terms += [f'cross:{f}:{g}' for i, f in enumerate(BASE_FEATURES) for g in BASE_FEATURES[i+1:]]
    return tuple(terms)


TERMS = vocabulary()


def candidates():
    """Deterministic expression grammar: no arbitrary Python or model-generated code."""
    items = []
    for f in BASE_FEATURES:
        for beta in (-0.7, -0.45, -0.2, 0.2, 0.45, 0.7):
            items.append({'name': f'linear:{f}:{beta:+.2f}', 'terms': [[f, beta]]})
    for f in BASE_FEATURES:
        for beta in (-0.35, 0.35):
            items.append({'name': f'quadratic:{f}:{beta:+.2f}', 'terms': [[f'square:{f}', beta]]})
    for i, f in enumerate(BASE_FEATURES):
        for g in BASE_FEATURES[i+1:]:
            for beta in (-0.3, 0.3):
                items.append({'name': f'interaction:{f}:{g}:{beta:+.2f}', 'terms': [[f'cross:{f}:{g}', beta]]})
            for a, b in ((0.25,0.25), (0.25,-0.25), (-0.25,0.25),(-0.25,-0.25)):
                items.append({'name': f'pair:{f}:{g}:{a:+.2f}:{b:+.2f}',
                              'terms': [[f, a], [g, b]]})
    assert len(items) == 138 and len(items) <= MAX_EQUATIONS
    return items


ALL = candidates()
BY_NAME = {item['name']: item for item in ALL}


def terms_snapshot(history, N):
    src = feature_snapshot(history, N)
    d = dict(src)
    for f in BASE_FEATURES:
        d[f'square:{f}'] = normalized([x*x for x in src[f]])
    for i, f in enumerate(BASE_FEATURES):
        for g in BASE_FEATURES[i+1:]:
            d[f'cross:{f}:{g}'] = normalized([a*b for a, b in zip(src[f],src[g])])
    return d


def model_weights(snap, equation):
    n = len(next(iter(snap.values())))
    terms = equation['terms']
    result = []
    for i in range(n):
        exponent = sum(float(beta)*snap[name][i] for name,beta in terms)
        result.append(math.exp(max(-3.0, min(3.0, exponent))))
    return result


def snapshots(draws, n, start):
    """Each snapshot accesses strictly prior drawings, never the target or future."""
    return [terms_snapshot(draws[:i], n) for i in range(start, len(draws))]


def evaluate_one(draws, n, equation, snapshots_all, global_start, start, stop):
    total = 0.0
    for i in range(start, stop):
        total += white_log_gain(model_weights(snapshots_all[i-global_start], equation), draws[i]['white'])
    return total


def score_era(draws, N):
    n = len(draws)
    validation_start = max(BURNIN, int(n*0.5))
    test_start = max(validation_start+20, int(n*0.75))
    if test_start >= n-24 or validation_start >= test_start-14:
        return {'status':'INSUFFICIENT_SEPARATE_HISTORICAL_SPLITS','draws':n}, []
    snaps = snapshots(draws, N, validation_start)
    scored = []
    for candidate in ALL:
        v = evaluate_one(draws,N,candidate,snaps,validation_start,validation_start,test_start)
        t = evaluate_one(draws,N,candidate,snaps,validation_start,test_start,n)
        complexity = len(candidate['terms'])
        v_avg = v / (test_start - validation_start)
        t_avg = t / (n - test_start)
        scored.append({'name':candidate['name'], 'terms':candidate['terms'],
                       'complexity':complexity,'validation_mean_log_gain':round(v_avg,8),
                       'validation_total_log_gain':round(v,8),
                       'historical_test_mean_log_gain':round(t_avg,8),
                       'historical_test_total_log_gain':round(t,8),
                       'validation_rank_score':round(v_avg-0.004*complexity,8)})
    # Equation selection sees only validation performance; never test outcomes.
    ranking = sorted(scored,key=lambda x:(-x['validation_rank_score'],x['name']))
    best = ranking[0]
    selected = best['name'] if best['validation_rank_score']>0 else 'FAIR_RANDOM_BASELINE'
    test_of_selected = next((r for r in scored if r['name']==selected),None)
    top_history = sorted(scored,key=lambda x:(-x['historical_test_mean_log_gain'],x['name']))
    data = {'status':'HISTORICAL_MODEL_SCREEN_NOT_PROOF','draws':n,
            'training_draws':validation_start,
            'validation_draws':test_start-validation_start,
            'historical_test_draws':n-test_start,
            'equations_generated':len(scored),
            'selection_rule':'validation_score_minus_0.004_per_term; baseline_eligible',
            'validation_best':best,
            'selected':selected,
            'selected_test_mean_log_gain':test_of_selected['historical_test_mean_log_gain'] if test_of_selected else None,
            'baseline_test_mean_log_gain':0.0,
            'baseline_zero_is_reference_not_all_equations_scored_zero':True,
            'models_positive_on_validation':sum(r['validation_mean_log_gain']>0 for r in scored),
            'models_positive_on_historical_test':sum(r['historical_test_mean_log_gain']>0 for r in scored),
            'top_validation_candidates':ranking[:5],
            'top_test_candidates_posthoc_not_selection':top_history[:3],
            'future_family_candidates':[x['name'] for x in ranking[:FUTURE_FAMILY_SIZE]]}
    return data, scored


def run_research(draws, digest, src, stale):
    groups=defaultdict(list)
    for row in draws:
        groups[row['era']].append(row)
    eras = {}
    ledger = {}
    for era,_start,_end,N,B in ERAS:
        if not groups[era]:continue
        details, all_scores = score_era(groups[era],N)
        details['white_pool']=N
        details['mega_pool']=B
        details['first']=groups[era][0]['date']
        details['last']=groups[era][-1]['date']
        eras[era]=details
        ledger[era]=all_scores
    return {'system':'Fun Industrial','version':SCHEMA,
            'authority':'statistical_research_only','source':src,'sha256':digest,
            'stale':stale,'utc':datetime.now(timezone.utc).isoformat(),
            'draws':len(draws),'last':draws[-1]['date'],
            'equations_generated_per_era':len(ALL),'candidate_set_sha256':sha_of(ALL),
            'eras':eras,'conclusion':'NO_VERIFIED_PREDICTIVE_EDGE',
            'only_prospective_future_evalues_are_anytime_valid':True,
            'ticket_purchases':0,'tool_executions':0,
            'services_touched':0,'elektron_touched':False}, ledger


def logmeanexp(values):
    high=max(values)
    return high+math.log(sum(math.exp(v-high) for v in values)/len(values))


def frozen_future(target, all_draws, report):
    """A prespecified mixture of five valid normalized likelihood ratios.

    Under iid fair drawing null (and unchanged rules), the mixture E_t is a
    nonnegative unit-mean martingale, so Ville bounds ever crossing 20 by 0.05.
    Repeated future observations do NOT require choosing a new significance
    threshold. No interpretation on historical test scores.
    """
    if report['stale']:
        return {'state':'STALE_SOURCE_NO_PROSPECTIVE_UPDATES','future_scored':0}
    registry=target/'v3_frozen_future_protocol.json'
    scorecard=target/'v3_future_scorecard.jsonl'
    cohort=[r for r in all_draws if r['era']=='2025']
    if not registry.exists():
        if len(cohort)<125 or report['eras'].get('2025',{}).get('status')!='HISTORICAL_MODEL_SCREEN_NOT_PROOF':
            return {'state':'NOT_ENOUGH_CURRENT_ERA_DRAWS_TO_FREEZE','future_scored':0}
        picks=report['eras']['2025']['future_family_candidates']
        if len(picks)!=FUTURE_FAMILY_SIZE or len(set(picks))!=len(picks):
            raise ValueError('Invalid prospective candidate registration')
        data={'schema':'fun-math-future-mixture-v3',
              'frozen_after_draw':cohort[-1]['date'],
              'frozen_from_data_sha256':report['sha256'],
              'rule_era':'2025','white_pool':70,
              'family_names':picks,
              'equally_weighted_family_size':len(picks),
              'evaluation':'exact_five_subset_likelihood_ratio_walkforward',
              'threshold_evalue':20,
              'no_future_reselection':True}
        registry.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
        return {'state':'FROZEN_AWAITING_GENUINELY_FUTURE_DRAWINGS',
                'frozen_after_draw':cohort[-1]['date'],
                'family_size':len(picks),'future_scored':0,'mixture_evalue':1.0,
                'anytime_evidence_threshold':20,'claim':'NO_VERIFIED_PREDICTIVE_EDGE'}
    cfg=json.loads(registry.read_text(encoding='utf-8'))
    if cfg.get('schema')!='fun-math-future-mixture-v3' or cfg.get('rule_era')!='2025' or cfg.get('white_pool')!=70 or cfg.get('threshold_evalue')!=20 or cfg.get('no_future_reselection') is not True:
        raise ValueError('Frozen prospective protocol integrity HOLD')
    picks=cfg.get('family_names',[])
    if not isinstance(picks,list) or len(picks)!=FUTURE_FAMILY_SIZE or len(set(picks))!=len(picks) or not all(p in BY_NAME for p in picks):
        raise ValueError('Frozen candidate grammar mismatch')
    if cfg.get('equally_weighted_family_size')!=len(picks):
        raise ValueError('Frozen family weights changed')
    frozen_at=cfg['frozen_after_draw']
    if not any(r['date']==frozen_at for r in cohort):
        raise ValueError('Original future registration cutoff no longer exists')
    subsequent=[r for r in cohort if r['date']>frozen_at]
    old=[]
    if scorecard.exists():
        for line in scorecard.read_text(encoding='utf-8').splitlines():
            if not line.strip():continue
            event=json.loads(line)
            if not isinstance(event,dict):raise ValueError('Malformed future score record')
            old.append(event)
    if len(old)>len(subsequent):
        raise ValueError('Future score ledger contains missing or deleted draws')
    prev='GENESIS'
    for i, event in enumerate(old):
        checkrow=subsequent[i]
        expectedrow=sha_of({'date':checkrow['date'],'white':checkrow['white'],'mega':checkrow['mega']})
        if event.get('date')!=checkrow['date'] or event.get('drawing_sha256')!=expectedrow:
            raise ValueError('Prospective drawing revised: manual review required; ledger unchanged')
        if event.get('previous_record_hash')!=prev or event.get('record_hash')!=sha_of({k:v for k,v in event.items() if k!='record_hash'}):
            raise ValueError('Prospective evidence chain invalid; ledger unchanged')
        prev=event['record_hash']
    totals=[0.0]*len(picks)
    for event in old:
        gains=event['per_model_log_gain']
        if not isinstance(gains,list) or len(gains)!=len(picks) or not all(math.isfinite(x) for x in gains):
            raise ValueError('Prospective score ledger model count mismatch')
        totals=[a+b for a,b in zip(totals,gains)]
    appended=0
    full_history=[r for r in cohort if r['date']<=frozen_at]
    full_history.extend(subsequent[:len(old)])
    for r in subsequent[len(old):]:
        s=terms_snapshot(full_history,70)
        gains=[white_log_gain(model_weights(s,BY_NAME[name]),r['white']) for name in picks]
        totals=[a+b for a,b in zip(totals,gains)]
        mixture_log=logmeanexp(totals)
        event={'date':r['date'],'drawing_sha256':sha_of({'date':r['date'],'white':r['white'],'mega':r['mega']}),
               'per_model_log_gain':[round(x,12) for x in gains],
               'cumulative_mixture_log_evalue':round(mixture_log,12),
               'previous_record_hash':prev}
        event['record_hash']=sha_of(event)
        with scorecard.open('a',encoding='utf-8') as stream:
            stream.write(canonical(event)+'\n')
        prev=event['record_hash']
        appended+=1
        full_history.append(r)
    mixture_log=logmeanexp(totals)
    return {'state':'PROSPECTIVE_EVIDENCE_MONITORING',
            'frozen_after_draw':frozen_at,
            'family_size':len(picks),
            'future_scored':len(subsequent),
            'newly_scored':appended,
            'mixture_evalue':round(math.exp(min(mixture_log,690)),8),
            'mixture_log_evalue':round(mixture_log,10),
            'anytime_evidence_threshold':20,
            'evidence_threshold_crossed':mixture_log>=math.log(20),
            'claim':'FUTURE_EVIDENCE_THRESHOLD_CROSSED_NEEDS_INDEPENDENT_REPLICATION' if mixture_log>=math.log(20) else 'NO_VERIFIED_PREDICTIVE_EDGE'}


def publish(out,report,all_scores):
    (out/'latest_report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    (out/'candidate_ledger.json').write_text(json.dumps({'version':SCHEMA,'source_sha256':report['sha256'],
        'note':'Full historical test scores are diagnostics only; selection uses validation scores only. Never rank future choices by posthoc test.',
        'eras':all_scores},indent=2)+'\n',encoding='utf-8')
    lines=['# Fun Industrial — Mathematical Research V3', '',
     '**Evidence-first symbolic hypothesis search, not lottery prediction or purchasing.**','',
     f"Official dataset: {report['draws']} drawings, last {report['last']}  ",
     f"Dataset SHA-256: `{report['sha256']}`  ",
     f"Source stale: {report['stale']}  ",
     f"Candidate equations per eligible period: {report['equations_generated_per_era']}", '',
     '## Rules-period results', '',
     '| Period | Drawings | Positive validation equations | Positive historical-test equations | Selected by validation | Selected test gain |',
     '|---|---:|---:|---:|---|---:|']
    for era,item in report['eras'].items():
        lines.append(f"| {era} | {item['draws']} | {item.get('models_positive_on_validation','—')} | {item.get('models_positive_on_historical_test','—')} | {item.get('selected',item['status'])} | {item.get('selected_test_mean_log_gain','—')} |")
    lines+=['','## Important distinction', '',
     'The fair-random baseline scores exactly zero **by definition**. This does not mean the alternative equations scored zero.',
     'Complete positive and negative validation and historical-test scores for EVERY candidate are in `candidate_ledger.json`.',
     'Historical test rankings are exploratory diagnostics only; an equation is selected based on the earlier validation partition, not the historical test.',
     '', '## Future-only mixture likelihood-ratio evidence', '',
     'Five equations are chosen using validation results and FROZEN before new drawings.',
     'For each future draw, compute each exact normalized model probability divided by fair probability; mix their accumulated likelihood ratios with fixed equal weights.',
     'Under independent fair draws, the positive mixture e-process has a unit-mean martingale property; crossing e=20 at any time has probability at most 5% under that null.',
     'This is valid only with the frozen protocol, no lookahead, fixed game rules, correct probabilities, and no after-the-fact selection.',
     'Crossing an evidence threshold would require independent replication and physical explanations, not imply a practical betting strategy.',
     '', '```json',json.dumps(report['prospective'],indent=2),'```','',
     'Qwen reads bounded reports only when an operator requests them. No tool execution, model training, service restarts, or Elektron access.','']
    (out/'latest_summary.md').write_text('\n'.join(lines),encoding='utf-8')
    with (out/'research_run_ledger.jsonl').open('a',encoding='utf-8') as f:
        f.write(canonical({'sha256':report['sha256'],'utc':report['utc'],'draws':report['draws'],
                           'last':report['last'],'prospective':report['prospective']['state']})+'\n')


def main(argv=None):
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--out',default=str(Path.home()/'AppData'/'Local'/'FunIndustrial'/'MathResearchV3'))
    cli.add_argument('--file',help='Analyze explicitly supplied CSV (no network)')
    cli.add_argument('--offline',action='store_true',help='Cache only, never network')
    cli.add_argument('--force',action='store_true',help='Repeat historical computations')
    args=cli.parse_args(argv)
    out=Path(args.out).resolve()
    out.mkdir(parents=True,exist_ok=True)
    raw,source,stale=load_bytes(out,args.file,args.offline)
    draws=parse(raw)
    digest=hashlib.sha256(raw).hexdigest()
    prev=out/'latest_report.json'
    if prev.exists() and not args.force:
        old=json.loads(prev.read_text(encoding='utf-8'))
        if old.get('version')==SCHEMA and old.get('sha256')==digest and old.get('stale')==stale:
            print('FUN_MATH_V3=UNCHANGED_SOURCE_NO_RECOMPUTE')
            return 0
    report,all_scores=run_research(draws,digest,source,stale)
    if not args.file and not stale:
        (out/'official_source.csv').write_bytes(raw)
    report['prospective']=frozen_future(out,draws,report)
    publish(out,report,all_scores)
    print(f"FUN_MATH_V3=PASS DRAWS={len(draws)} LAST={draws[-1]['date']} STALE={stale}")
    print('V3_EQUATIONS='+str(len(ALL))+' PER_PERIOD FULL_VALIDATION_AND_TEST_SCORE_LEDGER=TRUE')
    print('V3_PROSPECTIVE='+report['prospective']['state'])
    print('V3_REPORT='+str(out/'latest_summary.md'))
    print('FUN_ONLY=TRUE ELEKTRON_TOUCHED=FALSE SERVICES_RESTARTED=FALSE')
    return 0


if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,RuntimeError,KeyError,AssertionError) as exc:
        print('FUN_MATH_V3_HOLD='+str(exc),file=sys.stderr)
        sys.exit(1)