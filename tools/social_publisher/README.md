# Social Publisher

A standalone tool that cross-posts one video to **TikTok**, **YouTube**,
and **Instagram** at the same time, using each platform's official
publishing API. Two ways to use it: a command line (`publish.py`) or a
local browser page (`webapp.py`) where you just drag a video in and click
Post - both share the same setup and the same `auth/`/`platforms/` code
underneath.

This lives in `tools/social_publisher/` as a self-contained utility - it is
independent of the SmartPR licensing application (different purpose,
different dependencies, no shared code or database).

> **This tool cannot post anywhere until you create a developer app on
> each platform and get its API keys.** That step is unavoidable and only
> you can do it (it's tied to your own accounts). Setup below.

## What this does and doesn't do

- Uploads your video file directly to **TikTok** and **YouTube**.
- Publishes to **Instagram** as a Reel - but Instagram's API only accepts a
  **public video URL**, not a file upload, so you must host the video
  somewhere reachable (S3, Cloud Storage, your own site) and pass that URL.
- Posts to all selected platforms **concurrently** (not one after another)
  and prints a per-platform success/failure report at the end.
- Does **not** create accounts, bypass app review, or fake engagement -
  it's a thin wrapper around each platform's own publishing API, subject to
  all of that platform's real restrictions (see below).

## Known platform restrictions (not bugs in this tool)

- **TikTok**: until your TikTok Developer app passes TikTok's audit, the
  Content Posting API only allows `privacy_level=SELF_ONLY` - your video
  uploads but is only visible to you (a private draft), capped at roughly
  15 posts/day per creator. This tool defaults to `SELF_ONLY` and will
  auto-downgrade any other privacy level your app isn't allowed to use.
  Request an audit from TikTok once you're ready for public posting.
- **Instagram**: your account must be a **Business or Creator** account
  (not Personal). The video must be reachable at a public URL, ≤90 seconds,
  MP4/MOV with H.264 video + AAC audio (other formats tend to fail silently
  with error code 24). Accounts are capped at ~100 API-published posts per
  rolling 24-hour window.
- **YouTube**: works immediately for your own account in OAuth "Testing"
  mode (no Google review needed for personal use). Each upload costs 1600
  quota units against the default 10,000/day project quota (~6 uploads/day)
  unless you request a quota increase.

## One-time setup

### 1. Install dependencies

```bash
cd tools/social_publisher
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

You'll fill in `.env` as you complete each platform's steps below.

### 2. YouTube (Google Cloud)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/),
   create (or pick) a project, and enable **YouTube Data API v3** under
   "APIs & Services".
2. Configure the **OAuth consent screen** as "External", and add your own
   Google account under "Test users". This keeps the app in Testing mode,
   which is enough for personal use - no Google verification review needed.
3. Under "Credentials", create an **OAuth client ID** of type **Desktop
   app**, then download its JSON file.
4. Set `YOUTUBE_CLIENT_SECRETS_FILE` in `.env` to that file's path (keep it
   outside the repo, or somewhere already covered by `.gitignore`).

The first time you run the tool, a browser window opens for you to log in
and grant access; a refresh token is then cached in `tokens/youtube.json`
so you won't need to log in again.

### 3. TikTok (TikTok for Developers)

1. Go to [developers.tiktok.com/apps](https://developers.tiktok.com/apps)
   and create an app.
2. Add the **Content Posting API** product, requesting the `video.publish`
   and `video.upload` scopes.
3. Under Login Kit, add `http://localhost:8722/callback` (or whatever you
   set `TIKTOK_REDIRECT_URI` to) as a redirect URI.
4. Copy the app's **Client Key** and **Client Secret** into `.env` as
   `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
5. Your app starts **unaudited**: posts publish successfully but stay
   private (`SELF_ONLY`) until you request and pass TikTok's audit for
   public posting. See TikTok's [Content Sharing
   Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

### 4. Instagram (Meta for Developers)

1. Make sure your Instagram account is a **Business or Creator** account
   (Settings → Account type, in the Instagram app).
2. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps),
   create an app, and add the **Instagram** product configured for
   **Business Login for Instagram** (also called "Instagram API with
   Instagram Login") - this does not require linking a Facebook Page.
3. Add yourself as a **tester/admin** on the app (App roles) so you can log
   in and publish before/without full App Review.
4. Add `http://localhost:8723/callback` (or your `META_REDIRECT_URI`) as a
   valid OAuth redirect URI on the Instagram product's settings.
