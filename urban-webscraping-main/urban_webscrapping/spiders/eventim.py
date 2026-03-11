import json
from pathlib import Path

import pkg_resources
from omegaconf import OmegaConf
from scrapy import Request, Spider
from scrapy_playwright.page import PageMethod


class EventimSpider(Spider):
    name = "eventim"

    with pkg_resources.resource_stream(
        "urban_webscrapping", "custom_spider_settings/eventim-settings.yaml"
    ) as f:
        custom_conf = OmegaConf.load(f)

    custom_settings = OmegaConf.to_container(custom_conf, resolve=True)

    async def start(self):
        base_url = "https://public-api.eventim.com/websearch/search/api/exploration/v2/productGroups?webId=web__eventim-com-br&language=pt&page={}&retail_partner=BR1&city_ids=943&sort=Recommendation&in_stock=true"

        yield Request(
            url=base_url.format(1),
            meta={
                "playwright": True,
                "playwright_include_page": True,
                "playwright_context": "eventim_context",
                "playwright_page_methods": [
                    PageMethod("wait_for_selector", "body", timeout=15000),
                ],
            },
            callback=self.parse,
        )

    async def parse(self, response):
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            page = response.meta["playwright_page"]
            data = await page.evaluate("() => JSON.parse(document.body.textContent)")
            await page.close()

        for event in data["productGroups"]:
            yield {
                "id": event["productGroupId"],
                "name": event["name"],
                "date": event.get("eventDate", ""),
                "address": event["products"][0]
                .get("typeAttributes", {})
                .get("liveEntertainment", {})
                .get("location", {})
                .get("name", "Endereço não disponível"),
                "imageUrl": event.get("imageUrl", ""),
            }

        current_page = int(response.url.split("page=")[1].split("&")[0])
        total_pages = data["totalPages"]

        if current_page < total_pages:
            next_page = current_page + 1
            next_url = response.url.replace(f"page={current_page}", f"page={next_page}")

        yield Request(
            url=next_url,
            meta={
                "playwright": True,
                "playwright_include_page": True,
                "playwright_context": "eventim_context",
                "playwright_page_methods": [
                    PageMethod("wait_for_selector", "body", timeout=15000),
                ],
            },
            callback=self.parse,
        )

    async def errback(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure}")
