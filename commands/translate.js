const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

// ── Supported languages with flag emojis ─────────────────────────────────────
const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'German' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'pt', flag: '🇧🇷', name: 'Portuguese (Brazilian)' },
  { code: 'ru', flag: '🇷🇺', name: 'Russian' },
  { code: 'tr', flag: '🇹🇷', name: 'Turkish' },
  { code: 'ar', flag: '🇸🇦', name: 'Arabic' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesian' },
  { code: 'tl', flag: '🇵🇭', name: 'Filipino (Tagalog)' },
  { code: 'th', flag: '🇹🇭', name: 'Thai' },
  { code: 'vi', flag: '🇻🇳', name: 'Vietnamese' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate a message into all DWS community languages and post it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o
      .setName('message')
      .setDescription('The message to translate into all languages')
      .setRequired(true))
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel to post in (defaults to current channel)')
      .addChannelTypes(ChannelType.GuildText))
    .addRoleOption(o => o
      .setName('mention')
      .setDescription('Optional role to ping with the message')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const originalMessage = interaction.options.getString('message');
    const targetChannel   = interaction.options.getChannel('channel') || interaction.channel;
    const mentionRole     = interaction.options.getRole('mention');
    const apiKey          = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return interaction.editReply({
        content: [
          '❌ **`ANTHROPIC_API_KEY` is missing from your `.env` file.**',
          'The `/translate` command uses AI to translate — add your key to enable it.',
        ].join('\n'),
      });
    }

    // ── Ask Claude to translate into all languages at once ────────────────────
    await interaction.editReply({ content: '⏳ Translating into all languages...' });

    const langList = LANGUAGES.map(l => `${l.code}: ${l.name}`).join('\n');

    const systemPrompt = `You are a professional translator. Translate the given message into multiple languages accurately and naturally.
Return ONLY a valid JSON object where each key is the language code and the value is the translated text.
Do not include any explanation, markdown, or code blocks — just the raw JSON object.`;

    const userPrompt = `Translate this message into all of these languages:\n${langList}\n\nMessage to translate:\n${originalMessage}`;

    let translations = {};
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
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API ${res.status}: ${err?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      const raw  = data.content?.[0]?.text?.trim();

      // Strip any accidental markdown fences just in case
      const cleaned = raw.replace(/^```json|^```|```$/gm, '').trim();
      translations = JSON.parse(cleaned);

    } catch (err) {
      console.error('Translate API error:', err.message);
      return interaction.editReply({
        content: `❌ Translation failed: \`${err.message}\`\n\nCheck your \`ANTHROPIC_API_KEY\` and restart the bot.`,
      });
    }

    // ── Build the final message ───────────────────────────────────────────────
    const lines = LANGUAGES.map(lang => {
      const text = translations[lang.code] || `*(${lang.name} translation unavailable)*`;
      return `${lang.flag} **${lang.name}**\n${text}`;
    });

    const mention    = mentionRole
      ? (mentionRole.name === '@everyone' ? '@everyone ' : `<@&${mentionRole.id}> `)
      : '';

    // Discord messages max 2000 chars — split into chunks if needed
    const header  = `${mention}📢 **Alliance Message — All Languages**\n${'─'.repeat(35)}\n\n`;
    const body    = lines.join('\n\n');
    const full    = header + body;

    if (full.length <= 2000) {
      await targetChannel.send({ content: full });
    } else {
      // Send header + first chunk, then remaining chunks
      let current = header;
      for (const line of lines) {
        const addition = line + '\n\n';
        if ((current + addition).length > 2000) {
          await targetChannel.send({ content: current });
          current = addition;
        } else {
          current += addition;
        }
      }
      if (current.trim()) await targetChannel.send({ content: current });
    }

    await interaction.editReply(`✅ Translated into ${LANGUAGES.length} languages and posted in <#${targetChannel.id}>`);
  },
};
