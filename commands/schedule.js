const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  
  ChannelType,
} = require('discord.js');
const { divider } = require('../embeds');
const { attachFlagTranslator } = require('../reactionTranslate');
const { isOfficer: checkOfficer } = require('../rankFromRoles');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE  = path.join(__dirname, '../data/schedule_config.json');
const SCHEDULE_FILE = path.join(__dirname, '../data/schedule_items.json');

// ── Common timezones with friendly names ──────────────────────────────────────
const TIMEZONES = [
  { name: 'UTC',                     value: 'UTC' },
  { name: 'US Eastern (ET)',         value: 'America/New_York' },
  { name: 'US Central (CT)',         value: 'America/Chicago' },
  { name: 'US Mountain (MT)',        value: 'America/Denver' },
  { name: 'US Pacific (PT)',         value: 'America/Los_Angeles' },
  { name: 'UK (GMT/BST)',            value: 'Europe/London' },
  { name: 'Central Europe (CET)',    value: 'Europe/Berlin' },
  { name: 'Moscow (MSK)',            value: 'Europe/Moscow' },
  { name: 'Gulf (GST)',              value: 'Asia/Dubai' },
  { name: 'India (IST)',             value: 'Asia/Kolkata' },
  { name: 'China/Philippines (CST)', value: 'Asia/Shanghai' },
  { name: 'Japan/Korea (JST)',       value: 'Asia/Tokyo' },
  { name: 'GMT-2 (Mid-Atlantic)',     value: 'Etc/GMT+2' },
  { name: 'Australia East (AEST)',   value: 'Australia/Sydney' },
];

const DAYS = [
  'Sunday - Rest Day',
  'Monday - AD-SHELTER EXPANSION · Building CP · Tech CP · Building Speed Ups · Tech Speed Ups · Wisdom Medals · Gathering',
  'Tuesday - AD-HERO INITIATIVE · Hero Fragments · Prime Recruits · Radar Events',
  'Wednesday - AD-KEEP PROGRESSING · Troop Training · Training Speed Ups · Lucky Chests · Power Cores · S Tier Trucks · Orange Shadow Calls',
  'Thursday - AD-ARMS EXPERT · Gears · Titanium Alloys · Design Blueprints · Radar Events · Kill Roamers · Rally Boomers',
  'Friday - AD-HOLISTIC GROWTH · Gears · Titanium Alloys · Design Blueprints · Power Cores · Hero Fragments · Wisdom Medals · All Speed Ups',
  'Saturday - AD-ENEMY BUSTER · S Tier Trucks · Orange Shadow Calls · All Speed Ups · Defeat Enemy Troops · Lose Troops',
];

// Short names for Discord dropdown choices (max 100 chars)
const DAY_CHOICE_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_CHOICES = DAY_CHOICE_NAMES.map((d, i) => ({ name: d, value: String(i) }));

// ── File helpers ──────────────────────────────────────────────────────────────

function loadConfig(guildId) {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { timezone: 'UTC' };
    const all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return all[guildId] || { timezone: 'UTC' };
  } catch { return { timezone: 'UTC' }; }
}

function saveConfig(guildId, data) {
  let all = {};
  try { if (fs.existsSync(CONFIG_FILE)) all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  all[guildId] = data;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(all, null, 2));
}

function loadItems(guildId) {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    const all = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    return all[guildId] || [];
  } catch { return []; }
}

function saveItems(guildId, items) {
  let all = {};
  try { if (fs.existsSync(SCHEDULE_FILE)) all = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')); } catch {}
  all[guildId] = items;
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(all, null, 2));
}

// ── Format a time string in the guild's timezone ──────────────────────────────

