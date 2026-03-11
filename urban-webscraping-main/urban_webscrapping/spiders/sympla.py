"""This module contains code for scraping São Paulo's ticket events information from Sympla."""

import re
from collections.abc import AsyncIterator
from pathlib import Path
from typing import LiteralString
from urllib.parse import urlparse

from scrapy import Request, Spider
from scrapy.http import Response
from scrapy.http.response.json import JsonResponse
from scrapy.linkextractors import LinkExtractor
from scrapy_playwright.page import PageMethod

from urban_webscrapping.items import EventItem
from urban_webscrapping.loaders import EventLoader


class SymplaSpider(Spider):
    """Spider for scraping event data from Sympla's São Paulo events page.

    This spider crawls event pages on Sympla
    and extracts relevant event information such as name, image URL, page URL, description, date, and location.

    Attributes:
        name (str): Name of the spider.
        allowed_domains (list): List of allowed domains for crawling.
        start_urls (list): Initial URLs to begin crawling.
        rules (list): CrawlSpider rules for following event links.

    Methods:
        parse(response: Response) -> EventItem:
            Main parsing method that populates an EventItem with event data.
    """

    name = "sympla"
    allowed_domains = [
        "www.sympla.com.br",
        "bff-sales-api-cdn.bileto.sympla.com.br",
        "event-page.svc.sympla.com.br",
        "bileto.sympla.com.br",
    ]
    custom_settings = {
        "PLAYWRIGHT_ENABLED": True,
    }

    async def start(self) -> AsyncIterator[Request]:
        """Asynchronously initiates the scraping process by yielding a Scrapy Request to the BlueTicket search page for events in São Paulo, SP.

        The request is configured to use Playwright for JavaScript rendering, waits for event links to appear on the page, and includes an error callback.

        Yields:
            AsyncIterator[Request]: An asynchronous iterator yielding a Scrapy Request object configured
            for Playwright integration and event link detection.
        """
        url = "https://www.sympla.com.br/eventos/sao-paulo-sp/todos-eventos?page=1"
        selector = (
            "body > main > div > div._1birs5v3 > div > div._1xzb3su0 > div.swraze0"
        )
        metadata = {
            "playwright": True,
            "playwright_include_page": True,
            "errback": self.errback,
            "playwright_page_methods": [PageMethod("wait_for_selector", selector)],
        }
        yield Request(url, meta=metadata, callback=self.parse)

    async def errback(self, failure) -> None:
        """Handles errors during the request by closing the associated Playwright page.

        Args:
            failure: The failure object containing information about the request error.

        Returns:
            None

        This method is intended to be used as an error callback in asynchronous web scraping tasks.
        It retrieves the Playwright page from the request's metadata and ensures it is properly closed to free resources.
        """
        page = failure.request.meta["playwright_page"]
        await page.close()

    async def parse(self, response: Response) -> AsyncIterator[Request]:
        """Parses the event details from the given response and returns a populated EventItem.

        This method uses an EventLoader to extract and populate various fields of an event,
        including name, image URL, page URL, description, date, and location, by delegating
        to specialized parsing helper methods.

        Args:
            response (Response): The HTTP response object containing the event page to parse.

        Returns:
            EventItem: The populated event item with extracted details.
        """
        if "playwright_page" in response.meta:
            await response.meta["playwright_page"].close()

        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
            "Accept": "application/json",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": "https://bileto.sympla.com.br",
            "Referer": "https://bileto.sympla.com.br",
            "Content-Type": "application/json",
            "x-api-key": "cQkazy2Wc",
        }

        first_link_extractor = LinkExtractor("/event/")
        base_api_url = (
            "https://bff-sales-api-cdn.bileto.sympla.com.br/api/v1/events/{event_id}"
        )
        for link in first_link_extractor.extract_links(response):
            self.logger.debug(f"Processing link: {link.url}")
            if match := re.search(r"/event/(\d+)", urlparse(link.url).path):
                api_url = base_api_url.format(event_id=match.group(1))
                self.logger.debug(f"Making API request to: {api_url}")
                yield Request(api_url, callback=self._parse_first_api, headers=headers)
            else:
                self.logger.warning(f"Could not extract event ID from URL: {link.url}")

        second_link_extractor = LinkExtractor("/evento/")
        base_api_url = "https://event-page.svc.sympla.com.br/api/event-bff/recommendation/events?only=name,start_date,end_date,images,event_type,duration_type,location,id,global_score,start_date_formats,end_date_formats,url,company,type&filter_sold_out=1&events_ids=&is_free=0&event_id={event_id}&limit=24&service=%2Fv4%2Frecommender%2Fevents-same-organizer"
        for link in second_link_extractor.extract_links(response):
            self.logger.debug(f"Processing link: {link.url}")
            event_id = Path(urlparse(link.url).path).name
            api_url = base_api_url.format(event_id=event_id)
            self.logger.debug(f"Making API request to: {api_url}")
            yield Request(api_url, callback=self._parse_second_api)

    def _parse_first_api(self, response: JsonResponse) -> EventItem:
        api_data = response.json()["data"]
        loader = EventLoader(item=EventItem(), response=response)
        loader.add_value("nome", api_data["name"])
        loader.add_value("imagem_url", api_data["medias"][1]["url"])
        loader.add_value(
            "enderecoCompleto",
            " - ".join(
                (
                    api_data["venue"]["locale"]["address"].strip(),
                    api_data["venue"]["locale"]["city"]["name"],
                    api_data["venue"]["locale"]["state"]["name"],
                    api_data["venue"]["locale"]["country"]["name"],
                )
            ),
        )
        loader.add_value("dataInicio", api_data["next_local_date_time"])
        loader.add_value("dataFim", api_data["last_local_date_time"])
        loader.add_value(
            "linkSiteOficial", f"https://bileto.sympla.com.br/event/{api_data['id']}"
        )
        return loader.load_item()

    def _parse_second_api(self, response: JsonResponse) -> EventItem:
        api_data = next(iter(response.json()["data"]))

        def parse_location() -> LiteralString:
            core_address = ", ".join(
                [
                    api_data["location"]["address"],
                    api_data["location"]["neighborhood"],
                    api_data["location"]["zip_code"],
                ]
            )

            fragmented_location = [
                core_address,
                api_data["location"]["city"],
                api_data["location"]["state"],
            ]
            return " - ".join(fragmented_location)

        loader = EventLoader(item=EventItem(), response=response)
        loader.add_value("nome", api_data["name"])
        loader.add_value("dataInicio", api_data["start_date"])
        loader.add_value("dataFim", api_data["end_date"])
        loader.add_value("linkSiteOficial", api_data["url"])
        loader.add_value("enderecoCompleto", parse_location())
        loader.add_value("imagem_url", api_data["images"]["original"])
        return loader.load_item()
