#!/usr/bin/env python3
"""
HK Green Minibus Arrival Skill
Security-hardened version 1.1.0

Security fixes applied:
- T09: Command injection prevention - input validation at schema + runtime level
- E1: External transmission - allowlisted domains only, no data exfiltration
- LP3: Least privilege - explicit permission declarations in manifest
- SSRF: URL allowlist validation before any network request
- Cache security: sanitized cache names, validated data structures
- Error sanitization: generic user-facing errors, detailed errors logged only
"""
import sys
import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error
import difflib
import re
from datetime import datetime

# ============================================================
# SECURITY CONFIGURATION - Allowlisted domains and paths
# ============================================================
ALLOWED_DOMAINS = frozenset({
    "data.etagmb.gov.hk",
    "data.hkbus.app",
    "hkbus.github.io",
})

# Compile patterns for URL validation
_ALLOWED_URL_PATTERNS = (
    re.compile(r"^https://data\.etagmb\.gov\.hk/"),
    re.compile(r"^https://data\.hkbus\.app/"),
    re.compile(r"^https://hkbus\.github\.io/"),
)

# Base URLs - MUST be in ALLOWED_DOMAINS
BASE = "https://data.etagmb.gov.hk"
ROUTEFARELIST_URL = "https://data.hkbus.app/routeFareList.min.json"
# Fallback to GitHub source if primary fails
ROUTEFARELIST_FALLBACK = "https://hkbus.github.io/hk-bus-crawling/routeFareList.min.json"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, "data")
os.makedirs(CACHE_DIR, exist_ok=True)

# Input validation constants
VALID_REGIONS = frozenset({"HKI", "KLN", "NT"})
VALID_DIRECTIONS = frozenset({"1", "2"})
ROUTE_NUMBER_PATTERN = re.compile(r"^\d{1,3}$")
MAX_STOP_NAME_LEN = 100
MAX_CACHE_NAME_LEN = 64
CACHE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")

# Generic error messages for user-facing output
GENERIC_ERRORS = {
    "network": "Failed to fetch data. Please try again later.",
    "route_not_found": "Route not found.",
    "stop_not_found": "Stop not found on this route.",
    "no_eta": "No active arrival data at the moment.",
    "invalid_input": "Invalid request parameters.",
    "internal": "An error occurred. Please try again later.",
}

# ============================================================
# SECURITY HELPERS
# ============================================================
def _validate_url(url: str) -> bool:
    """Validate URL against allowlist to prevent SSRF."""
    if not url or not isinstance(url, str):
        return False
    for pattern in _ALLOWED_URL_PATTERNS:
        if pattern.match(url):
            return True
    return False


def _sanitize_cache_name(name: str) -> str:
    """Sanitize cache filename to prevent path traversal."""
    if not name or not isinstance(name, str):
        return "invalid"
    # Remove directory separators and dangerous chars
    safe = re.sub(r"[/\\.:]", "_", name)
    # Keep only alphanumeric and underscore
    safe = re.sub(r"[^a-zA-Z0-9_]", "", safe)
    # Truncate
    return safe[:MAX_CACHE_NAME_LEN] or "cache"


def _validate_cache_data(data) -> bool:
    """Validate cached data structure is a dict (not list/str/etc)."""
    return isinstance(data, dict)


def _generic_error(key: str, detail: str = None) -> dict:
    """Return generic user-facing error; log detail internally."""
    if detail:
        print(f"[ERROR] {key}: {detail}", file=sys.stderr)
    return {"error": GENERIC_ERRORS.get(key, GENERIC_ERRORS["internal"])}