function formatTime(hour, minute, timezone) {
  try {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    // Use Intl to get offset for this timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // Build a fake date at the right UTC time — we store in UTC internally
    const fake = new Date(`2000-01-01T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
    return formatter.format(fake);
  } catch {
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UTC`;
  }
}

// ── Convert local time to UTC hour/minute for storage ────────────────────────

function localToUTC(hour, minute, timezone) {
  try {
    // Find the UTC offset by formatting a known date in the target timezone
    const date = new Date(`2000-01-15T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);
    const utcStr = date.toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
    // Instead, use a reliable offset method
    const testDate = new Date(2000, 0, 15, hour, minute, 0);
    const utcTime = new Date(testDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = localTime - utcTime;
    const utcMs = testDate.getTime() - offsetMs;
    const utcDate = new Date(utcMs);
    return { hour: utcDate.getHours(), minute: utcDate.getMinutes() };
  } catch {
    return { hour, minute };
  }
}

// ── Build schedule as plain text ─────────────────────────────────────────────

function buildScheduleEmbed(items, config, guildName) {
  const tz = config.timezone || 'UTC';
  const tzLabel = TIMEZONES.find(t => t.value === tz)?.name || tz;
  const lines = ['📅 **Alliance Event Schedule**', '────────────────────'];

  if (items.length === 0) {
    lines.push('No events scheduled yet. Use `/schedule add` to add events.');
    lines.push('────────────────────');
    lines.push(`☠ ${guildName}  ·  Timezone: ${tzLabel}`);
    return lines.join('\n');
  }

  // Group by day
  const byDay = {};
  for (const item of items) {
    const day = item.day ?? 7;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => a.utcHour * 60 + a.utcMinute - (b.utcHour * 60 + b.utcMinute));
  }

  // Daily events first
  if (byDay[7]) {
    lines.push('🔁 **Daily**');
    byDay[7].forEach(item => {
      const time = formatTime(item.utcHour, item.utcMinute, tz);
      const durationTag = item.duration ? ` (${item.duration}m)` : '';
      const announceTag = item.announceEnabled !== false ? ' 🔔' : '';
      lines.push(`\`${time}\`  ${item.emoji || '🎯'}  **${item.name}**${item.note ? `  — ${item.note}` : ''}${durationTag}${announceTag}`);
    });
    lines.push('');
  }

  // Per-day events — always show all days
  for (let d = 0; d < 7; d++) {
    lines.push(`📆 **${DAYS[d]}**`);
    if (!byDay[d]) {
      lines.push(`*No events scheduled*`);
    } else {
      byDay[d].forEach(item => {
        const time = formatTime(item.utcHour, item.utcMinute, tz);
        const durationTag = item.duration ? ` (${item.duration}m)` : '';
        const announceTag = item.announceEnabled !== false ? ' 🔔' : '';
        lines.push(`\`${time}\`  ${item.emoji || '🎯'}  **${item.name}**${item.note ? `  — ${item.note}` : ''}${durationTag}${announceTag}`);
      });
    }
    lines.push('');
  }

  lines.push('────────────────────');
  lines.push(`☠ ${guildName}  ·  All times in ${tzLabel}`);
  return lines.join('\n');
}

// ── Build plain text version for translation (no Discord markdown) ────────────

function buildScheduleMailText(items, config) {
  const tz      = config.timezone || 'UTC';
  const tzLabel = TIMEZONES.find(t => t.value === tz)?.name || tz;
  const sorted  = getSortedItems(items);
  const lines   = ['ALLIANCE EVENT SCHEDULE', ''];

  const byDay = {};
  for (const item of sorted) {
    const day = item.day ?? 7;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  }

  if (byDay[7]) {
    lines.push('DAILY');
    byDay[7].forEach(item => {
      const time = formatTime(item.utcHour, item.utcMinute, tz);
      lines.push(`${time}  ${item.name}${item.note ? ` - ${item.note}` : ''}`);
    });
    lines.push('');
  }

  for (let d = 0; d < 7; d++) {
    if (!byDay[d]) continue;
    lines.push(DAYS[d].toUpperCase());
    byDay[d].forEach(item => {
      const time = formatTime(item.utcHour, item.utcMinute, tz);
      lines.push(`${time}  ${item.name}${item.note ? ` - ${item.note}` : ''}`);
    });
    lines.push('');
  }

  lines.push(`All times in ${tzLabel}`);
  return lines.join('\n');
}

// ── Command ───────────────────────────────────────────────────────────────────

// ── Helper — consistent sort order for numbering ─────────────────────────────

