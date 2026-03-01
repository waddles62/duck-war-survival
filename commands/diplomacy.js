const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { divider } = require('../embeds');
const fs   = require('fs');
const path = require('path');

const DIPLO_FILE = path.join(__dirname, '../data/diplomacy.json');

// ── File helpers ──────────────────────────────────────────────────────────────

function loadDiplo(guildId) {
  try {
    if (!fs.existsSync(DIPLO_FILE)) return { allies: [], naps: [] };
    const all = JSON.parse(fs.readFileSync(DIPLO_FILE, 'utf8'));
    return all[guildId] || { allies: [], naps: [] };
  } catch { return { allies: [], naps: [] }; }
}

function saveDiplo(guildId, data) {
  let all = {};
  try { if (fs.existsSync(DIPLO_FILE)) all = JSON.parse(fs.readFileSync(DIPLO_FILE, 'utf8')); } catch {}
  all[guildId] = data;
  fs.writeFileSync(DIPLO_FILE, JSON.stringify(all, null, 2));
}

// ── Build the diplomacy post ──────────────────────────────────────────────────

function buildDiploText(diplo) {
  const lines = [
    '☠️ **Alliance Diplomacy**',
    divider(),
  ];

  // Allies
  lines.push('🤝 **Allies**');
  if (diplo.allies.length === 0) {
    lines.push('*None declared*');
  } else {
    diplo.allies.forEach((a, i) => {
      const note = a.note ? `  — ${a.note}` : '';
      const since = a.since ? `  *(since ${a.since})*` : '';
      lines.push(`**${i + 1}.** 🟢 **${a.name}**${note}${since}`);
    });
  }

  lines.push('');

  // NAPs
  lines.push('🕊️ **Non-Aggression Pacts (NAPs)**');
  if (diplo.naps.length === 0) {
    lines.push('*None declared*');
  } else {
    diplo.naps.forEach((n, i) => {
      const note = n.note ? `  — ${n.note}` : '';
      const since = n.since ? `  *(since ${n.since})*` : '';
      lines.push(`**${i + 1}.** 🟡 **${n.name}**${note}${since}`);
    });
  }

  lines.push(divider());
  lines.push('☠ Dark War: Survival — Alliance Command');
  return lines.join('\n');
}

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diplomacy')
    .setDescription('Manage alliance allies and NAPs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    // /diplomacy add
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add an ally or NAP (Officers+)')
      .addStringOption(o => o
        .setName('type')
        .setDescription('Relationship type')
        .setRequired(true)
        .addChoices(
          { name: '🤝 Ally',  value: 'ally' },
          { name: '🕊️ NAP',   value: 'nap'  },
        ))
      .addStringOption(o => o.setName('name').setDescription('Alliance name').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Optional note e.g. "mutual defense" or "expires after Territory War"'))
      .addStringOption(o => o.setName('since').setDescription('Date agreed e.g. "2026-02-26"')))

    // /diplomacy remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an ally or NAP (Officers+)')
      .addStringOption(o => o
        .setName('type')
        .setDescription('Relationship type')
        .setRequired(true)
        .addChoices(
          { name: '🤝 Ally', value: 'ally' },
          { name: '🕊️ NAP',  value: 'nap'  },
        ))
      .addIntegerOption(o => o.setName('number').setDescription('Number from /diplomacy list').setMinValue(1))
      .addStringOption(o => o.setName('name').setDescription('Alliance name to remove')))

    // /diplomacy list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show current allies and NAPs (Officers only — use /diplomacy post for everyone)'))

    // /diplomacy post
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Post the diplomacy list to a channel')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText))),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const diplo   = loadDiplo(guildId);

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const type  = interaction.options.getString('type');
      const name  = interaction.options.getString('name');
      const note  = interaction.options.getString('note') || '';
      const since = interaction.options.getString('since') || '';
      const list  = type === 'ally' ? diplo.allies : diplo.naps;

      // Check for duplicate
      if (list.find(e => e.name.toLowerCase() === name.toLowerCase())) {
        return interaction.reply({
          content: `⚠️ **${name}** is already in your ${type === 'ally' ? 'allies' : 'NAPs'} list.`,
          ephemeral: true,
        });
      }

      list.push({ name, note, since, addedAt: Date.now() });
      saveDiplo(guildId, diplo);

      const typeLabel = type === 'ally' ? '🤝 Ally' : '🕊️ NAP';
      const noteStr   = note ? ` — ${note}` : '';
      return interaction.reply({
        content: `✅ **${typeLabel}: ${name}**${noteStr} added to diplomacy records.`,
        ephemeral: true,
      });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const type   = interaction.options.getString('type');
      const number = interaction.options.getInteger('number');
      const name   = interaction.options.getString('name');
      const list   = type === 'ally' ? diplo.allies : diplo.naps;

      if (!number && !name) {
        return interaction.reply({
          content: '❌ Provide either a number from `/diplomacy list` or an alliance name.',
          ephemeral: true,
        });
      }

      let targetName;
      if (number) {
        const target = list[number - 1];
        if (!target) {
          return interaction.reply({
            content: `❌ No ${type === 'ally' ? 'ally' : 'NAP'} at number **${number}**. Use \`/diplomacy list\` to see the current list.`,
            ephemeral: true,
          });
        }
        targetName = target.name;
      } else {
        targetName = name;
      }

      const before  = list.length;
      const updated = list.filter(e => e.name.toLowerCase() !== targetName.toLowerCase());

      if (updated.length === before) {
        return interaction.reply({
          content: `❌ **${targetName}** not found in ${type === 'ally' ? 'allies' : 'NAPs'} list.`,
          ephemeral: true,
        });
      }

      if (type === 'ally') diplo.allies = updated;
      else diplo.naps = updated;

      saveDiplo(guildId, diplo);

      return interaction.reply({
        content: `🗑️ **${targetName}** removed from ${type === 'ally' ? 'allies' : 'NAPs'}.`,
        ephemeral: true,
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      return interaction.reply({ content: buildDiploText(diplo), ephemeral: true });
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    if (sub === 'post') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ content: buildDiploText(diplo) });
      return interaction.reply({ content: `✅ Diplomacy list posted in <#${channel.id}>`, ephemeral: true });
    }
  },
};