def _validate_input(route: str, direction: str, stop_name: str, region: str) -> dict | None:
    """Validate all user inputs. Return error dict if invalid, None if valid."""
    if not ROUTE_NUMBER_PATTERN.match(route):
        return _generic_error("invalid_input", f"invalid route format: {route}")
    if direction not in VALID_DIRECTIONS:
        return _generic_error("invalid_input", f"invalid direction: {direction}")
    if region not in VALID_REGIONS:
        return _generic_error("invalid_input", f"invalid region: {region}")
    if not stop_name or not isinstance(stop_name, str):
        return _generic_error("invalid_input", "missing stop_name")
    if len(stop_name) > MAX_STOP_NAME_LEN:
        return _generic_error("invalid_input", "stop_name too long")
    # Reject control characters
    if re.search(r"[\x00-\x1f\x7f]", stop_name):
        return _generic_error("invalid_input", "stop_name contains control chars")
    return None


# ============================================================
# CACHE OPERATIONS (hardened)
# ============================================================
def load_cache(name: str, default=None):
    """Load cache with validation. Returns default on corruption."""
    safe_name = _sanitize_cache_name(name)
    path = os.path.join(CACHE_DIR, safe_name)
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                data = json.load(f)
            if not _validate_cache_data(data):
                print(f"[WARN] Cache {safe_name}: invalid structure, ignoring", file=sys.stderr)
                return default
            return data
        except (json.JSONDecodeError, OSError) as e:
            print(f"[WARN] Cache read error {safe_name}: {e}", file=sys.stderr)
            return default
    return default


def save_cache(name: str, data):
    """Save cache with validation and error logging."""
    safe_name = _sanitize_cache_name(name)
    if not _validate_cache_data(data):
        print(f"[WARN] Cache save refused {safe_name}: invalid data structure", file=sys.stderr)
        return
    path = os.path.join(CACHE_DIR, safe_name)
    try:
        with open(path, "w") as f:
            json.dump(data, f)
    except OSError as e:
        print(f"[WARN] Cache write error {safe_name}: {e}", file=sys.stderr)


# ============================================================
# NETWORK OPERATIONS (with URL validation)
# ============================================================
def fetch_json(url: str, cache_name: str = None, ttl: int = 3600):
    """Fetch JSON from allowlisted URL with optional file caching."""
    if not _validate_url(url):
        raise ValueError(f"URL not in allowlist: {url}")

    if cache_name:
        cached = load_cache(cache_name)
        if cached:
            if time.time() - cached.get("_timestamp", 0) < ttl:
                return cached.get("data")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; OpenClawSkill/1.0)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.load(resp)
        if cache_name:
            save_cache(cache_name, {"_timestamp": time.time(), "data": data})
        return data
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP {e.code} fetching {url}")
    except urllib.error.URLError as e:
        raise Exception(f"Network error fetching {url}: {e}")
    except Exception as e:
        raise Exception(f"Fetch failed {url}: {e}")


def get_routes_all():
    """Fetch all routes list: /route (no param) returns regions with route codes."""
    return fetch_json(BASE + "/route", cache_name="routes_all.json", ttl=3600)


def get_route_details(region: str, route: str):
    """Fetch route details for region/route. Cached per key for 5 minutes."""
    if region not in VALID_REGIONS or not ROUTE_NUMBER_PATTERN.match(route):
        raise ValueError("Invalid region or route")
    key = f"{region}_{route}"
    cache = load_cache("route_details.json", default={})
    if key in cache:
        entry = cache[key]
        if time.time() - entry.get("_ts", 0) < 300:
            return entry["data"]
    url = f"{BASE}/route/{urllib.parse.quote(region)}/{urllib.parse.quote(route)}"
    if not _validate_url(url):
        raise ValueError("Constructed URL not in allowlist")
    data = fetch_json(url)
    cache[key] = {"_ts": time.time(), "data": data}
    save_cache("route_details.json", cache)
    return data


