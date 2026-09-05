"""Local web UI for social_publisher: upload a video once, post it to
TikTok, YouTube, and Instagram at the same time from your browser.

Run from inside tools/social_publisher/:
    uvicorn webapp:app --port 8000
then open http://localhost:8000

This is a thin front end over the same auth/ and platforms/ modules
publish.py (the CLI) uses - same setup, same platform restrictions. See
README.md.

Security note: this binds to localhost only (uvicorn's default) and has
no login of its own - anyone who can reach the port can trigger a post
using your cached tokens. Fine for local personal use; add real
authentication before exposing this beyond localhost.
"""
from __future__ import annotations

import mimetypes
import os
import shutil
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from auth import instagram_auth, tiktok_auth, youtube_auth
from config import InstagramConfig, TikTokConfig, YouTubeConfig
from platforms import instagram, tiktok, youtube
from platforms.base import PublishResult

STATIC_DIR = Path(__file__).resolve().parent / "static"
WEBAPP_PORT = int(os.environ.get("SOCIAL_PUBLISHER_PORT", "8000"))

app = FastAPI(title="Social Publisher")

_served_files: dict[str, Path] = {}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/status")
def status() -> JSONResponse:
    return JSONResponse(
        {
            "youtube": _status_for(YouTubeConfig, lambda _config: youtube_auth.is_connected()),
            "tiktok": _status_for(TikTokConfig, tiktok_auth.is_connected),
            "instagram": _status_for(InstagramConfig, lambda _config: instagram_auth.is_connected()),
        }
    )


def _status_for(config_cls, is_connected_fn) -> str:
    try:
        config = config_cls.load()
    except RuntimeError:
        return "not_configured"
    try:
        connected = is_connected_fn(config)
    except Exception:
        connected = False
    return "connected" if connected else "not_connected"


@app.post("/api/connect/{platform}")
def connect(platform: str) -> JSONResponse:
    try:
        if platform == "youtube":
            youtube_auth.get_credentials(YouTubeConfig.load())
        elif platform == "tiktok":
            tiktok_auth.get_access_token(TikTokConfig.load())
        elif platform == "instagram":
            instagram_auth.get_session(InstagramConfig.load())
        else:
            return JSONResponse({"error": f"Unknown platform '{platform}'"}, status_code=400)
    except Exception as exc:  # noqa: BLE001 - report to the UI instead of a bare 500
        return JSONResponse({"error": str(exc)}, status_code=400)
    return JSONResponse({"status": "connected"})


@app.get("/media/{token}", response_model=None)
def media(token: str):
    path = _served_files.get(token)
    if not path or not path.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    media_type = mimetypes.guess_type(str(path))[0] or "video/mp4"
    return FileResponse(path, media_type=media_type)


def _public_video_url(token: str) -> tuple[str | None, object | None]:
    """Instagram's API only accepts a public URL, never a raw upload. This
    app only has one to offer if it's deployed publicly (PUBLIC_BASE_URL)
    or an ngrok tunnel is configured (NGROK_AUTHTOKEN). Returns
    (url, ngrok_tunnel_or_None) - the tunnel, if any, must stay open until
    Instagram has finished fetching the file."""
    public_base = os.environ.get("PUBLIC_BASE_URL")
    if public_base:
        return f"{public_base.rstrip('/')}/media/{token}", None

    if not os.environ.get("NGROK_AUTHTOKEN"):
        return None, None

    try:
        from pyngrok import conf, ngrok
    except ImportError:
        return None, None

    conf.get_default().auth_token = os.environ["NGROK_AUTHTOKEN"]
    tunnel = ngrok.connect(WEBAPP_PORT, proto="http", bind_tls=True)
    return f"{tunnel.public_url}/media/{token}", tunnel


@app.post("/api/publish")
def publish_endpoint(
    video: UploadFile,
    platforms: str = Form(...),
    caption: str = Form(""),
    youtube_title: str = Form(""),
    youtube_description: str = Form(""),
    youtube_privacy: str = Form("public"),
    youtube_tags: str = Form(""),
    tiktok_caption: str = Form(""),
    tiktok_privacy: str = Form("SELF_ONLY"),
    instagram_caption: str = Form(""),
) -> JSONResponse:
    selected = [p.strip() for p in platforms.split(",") if p.strip()]

    tmp_dir = Path(tempfile.mkdtemp(prefix="social_publisher_"))
    video_path = tmp_dir / (video.filename or "upload.mp4")
    with video_path.open("wb") as handle:
        shutil.copyfileobj(video.file, handle)

    token = uuid.uuid4().hex
    _served_files[token] = video_path

    ig_url, ig_tunnel = (None, None)
    if "instagram" in selected:
        ig_url, ig_tunnel = _public_video_url(token)

    def run_youtube() -> PublishResult:
        return youtube.publish(
            video_path=str(video_path),
            title=(youtube_title or caption or video_path.stem)[:100],
            description=youtube_description or caption,
            privacy_status=youtube_privacy,
            tags=[tag.strip() for tag in youtube_tags.split(",") if tag.strip()],
        )

    def run_tiktok() -> PublishResult:
        return tiktok.publish(
            video_path=str(video_path), caption=tiktok_caption or caption, privacy_level=tiktok_privacy
        )

    def run_instagram() -> PublishResult:
        if not ig_url:
            return PublishResult(
                platform="instagram",
                success=False,
                error=(
                    "No public URL available for the video. Set PUBLIC_BASE_URL "
                    "in .env if this app is deployed publicly, or `pip install "
                    "pyngrok` and set NGROK_AUTHTOKEN to auto-tunnel - see README.md."
                ),
            )
        return instagram.publish(video_url=ig_url, caption=instagram_caption or caption)

    runners = {"youtube": run_youtube, "tiktok": run_tiktok, "instagram": run_instagram}
    try:
        with ThreadPoolExecutor(max_workers=max(len(selected), 1)) as executor:
            futures = [executor.submit(runners[platform]) for platform in selected if platform in runners]
            results = [future.result() for future in futures]
    finally:
        if ig_tunnel is not None:
            from pyngrok import ngrok

            ngrok.disconnect(ig_tunnel.public_url)
        _served_files.pop(token, None)
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return JSONResponse(
        {
            "results": [
                {
                    "platform": result.platform,
                    "success": result.success,
                    "post_id": result.post_id,
                    "url": result.url,
                    "error": result.error,
                }
                for result in results
            ]
        }
    )
