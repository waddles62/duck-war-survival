const {
  SlashCommandBuilder,
  
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { divider } = require('../embeds');

const PAGES = [
  {
    title: '📋  Duck War Survivals — Overview',
    description: 'Use the buttons below to browse commands by category.',
    fields: [
      { name: '📊  Stats & Roster',   value: 'View your stats, leaderboard and roster',        inline: true },
      { name: '📅  Event Guides',      value: 'Alliance Duel & Survival Prep schedules',        inline: true },
      { name: '⚔️  War & Rallies',     value: 'War status and rally call info',                 inline: true },
      { name: '📢  Announcements',     value: 'View pinned alliance announcements',              inline: true },
      { name: '❓  Help',              value: 'This menu',                                       inline: true },
    ],
    footer: 'Page 1 of 5  ·  ⚔️ Duck War Survival',
  },
  {
    title: '📊  Stats & Roster Commands',
    fields: [
      {
        name: '/stats view',
        value: 'View your own stats card — power, kills, contribution and rally hits.\n`/stats view` or `/stats view member:@someone`',
      },
      {
        name: '/stats leaderboard',
        value: 'Show the alliance leaderboard. Sort by contribution, power, kills or rally hits.\n`/stats leaderboard` or `/stats leaderboard sort:power`',
      },
      {
        name: '/roster list',
        value: 'View the full alliance roster. Filter by rank.\n`/roster list` or `/roster list filter:R3`',
      },
    ],
    footer: 'Page 2 of 5  ·  ☠ Stats & Roster',
  },
  {
    title: '📅  Event Guide Commands',
    fields: [
      {
        name: '/allianceduel',
        value: 'Interactive 6-day Alliance Duel schedule with task points and tips for each day.\n`/allianceduel` or jump to a day: `/allianceduel day:3`',
      },
      {
        name: '/survivalprep',
        value: 'Full Survival Preparedness weekly event guide — all sub-events with points and tips.\n`/survivalprep`',
      },
    ],
    footer: 'Page 3 of 5  ·  ☠ Event Guides',
  },
  {
    title: '⚔️  War & Rally Commands',
    fields: [
      {
        name: '/war status',
        value: 'Check the current active war — zones, stats and confirmed defenders.\n`/war status`',
      },
      {
        name: '/rally',
        value: 'Rally calls are posted by Officers — watch for @everyone pings with countdown timers.\nClick ✅ **I\'m In** or ❌ **Can\'t Make It** to sign up.',
      },
    ],
    footer: 'Page 4 of 5  ·  ☠ War & Rallies',
  },
  {
    title: '📢  Announcement & Misc Commands',
    fields: [
      {
        name: '/help',
        value: 'Show this help menu at any time.\n`/help`',
      },
      {
        name: '📣  Announcements',
        value: 'Alliance announcements are posted by Officers in the announcements channel.\nWar Alerts and Rally Calls will ping **@everyone** — make sure notifications are on!',
      },
      {
        name: '🌍  Translations',
        value: 'Important messages are translated into 12 languages by Officers.\nIf you need something translated, react to the message with your country\'s flag emoji.',
      },
    ],
    footer: 'Page 5 of 5  ·  ☠ Announcements & Misc',
  },
];

function buildText(pageIndex) {
  const page = PAGES[pageIndex];
  const lines = [
    `**${page.title}**`,
    '────────────────────',
  ];
  if (page.description) lines.push(page.description, '');
  for (const field of page.fields) {
    lines.push(`**${field.name}**`);
    lines.push(field.value);
    lines.push('');
  }
  lines.push('────────────────────');
  lines.push(page.footer);
  return lines.join('\n');
}

function buildRow(pageIndex) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('help_home')
      .setLabel('🏠 Home')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === PAGES.length - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available alliance bot commands'),

  async execute(interaction) {
    let pageIndex = 0;

    await interaction.reply({
      content: buildText(pageIndex),
      components: [buildRow(pageIndex)],
      ephemeral: true,
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ This menu belongs to someone else — run `/help` yourself!', ephemeral: true });
      }

      if (i.customId === 'help_next') pageIndex = Math.min(pageIndex + 1, PAGES.length - 1);
      if (i.customId === 'help_prev') pageIndex = Math.max(pageIndex - 1, 0);
      if (i.customId === 'help_home') pageIndex = 0;

      await i.update({
        content: buildText(pageIndex),
        components: [buildRow(pageIndex)],
      });
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        ...buildRow(pageIndex).components.map(b => ButtonBuilder.from(b).setDisabled(true))
      );
      try { await msg.edit({ components: [disabledRow] }); } catch {}
    });
  },
};
