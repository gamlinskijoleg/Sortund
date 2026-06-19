from pydantic import (
    BaseModel,
    Field,
)
from typing import (
    List,
    Optional,
)


class YTMetadata(BaseModel):
    extra_info: List[str] = Field(default_factory=list)
    source: str
    title: str
    artist: str
    year: Optional[int] = None


class AnalyzeResult(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    artwork: Optional[str] = None
    genre: Optional[str] = None
    date: Optional[str] = None
    rating: Optional[str] = None
    analysis_source: str
    tags: List[str] = Field(default_factory=list)
