# URBTIX Events Skill

Fetches upcoming event data from URBTIX (Hong Kong) and detects changes, filtering out noise.

4. Ensure the agent's workspace directory is writable; the skill creates a `urbtix_cache` subfolder for caching.
## Data Source

Primary: URBTIX website's JavaScript data blob (embedded JSON)
Fallback: Direct XML download (if available)

## Tools

### `get_events_hk`

Fetches events for Hong Kong with optional filtering.

**Parameters:**
- `category` (optional): Filter by category (e.g., "music", "theatre")
- `days_ahead` (optional): Number of days to look ahead (default: 30)
- `force_refresh` (optional): Bypass cache and fetch fresh data (default: false)

**Returns:** A dictionary with:
- `events`: List of event dicts (title, date, venue, code, url, etc.)
- `newly_added`: List of events that weren't in previous cache
- `cancelled`: List of codes that were removed
- `metadata`: Timestamp, source, cache status

### `get_events_au`

Fetches Australia events (same schema).

## Caching & Performance

- Caches raw XML batches per day to reduce load on URBTIX servers
- Cache location: `$OPENCLA W_WORKSPACE/urbtix_cache/URBTIX_eventBatch_YYYYMMDD.xml`
- Cache TTL: 1 day by default
- Network fetch timeout: 10s

## Installation

1. Ensure skill directory exists: `$OPENCLAW_WORKSPACE/skills/hk-urbtix-events/`
2. No dependencies required (uses Python standard library)
3. Add `"hk-urbtix-events"` to the desired agent's `skills` array (Joey recommended)

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
