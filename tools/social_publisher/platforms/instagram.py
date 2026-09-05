"""Publish a Reel to Instagram via the Graph API (Instagram Login variant).

Instagram fetches the video from a public URL - it does not accept raw
file uploads, so the caller must host the file (S3, Cloud Storage, your
own site, etc.) and pass its URL. API-published Reels are capped at 90
seconds and must be MP4/MOV with H.264 video + AAC audio; other formats
tend to fail with error code 24. Accounts are limited to 100
API-published posts per rolling 24h window.
"""
from __future__ import annotations

import time

import requests

from auth.instagram_auth import get_session
from config import InstagramConfig
from platforms.base import PublishResult

PLATFORM = "instagram"
GRAPH_BASE = "https://graph.instagram.com"
_TERMINAL_STATUSES = {"FINISHED", "PUBLISHED", "ERROR", "EXPIRED"}


def publish(video_url: str, caption: str) -> PublishResult:
    try:
        config = InstagramConfig.load()
        access_token, ig_user_id = get_session(config)

        create_response = requests.post(
            f"{GRAPH_BASE}/{ig_user_id}/media",
            data={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "access_token": access_token,
            },
            timeout=30,
        )
        create_response.raise_for_status()
        container_id = create_response.json()["id"]

        status = _wait_until_ready(container_id, access_token)
        if status not in {"FINISHED", "PUBLISHED"}:
            return PublishResult(
                platform=PLATFORM,
                success=False,
                error=f"Container never finished processing (status={status})",
            )

        publish_response = requests.post(
            f"{GRAPH_BASE}/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token},
            timeout=30,
        )
        publish_response.raise_for_status()
        media_id = publish_response.json()["id"]
        return PublishResult(platform=PLATFORM, success=True, post_id=media_id)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the CLI report instead of crashing
        return PublishResult(platform=PLATFORM, success=False, error=str(exc))


def _wait_until_ready(container_id: str, access_token: str, timeout_seconds: int = 180) -> str:
    deadline = time.time() + timeout_seconds
    status = "IN_PROGRESS"
    while time.time() < deadline:
        response = requests.get(
            f"{GRAPH_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": access_token},
            timeout=30,
        )
        response.raise_for_status()
        status = response.json().get("status_code", "IN_PROGRESS")
        if status in _TERMINAL_STATUSES:
            return status
        time.sleep(5)
    return status
