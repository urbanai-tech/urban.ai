import pandas as pd
from prefect import task

from raw_data_pipeline.config import logging_config
from raw_data_pipeline.utils.aws_helper import S3Helper

log = logging_config.get_logger(__name__)


class S3Extractor:
    """
    S3 data extractor for raw data pipeline.

    This class provides methods to extract data from S3 buckets and convert
    it to pandas DataFrames for further processing.
    """

    def __init__(self):
        """Initialize S3Extractor with S3Helper."""
        self.s3_helper = S3Helper()
        log.info("S3Extractor initialized")

    def list_folders(self) -> list[str]:
        """
        List all folders in the S3 bucket under the configured path.

        Returns:
            list[str]: List of folder names (without path prefix)
        """
        try:
            folders = self.s3_helper.list_spiders_folders()
            # Extract just the folder names from full paths
            folder_names = []
            for folder_path in folders:
                if folder_path.endswith("/"):
                    # Extract folder name from path like 'raw_data/parquet/folder_name/'
                    folder_name = folder_path.rstrip("/").split("/")[-1]
                    if folder_name:  # Skip empty names
                        folder_names.append(folder_name)

            log.info(f"Found {len(folder_names)} folders: {folder_names}")
            return folder_names

        except Exception as e:
            log.error(f"Failed to list folders: {e}")
            return []

    def get_dataframes_from_folder(self, folder_name: str) -> list[pd.DataFrame]:
        """
        Extract all DataFrames from a specific folder.

        Args:
            folder_name: Name of the folder to extract data from

        Returns:
            list[pd.DataFrame]: List of DataFrames from the folder
        """
        try:
            log.info(f"Extracting data from folder: {folder_name}")

            # Get raw bytes data from S3
            data = self.s3_helper.get_data_from_s3(folder_name)

            if not data:
                log.warning(f"No data found in folder: {folder_name}")
                return []

            dataframes = []
            for filename, byte_content in data.items():
                try:
                    # Convert bytes to DataFrame
                    df = pd.read_parquet(pd.io.common.BytesIO(byte_content))
                    dataframes.append(df)
                    log.info(f"Extracted {len(df)} records from {filename}")

                except Exception as file_error:
                    log.error(f"Failed to read {filename}: {file_error}")
                    continue

            log.info(
                f"Successfully extracted {len(dataframes)} DataFrames "
                f"from {folder_name}"
            )
            return dataframes

        except Exception as e:
            log.error(f"Failed to extract data from folder {folder_name}: {e}")
            return []


@task(name="Extract Data from S3")
def extract_from_s3(folder_names: list[str]) -> list[pd.DataFrame] | None:
    """
    Legacy function for extracting data from multiple S3 folders.

    Args:
        folder_names: List of folder names to extract data from

    Returns:
        list[pd.DataFrame] | None: Combined list of DataFrames or None if no data

    Note:
        This function is kept for backward compatibility.
        Consider using S3Extractor class for new implementations.
    """
    s3_extractor = S3Extractor()
    all_dataframes = []

    try:
        for folder_name in folder_names:
            dataframes = s3_extractor.get_dataframes_from_folder(folder_name)
            all_dataframes.extend(dataframes)

        return all_dataframes if all_dataframes else None

    except Exception as e:
        log.error(f"Error during extraction: {e}")
        return None