def get_stop_names(stop_id: str):
    """Fetch stop names for a stop ID via /stop-route/{stop_id}."""
    if not stop_id or not stop_id.isdigit():
        return {"en": "", "zh": ""}
    stop_cache = load_cache("stop_names.json", default={})
    if stop_id in stop_cache:
        return stop_cache[stop_id]
    url = f"{BASE}/stop-route/{urllib.parse.quote(stop_id)}"
    if not _validate_url(url):
        raise ValueError("Constructed URL not in allowlist")
    try:
        resp = fetch_json(url, ttl=86400 * 7)
        data_list = resp.get("data", []) if isinstance(resp, dict) else []
        if data_list:
            entry = data_list[0]
            names = {
                "en": entry.get("name_en") or "",
                "zh": entry.get("name_tc") or entry.get("name_sc") or "",
            }
            stop_cache[stop_id] = names
            save_cache("stop_names.json", stop_cache)
            return names
    except Exception as e:
        print(f"[WARN] Error fetching stop {stop_id}: {e}", file=sys.stderr)
    return {"en": "", "zh": ""}


def get_eta(stop_id: str):
    """Fetch ETA for a stop."""
    if not stop_id or not stop_id.isdigit():
        raise ValueError("Invalid stop_id")
    url = f"{BASE}/eta/stop/{urllib.parse.quote(stop_id)}"
    if not _validate_url(url):
        raise ValueError("Constructed URL not in allowlist")
    return fetch_json(url, ttl=30)


# ============================================================
# BUSINESS LOGIC
# ============================================================
def search_routes(route: str):
    """Search for route number across all regions."""
    # Input validation
    if not ROUTE_NUMBER_PATTERN.match(route):
        return {"route": route, "found": False, "error": GENERIC_ERRORS["invalid_input"]}
    try:
        routes_all = get_routes_all()
    except Exception as e:
        return _generic_error("network", str(e))
    regions_data = routes_all.get("data", {}).get("routes", {})
    matches = []
    for region, rlist in regions_data.items():
        if route in rlist:
            matches.append(region)
    if matches:
        return {"route": route, "found": True, "regions": matches}
    else:
        all_routes = set()
        for rlist in regions_data.values():
            all_routes.update(rlist)
        suggestions = difflib.get_close_matches(route, sorted(all_routes), n=5, cutoff=0.6)
        return {"route": route, "found": False, "suggestions": suggestions}


