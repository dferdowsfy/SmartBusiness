"""Configuration loading for the social_publisher CLI.

Reads credentials from environment variables (populated from a local .env
file via python-dotenv). See README.md for how to obtain each value.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
TOKENS_DIR = ROOT / "tokens"

load_dotenv(ROOT / ".env")


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "Copy .env.example to .env in tools/social_publisher/ and fill it "
            "in (see README.md for where each value comes from)."
        )
    return value


@dataclass(frozen=True)
class YouTubeConfig:
    client_secrets_file: str

    @classmethod
    def load(cls) -> "YouTubeConfig":
        return cls(client_secrets_file=_require("YOUTUBE_CLIENT_SECRETS_FILE"))


@dataclass(frozen=True)
class TikTokConfig:
    client_key: str
    client_secret: str
    redirect_uri: str

    @classmethod
    def load(cls) -> "TikTokConfig":
        return cls(
            client_key=_require("TIKTOK_CLIENT_KEY"),
            client_secret=_require("TIKTOK_CLIENT_SECRET"),
            redirect_uri=os.environ.get("TIKTOK_REDIRECT_URI", "http://localhost:8722/callback"),
        )


@dataclass(frozen=True)
class InstagramConfig:
    app_id: str
    app_secret: str
    redirect_uri: str
    ig_user_id_override: str | None

    @classmethod
    def load(cls) -> "InstagramConfig":
        return cls(
            app_id=_require("META_APP_ID"),
            app_secret=_require("META_APP_SECRET"),
            redirect_uri=os.environ.get("META_REDIRECT_URI", "http://localhost:8723/callback"),
            ig_user_id_override=os.environ.get("IG_USER_ID") or None,
        )
