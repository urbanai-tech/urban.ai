"""
Main entry point for the Urban Pipeline application.

This module contains the main Prefect flow for triggering web scraping spiders.
"""

from prefect import flow, get_run_logger, task
from prefect.variables import Variable

from .spiders_triggers.spiders_triggers import SpiderTriggers
from .utils.check_service import check_scrapyd_service
from .config.settings import settings


@task(name="Check Scrapyd Service", retries=3, retry_delay_seconds=10)
def check_service_task(url: str, api_key: str = "") -> bool:
    """
    Checks if the Scrapyd service is available.

    Raises RuntimeError when it is not, so the task retries up to 3 times
    (10 s apart) and, if still down, fails the flow run instead of finishing
    "Completed" with nothing scheduled.
    """
    logger = get_run_logger()
    logger.info(f"Checking Scrapyd service at: {url}")

    if not check_scrapyd_service(url=url, api_key=api_key):
        logger.warning("Scrapyd service is not available")
        raise RuntimeError(f"Scrapyd service is not available at {url}")

    logger.info("Scrapyd service is available")
    return True


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
            msg = "Scrapyd URL is not configured correctly in Prefect variables."
            logger.error(msg)
            raise RuntimeError(msg)

        scrapyd_url = scrapyd_url_data["WEBSCRAPPING_API_URL"]
        logger.info(f"Retrieved Scrapyd URL from variable: {scrapyd_url}")

    check_service_task(url=scrapyd_url, api_key=settings.SCRAPYD_API_KEY)

    spiders = SpiderTriggers(url=scrapyd_url, api_key=settings.SCRAPYD_API_KEY)
    triggers = [
        ("eventim", spiders.crawl_eventim),
        ("ticketmaster", spiders.crawl_ticketmaster),
        ("blue_ticket", spiders.crawl_blue_ticket),
        ("even3", spiders.crawl_even3),
        ("ingresse", spiders.crawl_ingresse),
        ("sympla", spiders.crawl_sympla),
        ("ticket_360", spiders.crawl_ticket_360),
    ]

    logger.info("Starting to trigger all spiders")
    failed: list[str] = []
    for name, trigger in triggers:
        logger.info(f"Triggering {name} spider")
        try:
            trigger()
        except Exception as e:  # um spider fora não impede os demais
            logger.error(f"Failed to trigger {name} spider: {e}")
            failed.append(name)

    if failed:
        # Falha o run: um run "Completed" sem agendar nada esconde fonte parada.
        raise RuntimeError(
            f"{len(failed)}/{len(triggers)} spiders não foram agendados: "
            + ", ".join(failed)
        )

    logger.info("All spiders triggered successfully.")
