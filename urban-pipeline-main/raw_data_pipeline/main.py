from prefect import flow

from raw_data_pipeline import config
from raw_data_pipeline.extractors.s3_extractor import S3Extractor
from raw_data_pipeline.load.load_on_mysql import load_multiple_dataframes_to_mysql

log = config.get_logger(__name__)


@flow(name="Raw Data Pipeline Main Flow")
def main() -> None:
    """
    Main pipeline flow for processing raw data from S3 to MySQL.

    This flow:
    1. Lists all folders in S3
    2. Extracts DataFrames from each folder
    3. Loads DataFrames to MySQL with folder name as table name
    """
    try:
        config.setup_logging(log_level="INFO")
        log.info("Starting Raw Data Pipeline")

        s3_extractor = S3Extractor()

        folders = s3_extractor.list_folders()

        if not folders:
            log.warning("No folders found in S3 bucket")
            return

        log.info(f"Found {len(folders)} folders to process: {folders}")

        total_processed = 0
        for folder in folders:
            try:
                log.info(f"Processing folder: {folder}")

                dataframes = s3_extractor.get_dataframes_from_folder(folder)
                if dataframes:
                    table_name = folder.replace("-", "_").replace(" ", "_").lower()

                    total_rows = load_multiple_dataframes_to_mysql(
                        dataframes=dataframes, table_name=table_name, if_exists="append"
                    )

                    log.info(
                        f"Successfully loaded {total_rows} rows from folder "
                        f"{folder} to table {table_name}"
                    )
                    total_processed += 1

                else:
                    log.warning(f"No data found in folder {folder}")

            except Exception as folder_error:
                log.error(f"Failed to process folder {folder}: {folder_error}")
                continue

        log.info(
            f"Pipeline completed. Successfully processed "
            f"{total_processed}/{len(folders)} folders"
        )

    except Exception as e:
        log.error(f"Pipeline failed with error: {e}")
        raise


if __name__ == "__main__":
    main()
