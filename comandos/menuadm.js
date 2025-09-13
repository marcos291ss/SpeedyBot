const axios = require('axios');
const { nomebot } = require('../dono/info.json');

module.exports = async function menuAdmCommand(msg, sock, from) {
  try {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid || from;
    const userTag = `@${sender.split('@')[0]}`;
    const groupMetadata = await sock.groupMetadata(from);
    const isAdmin = groupMetadata.participants?.some(p =>
      p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    if (!isAdmin) {
      await sock.sendMessage(from, {
        text: '❌ Apenas administradores podem usar este comando.'
      }, { quoted: msg });
      return;
    }
    await sock.sendMessage(from, { react: { text: '👮🏻‍♂️', key: msg.key } });
    let ppUrl;
    try {
      ppUrl = await sock.profilePictureUrl(from, 'image');
    } catch {
      ppUrl = 'https://files.catbox.moe/aeakfl.jpg';
    }
    const thumbnail = await axios.get(ppUrl, { responseType: 'arraybuffer' }).then(res => res.data);
    const lermais = '\u200E'.repeat(4501);
    const menuAdmText = `╭═════════════════╮
│𝗕𝗲𝗺 𝘃𝗶𝗻𝗱𝗼 ${userTag}
╰═════════════════╯
${lermais}
═╮
『*COMANDOS-ADM*』
╭══════════════════
═╯
> 🛡️ ► 𝗴𝗽𝗮 7h 30m
> 🛡️ ► 𝗴𝗽𝗳 23h 59m
> 🛡️ ► 𝗔 abrir 𝗙 fecha
> 🛡️ ► 𝗯𝗮𝗻 / 𝗯 / 𝗯𝗮𝗺
> 🛡️ ► 𝗹𝗶𝗻𝗸𝗴𝗽
> 🛡️ ► 𝗺𝘂𝘁𝗲
> 🛡️ ► 𝗹𝗶𝘀𝘁𝗮𝗻𝗲𝗴𝗿𝗮
> 🛡️ ► 𝘁𝗶𝗿𝗮𝗿𝗱𝗮𝗹𝗶𝘀𝘁𝗮
> 🛡️ ► 𝘃𝗲𝗿𝗹𝗶𝘀𝘁𝗮
> 🛡️ ► 𝗱𝗲𝘀𝗺𝘂𝘁𝗲
> 🛡️ ► 𝗮𝗻𝘁𝗶𝗹𝗶𝗻𝗸
> 🛡️ ► 𝗮𝗻𝘁𝗶𝘁𝗿𝗮𝘃𝗮
> 🛡️ ► 𝗮𝗻𝘁𝗶𝗹𝗼𝗰
> 🛡️ ► 𝗮𝗻𝘁𝗶𝗽𝗼𝗿𝗻𝗼
> 🛡️ ► 𝗮𝗻𝘁𝗶𝗳𝗮𝗸𝗲
> 🛡️ ► 𝗹𝗶𝗺𝗽𝗮𝗮𝗱𝘃
> 🛡️ ► 𝗮𝗱𝘃
> 🛡️ ► 𝘁𝗶𝗿𝗮𝗿𝗮𝗱𝘃
> 🛡️ ► 𝗹𝗶𝗺𝗽𝗮𝗮𝗱𝘃
> 🛡️ ► 𝗯𝗲𝗺𝘃𝗶𝗻𝗱𝗼
> 🛡️ ► 𝗹𝗲𝗴𝗲𝗻𝗱𝗮𝗯𝘃
> 🛡️ ► 𝗹𝗶𝗺𝗽𝗮𝗿
> 🛡️ ► 𝗹𝗶𝗺𝗽𝗮𝗿𝗮𝗻𝗸
> 🛡️ ► 𝗹𝗶𝗺𝗽𝗮𝗿𝗮𝗻𝗸2
> 🛡️ ► 𝗯𝗹𝗼𝗰𝗸𝗴𝗽
> 🛡️ ► 𝗺𝗮𝗿𝗰𝗮 / 𝗰𝗶𝘁𝗮
> 🛡️ ► 𝘁𝗼𝘁𝗮𝗴
> 🛡️ ► 𝗴𝗵𝗼𝘀𝘁𝘀
> 🛡️ ► 𝗱𝗲𝗹
> 🛡️ ► 𝗮𝘃𝘁
╰═══════════════════`;
    await sock.sendMessage(from, {
      text: menuAdmText,
      mentions: [sender],
      contextInfo: {
        mentionedJid: [sender],
        externalAdReply: {
          title: '👑 𝗠𝗘𝗡𝗨 𝗔𝗗𝗠 👑',
          body: `❤️‍🔥 ${nomebot}`,
          mediaType: 1,
          previewType: 'PHOTO',
          renderLargerThumbnail: false,
          thumbnail,
          mediaUrl: '',
          sourceUrl: 'https://www.youtube.com/channel/UCF6dDTE8uON-PbWQz-xPIvA'
        }
      }
    }, { quoted: msg });
  } catch (err) {
    console.error('Erro ao enviar menuAdm:', err.message);
    await sock.sendMessage(from, {
      text: '❌ Erro ao carregar menu de administrador.'
    }, { quoted: msg });
  }
};