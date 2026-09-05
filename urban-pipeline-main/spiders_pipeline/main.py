"""Main entry point for the Urban Pipeline application.

This module contains the main Prefect flow for triggering web scraping spiders.
"""

from urllib.parse import urlsplit

from prefect import flow, get_run_logger, task
from prefect.variables import Variable

from .config.settings import settings
from .spiders_triggers.spiders_triggers import SpiderTriggers
from .utils.check_service import check_scrapyd_service


@task(name="Check Scrapyd Service", retries=3, retry_delay_seconds=10)
def check_service_task(url: str) -> bool:
    """Checks if the Scrapyd service is available.

    This task will retry up to 3 times with a 10-second delay between retries.

    Returns:
        bool: True if the service is available, False otherwise.
    """
    logger = get_run_logger()
    logger.info(f"Checking Scrapyd service at: {url}")

    result = check_scrapyd_service(url=url)

    if result:
        logger.info("Scrapyd service is available")
    else:
        raise RuntimeError("Scrapyd service is not available")

    return result


@flow(name="Trigger All Spiders Flow")
async def trigger_all_spiders(scrapyd_url: str | None = None) -> None:
    """A Prefect flow that triggers all web scraping spiders.

    This flow first checks if the Scrapyd service is available. If it is,
    it retrieves the Scrapyd URL from a Prefect variable and then triggers
    all the spiders.

    Args:
        scrapyd_url: The Scrapyd service URL. If not provided, will fetch from variable.
    """
    logger = get_run_logger()
    logger.info("Starting spider triggering flow")

    # Use parameter if provided, otherwise fetch from variable
    if scrapyd_url is not None:
        logger.info("Using Scrapyd URL from parameter")
    else:
        logger.info("Fetching Scrapyd URL from Prefect variable")
        scrapyd_url_data = await Variable.aget("urban_webscraping_scrapyd_url")
        if (
            not isinstance(scrapyd_url_data, dict)
            or "WEBSCRAPPING_API_URL" not in scrapyd_url_data
        ):
            logger.error(
                "Scrapyd URL is not configured correctly in Prefect variables."
            )
            raise ValueError("Scrapyd URL is missing from Prefect variables")

        scrapyd_url = scrapyd_url_data["WEBSCRAPPING_API_URL"]
        logger.info("Retrieved Scrapyd URL from variable")

    if not isinstance(scrapyd_url, str) or not scrapyd_url.strip():
        raise ValueError("Scrapyd URL must be a nonempty string")
    parts = urlsplit(scrapyd_url)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError(
            "Scrapyd URL must be an HTTP(S) service URL without embedded credentials"
        )
    scrapyd_url = scrapyd_url.rstrip("/")

    if not check_service_task(url=scrapyd_url):
        raise RuntimeError("Scrapyd service is not available")

    spiders = SpiderTriggers(url=scrapyd_url, api_key=settings.SCRAPYD_API_KEY)
    try:
        logger.info("Starting to trigger all spiders")

        logger.info("Triggering eventim spider")
        spiders.crawl_eventim()

        logger.info("Triggering ticketmaster spider")
        spiders.crawl_ticketmaster()

        logger.info("Triggering blue_ticket spider")
        spiders.crawl_blue_ticket()

        logger.info("Triggering even3 spider")
        spiders.crawl_even3()

        logger.info("Triggering ingresse spider")
        spiders.crawl_ingresse()

        logger.info("Triggering sympla spider")
        spiders.crawl_sympla()

        logger.info("Triggering ticket_360 spider")
        spiders.crawl_ticket_360()

        logger.info("All spiders triggered successfully.")

    except Exception as e:
        logger.error(f"An error occurred while triggering spiders: {e}")
        raise
