const { 
    EliteProTechId,
    removeFile
} = require('../ids');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: EliteProTechConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
    const id = EliteProTechId();
    let responseSent = false;
    let sessionCleanedUp = false;

    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            await removeFile(path.join(sessionDir, id));
            sessionCleanedUp = true;
        }
    }

    async function EliteProTech_QR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        console.log(version);
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
        try {
            let EliteProTech = EliteProTechConnect({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            EliteProTech.ev.on('creds.update', saveCreds);
            EliteProTech.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                
                if (qr && !responseSent) {
                    const qrImage = await QRCode.toDataURL(qr);
                    if (!res.headersSent) {
                        res.send(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>EliteProTech-MD | QR CODE</title>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                <style>
                                    /* Same styles as before */
                                    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #000; font-family: Arial, sans-serif; color: #fff; text-align: center; padding: 20px; box-sizing: border-box; }
                                    .container { width: 100%; max-width: 600px; }
                                    .qr-container { position: relative; margin: 20px auto; width: 300px; height: 300px; display: flex; justify-content: center; align-items: center; }
                                    .qr-code { width: 300px; height: 300px; padding: 10px; background: white; border-radius: 20px; box-shadow: 0 0 0 10px rgba(255,255,255,0.1); }
                                    .qr-code img { width: 100%; height: 100%; }
                                    h1 { margin-bottom: 15px; }
                                    .back-btn { display: inline-block; padding: 12px 25px; margin-top: 15px; background: #6e48aa; color: white; text-decoration: none; border-radius: 30px; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1>EliteProTech QR CODE</h1>
                                    <div class="qr-container">
                                        <div class="qr-code">
                                            <img src="${qrImage}" alt="QR Code"/>
                                        </div>
                                    </div>
                                    <p>Scan this QR code with your phone to connect</p>
                                    <a href="./" class="back-btn">Back</a>
                                </div>
                            </body>
                            </html>
                        `);
                        responseSent = true;
                    }
                }

                if (connection === "open") {
                    try {
                         // await EliteProTech.groupAcceptInvite("BscdfUpSmJY0OAOWfyPjNs");
                    } catch (error) {
                        console.error("Group error:", error);
                    }

                    // Wait for stabilization
                    await delay(10000);

                    try {
                        // CAPTURE LIVE SESSION FROM MEMORY
                        const sessionCreds = state.creds;
                        
                        if (!sessionCreds || !sessionCreds.me) {
                            throw new Error("Session credentials incomplete");
                        }

                        const sessionJson = JSON.stringify(sessionCreds, null, 0);

                        const Sess = await EliteProTech.sendMessage(EliteProTech.user.id, {text: sessionJson});

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
                        await delay(2000);
                        await EliteProTech.ws.close();
                    } catch (sendError) {
                        console.error("Error sending session:", sendError);
                    } finally {
                        await cleanUpSession();
                    }
                    
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    EliteProTech_QR_CODE();
                }
            });
        } catch (err) {
            console.error("Main error:", err);
            if (!responseSent) {
                res.status(500).json({ code: "QR Service is Currently Unavailable" });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await EliteProTech_QR_CODE();
    } catch (finalError) {
        console.error("Final error:", finalError);
        await cleanUpSession();
        if (!responseSent) {
            res.status(500).json({ code: "Service Error" });
        }
    }
});

module.exports = router;
