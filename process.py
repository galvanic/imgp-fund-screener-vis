#! /bin/env/python3

'''
'''

import sys

## dependencies libraries to install:
import numpy as np
import pandas as pd


FP_HISTORICAL_DATA = './raw_data/historical_data.csv'
FP_METADATA = './raw_data/ptf_metadata.xlsx'

## HELPER FUNCTIONS

remove_unnamed = lambda lst: filter(lambda x: 'unnamed' not in x, lst)
remove_ms_classification = lambda df: df.iloc[1:]


def tidy_name(text):

    text = (text
        .strip()
        .lower()
        .replace(' ', '_')
        .replace('/', '_')
        )

    return text

def remove_irrelevant_values(df):

    df = df.copy()
    df.loc[ df['source'].isin([ 'bench', 'category' ]), [ 'isin', 'asset_type' ]] = np.nan

    return df

def flatten_columns(df, sep='_'):

    df.columns = [ sep.join(remove_unnamed(levels)) for levels in df.columns ]

    return df

def unflatten_columns(df):

    df.columns = pd.MultiIndex.from_tuples(
        tuples=[ col.split('_') for col in df.columns ],
        names=('source', 'variable'),
        )

    return df

## DATA PARSERS

def parse_weekly_data(fp_weekly_data):

    df = (pd.read_excel(fp_weekly_data, header=(6, 7, 8, 9), sheet_name='Sheet1')
        .dropna(axis='columns', how='all')
        .rename(columns=tidy_name)
        .rename_axis(columns=[ 'period_length', 'start_date', 'end_date', 'variable' ])
        )

    end_dates = list(set(remove_unnamed(df.columns.get_level_values('end_date'))))
    assert len(end_dates) == 1
    end_date = end_dates[0]

    start_dates = sorted(set(remove_unnamed(df.columns.get_level_values('start_date'))))
    assert len(start_dates) == 3
    start_dates = dict(zip([ 5, 3, 1 ], start_dates))

    dfs = np.split(df, df[df.isnull().all(axis='columns')].index)
    dfs = list(filter(lambda df: not df.empty, dfs))
    dfs = [ df.dropna(axis='rows', how='all').pipe(remove_ms_classification) for df in dfs ]

    df_weekly = (pd.concat(objs=[ dfs[0], *dfs[1:] ], axis='rows')
         .droplevel([ 'start_date', 'end_date' ], axis='columns')
         .pipe(flatten_columns, sep='.')
         .rename(axis='columns', mapper={ 'secid': 'mstarcode' })
         .melt(id_vars=[ 'group_investment', 'isin', 'mstarcode', 'base_currency', ],
               value_vars=[ '1_year.return', '3_year.return', '5_year.return',
                            '1_year.std_dev', '3_year.std_dev', '5_year.std_dev', ],
             )
         .assign(period_length_yrs=lambda df: df['variable'].str.split(pat='_').str.get(0).astype(int))
         .assign(variable=lambda df: df['variable'].str.split(pat='.').str.get(-1).map({
             'return': 'performance',
             'std_dev': 'volatility',
             }))

         .reset_index(drop=True)
         .assign(group_investment=lambda df: df['group_investment'].str.replace('Benchmark 1: ', ''))

         .assign(end_date=pd.to_datetime(end_date.replace('_', '-')))
         .assign(start_date=lambda df: (df['period_length_yrs']
             .map(start_dates)
             .str.replace('_', '-')
             .astype('datetime64[ns]')
             ))
         )

    return df_weekly

def parse_historical_data():

    df_historical = (pd.read_csv(FP_HISTORICAL_DATA, header=0, sep=';')
        .rename(columns=tidy_name)
        [[ 'code', 'end_date', 'perf_y1', 'perf_y3', 'perf_y5', 'vol_y1', 'vol_y3', 'vol_y5' ]]
        .rename({ 'code': 'mstarcode' }, axis='columns')
        .assign(end_date=lambda df: df['end_date'].astype('datetime64[ns]'))

        .melt(id_vars=[ 'mstarcode', 'end_date' ],
              value_vars=[ 'perf_y1', 'perf_y3', 'perf_y5', 'vol_y1', 'vol_y3', 'vol_y5' ],
            )
        .assign(period_length_yrs=lambda df: df['variable'].str.split(pat='y').str.get(-1).astype(int))
        .assign(variable=lambda df: df['variable'].str.split(pat='_').str.get(0).map({
            'perf': 'performance',
            'vol': 'volatility',
            }))

        .assign(start_date=lambda df: df['end_date'] - (pd.Timedelta('365 days') * df['period_length_yrs']))
        .assign(value=lambda df: df['value'].str.replace('%', '').astype(float))
        )

    return df_historical

def concat_datasets(df_weekly, df_historical):

    df_data = (pd.concat(axis='rows', objs=[ df_weekly, df_historical ])
        .set_index([ 'group_investment', 'isin', 'mstarcode', 'base_currency',
                     'period_length_yrs', 'end_date', 'start_date',
                     'variable' ])
        .unstack('variable')
        .droplevel(0, axis='columns')
        .reset_index(drop=False)
        .drop(axis='columns', labels=[ 'group_investment', 'base_currency', 'isin', ])
        )

    return df_data

def main(fp_weekly_data):

    df_weekly = parse_weekly_data(fp_weekly_data)
    df_historical = parse_historical_data()
    df_data = concat_datasets(df_weekly, df_historical)

    df_final = (pd.read_excel(FP_METADATA, sheet_name='Sheet1', header=0)
        [[ 'fund_type', 'share_isin',
           'share_mstarcode',
           'bench_mstarcode',
           'category_mstarcode',
           'share_name',
           'bench_name',
           'category_name',
           ]]
        .rename({ 'share_isin': 'isin' }, axis='columns')
        .assign(asset_type=lambda df: df['fund_type'].str.lower().str.replace(' ', '_'))
        .drop(labels='fund_type', axis='columns', errors='ignore')
        .assign(category_mstarcode=lambda df: df['category_mstarcode'].apply(lambda x: x.split(';')[0]))
        .replace('MIL', np.nan)

        ## this index becomes the grouping_id
        .rename_axis('grouping_id', axis='index')
        .reset_index(drop=False)
        .set_index([ 'grouping_id', 'isin', 'asset_type' ])
        .pipe(unflatten_columns)
        .stack('source')
        .reset_index(drop=False)
        .pipe(remove_irrelevant_values)

        .merge(df_data, how='outer', left_on='mstarcode', right_on='mstarcode')
        )

    csv_string = (df_final
        .dropna(subset=[ 'period_length_yrs', 'performance', 'volatility' ], how='any')
        .to_csv(path_or_buf=None, index=False)
        )

    return csv_string


if __name__ == '__main__':

    if len(sys.argv) > 1:
        fp_weekly_data = sys.argv[1]
    else:
        sys.exit('\nPlease specify an input file as argument to the script.')

    csv_string = main(fp_weekly_data)
    print(csv_string)

