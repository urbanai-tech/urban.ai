"""Defines Scrapy Item classes and utility functions for event web scraping."""

import dateparser
from itemloaders.processors import MapCompose  # Join
from scrapy import Field, Item


def clean_nbsp(value: str) -> str:
    r"""Replaces non-breaking space characters ('\xa0') in the input string with regular spaces and strips leading/trailing whitespace.

    Args:
        value (str): The input string to clean.

    Returns:
        str: The cleaned string with non-breaking spaces replaced by regular spaces and whitespace trimmed.
    """
    return value.replace("\xa0", " ").strip()


class EventItem(Item):
    """EventItem defines the data structure for storing event information scraped from websites.

    Attributes:
        linkSiteOficial (Field): The official website link of the event.
        imagem_url (Field): The URL of the event's image.
        enderecoCompleto (Field): The complete address where the event takes place.
        nome (Field): The name of the event.
        cidade (Field): The city where the event is held.
        estado (Field): The state where the event is held.
        dataFim (Field): The end date of the event, parsed using dateparser.
        dataInicio (Field): The start date of the event, parsed using dateparser.
    """

    linkSiteOficial = Field()
    imagem_url = Field()
    # description = Field(input_processor=MapCompose(clean_nbsp), output_processor=Join())
    enderecoCompleto = Field()
    nome = Field()
    cidade = Field()
    estado = Field()
    dataFim = Field(input_processor=MapCompose(dateparser.parse))
    dataInicio = Field(input_processor=MapCompose(dateparser.parse))
