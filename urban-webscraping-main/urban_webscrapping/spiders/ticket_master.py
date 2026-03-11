"""This module contains code for scraping São Paulo's ticket events information from Ticketmaster."""

import os
from urllib.parse import urljoin

import pkg_resources
from dotenv import load_dotenv
from omegaconf import OmegaConf
from scrapy import Request, Spider

from urban_webscrapping.utils.ticket_master_spider_helper import TicketMasterHelper

load_dotenv()


class TicketMasterSpider(Spider):
    name = "ticket_master"

    with pkg_resources.resource_stream(
        "urban_webscrapping", "custom_spider_settings/ticket-master-settings.yaml"
    ) as f:
        custom_conf = OmegaConf.load(f)
    custom_settings = OmegaConf.to_container(custom_conf, resolve=True)

    async def start(self):
        base_url = "https://app.ticketmaster.com/discovery/v2/events?apikey={}&unit=km&source=ticketmaster&locale=*&countryCode=BR&stateCode=SP"

        api_key = os.getenv("TICKETMASTER_API_KEY")

        if not api_key:
            self.logger.error(
                "TICKETMASTER_API_KEY not found in environment variables."
            )
            return

        yield Request(
            url=base_url.format(api_key),
            meta={"playwright": False},
            callback=self.parse,
        )

    async def parse(self, response):
        ticket_helper = TicketMasterHelper()
        try:
            data = response.json()
        except Exception as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            return

        events = data.get("_embedded", {}).get("events", [])
        if not events:
            self.logger.warning("No events found in the response.")
            return

        for event in events:
            yield ticket_helper.process_event(event)

        links = data.get("_links", {})
        if "next" in links:
            next_url = urljoin(response.url, links["next"]["href"])
            yield Request(url=next_url, meta={"playwright": False}, callback=self.parse)

    async def errback(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure}")
