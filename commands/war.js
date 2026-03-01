const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { divider } = require('../embeds');
const fs = require('fs');
const path = require('path');

const WAR_FILE = path.join(__dirname, '../data/wars.json');

function loadWars() {
  try {
    if (!fs.existsSync(WAR_FILE)) return {};
    return JSON.parse(fs.readFileSync(WAR_FILE, 'utf8'));
  } catch { return {}; }
}

function saveWars(data) {
  fs.writeFileSync(WAR_FILE, JSON.stringify(data, null, 2));
}

const ZONE_STATUS = {
  controlled:  { emoji: '🟢', label: 'Controlled'   },
  contested:   { emoji: '🟡', label: 'Contested'     },
  enemy:       { emoji: '🔴', label: 'Enemy Hold'    },
  neutral:     { emoji: '⚪', label: 'Neutral'        },
  attacking:   { emoji: '🟠', label: 'Attacking'     },
  defending:   { emoji: '🛡️', label: 'Defending'     },
};

const WAR_TYPES = {
  territory:  { label: 'Territory War',     emoji: '🏰' },
  capital:    { label: 'Capital Clash',     emoji: '🏛️' },
  siege:      { label: 'Zombie Siege',      emoji: '🧱' },
  showdown:   { label: 'Alliance Showdown', emoji: '⚔️' },
};

