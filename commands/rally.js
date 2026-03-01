const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { divider } = require('../embeds');

const activeRallies = new Map();

function rallyText({ event, description, author, countdown, rsvps = [] }) {
  const h = Math.floor(countdown / 3600);
  const m = Math.floor((countdown % 3600) / 60);
  const s = countdown % 60;
  const timeStr = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;

  const lines = [
    `🟠 **RALLY CALL — ${event}**`,
    divider(),
    description,
    ``,
    `⏱ **Time Remaining:** ${timeStr}`,
  ];

  if (rsvps.length > 0) {
    lines.push(`✅ **Signed Up (${rsvps.length}):** ${rsvps.join(', ')}`);
  }

  lines.push(divider());
  lines.push(`☠ Posted by ${author}`);
  return lines.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rally')
    .setDescription('Send a timed Dark War: Survival rally call')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o
      .setName('event')
      .setDescription('Event type')
      .setRequired(true)
      .addChoices(
        { name: '🧟 World Boss / Tyrant',  value: 'Tyrant Rally'      },
        { name: '☣️  Bio-Mutant Rally',     value: 'Bio-Mutant Rally'  },
        { name: '🏰 Territory War',         value: 'Territory War'     },
        { name: '🏛️  Capital Clash',        value: 'Capital Clash'     },
        { name: '🧱 Zombie Siege',          value: 'Zombie Siege'      },
        { name: '⚔️  Alliance Showdown',    value: 'Alliance Showdown' },
      ))
    .addIntegerOption(o => o
      .setName('minutes')
      .setDescription('How many minutes until the rally window closes')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(480))
    .addStringOption(o => o
      .setName('notes')
      .setDescription('Extra instructions, e.g. "Min 500K power required"'))
    .addIntegerOption(o => o
      .setName('power_req')
      .setDescription('Minimum power required to join (optional)')),

  async execute(interaction) {
    await interaction.deferReply();

    const event    = interaction.options.getString('event');
    const minutes  = interaction.options.getInteger('minutes');
    const notes    = interaction.options.getString('notes') || '';
    const powerReq = interaction.options.getInteger('power_req');
    const author   = interaction.member.displayName;

    const endsAt = Date.now() + minutes * 60 * 1000;

    let description = notes || `All members report for **${event}**!`;
    if (powerReq) description += `\n\n⚔️ **Minimum power required:** ${(powerReq / 1000).toFixed(0)}K`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rally_join').setLabel('✅  I\'m In').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rally_leave').setLabel('❌  Can\'t Make It').setStyle(ButtonStyle.Danger),
    );

    const text = rallyText({ event, description, author, countdown: minutes * 60 });
    const msg  = await interaction.editReply({ content: `@everyone\n${text}`, components: [row] });

    activeRallies.set(msg.id, { endsAt, event, description, author, channelId: interaction.channelId, rsvps: [], declines: [], msgId: msg.id });

    // ── Live countdown updater ────────────────────────────────────────────────
    const interval = setInterval(async () => {
      const rally = activeRallies.get(msg.id);
      if (!rally) return clearInterval(interval);

      const remaining = Math.max(0, Math.floor((rally.endsAt - Date.now()) / 1000));
      const updated   = rallyText({ event: rally.event, description: rally.description, author: rally.author, countdown: remaining, rsvps: rally.rsvps });

      try {
        await msg.edit({ content: `@everyone\n${updated}`, components: remaining > 0 ? [row] : [] });
      } catch { clearInterval(interval); }

      if (remaining === 0) {
        clearInterval(interval);
        activeRallies.delete(msg.id);

        const final = [
          `⚪ **RALLY CLOSED — ${rally.event}**`,
          divider(),
          `Rally window has ended.`,
          `✅ **Confirmed (${rally.rsvps.length}):** ${rally.rsvps.length > 0 ? rally.rsvps.join(', ') : 'None confirmed.'}`,
          divider(),
          `☠ ${rally.author}`,
        ].join('\n');

        try { await msg.edit({ content: final, components: [] }); } catch {}
      }
    }, 15_000);

    // ── Button collector ──────────────────────────────────────────────────────
    const collector = msg.createMessageComponentCollector({ time: minutes * 60 * 1000 });

    collector.on('collect', async i => {
      const rally = activeRallies.get(msg.id);
      if (!rally) return i.reply({ content: '⚠️ Rally has ended.', ephemeral: true });

      const name = i.member.displayName;
      if (i.customId === 'rally_join') {
        if (!rally.rsvps.includes(name)) { rally.rsvps.push(name); rally.declines = rally.declines.filter(n => n !== name); }
        await i.reply({ content: `✅ **${name}** is locked in for ${rally.event}!`, ephemeral: true });
      } else {
        if (!rally.declines.includes(name)) { rally.declines.push(name); rally.rsvps = rally.rsvps.filter(n => n !== name); }
        await i.reply({ content: `❌ **${name}** marked as unavailable.`, ephemeral: true });
      }
    });
  },
};

module.exports.activeRallies = activeRallies;
