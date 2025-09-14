// comandos/menuzoeira.js
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

// Envia áudio do menu zoeira
async function sendZoeiraAudio(sock, from, msg) {
  const audioPath = path.resolve(__dirname, '../audios/menuzoeira.mp3');
  if (!fs.existsSync(audioPath)) return;
  const audioBuffer = fs.readFileSync(audioPath);
  await sock.sendMessage(from, {
    audio: audioBuffer,
    mimetype: 'audio/mpeg',
    fileName: 'menuzoeira.mp3',
    ptt: false
  }, { quoted: msg });
}

module.exports = async function menuZoeiraCommand(msg, sock, from) {
  try {
    await sendZoeiraAudio(sock, from, msg);

    const sender = msg.key.participant || msg.participant || msg.key.remoteJid || from;
    const userTag = `@${sender.split('@')[0]}`;
    const isDono = sender.includes(numerodono);

    // Verifica se é admin no grupo
    const groupMetadata = await sock.groupMetadata(from).catch(() => null);
    const isAdmin = groupMetadata?.participants?.some(
      p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    const admStatus = isAdmin ? '✅' : '❌';

    // Uptime do bot
    const uptime = process.uptime();
    const uptimeHoras = Math.floor(uptime / 3600);
    const uptimeMin = Math.floor((uptime % 3600) / 60);
    const uptimeSeg = Math.floor(uptime % 60);

    // Thumbnail
    const thumbnailUrl = 'https://files.catbox.moe/aeakfl.jpg';
    const getBuffer = async url => {
      try {
        return (await axios.get(url, { responseType: 'arraybuffer' })).data;
      } catch {
        return null;
      }
    };
    const thumbnail = await getBuffer(thumbnailUrl);

    const textoZoeira = `╭══════════════════╮
│✭ 𝗢𝗶𝗶 ${userTag}
│✭ 𝗢𝗻𝗹𝗶𝗻𝗲: ${uptimeHoras}h ${uptimeMin}m ${uptimeSeg}s
│✭ 𝗗𝗼𝗻𝗼: ${isDono ? '☑️' : '❌'}
│✭ 𝗔𝗱𝗺: ${admStatus}
╰═══════════════════╯
═╮
『_*MENU ZOEIRA*_』 
╭══════════════════
═╯    
> 🎠 ► pau  
> 🎠 ► ppk  
> 🎠 ► lavarlouca  
> 🎠 ► tapa  
> 🎠 ► tapao  
> 🎠 ► corno  
> 🎠 ► gay  
> 🎠 ► linda  
> 🎠 ► lindo  
> 🎠 ► beijar  
> 🎠 ► matar  
╰══════════════════'


${isDono ? '😎 Você é o dono, pode usar tudo sem limites!' : ''}

_    SOMBRA 291 you tube    _`;

    await sock.sendMessage(from, {
      text: textoZoeira,
      mentions: [sender],
      contextInfo: {
        mentionedJid: [sender],
        externalAdReply: {
          title: 'MENU ZOEIRA',
          body: `🔱 ${nomebot}`,
          mediaType: 1,
          previewType: 'PHOTO',
          renderLargerThumbnail: true,
          thumbnail,
          mediaUrl: thumbnailUrl,
          sourceUrl: 'https://www.youtube.com/channel/UCF6dDTE8uON-PbWQz-xPIvA'
        }
      }
    }, { quoted: msg });
  } catch (err) {
    console.error('Erro no menuZoeiraCommand:', err.message);
    await sock.sendMessage(from, { text: '❌ Erro ao carregar menu de zoeira.' }, { quoted: msg });
  }
};
