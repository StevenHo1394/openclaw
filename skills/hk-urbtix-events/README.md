# URBTIX Events Skill

Fetches upcoming event data from URBTIX (Hong Kong) and detects changes, filtering out noise.

## Prerequisites

Ensure the agent's workspace directory is writable; the skill creates a `urbtix_cache` subfolder for caching.

## Data Source

Primary: URBTIX website's JavaScript data blob (embedded JSON)
Fallback: Direct XML download (if available)

## Tools

### `queryEvents`

Answers natural language questions about URBTIX events by parsing the query, fetching the appropriate batch XML, and returning matching performances. Handles date parsing (HK time), venue/name extraction, and validation.

**Parameters:**
- `question` (required): Natural language question about events, e.g., "When is Medea showing?", "Where is 美狄亞 on April 8?", "What performances are on 2026-04-10?"
- `force_refresh` (optional): If true, ignore cached XML and re-download. Default: false.

**Returns:** A dictionary with:
- `answer`: Human-readable answer with event details or clarification request
- `matches`: List of matching events, each containing:
  - `event_name_en`: English event title
  - `event_name_tc`: Traditional Chinese event title
  - `venue`: Venue name (English)
  - `venue_tc`: Venue name (Traditional Chinese)
  - `date`: Performance date (YYYY-MM-DD)
  - `time`: Performance time (HH:MM)
  - `reference_link`: URL to official booking page
- `clarification_needed`: If unable to match, what additional info is needed

## Caching & Performance

- Caches raw XML batches per day to reduce load on URBTIX servers
- Cache location: `$OPENCLAW_WORKSPACE/urbtix_cache/URBTIX_eventBatch_YYYYMMDD.xml`
- Cache TTL: 1 day by default
- Network fetch timeout: 10s

## Installation

1. Ensure skill directory exists: `$OPENCLAW_WORKSPACE/skills/hk-urbtix-events/`
2. No dependencies required (uses Python standard library)
3. Add `"hk-urbtix-events"` to the desired agent's `skills` array (Jax recommended)

## Development

Run tests:
```bash
python3 test_skill.py   # unit tests
python3 full_test.py    # integration test (fetches live data)
```

These scripts will also test cache creation and network resilience.

## Notes

- Respectful polling: Do not call more than once per hour without `force_refresh`.
- URBTIX does not provide official API; this skill scrapes public pages. Use responsibly.
- Event data is subject to change; always verify with official source before purchasing tickets.
