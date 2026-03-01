const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { divider } = require('../embeds');
const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/welcome_config.json');

function loadConfig(guildId) {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return all[guildId] || null;
  } catch { return null; }
}

function saveConfig(guildId, data) {
  let all = {};
  try { if (fs.existsSync(CONFIG_FILE)) all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  all[guildId] = data;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(all, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome message for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /welcome setup
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Set the welcome channel and message')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to send welcome messages in')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o
        .setName('message')
        .setDescription('Welcome message — use {user} {name} {server}, and \\n for new lines')
        .setRequired(true))
      .addStringOption(o => o
        .setName('title')
        .setDescription('Title line (default: "⚔️ A new member joins the alliance!")')))

    // /welcome edit
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Quickly update part of the welcome message without retyping it all')
      .addStringOption(o => o
        .setName('action')
        .setDescription('What to do')
        .setRequired(true)
        .addChoices(
          { name: '➕ Append — add text to the end',          value: 'append'  },
          { name: '⬆️ Prepend — add text to the beginning',   value: 'prepend' },
          { name: '✏️ Replace — swap one phrase for another',  value: 'replace' },
          { name: '📝 Title — change just the title line',     value: 'title'   },
        ))
      .addStringOption(o => o
        .setName('text')
        .setDescription('Text to add, or the NEW text when using Replace. Use \\n for new lines.')
        .setRequired(true))
      .addStringOption(o => o
        .setName('find')
        .setDescription('(Replace only) The exact phrase you want to swap out')))

    // /welcome test
    .addSubcommand(sub => sub
      .setName('test')
      .setDescription('Preview the welcome message as it will appear'))

    // /welcome disable
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Turn off welcome messages'))

    // /welcome status
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Show current welcome message configuration')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── SETUP ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const title   = interaction.options.getString('title') || '⚔️ A new member joins the alliance!';

      saveConfig(guildId, { enabled: true, channelId: channel.id, message, title });

      return interaction.reply({
        content: `✅ Welcome messages enabled in <#${channel.id}>!\n\nUse \`/welcome test\` to preview, or \`/welcome edit\` to tweak it later.`,
        ephemeral: true,
      });
    }

    // ── EDIT ──────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const config = loadConfig(guildId);
      if (!config) {
        return interaction.reply({ content: '❌ No welcome message set up yet. Use `/welcome setup` first.', ephemeral: true });
      }

      const action = interaction.options.getString('action');
      const text   = interaction.options.getString('text');
      const find   = interaction.options.getString('find');

      let updated = config.message;

      if (action === 'append') {
        updated = config.message + '\\n' + text;
      }

      if (action === 'prepend') {
        updated = text + '\\n' + config.message;
      }

      if (action === 'replace') {
        if (!find) {
          return interaction.reply({ content: '❌ You need to provide the **find** option when using Replace — the exact phrase to swap out.', ephemeral: true });
        }
        if (!config.message.includes(find)) {
          return interaction.reply({ content: `❌ Could not find **"${find}"** in your current message. Check the spelling — it must match exactly.`, ephemeral: true });
        }
        updated = config.message.replace(find, text);
      }

      if (action === 'title') {
        saveConfig(guildId, { ...config, title: text });
        return interaction.reply({
          content: `✅ Title updated to: **${text}**\n\nRun \`/welcome test\` to preview.`,
          ephemeral: true,
        });
      }

      saveConfig(guildId, { ...config, message: updated });

      const actionLabel = { append: 'added to the end', prepend: 'added to the beginning', replace: 'phrase swapped' }[action];
      return interaction.reply({
        content: `✅ Welcome message updated — ${actionLabel}.\n\nRun \`/welcome test\` to preview the full message.`,
        ephemeral: true,
      });
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (sub === 'test') {
      const config = loadConfig(guildId);
      if (!config?.enabled) {
        return interaction.reply({ content: '❌ Welcome messages are not set up yet. Use `/welcome setup` first.', ephemeral: true });
      }
      const preview = buildWelcomeText(config, interaction.member, interaction.guild);
      return interaction.reply({ content: '👀 **Preview** — this is what new members will see:\n\n' + preview, ephemeral: true });
    }

    // ── DISABLE ───────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      const config = loadConfig(guildId);
      if (!config) return interaction.reply({ content: '⚠️ Welcome messages were not configured.', ephemeral: true });
      saveConfig(guildId, { ...config, enabled: false });
      return interaction.reply({ content: '🔕 Welcome messages have been disabled.', ephemeral: true });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const config = loadConfig(guildId);
      if (!config) return interaction.reply({ content: '❌ Not set up yet. Use `/welcome setup`.', ephemeral: true });

      const statusLines = [
        '⚙️ **Welcome Message Configuration**',
        divider(),
        `**Status:** ${config.enabled ? '✅ Enabled' : '🔕 Disabled'}`,
        `**Channel:** <#${config.channelId}>`,
        `**Title:** ${config.title || '*(default)*'}`,
        `**Message:**\n${config.message}`,
        divider(),
        '**Variables:** `{user}` = mention  ·  `{name}` = username  ·  `{server}` = server name',
        '**Tip:** Use `/welcome edit` to append, prepend or replace text without retyping everything.',
        divider(),
        '⚔️ Duck War Survival',
      ];
      return interaction.reply({ content: statusLines.join('\n'), ephemeral: true });
    }
  },
};

// ── Shared plain text builder (also used by index.js) ────────────────────────

function buildWelcomeText(config, member, guild) {
  const body = config.message
    .replace(/{user}/g,   `<@${member.id}>`)
    .replace(/{name}/g,   member.displayName || member.user?.username || 'Survivor')
    .replace(/{server}/g, guild.name)
    .replace(/\\n/g, '\n');

  const tag     = `<@${member.id}>`;
  const tagLine = body.includes(tag) ? '' : tag + '\n';

  return [
    tagLine + (config.title || '⚔️ **A new member joins the alliance!**'),
    divider(),
    body,
    divider(),
    `☠ ${guild.name} — Duck War Survival`,
  ].join('\n');
}

module.exports.buildWelcomeEmbed = buildWelcomeText;
module.exports.buildWelcomeText  = buildWelcomeText;
module.exports.loadConfig        = loadConfig;
