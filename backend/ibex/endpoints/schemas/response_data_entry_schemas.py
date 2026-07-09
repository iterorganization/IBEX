from pydantic import BaseModel, Field
from pathlib import Path

# ========== URI FROM PATH ==========


class UriFromPathResponse(BaseModel):
    """Response for /data_entry/uri_from_path endpoint"""

    uri: str | Path = Field(description="IMAS URI", examples=["imas:mdsplus?path=my_path", "imas:hdf5?path=my_path"])


# ========== EXISTS ==========


class ExistsResponse(BaseModel):
    """Response for /data_entry/exists endpoint"""

    exists: bool = Field(description="True if data entry exists and can be opened", examples=[True, False])


# ========== LIST IDSES ==========


class ExistingIdsModel(BaseModel):
    """Intermediate model for /data_entry/list_idses endpoint"""

    name: str = Field(description="IDS name", examples=["core_profiles", "barometry", "equilibrium"])
    occurrences: list[int] = Field(description="List of filled occurrences", examples=[[0, 1, 2]])


class ListIdsesResponse(BaseModel):
    """Response for /data_entry/list_idses endpoint"""

    idses: list[ExistingIdsModel] = Field(description="List of filled occurences")


# ========== AVAILABLE ENTRIES ==========


class AvailableEntriesResponse(BaseModel):
    """Response for /data_entry/available_entries endpoint"""

    entries: list[str] = Field(description="List of pulsefile URIs", examples=[["uri1...", "uri2...", "...", "uriN"]])
