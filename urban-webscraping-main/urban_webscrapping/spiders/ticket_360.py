from collections.abc import Iterator

from scrapy.http import Response
from scrapy.link import Link
from scrapy.linkextractors import LinkExtractor
from scrapy.spiders import CrawlSpider, Rule
from w3lib.html import remove_tags, replace_escape_chars

from urban_webscrapping.items import EventItem
from urban_webscrapping.loaders import EventLoader


class Ticket360Spider(CrawlSpider):
    name = "ticket_360"
    allowed_domains = ["www.ticket360.com.br"]
    rules = [
        # Follow links from each event catalog page
        Rule(LinkExtractor(allow=r"\/sub-categoria\/\d+\/[a-z-]+\/\?p=\d+$")),
        # Extract event page links from each catalot page
        Rule(
            LinkExtractor(allow="/evento/"),
            callback="parse_event",
            process_links="correct_extracted_links",
        ),
    ]
    start_urls = ["https://www.ticket360.com.br/sub-categoria/211/sao-paulo"]

    @staticmethod
    def correct_extracted_links(links: list[Link]) -> list[Link]:
        return [
            Link(link.url.replace("/sub-categoria/211/", "/").replace("/sao-paulo", ""))
            for link in links
        ]

    #    def parse(self, response: Response) -> Iterator[Request]:
    #        event_link_extractor = LinkExtractor(allow="/evento/")
    #        for link in event_link_extractor.extract_links(response):
    #            yield response.follow(link.url, callback=self.parse_event)

    #        next_page_url_xpath = (
    #            '//*[@id="contents"]/div[2]/div/div[33]/div/div/ul/li[6]/a/@href'
    #        )
    #        if new_page_url_match := response.xpath(next_page_url_xpath).get():
    #            next_page_query = urlparse(new_page_url_match).query
    #            parsed_url = urlparse(response.url)._replace(query=next_page_query)
    #            yield response.follow(urlunparse(parsed_url), callback=self.parse)

    def parse_event(self, response: Response) -> Iterator[EventItem]:
        """Parses the event details from the given response and returns a populated EventItem.

        This method uses an EventLoader to extract and populate various fields of an event,
        including name, image URL, page URL, description, date, and location, by delegating
        to specialized parsing helper methods.

        Args:
            response (Response): The HTTP response object containing the event page to parse./

        Returns:
            EventItem: The populated event item with extracted details.
        """
        loader = EventLoader(item=EventItem(), response=response)
        loader = self._parse_name(response, loader)
        loader = self._parse_image_url(response, loader)
        loader = self._parse_page_url(response, loader)
        loader = self._parse_date(response, loader)
        loader = self._parse_location(response, loader)
        yield loader.load_item()

    @staticmethod
    def _parse_name(response: Response, loader: EventLoader) -> EventLoader:
        loader.add_xpath(
            "nome",
            '//*[@id="contents"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[2]/h4/text()',
        )
        return loader

    @staticmethod
    def _parse_image_url(response: Response, loader: EventLoader) -> EventLoader:
        loader.add_xpath(
            "imagem_url",
            '//*[@id="contents"]/div[1]/div[2]/div/div/div[1]/div/div[2]/img/@src',
        )
        return loader

    @staticmethod
    def _parse_page_url(response: Response, loader: EventLoader) -> EventLoader:
        loader.add_value("linkSiteOficial", response.url)
        return loader

    @staticmethod
    def _parse_date(response: Response, loader: EventLoader) -> EventLoader:
        date_xpath = '//*[@id="contents"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div'
        if parsed_date := response.xpath(date_xpath).get():
            parsed_date = replace_escape_chars(remove_tags(parsed_date)).strip()
            loader._add_value("dataInicio", parsed_date)
        return loader

    @staticmethod
    def _parse_location(response: Response, loader: EventLoader) -> EventLoader:
        location_xpath = '//*[@id="contents"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div[2]/div/text()'
        location = [
            replace_escape_chars(text=location_part).strip()
            for location_part in response.xpath(location_xpath).getall()
        ]
        loader.add_value("enderecoCompleto", " ".join("".join(location).split()))
        return loader
