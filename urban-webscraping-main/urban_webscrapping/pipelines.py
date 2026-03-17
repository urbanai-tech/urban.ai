"""Pipelines for processing and storing scraped event items.

This module provides Scrapy pipelines for:
- Dropping invalid or irrelevant event items,
- Filtering items based on their content,
- Storing valid event items into a MySQL database.
"""

import re
from datetime import datetime
from os import getenv
from urllib.parse import urlparse

from dotenv import load_dotenv
from itemadapter import ItemAdapter
from mysql.connector import connect as create_connection
from scrapy import Spider
from scrapy.exceptions import DropItem

from urban_webscrapping.utils.aws_s3_helper import S3Helper

from .items import EventItem

load_dotenv()


class S3ItemPipelineJson:
    def __init__(self):
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/json/{spider_name}/{today}.json"

        response = self.s3.put_object_json(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        print(response)

        return item


class S3ItemPipelineParquet:
    def __init__(self):
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket in Parquet format."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/parquet/{spider_name}/{today}.parquet"

        response = self.s3.put_object_parquet(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        print(response)

        return item
