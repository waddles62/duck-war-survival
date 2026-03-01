const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getRankFromRoles, DWS_RANKS, RANK_EMOJI } = require('../rankFromRoles');
const db   = require('../db');
const { formatNum, divider } = require('../embeds');
const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/role_config.json');

function loadRoleConfig(guildId) {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return all[guildId] || {};
  } catch { return {}; }
}

async function autoSyncRole(interaction, userId, rank) {
  try {
    const gConfig = loadRoleConfig(interaction.guildId);
    const roleId  = gConfig[rank];
    if (!roleId) return;
    const guildMember = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!guildMember) return;
    const allMapped = Object.values(gConfig).filter(Boolean);
    for (const id of allMapped) {
      if (id !== roleId && guildMember.roles.cache.has(id)) await guildMember.roles.remove(id).catch(() => {});
    }
    if (!guildMember.roles.cache.has(roleId)) await guildMember.roles.add(roleId).catch(() => {});
  } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Manage the Dark War: Survival alliance roster')

    // /roster list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show all alliance members grouped by rank')
      .addStringOption(o => o
        .setName('filter')
        .setDescription('Filter by rank')
        .addChoices(...DWS_RANKS.map(r => ({ name: r, value: r })))))

    // /roster sync — auto-populate from Discord
    .addSubcommand(sub => sub
      .setName('sync')
      .setDescription('Auto-add all Discord members to roster based on their roles (Officers+)'))

    // /roster add
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add up to 5 members manually (Officers+)')
      .addUserOption(o => o.setName('member1').setDescription('Member 1').setRequired(true))
      .addStringOption(o => o.setName('name1').setDescription('In-game name').setRequired(true))
      .addStringOption(o => o.setName('rank1').setDescription('Rank (leave blank to detect from Discord role)').addChoices(...DWS_RANKS.map(r => ({ name: r, value: r }))))
      .addUserOption(o => o.setName('member2').setDescription('Member 2'))
      .addStringOption(o => o.setName('name2').setDescription('In-game name 2'))
      .addStringOption(o => o.setName('rank2').setDescription('Rank 2').addChoices(...DWS_RANKS.map(r => ({ name: r, value: r }))))
      .addUserOption(o => o.setName('member3').setDescription('Member 3'))
      .addStringOption(o => o.setName('name3').setDescription('In-game name 3'))
      .addStringOption(o => o.setName('rank3').setDescription('Rank 3').addChoices(...DWS_RANKS.map(r => ({ name: r, value: r }))))
      .addUserOption(o => o.setName('member4').setDescription('Member 4'))
      .addStringOption(o => o.setName('name4').setDescription('In-game name 4'))
      .addStringOption(o => o.setName('rank4').setDescription('Rank 4').addChoices(...DWS_RANKS.map(r => ({ name: r, value: r }))))
      .addUserOption(o => o.setName('member5').setDescription('Member 5'))
      .addStringOption(o => o.setName('name5').setDescription('In-game name 5'))
      .addStringOption(o => o.setName('rank5').setDescription('Rank 5').addChoices(...DWS_RANKS.map(r => ({ name: r, value: r })))))

    // /roster rank
    .addSubcommand(sub => sub
      .setName('rank')
      .setDescription('Change a member\'s rank (Officers+)')
      .addUserOption(o => o.setName('member').setDescription('Member to update').setRequired(true))
      .addStringOption(o => o.setName('rank').setDescription('New rank').setRequired(true)
        .addChoices(...DWS_RANKS.map(r => ({ name: r, value: r })))))

    // /roster remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a member from the roster (Officers+)')
      .addUserOption(o => o.setName('member').setDescription('Member to remove').setRequired(true)))

    // /roster inactive
    .addSubcommand(sub => sub
      .setName('inactive')
      .setDescription('List members with low contributions')
      .addIntegerOption(o => o.setName('below').setDescription('Flag members below this contribution (default: 100)'))),

  async execute(interaction) {
    const sub       = interaction.options.getSubcommand();
    const isOfficer = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles);

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      await interaction.deferReply();
      const filter       = interaction.options.getString('filter') || 'all';
      const guildMembers = await interaction.guild.members.fetch();
      const rows         = [];

      for (const [userId, guildMember] of guildMembers) {
        if (guildMember.user.bot) continue;
        const rank = getRankFromRoles(guildMember, interaction.guildId);
        if (!rank) continue;
        if (filter !== 'all' && rank !== filter) continue;

        const stored = db.getMember(userId);
        const name   = stored?.name || guildMember.displayName;
        const power  = stored?.power ? ` · ${formatNum(stored.power)} PWR` : '';
        rows.push({ rank, display: `${RANK_EMOJI[rank]} **${name}** — ${rank}${power}` });
      }

      if (rows.length === 0) {
        return interaction.editReply(`📋 No members found${filter !== 'all' ? ` with rank **${filter}**` : ''}. Make sure ranks are mapped with \`/roles map\`.`);
      }

      rows.sort((a, b) => DWS_RANKS.indexOf(a.rank) - DWS_RANKS.indexOf(b.rank));
      const title = `☠ **Alliance Roster${filter !== 'all' ? ` — ${filter}` : ''} (${rows.length} members)**`;
      return interaction.editReply([title, divider(), rows.map(r => r.display).join('\n'), divider(), '☠ Dark War: Survival — Alliance Command'].join('\n'));
    }

    // ── SYNC — auto-add all Discord members by role ───────────────────────────
    if (sub === 'sync') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });

      const guildMembers = await interaction.guild.members.fetch();
      const added = [], skipped = [], noRole = [];

      for (const [userId, guildMember] of guildMembers) {
        if (guildMember.user.bot) continue;
        const rank = getRankFromRoles(guildMember, interaction.guildId);
        if (!rank) { noRole.push(guildMember.displayName); continue; }

        const existing = db.getMember(userId);
        if (existing) { skipped.push(existing.name || guildMember.displayName); continue; }

        db.setMember(userId, {
          name: guildMember.displayName,
          rank,
          power: 0, contribution: 0, kills: 0, rallyHits: 0,
          joinedAt: Date.now(),
        });
        added.push(`${RANK_EMOJI[rank]} ${guildMember.displayName} — ${rank}`);
      }

      const lines = [
        '☠ **Roster Sync Complete**',
        divider(),
        `✅ **Added (${added.length}):** ${added.length > 0 ? added.join(', ') : 'None'}`,
        `⏭️ **Already tracked (${skipped.length}):** ${skipped.length > 0 ? skipped.join(', ') : 'None'}`,
        `⚪ **No rank role (${noRole.length}):** ${noRole.length > 0 ? noRole.slice(0, 10).join(', ') + (noRole.length > 10 ? ` ...+${noRole.length - 10} more` : '') : 'None'}`,
      ];
      return interaction.editReply(lines.join('\n'));
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });

      const added = [], skipped = [];

      for (let i = 1; i <= 5; i++) {
        const user = interaction.options.getUser(`member${i}`);
        const name = interaction.options.getString(`name${i}`);
        let   rank = interaction.options.getString(`rank${i}`);

        if (!user || !name) break;

        if (!rank) {
          const gm = await interaction.guild.members.fetch(user.id).catch(() => null);
          rank = gm ? getRankFromRoles(gm, interaction.guildId) : null;
        }

        if (!rank) { skipped.push(`${name} — no rank found`); continue; }

        db.setMember(user.id, { name, rank, joinedAt: Date.now(), contribution: 0, power: 0, kills: 0, rallyHits: 0 });
        await autoSyncRole(interaction, user.id, rank);
        added.push(`${RANK_EMOJI[rank]} **${name}** — ${rank}`);
      }

      if (added.length === 0) return interaction.reply({ content: '❌ No valid members provided.', ephemeral: true });

      const skippedNote = skipped.length > 0 ? `\n\n⚠️ Skipped: ${skipped.join(', ')}` : '';
      return interaction.reply({ content: `☠ **${added.length} member${added.length > 1 ? 's' : ''} added!**\n\n${added.join('\n')}\n\nWelcome, survivors!${skippedNote}` });
    }

    // ── RANK ──────────────────────────────────────────────────────────────────
    if (sub === 'rank') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      const user    = interaction.options.getUser('member');
      const newRank = interaction.options.getString('rank');
      const member  = db.getMember(user.id);
      if (!member) return interaction.reply({ content: `❌ **${user.username}** is not on the roster.`, ephemeral: true });
      const oldRank = member.rank;
      db.setMember(user.id, { rank: newRank });
      await autoSyncRole(interaction, user.id, newRank);
      return interaction.reply({ content: `${RANK_EMOJI[newRank]} **${member.name}** updated from **${oldRank}** → **${newRank}**` });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      const user   = interaction.options.getUser('member');
      const member = db.getMember(user.id);
      if (!member) return interaction.reply({ content: `❌ **${user.username}** is not on the roster.`, ephemeral: true });
      db.removeMember(user.id);
      return interaction.reply({ content: `🗑️ **${member.name}** removed from the roster.` });
    }

    // ── INACTIVE ──────────────────────────────────────────────────────────────
    if (sub === 'inactive') {
      const threshold = interaction.options.getInteger('below') ?? 100;
      const members   = Object.values(db.getMembers());
      const flagged   = members.filter(m => (m.contribution || 0) < threshold);
      if (flagged.length === 0) return interaction.reply({ content: `✅ No members below **${threshold}** contribution.`, ephemeral: true });
      const rows = flagged
        .sort((a, b) => (a.contribution || 0) - (b.contribution || 0))
        .map(m => `${RANK_EMOJI[m.rank] || '👤'} **${m.name}** — ${m.contribution || 0} contribution`);
      return interaction.reply({ content: ['⚠️ **Inactive Members**', divider(), rows.join('\n'), divider(), 'Consider warning or kicking these members.'].join('\n') });
    }
  },
};
