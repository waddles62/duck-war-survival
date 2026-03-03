// ── reactionTranslate.js ──────────────────────────────────────────────────────
// Shared helper: attach a flag-reaction collector to any posted message.
// When a user reacts with a flag emoji the bot translates the message and
// DMs the translation to that user. Works on any message passed in.

const FLAG_MAP = {
  '🇺🇸': { code: 'en', name: 'English' },
  '🇬🇧': { code: 'en', name: 'English' },
  '🇩🇪': { code: 'de', name: 'German' },
  '🇫🇷': { code: 'fr', name: 'French' },
  '🇪🇸': { code: 'es', name: 'Spanish' },
  '🇲🇽': { code: 'es', name: 'Spanish' },
  '🇧🇷': { code: 'pt', name: 'Portuguese (Brazilian)' },
  '🇵🇹': { code: 'pt', name: 'Portuguese' },
  '🇷🇺': { code: 'ru', name: 'Russian' },
  '🇹🇷': { code: 'tr', name: 'Turkish' },
  '🇸🇦': { code: 'ar', name: 'Arabic' },
  '🇦🇪': { code: 'ar', name: 'Arabic' },
  '🇮🇩': { code: 'id', name: 'Indonesian' },
  '🇵🇭': { code: 'tl', name: 'Filipino (Tagalog)' },
  '🇹🇭': { code: 'th', name: 'Thai' },
  '🇻🇳': { code: 'vi', name: 'Vietnamese' },
  '🇨🇳': { code: 'zh', name: 'Chinese (Simplified)' },
  '🇹🇼': { code: 'zh-TW', name: 'Chinese (Traditional)' },
  '🇯🇵': { code: 'ja', name: 'Japanese' },
  '🇰🇷': { code: 'ko', name: 'Korean' },
  '🇳🇱': { code: 'nl', name: 'Dutch' },
  '🇵🇱': { code: 'pl', name: 'Polish' },
  '🇸🇪': { code: 'sv', name: 'Swedish' },
  '🇺🇦': { code: 'uk', name: 'Ukrainian' },
  '🇮🇹': { code: 'it', name: 'Italian' },
  '🇷🇴': { code: 'ro', name: 'Romanian' },
};

/**
 * Attach a flag-reaction translator to a posted message.
 * @param {Message} postedMsg   — the Discord message to watch
 * @param {string}  textContent — the plain text to translate (no Discord formatting)
 * @param {string}  title       — short label shown in the DM header
 */
function attachFlagTranslator(postedMsg, textContent, title = 'Message') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return; // AI features disabled — silently skip

  const filter = (reaction, user) => {
    return !user.bot && FLAG_MAP[reaction.emoji.name] !== undefined;
  };

  const collector = postedMsg.createReactionCollector({
    filter,
    time: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Track who has already received a translation to avoid duplicate DMs
  const alreadySent = new Set();

  collector.on('collect', async (reaction, user) => {
    const key = `${user.id}-${reaction.emoji.name}`;
    if (alreadySent.has(key)) return;
    alreadySent.add(key);

    const lang = FLAG_MAP[reaction.emoji.name];

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
          max_tokens: 1000,
          system: `You are a professional translator for a strategy game alliance. 
Translate the message accurately and naturally into ${lang.name}.
Remove Discord markdown formatting (**, __, etc) but keep the structure and line breaks.
Return ONLY the translated text — no explanations, no preamble.`,
          messages: [{ role: 'user', content: textContent }],
        }),
      });

      const data = await res.json();
      const translated = data.content?.[0]?.text?.trim();
      if (!translated) throw new Error('Empty response');

      await user.send({
        content: [
          `🌍 **${title} — ${lang.name} Translation**`,
          `────────────────────`,
          translated,
          `────────────────────`,
          `⚔️ Duck War Survival`,
        ].join('\n'),
      });
    } catch (err) {
      console.error(`Flag translate error for ${user.tag}:`, err.message);
      try {
        await user.send({ content: `❌ Translation to ${lang.name} failed. Please try again.` });
      } catch {}
    }
  });
}

module.exports = { attachFlagTranslator, FLAG_MAP };
