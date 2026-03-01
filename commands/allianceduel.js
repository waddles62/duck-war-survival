const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { COLOURS } = require('../embeds');

// ── Alliance Duel event data (verified from in-game screenshots) ──────────────
const DAYS = [
  {
    day: 1,
    name: 'Shelter Expansion',
    emoji: '🏗️',
    focus: 'Building, research, speed-ups & gathering',
    verified: true,
    tasks: [
      { pts: 245, desc: 'Gather 10,000 Coins (radar collection events excluded)' },
      { pts: 122, desc: 'Gather 10,000 Wood (radar collection events excluded)' },
      { pts: 122, desc: 'Gather 10,000 Electricity (radar collection events excluded)' },
      { pts: 122, desc: 'Gather 10,000 Iron (radar collection events excluded)' },
      { pts: 82,  desc: 'Increase Structure CP by 100 points' },
      { pts: 82,  desc: 'Increase Tech CP by 100 points' },
      { pts: 41,  desc: 'Use any 1-min acceleration in construction' },
      { pts: 41,  desc: 'Use any 1-min acceleration in research' },
      { pts: 31,  desc: 'Consume 1 Wisdom Medal' },
      { pts: 10,  desc: 'Buy packs to get 1 Ruby' },
    ],
    tips: [
      'Send all marches gathering before the day starts — Coins give 2× points vs other resources',
      'Radar collection events do NOT count — manual gathering only',
      'Stack 1-min speed-ups in construction and research — 41 pts each',
      'Save Wisdom Medals for this day — 31 pts each',
    ],
  },
  {
    day: 2,
    name: 'Hero Initiative',
    emoji: '🦸',
    focus: 'Hero fragments, Prime Recruits, Radar events & Equipment fragments',
    verified: true,
    tasks: [
      { pts: 6559, desc: 'Complete 1 Radar event' },
      { pts: 4185, desc: 'Every 1 Exclusive Equipment Fragment consumed' },
      { pts: 4185, desc: 'Every 1 Orange hero fragment spent in Star Rise' },
      { pts: 3689, desc: 'Perform 1 Prime Recruit' },
      { pts: 930,  desc: 'Every 1 Purple hero fragment spent in Star Rise' },
      { pts: 465,  desc: 'Every 1 Blue hero fragment spent in Star Rise' },
    ],
    tips: [
      'Complete your Radar event first — 6,559 pts is the highest single task',
      'Orange hero fragments and Exclusive Equipment Fragments give equal points (4,185 each)',
      'Save Prime Recruit draws all week and spend them today (3,689 pts each)',
      'Orange fragments give 4.5× more points than purple — prioritise them',
    ],
  },
  {
    day: 3,
    name: 'Keep Progressing',
    emoji: '🚛',
    focus: 'Dark Syndicate escort, Shadow Calls, Lucky Chests & Power Cores',
    verified: true,
    tasks: [
      { pts: 62000, desc: 'Escort S-Tier Dark Syndicate\'s Truck once' },
      { pts: 31000, desc: 'Perform 1 Orange [Shadow Calls] mission' },
      { pts: 6200,  desc: 'Open 1 Hero Equipment Lucky Chest' },
      { pts: 2790,  desc: 'Consume 1 Power Core' },
      { pts: 41,    desc: 'Use any 1-min acceleration in unit training & promotion' },
    ],
    tips: [
      'Escorting the S-Tier Dark Syndicate Truck is by far the best task — 62,000 pts!',
      'Orange Shadow Calls missions give 31,000 pts — prioritise these over lower missions',
      'Hero Equipment Lucky Chests give 6,200 pts — save them for today',
      'Power Cores give 2,790 pts each — use any spares today not other days',
    ],
  },
  {
    day: 4,
    name: 'Arms Expert',
    emoji: '🔧',
    focus: 'Radar events, Blueprints, Titanium Alloys, Zombie kills & Boomer rallies',
    verified: true,
    tasks: [
      { pts: 6559, desc: 'Complete 1 Radar event' },
      { pts: 4100, desc: 'Launch a rally and beat a Lv.1-4 Boomer (higher levels give more pts)' },
      { pts: 1967, desc: 'Kill 1 Lv.1-10 Roamer' },
      { pts: 1674, desc: 'Consume 1 Design Blueprint' },
      { pts: 837,  desc: 'Consume 1 Titanium Alloy' },
      { pts: 41,   desc: 'Use any 1-min acceleration in construction' },
      { pts: 41,   desc: 'Use any 1-min acceleration in research' },
      { pts: 41,   desc: 'Use any 1-min acceleration in unit training & promotion' },
      { pts: 9,    desc: 'Use 1 Gear' },
    ],
    tips: [
      'Complete your Radar event first — 6,559 pts for a single task',
      'Higher level Boomer rallies give more points — coordinate with your alliance for Lv.20',
      'Save Design Blueprints and Titanium Alloys specifically for today',
      'Kill as many Roamers as stamina allows — 1,967 pts each',
      'All three speed-up types give 41 pts each — use them across construction, research & training',
    ],
  },
  {
    day: 5,
    name: 'Holistic Growth',
    emoji: '🌱',
    focus: 'Hero fragments, Equipment fragments, Power Cores, Blueprints & speed-ups',
    verified: true,
    tasks: [
      { pts: 4185, desc: 'Every 1 Exclusive Equipment Fragment consumed' },
      { pts: 4185, desc: 'Every 1 Orange hero fragment spent in Star Rise' },
      { pts: 2790, desc: 'Consume 1 Power Core' },
      { pts: 1674, desc: 'Consume 1 Design Blueprint' },
      { pts: 930,  desc: 'Every 1 Purple hero fragment spent in Star Rise' },
      { pts: 837,  desc: 'Consume 1 Titanium Alloy' },
      { pts: 465,  desc: 'Every 1 Blue hero fragment spent in Star Rise' },
      { pts: 41,   desc: 'Use any 1-min acceleration in construction' },
      { pts: 31,   desc: 'Consume 1 Wisdom Medal' },
      { pts: 9,    desc: 'Use 1 Gear' },
    ],
    tips: [
      'Exclusive Equipment Fragments and Orange hero fragments give equal top points (4,185 each)',
      'Power Cores give 2,790 pts — save any spares from earlier days for today',
      'Design Blueprints (1,674) beat Titanium Alloys (837) — prioritise Blueprints',
      'Stack all remaining hero fragments here — orange give 4.5× more than purple',
    ],
  },
  {
    day: 6,
    name: 'Enemy Buster',
    emoji: '⚔️',
    focus: 'Shadow Calls, speed-ups & PvP combat against rival alliances',
    verified: true,
    tasks: [
      { pts: 31000, desc: 'Perform 1 Orange [Shadow Calls] mission' },
      { pts: 41,    desc: 'Use a total of 1 min of Speedups' },
      { pts: 24,    desc: 'Beat 10 Lv.1 units from rival alliance (higher levels give more pts)' },
      { pts: 4,     desc: 'Defeat 10 Lv.1 units (higher levels give more pts)' },
      { pts: 3,     desc: 'Lose 10 Lv.1 units (higher levels give more pts)' },
    ],
    tips: [
      'Orange Shadow Calls missions are the priority at 31,000 pts each',
      'PvP combat counts — beating rival alliance units gives bonus points on top of standard kills',
      'Speed-ups give 41 pts per minute used — stack them up',
      'Higher unit levels in PvP give more points — push for higher tier engagements',
      '⚠️ Higher unit level point values still need screenshots — scroll down in-game to see full list',
    ],
  },
];

