const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

// Load all command files
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

// Register slash commands when bot is ready
client.once('ready', async () => {
  console.log(`✅ Alliance Command Bot is online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsData }
    );
    console.log('✅ Global slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }

  // Start the scheduler (checks every 30 seconds)
  const scheduler = require('./scheduler');
  scheduler.start(client);
});

// ── Discord locale → full language name ──────────────────────────────────────
const DISCORD_LOCALES = {
  'en-US': 'English', 'en-GB': 'English', 'de': 'German', 'fr': 'French',
  'es-ES': 'Spanish', 'pt-BR': 'Portuguese (Brazilian)', 'ru': 'Russian',
  'tr': 'Turkish', 'ar': 'Arabic', 'id': 'Indonesian', 'fil': 'Filipino',
  'th': 'Thai', 'vi': 'Vietnamese', 'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)', 'ja': 'Japanese', 'ko': 'Korean',
  'nl': 'Dutch', 'pl': 'Polish', 'sv-SE': 'Swedish', 'uk': 'Ukrainian',
};

async function translateWelcome(text, language) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

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
      system: `Translate the following Discord welcome message into ${language}. 
Keep all Discord formatting exactly as-is: **bold**, mentions like <@id>, channel links like <#id>, and divider lines like ────────────────────.
Only translate the actual text words. Return only the translated message, nothing else.`,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ── Welcome new members ───────────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
  try {
    const { loadConfig, buildWelcomeText } = require('./commands/welcome');
    const config = loadConfig(member.guild.id);

    if (!config?.enabled) return;

    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel) return;

    const welcomeText = buildWelcomeText(config, member, member.guild);

    // Post in the welcome channel
    await channel.send({ content: welcomeText });

    // ── DM in their language ──────────────────────────────────────────────────
    try {
      const locale   = member.user.locale; // Discord account language
      const language = DISCORD_LOCALES[locale];

      // Only translate if they're not using English
      if (language && !language.startsWith('English')) {
        const translated = await translateWelcome(welcomeText, language);
        if (translated) {
          await member.send({ content: `📨 **Welcome message in ${language}:**\n\n${translated}` });
        }
      } else {
        // English — just DM the same message
        await member.send({ content: welcomeText });
      }
    } catch (dmErr) {
      // DMs may be disabled — silently ignore
      console.log(`Could not DM ${member.user.username}: ${dmErr.message}`);
    }

  } catch (err) {
    console.error('Welcome message error:', err.message);
  }
});

// ── Handle slash command interactions ─────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const msg = { content: '❌ Something went wrong. Check bot logs.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
