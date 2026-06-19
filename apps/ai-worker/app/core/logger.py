import sys
import logging


def setup_logging():
    """Configures logging with UTF-8 support to prevent UnicodeEncodeError on Windows."""
    logger = logging.getLogger("sortund-ai-pipeline")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        # Force stream to write in UTF-8
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(message)s (%(filename)s:%(lineno)d)"
            )
        )
        try:
            stream_handler.stream = open(
                sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False
            )
        except Exception:
            pass
        logger.addHandler(stream_handler)
