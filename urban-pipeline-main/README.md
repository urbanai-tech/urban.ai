# Urban Pipeline

Urban Pipeline is a comprehensive data orchestration platform designed for urban AI projects. It provides automated data pipelines for web scraping, data extraction from S3, and database operations using the Prefect orchestration engine. The platform ensures reliable and efficient data processing from various sources including ticketing websites and cloud storage.

## Tech Stack

### Core Technologies
- **[Python](https://www.python.org/)**: The core programming language for the project.
- **[Prefect](https://www.prefect.io/)**: A workflow orchestration tool used to build, run, and monitor data pipelines.
- **[SQLAlchemy](https://www.sqlalchemy.org/)**: Database toolkit and ORM for Python.
- **[Pandas](https://pandas.pydata.org/)**: Data manipulation and analysis library.
- **[PyArrow](https://arrow.apache.org/docs/python/)**: Columnar in-memory analytics library for efficient data processing.

### Data Storage & Cloud
- **[MySQL](https://www.mysql.com/)**: Primary database for structured data storage.
- **[Amazon S3](https://aws.amazon.com/s3/)**: Cloud storage for raw data and parquet files.
- **[Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)**: AWS SDK for Python.

### Development & Testing
- **[uv](https://github.com/astral-sh/uv)**: An extremely fast Python package installer and resolver, used for dependency management.
- **[pytest](https://pytest.org/)**: Testing framework with comprehensive E2E testing capabilities.
- **[moto](https://github.com/getmoto/moto)**: Mock AWS services for testing.
- **[testcontainers](https://testcontainers.com/)**: Integration testing with real databases.

### Web Scraping
- **[httpx](https://www.python-httpx.org/)**: A modern, asynchronous HTTP client for Python, used to make requests to the Scrapyd service.
- **[Scrapyd](https://scrapyd.readthedocs.io/en/stable/)**: An open-source service for running Scrapy spiders.

## Features

### Pipeline Orchestration
- **Workflow Orchestration**: Uses [Prefect](https://www.prefect.io/) to define, schedule, and monitor complex data workflows.
- **Modular Pipeline Architecture**: Separate pipelines for web scraping triggers and data processing workflows.
- **Service Health Check**: Automatically checks if the `scrapyd` service is available before attempting to trigger any spiders, with built-in retries.

### Data Processing
- **S3 Data Extraction**: Automated extraction of parquet files from Amazon S3 storage.
- **Database Operations**: Comprehensive MySQL database operations with connection pooling and transaction management.
- **Data Transformation**: Pandas-based data processing with support for multiple data formats.
- **Batch Processing**: Efficient handling of large datasets with multi-dataframe operations.

### Configuration & Security
- **Centralized Configuration**: Manages configuration through Prefect variables and secrets for secure setup.
- **Database Templates**: Pre-configured database setups for production, testing, and development environments.
- **Environment-based Configuration**: Support for different configurations across environments.

### Testing & Quality Assurance
- **Comprehensive E2E Testing**: End-to-end testing framework with 12+ database integration tests.
- **Mock Services**: Complete testing infrastructure with mocked AWS S3 and database services.
- **Performance Testing**: Support for large dataset testing and concurrent operation validation.
- **Multiple Testing Strategies**: SQLite for fast local testing, MySQL containers for full integration testing.

### Scalability & Reliability
- **Connection Pooling**: Efficient database connection management for high-throughput operations.
- **Error Handling**: Comprehensive error handling and retry mechanisms.
- **Data Integrity**: Validation of data consistency throughout the pipeline.
- **Concurrent Processing**: Support for parallel data processing operations.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

### Required Software
- **Python 3.12+**: The project requires Python 3.12 or later
- **[uv](https://github.com/astral-sh/uv)**: Package manager for dependency management
- **MySQL**: Database server (for production) or SQLite (for development/testing)

### External Services
- **[Scrapyd](https://scrapyd.readthedocs.io/en/stable/)**: Service to host and run web scraping spiders
- **[Prefect](https://www.prefect.io/)**: Server or Prefect Cloud account for workflow orchestration
- **Amazon S3**: AWS account with S3 access for data storage (optional for testing)

### Development Tools (Optional)
- **Docker**: For running MySQL containers in testing environments
- **AWS CLI**: For local AWS configuration and testing

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd urban-pipeline
    ```

2.  **Install dependencies:**
    Create a virtual environment and install the required packages using `uv`.
    ```bash
    uv sync
    ```

3.  **Install development dependencies (optional):**
    For testing and development work:
    ```bash
    uv sync --group dev
    ```

## Project Structure

```
urban-pipeline/
├── raw_data_pipeline/           # Core data processing pipeline
│   ├── config/                  # Configuration management
│   │   └── database.py         # Database configuration and templates
│   ├── extractors/             # Data extraction modules
│   │   └── s3_extractor.py     # S3 data extraction
│   ├── load/                   # Data loading modules
│   │   └── load_on_mysql.py    # MySQL data loading
│   ├── utils/                  # Utility functions
│   └── main.py                 # Main pipeline orchestration
├── spiders_pipeline/           # Web scraping pipeline
│   ├── spiders_triggers/       # Spider trigger management
│   ├── config/                 # Spider configuration
│   └── utils/                  # Spider utilities
├── tests/                      # Test suite
│   └── raw_data_pipeline_tests/
│       ├── test_e2e_database_integration.py    # Database E2E tests
│       ├── test_e2e_complete_flow.py          # Complete pipeline E2E tests
│       ├── test_e2e_infrastructure.py         # Testing infrastructure
│       └── conftest.py                        # Test configuration
├── pyproject.toml              # Project configuration and dependencies
├── pytest.ini                 # Test configuration
├── prefect.yaml               # Prefect deployment configuration
└── README.md                  # This file
```

## Configuration

This project requires configuration for both Prefect workflows and database connections.

### Prefect Configuration

1.  **Create Prefect Variables:**
    In your Prefect UI (server or cloud), create the following variables:
    
    **For Web Scraping Pipeline:**
    -   **Name**: `urban_webscraping_scrapyd_url`
    -   **Value**: A JSON object containing the Scrapyd URL:
        ```json
        {
          "WEBSCRAPPING_API_URL": "http://localhost:6800"
        }
        ```

2.  **Create Prefect Secrets:**
    Create secrets for database connections:
    
    **For Production Database:**
    -   **Name**: `mysql-connection-string`
    -   **Value**: Your MySQL connection string:
        ```
        mysql+pymysql://username:password@host:port/database
        ```

3.  **Authenticate with Prefect:**
    ```bash
    # For Prefect Cloud
    prefect cloud login -k <YOUR_API_KEY>
    
    # For local Prefect server
    prefect config set PREFECT_API_URL=http://127.0.0.1:4200/api
    ```

### Database Configuration

The project supports multiple database configurations through templates:

**Production MySQL:**
```python
from raw_data_pipeline.config.database import DatabaseTemplates
config = DatabaseTemplates.production_mysql()
```

**Testing MySQL:**
```python
config = DatabaseTemplates.testing_mysql()
```

**SQLite (Development):**
```python
config = DatabaseTemplates.sqlite_memory()
```

### Environment Variables

Set the following environment variables for AWS integration:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

## Usage

The project provides two main pipeline workflows:

### 1. Web Scraping Pipeline

Triggers web scraping spiders for various ticketing websites.

**Deploy the Spider Trigger Flow:**
```bash
uv run prefect deploy --name spider-triggers
```

**Run from Prefect UI:**
Navigate to "Flows" → "Trigger All Spiders Flow" → "Run"

**Supported Spiders:**
- `eventim` - Eventim ticketing platform
- `ticketmaster` - Ticketmaster events
- `blue_ticket` - Blue Ticket platform
- `even3` - Even3 events
- `ingresse` - Ingresse ticketing
- `sympla` - Sympla events
- `ticket_360` - Ticket 360 platform

### 2. Raw Data Pipeline

Processes data from S3 storage to MySQL database.

**Deploy the Data Processing Flow:**
```bash
uv run prefect deploy --name raw-data-pipeline
```

**Manual Execution:**
```bash
# Run the complete data pipeline
uv run python -m raw_data_pipeline.main

# Extract data from specific S3 folder
uv run python -c "
from raw_data_pipeline.extractors.s3_extractor import S3Extractor
extractor = S3Extractor()
data = extractor.get_dataframes_from_folder('eventim')
print(f'Extracted {len(data)} dataframes')
"
```

### Pipeline Operations

**List Available S3 Folders:**
```bash
uv run python -c "
from raw_data_pipeline.extractors.s3_extractor import S3Extractor
folders = S3Extractor().list_folders()
print('Available folders:', folders)
"
```

**Test Database Connection:**
```bash
uv run python -c "
from raw_data_pipeline.config.database import DatabaseTemplates
config = DatabaseTemplates.testing_mysql()
engine = config.get_engine()
print('Database connection successful')
"
```

## Testing

The project includes a comprehensive testing framework with E2E (End-to-End) testing capabilities.

### Test Categories

- **Unit Tests**: Individual component testing
- **Integration Tests**: Database and service integration testing  
- **E2E Tests**: Complete pipeline flow testing
- **Performance Tests**: Large dataset and concurrent operation testing

### Running Tests

**Run All Tests:**
```bash
uv run pytest
```

**Run E2E Database Integration Tests:**
```bash
uv run pytest tests/raw_data_pipeline_tests/test_e2e_database_integration.py -v
```

**Run Complete Flow E2E Tests:**
```bash
uv run pytest tests/raw_data_pipeline_tests/test_e2e_complete_flow.py -v
```

**Run Tests with Coverage:**
```bash
uv run pytest --cov=raw_data_pipeline --cov-report=html
```

**Run Specific Test Categories:**
```bash
# Run only E2E tests
uv run pytest -m e2e

# Run only integration tests  
uv run pytest -m integration

# Run only unit tests
uv run pytest -m unit
```

### Test Infrastructure

The testing framework provides:

- **Mock AWS S3**: Using `moto` for S3 operations testing
- **Test Databases**: SQLite for fast testing, MySQL containers for full integration
- **Test Data Factories**: Automated generation of realistic test datasets
- **Fixture Management**: Comprehensive pytest fixtures for database and S3 setup

### Database Testing

**Current E2E Database Integration Tests (12/12 Passing):**
- Database connection lifecycle testing
- Data persistence and integrity validation
- Connection pooling and concurrent access testing
- Schema evolution and data type handling
- Error handling scenarios
- Multi-dataframe operations
- Load function integration testing

## Development

### Code Quality Tools

**Linting and Formatting:**
```bash
# Run linters and formatters
uv run poe lint

# Check code formatting
uv run ruff check
uv run ruff format

# Type checking
uv run mypy raw_data_pipeline/
```

### Development Workflow

1. **Setup Development Environment:**
   ```bash
   uv sync --group dev
   ```

2. **Create Feature Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Run Tests:**
   ```bash
   uv run pytest
   ```

4. **Commit Changes:**
   ```bash
   uv run poe commit  # Uses commitizen for conventional commits
   ```

5. **Push Changes:**
   ```bash
   uv run poe push    # Pushes with tags
   ```

### Available Development Commands

```bash
# See all available commands
uv run poe

# Common commands:
uv run poe lint          # Run linters and formatters
uv run poe commit        # Interactive commit with conventional format
uv run poe push          # Push changes with tags
uv run poe clean         # Remove cache and temporary files
```

## Architecture

### Data Flow

```
S3 Storage (Parquet Files)
    ↓
S3 Extractor
    ↓
Pandas DataFrames
    ↓
Data Transformation
    ↓
MySQL Database
```

### Component Overview

- **S3 Extractor**: Handles data extraction from Amazon S3 buckets
- **Database Config**: Manages database connections and configurations
- **Load Functions**: Handles data loading into MySQL with proper error handling
- **Prefect Tasks**: Orchestrates the entire pipeline workflow
- **Testing Infrastructure**: Comprehensive E2E and integration testing

### Database Schema Templates

The project provides pre-configured database templates:

- **Production**: Optimized for high-throughput production workloads
- **Testing**: Lightweight configuration for testing environments  
- **Development**: SQLite-based setup for local development

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Test database connectivity
uv run python -c "
from raw_data_pipeline.config.database import DatabaseTemplates
config = DatabaseTemplates.testing_mysql()
engine = config.get_engine()
with engine.connect() as conn:
    print('Database connection successful')
"
```

**S3 Access Issues:**
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test S3 access
uv run python -c "
import boto3
s3 = boto3.client('s3')
print('S3 access successful')
"
```

**Prefect Flow Issues:**
```bash
# Check Prefect configuration
prefect config view

# Verify Prefect connection
prefect server start  # For local server
```

### Performance Optimization

**Database Performance:**
- Connection pooling is automatically configured
- Use batch operations for large datasets
- Monitor connection usage with `pool_size` settings

**Memory Usage:**
- Process data in chunks for large datasets
- Use efficient data types in pandas DataFrames
- Monitor memory usage during testing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes following the coding standards
4. Run tests (`uv run pytest`)
5. Run linting (`uv run poe lint`)
6. Commit your changes (`uv run poe commit`)
7. Push to the branch (`git push origin feat/amazing-feature`)
8. Open a Pull Request

### Coding Standards

- Follow PEP 8 style guidelines
- Use type hints for all functions
- Write comprehensive docstrings
- Maintain test coverage above 80%
- Use conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the test examples for usage patterns

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes and version history.
