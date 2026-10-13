const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// ==================== 🛠️ AYARLAR VE ID'LER ====================
const TOKEN = "MTU1OTU5Nzk2MTAzMjM3NjM1MA.G9glCN._tBeRnZl-kZqXMn4A9O44Z5MlHYjgnxgvlGaG0"; 

const DURUM_ROLU_ID = "1545909240944791652"; 
const LOG_KANAL_ID = "1557853502452142141"; // Tag alım log kanalı
const DUYURU_KANAL_ID = "1557858236026331156"; // Tag silenlere toplu duyuru kanalı
const TESEKKUR_KANAL_ID = "1559607114022912030"; // Tag alanlara teşekkür mesajı kanalı

// Daha önce tag almış kullanıcıları takip eden liste
const previousTaggers = new Set();

// 🌐 7/24 Keep-Alive Sunucusu (Port 8081)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write("NOVA TR Tag Guard Botu 7/24 Aktif!");
    res.end();
}).listen(8081, () => {
    console.log("[TAG BOT] Web sunucusu 8081 portunda aktif.");
});

client.once('ready', () => {
    console.log(`[TAG BOT AKTİF] ${client.user.tag} hazır ve denetime başladı!`);
    client.user.setActivity('🏷️ .gg/novatr Tag Denetimi', { type: 3 });

    // Haftada 3 kez (her ~56 saatte bir) tag silenlere hatırlatma duyurusu gönderir
    setInterval(() => {
        sendTagReminder();
    }, 56 * 60 * 60 * 1000);
});

// ==================== 🏷️ ANLIK DURUM VE TAG DENETİMİ ====================
client.on('presenceUpdate', async (oldPresence, newPresence) => {
    if (!newPresence || !newPresence.guild || newPresence.user.bot) return;

    const guild = newPresence.guild;
    const member = guild.members.cache.get(newPresence.userId);
    if (!member) return;

    // Kurucu veya Yöneticilerden rol almak yasak kuralı
    const isFounderOrAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.id === guild.ownerId;

    // Çevrimdışı / Invisible (Görünmez) durumdayken rol KESİNLİKLE alınmayacak
    if (newPresence.status === 'offline' || newPresence.status === 'invisible') {
        return;
    }

    const activities = newPresence.activities || [];
    let hasNovatr = false;
    let hasUpEJZZ = false;

    for (const activity of activities) {
        const stateText = activity.state || '';
        const nameText = activity.name || '';
        const detailsText = activity.details || '';
        const combined = `${stateText} ${nameText} ${detailsText}`.toLowerCase();

        if (combined.includes('.gg/novatr')) hasNovatr = true;
        if (combined.includes('.gg/upejzz7ftv')) hasUpEJZZ = true;
    }

    const hasTag = hasNovatr || hasUpEJZZ;
    const role = guild.roles.cache.get(DURUM_ROLU_ID);
    if (!role) return;

    const logChannel = guild.channels.cache.get(LOG_KANAL_ID);
    const tesekkurChannel = guild.channels.cache.get(TESEKKUR_KANAL_ID);

    try {
        // TAG VARSA -> Rol Ver, Teşekkür Et ve Logla
        if (hasTag) {
            if (!member.roles.cache.has(DURUM_ROLU_ID)) {
                await member.roles.add(role).catch(() => {});
                previousTaggers.add(member.id);

                // 1. Teşekkür Kanalı Mesajı
                if (tesekkurChannel) {
                    tesekkurChannel.send(`TAG ALDIĞIN İÇİN TEŞEKKÜRLER <@${member.id}>`).catch(() => {});
                }

                // 2. Log Kanalı Özel Bildirimi
                if (logChannel) {
                    let logMessage = "";
                    if (hasNovatr) {
                        logMessage = `<@${member.id}> durumuna .gg/novatr YAZDIĞIN İÇİN [rol id ${DURUM_ROLU_ID}] ROLÜNÜ ALDIN`;
                    } else if (hasUpEJZZ) {
                        logMessage = `<@${member.id}> durumuna .gg/upEJZZ7ftv YAZDIĞIN İÇİN [rol id ${DURUM_ROLU_ID}] ROLÜNÜ ALDIN`;
                    }
                    logChannel.send(logMessage).catch(() => {});
                }
            }
        } 
        // TAG SİLİNDİYSE -> Aktifse ve yazı yoksa rolü geri al
        else {
            if (isFounderOrAdmin) return; // Kuruculardan rol almak yasak

            if (member.roles.cache.has(DURUM_ROLU_ID)) {
                await member.roles.remove(role).catch(() => {});
            }
        }
    } catch (err) {
        console.error("[TAG KONTROL HATA]:", err);
    }
});

// Sunucudan çıkanlar için hiçbir uyarı mesajı gönderilmeyecek (Sessiz çıkış)
client.on('guildMemberRemove', (member) => {
    // Kurallar gereği mesaj gönderilmiyor, bırak boş kalsın.
});

// Haftada 3 kez çalışan duyuru fonksiyonu (Daha önce yazıp silenlere)
async function sendTagReminder() {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const duyuruChannel = guild.channels.cache.get(DUYURU_KANAL_ID);
        if (!duyuruChannel) return;

        const targets = [];
        for (const userId of previousTaggers) {
            const member = guild.members.cache.get(userId);
            // Sunucuda aktif olan ama şu an tag rolü olmayanlar
            if (member && !member.roles.cache.has(DURUM_ROLU_ID)) {
                targets.push(`<@${userId}>`);
            }
        }

        if (targets.length > 0) {
            const mentions = targets.slice(0, 15).join(' '); // Tek seferde max 15 kişiyi etiketler
            const reminderMessage = `${mentions}\nİSMİ GEÇEN KİŞİLER DURUMUNA .gg/novatr YADA .gg/upEJZZ7ftv YAZSINLAR`;
            await duyuruChannel.send(reminderMessage).catch(() => {});
        }
    } catch (err) {
        console.error("[DUYURU HATA]:", err);
    }
}

client.login(TOKEN);