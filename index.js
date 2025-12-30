require("dotenv").config();
// If a plaintext .env is not available but an encrypted .env.enc was created
// by `secure-env`, attempt to load it when an ENV_SECRET env var is set.
try {
    const fs = require('node:fs');
    const path = require('node:path');
    const encPath = path.join(__dirname, '.env.enc');
    if (!process.env.DISCORD_TOKEN && fs.existsSync(encPath) && process.env.ENV_SECRET) {
        try {
            // secure-env returns an object with the decrypted vars
            const secureEnv = require('secure-env');
            const decrypted = secureEnv({ secret: process.env.ENV_SECRET });
            // copy decrypted vars into process.env
            Object.keys(decrypted).forEach(k => {
                if (!(k in process.env)) process.env[k] = decrypted[k];
            });
            console.log('Loaded environment from .env.enc via secure-env');
        } catch (err) {
            console.warn('secure-env not installed or failed to load .env.enc:', err?.message || err);
        }
    }
} catch (e) {
    // ignore any errors in optional secure-env loading
}
const fs = require("node:fs");
const path = require("node:path");

// Fallback: if secure-env wasn't available but a custom .env.enc exists,
// try to decrypt it using AES-256-GCM and ENV_SECRET (compatible with
// `scripts/encrypt-env.js` above).
try {
    const encPath2 = path.join(__dirname, '.env.enc');
    if (!process.env.DISCORD_TOKEN && fs.existsSync(encPath2) && process.env.ENV_SECRET) {
        try {
            const crypto = require('node:crypto');
            const payload = fs.readFileSync(encPath2, 'utf8');
            const data = Buffer.from(payload, 'base64');
            const iv = data.slice(0, 12);
            const tag = data.slice(12, 28);
            const encrypted = data.slice(28);
            const key = crypto.createHash('sha256').update(process.env.ENV_SECRET).digest();
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');
            decrypted.split(/\r?\n/).forEach(line => {
                if (!line || line.startsWith('#')) return;
                const idx = line.indexOf('=');
                if (idx > 0) {
                    const k = line.slice(0, idx);
                    const v = line.slice(idx + 1);
                    if (!(k in process.env)) process.env[k] = v;
                }
            });
            console.log('Loaded environment from .env.enc via custom decryptor');
        } catch (err) {
            console.warn('Custom .env.enc decrypt failed:', err?.message || err);
        }
    }
} catch (e) {
    // ignore
}

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('Missing Discord token: set DISCORD_TOKEN in your environment (or ensure .env/.env.enc decrypted).');
}

//requrie the nessary discord.js classes
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

//create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, // Required to receive messages
        GatewayIntentBits.MessageContent,// Required to read the content of messages (if needed for commands)
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message]// Add other necessary partials here
});


const eventspath = path.join(__dirname, 'Events');
const eventFiles = fs.readdirSync(eventspath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventspath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

//load th command files on startup
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
    }


}
//login to discord with your app's token
client.login(TOKEN);
