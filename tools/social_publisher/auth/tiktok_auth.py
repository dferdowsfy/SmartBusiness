"""TikTok OAuth2 (authorization code + PKCE) for the Content Posting API.

Until your TikTok Developer app passes TikTok's audit for the
video.publish scope, posts can only be published with privacy_level
SELF_ONLY (private, visible only to you) - see README.md.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
import webbrowser

import requests

from auth.local_redirect_server import capture_redirect_query
from config import TOKENS_DIR, TikTokConfig

AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
SCOPES = "video.publish,video.upload"
TOKEN_FILE = TOKENS_DIR / "tiktok.json"


def _code_verifier_and_challenge() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode("ascii")
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    )
    return verifier, challenge


def _port_from_redirect_uri(redirect_uri: str) -> int:
    return int(redirect_uri.rsplit(":", 1)[-1].split("/")[0])


def _save_token(payload: dict) -> dict:
    payload = dict(payload)
    payload["expires_at"] = time.time() + payload.get("expires_in", 0)
    TOKENS_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _refresh(config: TikTokConfig, refresh_token: str) -> dict | None:
    response = requests.post(
        TOKEN_URL,
        data={
            "client_key": config.client_key,
            "client_secret": config.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not response.ok:
        return None
    return _save_token(response.json())


def _load_cached_token(config: TikTokConfig) -> dict | None:
    if not TOKEN_FILE.exists():
        return None
    data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    if data.get("expires_at", 0) > time.time() + 60:
        return data
    if data.get("refresh_token"):
        return _refresh(config, data["refresh_token"])
    return None


def _run_authorization_flow(config: TikTokConfig) -> dict:
    port = _port_from_redirect_uri(config.redirect_uri)
    verifier, challenge = _code_verifier_and_challenge()
    state = secrets.token_urlsafe(16)
    params = {
        "client_key": config.client_key,
        "response_type": "code",
        "scope": SCOPES,
        "redirect_uri": config.redirect_uri,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    query = "&".join(f"{key}={requests.utils.quote(value)}" for key, value in params.items())
    auth_url = f"{AUTH_URL}?{query}"
    print(f"[tiktok] Opening browser for login:\n  {auth_url}")
    webbrowser.open(auth_url)

    result = capture_redirect_query(port)
    if result.get("state") != state:
        raise RuntimeError("TikTok OAuth state mismatch; aborting for safety.")
    if "code" not in result:
        raise RuntimeError(f"TikTok OAuth did not return a code: {result}")

    response = requests.post(
        TOKEN_URL,
        data={
            "client_key": config.client_key,
            "client_secret": config.client_secret,
            "code": result["code"],
            "grant_type": "authorization_code",
            "redirect_uri": config.redirect_uri,
            "code_verifier": verifier,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    response.raise_for_status()
    return _save_token(response.json())


def get_access_token(config: TikTokConfig) -> str:
    token = _load_cached_token(config) or _run_authorization_flow(config)
    return token["access_token"]


def is_connected(config: TikTokConfig) -> bool:
    """Non-interactive check: is there already a valid (or refreshable)
    cached token, without triggering the browser login flow?"""
    try:
        return _load_cached_token(config) is not None
    except Exception:
        return False
