#!/usr/bin/env python3
"""Cross-post one video to TikTok, YouTube, and Instagram at the same time.

One-time setup (developer apps, API keys, and each platform's posting
restrictions) is in README.md - read it before your first run.

Examples:
    python publish.py my_video.mp4 --caption "Launch day!" \\
        --instagram-video-url https://cdn.example.com/my_video.mp4

    python publish.py my_video.mp4 --platforms youtube,tiktok \\
        --youtube-title "Launch day!" --youtube-privacy unlisted
"""
from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from platforms import instagram, tiktok, youtube
from platforms.base import PublishResult

ALL_PLATFORMS = ("tiktok", "youtube", "instagram")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("video", help="Path to the local video file (used for TikTok and YouTube).")
    parser.add_argument(
        "--platforms",
        default=",".join(ALL_PLATFORMS),
        help=f"Comma-separated subset of {list(ALL_PLATFORMS)} to post to (default: all).",
    )
    parser.add_argument(
        "--caption",
        default="",
        help="Shared caption/title used for any platform without a more specific flag below.",
    )

    parser.add_argument("--youtube-title", help="Defaults to --caption (truncated to 100 chars).")
    parser.add_argument("--youtube-description", help="Defaults to --caption.")
    parser.add_argument(
        "--youtube-privacy", default="public", choices=["public", "unlisted", "private"]
    )
    parser.add_argument("--youtube-tags", default="", help="Comma-separated YouTube tags.")

    parser.add_argument("--tiktok-caption", help="Defaults to --caption.")
    parser.add_argument(
        "--tiktok-privacy",
        default="SELF_ONLY",
        choices=["SELF_ONLY", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR"],
        help=(
            "SELF_ONLY (private) is the only option TikTok allows until your app "
            "passes their audit - see README.md. Anything else is auto-downgraded "
            "if your app/account isn't allowed to use it."
        ),
    )

    parser.add_argument(
        "--instagram-video-url",
        help=(
            "Public URL Instagram can fetch the video from - required to post to "
            "Instagram, since its API does not accept direct file uploads."
        ),
    )
    parser.add_argument("--instagram-caption", help="Defaults to --caption.")

    args = parser.parse_args(argv)
    args.platforms = [platform.strip() for platform in args.platforms.split(",") if platform.strip()]
    for platform in args.platforms:
        if platform not in ALL_PLATFORMS:
            parser.error(f"Unknown platform '{platform}'. Choose from {list(ALL_PLATFORMS)}.")
    if "instagram" in args.platforms and not args.instagram_video_url:
        parser.error("--instagram-video-url is required to post to Instagram (see README.md).")
    return args


def _run_youtube(args: argparse.Namespace) -> PublishResult:
    return youtube.publish(
        video_path=args.video,
        title=(args.youtube_title or args.caption or Path(args.video).stem)[:100],
        description=args.youtube_description or args.caption,
        privacy_status=args.youtube_privacy,
        tags=[tag.strip() for tag in args.youtube_tags.split(",") if tag.strip()],
    )


def _run_tiktok(args: argparse.Namespace) -> PublishResult:
    return tiktok.publish(
        video_path=args.video,
        caption=args.tiktok_caption or args.caption,
        privacy_level=args.tiktok_privacy,
    )


def _run_instagram(args: argparse.Namespace) -> PublishResult:
    return instagram.publish(
        video_url=args.instagram_video_url,
        caption=args.instagram_caption or args.caption,
    )


_RUNNERS = {"youtube": _run_youtube, "tiktok": _run_tiktok, "instagram": _run_instagram}


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not Path(args.video).is_file():
        print(f"Video file not found: {args.video}", file=sys.stderr)
        return 1

    with ThreadPoolExecutor(max_workers=len(args.platforms)) as executor:
        futures = [executor.submit(_RUNNERS[platform], args) for platform in args.platforms]
        results = [future.result() for future in futures]

    print("\nResults:")
    exit_code = 0
    for result in results:
        if result.success:
            location = result.url or result.post_id or "posted"
            print(f"  [OK]   {result.platform:9s} -> {location}")
        else:
            exit_code = 1
            print(f"  [FAIL] {result.platform:9s} -> {result.error}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
