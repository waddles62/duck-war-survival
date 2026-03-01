const db   = require('./db');
const fs   = require('fs');
const path = require('path');
const { announcementText } = require('./embeds');

const SCHEDULE_FILE = path.join(__dirname, 'data/schedule_items.json');
const CONFIG_FILE   = path.join(__dirname, 'data/schedule_config.json');

function loadAllItems() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return {};
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch { return {}; }
}

function saveAllItems(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

function loadAllConfigs() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

// ── AI-enhanced 30-minute warning ────────────────────────────────────────────

async function sendEventWarning(client, item, guildId, config) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  // Find the announce channel — use stored channel or fall back to nothing
  const channelId = item.announceChannelId;
  if (!channelId) {
    console.log(`⚠️  No announce channel set for "${item.name}" — skipping warning`);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const tz       = config?.timezone || 'UTC';
  const timeStr  = formatLocalTime(item.utcHour, item.utcMinute, tz);
  const draft    = `${item.emoji || '🎯'} ${item.name} starts in 30 minutes at ${timeStr}. ${item.note ? item.note + '.' : 'Get ready!'} All members prepare now.`;

  let message = draft;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are a Duck War Survival Duck War Survivaler sending a pre-event warning.
Write a short punchy announcement that an event starts in 30 minutes.
Format: one emoji per point, blank line between points, 2-3 points max.
Keep ALL info: event name, time, any notes.
Be urgent but brief. Return ONLY the message text.`,
        messages: [{ role: 'user', content: draft }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      message = data.content?.[0]?.text?.trim() || draft;
    }
  } catch (err) {
    console.error('Warning AI error:', err.message);
    // Fall back to plain draft
  }

  const header = `🔔 **${item.name.toUpperCase()} — 30 MINUTE WARNING**\n────────────────────`;
  await channel.send({ content: `@everyone\n${header}\n${message}` }).catch(err => {
    console.error(`Failed to send warning for ${item.name}:`, err.message);
  });

  console.log(`🔔 Sent 30-min warning for: ${item.name}`);
}

// ── Simple UTC time formatter ─────────────────────────────────────────────────

function formatLocalTime(utcHour, utcMinute, tz) {
  try {
    const now  = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute));
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false });
  } catch {
    return `${String(utcHour).padStart(2,'0')}:${String(utcMinute).padStart(2,'0')}`;
  }
}

function start(client) {
  // Track which warnings have already fired today to avoid duplicates
  const warnedToday = new Set(); // key: `guildId:eventName:YYYY-MM-DD`

  setInterval(async () => {

    // ── Send pending announcements ────────────────────────────────────────────
    const pending = db.getPendingAnnouncements();
    for (const ann of pending) {
      try {
        const channel = await client.channels.fetch(ann.channelId);
        if (!channel) continue;

        const mention = ann.mentionStr || (ann.type === 'war' || ann.type === 'rally' ? '@everyone' : '');

        if (ann.plainText) {
          const plainMessage = mention ? `${mention}\n${ann.description}` : ann.description;
          await channel.send({ content: plainMessage });
        } else {
          const text    = announcementText({ type: ann.type, title: ann.title, description: ann.description, author: ann.author, countdown: ann.countdown });
          const content = mention ? mention + '\n' + text : text;
          await channel.send({ content });
        }
        db.markSent(ann.id);
        console.log(`📤 Sent scheduled announcement: ${ann.title}`);
      } catch (err) {
        console.error('Scheduler error:', err.message);
      }
    }

    // ── 30-minute event warnings ──────────────────────────────────────────────
    try {
      const now        = new Date();
      const allItems   = loadAllItems();
      const allConfigs = loadAllConfigs();
      const todayStr   = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Time in UTC + 30 minutes (what we're looking ahead to)
      const warnUTCHour   = (now.getUTCHours()   + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
      const warnUTCMinute = (now.getUTCMinutes()  + 30) % 60;

      for (const [guildId, items] of Object.entries(allItems)) {
        if (!Array.isArray(items)) continue;
        const config = allConfigs[guildId];

        for (const item of items) {
          if (!item.announceEnabled) continue;

          // Check if this event fires in exactly ~30 minutes (within 1-minute window)
          const isToday    = item.day === 7 || item.day === now.getUTCDay();
          if (!isToday) continue;

          const minuteDiff = Math.abs((item.utcHour * 60 + item.utcMinute) - (warnUTCHour * 60 + warnUTCMinute));
          if (minuteDiff > 1) continue;

          const warnKey = `${guildId}:${item.name}:${todayStr}`;
          if (warnedToday.has(warnKey)) continue;

          warnedToday.add(warnKey);
          sendEventWarning(client, item, guildId, config);
        }
      }

      // Clean up old warned keys at midnight
      if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
        for (const key of warnedToday) {
          if (!key.endsWith(todayStr)) warnedToday.delete(key);
        }
      }
    } catch (err) {
      console.error('Warning scheduler error:', err.message);
    }

    // ── Auto-remove expired schedule events ───────────────────────────────────
    try {
      const now     = new Date();
      const allData = loadAllItems();
      let changed   = false;

      for (const [guildId, items] of Object.entries(allData)) {
        if (!Array.isArray(items)) continue;

        const surviving = items.filter(item => {
          if (!item.duration) return true;
          const isToday = item.day === 7 || item.day === now.getUTCDay();
          if (!isToday) return true;
          const endMinutes = item.utcHour * 60 + item.utcMinute + item.duration;
          const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          if (nowMinutes >= endMinutes) {
            console.log(`🗑️  Auto-removed expired event: ${item.name}`);
            changed = true;
            return false;
          }
          return true;
        });

        allData[guildId] = surviving;
      }

      if (changed) saveAllItems(allData);
    } catch (err) {
      console.error('Schedule cleanup error:', err.message);
    }

  }, 60_000); // check every 60 seconds

  console.log('🕐 Announcement scheduler started.');
}

module.exports = { start };
