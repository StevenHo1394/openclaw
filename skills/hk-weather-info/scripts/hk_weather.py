#!/usr/bin/env python3
"""
HK Weather Info — HKO OpenData API client.
Usage: python3 hk_weather.py [--region REGION] [--lang en|tc|sc] [--action current|forecast|all]

Examples:
  python3 hk_weather.py                           # General HK weather, English
  python3 hk_weather.py --region "Tsuen Wan"      # Regional weather
  python3 hk_weather.py --lang tc                   # Traditional Chinese
  python3 hk_weather.py --region "Central" --lang tc --action all
  python3 hk_weather.py --action current            # Current weather only
  python3 hk_weather.py --action forecast           # Forecast only
"""
import os, sys, json, urllib.request, urllib.error, argparse, re
from datetime import datetime, timedelta

# HKO OpenData API — free, no key required
BASE_URL = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php"

# Cache settings
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".hk_weather_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_TTL_SECONDS = 600  # 10 minutes

LANG_CHOICES = ["en", "tc", "sc"]


def fetch_json(data_type, lang="en"):
    """Fetch from HKO API with simple file cache."""
    cache_file = os.path.join(CACHE_DIR, f"{data_type}_{lang}.json")

    # Check cache
    if os.path.exists(cache_file):
        age = datetime.now().timestamp() - os.path.getmtime(cache_file)
        if age < CACHE_TTL_SECONDS:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)

    # Fetch fresh
    url = f"{BASE_URL}?dataType={data_type}&lang={lang}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "hk-weather-info/1.0.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        # Save cache
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        return data
    except Exception as e:
        # Try to use stale cache if available
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"error": str(e)}


def match_region(data_list, region):
    """Match region to a data entry (case-insensitive partial match on 'place')."""
    if not region or not data_list:
        return None
    region_lower = region.lower()
    for entry in data_list:
        place = entry.get("place", "")
        if region_lower in place.lower():
            return entry
    return None


def format_current_weather(data, region=None):
    """Format current weather report."""
    lines = []

    # Temperature
    temp_data = data.get("temperature", {}).get("data", []) if isinstance(data.get("temperature"), dict) else data.get("temperature", [])
    if region:
        matched = match_region(temp_data, region)
        if matched:
            lines.append(f"🌡️ Temperature: {matched['value']}°{matched.get('unit', 'C')} ({matched['place']})")
        else:
            lines.append(f"🌡️ Temperature: No data for '{region}'. Showing all stations:")
            for t in temp_data[:5]:
                lines.append(f"   {t['place']}: {t['value']}°{t.get('unit', 'C')}")
    else:
        for t in temp_data[:5]:
            lines.append(f"🌡️ {t['place']}: {t['value']}°{t.get('unit', 'C')}")

    # Humidity
    humidity = data.get("humidity", {})
    if isinstance(humidity, dict):
        hum_data = humidity.get("data", [])
        if hum_data and isinstance(hum_data, list):
            h = hum_data[0]
            lines.append(f"💧 Humidity: {h.get('value', '?')}{h.get('unit', '%')}")
        elif humidity.get("value"):
            lines.append(f"💧 Humidity: {humidity.get('value', '?')}{humidity.get('unit', '%')}")
    elif isinstance(humidity, (int, float)):
        lines.append(f"💧 Humidity: {humidity}%")

    # Rainfall
    rainfall_data = data.get("rainfall", {}).get("data", []) if isinstance(data.get("rainfall"), dict) else data.get("rainfall", [])
    if region:
        matched = match_region(rainfall_data, region)
        if matched and "value" in matched:
            lines.append(f"🌧️ Rainfall: {matched['value']}{matched.get('unit', 'mm')} ({matched['place']})")
        else:
            lines.append(f"🌧️ Rainfall: No data for '{region}'")
    else:
        non_zero = [r for r in rainfall_data if float(r.get("value", 0)) > 0]
        if non_zero:
            for r in non_zero[:5]:
                lines.append(f"🌧️ {r['place']}: {r['value']}{r.get('unit', 'mm')}")
        else:
            lines.append("🌧️ Rainfall: No significant rainfall")

    # UV Index
    uv = data.get("uvindex", {})
    if uv and uv.get("data"):
        for u in uv["data"]:
            lines.append(f"☀️ UV Index: {u.get('value', '?')} ({u.get('place', '')})")

    # Weather icon
    icon = data.get("icon", [])
    if icon:
        lines.append(f"🌤️ Weather Icon: {icon[0] if isinstance(icon, list) else icon}")

    # Warning message
    warning = data.get("warningMessage", "")
    if warning:
        lines.append(f"⚠️ Active Warnings: {warning}")
    else:
        lines.append("⚠️ Active Warnings: None")

    # Rainstorm reminder
    reminder = data.get("rainstormReminder", "")
    if reminder:
        lines.append(f"🌧️ Rainstorm Reminder: {reminder}")

    # Update time
    update_time = data.get("updateTime", "")
    if update_time:
        lines.append(f"\n🕐 Last Updated: {update_time}")

    return "\n".join(lines)


def format_forecast(data):
    """Format local weather forecast."""
    lines = []

    # General situation
    general = data.get("generalSituation", "")
    if general:
        lines.append(f"📋 General Situation:\n{general}\n")

    # Forecast description
    forecast_desc = data.get("forecastDesc", "")
    if forecast_desc:
        lines.append(f"📅 Forecast:\n{forecast_desc}\n")

    # Tropical cyclone info
    tc_info = data.get("tcInfo", "")
    if tc_info:
        lines.append(f"🌀 Tropical Cyclone Info:\n{tc_info}\n")

    # Fire danger warning
    fire = data.get("fireDangerWarning", "")
    if fire:
        lines.append(f"🔥 Fire Danger Warning: {fire}\n")

    # Outlook
    outlook = data.get("outlook", "")
    if outlook:
        lines.append(f"🔮 Outlook:\n{outlook}\n")

    # Update time
    update_time = data.get("updateTime", "")
    if update_time:
        lines.append(f"🕐 Last Updated: {update_time}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="HK Weather Info — HKO OpenData")
    parser.add_argument("--region", type=str, default=None, help="Target region/district (e.g. 'Tsuen Wan', 'Central')")
    parser.add_argument("--lang", type=str, default="en", choices=LANG_CHOICES, help="Language: en, tc, or sc")
    parser.add_argument("--action", type=str, default="all", choices=["current", "forecast", "all"], help="What to fetch")
    args = parser.parse_args()

    region_display = args.region if args.region else "Hong Kong (General)"

    print(f"🇭🇰 HK Weather Info")
    print(f"   Region: {region_display}")
    print(f"   Language: {args.lang}")
    print("")

    if args.action in ("current", "all"):
        print("=" * 50)
        print("CURRENT WEATHER")
        print("=" * 50)
        current = fetch_json("rhrread", args.lang)
        if "error" in current:
            print(f"Error fetching current weather: {current['error']}")
        else:
            print(format_current_weather(current, args.region))
        print("")

    if args.action in ("forecast", "all"):
        print("=" * 50)
        print("LOCAL WEATHER FORECAST")
        print("=" * 50)
        forecast = fetch_json("flw", args.lang)
        if "error" in forecast:
            print(f"Error fetching forecast: {forecast['error']}")
        else:
            print(format_forecast(forecast))
        print("")


if __name__ == "__main__":
    main()
