"""IBEX FastApi entrypoint"""

from fastapi import FastAPI  # type: ignore
import logging  # type: ignore

from ibex.endpoints.data import router as data_router
from ibex.endpoints.data_entry import router as data_entry_router
from ibex.endpoints.ids_info import router as ids_info_router
from ibex.endpoints.info import router as info_router

from ibex.data_source.exception import IbexException


from .exception_handlers import general_exception_handler

logger = logging.getLogger(__name__)

app = FastAPI()

app.include_router(data_entry_router)
app.include_router(ids_info_router)
app.include_router(data_router)
app.include_router(info_router)

app.add_exception_handler(Exception, general_exception_handler)
app.add_exception_handler(ValueError, general_exception_handler)
app.add_exception_handler(KeyError, general_exception_handler)
app.add_exception_handler(RuntimeError, general_exception_handler)
app.add_exception_handler(NotImplementedError, general_exception_handler)

app.add_exception_handler(IbexException, general_exception_handler)


try:
    # add ALException handler only if imas-python was used as data source
    import imas

    app.add_exception_handler(imas.exception.ALException, general_exception_handler)
except ImportError:
    ...