function getSortedItems(items) {
  return [...items].sort((a, b) => {
    // Daily first, then by day of week, then by time
    if (a.day !== b.day) {
      if (a.day === 7) return -1;
      if (b.day === 7) return 1;
      return a.day - b.day;
    }
    return (a.utcHour * 60 + a.utcMinute) - (b.utcHour * 60 + b.utcMinute);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage the alliance event schedule')

    // /schedule post
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Post the full event schedule to a channel')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)))

    // /schedule add
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add an event to the schedule (Officers+)')
      .addStringOption(o => o.setName('name').setDescription('Event name e.g. "Territory War"').setRequired(true))
      .addIntegerOption(o => o.setName('hour').setDescription('Hour in your alliance timezone (0–23)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('minute').setDescription('Minute (0–59), default 0').setMinValue(0).setMaxValue(59))
      .addStringOption(o => o.setName('day').setDescription('Day of week — leave blank for Daily').addChoices(...DAY_CHOICES))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for this event e.g. ⚔️'))
      .addStringOption(o => o.setName('note').setDescription('Short note e.g. "R4+ only" or "All welcome"'))
      .addIntegerOption(o => o.setName('duration').setDescription('How long the event lasts in minutes — auto-removes from schedule when done').setMinValue(1).setMaxValue(1440))
      .addChannelOption(o => o.setName('announce_channel').setDescription('Channel to post the 30-min warning in').addChannelTypes(ChannelType.GuildText))
      .addBooleanOption(o => o.setName('announce').setDescription('Auto-post a 30-min warning before this event? (default: true)')))

    // /schedule remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an event from the schedule (Officers+)')
      .addIntegerOption(o => o.setName('number').setDescription('Event number from /schedule list').setMinValue(1))
      .addStringOption(o => o.setName('name').setDescription('Event name to remove')))

    // /schedule timezone
    .addSubcommand(sub => sub
      .setName('timezone')
      .setDescription('Set the timezone all schedule times are displayed in (Officers+)')
      .addStringOption(o => o
        .setName('tz')
        .setDescription('Choose your alliance timezone')
        .setRequired(true)
        .addChoices(...TIMEZONES.map(t => ({ name: t.name, value: t.value })))))

    // /schedule list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show all scheduled events (Officers+ only — use /schedule post for everyone)')),

  async execute(interaction) {
    const sub      = interaction.options.getSubcommand();
    const guildId  = interaction.guildId;
    const isOfficer = checkOfficer(interaction.member, interaction.guildId);
    const config   = loadConfig(guildId);
    const items    = loadItems(guildId);

    // ── POST ──────────────────────────────────────────────────────────────────
    if (sub === 'post') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const embed   = buildScheduleEmbed(items, config, interaction.guild.name);
      const posted  = await channel.send({ content: embed });

      // Add thumbs up reaction for officers to get in-game mail version
      await posted.react('👍');

      // Attach flag reaction translator for members
      attachFlagTranslator(posted, buildScheduleMailText(items, config), 'Alliance Schedule');

      // Collect 👍 reactions from officers for 24 hours
      const collector = posted.createReactionCollector({
        filter: (reaction, user) => reaction.emoji.name === '👍' && !user.bot,
        time: 24 * 60 * 60 * 1000,
      });

      collector.on('collect', async (reaction, user) => {
        try {
          const member = await interaction.guild.members.fetch(user.id);
          const officerCheck = checkOfficer(member, interaction.guildId);
          if (!officerCheck) return;

          // Build full in-game email version with daily reminders
          const tz      = config.timezone || 'UTC';
          const tzLabel = TIMEZONES.find(t => t.value === tz)?.name || tz;
          const sorted  = getSortedItems(items);

          // Group by day
          const byDay = {};
          for (const item of sorted) {
            const day = item.day ?? 7;
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(item);
          }

          // Daily reminders and save lists per day
          const DAY_REMINDERS = {
            0: { // Sunday
              today: 'REST DAY\n\nNo Alliance Duel today. Take a breather.',
              save: 'SAVE FOR TOMORROW — MONDAY\nBuilding CP items\nTech CP items\nBuilding Speed Ups\nTech Speed Ups\nWisdom Medals\nSend gathering marches before reset\n\nTomorrow is Shelter Expansion Day.',
            },
            1: { // Monday
              today: 'TODAY IS SHELTER EXPANSION DAY\n\nFocus: Building CP · Tech CP · Speedups · Wisdom Medals · Gathering\n\nPRIORITY TASKS\nUse Building CP items\nUse Tech CP items\nUse Building Speed Ups and Tech Speed Ups\nUse Wisdom Medals\nSend gathering marches\nCoins give double points vs other resources\nRadar collection does NOT count',
              save: 'SAVE FOR TOMORROW — TUESDAY\nPrime Recruits\nOrange Hero Fragments\nExclusive Equipment Fragments\nDo NOT Star Rise until tomorrow\n\nTomorrow is Hero Initiative Day.',
            },
            2: { // Tuesday
              today: 'TODAY IS HERO INITIATIVE DAY\n\nFocus: Hero Fragments · Prime Recruits · Radar Events\n\nPRIORITY TASKS\nComplete your Radar event FIRST\nUse Prime Recruit draws\nUse Orange Hero Fragments in Star Rise\nUse Exclusive Equipment Fragments\nOrange fragments give 4.5x more points than purple',
              save: 'SAVE FOR TOMORROW — WEDNESDAY\nS Tier Syndicate Trucks\nOrange Shadow Calls missions\nPower Cores\nHero Equipment Lucky Chests\nTraining Speed Ups\n\nTomorrow is Keep Progressing Day.',
            },
            3: { // Wednesday
              today: 'TODAY IS KEEP PROGRESSING DAY\n\nFocus: Troop Training · Speedups · Lucky Chests · Power Cores · Trucks · Shadow Calls\n\nPRIORITY TASKS\nUse S Tier Syndicate Trucks — 62,000 points!\nComplete Orange Shadow Calls — 31,000 points!\nOpen Hero Equipment Lucky Chests\nUse Power Cores\nUse Training Speed Ups',
              save: 'SAVE FOR TOMORROW — THURSDAY\nGears\nTitanium Alloys\nDesign Blueprints\nSave Boomer rallies for tomorrow\nZOMBIE SIEGE at 18:00 tomorrow\n\nTomorrow is Arms Expert Day.',
            },
            4: { // Thursday
              today: 'TODAY IS ARMS EXPERT DAY + ZOMBIE SIEGE\n\nFocus: Gears · Titanium Alloys · Blueprints · Radar · Boomers · Roamers\n\nPRIORITY TASKS\nComplete Radar event FIRST\nUse Gears, Titanium Alloys, Blueprints\nKill as many Roamers as possible\nJoin Boomer rallies — higher level = more points\n\nZOMBIE SIEGE AT 18:00\n25 waves · 30 minutes\nTurn OFF auto rally before it starts\nRequest alliance help between waves\nReinforce teammates after elimination',
              save: 'SAVE FOR TOMORROW — FRIDAY\nPower Cores\nRemaining Hero Fragments\nWisdom Medals\nAll Speed Ups\nFRANKIE at 18:00 tomorrow\n\nTomorrow is Holistic Growth Day.',
            },
            5: { // Friday
              today: 'TODAY IS HOLISTIC GROWTH DAY + FRANKIE\n\nFocus: Everything — Jackpot Day\n\nPRIORITY TASKS\nUse Gears, Titanium Alloys, Blueprints\nUse Power Cores\nUse Hero Fragments — all colours\nUse Wisdom Medals\nUse All Speed Ups\n\nFRANKIE AT 18:00\nRally Capacity 40,000+ = Rally Leader\nLead ONE rally with your best truck\nEveryone else — join with strongest rigs\nSend multiple full trucks if you have them',
              save: 'SAVE FOR TOMORROW — SATURDAY\nS Tier Syndicate Trucks\nOrange Shadow Calls\nRemaining Speed Ups\n\nTomorrow is Enemy Buster Day.',
            },
            6: { // Saturday
              today: 'TODAY IS ENEMY BUSTER DAY\n\nFocus: PvP Combat · Shadow Calls · Speed Ups\n\nPRIORITY TASKS\nComplete Orange Shadow Calls FIRST\n31,000 points each — top priority\nUse all remaining Speed Ups\nDefeat enemy troops for points\nPvP against rival alliances gives bonus points',
              save: 'TOMORROW IS REST DAY\nCheck the Alliance Shop before it resets.\nMake sure your shield is active.\nGood work this week FBRD family.',
            },
          };

          const SHORT_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const tomorrow = (new Date().getDay() + 1) % 7;
          const tomorrowName = SHORT_DAYS[tomorrow];
          const mailLines = [`TOMORROW — ${tomorrowName.toUpperCase()}`, '────────────────────'];

          if (byDay[tomorrow] && byDay[tomorrow].length > 0) {
            byDay[tomorrow].forEach(item => {
              const time = formatTime(item.utcHour, item.utcMinute, tz);
              mailLines.push(`${time}  ${item.name}`);
            });
          } else {
            mailLines.push('No events scheduled');
          }

          mailLines.push('');
          mailLines.push(`All times in ${tzLabel}`);
          mailLines.push('— Alliance Command');

          await user.send({
            content: `📋 **Schedule — In-Game Mail Version**\n\`\`\`\n${mailLines.join('\n')}\n\`\`\`\nCopy and paste this directly into your in-game alliance mail.`,
          });
        } catch (err) {
          // DMs may be closed — silently ignore
        }
      });

      return interaction.reply({ content: `✅ Schedule posted in <#${channel.id}>  ·  React 👍 to receive an in-game mail version via DM`, ephemeral: true });
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });

      const name   = interaction.options.getString('name');
      const hour   = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute') ?? 0;
      const dayStr = interaction.options.getString('day');
      const emoji  = interaction.options.getString('emoji') || '🎯';
      const note   = interaction.options.getString('note') || '';
      const day    = dayStr !== null ? parseInt(dayStr) : 7; // 7 = daily

      const tz = config.timezone || 'UTC';
      const { hour: utcHour, minute: utcMinute } = localToUTC(hour, minute, tz);

      // Check for duplicate
      const duplicate = items.find(i => i.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        return interaction.reply({ content: `⚠️ An event called **${name}** already exists. Remove it first with \`/schedule remove\`.`, ephemeral: true });
      }

      const duration        = interaction.options.getInteger('duration') || null;
      const announceEnabled = interaction.options.getBoolean('announce') ?? true;
      const announceChannel = interaction.options.getChannel('announce_channel');
      const announceChannelId = announceChannel?.id || null;

      items.push({ name, emoji, note, day, utcHour, utcMinute, duration, announceEnabled, announceChannelId, addedAt: Date.now() });
      saveItems(guildId, items);

      const tzLabel  = TIMEZONES.find(t => t.value === tz)?.name || tz;
      const timeStr  = formatTime(utcHour, utcMinute, tz);
      const dayLabel = day === 7 ? 'Daily' : DAYS[day];

      const durationNote  = duration ? ` · auto-removes after ${duration} min` : '';
      const announceNote  = announceEnabled ? ` · 🔔 30-min warning${announceChannelId ? ` in <#${announceChannelId}>` : ' in schedule channel'}` : '';
      return interaction.reply({
        content: `✅ **${emoji} ${name}** added to the schedule!\n\`${timeStr}\` · ${dayLabel} · ${tzLabel}${durationNote}${announceNote}`,
        ephemeral: true,
      });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });

      const number = interaction.options.getInteger('number');
      const name   = interaction.options.getString('name');

      if (!number && !name) {
        return interaction.reply({ content: '❌ Provide either a number from `/schedule list` or an event name.', ephemeral: true });
      }

      let targetName;
      if (number) {
        const sorted = getSortedItems(items);
        const target = sorted[number - 1];
        if (!target) return interaction.reply({ content: `❌ No event at number **${number}**. Use \`/schedule list\` to see the current list.`, ephemeral: true });
        targetName = target.name;
      } else {
        targetName = name;
      }

      const before  = items.length;
      const updated = items.filter(i => i.name.toLowerCase() !== targetName.toLowerCase());

      if (updated.length === before) {
        return interaction.reply({ content: `❌ No event found called **${targetName}**.`, ephemeral: true });
      }

      saveItems(guildId, updated);
      return interaction.reply({ content: `🗑️ **${targetName}** removed from the schedule.`, ephemeral: true });
    }

    // ── TIMEZONE ──────────────────────────────────────────────────────────────
    if (sub === 'timezone') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });

      const tz      = interaction.options.getString('tz');
      const tzLabel = TIMEZONES.find(t => t.value === tz)?.name || tz;

      saveConfig(guildId, { ...config, timezone: tz });

      return interaction.reply({
        content: `✅ Alliance timezone set to **${tzLabel}**.\nAll schedule times will now display in this timezone. Use \`/schedule post\` to repost the updated schedule.`,
        ephemeral: true,
      });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only. Use `/schedule post` to see the public schedule.', ephemeral: true });

      if (items.length === 0) {
        return interaction.reply({ content: '📅 No events scheduled yet. Use `/schedule add` to add one.', ephemeral: true });
      }

      const tz      = config.timezone || 'UTC';
      const tzLabel = TIMEZONES.find(t => t.value === tz)?.name || tz;
      const sorted  = getSortedItems(items);

      const rows = sorted.map((item, i) => {
        const time     = formatTime(item.utcHour, item.utcMinute, tz);
        const dayLabel = item.day === 7 ? 'Daily' : DAYS[item.day];
        const duration = item.duration ? ` · ${item.duration}m` : '';
        return `**${i + 1}.** ${item.emoji || '🎯'} **${item.name}** — \`${time}\` ${dayLabel}${duration}`;
      });

      const lines = [
        '📅 **Scheduled Events** — use the number to remove',
        divider(),
        rows.join('\n'),
        divider(),
        `Timezone: ${tzLabel}  ·  To remove: \`/schedule remove number:1\``,
      ];

      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
  },
};
