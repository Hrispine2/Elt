const {
    EliteProTechId,
    removeFile,
    generateRandomCode
} = require('../ids');
const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    default: EliteProTechConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
    const id = EliteProTechId();
    let num = req.query.number;
    let responseSent = false;
    let sessionCleanedUp = false;
    
    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            try {
                await removeFile(path.join(sessionDir, id));
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
            sessionCleanedUp = true;
        }
    }
    
    async function EliteProTech_PAIR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        
        // 'state' holds the IN-MEMORY session data. We will use this directly.
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
        
        try {
            let EliteProTech = EliteProTechConnect({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false, // Keep false to avoid sync issues during generation
                generateHighQualityLinkPreview: true,
                shouldIgnoreJid: jid => !!jid?.endsWith('@g.us'),
                getMessage: async () => undefined,
                markOnlineOnConnect: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });
            
            if (!EliteProTech.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                
                const randomCode = generateRandomCode();
                const code = await EliteProTech.requestPairingCode(num, randomCode);
                
                if (!responseSent && !res.headersSent) {
                    res.json({ code: code });
                    responseSent = true;
                }
            }
            
            EliteProTech.ev.on('creds.update', saveCreds);
            EliteProTech.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                
                if (connection === "open") {
                    // Connection is open, but we wait for keys to settle
                    await delay(10000); 
                    
                    try {
                        // FIX: Capture Session directly from Memory (state.creds)
                        // This prevents "Bad MAC" errors caused by reading incomplete files from disk.
                        const sessionCreds = state.creds;
                        
                        if (!sessionCreds || !sessionCreds.me) {
                            // If 'me' is missing, the session isn't fully ready.
                            throw new Error("Session incomplete: 'me' object missing");
                        }

                        // Serialize the in-memory JSON object
                        const sessionJson = JSON.stringify(sessionCreds, null, 0); 
                        
                        // Send the JSON as a text message to the user
                        const Sess = await EliteProTech.sendMessage(EliteProTech.user.id, {
                            text: sessionJson
                        });
                        
                        // Wait a bit to ensure the message is sent
                        await delay(3000);
                        
                        let EliteProTech_TEXT = `✅ *SESSION ID OBTAINED SUCCESSFULLY!*  
📁 Save and upload the *SESSION_ID* (text) to the \`session\` folder as \`creds.json\`, or add it to your \`.env\` file like this:  
\`SESSION_ID=your_session_id\`

📢 *Stay Updated — Follow Our Channels:*

➊ *WhatsApp Channel*  
https://whatsapp.com/channel/0029VaXaqHII1rcmdDBBsd3g

➋ *Telegram*  
https://t.me/elitepro_md

➌ *YouTube*  
https://youtube.com/@eliteprotechs

🚫 *Do NOT share your session ID or creds.json with anyone.*

🌐 *Explore more tools on our website:*  
https://eliteprotech.zone.id`;
                        
                        const EliteProTechMess = {
                            image: { url: 'https://eliteprotech-url.zone.id/1766274193656dj57l7.jpg' },
                            caption: EliteProTech_TEXT,
                            contextInfo: {
                                mentionedJid: [EliteProTech.user.id],
                                forwardingScore: 5,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363287352245413@newsletter',
                                    newsletterName: "ᴇʟɪᴛᴇᴘʀᴏ-ᴛᴇᴄʜ-ꜱᴜᴘᴘᴏʀᴛ",
                                    serverMessageId: 143
                                }
                            }
                        };
                        
                        await EliteProTech.sendMessage(EliteProTech.user.id, EliteProTechMess, { quoted: Sess });
                        
                        // Close connection cleanly after success
                        await delay(5000);
                        await EliteProTech.ws.close();
                        
                    } catch (sessionError) {
                        console.error("Session processing error:", sessionError);
                    } finally {
                        await cleanUpSession();
                    }
                    
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    console.log("Reconnecting...");
                    await delay(5000);
                    EliteProTech_PAIR_CODE();
                }
            });
            
        } catch (err) {
            console.error("Main error:", err);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: "Service is Currently Unavailable" });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }
    
    try {
        await EliteProTech_PAIR_CODE();
    } catch (finalError) {
        console.error("Final error:", finalError);
        await cleanUpSession();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ code: "Service Error" });
        }
    }
});

module.exports = router;
