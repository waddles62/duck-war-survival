// ── Shared helper — get a member's DWS rank from their Discord roles ───────────

const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'data/role_config.json');

// New rank order — highest to lowest priority
const DWS_RANKS   = ['R5', 'R4', 'Member', 'R1', 'Friend'];
const RANK_EMOJI  = { R5: '👑', R4: '⚔️', Member: '🛡️', R1: '🔰', Friend: '🤝' };
const RANK_LABEL  = { R5: 'Leader', R4: 'Officer', Member: 'Member', R1: 'Recruit', Friend: 'Friend' };

function loadRoleConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

/**
 * Returns the DWS rank string for a GuildMember based on their Discord roles,
 * or null if no mapped rank role is found.
 */
function getRankFromRoles(guildMember, guildId) {
  const config  = loadRoleConfig();
  const gConfig = config[guildId] || {};

  // Check from highest to lowest — return first match
  for (const rank of DWS_RANKS) {
    const roleId = gConfig[rank];
    if (roleId && guildMember.roles.cache.has(roleId)) {
      return rank;
    }
  }
  return null;
}

module.exports = { getRankFromRoles, DWS_RANKS, RANK_EMOJI, RANK_LABEL };
