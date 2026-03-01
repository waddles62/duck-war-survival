# ☠ DWS Alliance Command — Discord Bot

**Dark War: Survival** alliance management bot with slash commands for announcements,
rally calls, member stats, roster management, and AI-enhanced leader posts.

---

## STEP 1 — Create Your Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** → name it `Alliance Command` (or anything you like)
3. Go to the **"Bot"** tab on the left sidebar
4. Click **"Add Bot"** → confirm
5. Under **"Token"**, click **"Reset Token"** → copy it (save this — you only see it once!)
6. Scroll down to **"Privileged Gateway Intents"** and enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
7. Click **Save Changes**

---

## STEP 2 — Invite the Bot to Your Server

1. Still in the Developer Portal, go to **"OAuth2"** → **"URL Generator"**
2. Under **Scopes**, check: `bot` and `applications.commands`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Embed Links`
   - `Mention Everyone`
   - `Read Message History`
   - `Use Slash Commands`
4. Copy the generated URL at the bottom → open it in your browser
5. Select your Discord server → click **Authorize**

---

## STEP 3 — Get Your Server ID

1. In Discord, go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click your server name in the sidebar → **"Copy Server ID"**
3. Save this — it's your `GUILD_ID`

---

## STEP 4 — Install & Configure the Bot

Make sure you have **Node.js 18+** installed: https://nodejs.org

```bash
# 1. Enter the bot folder
cd dws-alliance-bot

# 2. Install dependencies
npm install

