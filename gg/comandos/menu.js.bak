const fs = require('fs');
const path = require('path');
const axios = require('axios');
const infoPath = path.resolve(__dirname, '../dono/info.json');
let nomebot = 'SanizinhaBot💕';
let numerodono = '';
try {
  const info = require(infoPath);
  nomebot = info.nomebot || nomebot;
  numerodono = info.numerodono || numerodono;
} catch (e) {
  console.warn(`⚠️ Não foi possível carregar info.json em ${infoPath}, usando valores padrão.`);
}
module.exports = async function menuCommand(msg, sock, from) {
  try {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid || from;
    const userTag = `@${sender.split('@')[0]}`;
    const isDono = sender.includes(numerodono);
    const groupMetadata = await sock.groupMetadata(from);
    const isAdmin = groupMetadata.participants?.some(p =>
      p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    const admStatus = isAdmin ? '✅' : '❌';
    await sock.sendMessage(from, { react: { text: '🙇🏻‍♀️', key: msg.key } });
    const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const uptime = process.uptime();
    const uptimeHoras = Math.floor(uptime / 3600);
    const uptimeMin = Math.floor((uptime % 3600) / 60);
    const uptimeSeg = Math.floor(uptime % 60);
    const thumbnailUrl = 'https://files.catbox.moe/1716db.jpg';
    async function getBuffer(url) {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return res.data;
      } catch (err) {
        console.error('Erro ao baixar thumbnail do menu:', err.message);
        return null;
      }
    }
    const thumbnail = await getBuffer(thumbnailUrl);
    const lermais = '\u200E'.repeat(4500);
    const menuText = `~✦ ❍✦ ❍✦ ✰ ✦❍ ✦❍ ✦~
│✭ 𝗢𝗶𝗶 ${userTag}
│✭ 𝗼𝗻𝗹𝗶𝗻𝗲 𝗮: ${uptimeHoras}𝗵 ${uptimeMin}𝗺 ${uptimeSeg}𝘀
│✭ 𝗛𝗼𝗿𝗮: ${hora}
│✭ 𝗗𝗼𝗻𝗼: ${isDono ? '☑️' : '❌'}
│✭ 𝗔𝗱𝗺: ${admStatus}
~✦ ❍✦ ❍✦ ✰ ✦❍ ✦❍ ✦~
${lermais} 
💕COMANDOS💕
> 👑ۣ ► menuadm
> 🌎 ► grupoofc  
> 🌎 ► sorteio
> 🌎 ► lojasani
> 🌎 ► calcular
> 🌎 ► criador
> 🌎 ► toimg
> 🌎 ► revelar
> 🌎 ► perfil
> 🌎 ► matar
> 🌎 ► beijar
> 🌎 ► linda
> 🌎 ► lindo
> 🌎 ► dono
> 🌎 ► ping
> 🌎 ► bot
> 🌎 ► fs

🎭ZOEIRA😂
> 🎠 ► pau
> 🎠 ► ppk
> 🎠 ► lavarlouca
> 🎠 ► tapa
> 🎠 ► tapao
> 🎠 ► corno
> 🎠 ► gay

🥇RANKS🏆
> 🎖️ ► rank  
> 🎖️ ► rankgay
> 🎖️ ► rankgado
> 🎖️ ► rankcorno
> 🎖️ ► rankfeio
> 🎖️ ► ranklindo
> 🎖️ ► rankputa
> 🎖️ ► rankclt
> 🎖️ ► rankpau
> 🎖️ ► rankppk

🎮JOGOS⚽
> 🎲 ► dado
> 👵🏻 ► jogodavelha
> 🧐 ► vdddsf
> 💣 ► campominado
> 🧩 ► memoria🚫
> 🧸 ► forca🚫

🔍DOWNLOADS🔎
> 🎶 ► play
> 🎶 ► playvd
> 🎶 ► videopraaudio🚫

💭INFOS/IDEIA💡
> 🪐 ► infogp    
> 🪐 ► ideia
~✦      ★      𝑺𝒂𝒏𝒊𝒛𝒊𝒏𝒉𝒂𝑩𝒐𝒕      ★     ✦~`;
    await sock.sendMessage(from, {
      text: menuText,
      mentions: [sender],
      contextInfo: {
        mentionedJid: [sender],
        externalAdReply: {
          title: '🪐 𝗠𝗘𝗡𝗨 𝗜𝗡𝗜𝗖𝗜𝗔𝗟 ✨',
          body: `❤️‍🔥 ${nomebot}`,
          mediaType: 1,
          previewType: 'PHOTO',
          renderLargerThumbnail: false,
          thumbnail: thumbnail,
          mediaUrl: thumbnailUrl,
          sourceUrl: 'https://nexosofc'
        }
      }
    }, { quoted: msg });
  } catch (err) {
    console.error('Erro ao enviar menu:', err.message);
    await sock.sendMessage(from, { text: '❌ Erro ao carregar menu.' }, { quoted: msg });
  }
};