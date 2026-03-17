const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const MEMORY_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'workspace', 'memory');
const WATCHLIST_FILE = path.join(MEMORY_DIR, 'youtube-channels.json');

// Ensure memory directory exists
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Load watchlist once at startup (prevent file reads during network operations)
function loadWatchlistFromDisk() {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      const data = fs.readFileSync(WATCHLIST_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load watchlist:', err.message);
  }
  return { channels: [] };
}

let WATCHLIST = loadWatchlistFromDisk();

// Save watchlist to disk
function saveWatchlistToDisk(watchlist) {
  try {
    const tempFile = WATCHLIST_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(watchlist, null, 2));
    fs.renameSync(tempFile, WATCHLIST_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save watchlist:', err.message);
    return false;
  }
}

// YouTube credentials: read once at module load
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  console.error('Warning: YOUTUBE_API_KEY not set; YouTube skill may fail');
}

// YouTube API client (lazy init)
let youtubeClient = null;

function getYouTubeClient() {
  if (youtubeClient) return youtubeClient;
  if (!YOUTUBE_API_KEY) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }
  youtubeClient = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
  });
  return youtubeClient;
}

// Validation helpers
function isValidChannelId(channelId) {
  return typeof channelId === 'string' && (channelId.startsWith('UC') || channelId.startsWith('PL'));
}

async function resolveChannelId(identifier, youtube) {
  if (!identifier || typeof identifier !== 'string') {
    return { error: 'Invalid channel identifier' };
  }

  const trimmed = identifier.trim();

  // Already a valid channel ID
  if (isValidChannelId(trimmed)) {
    return { channelId: trimmed };
  }

  // Extract from URL patterns
  try {
    const urlMatch = trimmed.match(/(?:youtube\.com\/(?:channel\/|@|user\/)?([^\/\?]+))/);
    if (urlMatch) {
      const possibleId = urlMatch[1];
      if (isValidChannelId(possibleId)) {
        return { channelId: possibleId };
      }
    }
  } catch {
    // ignore extraction errors, continue to search
  }

  // If not resolved via URL, attempt to search for the channel by name
  try {
    const searchResp = await youtube.search.list({
      part: ['snippet'],
      q: trimmed,
      type: ['channel'],
      maxResults: 1
    });

    const items = searchResp.data.items || [];
    if (items.length > 0) {
      return { channelId: items[0].id.channelId };
    }
  } catch (err) {
    console.error('Channel resolve error:', err.message);
    return { error: `Could not resolve channel: ${err.message}` };
  }

  return { error: 'Could not resolve channel identifier' };
}

// Upcoming broadcast fetch helper
async function getUpcomingForChannel(channelId, youtube) {
  try {
    const searchResp = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      eventType: 'upcoming',
      type: 'video',
      maxResults: 10
    });

    const upcomingVideos = searchResp.data.items || [];

    if (upcomingVideos.length === 0) {
      return null;
    }

    // Enrich with liveStreamingDetails
    const videoIds = upcomingVideos.map(v => v.id.videoId).join(',');
    const detailsResp = await youtube.videos.list({
      part: ['liveStreamingDetails'],
      id: videoIds
    });

    const detailsMap = {};
    (detailsResp.data.items || []).forEach(vid => {
      detailsMap[vid.id] = vid.liveStreamingDetails || {};
    });

    const results = upcomingVideos.map(v => {
      const details = detailsMap[v.id.videoId] || {};
      return {
        video_id: v.id.videoId,
        title: v.snippet.title,
        scheduled_start_time: details.scheduledStartTime || null,
        thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url || '',
        video_url: `https://www.youtube.com/watch?v=${v.id.videoId}`
      };
    }).filter(r => r.scheduled_start_time); // Only keep those with start time

    if (results.length === 0) {
      return null;
    }

    results.sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
    return results[0];
  } catch (err) {
    console.error(`Error fetching upcoming for channel ${channelId}:`, err.message);
    throw err;
  }
}