# 3. Set up your environment file
cp .env.example .env
```

Open `.env` in any text editor and fill in your values:

```
DISCORD_TOKEN=paste_your_bot_token_here
GUILD_ID=paste_your_server_id_here
```

---

## STEP 5 — Run the Bot

```bash
node index.js
```

You should see:
```
✅ Alliance Command Bot is online as Alliance Command#1234
✅ Slash commands registered.
🕐 Announcement scheduler started.
```

Slash commands will appear in your Discord server within seconds.

---

## SLASH COMMANDS REFERENCE

### 📢 `/announce` — Post an alliance announcement
| Option | Required | Description |
|--------|----------|-------------|
| `type` | ✅ | War Alert / Rally Call / Event Brief / Resource Call / General |
| `title` | ✅ | Post title |
| `message` | ✅ | Full announcement body |
| `countdown` | ❌ | Minutes for rally timer |
| `schedule` | ❌ | Auto-post at `YYYY-MM-DD HH:MM` (UTC) |
| `channel` | ❌ | Target channel (defaults to current) |

**War Alerts and Rally Calls automatically ping @everyone.**

---

### ⏱ `/rally` — Send a live countdown rally call
| Option | Required | Description |
|--------|----------|-------------|
| `event` | ✅ | Tyrant / Bio-Mutant / Territory War / Capital Clash / Zombie Siege / Showdown |
| `minutes` | ✅ | Rally window duration |
| `notes` | ❌ | Extra instructions |
| `power_req` | ❌ | Minimum power to participate |

Members can click **✅ I'm In** or **❌ Can't Make It**.
The embed updates every 15 seconds with a live countdown.
When time runs out it posts a summary of confirmed attendees.

---

### 📊 `/stats` — Track member stats
| Subcommand | Who | Description |
|------------|-----|-------------|
| `/stats set @user` | Officers+ | Add/update power, contribution, kills, rally hits |
| `/stats view @user` | Everyone | View a member's stat card |
| `/stats leaderboard` | Everyone | Show ranked leaderboard (sort by contribution/power/kills/rally hits) |
| `/stats delete @user` | Officers+ | Remove a member from tracking |

---

### 👥 `/roster` — Alliance roster management
| Subcommand | Who | Description |
|------------|-----|-------------|
| `/roster list` | Everyone | View full roster (filterable by rank) |
| `/roster add @user` | Officers+ | Add member with in-game name and rank |
| `/roster rank @user` | Officers+ | Promote/demote a member |
| `/roster remove @user` | Officers+ | Remove from roster |
| `/roster inactive` | Everyone | Flag members below contribution threshold |

**Rank hierarchy:** 👑 Leader → ⚔️ Officer → 🛡️ Elite → 👤 Member → 🔰 Recruit

---

### 🏰 `/war` — Territory war room
| Subcommand | Who | Description |
|------------|-----|-------------|
| `/war start` | Officers+ | Declare a war — pings @everyone, opens defender signup |
| `/war zone` | Officers+ | Update a zone status (Controlled / Contested / Enemy / Attacking / Defending) |
| `/war stats` | Officers+ | Update live kill/death/score counters |
| `/war status` | Everyone | Show current war embed with all zones |
| `/war end` | Officers+ | Close war, post Victory / Defeat / Draw summary |

**War types:** Territory War · Capital Clash · Zombie Siege · Alliance Showdown
**Zone statuses:** 🟢 Controlled · 🟡 Contested · 🔴 Enemy Hold · ⚪ Neutral · 🟠 Attacking · 🛡️ Defending

---

### 🎭 `/roles` — Discord role auto-assignment
| Subcommand | Who | Description |
|------------|-----|-------------|
| `/roles map` | Officers+ | Link a DWS rank to a Discord role |
| `/roles unmap` | Officers+ | Remove a rank mapping |
| `/roles config` | Officers+ | View all current mappings |
| `/roles sync` | Officers+ | Sync all tracked members' Discord roles to their DWS rank |
| `/roles syncone` | Officers+ | Sync a single member's role |

**Roles auto-sync when** a member is added via `/roster add` or promoted via `/roster rank`.

One-time setup:
```
/roles map Leader   @Leader-role
/roles map Officer  @Officer-role
/roles map Elite    @Elite-role
/roles map Member   @Member-role
/roles map Recruit  @Recruit-role
/roles sync
```

The bot role must be **above** your alliance roles in Server Settings → Roles.

---

### ✨ `/enhance` — AI-powered announcement enhancer
| Option | Required | Description |
|--------|----------|-------------|
| `type` | ✅ | Announcement type |
| `title` | ✅ | Post title |
| `draft` | ✅ | Your rough draft text |

The bot rewrites your draft in a dramatic military tone suited to Dark War: Survival.
Shows a private preview first — you choose to **Post** or **Discard**.

---

## PERMISSION MODEL

| Action | Required Discord Permission |
|--------|-----------------------------|
| Post announcements | Manage Messages |
| Send rally calls | Manage Messages |
| Update/delete stats | Manage Roles |
| Add/remove/rank members | Manage Roles |
| View stats, leaderboard, roster | Everyone |
| Use `/enhance` | Manage Messages |

Assign the **Manage Messages** and **Manage Roles** permissions to your Leader and Officer Discord roles.

---

## FILE STRUCTURE

```
dws-alliance-bot/
├── index.js          # Bot entry point
├── db.js             # JSON data store
├── embeds.js         # Shared embed builders
├── scheduler.js      # Scheduled announcement checker
├── .env              # Your secret credentials (never share this!)
├── .env.example      # Template
├── package.json
├── data/
│   ├── members.json        # Member stats store
│   ├── announcements.json  # Announcement history + scheduled queue
│   ├── wars.json           # War room state + history
│   └── role_config.json    # Rank → Discord role mappings
└── commands/
    ├── announce.js   # /announce
    ├── rally.js      # /rally
    ├── stats.js      # /stats
    ├── roster.js     # /roster (with auto role-sync)
    ├── war.js        # /war  ← NEW
    ├── roles.js      # /roles ← NEW
    └── enhance.js    # /enhance (AI-powered)
```

---

## KEEPING THE BOT RUNNING 24/7

For production, run the bot on a server or cloud host:

- **Railway** (easiest): https://railway.app — free tier available
- **Render**: https://render.com — free background workers
- **VPS**: Any Linux server with Node.js installed

Or keep it simple and run it on your own PC whenever you're gaming.

---

## TROUBLESHOOTING

**Commands not showing in Discord?**
- Make sure `GUILD_ID` is correct in `.env`
- Restart the bot and wait 30 seconds

**Bot is offline?**
- Check your `DISCORD_TOKEN` is correct and hasn't been reset
- Check Node.js version: `node --version` (needs 18+)

**Permission errors on commands?**
- Make sure your Leader/Officer roles have "Manage Messages" and "Manage Roles" permissions in Discord server settings

---

*☠ Built for Dark War: Survival alliances. Fight as one.*