// ── Plain text page builders ─────────────────────────────────────────────────

function buildOverviewEmbed() {
  const lines = [
    '⚔️ **ALLIANCE DUEL — 6-Day Event Schedule**',
    '────────────────────',
    'A 6-day competitive alliance event in Dark War: Survival.',
    'Each day has a different theme. Complete tasks to earn points for ranking rewards.',
    'All days verified from in-game screenshots ✅',
    '',
  ];
  DAYS.forEach(d => {
    lines.push(`${d.emoji} **Day ${d.day} — ${d.name}** ${d.verified ? '✅' : '❓'}`);
    lines.push(d.focus);
    lines.push('');
  });
  lines.push('────────────────────');
  lines.push('☠ Dark War: Survival — Use buttons to view each day');
  return lines.join('\n');
}

function buildDayEmbed(dayData) {
  if (!dayData.verified || dayData.tasks.length === 0) {
    return [
      `❓ **Day ${dayData.day} — Tasks Not Yet Confirmed**`,
      '────────────────────',
      "This day's tasks haven't been verified from in-game screenshots yet.",
      'Share a screenshot of this day from the Alliance Duel event in-game to add it.',
      '────────────────────',
      `Day ${dayData.day} of ${DAYS.length}  ·  ☠ Alliance Command`,
    ].join('\n');
  }

  const taskLines = dayData.tasks
    .map(t => `\`${String(t.pts).padStart(6)} pts\`  ${t.desc}`)
    .join('\n');

  const tipLines = dayData.tips.map(t => `▸ ${t}`).join('\n');

  return [
    `${dayData.emoji} **Day ${dayData.day} — ${dayData.name}** ✅`,
    '────────────────────',
    `**Focus:** ${dayData.focus}`,
    '',
    '📋 **Point-Earning Tasks**',
    taskLines,
    '',
    '💡 **Tips**',
    tipLines,
    '────────────────────',
    `Day ${dayData.day} of ${DAYS.length}  ·  ☠ Dark War: Survival — Alliance Duel`,
  ].join('\n');
}

