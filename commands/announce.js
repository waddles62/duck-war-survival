const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { announcementText } = require('../embeds');
const { addAnnouncementToSchedule } = require('../scheduleHelper');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post a Alliance Command Bot alliance announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o
      .setName('type')
      .setDescription('Announcement type')
      .setRequired(true)
      .addChoices(
        { name: '🔴 War Alert',     value: 'war'      },
        { name: '🟠 Rally Call',    value: 'rally'    },
        { name: '🟡 Event Brief',   value: 'event'    },
        { name: '🟢 Resource Call', value: 'resource' },
        { name: '⚪ General Info',  value: 'general'  },
      ))
    .addStringOption(o => o
      .setName('title')
      .setDescription('Announcement title, e.g. "Territory War — Zone 7 Assault"')
      .setRequired(true))
    .addStringOption(o => o
      .setName('message')
      .setDescription('Full announcement body')
      .setRequired(true))
    .addRoleOption(o => o
      .setName('mention')
      .setDescription('Role to tag — overrides the default @everyone for war/rally (choose @everyone role to ping all)'))
    .addIntegerOption(o => o
      .setName('countdown')
      .setDescription('Rally countdown in minutes (for rally/war types)'))
    .addStringOption(o => o
      .setName('schedule')
      .setDescription('Schedule time as YYYY-MM-DD HH:MM (24h UTC), e.g. 2025-03-01 20:00'))
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Target channel (defaults to current channel)')
      .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const type          = interaction.options.getString('type');
    const title         = interaction.options.getString('title');
    const message       = interaction.options.getString('message');
    const mentionRole   = interaction.options.getRole('mention');
    const countdownMins = interaction.options.getInteger('countdown');
    const scheduleStr   = interaction.options.getString('schedule');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const author        = interaction.member.displayName;

    const countdownSecs = countdownMins ? countdownMins * 60 : null;

    // ── Work out the mention string ───────────────────────────────────────────
    // Priority: explicit role pick > default @everyone for war/rally > nothing
    let mentionStr = null;
    if (mentionRole) {
      mentionStr = mentionRole.name === '@everyone' ? '@everyone' : `<@&${mentionRole.id}>`;
    } else if (type === 'war' || type === 'rally') {
      mentionStr = '@everyone';
    }

    // ── Scheduled post ────────────────────────────────────────────────────────
    if (scheduleStr) {
      const scheduledAt = Date.parse(scheduleStr.replace(' ', 'T') + ':00Z');
      if (isNaN(scheduledAt)) {
        return interaction.editReply('❌ Invalid schedule format. Use `YYYY-MM-DD HH:MM` (24h UTC).');
      }
      if (scheduledAt <= Date.now()) {
        return interaction.editReply('❌ Scheduled time must be in the future.');
      }

      db.addAnnouncement({
        type, title, description: message,
        author, countdown: countdownSecs,
        mentionStr,
        channelId: targetChannel.id,
        scheduled: true,
        scheduledAt,
        sent: false,
      });

      // Add to event schedule
      addAnnouncementToSchedule(interaction.guildId, { title, type, scheduledAt });

      const when       = new Date(scheduledAt).toUTCString();
      const mentionNote = mentionStr ? ` · will ping **${mentionStr}**` : '';
      return interaction.editReply(`✅ **${title}** scheduled for **${when}** in <#${targetChannel.id}>${mentionNote}\n📅 Added to \`/schedule\` automatically.`);
    }

    // ── Immediate post ────────────────────────────────────────────────────────
    const text = announcementText({ type, title, description: message, author, countdown: countdownSecs });
    const content = mentionStr ? mentionStr + '\n' + text : text;
    await targetChannel.send({ content });

    // Save to history
    db.addAnnouncement({
      type, title, description: message,
      author, countdown: countdownSecs,
      mentionStr,
      channelId: targetChannel.id,
      scheduled: false,
      sent: true,
    });

    const mentionNote = mentionStr ? ` — pinged **${mentionStr}**` : '';
    await interaction.editReply(`✅ Announcement posted in <#${targetChannel.id}>${mentionNote}`);
  },
};
