"""Publish a video to TikTok via the Content Posting API (Direct Post,
FILE_UPLOAD source).

Notes:
- Unaudited API clients (the default until TikTok reviews your app) can
  only publish with privacy_level SELF_ONLY, capped at ~5 posting users
  per 24h and a per-creator cap of roughly 15 posts/day shared across all
  apps. See README.md and TikTok's Content Sharing Guidelines.
- This posts the whole file in a single chunk, which TikTok accepts for
  typical short-form video sizes. Very large files need chunked upload
  (multiple PUT requests), which this tool does not implement.
- Status value names below are TikTok's documented ones as of this
  writing; TikTok's API has changed field names before, so re-check
  https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status
  if status polling ever misbehaves.
"""
from __future__ import annotations

import os
import sys
import time

import requests

from auth.tiktok_auth import get_access_token
from config import TikTokConfig
from platforms.base import PublishResult

PLATFORM = "tiktok"
API_BASE = "https://open.tiktokapis.com/v2"
_ALLOWED_VIDEO_CONTENT_TYPES = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm"}
_TERMINAL_STATUSES = {"PUBLISH_COMPLETE", "FAILED"}


def _headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }


def _resolve_privacy_level(access_token: str, requested: str) -> str:
    """TikTok requires privacy_level to be one of the options the account/app
    is actually allowed to use; unaudited apps only get SELF_ONLY. Query
    creator_info and fall back rather than let the API call fail outright."""
    response = requests.post(
        f"{API_BASE}/post/publish/creator_info/query/", headers=_headers(access_token), timeout=30
    )
    response.raise_for_status()
    allowed = response.json().get("data", {}).get("privacy_level_options", [])
    if not allowed or requested in allowed:
        return requested
    fallback = "SELF_ONLY" if "SELF_ONLY" in allowed else allowed[0]
    print(
        f"[tiktok] Requested privacy_level '{requested}' isn't available for this "
        f"account/app (allowed: {allowed}); using '{fallback}' instead.",
        file=sys.stderr,
    )
    return fallback


def publish(video_path: str, caption: str, privacy_level: str = "SELF_ONLY") -> PublishResult:
    try:
        config = TikTokConfig.load()
        access_token = get_access_token(config)
        privacy_level = _resolve_privacy_level(access_token, privacy_level)

        video_size = os.path.getsize(video_path)
        content_type = _ALLOWED_VIDEO_CONTENT_TYPES.get(
            os.path.splitext(video_path)[1].lower(), "video/mp4"
        )

        init_response = requests.post(
            f"{API_BASE}/post/publish/video/init/",
            headers=_headers(access_token),
            json={
                "post_info": {
                    "title": caption[:2200],
                    "privacy_level": privacy_level,
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": video_size,
                    "chunk_size": video_size,
                    "total_chunk_count": 1,
                },
            },
            timeout=30,
        )
        init_response.raise_for_status()
        init_data = init_response.json()["data"]
        upload_url = init_data["upload_url"]
        publish_id = init_data["publish_id"]

        with open(video_path, "rb") as handle:
            video_bytes = handle.read()
        upload_response = requests.put(
            upload_url,
            data=video_bytes,
            headers={
                "Content-Type": content_type,
                "Content-Length": str(video_size),
                "Content-Range": f"bytes 0-{video_size - 1}/{video_size}",
            },
            timeout=300,
        )
        upload_response.raise_for_status()

        status = _wait_for_publish(access_token, publish_id)
        if status.get("status") != "PUBLISH_COMPLETE":
            return PublishResult(
                platform=PLATFORM,
                success=False,
                error=status.get("fail_reason") or f"status={status.get('status', 'UNKNOWN')}",
            )
        return PublishResult(
            platform=PLATFORM,
            success=True,
            post_id=publish_id,
            url=status.get("publicaly_available_post_id"),
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure to the CLI report instead of crashing
        return PublishResult(platform=PLATFORM, success=False, error=str(exc))


def _wait_for_publish(access_token: str, publish_id: str, timeout_seconds: int = 120) -> dict:
    deadline = time.time() + timeout_seconds
    data: dict = {"status": "TIMEOUT"}
    while time.time() < deadline:
        response = requests.post(
            f"{API_BASE}/post/publish/status/fetch/",
            headers=_headers(access_token),
            json={"publish_id": publish_id},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()["data"]
        if data.get("status") in _TERMINAL_STATUSES:
            return data
        time.sleep(3)
    return data
