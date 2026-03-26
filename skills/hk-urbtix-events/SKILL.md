# HK URBTIX Events Skill

Intelligent query of URBTIX event batch data using natural language questions. Parses date, event name, and venue from the query, downloads and validates the appropriate batch XML from the Hong Kong Transport Department's CDN, and returns matching performances with complete details (date, time, venue, event name, and ticket links).

## Features

- **Natural language understanding**: Extracts date (HK time), event name keywords, and venue from questions
- **Smart caching**: Downloads XML batches once per date and reuses locally (15-minute TTL)
- **Robust validation**: Checks SEND_DATE and TOTAL count match expected values
- **Retry logic**: 2 retries on download failures with cleanup of partial files
- **Progressive clarification**: Asks for more details if matches are ambiguous or missing
- **Bilingual output**: Returns both English and Chinese event names when available
- **Security**: No external API keys needed; uses official HK government data source with strict input sanitization

## Tools

### `queryEvents(params)`

Answer questions about URBTIX events by parsing the query, fetching the appropriate batch XML, and returning matching performances.

**Parameters (object):**
- `question` (string, required): Natural language question about events, e.g.:
  - "When is Medea showing?"
  - "Where is 美狄亞 on April 8?"
  - "What performances are on 2026-04-10 at Hong Kong Cultural Centre?"
- `force_refresh` (boolean, optional): If true, ignore cached XML and re-download. Default: `false`.

**Returns (object):**
```json
{
  "answer": "Human-readable answer text (Traditional Chinese preferred)",
  "matches": [
    {
      "event_name_en": "Medea",
      "event_name_tc": "美狄亞",
      "venue": "HONG KONG CULTURAL CENTRE",
      "venue_tc": "香港文化中心",
      "date": "2026-04-08",
      "time": "20:00",
      "reference_link": "https://www.urbtix.hk/performance-detail?eventId=14615&performanceId=65586"
    }
  ],
  "clarification_needed": null // or string describing what additional info is needed
}
```

## Data Source

- **Source**: URBTIX batch feed hosted on HK Transport Department COS bucket
- **URL pattern**: `https://fs-open-1304240968.cos.ap-hongkong.myqcloud.com/prod/gprd/URBTIX_eventBatch_<YYYYMMDD>.xml`
- **Batch size**: ~205 events per day
- **Format**: XML with `<EVENT>` entries containing multiple `<PERFORMANCE>` records

## Caching & Validation

- **Cache location**: `<workspace>/urbtix_cache/URBTIX_eventBatch_<YYYYMMDD>.xml`
- **Validation checks**:
  1. `<SEND_DATE>` must match the filename date
  2. `<TOTAL>` count must equal the actual number of `<EVENT>` elements
- On validation failure, file is deleted and download retried (up to 2 times)
- If all retries fail, user is notified to try again later

## Query Parsing

The skill extracts:
- **Date**: YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, or defaults to **today** (the date when the question is asked, in HK time GMT+8)
- **Venue**: Recognizes common URBTIX venues (Hong Kong Cultural Centre, Ko Shan Theatre, HK Academy for Performing Arts, etc.) via alias matching
- **Event name**: Remaining keywords after removing date and venue tokens; used to match against `EVENT_EG` and `EVENT_TC` fields

If the query yields insufficient keywords or no matches are found in the current valid XML batch, the skill will ask the user for more specific information (e.g., exact date, full event name, or specific venue). The assumption is that the current, valid XML batch should contain the answer if the query is specific enough.

## Security & Hardening

- **Rate limiting**: At most one download per XML batch per HK day (24h). Prevents abuse and respects upstream server.
- **No past-date downloads**: Cannot download batches for dates prior to today (HK time). Only current/future dates are fetchable.
- **Automatic cache purging**: Downloaded XML files older than 7 days are silently purged by a background task. No user notification.
- **No credential storage**: All data from public APIs
- **Input sanitization**: All extracted keywords used only for string matching; no command injection
- **Rate limiting**: One download per date per cache TTL (15 minutes); respects upstream servers
- **File handling**: Partial downloads stored as `.tmp` and cleaned up on failure; only valid files moved to cache
- **User privacy**: No personal data collected or transmitted

## Installation

1. Copy the `hk-urbtix-events` directory to your OpenClaw workspace `skills/` folder
2. Ensure Python 3.8+ is available (uses only standard library)
3. Add `"hk-urbtix-events"` to the desired agent's `skills` list in agent configuration
4. Restart the agent

## Usage Example

```json
{
  "question": "When is 美狄亞 showing in April?"
}
```

**Response:**
```json
{
  "answer": "找到 8 場符合條件的演出：\n• 中英劇團《美狄亞》\n  日期：2026-04-04 20:00\n  場地：香港文化中心\n  連結：https://www.urbtix.hk/performance-detail?eventId=14615&performanceId=65584\n• ...",
  "matches": [ ... ],
  "clarification_needed": null
}
```

## Limitations & Future Improvements

- **Date range**: Only one batch file per calendar date; multi-day queries require multiple downloads
- **Venue recognition**: Limited to common venues; can be extended by updating the `venues` dictionary
- **Language**: Output in Traditional Chinese by default, but event names may be in English only if Chinese not provided by source
- **Cache TTL**: Currently indefinite until cache clear; could add time-based expiration (e.g., 1 day)

## Version History

### v1.0.0 (2026-03-26)
- Initial release
- Full query parsing, download, validation, and search pipeline
- Progressive clarification for ambiguous queries
- Bilingual event details with ticket links

## Author

Steven Ho  
GitHub: https://github.com/StevenHo1394/openclaw/tree/main/skills/hk-urbtix-events
