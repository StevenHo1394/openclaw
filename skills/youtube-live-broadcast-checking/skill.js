const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'workspace-for-jose', 'memory');
const WATCHLIST_FILE = path.join(MEMORY_DIR, 'youtube-channels.json');

// Ensure memory directory exists
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Load or initialize watchlist
function loadWatchlist() {
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

// Save watchlist atomically
function saveWatchlist(watchlist) {
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

// YouTube API client with timeout
let youtubeClient = null;

function getYouTubeClient() {
  if (youtubeClient) return youtubeClient;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }

  youtubeClient = google.youtube({
    version: 'v3',
    auth: apiKey
  });

  return youtubeClient;
}

// Validate YouTube channel ID format (basic check)
function isValidChannelId(channelId) {
  return typeof channelId === 'string' && (channelId.startsWith('UC') || channelId.startsWith('PL'));
}

// Resolve human-friendly channel identifiers (handles, URLs) to actual channel ID
async function resolveChannelId(identifier, youtube) {
  if (!identifier || typeof identifier !== 'string') {
    return { error: 'Invalid channel identifier' };
  }

  const trimmed = identifier.trim();

  // Already a valid channel ID
  if (isValidChannelId(trimmed)) {
    return { channelId: trimmed };
  }

  // Extract from URL: youtube.com/channel/UCxxxx, youtube.com/@handle, youtube.com/user/username
  try {
    const urlMatch = trimmed.match(/(?:youtube\.com\/(?:channel\/|@|user\/)?([^\/\?]+))/);
    if (urlMatch) {
      const extracted = urlMatch[1];
      // If it looks like a channel ID, return it
      if (isValidChannelId(extracted)) {
        return { channelId: extracted };
      }
      // Otherwise it's a handle/username; fall through to search
      trimmed = extracted;
    }
  } catch (e) {
    // Not a URL, continue
  }

  // If starts with @, strip it
  let handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  // Search for channel by handle/name
  try {
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: handle,
      type: ['channel'],
      maxResults: 5
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return { error: `No channel found for "${handle}"` };
    }

    // Find an exact handle match if possible (case-insensitive)
    const exactMatch = searchResponse.data.items.find(item =>
      item.snippet.channelTitle?.toLowerCase() === handle.toLowerCase()
    );
    const channelItem = exactMatch || searchResponse.data.items[0];

    return { channelId: channelItem.snippet.channelId };
  } catch (err) {
    console.error('Error resolving channel ID:', err.message);
    if (err.response?.status === 403) {
      return { error: 'Quota exceeded while resolving channel' };
    }
    return { error: `Failed to resolve channel: ${err.message}` };
  }
}

// Wrapper to ensure we have a valid channel ID before proceeding
async function withResolvedChannel(params, callback) {
  const { channel_id: rawId, channel_ids: rawIds } = params;
  const youtube = getYouTubeClient();

  // Resolve single channel_id
  if (rawId) {
    const resolved = await resolveChannelId(rawId, youtube);
    if (resolved.error) return { error: resolved.error };
    return callback({ ...params, channel_id: resolved.channelId });
  }

  // Resolve array of channel_ids
  if (rawIds && Array.isArray(rawIds)) {
    const resolvedIds = [];
    for (const raw of rawIds) {
      const resolved = await resolveChannelId(raw, youtube);
      if (resolved.error) {
        return { error: `Channel "${raw}": ${resolved.error}` };
      }
      resolvedIds.push(resolved.channelId);
    }
    return callback({ ...params, channel_ids: resolvedIds });
  }

  return callback(params); // No channel identifier provided (watchlist case)
}

