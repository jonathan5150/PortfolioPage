#!/usr/bin/env python3
"""
NBA situational spots against the spread / total, by stretch of seasons
(A 2007-14, B 2015-21, C 2022-26). A spot is only worth betting if it clears
52.4% (the break-even at -110) in every stretch.

Usage: python3 situational_spots.py --data nba.csv
"""
import argparse, importlib.util, os
import pandas as pd, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); a = ap.parse_args()
spec = importlib.util.spec_from_file_location("bt", os.path.join(os.path.dirname(os.path.abspath(__file__)), "backtest_nba.py"))
bt = importlib.util.module_from_spec(spec); spec.loader.exec_module(bt)
D, _ = bt.build(pd.read_csv(a.data, low_memory=False))
D=D[(D.season>=2007)&(D.season<=2025)&D.line.notna()&D.margin.notna()].copy()
D['ats']=D.margin+D.line
D['ou']=D.total-D.total_line
D['hr']=D.rest_diff  # scaled
P={'A':(2007,2014),'B':(2015,2021),'C':(2022,2025)}
def ev(mask, side):
    out=[]
    for k,(a,b) in P.items():
        x=D[mask&(D.season>=a)&(D.season<=b)]
        if side in('home','away'):
            v=x.ats if side=='home' else -x.ats
        else:
            v=x.ou if side=='over' else -x.ou
        v=v[v!=0]; n=len(v); w=(v>0).sum()
        out.append(f"{k}:{w}/{n}={w/n*100:4.1f}%" if n else f"{k}:-")
    return '  '.join(out)
rd=D.rest_diff*3
R={
 'home rest +2 (existing) -> home': (rd>=2,'home'),
 'home rest +1 -> home': (rd>=1,'home'),
 'away rest +2 -> away': (rd<=-2,'away'),
 'away rest +1 -> away': (rd<=-1,'away'),
 'home b2b & away not -> away': ((D.home_b2b==1)&(D.away_b2b==0),'away'),
 'away b2b & home not -> home': ((D.away_b2b==1)&(D.home_b2b==0),'home'),
 'home 3in4 & away not b2b -> away': ((D.home_3in4==1)&(D.away_b2b==0),'away'),
 'away 3in4 & home not b2b -> home': ((D.away_3in4==1)&(D.home_b2b==0),'home'),
 'both b2b -> under': ((D.both_b2b==1),'under'),
 'any b2b -> under': (((D.home_b2b==1)|(D.away_b2b==1)),'under'),
 'away b2b -> under': ((D.away_b2b==1),'under'),
 'home b2b -> under': ((D.home_b2b==1),'under'),
 'home dog -> home': ((D.line>0),'home'),
 'home dog 5+ -> home': ((D.line>=5),'home'),
 'big home fav 10+ -> away': ((D.line<=-10),'away'),
 'big road fav 10+ -> home': ((D.line>=10),'home'),
 'road fav -> home': ((D.line>0)&(D.line<5),'home'),
 'total>=230 -> under': ((D.total_line>=230),'under'),
 'total<=205 -> over': ((D.total_line<=205),'over'),
 'revenge home -> home': ((D.revenge_home==1),'home'),
 'revenge away -> away': ((D.revenge_away==1),'away'),
 'h2h home won>=5/6 -> away (fade)': ((D.h2h_n>=5)&(D.h2h_wins_home>=5),'away'),
 'h2h home won>=5/6 -> home': ((D.h2h_n>=5)&(D.h2h_wins_home>=5),'home'),
 'h2h over 5/6 -> over': ((D.h2h_ou_n>=5)&(D.h2h_overs>=5),'over'),
 'h2h under 5/6 -> under': ((D.h2h_ou_n>=5)&(D.h2h_overs<=1),'under'),
 'home rest+2 & home fav -> home': ((rd>=2)&(D.line<0),'home'),
 'home rest+2 & home dog -> home': ((rd>=2)&(D.line>0),'home'),
 'away b2b & away fav -> home': ((D.away_b2b==1)&(D.home_b2b==0)&(D.line>0),'home'),
 'away b2b & home fav -> home': ((D.away_b2b==1)&(D.home_b2b==0)&(D.line<0),'home'),
 'home b2b & home fav -> away': ((D.home_b2b==1)&(D.away_b2b==0)&(D.line<0),'away'),
 'surprise home hot(>0.5)-> away': ((D.surprise_home>0.5),'away'),
 'surprise away hot -> home': ((D.surprise_away>0.5),'home'),
 'surprise home cold -> home': ((D.surprise_home<-0.5),'home'),
 'surprise away cold -> away': ((D.surprise_away<-0.5),'away'),
 'form home 5-0 ats -> away': ((D.form_home>=0.6),'away'),
 'form away 5-0 -> home': ((D.form_away>=0.6),'home'),
}
for k,(m,s) in R.items(): print(f"{k:38s} {ev(m,s)}")
