const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  
} = require('discord.js');
const { divider } = require('../embeds');
const db = require('../db');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/role_config.json');

const DWS_RANKS = ['R5', 'R4', 'Member', 'R1', 'Friend'];
const RANK_EMOJI = { R5: '👑', R4: '⚔️', Member: '🛡️', R1: '🔰', Friend: '🤝' };

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Map DWS alliance ranks to Discord roles and auto-sync members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    // /roles map
    .addSubcommand(sub => sub
      .setName('map')
      .setDescription('Link a DWS rank to a Discord role')
      .addStringOption(o => o
        .setName('rank')
        .setDescription('DWS alliance rank')
        .setRequired(true)
        .addChoices(...DWS_RANKS.map(r => ({ name: r, value: r }))))
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Discord role to assign for this rank')
        .setRequired(true)))

    // /roles unmap
    .addSubcommand(sub => sub
      .setName('unmap')
      .setDescription('Remove the Discord role mapping for a DWS rank')
      .addStringOption(o => o
        .setName('rank')
        .setDescription('DWS rank to unmap')
        .setRequired(true)
        .addChoices(...DWS_RANKS.map(r => ({ name: r, value: r })))))

    // /roles config
    .addSubcommand(sub => sub
      .setName('config')
      .setDescription('View current rank → role mappings'))

    // /roles sync
    .addSubcommand(sub => sub
      .setName('sync')
      .setDescription('Sync all tracked members\' Discord roles to their DWS rank'))

    // /roles syncone
    .addSubcommand(sub => sub
      .setName('syncone')
      .setDescription('Sync roles for a single member')
      .addUserOption(o => o
        .setName('member')
        .setDescription('Member to sync')
        .setRequired(true))),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config  = loadConfig();

    if (!config[guildId]) config[guildId] = {};
    const gConfig = config[guildId];

    // ── MAP ───────────────────────────────────────────────────────────────────
    if (sub === 'map') {
      const rank = interaction.options.getString('rank');
      const role = interaction.options.getRole('role');

      // Safety check — bot must be able to manage this role
      const botMember = await interaction.guild.members.fetchMe();
      const botHighest = botMember.roles.highest.position;

      if (role.position >= botHighest) {
        return interaction.reply({
          content: `❌ I can't manage **${role.name}** — it's positioned above or equal to my highest role. Move my bot role higher in Server Settings → Roles.`,
          ephemeral: true,
        });
      }

      gConfig[rank] = role.id;
      saveConfig(config);

      return interaction.reply({
        content: `✅ **${RANK_EMOJI[rank]} ${rank}** → ${role} mapped. Members with this rank will receive the role on next sync.`,
        ephemeral: true,
      });
    }

    // ── UNMAP ─────────────────────────────────────────────────────────────────
    if (sub === 'unmap') {
      const rank = interaction.options.getString('rank');
      if (!gConfig[rank]) {
        return interaction.reply({ content: `⚠️ **${rank}** has no mapping set.`, ephemeral: true });
      }
      delete gConfig[rank];
      saveConfig(config);
      return interaction.reply({ content: `🗑️ Mapping for **${rank}** removed.`, ephemeral: true });
    }

    // ── CONFIG ────────────────────────────────────────────────────────────────
    if (sub === 'config') {
      const rows = DWS_RANKS.map(rank => {
        const roleId = gConfig[rank];
        const roleStr = roleId ? `<@&${roleId}>` : '*(not mapped)*';
        return `${RANK_EMOJI[rank]} **${rank}** → ${roleStr}`;
      });
      return interaction.reply({
        content: ['🔄 **Rank → Role Mappings**', divider(), rows.join('\n'), divider(), '☠ Duck War Survival — Duck War Survival'].join('\n'),
        ephemeral: true,
      });
    }

    // ── SYNC ALL ──────────────────────────────────────────────────────────────
    if (sub === 'sync') {
      await interaction.deferReply({ ephemeral: true });

      const members  = db.getMembers();
      const entries  = Object.entries(members);

      if (entries.length === 0) {
        return interaction.editReply('❌ No members in the tracking system yet. Add members with `/roster add` first.');
      }

      if (Object.keys(gConfig).length === 0) {
        return interaction.editReply('❌ No role mappings configured. Use `/roles map` first.');
      }

      const results = { synced: [], skipped: [], failed: [] };

      for (const [userId, memberData] of entries) {
        const rank   = memberData.rank;
        const roleId = gConfig[rank];

        if (!roleId) {
          results.skipped.push(`${memberData.name} (${rank} — not mapped)`);
          continue;
        }

        try {
          const guildMember = await interaction.guild.members.fetch(userId).catch(() => null);
          if (!guildMember) {
            results.skipped.push(`${memberData.name} (not in server)`);
            continue;
          }

          // Remove all other mapped DWS rank roles first
          const allMappedRoleIds = Object.values(gConfig).filter(Boolean);
          for (const id of allMappedRoleIds) {
            if (id !== roleId && guildMember.roles.cache.has(id)) {
              await guildMember.roles.remove(id).catch(() => {});
            }
          }

          // Add the correct role
          if (!guildMember.roles.cache.has(roleId)) {
            await guildMember.roles.add(roleId);
          }

          results.synced.push(`${RANK_EMOJI[rank]} ${memberData.name}`);
        } catch (err) {
          results.failed.push(`${memberData.name} (${err.message})`);
        }
      }

      const syncLines = [
        '🔄 **Role Sync Complete**',
        divider(),
        `✅ **Synced (${results.synced.length}):** ${results.synced.length > 0 ? results.synced.join(', ') : 'None'}`,
        `⏭️ **Skipped (${results.skipped.length}):** ${results.skipped.length > 0 ? results.skipped.join(', ') : 'None'}`,
      ];
      if (results.failed.length > 0) syncLines.push(`❌ **Failed (${results.failed.length}):** ${results.failed.join(', ')}`);
      syncLines.push(divider());
      syncLines.push('☠ Duck War Survival — Duck War Survival');
      return interaction.editReply({ content: syncLines.join('\n') });
    }

    // ── SYNC ONE ──────────────────────────────────────────────────────────────
    if (sub === 'syncone') {
      const user       = interaction.options.getUser('member');
      const memberData = db.getMember(user.id);

      if (!memberData) {
        return interaction.reply({
          content: `❌ **${user.username}** is not in the roster. Add them with \`/roster add\` first.`,
          ephemeral: true,
        });
      }

      const rank   = memberData.rank;
      const roleId = gConfig[rank];

      if (!roleId) {
        return interaction.reply({
          content: `⚠️ No Discord role mapped for **${rank}**. Use \`/roles map ${rank} @role\` first.`,
          ephemeral: true,
        });
      }

      try {
        const guildMember = await interaction.guild.members.fetch(user.id);

        // Remove other DWS roles
        const allMappedRoleIds = Object.values(gConfig).filter(Boolean);
        for (const id of allMappedRoleIds) {
          if (id !== roleId && guildMember.roles.cache.has(id)) {
            await guildMember.roles.remove(id).catch(() => {});
          }
        }

        // Assign correct role
        await guildMember.roles.add(roleId);

        return interaction.reply({
          content: `✅ ${RANK_EMOJI[rank]} **${memberData.name}** synced → <@&${roleId}>`,
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          content: `❌ Failed to sync **${memberData.name}**: ${err.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
