"""Instagram OAuth using "Instagram API with Instagram Login" (Business Login
for Instagram) - no linked Facebook Page required, just an Instagram
Business or Creator account.

Flow: authorize at api.instagram.com -> short-lived token -> exchange for a
60-day long-lived token -> cache it and the account's ig user id.
"""
from __future__ import annotations

import json
import time
import webbrowser

import requests

from auth.local_redirect_server import capture_redirect_query
from config import TOKENS_DIR, InstagramConfig

AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize"
SHORT_LIVED_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
GRAPH_BASE = "https://graph.instagram.com"
SCOPES = "instagram_business_basic,instagram_business_content_publish"
TOKEN_FILE = TOKENS_DIR / "instagram.json"


def _port_from_redirect_uri(redirect_uri: str) -> int:
    return int(redirect_uri.rsplit(":", 1)[-1].split("/")[0])


def _save_token(access_token: str, expires_in: int, ig_user_id: str) -> dict:
    TOKENS_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "access_token": access_token,
        "expires_at": time.time() + expires_in,
        "ig_user_id": ig_user_id,
    }
    TOKEN_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def _load_cached_token() -> dict | None:
    if not TOKEN_FILE.exists():
        return None
    data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    if data.get("expires_at", 0) > time.time() + 60:
        return data
    return _refresh(data["access_token"]) if data.get("access_token") else None


def _refresh(long_lived_token: str) -> dict | None:
    response = requests.get(
        f"{GRAPH_BASE}/refresh_access_token",
        params={"grant_type": "ig_refresh_token", "access_token": long_lived_token},
        timeout=30,
    )
    if not response.ok:
        return None
    payload = response.json()
    ig_user_id = _resolve_ig_user_id(payload["access_token"])
    return _save_token(payload["access_token"], payload.get("expires_in", 60 * 24 * 3600), ig_user_id)


def _resolve_ig_user_id(access_token: str) -> str:
    response = requests.get(
        f"{GRAPH_BASE}/me", params={"fields": "id,username", "access_token": access_token}, timeout=30
    )
    response.raise_for_status()
    return response.json()["id"]


def _run_authorization_flow(config: InstagramConfig) -> dict:
    port = _port_from_redirect_uri(config.redirect_uri)
    params = {
        "client_id": config.app_id,
        "redirect_uri": config.redirect_uri,
        "scope": SCOPES,
        "response_type": "code",
    }
    query = "&".join(f"{key}={requests.utils.quote(value)}" for key, value in params.items())
    auth_url = f"{AUTHORIZE_URL}?{query}"
    print(f"[instagram] Opening browser for login:\n  {auth_url}")
    webbrowser.open(auth_url)

    result = capture_redirect_query(port)
    if "code" not in result:
        raise RuntimeError(f"Instagram OAuth did not return a code: {result}")
    # Instagram appends "#_" to the redirected code; strip it if present.
    code = result["code"].removesuffix("#_")

    short_lived = requests.post(
        SHORT_LIVED_TOKEN_URL,
        data={
            "client_id": config.app_id,
            "client_secret": config.app_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.redirect_uri,
            "code": code,
        },
        timeout=30,
    )
    short_lived.raise_for_status()
    short_token = short_lived.json()["access_token"]

    long_lived = requests.get(
        f"{GRAPH_BASE}/access_token",
        params={
            "grant_type": "ig_exchange_token",
            "client_secret": config.app_secret,
            "access_token": short_token,
        },
        timeout=30,
    )
    long_lived.raise_for_status()
    payload = long_lived.json()
    long_token = payload["access_token"]

    ig_user_id = _resolve_ig_user_id(long_token)
    return _save_token(long_token, payload.get("expires_in", 60 * 24 * 3600), ig_user_id)


def get_session(config: InstagramConfig) -> tuple[str, str]:
    """Returns (access_token, ig_user_id)."""
    token = _load_cached_token() or _run_authorization_flow(config)
    ig_user_id = config.ig_user_id_override or token["ig_user_id"]
    return token["access_token"], ig_user_id


def is_connected() -> bool:
    """Non-interactive check: is there already a valid (or refreshable)
    cached token, without triggering the browser login flow?"""
    try:
        return _load_cached_token() is not None
    except Exception:
        return False