// Wrapper: resolve channel and ensure existence in WATCHLIST when appropriate
async function withResolvedChannel(params, handler) {
  const { channel_id } = params;
  if (!channel_id) {
    return { error: 'channel_id is required' };
  }

  // If channel_id is the literal string "watchlist", use all from WATCHLIST (for list operations)
  if (channel_id === 'watchlist' || channel_id === '__watchlist__') {
    // Handler expects an object with channel_id; we'll pass the whole watchlist later in specific tools
    // This is a special marker; we handle in each tool separately if needed.
    // For simplicity, don't use that pattern; each tool directly uses WATCHLIST when needed.
  }

  const youtube = getYouTubeClient();
  const resolved = await resolveChannelId(channel_id, youtube);
  if (resolved.error) {
    return resolved;
  }

  return handler({ channel_id: resolved.channelId, youtube });
}

// Tool: add_channel
async function addChannel(params) {
  return withResolvedChannel(params, async ({ channel_id }) => {
    // Check if exists in in-memory watchlist
    const existing = WATCHLIST.channels.find(c => c.id === channel_id);
    if (existing) {
      return { success: false, message: `Channel ${channel_id} is already in the watchlist` };
    }

    try {
      const youtube = getYouTubeClient();
      const response = await youtube.channels.list({
        part: ['snippet'],
        id: channel_id,
        maxResults: 1
      });

      if (!response.data.items || response.data.items.length === 0) {
        return { error: `Channel ${channel_id} not found` };
      }

      const channelInfo = response.data.items[0];
      const channelName = channelInfo.snippet.title;

      WATCHLIST.channels.push({
        id: channel_id,
        name: channelName,
        added_at: new Date().toISOString()
      });

      const saved = saveWatchlistToDisk(WATCHLIST);
      if (saved) {
        return { id: channel_id, name: channelName, status: 'added' };
      } else {
        // Rollback memory change
        WATCHLIST.channels.pop();
        return { error: 'Failed to save watchlist' };
      }
    } catch (err) {
      console.error('YouTube API error:', err.message);
      if (err.message.includes('API key') || err.response?.status === 400) {
        return { error: 'YouTube API key is invalid or missing' };
      } else if (err.response?.status === 403) {
        return { error: 'Quota exceeded' };
      } else if (err.response?.status === 404) {
        return { error: 'Channel not found' };
      } else {
        return { error: `YouTube API error: ${err.message}` };
      }
    }
  });
}

// Tool: remove_channel
async function removeChannel(params) {
  return withResolvedChannel(params, async ({ channel_id }) => {
    const index = WATCHLIST.channels.findIndex(c => c.id === channel_id);
    if (index === -1) {
      return { error: `Channel ${channel_id} not found in watchlist` };
    }

    // Remove from in-memory watchlist
    const removed = WATCHLIST.channels.splice(index, 1)[0];
    const saved = saveWatchlistToDisk(WATCHLIST);
    if (saved) {
      return { removed: true, channel: removed };
    } else {
      // Restore
      WATCHLIST.channels.splice(index, 0, removed);
      return { error: 'Failed to save watchlist' };
    }
  });
}

// Tool: list_channels
async function listChannels() {
  return WATCHLIST.channels;
}

// Tool: get_next_broadcast
async function getNextBroadcast(params) {
  return withResolvedChannel(params, async ({ channel_id }) => {
    try {
      const youtube = getYouTubeClient();
      const result = await getUpcomingForChannel(channel_id, youtube);
      if (!result) {
        return null;
      }

      // Get channel name from WATCHLIST if available, otherwise quick lookup
      let channelName = 'Unknown Channel';
      const fromWatchlist = WATCHLIST.channels.find(c => c.id === channel_id);
      if (fromWatchlist) {
        channelName = fromWatchlist.name;
      } else {
        try {
          const channelResp = await youtube.channels.list({
            part: ['snippet'],
            id: channel_id,
            maxResults: 1
          });
          if (channelResp.data.items?.[0]?.snippet?.title) {
            channelName = channelResp.data.items[0].snippet.title;
          }
        } catch (_) {}
      }

      return {
        channel_id: channel_id,
        channel_name: channelName,
        video_id: result.video_id,
        title: result.title,
        scheduled_start_time: result.scheduled_start_time,
        thumbnail_url: result.thumbnail_url,
        video_url: result.video_url
      };
    } catch (err) {
      console.error('YouTube API error:', err.message);
      if (err.response?.status === 403) {
        return { error: 'Quota exceeded' };
      } else {
        return { error: `YouTube API error: ${err.message}` };
      }
    }
  });
}

