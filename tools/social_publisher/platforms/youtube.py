"""Publish a video to YouTube via the Data API v3 (videos.insert).

A vertical (9:16 or square) video under ~3 minutes is automatically
treated by YouTube as a Short; no special API field is required for that.
Each upload costs 1600 quota units against the default 10,000/day quota
(~6 uploads/day) unless you request a quota increase from Google.
"""
from __future__ import annotations

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from auth.youtube_auth import get_credentials
from config import YouTubeConfig
from platforms.base import PublishResult

PLATFORM = "youtube"


def publish(
    video_path: str,
    title: str,
    description: str = "",
    privacy_status: str = "public",
    tags: list[str] | None = None,
) -> PublishResult:
    try:
        config = YouTubeConfig.load()
        creds = get_credentials(config)
        youtube = build("youtube", "v3", credentials=creds)

        body = {
            "snippet": {
                "title": title[:100],
                "description": description,
                "tags": tags or [],
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }
        media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype="video/*")
        request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

        response = None
        while response is None:
            _, response = request.next_chunk()

        video_id = response["id"]
        return PublishResult(
            platform=PLATFORM,
            success=True,
            post_id=video_id,
            url=f"https://youtube.com/watch?v={video_id}",
        )
    except HttpError as exc:
        return PublishResult(platform=PLATFORM, success=False, error=str(exc))
    except Exception as exc:  # noqa: BLE001 - surface any failure to the CLI report instead of crashing
        return PublishResult(platform=PLATFORM, success=False, error=str(exc))
