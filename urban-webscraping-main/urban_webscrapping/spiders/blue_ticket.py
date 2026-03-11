"""This module contains code for scraping São Paulo's ticket events information from Blue Ticket."""

import json
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from urllib.parse import urlparse

from scrapy import FormRequest, Request, Spider
from scrapy.http import Response
from scrapy.http.response.json import JsonResponse
from scrapy.linkextractors import LinkExtractor
from scrapy_playwright.page import PageMethod

from urban_webscrapping.items import EventItem
from urban_webscrapping.loaders import EventLoader


class BlueTicketSpider(Spider):
    """Spider for scraping event information from BlueTicket (www.blueticket.com.br).

    This spider uses Scrapy with Playwright integration to handle JavaScript-rendered content.
    It starts by searching for events in São Paulo, SP, extracts event links, and then fetches
    detailed event information from the BlueTicket API.

    Attributes:
        name (str): The name of the spider.
        allowed_domains (list): List of allowed domains for crawling.
        link_extractor (LinkExtractor): Extracts event links matching '/evento/'.
        custom_settings (dict): Custom Scrapy settings enabling Playwright.

    Methods:
        start():
            Asynchronously initiates the scraping process by yielding a Scrapy Request to the BlueTicket
            search page for events in São Paulo, SP. Configures the request for Playwright and waits for
            event links to appear.

        errback(failure):
            Handles errors during requests by closing the associated Playwright page to free resources.

        parse(response):
            Asynchronously parses the response to extract event links, closes the Playwright page,
            constructs API URLs for each event, and yields FormRequests to fetch event details.

        parse_api(response):
            Parses the JSON response from the BlueTicket API and extracts event information,
            yielding populated EventItem objects.
    """

    name = "blue_ticket"
    allowed_domains = ["www.blueticket.com.br", "soulapi.blueticket.com.br"]
    link_extractor = LinkExtractor(allow="/evento/")
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
        url = "https://www.blueticket.com.br/search?q=&city=S%C3%A3o%20Paulo,SP"
        metadata = {
            "playwright": True,
            "playwright_include_page": True,
            "errback": self.errback,
            "playwright_page_methods": [
                PageMethod("wait_for_selector", "a[href*='/evento/']")
            ],
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

    async def parse(self, response: Response) -> AsyncIterator[FormRequest]:
        """Asynchronously parses the response to extract event links and generate API requests for event details.

        Closes the Playwright page if present in the response metadata. Iterates over links extracted from the response,
        constructs an API URL for each event using its event_id, and yields a FormRequest to fetch event details from the
        BlueTicket API.

        Args:
            response (Response): The Scrapy response object to parse.

        Yields:
            AsyncIterator[FormRequest]: An asynchronous iterator of FormRequest objects for each event detail API call.
        """
        # Close the page if it exists
        if "playwright_page" in response.meta:
            await response.meta["playwright_page"].close()

        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.5",
            "Origin": "https://www.blueticket.com.br",
            "Referer": "https://www.blueticket.com.br",
            "Content-Type": "application/json",
        }
        base_api_url = (
            "https://soulapi.blueticket.com.br/api/v2/event/detail/{event_id}"
        )

        for link in self.link_extractor.extract_links(response):
            self.logger.info(f"Processing link: {link.url}")
            event_id = Path(urlparse(link.url).path).parent.name
            new_url = base_api_url.format(event_id=event_id)
            self.logger.info(f"Making API request to: {new_url}")
            yield FormRequest(
                new_url,
                callback=self.parse_api,
                method="POST",
                headers=headers,
                body=json.dumps({}),
            )

    def parse_api(self, response: JsonResponse) -> Iterator[EventItem]:
        """Parses the JSON response from the API and extracts event information.

        Args:
            response (JsonResponse): The response object containing JSON data from the API.

        Yields:
            EventItem: An item populated with event details such as name, image URL, full address,
                       start date, and official website link.
        """
        api_data = response.json()
        loader = EventLoader(item=EventItem(), response=response)
        loader.add_value("nome", api_data["nome"])
        loader.add_value("imagem_url", api_data["capa"]["url"])
        loader.add_value(
            "enderecoCompleto",
            ", ".join(
                (
                    api_data["local"]["endereco"],
                    api_data["cidade"][0]["nome"],
                    api_data["cidade"][0]["estado"],
                )
            ),
        )
        loader.add_value("dataInicio", value=api_data["data_inicio"])
        loader.add_value("linkSiteOficial", api_data["compartilhar_url"])
        yield loader.load_item()
