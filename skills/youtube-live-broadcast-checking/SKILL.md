# YouTube Live & Upcoming Broadcast Checking Skill

**As the live broadcast of the YouTube app may miss live broadcast notifications even if enabled, I developed this skill to check the next live broadcast time so that we won't miss the live broadcasts we like.**

## Prerequisites

This skill requires a **Google API key** with **YouTube Data API v3** enabled.

### Getting a YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key
5. (Optional but recommended) Restrict the API key:
   - Click on the API key name
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3"

### Setting the API Key

Set the `GOOGLE_API_KEY` environment variable:

```bash
export GOOGLE_API_KEY="your_api_key_here"
```

To make it permanent, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or use a `.env` file.

**Important:** This skill uses the Google API key solely for read-only access to public YouTube data. No user data is stored or transmitted beyond the API calls to YouTube. The API key should be kept secret and never committed to version control.

## Security

This skill:
- Uses the YouTube Data API with an API key (no OAuth tokens stored)
- Does not store any user data beyond the watchlist (channel IDs and names)
- All errors are sanitized to avoid information leakage
- Input validation: channel IDs are validated before API calls
- No command injection risks (parameterized API calls)

## Tools

### `add_channel`

Adds a YouTube channel to the watchlist. Accepts human-friendly identifiers: channel ID (`UC...`), custom URL (`@handle`), or full channel URL.

**Parameters:**
- `channel_id` (string): YouTube channel ID, handle (@name), or full URL

**Returns:** `{ id, name, status: "added" }` or `{ error }`

### `remove_channel`

Removes a channel from the watchlist.

**Parameters:**
- `channel_id` (string): Channel ID or handle

**Returns:** `{ removed: true }` or `{ error }`

### `list_channels`

Lists all watched channels with names and timestamps.

**Returns:** Array of `{ id, name, added_at }`

### `get_next_broadcast`

Fetches the earliest upcoming broadcast for a specified channel.

**Parameters:**
- `channel_id` (string): Channel ID or handle

**Returns:** Broadcast object with `channel_id`, `channel_name`, `video_id`, `title`, `scheduled_start_time`, `thumbnail_url`, `video_url`; or `null` if none scheduled; or `{ error }` on failure.

### `check_upcoming_broadcasts`

Fetches upcoming broadcasts for multiple channels (or all watchlist if none specified). Results sorted by start time.

**Parameters:**
- `channel_ids` (array of strings, optional): Channel IDs/handles. If omitted, uses watchlist.

**Returns:** Array of broadcast objects (one per channel with upcoming streams), sorted ascending by `scheduled_start_time`. Omits channels with no upcoming broadcasts.

## Installation

1. Extract the skill to `workspace/skills/youtube-live-broadcast-checking/`
2. **Important:** The `node_modules/` directory may contain platform-specific binaries. If exporting to another system, either:
   - Exclude `node_modules/` from the archive and run `npm install` on the target system; OR
   - Delete `node_modules/` after extraction and run `npm install`
3. Run `npm install` in that directory (if `node_modules` is missing)
4. Add `"youtube-live-broadcast-checking"` to your agent's skills list in `openclaw.json`
5. Restart the OpenClaw gateway

## Notes

- Quota: Each check costs ~3-5 API units per channel (channels.list + search.list + videos.list)
- Only public channels and publicly scheduled streams are supported
- Channel IDs must be valid; handles (e.g., `@chan22`) are resolved via search
- The watchlist is stored in `~/.openclaw/workspace/memory/youtube-channels.json`

## Version History

- **1.1.0** - Renamed skill, added human-friendly identifier resolution, security review, fixed installation notes
- **1.0.0** - Initial release with live broadcast detection (deprecated)
