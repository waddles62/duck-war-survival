const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { announcementEmbed } = require('../embeds');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enhance')
    .setDescription('✨ AI-enhance an announcement with full posting options')
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
      .setName('draft')
      .setDescription('Your rough draft — the AI will enhance it')
      .setRequired(true))
    .addStringOption(o => o
      .setName('title')
      .setDescription('Post title (e.g. "Tyrant Rally 14:00")')
      .setRequired(true))
    .addRoleOption(o => o
      .setName('mention')
      .setDescription('Role to tag — overrides default @everyone for war/rally'))
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel to post in (defaults to current channel)')
      .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o
      .setName('schedule')
      .setDescription('Schedule for later — YYYY-MM-DD HH:MM (24h, server timezone)')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const type          = interaction.options.getString('type');
    const draft         = interaction.options.getString('draft');
    const title         = interaction.options.getString('title');
    const mentionRole   = interaction.options.getRole('mention');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const scheduleStr   = interaction.options.getString('schedule');
    const author        = interaction.member.displayName;

    // ── Work out mention string ───────────────────────────────────────────────
    let mentionStr = null;
    if (mentionRole) {
      mentionStr = mentionRole.name === '@everyone' ? '@everyone' : `<@&${mentionRole.id}>`;
    } else if (type === 'war' || type === 'rally') {
      mentionStr = '@everyone';
    }

    // ── API key check ─────────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return interaction.editReply({
        content: [
          '❌ **`ANTHROPIC_API_KEY` is missing from your `.env` file.**',
          '1. Go to **https://console.anthropic.com** → sign up / log in',
          '2. Click **"API Keys"** → **"Create Key"** → copy it',
          '3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-your-key-here`',
          '4. Save and restart the bot',
        ].join('\n'),
      });
    }

    const typeLabels = {
      war: 'War Alert', rally: 'Rally Call', event: 'Event Brief',
      resource: 'Resource Call', general: 'General Alliance Info',
    };

    const typeGuides = {
      war:      { tone: 'urgent and fearsome — this is a battle cry'     },
      rally:    { tone: 'electrifying and high-energy — pump them up'    },
      event:    { tone: 'exciting and enthusiastic — build anticipation' },
      resource: { tone: 'cooperative and encouraging — we rise together' },
      general:  { tone: 'warm, proud and community-focused'              },
    };

    const guide = typeGuides[type] || typeGuides.general;

    const systemPrompt = `You are the passionate, battle-hardened commander of a Dark War: Survival alliance.
Your job is to rewrite alliance announcements so they are punchy, inspiring and full of alliance pride.

TONE for this message: ${guide.tone}

MANDATORY FORMAT — every message must follow this structure exactly:

[emoji] First point or idea — one or two tight sentences max. No waffle.

[emoji] Second point — each one gets its own unique emoji matching the content. Blank line between each.

[emoji] Continue for each distinct idea or instruction from the original.

[emoji] Final line is always a short sharp rallying call-to-action.

EMOJI RULES:
- Every paragraph starts with ONE emoji matching its specific content
- Never repeat the same emoji
- Match to topic: 🧟 zombies/enemies, 🏗️ building, 💰 resources, ⚔️ combat, 🦸 heroes, 📡 radar, 🔥 urgency, 🛡️ defense, 🏆 victory/rewards, 💪 strength, ☠️ alliance identity, 🎯 objectives, 🚛 escort, ☣️ wasteland
- Emoji then space then text — no dashes or bullets

WRITING RULES:
- Keep ALL information from the original — never drop dates, times, targets or instructions
- Be concise — every sentence earns its place, cut anything that over-explains
- Use inclusive language — say family, alliance, team, survivors, warriors instead of brotherhood/sisterhood
- Add Dark War wasteland flavour but keep it brief
- Use ALL CAPS for 1-2 critical words max per message
- Return ONLY the final message text. No title, no preamble, no explanation.`;

    const userPrompt = `Type: ${typeLabels[type]}\nTitle: ${title}\nOriginal draft:\n${draft}`;

    // ── Call AI ───────────────────────────────────────────────────────────────
    let enhanced;
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
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`API ${res.status}: ${errBody?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      enhanced = data.content?.[0]?.text?.trim();
      if (!enhanced || enhanced === draft) throw new Error('AI returned empty or unchanged response');

    } catch (err) {
      console.error('Enhance API error:', err.message);
      return interaction.editReply({
        content: `❌ AI enhancement failed: \`${err.message}\`\n\nCheck your \`ANTHROPIC_API_KEY\` in \`.env\` and restart the bot.`,
      });
    }

    const plainMessage = mentionStr ? `${mentionStr}\n${enhanced}` : enhanced;

    // ── Handle scheduled post ─────────────────────────────────────────────────
    if (scheduleStr) {
      const scheduledAt = Date.parse(scheduleStr.replace(' ', 'T') + ':00Z');
      if (isNaN(scheduledAt)) {
        return interaction.editReply('❌ Invalid schedule format. Use `YYYY-MM-DD HH:MM`.');
      }
      if (scheduledAt <= Date.now()) {
        return interaction.editReply('❌ Scheduled time must be in the future.');
      }

      db.addAnnouncement({
        type, title, description: enhanced,
        author, mentionStr,
        channelId: targetChannel.id,
        scheduled: true,
        scheduledAt,
        sent: false,
        plainText: true,
      });

      const when = new Date(scheduledAt).toUTCString();
      const mentionNote = mentionStr ? ` · will ping **${mentionStr}**` : '';

      // Show preview with scheduled confirmation
      return interaction.editReply({
        content: [
          `✨ **Preview** — scheduled for **${when}** in <#${targetChannel.id}>${mentionNote}`,
          `──────────────────`,
          plainMessage,
          `──────────────────`,
          `✅ Saved! The bot will post this automatically at the scheduled time.`,
        ].join('\n'),
      });
    }

    // ── Show preview with action buttons ─────────────────────────────────────
    const channelNote = targetChannel.id !== interaction.channelId ? ` → <#${targetChannel.id}>` : '';
    const mentionNote = mentionStr ? ` · pings **${mentionStr}**` : '';

    await interaction.editReply({
      content: [
        `✨ **Preview**${channelNote}${mentionNote}`,
        `──────────────────`,
        plainMessage,
        `──────────────────`,
      ].join('\n'),
    });

    // Buttons row
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('enhance_post')
        .setLabel('📢 Post to Channel')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('enhance_edit')
        .setLabel('✏️ Re-enhance')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('enhance_discard')
        .setLabel('🗑️ Discard')
        .setStyle(ButtonStyle.Danger),
    );

    const followUp = await interaction.followUp({ content: ' ', components: [row], ephemeral: true });
    const collector = followUp.createMessageComponentCollector({ time: 120_000 });

    collector.on('collect', async i => {
      if (i.customId === 'enhance_discard') {
        await i.update({ content: '🗑️ Discarded.', components: [] });
        collector.stop();
        return;
      }

      if (i.customId === 'enhance_edit') {
        // Re-run the AI with same inputs for a fresh version
        await i.update({ content: '⏳ Generating a new version...', components: [] });
        try {
          const res2 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 600,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          });
          const data2 = await res2.json();
          const newVersion = data2.content?.[0]?.text?.trim();
          if (newVersion) {
            const newMessage = mentionStr ? `${mentionStr}\n${newVersion}` : newVersion;
            await interaction.editReply({
              content: [
                `✨ **New Version**${channelNote}${mentionNote}`,
                `──────────────────`,
                newMessage,
                `──────────────────`,
              ].join('\n'),
            });
            // Re-show buttons with updated message stored in closure
            enhanced = newVersion;
          }
        } catch (err) {
          await i.followUp({ content: `❌ Re-enhance failed: ${err.message}`, ephemeral: true });
        }
        await followUp.edit({ content: ' ', components: [row] });
        return;
      }

      if (i.customId === 'enhance_post') {
        const finalMessage = mentionStr ? `${mentionStr}\n${enhanced}` : enhanced;
        const postedMsg = await targetChannel.send({ content: finalMessage });

        // Add thumbs up reaction as prompt
        try { await postedMsg.react('👍'); } catch {}

        // Save to announcement history
        db.addAnnouncement({
          type, title, description: enhanced,
          author, mentionStr,
          channelId: targetChannel.id,
          scheduled: false,
          sent: true,
          plainText: true,
        });

        await i.update({
          content: `✅ Posted in <#${targetChannel.id}>${mentionNote}\n💡 R4/R5: React with 👍 on the post to receive a condensed in-game version via DM.`,
          components: [],
        });
        collector.stop();

        // ── Watch for 👍 reactions — R4/R5 only — DM a condensed version ────
        const reactionFilter = (reaction, user) => reaction.emoji.name === '👍' && !user.bot;
        const reactionCollector = postedMsg.createReactionCollector({ filter: reactionFilter, time: 24 * 60 * 60 * 1000 }); // 24 hours

        reactionCollector.on('collect', async (reaction, user) => {
          try {
            // Check R4/R5 rank via guild member roles
            const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!guildMember) return;

            const isOfficer = guildMember.permissions.has(0x10000000n); // ManageRoles = R4+
            if (!isOfficer) return;

            // Build condensed in-game version via AI
            const condensedRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 300,
                system: `You condense Dark War: Survival alliance messages into short in-game messages or emails.
Rules:
- Remove ALL emojis and Discord formatting (no **, no markdown)
- Keep ALL key info: times, targets, instructions, requirements
- Keep each point on its own separate line with a blank line between each point, matching the structure of the original
- Plain sentences only — no bullet points, dashes, or special characters
- End with a short call to action on its own line
- Return ONLY the condensed message, nothing else`,
                messages: [{ role: 'user', content: `Condense this alliance announcement for in-game mail/message:\n\n${enhanced}` }],
              }),
            });

            const condensedData = await condensedRes.json();
            const condensed = condensedData.content?.[0]?.text?.trim();

            if (!condensed) throw new Error('Empty response');

            const dmLines = [
              `📋 **Condensed In-Game Version**`,
              `For: ${title}`,
              `────────────────────`,
              condensed,
              `────────────────────`,
              `Copy and paste this into your in-game mail or alliance message.`,
            ];

            await user.send({ content: dmLines.join('\n') });
          } catch (err) {
            console.error('DM condensed error:', err.message);
            try {
              await user.send({ content: '❌ Could not generate condensed version. Try again or contact an officer.' });
            } catch {}
          }
        });
      }
    });

    collector.on('end', () => {});
  },
};
