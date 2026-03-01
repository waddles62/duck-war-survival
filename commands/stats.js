const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { memberText, leaderboardText, formatNum } = require('../embeds');
const { getRankFromRoles } = require('../rankFromRoles');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Track and view Dark War: Survival member statistics')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set or update a member\'s stats (Officers+)')
      .addUserOption(o => o.setName('member').setDescription('Alliance member').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('In-game name'))
      .addIntegerOption(o => o.setName('power').setDescription('Current power score'))
      .addIntegerOption(o => o.setName('contribution').setDescription('Alliance contribution score'))
      .addIntegerOption(o => o.setName('kills').setDescription('Total kill count'))
      .addIntegerOption(o => o.setName('rally_hits').setDescription('Number of rally hits')))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View a member\'s stats')
      .addUserOption(o => o.setName('member').setDescription('Member to look up (defaults to yourself)')))
    .addSubcommand(sub => sub
      .setName('leaderboard')
      .setDescription('Show alliance leaderboard')
      .addStringOption(o => o
        .setName('sort')
        .setDescription('Sort by stat')
        .addChoices(
          { name: 'Contribution', value: 'contribution' },
          { name: 'Power',        value: 'power'        },
          { name: 'Kills',        value: 'kills'        },
          { name: 'Rally Hits',   value: 'rallyHits'    },
        )))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Remove a member from tracking (Officers+)')
      .addUserOption(o => o.setName('member').setDescription('Member to remove').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ Only Officers and above can update stats.', ephemeral: true });
      }
      const user    = interaction.options.getUser('member');
      const name    = interaction.options.getString('name');
      const power   = interaction.options.getInteger('power');
      const contrib = interaction.options.getInteger('contribution');
      const kills   = interaction.options.getInteger('kills');
      const rally   = interaction.options.getInteger('rally_hits');

      const updates = {};
      if (name)          updates.name         = name;
      if (power   != null) updates.power       = power;
      if (contrib != null) updates.contribution = contrib;
      if (kills   != null) updates.kills        = kills;
      if (rally   != null) updates.rallyHits    = rally;

      if (Object.keys(updates).length === 0) {
        return interaction.reply({ content: '❌ Provide at least one stat to update.', ephemeral: true });
      }
      if (!updates.name) {
        const existing = db.getMember(user.id);
        updates.name = existing?.name || user.username;
      }
      if (!db.getMember(user.id)?.joinedAt) updates.joinedAt = Date.now();

      const member = db.setMember(user.id, updates);
      return interaction.reply({ content: `✅ Stats updated for **${member.name}**\n\n${memberText(member)}` });
    }

    if (sub === 'view') {
      const user   = interaction.options.getUser('member') || interaction.user;
      const member = db.getMember(user.id);
      if (!member) {
        return interaction.reply({ content: `❌ No stats found for **${user.username}**. An officer can add them with \`/stats set\`.`, ephemeral: true });
      }
      // Refresh rank from Discord roles if mapped
      const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (guildMember) {
        const liveRank = getRankFromRoles(guildMember, interaction.guildId);
        if (liveRank) member.rank = liveRank;
      }
      return interaction.reply({ content: memberText(member) });
    }

    if (sub === 'leaderboard') {
      const sort    = interaction.options.getString('sort') || 'contribution';
      const members = db.getMembers();
      if (Object.keys(members).length === 0) {
        return interaction.reply({ content: '📊 No member data yet. Use `/stats set` to start tracking.', ephemeral: true });
      }
      return interaction.reply({ content: leaderboardText(members, sort) });
    }

    if (sub === 'delete') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ Only Officers and above can remove members.', ephemeral: true });
      }
      const user     = interaction.options.getUser('member');
      const existing = db.getMember(user.id);
      if (!existing) {
        return interaction.reply({ content: `❌ **${user.username}** is not in the tracking system.`, ephemeral: true });
      }
      db.removeMember(user.id);
      return interaction.reply({ content: `🗑️ **${existing.name || user.username}** removed from alliance tracking.` });
    }
  },
};
