"""This module contains code for scraping São Paulo's ticket events information from Even3."""

from scrapy.http import Response
from scrapy.linkextractors import LinkExtractor
from scrapy.spiders import CrawlSpider, Rule

from urban_webscrapping.items import EventItem
from urban_webscrapping.loaders import EventLoader


class EvenThreeSpider(CrawlSpider):
    """Spider for scraping event information from the Even3 website.

    This spider navigates event listing pages on www.even3.com.br, following links to individual event pages,
    and extracts relevant details such as event name, image URL, page URL, date, and location. The extraction
    is performed using a set of helper methods that populate an EventItem via an EventLoader.

    Attributes:
        name (str): The name of the spider.
        allowed_domains (list): List of allowed domains for crawling.
        start_urls (list): Initial URLs to begin crawling.
        rules (list): CrawlSpider rules for following event links.

    Methods:
        parse(response): Parses an event page and extracts event details.
        _parse_name(loader): Extracts the event name.
        _parse_image_url(loader): Extracts the event image URL.
        _parse_page_url(response, loader): Adds the current page URL.
        _parse_location(response, loader): Extracts the event location/address.
        _parse_date(response, loader): Extracts the event start and end dates.
    """

    name = "even3"
    allowed_domains = ["www.even3.com.br"]
    start_urls = [
        "https://www.even3.com.br/eventos?todos=true&location=sao%20paulo&country=BR&state=sp&city=sao-paulo"
    ]
    rules = [
        Rule(LinkExtractor(allow=r"[?&]even3_orig=events_eventlist$"), callback="parse")
    ]

    def parse(self, response: Response) -> EventItem:
        """Parses the response from an event page and extracts relevant event information.

        This method uses a series of helper methods to populate an EventItem with data such as
        the event's name, image URL, page URL, date, and location. The extracted data is loaded
        into an EventItem using an EventLoader.

        Args:
            response (Response): The HTTP response object containing the event page's HTML content.

        Returns:
            EventItem: An item populated with the extracted event details.
        """
        loader = EventLoader(item=EventItem(), response=response)
        loader = self._parse_name(loader)
        loader = self._parse_image_url(loader)
        loader = self._parse_page_url(response, loader)
        loader = self._parse_date(response, loader)
        loader = self._parse_location(response, loader)
        return loader.load_item()

    @staticmethod
    def _parse_name(loader: EventLoader) -> EventLoader:
        loader.add_xpath("name", "/html/body/div[3]/div/div/div/div[1]/h1/text()")
        return loader

    @staticmethod
    def _parse_image_url(loader: EventLoader) -> EventLoader:
        loader.add_xpath("image_url", "/html/body/div[2]/img/@src")
        return loader

    @staticmethod
    def _parse_page_url(response: Response, loader: EventLoader) -> EventLoader:
        loader.add_value("page_url", response.url)
        return loader

    @staticmethod
    def _parse_location(response: Response, loader: EventLoader) -> EventLoader:
        locations = response.xpath('//*[@id="evento_presencial"]//text()').getall()
        address = "".join(locations).strip()
        loader.add_value("address", address)
        return loader

    @staticmethod
    def _parse_date(response: Response, loader: EventLoader) -> EventLoader:
        dates = response.xpath('//*[@id="horarios"]//span[@id]/text()').getall()[:2]
        if dates:
            dates = [date.replace("–", " ").strip() for date in dates]
            loader.add_value("start_date", dates[0])
            loader.add_value("end_date", dates[1])
        return loader
