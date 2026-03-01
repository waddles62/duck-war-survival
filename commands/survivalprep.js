const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { COLOURS } = require('../embeds');

// ── Survival Preparedness event data (from darkwardata.com) ──────────────────
const EVENT = {
  name: 'Survival Preparedness',
  description: 'A **weekly recurring event** in Dark War: Survival. Runs over 2 days with multiple simultaneous sub-events each day. Complete tasks to earn points, ranking rewards, and special items.',
  days: [
    {
      day: 1,
      label: 'Day 1',
      emoji: '🏗️',
      summary: 'Build, research, train & hero cultivation',
      subevents: [
        {
          name: 'Shelter Expansion',
          emoji: '🏠',
          color: 0xD4900A,
          tasks: [
            { pts: 600, desc: 'Use 1 Precision Part in building upgrades' },
            { pts: 20,  desc: 'Increase Structure CP by 100 points' },
            { pts: 20,  desc: 'Increase Tech CP by 100 points' },
            { pts: 20,  desc: 'Consume 1 Wisdom Medal' },
            { pts: 10,  desc: 'Use any 1-min acceleration in construction' },
            { pts: 10,  desc: 'Use any 1-min acceleration in research' },
            { pts: 5,   desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Queue as many building & tech upgrades as possible before the event',
            'Use 1-min speed-ups freely — each one earns 10 pts',
            'Save Wisdom Medals and Precision Parts for this day',
          ],
        },
        {
          name: 'Hero Trial',
          emoji: '🦸',
          color: 0xB16AFF,
          tasks: [
            { pts: 1350, desc: 'Every 1 Orange hero fragment spent in Star Rise' },
            { pts: 900,  desc: 'Perform 1 Prime Recruitment' },
            { pts: 300,  desc: 'Every 1 Purple hero fragment spent in Star Rise' },
            { pts: 150,  desc: 'Every 1 Blue hero fragment spent in Star Rise' },
            { pts: 5,    desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Orange fragments give 9× more points than blue — prioritise them',
            'Save fragments all week and spend them on Day 1',
            'Prime Recruitment gives 900 pts per draw — use your draws today',
          ],
        },
        {
          name: 'Unit Training',
          emoji: '⚔️',
          color: 0xC0392B,
          tasks: [
            { pts: 182, desc: 'Train 1 Lv.10 Unit' },
            { pts: 148, desc: 'Train 1 Lv.9 Unit' },
            { pts: 115, desc: 'Train 1 Lv.8 Unit' },
            { pts: 90,  desc: 'Train 1 Lv.7 Unit' },
            { pts: 70,  desc: 'Train 1 Lv.6 Unit' },
            { pts: 56,  desc: 'Train 1 Lv.5 Unit' },
            { pts: 38,  desc: 'Train 1 Lv.4 Unit' },
            { pts: 26,  desc: 'Train 1 Lv.3 Unit' },
            { pts: 18,  desc: 'Train 1 Lv.2 Unit' },
            { pts: 12,  desc: 'Train 1 Lv.1 Unit' },
            { pts: 0,   desc: 'Promote Units (corresponding points)' },
            { pts: 5,   desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Have training queues running before the event starts',
            'Higher tier troops = more points per unit — train Lv.8–10 if possible',
            'Use training speed-ups today, not on other days',
          ],
        },
        {
          name: 'Arms Expert',
          emoji: '🔧',
          color: 0x7F8C8D,
          tasks: [
            { pts: 1350, desc: 'Every 1 Orange hero fragment spent in Star Rise' },
            { pts: 300,  desc: 'Every 1 Purple hero fragment spent in Star Rise' },
            { pts: 150,  desc: 'Every 1 Blue hero fragment spent in Star Rise' },
            { pts: 10,   desc: 'Consume 1 Wisdom Medal' },
            { pts: 10,   desc: 'Use any 1-min acceleration in construction' },
            { pts: 10,   desc: 'Use any 1-min acceleration in research' },
            { pts: 10,   desc: 'Use any 1-min acceleration in unit training/promotion' },
            { pts: 3,    desc: 'Use 1 Gear' },
            { pts: 5,    desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'This overlaps with Hero Trial — hero fragments count for BOTH events',
            'Speed-ups count across all categories — construction, research & training',
            'Gears give low points (3 each) but are easy to stack up',
          ],
        },
      ],
    },
    {
      day: 2,
      label: 'Day 2',
      emoji: '🧟',
      summary: 'Zombie kills, Boomer rallies, gathering & equipment',
      subevents: [
        {
          name: 'Elimination Program',
          emoji: '💀',
          color: 0xC0392B,
          tasks: [
            { pts: 2500, desc: 'Rally kill a Lv.20 Boomer' },
            { pts: 2250, desc: 'Rally kill a Lv.17–19 Boomer' },
            { pts: 2000, desc: 'Rally kill a Lv.14–16 Boomer  ·  OR open 1 Hero Equipment Lucky Chest' },
            { pts: 1750, desc: 'Rally kill a Lv.11–13 Boomer' },
            { pts: 1500, desc: 'Rally kill a Lv.8–10 Boomer' },
            { pts: 1250, desc: 'Rally kill a Lv.5–7 Boomer' },
            { pts: 1000, desc: 'Rally kill a Lv.1–4 Boomer' },
            { pts: 660,  desc: 'Kill 1 Lv.31–40 Roaming Zombie' },
            { pts: 600,  desc: 'Kill 1 Lv.21–30 Roaming Zombie  ·  OR complete 1 Radar event' },
            { pts: 540,  desc: 'Kill 1 Lv.11–20 Roaming Zombie' },
            { pts: 480,  desc: 'Kill 1 Lv.1–10 Roaming Zombie' },
            { pts: 5,    desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Coordinate Lv.20 Boomer rallies with your alliance — 2500 pts each!',
            'Save your stamina on Day 1 so you can hit zombies hard on Day 2',
            'Hero Equipment Lucky Chests give 2000 pts — worth opening today',
            'Complete your Radar event for an easy 600 pts',
          ],
        },
        {
          name: 'Modification Contest',
          emoji: '🔩',
          color: 0x27AE60,
          tasks: [
            { pts: 540, desc: 'Consume 1 Design Blueprint' },
            { pts: 270, desc: 'Consume 1 Titanium Alloy' },
            { pts: 40,  desc: 'Gather 10,000 Coins (manual marches, no radar)' },
            { pts: 20,  desc: 'Gather 10,000 Wood (manual marches, no radar)' },
            { pts: 20,  desc: 'Gather 10,000 Electricity (manual marches, no radar)' },
            { pts: 20,  desc: 'Gather 10,000 Iron (manual marches, no radar)' },
            { pts: 5,   desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Save Design Blueprints and Titanium Alloys for Day 2',
            'Send multiple marches out for manual gathering (radar events DON\'T count)',
            'Coins give 2× more points than other resources — prioritise gathering Coins',
          ],
        },
        {
          name: 'Well Equipped',
          emoji: '🛡️',
          color: 0xD4900A,
          tasks: [
            { pts: 2000, desc: 'Open 1 Hero Equipment Lucky Chest' },
            { pts: 900,  desc: 'Consume 1 Power Core' },
            { pts: 5,    desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Hero Equipment Lucky Chests give 2000 pts — also counts in Elimination Program',
            'Power Cores are 900 pts each — use spares today not other days',
            'Stack Lucky Chest openings if you have multiple saved up',
          ],
        },
        {
          name: 'Arms Expert',
          emoji: '🔧',
          color: 0x7F8C8D,
          tasks: [
            { pts: 1350, desc: 'Every 1 Orange hero fragment spent in Star Rise' },
            { pts: 300,  desc: 'Every 1 Purple hero fragment spent in Star Rise' },
            { pts: 150,  desc: 'Every 1 Blue hero fragment spent in Star Rise' },
            { pts: 10,   desc: 'Consume 1 Wisdom Medal' },
            { pts: 10,   desc: 'Use any 1-min acceleration in construction' },
            { pts: 10,   desc: 'Use any 1-min acceleration in research' },
            { pts: 10,   desc: 'Use any 1-min acceleration in unit training/promotion' },
            { pts: 3,    desc: 'Use 1 Gear' },
            { pts: 5,    desc: 'Buy packs to get 1 Ruby' },
          ],
          tips: [
            'Arms Expert runs on both days — keep spending fragments and speed-ups',
            'Any remaining fragments from Day 1 can still be spent here',
          ],
        },
      ],
    },
  ],
};

// ── Plain text page builders ─────────────────────────────────────────────────

function buildOverviewEmbed() {
  const lines = [
    '☣️ **SURVIVAL PREPAREDNESS — Weekly Event Guide**',
    '────────────────────',
    EVENT.description,
    '',
    '🏗️ **Day 1 — Build & Cultivate**',
    EVENT.days[0].subevents.map(s => `${s.emoji} **${s.name}**`).join('\n'),
    '',
    '🧟 **Day 2 — Fight & Gather**',
    EVENT.days[1].subevents.map(s => `${s.emoji} **${s.name}**`).join('\n'),
    '',
    '⚠️ **Key Rules**',
    '▸ Multiple sub-events run **simultaneously** each day',
    '▸ Arms Expert runs on **both** days',
    '▸ Hero fragments count across **multiple** sub-events at once',
    '▸ Radar gathering does **NOT** count for Modification Contest',
    '▸ Event resets **weekly** — plan your resources around it',
    '────────────────────',
    '☠ Dark War: Survival — Use buttons to explore each day & sub-event',
  ];
  return lines.join('\n');
}

function buildDayEmbed(dayData) {
  const lines = [
    `${dayData.emoji} **Survival Preparedness — ${dayData.label}**`,
    '────────────────────',
    `**Focus:** ${dayData.summary}`,
    `**${dayData.subevents.length} sub-events** run simultaneously. Select one below to see its tasks.`,
    '',
  ];
  for (const sub of dayData.subevents) {
    const topTasks = sub.tasks.slice(0, 3).map(t => `\`${String(t.pts).padStart(4)}pts\` ${t.desc}`).join('\n');
    lines.push(`${sub.emoji} **${sub.name}**`);
    lines.push(topTasks + (sub.tasks.length > 3 ? `\n*...and ${sub.tasks.length - 3} more tasks*` : ''));
    lines.push('');
  }
  lines.push('────────────────────');
  lines.push('☠ Dark War: Survival — Alliance Command');
  return lines.join('\n');
}

function buildSubeventEmbed(dayData, subIndex) {
  const sub = dayData.subevents[subIndex];

  const taskLines = sub.tasks
    .map(t => t.pts > 0
      ? `\`${String(t.pts).padStart(4)} pts\`  ${t.desc}`
      : `\`   —  \`  ${t.desc}`)
    .join('\n');

  const tipLines = sub.tips.map(t => `▸ ${t}`).join('\n');

  return [
    `${sub.emoji} **${sub.name} · ${dayData.label}**`,
    '────────────────────',
    `Part of **Survival Preparedness** — runs simultaneously with other ${dayData.label} sub-events.`,
    '',
    '📋 **Tasks & Points**',
    taskLines,
    '',
    '💡 **Tips**',
    tipLines,
    '────────────────────',
    `${dayData.label} of 2  ·  ☠ Dark War: Survival — Survival Preparedness`,
  ].join('\n');
}

// ── Navigation row builders ───────────────────────────────────────────────────

function buildTopRow(view) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sp_overview')
      .setLabel('📅 Overview')
      .setStyle(view === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sp_day_1')
      .setLabel('🏗️ Day 1')
      .setStyle(view === 'day_1' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sp_day_2')
      .setLabel('🧟 Day 2')
      .setStyle(view === 'day_2' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

function buildSubRow(dayData, activeIndex) {
  const row = new ActionRowBuilder();
  dayData.subevents.forEach((sub, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`sp_sub_${dayData.day}_${i}`)
        .setLabel(sub.name)
        .setEmoji(sub.emoji)
        .setStyle(activeIndex === i ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
  });
  return row;
}

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('survivalprep')
    .setDescription('📅 Show the Survival Preparedness weekly event guide for Dark War: Survival'),

  async execute(interaction) {
    let view = 'overview';
    let activeDay = null;
    let activeSubIndex = null;

    let embed = buildOverviewEmbed();
    const rows = [buildTopRow('overview')];

    await interaction.reply({ content: embed, components: rows });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Only the person who ran this command can navigate it.', ephemeral: true });
      }

      const id = i.customId;

      if (id === 'sp_overview') {
        view = 'overview';
        activeDay = null;
        activeSubIndex = null;
        embed = buildOverviewEmbed();
        await i.update({ content: embed, components: [buildTopRow('overview')] });

      } else if (id === 'sp_day_1' || id === 'sp_day_2') {
        const dayNum = parseInt(id.replace('sp_day_', ''));
        activeDay = EVENT.days[dayNum - 1];
        activeSubIndex = null;
        view = `day_${dayNum}`;
        embed = buildDayEmbed(activeDay);
        await i.update({
          content: embed,
          components: [buildTopRow(view), buildSubRow(activeDay, null)],
        });

      } else if (id.startsWith('sp_sub_')) {
        const parts = id.replace('sp_sub_', '').split('_');
        const dayNum = parseInt(parts[0]);
        const subIdx = parseInt(parts[1]);
        activeDay = EVENT.days[dayNum - 1];
        activeSubIndex = subIdx;
        view = `day_${dayNum}`;
        embed = buildSubeventEmbed(activeDay, subIdx);
        await i.update({
          content: embed,
          components: [buildTopRow(view), buildSubRow(activeDay, subIdx)],
        });
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRows = [buildTopRow(view)];
        if (activeDay) disabledRows.push(buildSubRow(activeDay, activeSubIndex));
        const allDisabled = disabledRows.map(row =>
          new ActionRowBuilder().addComponents(
            ...row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
          )
        );
        await msg.edit({ components: allDisabled });
      } catch {}
    });
  },
};
