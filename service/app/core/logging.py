import logging


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    for noisy_logger in ("tensorflow", "uvicorn.access"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

