"""
Main entry point for the Urban Pipeline application.

This module contains the main Prefect flow for triggering web scraping spiders.
"""

from prefect import flow, get_run_logger, task
from prefect.variables import Variable

from .spiders_triggers.spiders_triggers import SpiderTriggers
from .utils.check_service import check_scrapyd_service


@task(name="Check Scrapyd Service", retries=3, retry_delay_seconds=10)
def check_service_task(url: str) -> bool:
    """
    Checks if the Scrapyd service is available.

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
        logger.warning("Scrapyd service is not available")

    return result


@flow(name="Trigger All Spiders Flow")
async def trigger_all_spiders(scrapyd_url: str = None) -> None:
    """
    A Prefect flow that triggers all web scraping spiders.

    This flow first checks if the Scrapyd service is available. If it is,
    it retrieves the Scrapyd URL from a Prefect variable and then triggers
    all the spiders.

    Args:
        scrapyd_url: The Scrapyd service URL. If not provided, will fetch from variable.
    """
    logger = get_run_logger()
    logger.info("Starting spider triggering flow")

    # Use parameter if provided, otherwise fetch from variable
    if scrapyd_url:
        logger.info(f"Using Scrapyd URL from parameter: {scrapyd_url}")
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
            return

        scrapyd_url = scrapyd_url_data["WEBSCRAPPING_API_URL"]
        logger.info(f"Retrieved Scrapyd URL from variable: {scrapyd_url}")

    if not check_service_task(url=scrapyd_url):
        logger.error("Scrapyd service is not available. Exiting.")
        return

    spiders = SpiderTriggers(url=scrapyd_url)
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
