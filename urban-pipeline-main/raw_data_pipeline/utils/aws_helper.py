"""This code serves as a helper for AWS operations."""

from collections.abc import Iterator
from io import BytesIO
from typing import Any

import boto3
import pandas as pd
from botocore.config import Config as BotoConfig

from raw_data_pipeline import config

log = config.get_logger(__name__)
aws_urban_config = BotoConfig(region_name="us-west-2", retries={"max_attempts": 5})
MAX_PARQUET_FILES = 3


def _building_s3_client() -> boto3.client:
    session = boto3.Session(region_name="us-west-2")
    if config.Settings().assume_role_arn:
        sts = session.client("sts", config=aws_urban_config)
        resp = sts.assume_role(
            RoleArn=config.Settings().assume_role_arn,
            RoleSessionName=config.Settings().role_session_name,
            ExternalId=config.Settings().assume_role_external_id,
            DurationSeconds=1800,
        )
        creds = resp["Credentials"]

        return boto3.client(
            "s3",
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
            config=aws_urban_config,
            region_name="us-west-2",
        )

    return session.client("s3", config=aws_urban_config)


class S3Helper:
    """Read raw parquet objects from the configured Urban AI S3 bucket."""

    def __init__(self) -> None:
        self.client = _building_s3_client()
        self.bkt_name = "urban-ai-data"
        self.path_to_folder_data = "raw_data/parquet/"

    def list_spiders_folders(self) -> list[str]:
        """List object prefixes and keys below the raw-data folder."""
        folders = []
        for response in self._list_pages(self.path_to_folder_data, delimiter="/"):
            for prefix in response.get("CommonPrefixes", []):
                folder_path = prefix.get("Prefix")
                if folder_path:
                    folders.append(folder_path)
            for content in response.get("Contents", []):
                folder_path = content.get("Key")
                if folder_path:
                    folders.append(folder_path)
        return list(dict.fromkeys(folders))

    def _list_pages(
        self, prefix: str, delimiter: str | None = None
    ) -> Iterator[dict[str, Any]]:
        """Read every S3 page, failing if continuation cannot make progress."""
        params = {"Bucket": self.bkt_name, "Prefix": prefix}
        if delimiter:
            params["Delimiter"] = delimiter
        seen_tokens: set[str] = set()
        while True:
            response = self.client.list_objects_v2(**params)
            yield response
            if not response.get("IsTruncated", False):
                return
            token = response.get("NextContinuationToken")
            if not isinstance(token, str) or not token or token in seen_tokens:
                raise RuntimeError(
                    "S3 listing is truncated without a valid new continuation token"
                )
            seen_tokens.add(token)
            params["ContinuationToken"] = token

    def iter_parquet_objects(self, folder_name: str) -> Iterator[tuple[str, bytes]]:
        """Stream complete object keys and bytes without truncation or basename collisions.

        Consumers must commit an ingestion receipt together with database rows
        before using this iterator to replace the legacy append-only loader.
        """
        clean = folder_name.strip("/")
        if not clean or "/" in clean or clean in {".", ".."}:
            raise ValueError("Expected one spider folder name")
        prefix = f"{self.path_to_folder_data}{clean}/"
        seen_keys: set[str] = set()
        for page in self._list_pages(prefix):
            for item in page.get("Contents", []):
                key = item.get("Key")
                if not isinstance(key, str) or not key.startswith(prefix):
                    raise RuntimeError("S3 listing returned an invalid object key")
                if not key.endswith(".parquet"):
                    continue
                if key in seen_keys:
                    raise RuntimeError("S3 listing repeated an object key")
                seen_keys.add(key)
                body = self.client.get_object(Bucket=self.bkt_name, Key=key)["Body"]
                try:
                    content = body.read()
                finally:
                    body.close()
                yield key, content

    def get_data_from_s3(self, folder_event_path: str) -> dict[str, bytes] | None:
        """Get the first three parquet files from an S3 folder as raw bytes."""
        try:
            folder_path = self.path_to_folder_data + folder_event_path
            response = self.client.list_objects_v2(
                Bucket=self.bkt_name, Prefix=folder_path
            )

            if "Contents" not in response:
                return None

            parquet_files = {}
            count = 0

            for file_obj in response["Contents"]:
                if file_obj["Key"].endswith(".parquet"):
                    file_response = self.client.get_object(
                        Bucket=self.bkt_name, Key=file_obj["Key"]
                    )
                    file_content = file_response["Body"].read()

                    filename = file_obj["Key"].split("/")[-1]
                    parquet_files[filename] = file_content

                    count += 1
                    if count == MAX_PARQUET_FILES:
                        break

            return parquet_files if parquet_files else None

        except Exception as e:
            log.error(f"Error reading folder {folder_path}: {e}")
            raise

    def read_parquet_to_dataframe(self, bucket: str, key: str) -> pd.DataFrame:
        """Read a parquet file from S3 directly into a pandas DataFrame.

        Args:
            bucket: S3 bucket name
            key: S3 object key (path to parquet file)

        Returns:
            pd.DataFrame: DataFrame containing the parquet data

        Raises:
            Exception: If file cannot be read or doesn't exist
        """
        try:
            # Get the parquet file from S3
            response = self.client.get_object(Bucket=bucket, Key=key)

            # Read the content into a BytesIO buffer
            parquet_buffer = BytesIO(response["Body"].read())

            # Read parquet data into DataFrame
            df = pd.read_parquet(parquet_buffer)

            return df

        except Exception as e:
            log.error(f"Error reading parquet file s3://{bucket}/{key}: {e}")
            raise

    def read_multiple_parquet_to_dataframe(
        self, bucket: str, prefix: str, max_files: int | None = None
    ) -> list[pd.DataFrame]:
        """Read multiple parquet files from S3 folder into a list of DataFrames.

        Args:
            bucket: S3 bucket name
            prefix: S3 prefix (folder path)
            max_files: Maximum number of files to read (None for all)

        Returns:
            list[pd.DataFrame]: List of DataFrames from parquet files
        """
        try:
            # List objects in the prefix
            response = self.client.list_objects_v2(Bucket=bucket, Prefix=prefix)

            if "Contents" not in response:
                return []

            dataframes = []
            count = 0

            for file_obj in response["Contents"]:
                if file_obj["Key"].endswith(".parquet"):
                    try:
                        df = self.read_parquet_to_dataframe(bucket, file_obj["Key"])
                        dataframes.append(df)
                        count += 1

                        if max_files and count >= max_files:
                            break

                    except Exception as e:
                        log.warning(
                            f"Skipping file {file_obj['Key']} due to error: {e}"
                        )
                        continue

            return dataframes

        except Exception as e:
            log.error(f"Error reading parquet files from s3://{bucket}/{prefix}: {e}")
            raise
