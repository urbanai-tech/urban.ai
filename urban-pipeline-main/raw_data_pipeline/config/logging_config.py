"""
Logging configuration module for raw data pipeline.

This module provides centralized logging setup and configuration
for the application with support for different environments and
structured logging formats.
"""

import logging
import logging.config
import sys
from pathlib import Path
from typing import Any

from .settings import Settings


def get_log_level(level_name: str) -> int:
    """
    Convert log level name to logging level constant.

    Args:
        level_name: Log level name (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        int: Logging level constant
    """
    return getattr(logging, level_name.upper(), logging.INFO)


def get_logging_config(
    log_level: str = "INFO",
    log_file: str | None = None,
    enable_console: bool = True,
    enable_file: bool = True,
    log_format: str = "detailed",
) -> dict[str, Any]:
    """
    Generate logging configuration dictionary.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (if None, uses default)
        enable_console: Enable console logging
        enable_file: Enable file logging
        log_format: Log format type (simple, detailed, json)

    Returns:
        Dict[str, Any]: Logging configuration dictionary
    """
    formats = {
        "simple": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        "detailed": (
            "%(asctime)s - %(name)s - %(levelname)s - "
            "%(filename)s:%(lineno)d - %(funcName)s() - %(message)s"
        ),
        "json": (
            '{"timestamp": "%(asctime)s", "logger": "%(name)s", '
            '"level": "%(levelname)s", "file": "%(filename)s", '
            '"line": %(lineno)d, "function": "%(funcName)s", '
            '"message": "%(message)s"}'
        ),
    }

    # Set default log file path
    if log_file is None:
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        log_file = str(log_dir / "urban_pipeline.log")

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "simple": {"format": formats["simple"]},
            "detailed": {"format": formats["detailed"]},
            "json": {"format": formats["json"]},
        },
        "handlers": {},
        "loggers": {
            "": {  # Root logger
                "level": log_level,
                "handlers": [],
            },
            "raw_data_pipeline": {
                "level": log_level,
                "handlers": [],
                "propagate": False,
            },
            "prefect": {"level": "WARNING", "handlers": [], "propagate": False},
            "boto3": {"level": "WARNING", "handlers": [], "propagate": False},
            "sqlalchemy": {"level": "WARNING", "handlers": [], "propagate": False},
        },
    }

    if enable_console:
        config["handlers"]["console"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": log_format,
            "stream": sys.stdout,
        }
        config["loggers"][""]["handlers"].append("console")
        config["loggers"]["raw_data_pipeline"]["handlers"].append("console")
        config["loggers"]["prefect"]["handlers"].append("console")
        config["loggers"]["boto3"]["handlers"].append("console")
        config["loggers"]["sqlalchemy"]["handlers"].append("console")

    if enable_file:
        config["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": log_format,
            "filename": log_file,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf8",
        }
        config["loggers"][""]["handlers"].append("file")
        config["loggers"]["raw_data_pipeline"]["handlers"].append("file")
        config["loggers"]["prefect"]["handlers"].append("file")
        config["loggers"]["boto3"]["handlers"].append("file")
        config["loggers"]["sqlalchemy"]["handlers"].append("file")

    return config


def setup_logging(
    settings: Settings | None = None,
    log_level: str = "INFO",
    log_file: str | None = None,
    enable_console: bool = True,
    enable_file: bool = True,
    log_format: str = "detailed",
) -> None:
    """
    Set up logging configuration for the application.

    Args:
        settings: Application settings (optional)
        log_level: Logging level
        log_file: Path to log file
        enable_console: Enable console logging
        enable_file: Enable file logging
        log_format: Log format type
    """
    # Override defaults with settings if provided
    if settings:
        # You can add log-specific settings to Settings class later
        pass

    config = get_logging_config(
        log_level=log_level,
        log_file=log_file,
        enable_console=enable_console,
        enable_file=enable_file,
        log_format=log_format,
    )

    logging.config.dictConfig(config)


def get_logger(name: str | None = None) -> logging.Logger:
    """
    Get a logger instance with the specified name.

    Args:
        name: Logger name (if None, uses calling module name)

    Returns:
        logging.Logger: Configured logger instance
    """
    if name is None:
        # Get the calling module name
        import inspect

        frame = inspect.currentframe()
        if frame and frame.f_back:
            caller_module = frame.f_back.f_globals.get("__name__", "unknown")
            name = caller_module
        else:
            name = "raw_data_pipeline"

    return logging.getLogger(name)


# Predefined logging configurations for different environments
class LoggingTemplates:
    """Template configurations for different logging environments."""

    @staticmethod
    def development() -> dict[str, Any]:
        """Development logging configuration."""
        return get_logging_config(
            log_level="DEBUG",
            enable_console=True,
            enable_file=True,
            log_format="detailed",
        )

    @staticmethod
    def production() -> dict[str, Any]:
        """Production logging configuration."""
        return get_logging_config(
            log_level="INFO", enable_console=False, enable_file=True, log_format="json"
        )

    @staticmethod
    def testing() -> dict[str, Any]:
        """Testing logging configuration."""
        return get_logging_config(
            log_level="WARNING",
            enable_console=True,
            enable_file=False,
            log_format="simple",
        )


# Context manager for temporary log level changes
class LogLevelContext:
    """Context manager for temporarily changing log levels."""

    def __init__(self, logger_name: str, level: str):
        """
        Initialize log level context manager.

        Args:
            logger_name: Name of logger to modify
            level: Temporary log level
        """
        self.logger = logging.getLogger(logger_name)
        self.new_level = get_log_level(level)
        self.original_level = self.logger.level

    def __enter__(self) -> logging.Logger:
        """Enter context and set new log level."""
        self.logger.setLevel(self.new_level)
        return self.logger

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit context and restore original log level."""
        self.logger.setLevel(self.original_level)
