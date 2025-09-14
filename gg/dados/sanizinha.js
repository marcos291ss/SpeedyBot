async function sanizinhaResponder(msg, sock, store, dono, isGroup) {
  if (msg.key.fromMe) return; // ← ISSO impede o loop
  const msgTexto =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '';
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.contextInfo ||
    {};
  const citado = contextInfo.participant || contextInfo.mentionedJid?.[0];
  const isMarcouBot = citado === sock.user.id;
  
    if (isMarcouBot && /^ola+\b/i.test(msgTexto)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `oi td bom?`,
    }, { quoted: msg });
  }
  
    if (isMarcouBot && /^sim+\b/i.test(msgTexto)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `que bom😸`,
    }, { quoted: msg });
  }
  
  if (isMarcouBot && /^obgd+\b/i.test(msgTexto)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `dnd😸`,
    }, { quoted: msg });
  }
  if (isMarcouBot && /\bprecisa se apresenta(r)?\b/i.test(msgTexto)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `nao kkk relaxa`,
    }, { quoted: msg });
  }
  if (isMarcouBot && /^oi+\b/i.test(msgTexto)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `oiii 🩷 quer atenção, é?`,
    }, { quoted: msg });
  }
}

module.exports = sanizinhaResponder;