function buildWarText(war) {
  const meta = WAR_TYPES[war.type] || WAR_TYPES.territory;
  const statusLine = war.active ? '🔴 **ACTIVE**' : '✅ **ENDED**';
  const lines = [
    `${meta.emoji} **${meta.label} — ${war.name}**`,
    divider(),
    `${statusLine}  ·  Started by **${war.startedBy}**`,
  ];

  if (war.zones && war.zones.length > 0) {
    lines.push('');
    lines.push('🗺️ **Territory Zones**');
    war.zones.forEach(z => {
      const s = ZONE_STATUS[z.status] || ZONE_STATUS.neutral;
      const assign = z.assignee ? ` — ${z.assignee}` : '';
      lines.push(`${s.emoji} Zone ${z.id} — ${z.name || 'Zone ' + z.id}${assign}`);
    });
  }

  if (war.kills != null || war.deaths != null || war.score != null) {
    lines.push('');
    lines.push('⚔️ **Battle Stats**');
    if (war.kills  != null) lines.push(`Kills: ${war.kills}`);
    if (war.deaths != null) lines.push(`Deaths: ${war.deaths}`);
    if (war.score  != null) lines.push(`Score: ${war.score}`);
  }

  if (war.defenders && war.defenders.length > 0) {
    lines.push('');
    lines.push(`🛡️ **Defenders:** ${war.defenders.join(', ')}`);
  }

  if (war.notes) {
    lines.push('');
    lines.push(`📋 **Commander Notes:** ${war.notes}`);
  }

  lines.push(divider());
  lines.push('⚔️ Duck War Survival');
  return lines.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('war')
    .setDescription('Track Duck War Survival territory wars and zone control')

    // /war start
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Declare a war and open the war room (Officers+)')
      .addStringOption(o => o
        .setName('type')
        .setDescription('War type')
        .setRequired(true)
        .addChoices(
          { name: '🏰 Territory War',      value: 'territory' },
          { name: '🏛️ Capital Clash',       value: 'capital'   },
          { name: '🧱 Zombie Siege',        value: 'siege'     },
          { name: '⚔️ Alliance Showdown',  value: 'showdown'  },
        ))
      .addStringOption(o => o
        .setName('name')
        .setDescription('War name / opponent, e.g. "vs IronFang Alliance"')
        .setRequired(true))
      .addStringOption(o => o
        .setName('notes')
        .setDescription('Strategy notes or commander orders')))

    // /war zone
    .addSubcommand(sub => sub
      .setName('zone')
      .setDescription('Update a territory zone status (Officers+)')
      .addIntegerOption(o => o
        .setName('id')
        .setDescription('Zone number (1–10)')
        .setRequired(true)
        .setMinValue(1).setMaxValue(10))
      .addStringOption(o => o
        .setName('status')
        .setDescription('Zone status')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Controlled',   value: 'controlled' },
          { name: '🟡 Contested',    value: 'contested'  },
          { name: '🔴 Enemy Hold',   value: 'enemy'      },
          { name: '⚪ Neutral',      value: 'neutral'    },
          { name: '🟠 Attacking',    value: 'attacking'  },
          { name: '🛡️ Defending',    value: 'defending'  },
        ))
      .addStringOption(o => o
        .setName('zone_name')
        .setDescription('Zone label, e.g. "Northern Outpost"'))
      .addStringOption(o => o
        .setName('assign')
        .setDescription('Assign a member or squad to this zone')))

    // /war stats
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('Update war battle stats (Officers+)')
      .addIntegerOption(o => o.setName('kills').setDescription('Alliance kill count'))
      .addIntegerOption(o => o.setName('deaths').setDescription('Alliance death count'))
      .addIntegerOption(o => o.setName('score').setDescription('Current alliance score')))

    // /war status
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Show current war status'))

    // /war end
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('Close the active war and post results (Officers+)')
      .addStringOption(o => o
        .setName('result')
        .setDescription('War outcome')
        .setRequired(true)
        .addChoices(
          { name: '🏆 Victory',   value: 'victory' },
          { name: '💀 Defeat',    value: 'defeat'  },
          { name: '🤝 Draw',      value: 'draw'    },
        ))),

  async execute(interaction) {
    const sub       = interaction.options.getSubcommand();
    const isOfficer = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles);
    const wars      = loadWars();
    const guildId   = interaction.guildId;

    // Get or init guild wars
    if (!wars[guildId]) wars[guildId] = { active: null, history: [] };
    const gWars = wars[guildId];

    // ── START ─────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      if (gWars.active) {
        return interaction.reply({ content: '⚠️ A war is already active. Use `/war end` first.', ephemeral: true });
      }

      const type  = interaction.options.getString('type');
      const name  = interaction.options.getString('name');
      const notes = interaction.options.getString('notes') || null;

      gWars.active = {
        type, name, notes,
        startedBy: interaction.member.displayName,
        startedAt: Date.now(),
        active: true,
        zones: [],
        kills: 0, deaths: 0, score: 0,
        defenders: [],
        channelId: interaction.channelId,
      };

      saveWars(wars);

      const warText = buildWarText(gWars.active);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('war_defend')
          .setLabel('🛡️  Join as Defender')
          .setStyle(ButtonStyle.Primary),
      );

      const meta = WAR_TYPES[type];
      await interaction.reply({
        content: `@everyone\n⚔️ **${meta.emoji} ${meta.label.toUpperCase()} DECLARED — ${name}** ☠`,
        components: [row],
      });

      // Collect defender signups
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 60 * 60 * 1000 }); // 1 hour

      collector.on('collect', async i => {
        const w = loadWars();
        if (!w[guildId]?.active) return i.reply({ content: '⚠️ War has ended.', ephemeral: true });

        const defender = i.member.displayName;
        if (!w[guildId].active.defenders.includes(defender)) {
          w[guildId].active.defenders.push(defender);
          saveWars(w);
        }
        await i.reply({ content: `🛡️ **${defender}** is defending the alliance!`, ephemeral: true });

        // Update embed
        try {
          const updated = buildWarText(w[guildId].active);
          await msg.edit({ content: `@everyone\n${updated}` });
        } catch {}
      });

      return;
    }

    // ── ZONE ──────────────────────────────────────────────────────────────────
    if (sub === 'zone') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      if (!gWars.active) return interaction.reply({ content: '❌ No active war. Use `/war start` first.', ephemeral: true });

      const id       = interaction.options.getInteger('id');
      const status   = interaction.options.getString('status');
      const zoneName = interaction.options.getString('zone_name');
      const assign   = interaction.options.getString('assign');

      const zones = gWars.active.zones;
      const existing = zones.findIndex(z => z.id === id);
      const zone = { id, status };
      if (zoneName) zone.name = zoneName;
      if (assign)   zone.assignee = assign;

      if (existing >= 0) {
        zones[existing] = { ...zones[existing], ...zone };
      } else {
        zones.push(zone);
        zones.sort((a, b) => a.id - b.id);
      }

      saveWars(wars);

      const s = ZONE_STATUS[status];
      const warText = buildWarText(gWars.active);

      return interaction.reply({
        content: `${s.emoji} **Zone ${id}** updated → **${s.label}**${assign ? ` (assigned: ${assign})` : ''}`,
      });
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    if (sub === 'stats') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      if (!gWars.active) return interaction.reply({ content: '❌ No active war.', ephemeral: true });

      const kills  = interaction.options.getInteger('kills');
      const deaths = interaction.options.getInteger('deaths');
      const score  = interaction.options.getInteger('score');

      if (kills  != null) gWars.active.kills  = kills;
      if (deaths != null) gWars.active.deaths = deaths;
      if (score  != null) gWars.active.score  = score;

      saveWars(wars);
      const warText = buildWarText(gWars.active);
      return interaction.reply({ content: '📊 War stats updated.\n\n' + warText });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      if (!gWars.active) {
        if (gWars.history.length === 0) {
          return interaction.reply({ content: '☮️ No active or past wars recorded.', ephemeral: true });
        }
        const last = gWars.history[gWars.history.length - 1];
        const warText = buildWarText(last);
        return interaction.reply({ content: '📜 **Last war result:**\n\n' + warText, ephemeral: true });
      }
      const warText = buildWarText(gWars.active);
      return interaction.reply({ content: warText });
    }

    // ── END ───────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      if (!isOfficer) return interaction.reply({ content: '❌ Officers only.', ephemeral: true });
      if (!gWars.active) return interaction.reply({ content: '❌ No active war to end.', ephemeral: true });

      const result = interaction.options.getString('result');
      const resultMeta = {
        victory: { emoji: '🏆', label: 'VICTORY' },
        defeat:  { emoji: '💀', label: 'DEFEAT'  },
        draw:    { emoji: '🤝', label: 'DRAW'    },
      }[result];

      const war = { ...gWars.active, active: false, endedAt: Date.now(), result };
      const duration = Math.round((Date.now() - war.startedAt) / 60000);
      const zonesFinal = war.zones?.length > 0
        ? war.zones.map(z => `${ZONE_STATUS[z.status]?.emoji || '⚪'} Zone ${z.id}`).join('  ')
        : 'No zones tracked';

      const endText = [
        `${resultMeta.emoji} **WAR ${resultMeta.label} — ${war.name}**`,
        '────────────────────',
        result === 'victory' ? 'Our alliance stands victorious! ☠' : result === 'defeat' ? 'We fight again tomorrow.' : 'Honours even — prepare for the next clash.',
        '',
        `⚔️ **Kills:** ${war.kills || 0}  ·  💀 **Deaths:** ${war.deaths || 0}  ·  🏆 **Score:** ${war.score || 0}`,
        `🛡️ **Defenders:** ${war.defenders?.length > 0 ? war.defenders.join(', ') : 'None recorded'}`,
        `🗺️ **Final Zones:** ${zonesFinal}`,
        '────────────────────',
        `Duration: ${duration} minutes  ·  ☠ Duck War Survival`,
      ].join('\n');

      // Archive
      gWars.history.push(war);
      gWars.active = null;
      saveWars(wars);

      return interaction.reply({ content: `@everyone\n${endText}` });
    }
  },
};
