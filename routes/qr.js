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
        // Capture state object for direct memory access
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
                        // (Keep your existing HTML template here - abbreviated for clarity)
                        res.send(`<!DOCTYPE html><html><body><img src="${qrImage}" /></body></html>`);
                        responseSent = true;
                    }
                }

                if (connection === "open") {
                    await delay(10000); // Wait for keys to stabilize

                    try {
                        // FIX: Capture DIRECTLY from Memory
                        const sessionCreds = state.creds;

                        if (!sessionCreds || !sessionCreds.me) {
                            throw new Error("Session incomplete");
                        }

                        const sessionJson = JSON.stringify(sessionCreds, null, 0);

                        const Sess = await EliteProTech.sendMessage(EliteProTech.user.id, {text: sessionJson});

                        let EliteProTech_TEXT = `✅ *SESSION ID OBTAINED SUCCESSFULLY!*`; // (Keep your full text)

                        await EliteProTech.sendMessage(EliteProTech.user.id, { 
                            image: { url: 'https://eliteprotech-url.zone.id/1766274193656dj57l7.jpg' },
                            caption: EliteProTech_TEXT 
                        }, { quoted: Sess });
                        
                        await delay(5000);
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
