"""Shared result type returned by every platform publisher."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PublishResult:
    platform: str
    success: bool
    post_id: str | None = None
    url: str | None = None
    error: str | None = None
