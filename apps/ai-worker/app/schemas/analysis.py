from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class YTMetadata(BaseModel):
    extra_info: List[str] = Field(default_factory=list)
    source: str
    title: str
    artist: str
    year: Optional[int] = None


class Recognition(BaseModel):
    """Result of acoustic-fingerprint recognition (Shazam)."""

    artist: str
    title: str
    artwork: Optional[str] = None
    isrc: Optional[str] = None
    shazam_key: Optional[str] = None


class FingerprintResult(BaseModel):
    fingerprint: str
    recognition: Optional[Recognition] = None


class LabelScore(BaseModel):
    label: str
    confidence: float


class Tag(BaseModel):
    label: str
    category: str  # genre | style | mood | instrument | vocal | language | theme
    confidence: float


class AnalyzeResult(BaseModel):
    fingerprint: str
    model_version: str

    # Metadata
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    artwork: Optional[str] = None
    year: Optional[int] = None
    date: Optional[str] = None
    metadata_source: str
    year_source: Optional[str] = None

    # Classification
    genre: Optional[str] = None
    genre_confidence: Optional[float] = None
    genre_scores: Dict[str, float] = Field(default_factory=dict)
    mood: Optional[str] = None
    mood_confidence: Optional[float] = None
    moods: List[LabelScore] = Field(default_factory=list)
    instruments: List[LabelScore] = Field(default_factory=list)
    vocal: Optional[str] = None
    vocal_confidence: Optional[float] = None
    language: Optional[str] = None
    language_confidence: Optional[float] = None
    lyrics: Optional[str] = None
    lyrics_source: Optional[str] = None
    themes: List[LabelScore] = Field(default_factory=list)
    bpm: Optional[float] = None
    key: Optional[str] = None
    key_confidence: Optional[float] = None
    tags: List[Tag] = Field(default_factory=list)

    # Vectors
    embedding: List[float] = Field(default_factory=list)
    features: List[float] = Field(default_factory=list)

    processing_ms: int = 0


class TrainSample(BaseModel):
    features: List[float]
    label: str


class TrainRequest(BaseModel):
    version: str
    samples: List[TrainSample] = Field(default_factory=list)


class TrainResponse(BaseModel):
    version: str
    metrics: Dict
    weights_b64: str


class UploadModelRequest(BaseModel):
    weights_b64: str
    metrics: Optional[Dict] = None


class ModelInfo(BaseModel):
    version: str
    metrics: Optional[Dict] = None
