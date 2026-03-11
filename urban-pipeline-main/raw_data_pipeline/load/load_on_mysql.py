import pandas as pd
from prefect import task

from raw_data_pipeline.config import logging_config, setup_database_from_prefect

log = logging_config.get_logger(__name__)


@task
def load_dataframe_to_mysql(
    df: pd.DataFrame,
    table_name: str,
    if_exists: str = "append",
    create_table: bool = True,
) -> int:
    """
    Load a pandas DataFrame directly to MySQL table.

    Args:
        df: DataFrame to insert into MySQL
        table_name: Target MySQL table name
        if_exists: How to behave if table exists ('append', 'replace', 'fail')
        create_table: Whether to create table if it doesn't exist

    Returns:
        int: Number of rows inserted
    """
    if df.empty:
        log.warning(f"DataFrame is empty, skipping insert to {table_name}")
        return 0

    try:
        db_config = setup_database_from_prefect("mysql-bronze-url")

        engine = db_config.get_engine()

        log.info(f"Loading {len(df)} rows to table '{table_name}'")

        rows_inserted = df.to_sql(
            name=table_name,
            con=engine,
            if_exists=if_exists,
            index=False,
            method="multi",
            chunksize=1000,
        )

        actual_rows = len(df) if rows_inserted is None else rows_inserted

        log.info(f"Successfully loaded {actual_rows} rows to '{table_name}'")
        return actual_rows

    except Exception as e:
        log.error(f"Failed to load DataFrame to MySQL table '{table_name}': {e}")
        raise


@task(name="Load Data to MySQL")
def load_multiple_dataframes_to_mysql(
    dataframes: list[pd.DataFrame], table_name: str, if_exists: str = "append"
) -> int:
    """
    Load multiple DataFrames to the same MySQL table.

    Args:
        dataframes: List of DataFrames to insert
        table_name: Target MySQL table name
        if_exists: How to behave if table exists ('append', 'replace', 'fail')

    Returns:
        int: Total number of rows inserted
    """
    total_rows = 0

    if not dataframes:
        log.warning("No DataFrames provided for loading")
        return 0

    log.info(f"Loading {len(dataframes)} DataFrames to table '{table_name}'")

    for i, df in enumerate(dataframes):
        if df.empty:
            log.warning(f"DataFrame {i + 1} is empty, skipping")
            continue

        current_if_exists = if_exists if i == 0 else "append"

        rows = load_dataframe_to_mysql(
            df=df,
            table_name=table_name,
            if_exists=current_if_exists,
            create_table=(i == 0),
        )
        total_rows += rows

        log.info(f"Loaded DataFrame {i + 1}/{len(dataframes)}: {rows} rows")

    log.info(f"Total rows loaded to '{table_name}': {total_rows}")
    return total_rows
