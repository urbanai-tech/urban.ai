"""Loaders for processing scraped items in the Urban webscraping project."""

from itemloaders.processors import TakeFirst
from scrapy.loader import ItemLoader


class EventLoader(ItemLoader):
    """EventLoader is a custom ItemLoader for processing event data in a Scrapy project.

    Attributes:
        default_output_processor (TakeFirst): Ensures that only the first value from extracted data is used for each field.

    Usage:
        Use EventLoader to load and process scraped event items, automatically applying the TakeFirst processor to all fields.
    """

    default_output_processor = TakeFirst()