5. Copy the **Instagram App ID** and **App Secret** into `.env` as
   `META_APP_ID` / `META_APP_SECRET`.

The first run opens a browser for you to log in with Instagram directly
(no Facebook login involved); the account id needed for publishing is
auto-discovered and cached alongside the token in `tokens/instagram.json`.

> If your OAuth provider rejects a plain `http://localhost` redirect URI,
> tunnel it instead (e.g. with `ngrok http 8723`) and use the HTTPS URL it
> gives you as both the redirect URI in the developer console and in
> `META_REDIRECT_URI`.

## Usage: web UI (upload in browser)

```bash
cd tools/social_publisher
uvicorn webapp:app --port 8000
```

Open http://localhost:8000 - it shows a Connect button per platform
(click once, log in in the browser tab that opens, done), then a drag-and-drop
box for the video, a shared caption box, per-platform overrides under
"Per-platform options", and a **Post to all** button. Results (link or
error, per platform) show up right below it.

This binds to localhost only and has no login of its own - anyone who can
reach that port can post using your already-connected accounts. That's the
right tradeoff for running it on your own machine; don't expose it beyond
localhost without adding real authentication first.

**Instagram from the web UI needs one extra thing.** Its API only accepts
a public URL for the video, never a raw upload - TikTok and YouTube don't
have this requirement, so they work with no extra setup. To make Instagram
work too, set one of these in `.env` (see the comments in `.env.example`):
- `PUBLIC_BASE_URL`, if you deploy `webapp.py` somewhere with a real
  public domain, or
- `NGROK_AUTHTOKEN` (plus `pip install pyngrok`) to auto-tunnel a public
  HTTPS URL to your local server for the duration of each Instagram post.

Without either, YouTube and TikTok still post normally - only Instagram's
result will report that it needs a public URL.

## Usage: command line

```bash
# Post to all three at once, with one shared caption:
python publish.py my_video.mp4 \
  --caption "Launch day!" \
  --instagram-video-url https://cdn.example.com/my_video.mp4

# Only YouTube and TikTok, with platform-specific text:
python publish.py my_video.mp4 \
  --platforms youtube,tiktok \
  --youtube-title "Launch day!" --youtube-privacy unlisted \
  --tiktok-caption "Launch day 🚀"
```

Run `python publish.py --help` for the full flag list (per-platform
caption/title overrides, YouTube tags and privacy, TikTok privacy level).
Unlike the web UI, the CLI takes Instagram's video URL directly as a flag,
so it needs no tunnel/deployment - you provide a URL you already host.

The tool exits non-zero if any selected platform failed, and prints which
one and why:

```
Results:
  [OK]   youtube   -> https://youtube.com/watch?v=abc123
  [OK]   tiktok    -> None
  [FAIL] instagram -> Container never finished processing (status=ERROR)
```

## Where things are stored

- `tokens/` - cached OAuth tokens per platform (git-ignored). Delete a file
  there to force that platform to re-authenticate.
- `.env` - your credentials (git-ignored). Never commit this file.

## Troubleshooting

- **TikTok error mentioning `unaudited_client_can_only_post_to_private_accounts`**
  - you requested a privacy level your app isn't approved for; this tool
  auto-downgrades to `SELF_ONLY` for you, but double-check `--tiktok-privacy`.
- **Instagram `status=ERROR` or error code 24** - almost always the video
  file: re-encode to MP4/H.264+AAC, keep it ≤90 seconds, and confirm the
  URL you passed is actually publicly reachable (test it in an incognito
  browser tab).
- **These APIs change.** Field names and endpoints here reflect each
  platform's documented behavior as of this tool's last update. If a call
  starts failing with an unrecognized-field error, check the platform's
  current docs before assuming this tool is broken:
  - TikTok: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
  - Instagram: https://developers.facebook.com/docs/instagram-platform/content-publishing/
  - YouTube: https://developers.google.com/youtube/v3/docs/videos/insert
