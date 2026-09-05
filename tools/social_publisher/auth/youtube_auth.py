"""YouTube OAuth: obtains and caches user credentials for the Data API v3.

First run opens a browser for consent and caches the resulting refresh
token in tokens/youtube.json; later runs refresh silently.
"""
from __future__ import annotations

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from config import TOKENS_DIR, YouTubeConfig

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_FILE = TOKENS_DIR / "youtube.json"


def get_credentials(config: YouTubeConfig) -> Credentials:
    TOKENS_DIR.mkdir(parents=True, exist_ok=True)
    creds: Credentials | None = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())

    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(config.client_secrets_file, SCOPES)
        creds = flow.run_local_server(port=0)

    TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return creds
