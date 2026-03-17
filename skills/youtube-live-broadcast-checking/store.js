// In-memory watchlist store (no file I/O)
// Note: watchlist resets when the agent session restarts

let WATCHLIST = {
  channels: []
};

function getWatchlist() {
  return WATCHLIST.channels;
}

function findChannel(channelId) {
  return WATCHLIST.channels.find(c => c.id === channelId);
}

function addChannel(channel) {
  WATCHLIST.channels.push(channel);
}

function removeChannelById(channelId) {
  const index = WATCHLIST.channels.findIndex(c => c.id === channelId);
  if (index !== -1) {
    WATCHLIST.channels.splice(index, 1);
    return true;
  }
  return false;
}

function clear() {
  WATCHLIST.channels = [];
}

module.exports = {
  WATCHLIST,
  getWatchlist,
  findChannel,
  addChannel,
  removeChannelById,
  clear
};
