// ── Plain text formatters — no embeds anywhere ────────────────────────────────

const COLOURS = {}; // kept for any legacy references, unused

const TYPE_META = {
  war:      { emoji: '🔴', label: 'WAR ALERT'    },
  rally:    { emoji: '🟠', label: 'RALLY CALL'   },
  event:    { emoji: '🟡', label: 'EVENT BRIEF'  },
  resource: { emoji: '🟢', label: 'RESOURCE CALL'},
  general:  { emoji: '⚪', label: 'GENERAL INFO' },
};

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return String(n || 0);
}

function divider() { return '────────────────────'; }

/**
 * Plain text announcement block.
 */
function announcementText(opts) {
  const meta = TYPE_META[opts.type] || TYPE_META.general;
  const lines = [
    `${meta.emoji} **${meta.label} — ${opts.title}**`,
    divider(),
    opts.description || '',
  ];

  if (opts.countdown != null) {
    const h = Math.floor(opts.countdown / 3600);
    const m = Math.floor((opts.countdown % 3600) / 60);
    const s = opts.countdown % 60;
    const timeStr = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
    lines.push(`\n⏱ **Rally Window:** ${timeStr} remaining`);
  }

  if (opts.rsvps && opts.rsvps.length > 0) {
    lines.push(`\n✅ **Signed Up (${opts.rsvps.length}):** ${opts.rsvps.slice(0, 20).join(', ')}`);
  }

  if (opts.author) lines.push(`\n${divider()}\n⚔️ Posted by ${opts.author}`);

  return lines.join('\n');
}

// kept for backward compat — returns plain text now, not an embed
function announcementEmbed(opts) { return announcementText(opts); }

/**
 * Plain text member stats card.
 */
function memberText(member) {
  const rankEmoji = { R5: '👑', R4: '⚔️', Member: '🛡️', R1: '🔰', Friend: '🤝' };
  const emoji = rankEmoji[member.rank] || '👤';
  const joined = member.joinedAt ? new Date(member.joinedAt).toDateString() : 'Unknown';

  return [
    `${emoji} **${member.name}**`,
    divider(),
    `**Rank:** ${member.rank || 'Unknown'}`,
    `**Power:** ${formatNum(member.power)}`,
    `**Contribution:** ${member.contribution || 0}`,
    `**Kills:** ${member.kills || 0}`,
    `**Rally Hits:** ${member.rallyHits || 0}`,
    `**Joined:** ${joined}`,
    divider(),
    `⚔️ Duck War Survival`,
  ].join('\n');
}

function memberEmbed(member) { return memberText(member); }

/**
 * Plain text leaderboard.
 */
function leaderboardText(members, sortKey = 'contribution') {
  const sorted = Object.values(members)
    .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
    .slice(0, 15);

  const labels = { contribution: 'Contribution', power: 'Power', kills: 'Kills', rallyHits: 'Rally Hits' };
  const medals = ['🥇', '🥈', '🥉'];

  const rows = sorted.map((m, i) => {
    const prefix = medals[i] || `**${i + 1}.**`;
    return `${prefix} ${m.name} — **${formatNum(m[sortKey] || 0)}** ${labels[sortKey]}`;
  });

  return [
    `🏆 **Alliance Leaderboard — ${labels[sortKey] || sortKey}**`,
    divider(),
    rows.length > 0 ? rows.join('\n') : 'No members tracked yet. Use `/stats set` to add data.',
    divider(),
    `⚔️ Duck War Survival`,
  ].join('\n');
}

function leaderboardEmbed(members, sortKey) { return leaderboardText(members, sortKey); }

module.exports = { announcementEmbed, announcementText, memberEmbed, memberText, leaderboardEmbed, leaderboardText, COLOURS, TYPE_META, formatNum, divider };