// Tool: add_channel
async function addChannel(params) {
  return withResolvedChannel(params, async ({ channel_id }) => {
    const watchlist = loadWatchlist();

    // Check if channel already exists
    const existing = watchlist.channels.find(c => c.id === channel_id);
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

      watchlist.channels.push({
        id: channel_id,
        name: channelName,
        added_at: new Date().toISOString()
      });

      const saved = saveWatchlist(watchlist);

      if (saved) {
        return { id: channel_id, name: channelName, status: 'added' };
      } else {
        return { error: 'Failed to save watchlist' };
      }
    } catch (err) {
      console.error('YouTube API error:', err.message);

      if (err.message.includes('API key')) {
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
    const watchlist = loadWatchlist();
    const index = watchlist.channels.findIndex(c => c.id === channel_id);

    if (index === -1) {
      return { error: `Channel ${channel_id} not found in watchlist` };
    }

    watchlist.channels.splice(index, 1);
    const saved = saveWatchlist(watchlist);

    if (saved) {
      return { removed: true };
    } else {
      return { error: 'Failed to save watchlist' };
    }
  });
}

// Tool: list_channels
async function listChannels() {
  const watchlist = loadWatchlist();
  return watchlist.channels;
}

// Helper: get upcoming broadcasts for a single channel
async function getUpcomingForChannel(channelId, youtube) {
  try {
    // Search for upcoming videos
    const searchResponse = await youtube.search.list({
      part: ['id'],
      channelId: channelId,
      type: 'video',
      eventType: 'upcoming',
      order: 'date',
      maxResults: 5
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return null;
    }

    const videoIds = searchResponse.data.items.map(item => item.id.videoId);

    // Get video details including liveStreamingDetails
    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'liveStreamingDetails'],
      id: videoIds.join(',')
    });

    if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
      return null;
    }

    // Filter for videos with scheduledStartTime in the future
    const now = new Date();
    const upcomingVideos = [];

    for (const video of videosResponse.data.items) {
      const streamingDetails = video.liveStreamingDetails;
      if (!streamingDetails || !streamingDetails.scheduledStartTime) {
        continue;
      }

      const scheduledTime = new Date(streamingDetails.scheduledStartTime);
      if (scheduledTime > now) {
        upcomingVideos.push({
          video_id: video.id,
          title: video.snippet.title,
          scheduled_start_time: streamingDetails.scheduledStartTime,
          thumbnail_url: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
          video_url: `https://www.youtube.com/watch?v=${video.id}`
        });
      }
    }

    if (upcomingVideos.length === 0) {
      return null;
    }

    // Sort by scheduled_start_time ascending
    upcomingVideos.sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));

    return upcomingVideos[0]; // Return the earliest
  } catch (err) {
    console.error(`Error fetching upcoming for channel ${channelId}:`, err.message);
    throw err;
  }
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

      // Get channel name
      const channelResponse = await youtube.channels.list({
        part: ['snippet'],
        id: channel_id,
        maxResults: 1
      });

      const channelName = channelResponse.data.items?.[0]?.snippet?.title || 'Unknown Channel';

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
  return withResolvedChannel(params, async ({ channel_ids }) => {
    let channelIds = channel_ids;

    // If no channel_ids provided, use all from watchlist
    if (!channelIds || channelIds.length === 0) {
      const watchlist = loadWatchlist();
      channelIds = watchlist.channels.map(c => c.id);
    }

    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return [];
    }

    try {
      const youtube = getYouTubeClient();
      const results = [];

      // Get channel names and upcoming broadcasts in parallel
      const channelPromises = channelIds.map(async (channelId) => {
        try {
          // Get channel name
          const channelResponse = await youtube.channels.list({
            part: ['snippet'],
            id: channelId,
            maxResults: 1
          });

          const channelName = channelResponse.data.items?.[0]?.snippet?.title || 'Unknown Channel';

          // Get upcoming broadcast
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
          // Re-throw critical errors (quota, auth) to abort entire operation
          if (err.response?.status === 403) {
            throw err;
          }
          // For other errors (channel not found, etc.), continue processing other channels
        }
      });

      await Promise.all(channelPromises);

      // Sort by scheduled_start_time ascending
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
  });
}

// Export tools for OpenClaw
module.exports = {
  tools: {
    add_channel: addChannel,
    remove_channel: removeChannel,
    list_channels: listChannels,
    get_next_broadcast: getNextBroadcast,
    check_upcoming_broadcasts: checkUpcomingBroadcasts,
    // Preserve original tool for backward compatibility
    check_live_status: async () => {
      return { error: 'check_live_status is deprecated. Use check_upcoming_broadcasts instead.' };
    }
  }
};