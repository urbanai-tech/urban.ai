from typing import Any, cast

import httpx
from prefect import get_run_logger, task

from .interface.spider_crawl_interface import ISpiderTrigger


class SpiderTriggers(ISpiderTrigger):
    """Triggers spiders for the web scraping project."""

    def __init__(self, url: str) -> None:
        """Initializes the spider trigger with scrapyd base url."""
        self.url = url

    @task(name="Crawl Eventim")
    def crawl_eventim(self) -> dict[str, str]:
        return self._trigger_spider("eventim")

    @task(name="Crawl Ticketmaster")
    def crawl_ticketmaster(self) -> dict[str, str]:
        return self._trigger_spider("ticket_master")

    @task(name="Crawl Blue Ticket")
    def crawl_blue_ticket(self) -> dict[str, str]:
        return self._trigger_spider("blue_ticket")

    @task(name="Crawl Even3")
    def crawl_even3(self) -> dict[str, str]:
        return self._trigger_spider("even3")

    @task(name="Crawl Ingresse")
    def crawl_ingresse(self) -> dict[str, str]:
        return self._trigger_spider("ingresse")

    @task(name="Crawl Sympla")
    def crawl_sympla(self) -> dict[str, str]:
        return self._trigger_spider("sympla")

    @task(name="Crawl Ticket 360")
    def crawl_ticket_360(self) -> dict[str, str]:
        return self._trigger_spider("ticket_360")

    def _trigger_spider(self, spider_name: str) -> dict[str, Any]:
        """Triggers a spider to run on the web scraping service.

        Args:
            spider_name: The name of the spider to trigger.

        Returns:
            A dictionary containing the response from the service.
        """
        logger = get_run_logger()
        logger.info(f"Triggering spider: {spider_name}")

        try:
            response = httpx.post(
                f"{self.url}/schedule.json",
                data={"project": "urban_webscrapping", "spider": spider_name},
            )
            response.raise_for_status()

            result = cast(dict[str, Any], response.json())
            job_id = result.get("jobid", "unknown")
            logger.info(
                f"Spider {spider_name} triggered successfully. Job ID: {job_id}"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to trigger spider {spider_name}: {e}")
            raise
