"""Selective roofing materializer for the existing Fun Industrial SQLite warehouse.

Reads only whitelisted public fields. No owner identities, marketing, tools or
payments. Incomplete source records cannot count as verified roof history.
Source files are never removed here. Clear exclusions may be pruned after
atomic validation, but uncertain properties always remain available to enrich.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from selective_policy_v3 import property_decision, score_candidate, VERSION

def connect(path):
    c=sqlite3.connect(str(path),timeout=60)
    c.row_factory=sqlite3.Row
    c.execute('PRAGMA busy_timeout=60000')
    c.execute('PRAGMA temp_store=FILE')
    return c

def schema(c):
    c.executescript("""
      CREATE TABLE IF NOT EXISTS roofing_selection_receipt_v3(
        id INTEGER PRIMARY KEY CHECK(id=1),updated_utc TEXT NOT NULL,
        selected INTEGER NOT NULL,held INTEGER NOT NULL,dropped INTEGER NOT NULL,
        source_rows INTEGER NOT NULL,permits_matched INTEGER NOT NULL,
        source_count INTEGER NOT NULL,mode TEXT NOT NULL,note TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS roofing_selection_candidates_v3(
        county TEXT NOT NULL,apn TEXT NOT NULL,city TEXT,zip TEXT,address TEXT,
        year_built INTEGER,last_roof_permit TEXT,priority INTEGER NOT NULL,
        disposition TEXT NOT NULL,reason TEXT NOT NULL,permit_status TEXT NOT NULL,
        coverage TEXT NOT NULL,PRIMARY KEY(county,apn));
      CREATE INDEX IF NOT EXISTS selection_markets_v3 ON
        roofing_selection_candidates_v3(disposition,county,city,zip,priority);
    """)

def source_check(c):
    need={'properties','permits','source_runs'}
    existing={x[0] for x in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not need<=existing:raise ValueError('ROOF_DB_MISSING_V2_INPUT_TABLES')
    n=c.execute("SELECT COUNT(*) FROM source_runs WHERE state='INGESTED_NOT_COMPLETENESS_VERIFIED'").fetchone()[0]
    if not n:raise ValueError('NO_COMPLETED_SOURCE_IMPORTS_RETAIN_EXISTING_DATA')
    return n

def permit_indexes(c):
    # Temporary, indexed aggregations remove N+1 row-by-row permit scans.
    c.executescript("""
      DROP TABLE IF EXISTS temp.roof_latest_apn_v3;
      DROP TABLE IF EXISTS temp.roof_latest_address_v3;
      CREATE TEMP TABLE roof_latest_apn_v3 AS
        SELECT p.county,p.apn,MAX(p.issue_date) AS issued
        FROM permits p JOIN source_runs s ON p.source_id=s.source_id
        WHERE s.state='INGESTED_NOT_COMPLETENESS_VERIFIED' AND p.apn IS NOT NULL AND p.apn!=''
        GROUP BY p.county,p.apn;
      CREATE UNIQUE INDEX temp.roof_latest_apn_v3_key ON roof_latest_apn_v3(county,apn);
      CREATE TEMP TABLE roof_latest_address_v3 AS
        SELECT p.county,p.zip,p.address_key,MAX(p.issue_date) AS issued
        FROM permits p JOIN source_runs s ON p.source_id=s.source_id
        WHERE s.state='INGESTED_NOT_COMPLETENESS_VERIFIED'
          AND p.zip IS NOT NULL AND p.zip!=''
          AND p.address_key IS NOT NULL AND p.address_key!=''
        GROUP BY p.county,p.zip,p.address_key;
      CREATE UNIQUE INDEX temp.roof_latest_address_v3_key ON roof_latest_address_v3(county,zip,address_key);
    """)

def property_rows(c):
    return c.execute("""
      SELECT p.county,p.apn,p.city,p.zip,p.address,p.year_built,p.residential,
        p.use_label,
        CASE WHEN a.issued IS NULL THEN b.issued
             WHEN b.issued IS NULL THEN a.issued
             WHEN a.issued>=b.issued THEN a.issued ELSE b.issued END AS last_roof
      FROM properties p JOIN source_runs s ON p.source_id=s.source_id
      LEFT JOIN roof_latest_apn_v3 a ON a.county=p.county AND a.apn=p.apn
      LEFT JOIN roof_latest_address_v3 b ON b.county=p.county AND b.zip=p.zip
           AND b.address_key=p.address_key AND p.zip IS NOT NULL AND p.zip!=''
      WHERE s.state='INGESTED_NOT_COMPLETENESS_VERIFIED'
      ORDER BY p.county,p.apn
    """)

def select(db_path,*,drop_irrelevant=False):
    """Stage and validate counts before atomic replacement/pruning.

    DROP is restricted to clearly non-house parcels or unusable identifiers.
    HOLD retains missing address/year/property-type records for future joins.
    """
    path=Path(db_path)
    if not path.is_file():raise ValueError('LOCAL_ROOFING_DATABASE_MISSING')
    c=connect(path)
    try:
        schema(c)
        source_count=source_check(c)
        permit_indexes(c)
        c.execute('DROP TABLE IF EXISTS temp.roof_stage_v3')
        c.execute('DROP TABLE IF EXISTS temp.roof_drop_keys_v3')
        c.execute("""CREATE TEMP TABLE roof_stage_v3(
          county TEXT,apn TEXT,city TEXT,zip TEXT,address TEXT,year_built INTEGER,
          last_roof_permit TEXT,priority INTEGER,disposition TEXT,reason TEXT,
          permit_status TEXT,coverage TEXT)""")
        if drop_irrelevant:
            c.execute('CREATE TEMP TABLE roof_drop_keys_v3(county TEXT,apn TEXT,PRIMARY KEY(county,apn))')
        tally={'KEEP':0,'HOLD':0,'DROP':0}
        total=matched=0
        drops=[]
        staged=[]
        today=dt.date.today()
        for p in property_rows(c):
            total+=1
            action,reason=property_decision(year_built=p['year_built'],
                land_use=p['use_label'],residential=p['residential'],
                address=p['address'],zip_code=p['zip'],apn=p['apn'],today=today)
            tally[action]+=1
            if action=='DROP':
                if drop_irrelevant:
                    drops.append((p['county'],p['apn']))
                    if len(drops)>=2000:
                        c.executemany('INSERT INTO roof_drop_keys_v3 VALUES (?,?)',drops)
                        drops.clear()
                continue
            last=p['last_roof']
            matched+=bool(last)
            try:permit_year=int(last[:4]) if last else None
            except (ValueError,TypeError):permit_year=None
            permit_status=('NO_MATCH_IN_IMPORTED_PERMIT_HISTORY' if not last
                else 'ROOF_PERMIT_RECORDED_20_PLUS' if permit_year is not None and today.year-permit_year>=20
                else 'RECENT_ROOF_RELATED_PERMIT_RECORDED')
            score=score_candidate(year_built=p['year_built'],last_roof_permit=last,
                residential=p['residential'],apn=p['apn'],address=p['address'],zip_code=p['zip'],today=today)
            staged.append((p['county'],p['apn'],p['city'],p['zip'],p['address'],
              p['year_built'],last,score,action,reason,permit_status,
              'MUNICIPAL_PERMIT_HISTORY_INCOMPLETE_UNTIL_VERIFIED'))
            if len(staged)>=2000:
                c.executemany('INSERT INTO roof_stage_v3 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',staged)
                staged.clear()
        if staged:c.executemany('INSERT INTO roof_stage_v3 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',staged)
        if drops:c.executemany('INSERT INTO roof_drop_keys_v3 VALUES (?,?)',drops)
        if sum(tally.values())!=total:raise ValueError('SELECTION_COUNTS_MISMATCH')
        count=c.execute('SELECT COUNT(*) FROM roof_stage_v3').fetchone()[0]
        if count!=tally['KEEP']+tally['HOLD']:
            raise ValueError('SELECTION_STAGE_VALIDATION_FAILED')
        # Staging stays separate until verified. All active results swap at once.
        c.commit()
        c.execute('BEGIN IMMEDIATE')
        c.execute('DELETE FROM roofing_selection_candidates_v3')
        c.execute("""INSERT INTO roofing_selection_candidates_v3
          SELECT county,apn,city,zip,address,year_built,last_roof_permit,
            priority,disposition,reason,permit_status,coverage FROM roof_stage_v3""")
        if drop_irrelevant:
            c.execute("""DELETE FROM properties WHERE EXISTS (
              SELECT 1 FROM roof_drop_keys_v3 k
              WHERE k.county=properties.county AND k.apn=properties.apn)""")
        c.execute("""INSERT OR REPLACE INTO roofing_selection_receipt_v3
          VALUES(1,?,?,?,?,?,?,?,?,?)""",(
            dt.datetime.now(dt.timezone.utc).isoformat(),tally['KEEP'],tally['HOLD'],
            tally['DROP'],total,matched,source_count,
            'APPLIED_WITH_DB_PRUNING' if drop_irrelevant else 'MATERIALIZED_NONDESTRUCTIVE',
            'No permit match is not proof of no roof work; city histories may be incomplete'))
        c.commit()
        return {'version':VERSION,'state':'SELECTIVE_INDEX_VERIFIED',
          'selected':tally['KEEP'],'held':tally['HOLD'],'excluded':tally['DROP'],
          'source_rows_examined':total,'permits_matched':matched,
          'pruned_from_original_db':bool(drop_irrelevant),
          'source_count':source_count,'no_permit_is_proof':False}
    except Exception:
        c.rollback()
        raise
    finally:c.close()

def status(db_path):
    path=Path(db_path)
    if not path.is_file():
        return {'version':VERSION,'state':'NO_DATABASE','selected':0,'held':0,'excluded':0}
    c=connect(path)
    try:
        if not c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='roofing_selection_receipt_v3'").fetchone():
            return {'version':VERSION,'state':'NOT_RUN','selected':0,'held':0,'excluded':0}
        r=c.execute('SELECT * FROM roofing_selection_receipt_v3 WHERE id=1').fetchone()
        if r is None:return {'version':VERSION,'state':'NOT_RUN','selected':0,'held':0,'excluded':0}
        return {'version':VERSION,'state':'READY','selected':r['selected'],
          'held':r['held'],'excluded':r['dropped'],'source_rows_examined':r['source_rows'],
          'permits_matched':r['permits_matched'],'source_count':r['source_count'],
          'mode':r['mode'],'updated_utc':r['updated_utc'],
          'interpretation':'Permit history incomplete; no-match is not evidence of no roof replacement'}
    finally:c.close()

def markets(db_path,*,include_holds=False,limit=60,detail=False,county='all',city='',min_age=20,only_no_permit=False):
    path=Path(db_path)
    if not path.is_file():return {'version':VERSION,'state':'NO_DATABASE','rows':[]}
    c=connect(path)
    try:
        if not c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='roofing_selection_candidates_v3'").fetchone():
            return {'version':VERSION,'state':'NOT_RUN','rows':[]}
        if county not in ('all','Los Angeles','San Bernardino'):
            raise ValueError('SELECTION_COUNTY_INVALID')
        if not isinstance(min_age,int) or not 0<=min_age<=120:
            raise ValueError('SELECTION_AGE_FILTER_INVALID')
        if not isinstance(city,str) or len(city)>70:
            raise ValueError('SELECTION_CITY_FILTER_INVALID')
        rules=["1=1"]; params=[]
        if not include_holds:rules.append("disposition='KEEP'")
        if county!='all':
            rules.append("county=?");params.append(county)
        if city:
            rules.append("city LIKE ?");params.append(city+'%')
        if min_age:
            rules.append("(year_built IS NULL OR year_built <= ?)")
            params.append(dt.date.today().year-min_age)
        if only_no_permit:
            rules.append("permit_status='NO_MATCH_IN_IMPORTED_PERMIT_HISTORY'")
        where='WHERE '+' AND '.join(rules)
        if detail:
            rows=c.execute(f"""SELECT county,apn,city,zip,address,year_built,
               last_roof_permit,priority,disposition,reason,permit_status AS status
               FROM roofing_selection_candidates_v3 {where}
               ORDER BY priority DESC,county,zip LIMIT ?""",(*params,min(100,max(1,limit)))).fetchall()
        else:
            rows=c.execute(f"""SELECT county,city,zip,COUNT(*) AS candidates,
                SUM(CASE WHEN permit_status='NO_MATCH_IN_IMPORTED_PERMIT_HISTORY'
                  THEN 1 ELSE 0 END) AS no_permit_observed,
                SUM(CASE WHEN permit_status='ROOF_PERMIT_RECORDED_20_PLUS'
                  THEN 1 ELSE 0 END) AS old_roof_permit,
                ROUND(AVG(priority),1) AS mean_review_priority
               FROM roofing_selection_candidates_v3 {where}
               GROUP BY county,city,zip ORDER BY candidates DESC,mean_review_priority DESC
               LIMIT ?""",(*params,min(100,max(1,limit)))).fetchall()
        return {'version':VERSION,'state':'READY','rows':[dict(r) for r in rows],
            'read_only':True,'completeness':'MUNICIPAL_PERMIT_HISTORY_UNVERIFIED'}
    finally:c.close()

def main():
    parser=argparse.ArgumentParser(description='Local selective roofing extraction')
    parser.add_argument('--db',required=True)
    cmds=parser.add_subparsers(dest='cmd',required=True)
    cmds.add_parser('status')
    for cmd in ('markets','candidates'):
        p=cmds.add_parser(cmd);p.add_argument('--include-holds',action='store_true')
        p.add_argument('--county',default='all')
        p.add_argument('--city',default='')
        p.add_argument('--min-age',type=int,default=20)
        p.add_argument('--only-no-permit',action='store_true')
    p=cmds.add_parser('apply');p.add_argument('--prune-confirmed-exclusions',action='store_true')
    args=parser.parse_args()
    if args.cmd=='apply':out=select(args.db,drop_irrelevant=args.prune_confirmed_exclusions)
    elif args.cmd=='status':out=status(args.db)
    else:out=markets(args.db,include_holds=args.include_holds,detail=args.cmd=='candidates',
      county=args.county,city=args.city,min_age=args.min_age,
      only_no_permit=args.only_no_permit)
    print(json.dumps(out,sort_keys=True))

if __name__=='__main__':
    try:main()
    except (OSError,ValueError,sqlite3.Error) as exc:
        import sys
        print('FUN_ROOFING_SELECTIVE_HOLD='+str(exc)[:240],file=sys.stderr)
        sys.exit(1)