// Tool: check_upcoming_broadcasts
async function checkUpcomingBroadcasts(params) {
  const { channel_ids } = params;
  let channelIds = channel_ids;

  // Use in-memory watchlist if none provided
  if (!channelIds || channelIds.length === 0) {
    channelIds = WATCHLIST.channels.map(c => c.id);
  }

  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return [];
  }

  try {
    const youtube = getYouTubeClient();
    const results = [];

    const channelPromises = channelIds.map(async (channelId) => {
      try {
        // Get channel name from WATCHLIST if present
        let channelName = 'Unknown Channel';
        const fromWatchlist = WATCHLIST.channels.find(c => c.id === channelId);
        if (fromWatchlist) {
          channelName = fromWatchlist.name;
        } else {
          try {
            const channelResp = await youtube.channels.list({
              part: ['snippet'],
              id: channelId,
              maxResults: 1
            });
            if (channelResp.data.items?.[0]?.snippet?.title) {
              channelName = channelResp.data.items[0].snippet.title;
            }
          } catch (_) {}
        }

        const upcoming = await getUpcomingForChannel(channelId, youtube);
        if (upcoming) {
          results.push({
            channel_id: channelId,
            channel_name: channelName,
            video_id: upcoming.video_id,
            title: upcoming.title,
            scheduled_start_time: upcoming.scheduled_start_time,
            thumbnail_url: upcoming.thumbnail_url,
            video_url: upcoming.video_url
          });
        }
      } catch (err) {
        console.error(`Error processing channel ${channelId}:`, err.message);
        if (err.response?.status === 403) {
          throw err;
        }
      }
    });

    await Promise.all(channelPromises);

    results.sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
    return results;
  } catch (err) {
    console.error('YouTube API error:', err.message);
    if (err.response?.status === 403) {
      return { error: 'Quota exceeded' };
    } else {
      return { error: `YouTube API error: ${err.message}` };
    }
  }
}

// Tool: get_live_broadcast — checks if a channel is currently live
async function getLiveBroadcast(params) {
  return withResolvedChannel(params, async ({ channel_id }) => {
    try {
      const youtube = getYouTubeClient();

      // Search for live videos from this channel
      const searchResp = await youtube.search.list({
        part: ['snippet'],
        channelId: channel_id,
        eventType: 'live',
        type: 'video',
        maxResults: 1
      });

      if (!searchResp.data.items || searchResp.data.items.length === 0) {
        return null; // No live broadcast
      }

      const video = searchResp.data.items[0];
      const videoId = video.id.videoId;

      // Fetch additional video details (liveStreamingDetails)
      const videoResp = await youtube.videos.list({
        part: ['snippet', 'liveStreamingDetails'],
        id: videoId
      });

      const videoInfo = videoResp.data.items?.[0] || video;
      const snippet = videoInfo.snippet || video.snippet;

      return {
        channel_id: channel_id,
        video_id: videoId,
        title: snippet.title,
        description: snippet.description,
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        actual_start_time: videoInfo.liveStreamingDetails?.actualStartTime || null,
        concurrent_viewers: videoInfo.liveStreamingDetails?.concurrentViewers || null
      };
    } catch (err) {
      console.error('YouTube API error (get_live_broadcast):', err.message);
      if (err.response?.status === 403) {
        return { error: 'Quota exceeded or live streaming not enabled for this channel' };
      } else {
        return { error: `YouTube API error: ${err.message}` };
      }
    }
  });
}

// Export
module.exports = {
  tools: {
    add_channel: addChannel,
    remove_channel: removeChannel,
    list_channels: listChannels,
    get_next_broadcast: getNextBroadcast,
    check_upcoming_broadcasts: checkUpcomingBroadcasts,
    get_live_broadcast: getLiveBroadcast,
    // Preserve deprecation
    check_live_status: async () => ({
      error: 'check_live_status is deprecated. Use check_upcoming_broadcasts instead.'
    })
  }
};
