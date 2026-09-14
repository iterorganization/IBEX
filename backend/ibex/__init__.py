"""IBEX backend main module"""

import logging
from ibex.setup_logging import connect_formatter

from ._version import version as version
from ._version import __version__ as __version__
from ._version import version_tuple as version_tuple

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)
connect_formatter(logger)