def get_gmb_arrival(route: str, direction: str, stop_name: str, region: str):
    """Main function: given route, direction (1/2), stop name, region, return arrivals."""
    # Validate all inputs first
    validation_error = _validate_input(route, direction, stop_name, region)
    if validation_error:
        return validation_error

    # Get route details
    try:
        details = get_route_details(region, route)
    except Exception as e:
        return _generic_error("network", str(e))

    # Extract route_id and matching direction
    all_directions = []
    route_id = None
    for entry in details.get("data", []):
        if route_id is None and "route_id" in entry:
            route_id = entry.get("route_id")
        if "directions" in entry:
            for d in entry["directions"]:
                all_directions.append(d)
        elif "route_seq" in entry:
            all_directions.append(entry)

    dir_data = None
    for d in all_directions:
        if str(d.get("route_seq")) == direction:
            dir_data = d
            break

    if not dir_data or route_id is None:
        return _generic_error("route_not_found", f"direction {direction} not found for route {route}")

    orig_en = dir_data.get("orig_en", "")
    dest_en = dir_data.get("dest_en", "")

    # Load routeFareList (with fallback)
    try:
        rfl = fetch_json(ROUTEFARELIST_URL, cache_name="routeFareList.json", ttl=86400)
    except Exception:
        try:
            rfl = fetch_json(ROUTEFARELIST_FALLBACK, cache_name="routeFareList.json", ttl=86400)
        except Exception as e:
            return _generic_error("network", str(e))

    route_list = rfl.get("routeList", {})
    composite_key = f"{route}+1+{orig_en}+{dest_en}"
    route_entry = route_list.get(composite_key)

    if not route_entry:
        # Fallback: search for any matching entry
        for key, entry in route_list.items():
            if (entry.get("co") and "gmb" in entry.get("co")
                    and entry.get("route") == route):
                orig_match = (entry.get("orig", {}).get("en") == orig_en
                              and entry.get("dest", {}).get("en") == dest_en)
                if orig_match:
                    route_entry = entry
                    break

    if not route_entry:
        return _generic_error("route_not_found", f"route entry not found: {composite_key}")

    if "gmb" not in route_entry.get("co", []):
        return _generic_error("route_not_found", "route is not GMB in static data")

    stop_ids = route_entry.get("stops", {}).get("gmb", [])
    if not stop_ids:
        return _generic_error("route_not_found", "no stop IDs in static data")

    # Match stop name (exact first, then fuzzy)
    target = stop_name.strip().lower()
    matched_sid = None
    matched_names = []

    for sid in stop_ids:
        names = get_stop_names(sid)
        en = names.get("en", "").lower()
        zh = names.get("zh", "").lower()
        if target == en or target == zh:
            matched_sid = sid
            matched_names = [names.get("en"), names.get("zh")]
            break

    if not matched_sid:
        # Fuzzy match
        all_candidates = []
        for sid in stop_ids:
            names = get_stop_names(sid)
            en = names.get("en", "")
            zh = names.get("zh", "")
            if en:
                all_candidates.append((en, zh, sid))
            elif zh:
                all_candidates.append(("", zh, sid))
        name_list = [c[0] if c[0] else c[1] for c in all_candidates]
        suggestions = difflib.get_close_matches(stop_name, name_list, n=5, cutoff=0.6)
        if suggestions:
            sug_map = {}
            for sug in suggestions:
                for en, zh, sid in all_candidates:
                    if (en and en == sug) or (zh and zh == sug):
                        sug_map[sug] = sid
                        break
            return {"error": GENERIC_ERRORS["stop_not_found"], "suggestions": sug_map}
        else:
            return _generic_error("stop_not_found")

    # Get ETA
    try:
        eta_data = get_eta(matched_sid)
    except Exception as e:
        return _generic_error("network", str(e))

    # Filter for our route_id and direction
    entries = []
    for item in eta_data.get("data", []):
        if item.get("route_id") == route_id and str(item.get("route_seq")) == direction:
            entries.append(item)

    if not entries:
        return {"stopId": matched_sid,
                "stopName": matched_names[0] if matched_names else "",
                "arrivals": [],
                "message": GENERIC_ERRORS["no_eta"]}

    entry = entries[0]
    eta_items = entry.get("eta", [])
    arrivals = []
    for eta_item in eta_items[:3]:
        ts = eta_item.get("timestamp")
        if ts:
            try:
                dt = datetime.fromisoformat(ts)
                time_str = dt.strftime("%H:%M")
                arrivals.append(f"{time_str} HKT")
            except Exception:
                diff = eta_item.get("diff")
                if diff is not None:
                    arrivals.append(f"In {diff} min")
                else:
                    arrivals.append("Unknown")

    return {"stopId": matched_sid,
            "stopName": matched_names[0] if matched_names else "",
            "arrivals": arrivals}


# ============================================================
# CLI ENTRY POINT
# ============================================================
def main():
    if len(sys.argv) < 2:
        print(json.dumps(_generic_error("invalid_input", "no subcommand")))
        sys.exit(1)

    subcmd = sys.argv[1]

    if subcmd == "searchRoutes":
        if len(sys.argv) < 3:
            print(json.dumps(_generic_error("invalid_input", "missing route")))
            sys.exit(1)
        route = sys.argv[2]
        result = search_routes(route)
        print(json.dumps(result, ensure_ascii=False))

    elif subcmd == "getGMBArrival":
        if len(sys.argv) < 6:
            print(json.dumps(_generic_error("invalid_input", "missing arguments")))
            sys.exit(1)
        route = sys.argv[2]
        direction = sys.argv[3]
        stop_name = sys.argv[4]
        region = sys.argv[5]
        result = get_gmb_arrival(route, direction, stop_name, region)
        print(json.dumps(result, ensure_ascii=False))

    else:
        print(json.dumps(_generic_error("invalid_input", f"unknown subcommand: {subcmd}")))
        sys.exit(1)


if __name__ == "__main__":
    main()