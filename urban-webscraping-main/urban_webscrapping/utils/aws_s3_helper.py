import json
import os
from io import BytesIO

import boto3
import pyarrow as pa
import pyarrow.parquet as pq
from botocore.config import Config as BotoConfig
from dotenv import load_dotenv

load_dotenv()

ASSUME_ROLE_ARN = os.getenv("ASSUME_ROLE_ARN")
ASSUME_ROLE_EXTERNAL_ID = os.getenv("ASSUME_ROLE_EXTERNAL_ID")

aws_urban_config = BotoConfig(
    region_name='us-west-2',
    retries={
        "max_attempts" : 5
    }
)

def _building_s3_client():
    session = boto3.Session(region_name='us-west-2')
    if ASSUME_ROLE_ARN:
        sts = session.client('sts', config=aws_urban_config)
        resp = sts.assume_role(
            RoleArn = ASSUME_ROLE_ARN,
            RoleSessionName="scrappy-dump",
            ExternalId=ASSUME_ROLE_EXTERNAL_ID,
            DurationSeconds=1800
        )
        creds = resp['Credentials']
        
        return boto3.client(
            "s3",
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
            config=aws_urban_config,
            region_name='us-west-2',
        )
        
    return session.client("s3", config=aws_urban_config)


class S3Helper:
    def __init__(self):
        self.client = _building_s3_client()
        
    def put_object_json(self, bucket_name: str, object_name: str, data: dict, kms_key_id: str | None = None) -> None:
        body = json.dumps(data, default=str, ensure_ascii=False).encode("utf-8")

        self.client.put_object(
            Bucket=bucket_name, 
            Key=object_name, 
            Body=body,
            ContentType="application/json"
            )
    
    def put_object_parquet(self, bucket_name: str, object_name: str, data) -> None:
        record = data
        table = pa.Table.from_pylist([record])
        buf = BytesIO()
        pq.write_table(table, buf, compression="snappy")   # write Parquet into memory
        buf.seek(0)
        body = buf.getvalue()
        
        self.client.put_object(
            Bucket=bucket_name, 
            Key=object_name, 
            Body=body,
            ContentType="application/vnd.apache.parquet"
            )