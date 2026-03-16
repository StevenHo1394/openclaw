# YouTube Live & Upcoming Broadcast Notifications Skill

This OpenClaw skill monitors YouTube channels for live and upcoming broadcasts. It provides tools to manage a watchlist and fetch scheduled streams for public channels using the YouTube Data API v3 with an API key.

## Setup

### Prerequisites

- Node.js (v18 or higher)
- OpenClaw framework
- YouTube Data API v3 enabled

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
5. (Optional) Restrict the API key for security:
   - Click on the API key name
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3"

### Setting the API Key

Set the `YOUTUBE_API_KEY` environment variable:

```bash
export YOUTUBE_API_KEY="your_api_key_here"
```

To make it permanent, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or use a `.env` file with `dotenv`.

### Installing Dependencies

```bash
cd /home/node/.openclaw/workspace-for-jose/youtube-live-broadcast-notifications
npm install
```

## Tools

This skill exposes five tools:

### `add_channel`

Adds a YouTube channel to the watchlist and fetches its display name.

**Parameters:**
- `channel_id` (string): The YouTube channel ID (e.g., "UC_x5XG1OV2P6uZZ5FSM9Ttw")

**Returns:** Object with `id`, `name`, and `status: "added"` on success, or an `error` field on failure.

**Example:**
```json
{
  "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw"
}
```

**Response:**
```json
{
  "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "name": "Google Developers",
  "status": "added"
}
```

### `remove_channel`

Removes a YouTube channel from the watchlist.

**Parameters:**
- `channel_id` (string): The YouTube channel ID to remove

**Returns:** Object with `removed: true` on success, or an `error` field on failure.

**Example:**
```json
{
  "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw"
}
```

### `list_channels`

Returns the current watchlist with channel details.

**Parameters:** None

**Returns:** Array of channel objects containing `id`, `name`, and `added_at` timestamp.

**Example Response:**
```json
[
  {
    "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Google Developers",
    "added_at": "2026-03-15T15:00:00.000Z"
  }
]
```

### `get_next_broadcast`

Fetches the earliest upcoming broadcast for a specific channel.

**Parameters:**
- `channel_id` (string): The YouTube channel ID

**Returns:** A single broadcast object with full details, or `null` if no upcoming broadcasts found.

**Response Fields:**
- `channel_id` (string)
- `channel_name` (string)
- `video_id` (string)
- `title` (string)
- `scheduled_start_time` (string, ISO 8601)
- `thumbnail_url` (string)
- `video_url` (string)

**Example Response:**
```json
{
  "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "channel_name": "Google Developers",
  "video_id": "abc123",
  "title": "Upcoming Live Stream",
  "scheduled_start_time": "2026-03-16T14:00:00Z",
  "thumbnail_url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
  "video_url": "https://www.youtube.com/watch?v=abc123"
}
```

### `check_upcoming_broadcasts`

Fetches the earliest upcoming broadcast for one or more channels. If no channel IDs are provided, it checks all channels in the watchlist. Results are sorted by scheduled start time (earliest first).

**Parameters:**
- `channel_ids` (array of strings, optional): Specific channel IDs to check. If omitted or empty, uses the full watchlist.

**Returns:** Array of broadcast objects (up to one per channel), sorted by `scheduled_start_time` ascending. If a channel has no upcoming broadcasts, it is omitted from the results.

**Response Fields:** (same as `get_next_broadcast`)

**Example Request:**
```json
{
  "channel_ids": ["UC_x5XG1OV2P6uZZ5FSM9Ttw", "UC-9-kyTW8ZkZNDHQJ6FgpwQ"]
}
```

**Example Response:**
```json
[
  {
    "channel_id": "UC-9-kyTW8ZkZNDHQJ6FgpwQ",
    "channel_name": "Another Channel",
    "video_id": "def456",
    "title": "Scheduled Stream",
    "scheduled_start_time": "2026-03-16T10:00:00Z",
    "thumbnail_url": "https://i.ytimg.com/vi/def456/hqdefault.jpg",
    "video_url": "https://www.youtube.com/watch?v=def456"
  },
  {
    "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "channel_name": "Google Developers",
    "video_id": "abc123",
    "title": "Upcoming Live Stream",
    "scheduled_start_time": "2026-03-16T14:00:00Z",
    "thumbnail_url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    "video_url": "https://www.youtube.com/watch?v=abc123"
  }
]
```

## Data Storage

The watchlist is stored in:
```
~/.openclaw/workspace-for-jose/memory/youtube-channels.json
```

It contains an array of channel objects:
```json
{
  "channels": [
    {
      "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "name": "Google Developers",
      "added_at": "2026-03-15T15:00:00.000Z"
    }
  ]
}
```

## API Method Details

This skill uses the YouTube Data API v3 with an API key (no OAuth required). It works with **public channels only** and schedules that are publicly visible.

- To get channel names: `youtube.channels.list({ part: 'snippet', id: channelId })`
- To find upcoming videos: `youtube.search.list({ channelId, type: 'video', eventType: 'upcoming', order: 'date', maxResults: 5 })`
- To get streaming details: `youtube.videos.list({ part: 'liveStreamingDetails,snippet', id: videoIds })`

The `check_upcoming_broadcasts` tool fetches up to 5 upcoming videos per channel and returns the earliest one. Only videos with a `scheduledStartTime` in the future are considered.

## Error Handling

The skill handles common error scenarios:

- **Missing `YOUTUBE_API_KEY`:** Clear error message when environment variable is not set.
- **Quota exceeded (403):** Returns error message "Quota exceeded".
- **Invalid channel ID or channel not found:** Returns appropriate error.
- **API errors:** General error messages with details.
- **No upcoming broadcasts:** Returns `null` for single channel query or omits channel from array in batch query.

All errors are returned in the response object with an `error` field.

## Notes

- The YouTube Data API has [quota limits](https://developers.google.com/youtube/v3/getting-started#quota). Each `get_next_broadcast` or `check_upcoming_broadcasts` call costs approximately 3-5 units per channel (1 for channels.list, 1 for search.list, 1 for videos.list per batch of videos).
- Only **public** channels and **publicly scheduled** streams are supported. Private streams or unlisted scheduled videos will not be detected.
- The tool checks for broadcasts scheduled within the near future; videos that have already started but aren't live yet may appear briefly but are filtered by time.
- Channel IDs must be valid YouTube channel IDs (usually starting with "UC"). To find a channel's ID, visit their channel page and look at the URL: `youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw`.
- `check_live_status` is retained for backward compatibility but is deprecated; it returns an error message directing users to the new tools.

## Testing

Run the test suite:

```bash
npm test
```

The tests use mocked YouTube API responses and do not require a real API key or network access. They cover:
- Input validation
- Watchlist add/remove/list operations
- Upcoming broadcast fetching with mock data
- Error handling (missing key, quota, not found)
- Result sorting and filtering

## Version History

- **2.0.0** - Added upcoming broadcast support with API key design, new tools `get_next_broadcast` and `check_upcoming_broadcasts`, enhanced watchlist with channel names and timestamps.
- **1.0.0** - Initial release with live broadcast detection (deprecated).

## License

ISC
