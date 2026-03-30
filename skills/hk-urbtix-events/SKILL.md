# HK URBTIX Events Skill

Fetches upcoming event data from URBTIX (Hong Kong) and detects changes, filtering out noise.

## Tools

### `queryEvents`

Answers natural language questions about URBTIX events by parsing the query, fetching the appropriate batch XML, and returning matching performances. Handles date parsing (HK time), venue/name extraction, and validation.

**Parameters:**
- `question` (required): Natural language question about events, e.g., "When is Medea showing?", "Where is 美狄亞 on April 8?", "What performances are on 2026-04-10?"
- `force_refresh` (optional): If true, ignore cached XML and re-download. Default: false.

**Returns:** A dictionary with:
- `answer`: Human-readable answer with event details or clarification request
- `matches`: List of matching events (each with event_name_en, event_name_tc, venue, venue_tc, date, time, reference_link)
- `clarification_needed`: If unable to match, what additional info is needed

See README.md for full details.

## Installation

Place the skill directory under your OpenClaw workspace `skills/` and add `"hk-urbtix-events"` to the desired agent's `skills` array.

## Notes

- Uses URBTIX public XML feed; respectful polling recommended (≤1 call/hour without `force_refresh`).
- Caches daily batches in `$OPENCLAW_WORKSPACE/urbtix_cache/` to reduce load.
- No external dependencies (Python standard library only).

## Version

1.0.1
