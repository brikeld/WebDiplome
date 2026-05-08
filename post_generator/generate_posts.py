"""
Generate productivity posts using a local LM Studio instance.

This module is standalone: it reads local data files and sends a single
chat-completions request to an OpenAI-compatible endpoint exposed by LM Studio.
"""


# google/gemma-4-26b-a4b

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

# ── Config ──────────────────────────────────────────────────────────────────
# Replace these before running.
LM_STUDIO_IP = "127.0.0.1"
LM_STUDIO_PORT = 1234
LM_STUDIO_MODEL = "google/gemma-4-26b-a4b"  # replace with model name shown in LM Studio
DATA_PATH = "data/data.json"
USER_PATH = "data/user.json"
OUTPUT_PATH = "data/generated_posts.json"

# ── Constants ───────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are the productivity module of a social scoring platform. 
You publish short, clinical, slightly judgmental public posts about users based on their activity data. 
Tone: cold, analytical, passive-aggressive. 
POV: first person singular. Write as "I" / "me" when speaking about the user's behavior. Never address the user as "he/she" and never use the user's name.
Format: 2 sentences max. No hashtags. No emojis. No intro, just the post."""


# ── Helpers ─────────────────────────────────────────────────────────────────
def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def first(lst: Optional[List[Any]]) -> Optional[Any]:
    return lst[0] if lst else None


def build_snapshot(data: Optional[Dict[str, Any]], user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    d = data or {}
    u = user or {}

    # Convenient handles into known sections (may be missing)
    identity = d.get("MACHINE_IDENTITY", {}) if isinstance(d, dict) else {}
    past = d.get("PAST_HISTORY", {}) if isinstance(d, dict) else {}
    scoring = d.get("SCORING_DATA", {}) if isinstance(d, dict) else {}
    activity = scoring.get("axe_comportement_productif", {}) if isinstance(scoring, dict) else {}
    app_usage = activity.get("app_category_usage", {}) if isinstance(activity, dict) else {}
    consumption = scoring.get("axe_profil_consommation", {}).get("consumption_profile", {}) if isinstance(scoring, dict) else {}
    sleep = scoring.get("axe_sommeil_rythme", {}).get("sleep_rhythm_signals", {}) if isinstance(scoring, dict) else {}

    installed_apps = identity.get("installed_apps", [])
    storage = identity.get("storage", {})

    # Most used apps: take top 3 from recently_used_apps_7days if present.
    top_apps = None
    if isinstance(app_usage, dict):
        recent = app_usage.get("recently_used_apps_7days")
        if isinstance(recent, list):
            top_apps = [entry.get("app") for entry in recent[:3] if isinstance(entry, dict)]
    if top_apps is None:
        top_apps = []

    snapshot = {
        "user": {
            "username": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or None,
            "global_score": d.get("global_score") or d.get("GLOBAL_SCORE"),
            "score_change": d.get("score_change"),
        },
        "activity": {
            "first_active": None,  # not present in current data.json
            "last_active": None,   # not present in current data.json
            "most_used_apps": top_apps or None,
            "app_breakdown": None,  # no time-spent breakdown available
        },
        "behavior": {
            "estimated_sleep_hours": sleep.get("sleep_hours") if isinstance(sleep, dict) else None,
            "nocturnal_sessions": sleep.get("night_sessions") if isinstance(sleep, dict) else None,
            "browser_tabs_open": None,
            "unread_notifications": None,
            "clipboard_activity_types": None,
        },
        "device": {
            "storage_used_percent": storage.get("use_percent"),
            "apps_installed_count": len(installed_apps) if isinstance(installed_apps, list) else None,
            "camera_mic_permission_apps": None,
        },
        "social": {
            "interactions_today": None,
            "interactions_week": None,
            "users_with_higher_score": None,
        },
        "predictions": {
            "expected_login_tomorrow": None,
            "predicted_activity_type": None,
            "risk_flags": None,
        },
    }

    return snapshot


def build_messages(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    user_prompt = (
        "Here is the full user profile snapshot:\n"
        f"{json.dumps(snapshot, indent=2, ensure_ascii=False)}\n\n"
        "Based on this data, generate a public productivity post about this user.\n"
        "Write strictly in first person singular (no second person, no third person). "
        "Focus on the most revealing productivity-related data points."
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def call_lm_studio(messages: List[Dict[str, str]]) -> str:
    url = f"http://{LM_STUDIO_IP}:{LM_STUDIO_PORT}/v1/chat/completions"
    payload = {
        "model": LM_STUDIO_MODEL,
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": 150,
    }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        content = first(data.get("choices")) or {}
        msg = content.get("message", {}) if isinstance(content, dict) else {}
        text = msg.get("content")
        if not text:
            raise ValueError("No content in LM Studio response")
        return text.strip()
    except Exception as e:
        raise RuntimeError(f"LM Studio call failed: {e}") from e


def append_output(post: str, category: str = "productivity") -> None:
    root = project_root()
    out_path = root / OUTPUT_PATH
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = []
        if out_path.exists():
            with out_path.open("r", encoding="utf-8") as f:
                existing = json.load(f)
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "category": category,
        "post": post,
    }
    existing.append(entry)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)


def main() -> int:
    root = project_root()
    data = load_json(root / DATA_PATH)
    user = load_json(root / USER_PATH)

    if data is None:
        print(f"[warning] Missing data file at {root / DATA_PATH}")
    if user is None:
        print(f"[warning] Missing user file at {root / USER_PATH}")

    snapshot = build_snapshot(data, user)
    messages = build_messages(snapshot)

    try:
        post = call_lm_studio(messages)
    except Exception as e:
        print(f"[error] {e}")
        return 1

    print("\n=== Generated Productivity Post ===\n")
    print(post)
    print("\n===================================\n")

    try:
        append_output(post, category="productivity")
    except Exception as e:
        print(f"[warning] Failed to write output file: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
