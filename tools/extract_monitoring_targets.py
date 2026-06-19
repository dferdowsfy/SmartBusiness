#!/usr/bin/env python3
"""Extract municipalities, industries, and business types for monitoring agents.

The script reads the canonical Puerto Rico knowledge-base seed files in data/
and writes a single JSON payload that monitoring agents can consume to decide
which municipality/industry/business-type combinations need document research.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = DATA / "monitoring_targets.json"
SOURCES = DATA / "monitoring_sources.json"


def load_json(name: str) -> list[dict[str, Any]]:
    with (DATA / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    municipalities = sorted(load_json("municipalities.json"), key=lambda item: item["name"])
    industries = sorted(load_json("industries.json"), key=lambda item: item["name"])
    business_types = sorted(load_json("business_types.json"), key=lambda item: item["name"])
    monitoring_sources = json.loads(SOURCES.read_text(encoding="utf-8"))

    industries_by_id = {industry["id"]: industry for industry in industries}
    business_types_by_industry: dict[str, list[dict[str, str]]] = defaultdict(list)

    for business_type in business_types:
        industry = industries_by_id[business_type["industry_id"]]
        business_types_by_industry[industry["id"]].append(
            {
                "id": business_type["id"],
                "name": business_type["name"],
                "description": business_type.get("description", ""),
            }
        )

    industry_payload = []
    for industry in industries:
        industry_payload.append(
            {
                "id": industry["id"],
                "name": industry["name"],
                "description": industry.get("description", ""),
                "business_types": business_types_by_industry[industry["id"]],
            }
        )

    payload = {
        "metadata": {
            "jurisdiction": "Puerto Rico",
            "municipality_count": len(municipalities),
            "industry_count": len(industries),
            "business_type_count": len(business_types),
            "monitoring_source_count": monitoring_sources["metadata"]["source_count"],
            "source_files": [
                "data/municipalities.json",
                "data/industries.json",
                "data/business_types.json",
                "data/monitoring_sources.json",
            ],
        },
        "municipalities": municipalities,
        "industries": industry_payload,
        "monitoring_sources": monitoring_sources["sources"],
        "business_types": [
            {
                "id": business_type["id"],
                "name": business_type["name"],
                "industry_id": business_type["industry_id"],
                "industry_name": industries_by_id[business_type["industry_id"]]["name"],
                "description": business_type.get("description", ""),
            }
            for business_type in business_types
        ],
    }

    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT.relative_to(ROOT)} with "
        f"{len(municipalities)} municipalities, {len(industries)} industries, "
        f"{len(business_types)} business types, and "
        f"{monitoring_sources['metadata']['source_count']} monitoring sources."
    )


if __name__ == "__main__":
    main()
