// menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const infoPath = path.resolve(__dirname, '../dono/info.json');
let nomebot = 'Sombra Bot 🔱';
let numerodono = '';

try {
  const info = require(infoPath);
  nomebot = info.nomebot || nomebot;
  numerodono = info.numerodono || numerodono;
} catch {
  console.warn(`⚠️ Não foi possível carregar info.json em ${infoPath}, usando valores padrão.`);
}

// Envia áudio do menu principal (opcional)
async function sendMenuAudio(sock, from, msg) {
  const audioPath = path.resolve(__dirname, '../audios/menu.mp3');
  if (!fs.existsSync(audioPath)) return;
  const audioBuffer = fs.readFileSync(audioPath);
  await sock.sendMessage(
    from,
    {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      fileName: 'menu.mp3',
      ptt: false, // ou true se quiser que seja PTT
    },
    { quoted: msg }
  );
}

module.exports = async function menuCommand(msg, sock, from) {
  try {
    await sendMenuAudio(sock, from, msg);

    const sender = msg.key.participant || msg.participant || msg.key.remoteJid || from;
    const userTag = `@${sender.split('@')[0]}`;
    const isDono = sender.includes(numerodono);

    const groupMetadata = await sock.groupMetadata(from).catch(() => null);
    const isAdmin = groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    const admStatus = isAdmin ? '✅' : '❌';

    const uptime = process.uptime();
    const uptimeHoras = Math.floor(uptime / 3600);
    const uptimeMin = Math.floor((uptime % 3600) / 60);
    const uptimeSeg = Math.floor(uptime % 60);

    const thumbnailUrl = 'https://files.catbox.moe/k93qzg.png';
    const getBuffer = async (url) => {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return res.data;
      } catch {
        return null;
      }
    };
    const thumbnail = await getBuffer(thumbnailUrl);

    const menuText = `╭═══════════════════╮
│✭ 𝗢𝗶𝗶 ${userTag}
│✭ 𝗢𝗻𝗹𝗶𝗻𝗲: ${uptimeHoras}h ${uptimeMin}m ${uptimeSeg}s
│✭ 𝗗𝗼𝗻𝗼: ${isDono ? '☑️' : '❌'}
│✭ 𝗔𝗱𝗺: ${admStatus}
╰═══════════════════╯
═╮
『 𝐌𝐄𝐍𝐔𝐒 』
╭══════════════════
═╯  
『*COMANDOS PRINCIPAIS*』
> 👑► menuadm
> 🔱► menudono
> 🔥► menuzoeira
> 🎮► menujogos
> 🪜► menurank
> 🌎► grupoofc
> 💱► sorteio
> 🔞► lojasombra
> ✏️► calcular
> 📷► toimg
> 🕵🏻‍♂️► revelar
> 💆🏻‍♂️► perfil
> 🔱► dono
> 🏎️► ping
> 🤖► bot
> 🌌► fs
╰═══════════════════

╭═══════════════════
>『 *INFOS / IDEIAS* 』
> 🪐► infogp
> 🪐► ideia
╰═══════════════════`;
    await sock.sendMessage(
      from,
      {
        text: menuText,
        mentions: [sender],
        contextInfo: {
          externalAdReply: {
            title: 'MENU INICIAL',
            body: `🔱 ${nomebot}`,
            mediaType: 1,
            previewType: 'PHOTO',
            renderLargerThumbnail: true,
            thumbnail,
            mediaUrl: thumbnailUrl,
            sourceUrl: '',
          },
        },
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error('Erro ao enviar menu:', err.message);
    await sock.sendMessage(from, { text: '❌ Erro ao carregar menu.' }, { quoted: msg });
  }
};
