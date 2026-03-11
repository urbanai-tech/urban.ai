# Urban Web Scraping

This project contains a collection of Scrapy spiders designed to extract event information from various ticketing websites. The extracted data is intended for use by the Urban project.

# Tech Stack
![Python](https://img.shields.io/badge/python-3.12-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Scrapy](https://img.shields.io/badge/scrapy-2.11-00A86B?style=for-the-badge&logo=scrapy&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Scrapyd](https://img.shields.io/badge/scrapyd-1.6-blue?style=for-the-badge)
![Playwright](https://img.shields.io/badge/playwright-1.40-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)

## Table of Contents

- [Overview](#overview)
- [Spiders](#spiders)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Running Spiders Locally](#running-spiders-locally)
  - [Running with Scrapyd](#running-with-scrapyd)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)

## Overview

The primary goal of this project is to provide a reliable and efficient way to scrape event data from multiple sources. It uses Scrapy, a powerful and flexible web scraping framework. The project is configured to run spiders both locally for development and testing, and via Scrapyd for production deployments.

Data is saved to an S3 bucket in both JSON and Parquet formats.

## Spiders

This project includes the following spiders:

- `blue_ticket`
- `even_three`
- `eventim`
- `ingresse`
- `sympla`
- `ticket_360`
- `ticket_master`

Each spider is responsible for a specific website and is designed to extract structured data according to the `EventItem` schema defined in `urban_webscrapping/items.py`.

## Getting Started

### Prerequisites

- Python 3.12 or later
- [uv](https://github.com/astral-sh/uv) (a fast Python package installer)
- Docker

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd urban-webscraping
    ```

2.  **Create a virtual environment and install dependencies:**

    The `uv sync` command will automatically create a virtual environment if one doesn't exist and install all dependencies from `pyproject.toml`.

    ```bash
    uv sync
    ```

## Usage

### Running Spiders Locally

You can run any spider individually using the `scrapy crawl` command. For example, to run the `eventim` spider:

```bash
scrapy crawl eventim
```

To limit the number of items scraped, you can use the `CLOSESPIDER_ITEMCOUNT` setting:

```bash
scrapy crawl eventim -s CLOSESPIDER_ITEMCOUNT=5
```

### Running with Scrapyd

This project is set up to be deployed to a Scrapyd server, which allows for scheduling and managing spider runs via an HTTP API.

1.  **Build and run the Scrapyd container:**

    The `Dockerfile.scrapyd` is configured to build an image with Scrapyd and all project dependencies.

    ```bash
    docker build -t scrapyd-urban -f Dockerfile.scrapyd .
    docker run -d -p 6800:6800 --name scrapyd-container scrapyd-urban
    ```

2.  **Schedule a spider run:**

    You can schedule a spider to run by making a POST request to the `/schedule.json` endpoint.

    Using `curl`:

    ```bash
    curl http://localhost:6800/schedule.json -d project=urban_webscrapping -d spider=eventim
    ```

    This will schedule the `eventim` spider to run and return a job ID.

## Project Structure

```
├── Dockerfile.scrapyd          # Dockerfile for building the Scrapyd image
├── pyproject.toml              # Project metadata and dependencies
├── scrapy.cfg                  # Scrapy configuration file
├── scrapyd.conf                # Scrapyd configuration file
├── urban_webscrapping/
│   ├── items.py                # Defines the data structure for scraped items
│   ├── loaders.py              # Item loaders for processing data
│   ├── pipelines.py            # Item processing pipelines
│   ├── settings.py             # Scrapy project settings
│   ├── custom_spider_settings/ # Custom settings for individual spiders
│   └── spiders/                # Contains all the spider implementations
└── scripts/
    └── test_crawl.py           # Script for testing spider crawls
```

## Configuration

-   **Scrapy Settings:** General Scrapy settings are located in `urban_webscrapping/settings.py`.
-   **Spider-specific Settings:** Some spiders have their own configuration files in `urban_webscrapping/custom_spider_settings/`. These are loaded by the spiders at runtime.
-   **Scrapyd Configuration:** The configuration for the Scrapyd server is in `scrapyd.conf`.

## Deployment

The `Dockerfile.scrapyd` is designed to create a production-ready image that packages the project as an egg and installs it into the Scrapyd environment.

The image is deployed on **Railway**, and spider runs are triggered via HTTP requests from the [_urban-pipeline_](https://github.com/local-hq/urban-pipeline) app, which is managed by `Prefect`.
