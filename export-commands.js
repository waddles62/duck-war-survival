// Run this once to generate commands.json for bot listing sites
// node export-commands.js
const fs = require('fs');
const path = require('path');

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
  }
}

fs.writeFileSync('./commands.json', JSON.stringify(commands, null, 2));
console.log(`✅ Exported ${commands.length} commands to commands.json`);