// ── Nav rows — max 5 buttons per row, 6 days needs 2 rows ────────────────────

function buildNavRows(currentDay) {
  // Row 1: Overview + Days 1, 2, 3
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ad_overview')
      .setLabel('📅 Overview')
      .setStyle(currentDay === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ...DAYS.slice(0, 3).map(d =>
      new ButtonBuilder()
        .setCustomId(`ad_day_${d.day}`)
        .setLabel(`Day ${d.day}`)
        .setEmoji(d.emoji)
        .setStyle(currentDay === d.day ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
  );

  // Row 2: Days 4, 5, 6
  const row2 = new ActionRowBuilder().addComponents(
    ...DAYS.slice(3).map(d =>
      new ButtonBuilder()
        .setCustomId(`ad_day_${d.day}`)
        .setLabel(`Day ${d.day}`)
        .setEmoji(d.emoji)
        .setStyle(currentDay === d.day ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
  );

  return [row1, row2];
}

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allianceduel')
    .setDescription('📅 Show the Alliance Duel 6-day event schedule for Dark War: Survival')
    .addIntegerOption(o => o
      .setName('day')
      .setDescription('Jump straight to a specific day (1–6)')
      .setMinValue(1)
      .setMaxValue(6)
    ),

  async execute(interaction) {
    const dayArg = interaction.options.getInteger('day');

    let currentDay = dayArg || 0;
    let pageText = dayArg ? buildDayEmbed(DAYS[dayArg - 1]) : buildOverviewEmbed();
    let rows = buildNavRows(currentDay);

    await interaction.reply({ content: pageText, components: rows });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Only the person who ran this command can navigate it.', ephemeral: true });
      }

      if (i.customId === 'ad_overview') {
        currentDay = 0;
        pageText = buildOverviewEmbed();
      } else {
        const day = parseInt(i.customId.replace('ad_day_', ''));
        currentDay = day;
        pageText = buildDayEmbed(DAYS[day - 1]);
      }

      rows = buildNavRows(currentDay);
      await i.update({ content: pageText, components: rows });
    });

    collector.on('end', async () => {
      const disabledRows = buildNavRows(currentDay).map(row =>
        new ActionRowBuilder().addComponents(
          ...row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
        )
      );
      try { await msg.edit({ components: disabledRows }); } catch {}
    });
  },
};
