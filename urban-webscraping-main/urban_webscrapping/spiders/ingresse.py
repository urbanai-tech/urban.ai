from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import Page
from scrapy import FormRequest, Request, Spider
from scrapy.http import Response
from scrapy.http.response.json import JsonResponse
from scrapy.linkextractors import LinkExtractor
from scrapy_playwright.page import PageMethod

from urban_webscrapping.items import EventItem
from urban_webscrapping.loaders import EventLoader


async def scroll_page(page: Page) -> str:
    # Wait for event grid layout to load
    events_grid_selector = r"body > main > div:nth-child(2) > div.styles__wrapper___nr3N > div > div > div.grid.grid-cols-1.gap-4.md\:grid-cols-2.lg\:grid-cols-5"
    await page.wait_for_selector(selector=events_grid_selector)

    # Scroll down to the bottom of the page to load all events
    await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")

    # Click on each bottom button to load the next page
    page_button_selector = r"body > main > div:nth-child(2) > div.styles__wrapper___nr3N > div > div > div.flex.justify-center.space-x-2.mt-4.pt-32 > div"
    for page_button in await page.locator(page_button_selector).all():
        await page_button.click()

    return page.url


class IngresseSpider(Spider):
    name = "ingresse"
    allowed_domains = ["www.ingresse.com", "api-site.ingresse.com"]
    link_extractor = LinkExtractor(
        deny=[
            "/login",
            "/register",
            "tiktok",
            "linkedin",
            "instagram",
            "google",
            "apple",
            "sobre",
            "freshdesk",
            "language",
        ]
    )

    async def start(self) -> AsyncIterator[Request]:
        """Asynchronously initiates the scraping process by yielding a Scrapy Request to the BlueTicket search page for events in São Paulo, SP.

        The request is configured to use Playwright for JavaScript rendering, waits for event links to appear on the page, and includes an error callback.

        Yields:
            AsyncIterator[Request]: An asynchronous iterator yielding a Scrapy Request object configured
            for Playwright integration and event link detection.
        """
        url = "https://www.ingresse.com/search/?location=BRA-SP&language=pt_br&page=1"
        metadata = {
            "playwright": True,
            "playwright_include_page": True,
            "errback": self.errback,
            "playwright_page_methods": [PageMethod(scroll_page)],
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
        if "playwright_page" in response.meta:
            await response.meta["playwright_page"].close()

        # Extract event links from the current page
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": "https://www.ingresse.com",
            "Referer": "https://www.ingresse.com",
            "Content-Type": "application/json",
        }
        base_api_url = "https://api-site.ingresse.com/events/{event_name}"
        for link in self.link_extractor.extract_links(response):
            self.logger.debug(f"Processing link: {link.url}")
            new_url = base_api_url.format(event_name=urlparse(link.url).path.strip("/"))
            self.logger.debug(f"Making API request to: {new_url}")
            yield FormRequest(new_url, callback=self.parse_api, headers=headers)

    def parse_api(self, response: JsonResponse) -> Iterator[EventItem]:
        api_data = response.json()
        loader = EventLoader(item=EventItem(), response=response)

        loader.add_value("nome", api_data["title"])
        loader.add_value("imagem_url", api_data["poster"]["medium"])
        loader.add_value(
            "enderecoCompleto",
            " - ".join(
                (
                    api_data["place"]["street"],
                    api_data["place"]["city"],
                    api_data["place"]["state"],
                )
            ),
        )
        loader.add_value("dataInicio", value=api_data["sessions"][0]["dateTime"])
        loader.add_value("dataFim", value=api_data["sessions"][-1]["dateTime"])

        event_url = (
            Path("https://www.ingresse.com") / Path(urlparse(response.url).path).name
        )
        loader.add_value("linkSiteOficial", event_url.as_posix())

        return loader.load_item()
