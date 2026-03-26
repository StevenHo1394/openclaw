# HK URBTIX Events Skill

## Installation

1. Ensure skill directory exists: `/home/node/.openclaw/workspace/skills/hk-urbtix-events/`
2. No dependencies required (uses Python standard library)
3. Add `"hk-urbtix-events"` to the desired agent's `skills` array (Joey recommended)

## Usage for Agents

```python
# Example tool call
result = skill.tools.queryEvents({
  "question": "When is Medea showing at Hong Kong Cultural Centre?",
  "force_refresh": False
})
```

## Cache Management

- Cached XML files are stored in `workspace/urbtix_cache/`
- Files are named `URBTIX_eventBatch_YYYYMMDD.xml`
- To force re-download, either:
  - Delete the specific cached file
  - Use `force_refresh: true` in the query

## Troubleshooting

- **No matches**: Try being more specific (full show title, exact date, venue)
- **Download fails**: Check internet connectivity; the Cos URL may be temporary unavailable
- **Old data**: Use `force_refresh: true` to bypass cache
