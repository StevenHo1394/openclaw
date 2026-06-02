---
name: hk-weather-info
description: "Hong Kong weather information — current conditions, forecasts from HKO (Hong Kong Observatory). Use when user asks about HK weather, temperature, rainfall, or weather forecast."
version: 1.0.0
author: Steven Ho
license: MIT
github: https://github.com/StevenHo1394/openclaw/tree/main/skills/hk-weather-info
metadata:
  hermes:
    tags: [weather, hong-kong, hko, forecast, temperature, rainfall]
    related_skills: []
  openclaw:
    providers: [hko]
---

# HK Weather Info

## Overview

Hong Kong weather skill using HKO (Hong Kong Observatory) OpenData API. Provides current weather reports and local weather forecasts. Supports regional filtering and multilingual output (English, Traditional Chinese, Simplified Chinese).

## Data Source

HKO OpenData API — free, no API key required.
- Current weather: `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=<lang>`
- Forecast: `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=<lang>`

## Variables

| Variable | Description | Values |
|---|---|---|
| `HK_WEATHER_INFO_REGION` | Target region/district. If None, returns general HK weather. | e.g. `"Tsuen Wan"`, `"Central"`, `None` |
| `HK_WEATHER_INFO_LANG` | Language preference | `en` (English), `tc` (Traditional Chinese), `sc` (Simplified Chinese) |

## Step 1: Get User Input

### (a) Target region
Ask user for target region/district. If user refuses or says "general/whole HK", set `HK_WEATHER_INFO_REGION = None`.

### (b) Language preference
Ask user for language preference. One of:
- `en` — English
- `tc` — Traditional Chinese (繁體中文)
- `sc` — Simplified Chinese (简体中文)

Store as `HK_WEATHER_INFO_LANG`.

## Step 2: Workflow

### (a) Current weather report

Call:
```
GET https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=<HK_WEATHER_INFO_LANG>
```

The API returns JSON with:
- `temperature` — array of `{place, value, unit}`
- `humidity` — `{value, unit}`
- `rainfall` — array of `{place, value, unit}`
- `icon` — weather icon code
- `uvindex` — UV index (if available)
- `updateTime` — timestamp
- `warningMessage` — active warnings (string)
- `rainstormReminder` — rainstorm reminder (string)

**Regional filtering:** If `HK_WEATHER_INFO_REGION` is set (not None):
1. Search `temperature` array for entry where `place` matches the region (case-insensitive partial match)
2. Search `rainfall` array for entry where `place` matches the region
3. Display matched regional data

If no match found or `HK_WEATHER_INFO_REGION` is `None`:
- Display general HK weather (all temperature stations, all rainfall stations)

### (b) Local weather forecast

Call:
```
GET https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=<HK_WEATHER_INFO_LANG>
```

The API returns JSON with:
- `generalSituation` — general weather situation
- `forecastDesc` — forecast description
- `outlook` — outlook
- `forecastPeriod` — array of forecast periods with `forecast`, `weather`, `tempRange`, `rhRange`, `wind`
- `updateTime` — timestamp

**Regional filtering:** If `HK_WEATHER_INFO_REGION` is set:
- The forecast is territory-wide. Note the regional context when presenting.

Display today's and tomorrow's forecast by default.

## Output Format

### Current Weather
```
🌤️ Hong Kong Weather [Region if set]

Temperature: XX°C (Station Name)
Humidity: XX%
Rainfall: XXmm (Station Name)
[Weather Icon: XX]
UV Index: XX (if available)

Active Warnings: [warningMessage or "None"]
Rainstorm Reminder: [rainstormReminder or "None"]

Last Updated: <updateTime>
```

### Forecast
```
📅 Local Weather Forecast

General Situation: <generalSituation>

Today: <forecast> | <weather> | Temp: <tempRange>°C | Humidity: <rhRange>% | Wind: <wind>
Tomorrow: <forecast> | <weather> | Temp: <tempRange>°C | Humidity: <rhRange>% | Wind: <wind>

Outlook: <outlook>

Last Updated: <updateTime>
```

## Common Pitfalls

1. **No API key needed** — HKO OpenData is free and open
2. **Rate limiting** — respectful polling, cache results for 10-15 minutes
3. **Regional name matching** — use partial case-insensitive match. Some station names differ from district names
4. **UV index** — may be null at night or on cloudy days
5. **Warning message** — may be empty string if no warnings active
6. **Forecast language** — the `lang` parameter affects all text fields

## Verification Checklist

- [x] HKO OpenData API used (no API key)
- [x] Regional filtering implemented
- [x] Language preference supported (en/tc/sc)
- [x] Current weather and forecast both fetched
- [x] Output format defined
- [x] No external dependencies (Python stdlib only)
