from enum import StrEnum


class DataStorage(StrEnum):
    AWS = "s3://urban-ai"
    LOCAL = "file://data"


class Schedule(StrEnum):
    THURSDAY_AT_3_AM = "0 3 * * 4"
