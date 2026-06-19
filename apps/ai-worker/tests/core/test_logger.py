import pytest
import logging
import sys
from unittest.mock import patch, MagicMock
from app.core.logger import setup_logging


def test_setup_logging_success():
    # Reset logger handlers for testing
    logger = logging.getLogger("sortund-ai-pipeline")
    logger.handlers = []

    setup_logging()

    # Assert handlers were added
    assert len(logger.handlers) > 0
    assert logger.level == logging.INFO


def test_setup_logging_exception_handling():
    logger = logging.getLogger("sortund-ai-pipeline")
    logger.handlers = []

    # Mock sys.stdout.fileno to raise an Exception, triggering lines 22-23
    with patch(
        "sys.stdout.fileno",
        side_effect=Exception("Mock Exception"),
    ):
        setup_logging()

    # Assert handlers were still added despite exception
    assert len(logger.handlers) > 0
    assert logger.level == logging.INFO
