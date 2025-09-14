
// Módulos nativos do Node.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { PassThrough } = require('stream');

// Módulos externos
const axios = require('axios');
const P = require('pino');
const chalk = require('chalk');
const colors = require('colors');
const gradient = require('gradient-string');
const { Boom } = require('@hapi/boom');
const FormData = require('form-data');
const moment = require('moment-timezone');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

// Configuração FFMPEG (se necessário)
const ffmpegPath = 'ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

// Logger para reduzir logs no console (só erros)
const logger = P({ level: 'error' });

// Baileys e funções WhatsApp
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent,
  downloadContentFromMessage,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');

// Importação de módulos locais
const sanizinhaResponder = require('./dados/sanizinha');
const { responderSaudacao } = require('./dados/saudacoes');
const whatsapp = require('./utils/whatsapp');
const { agendamentos, salvarAgendamentos } = require('./utils/agendamentos');
const { handleNamorar } = require('./comandos/namorar');
const comandos = require('./comandos');
const { contador, carregarContador, salvarContador, zerarContadorGrupo } = require('./utils/contador');
const { carregarConfigGrupo, salvarConfigGrupo } = require('./utils/grupoConfig');
const infoDono = require('./dono/info');
// Caminhos e arquivos locais
const number = process.env.WHATSAPP_NUMBER || 'default';
const qrcodePath = `./dados/sessoes/session-${number}`;
const contadorPath = './dados/contador.json';
const pathFuncGp = './dados/funcgp.json';
const gruposDir = './dados/grupos';
const mutedPath = './dados/muted.json';
const pathblock = './dados/bloqueados.json';
const blockpath = path.join(__dirname, './dados/bloqueados.json');
const { cmdVIP, saveCmdVIP, reloadCmdVIP } = require('./comandos');
const vipPath = path.join(__dirname, './dados/vip.json');
let vipList = {};
// Variáveis globais e estruturas de dados

const muteBotUsers = new Set();
const spamBotMap = new Map();
const infratoresAntiporno = {};
const groupMetadataCache = {};
const saudacoesContador = {};
// Dono e configurações
let donoInfo = {};
let mutedUsers = carregarMutados(); // função presumida definida em algum lugar
try {
  donoInfo = JSON.parse(fs.readFileSync('./dono/info.json', 'utf-8'));
} catch (e) {
  console.error('Erro lendo ./dono/info.json:', e);
}
const GROUP_METADATA_TTL = 60 * 1000; // 1 minuto
const dono = (donoInfo.numerodono?.replace(/\D/g, '') || '') + '@s.whatsapp.net';
let nomebot = donoInfo.nomebot || 'Bot';
// Variáveis globais (banco de dados e configurações)
global.db = require('./dados/database.json');
global.config = require('./dono/info.json');
global.sorteioAtivo = global.sorteioAtivo || {};
global.sorteioParticipantes = global.sorteioParticipantes || {};
// Salvar usando função externa (se quiser usar isso em outro lugar)
function salvarJSON(caminho, dados) {
  try {
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
  } catch (err) {
    console.error(`Erro ao salvar JSON em ${caminho}:`, err);
  }
}
// Salvar mutados (usando a função acima)
function podeResponderSaudacao(jid, saudacao) {
  if (!saudacoesContador[jid]) saudacoesContador[jid] = {};
  if (!saudacoesContador[jid][saudacao]) saudacoesContador[jid][saudacao] = 0;
  saudacoesContador[jid][saudacao]++;
  if (saudacoesContador[jid][saudacao] >= 10) {
    saudacoesContador[jid][saudacao] = 0;
    return true;
  }
  return saudacoesContador[jid][saudacao] === 1;
}
// Cache de metadata do grupo com validade
async function getSafeGroupMetadata(sock, jid) {
  if (!jid.endsWith('@g.us')) return null;
  const now = Date.now();
  // Verifica se tem no cache e ainda é válido
  if (groupMetadataCache[jid] && (now - groupMetadataCache[jid].time) < GROUP_METADATA_TTL) {
    return groupMetadataCache[jid].data;
  }
  try {
    const metadata = await sock.groupMetadata(jid);
    groupMetadataCache[jid] = { data: metadata, time: now };
    return metadata;
  } catch (err) {
    console.error('⚠️ Erro ao obter metadata do grupo:', err?.message || err);
    // Se deu erro, retorna último cache válido (se existir)
    return groupMetadataCache[jid]?.data || null;
  }
}
// Alias para compatibilidade com código antigo
async function getGroupMetadataCached(jid, sock) {
  return await getSafeGroupMetadata(sock, jid);
}
// 🔁 Agendamentos automáticos
async function executarAgendamento(grupoId, tipo) {
  if (!sockGlobal) {
    console.log(`⚠️ sockGlobal não inicializado ao tentar executar agendamento para grupo ${grupoId}`);
    return;
  }
  const abrir = tipo === 'gpa';
  try {
    const metadata = await sockGlobal.groupMetadata(grupoId);
    const nomeGrupo = metadata.subject || 'Grupo sem nome';
    await sockGlobal.groupSettingUpdate(grupoId, abrir ? 'not_announcement' : 'announcement');
    console.log(`✅ Grupo '${nomeGrupo}' (${grupoId}) foi ${abrir ? 'aberto' : 'fechado'} automaticamente.`);
  } catch (e) {
    console.log(`❌ Erro ao atualizar configuração do grupo (${grupoId}):`, e?.message || e);
    try {
      await sockGlobal.sendMessage(grupoId, { text: '❌ Erro ao tentar atualizar configuração do grupo.' });
    } catch (e2) {
      console.log(`❌ Erro ao enviar mensagem de erro no grupo (${grupoId})`, e2?.message || e2);
    }
  }
}
setInterval(async () => {
  if (!sockGlobal) {
    console.log('⚠️ sockGlobal não inicializado — aguardando conexão...');
    return;
  }
  const agora = new Date();
  const horaAtual = agora.toTimeString().slice(0, 5); // ex: "14:30"
  const horaTexto = agora.toTimeString().slice(0, 5); // mesmo que horaAtual, mas separado pra clareza
  for (const grupoId in agendamentos) {
    const agendamento = agendamentos[grupoId];
    if (!agendamento) continue;
    try {
      if (agendamento.gpa === horaAtual) {
  await executarAgendamento(grupoId, 'gpa');
  delete agendamentos[grupoId].gpa;
  console.log(`🧹 [LOG] Agendamento 'gpa' removido do grupo ${grupoId}`);
  salvarAgendamentos(); // ⬅️ Adicione isso
  await sockGlobal.sendMessage(grupoId, {
    text: `🔓 Grupo aberto automaticamente às ${horaTexto}`
  });
}
      if (agendamento.gpf === horaAtual) {
  await executarAgendamento(grupoId, 'gpf');
  delete agendamentos[grupoId].gpf;
  console.log(`🧹 [LOG] Agendamento 'gpf' removido do grupo ${grupoId}`);
  salvarAgendamentos(); // ⬅️ Aqui também
  await sockGlobal.sendMessage(grupoId, {
    text: `🔒 Grupo fechado automaticamente às ${horaTexto}`
  });
}
    } catch (err) {
      console.log(`❌ [ERRO] Falha ao executar agendamento do grupo ${grupoId}:`, err?.message || err);
    }
  }
}, 60 * 1000);
// Cria pastas se não existirem
if (!fs.existsSync('./dados')) fs.mkdirSync('./dados', { recursive: true });
if (!fs.existsSync(gruposDir)) fs.mkdirSync(gruposDir, { recursive: true });
if (!fs.existsSync('./dados/sessoes')) fs.mkdirSync('./dados/sessoes', { recursive: true });
// Inicializa contador.json se não existir
if (!fs.existsSync(contadorPath)) fs.writeFileSync(contadorPath, JSON.stringify({}));
// Carrega a lista de bloqueados do arquivo JSON
function carregarBloqueados() {
  try {
    if (!fs.existsSync(blockpath)) {
      fs.writeFileSync(blockpath, JSON.stringify([]));
    }
    const dados = fs.readFileSync(blockpath, 'utf8');
    return JSON.parse(dados);
  } catch (e) {
    console.error('Erro ao carregar bloqueados:', e);
    return [];
  }
}
// Salva a lista de bloqueados no arquivo JSON
function salvarBloqueados(lista) {
  try {
    fs.writeFileSync(blockpath, JSON.stringify(lista, null, 2));
  } catch (e) {
    console.error('Erro ao salvar bloqueados:', e);
  }
}
// Delay utilitário
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Carregar mutados
function carregarMutados() {
  try {
    if (!fs.existsSync(mutedPath)) fs.writeFileSync(mutedPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(mutedPath));
  } catch (err) {
    console.error('Erro ao carregar mutados:', err);
    return {};
  }
}

// Salvar mutados diretamente (caso não use salvarMute)
function salvarMutados(mutedUsers) {
  try {
    fs.writeFileSync(mutedPath, JSON.stringify(mutedUsers, null, 2));
  } catch (err) {
    console.error('Erro ao salvar mutados:', err);
  }
}

function extractFrame(videoPath, outputPath, second = 1) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [second],
        filename: outputPath.split('/').pop(),
        folder: outputPath.replace(/\/[^\/]+$/, ''),
        size: '640x?'
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

// Controle antiflood simples (userCooldown e antifloodDelay precisam existir)
const userCooldown = new Map();
const antifloodDelay = 2200;
function podeExecutar(userId) {
  const agora = Date.now();
  if (!userCooldown.has(userId)) {
    userCooldown.set(userId, agora);
    return true;
  }
  const ultima = userCooldown.get(userId);
  if (agora - ultima > antifloodDelay) {
    userCooldown.set(userId, agora);
    return true;
  }
  return false;
}

// Cache simples para metadata dos grupos (evita chamadas repetidas)
const grupoCache = new Map();
async function getGroupMetadataComCache(sock, jid) {
  if (grupoCache.has(jid)) return grupoCache.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    grupoCache.set(jid, meta);
    // Limpa cache após 30 segundos
    setTimeout(() => grupoCache.delete(jid), 30 * 1000);
    return meta;
  } catch {
    return null;
  }
}

// Função principal que trata mensagens recebidas
async function upsert(m, sock) {
  const msg = m.messages?.[0];
  if (!msg || msg.key.remoteJid === 'status@broadcast') return;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  let sender = isGroup ? msg.key.participant || msg.participant : from;

  if (sender) {
    sender = sender.split('/')[0].replace(/:.+/, '');
  }

  const bloqueados = carregarBloqueados();
  if (bloqueados.includes(sender)) return;
  // 🔹 Pega o texto correto da mensagem
  const textoMsg = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    ''
  ).toString().trim();
  let msgLower = textoMsg.toLowerCase(); // use 'let' pra poder reatribuir se necessário
  if (isGroup) {
    const grupoPath = path.resolve(__dirname, `./dados/grupos/${from}.json`);
    if (!fs.existsSync(grupoPath)) return;
    const configGrupo = JSON.parse(fs.readFileSync(grupoPath));
    const donoInfo = JSON.parse(fs.readFileSync('./dono/info.json'));
    const numeroDono = donoInfo.numerodono.replace(/\D/g, '');
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const isDono = senderJid?.includes(numeroDono);
    const ehBotonOuBotoff = /^\.?(boton|botoff)\b/i.test(msgLower);
    // 🔒 Bloqueia mensagens se botoff ativo, exceto dono usando .boton/.botoff
    if (configGrupo.botoff && !(isDono && ehBotonOuBotoff)) return;
    // ⚡ Executa comando .boton ou .botoff
    if (ehBotonOuBotoff) {
      if (!isDono) {
        await sock.sendMessage(from, { text: '❌ Apenas o dono pode usar este comando.' }, { quoted: msg });
        return;
      }
      // Atualiza o status do bot
      configGrupo.botoff = msgLower.includes('botoff'); // true = desligado, false = ligado
      fs.writeFileSync(grupoPath, JSON.stringify(configGrupo, null, 2));
      const status = configGrupo.botoff ? 'Bot desligado neste grupo.' : 'Bot ligado neste grupo.';
      await sock.sendMessage(from, { text: status }, { quoted: msg });
      return;
    }
  }

if (isGroup) {
  const grupoPath = path.resolve(__dirname, `./dados/grupos/${from}.json`);
  if (!fs.existsSync(grupoPath)) return;
  const configGrupo = JSON.parse(fs.readFileSync(grupoPath));

  // 🔹 Verifica blockgp
  if (configGrupo.blockgp) {
    let groupAdmins = [];
    try {
      const grupoInfo = await sock.groupMetadata(from);
      groupAdmins = grupoInfo.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id.replace(/\D/g, '')); // somente números
    } catch (e) {
      console.error('Erro ao obter metadata do grupo para blockgp:', e);
    }

    const dono = JSON.parse(fs.readFileSync('./dono/info.json')).numerodono.replace(/\D/g, '');
    const senderNum = String(msg.key.participant || from).replace(/\D/g, '');

    // 🔒 Bloqueia membros comuns: ignora totalmente
    if (!groupAdmins.includes(senderNum) && senderNum !== dono) return;
  }
}

// ✅ Responde se marcarem o bot com "oi", "obrigado", etc.
  await sanizinhaResponder(msg, sock, null, dono, isGroup);
await responderSaudacao({ from, sock, msg, podeResponderSaudacao });  
  // 🛡️ Filtro de segurança: sender precisa ser válido e no formato correto
  if (!sender || typeof sender !== 'string' || !/^\d{8,16}@s\.whatsapp\.net$/.test(sender)) return;

  const pushName = msg.pushName || '';
  let nomeGrupo = '';
  let grupoInfo = null;
  let configGrupo = null;
  
  if (isGroup) {
    grupoInfo = await getGroupMetadataComCache(sock, from);
    nomeGrupo = grupoInfo?.subject || 'Grupo sem nome';
    configGrupo = comandos.carregarConfigGrupo(from, nomeGrupo);
  } else {
    nomeGrupo = from;
  }
  if (msg.message) {
    if (!contador[from]) {
      contador[from] = {
        nome: isGroup ? nomeGrupo : 'Privado',
        usuarios: {}
      };
    }
    if (isGroup && contador[from].nome !== nomeGrupo) {
      contador[from].nome = nomeGrupo;
    }
    if (!contador[from].usuarios[sender]) {
      contador[from].usuarios[sender] = {
        mensagens: 0,
        figurinhas: 0,
        audios: 0,
        fotos: 0,
        videos: 0
      };
    }
    const tipo = Object.keys(msg.message || {})[0];
    if (['conversation', 'extendedTextMessage'].includes(tipo)) {
      contador[from].usuarios[sender].mensagens++;
    } else if (tipo === 'stickerMessage') {
      contador[from].usuarios[sender].figurinhas++;
    } else if (tipo === 'audioMessage') {
      contador[from].usuarios[sender].audios++;
    } else if (tipo === 'imageMessage') {
      contador[from].usuarios[sender].fotos++;
    } else if (tipo === 'videoMessage') {
      contador[from].usuarios[sender].videos++;
    }
    salvarContador();
  }
  // --- Fim do contador ---
 text = (
  msg.message?.conversation ||
  msg.message?.extendedTextMessage?.text ||
  msg.message?.imageMessage?.caption ||
  msg.message?.videoMessage?.caption ||
  msg.message?.documentMessage?.caption || ''
).toString();

msgLower = text.toLowerCase().trim();

// VERIFICAÇÃO COMANDO VIP
const comandoDigitado = msgLower.split(' ')[0].replace(/^\./, '').trim();
let cmdVIPAtual = {};
try {
  cmdVIPAtual = JSON.parse(fs.readFileSync('./dados/cmdvip.json', 'utf-8'));
} catch {
  cmdVIPAtual = {};
}
if (cmdVIPAtual[comandoDigitado]) {
  let vipList = {};
  try {
    vipList = JSON.parse(fs.readFileSync('./dados/vip.json', 'utf-8'));
  } catch {
    vipList = {};
  } 
  const senderJid = msg.key.participant || msg.key.remoteJid || sender;
  if (!vipList[senderJid]) {
    return await sock.sendMessage(from, { 
      text: `O comando "${comandoDigitado}" é exclusivo para usuários VIP.` 
    }, { quoted: msg });
  }
}
const isViewOnce = m.message?.viewOnceMessageV2 || m.message?.viewOnceMessage;
if (isViewOnce) {
  const viewOnceContent = msg.message?.viewOnceMessageV2?.message || msg.message?.viewOnceMessage?.message;
  const tipoMidia = Object.keys(viewOnceContent)[0];
  try {
    const buffer = await downloadMediaMessage({ message: viewOnceContent }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
    const filePath = `./dados/tmp/viewonce_${Date.now()}.jpg`;
    fs.writeFileSync(filePath, buffer);
    console.log('✅ Mídia salva em:', filePath);
  } catch (err) {
    console.error('❌ Erro ao baixar mídia view once:', err);
  }
}

  // Verificar se quem enviou é admin no grupo
let isGroupAdmin = false;
if (isGroup && grupoInfo && Array.isArray(grupoInfo.participants)) {
  const participante = grupoInfo.participants.find(p => p.id === sender);
  isGroupAdmin = participante && (participante.admin === 'admin' || participante.admin === 'superadmin');
}
  if (mutedUsers[from]?.includes(sender) || mutedUsers[from]?.includes(sock.user.id)) {
  try {
    await sock.sendMessage(from, {
      delete: {
        remoteJid: from,
        id: msg.key.id,
        participant: msg.key.participant || sender,
      },
    });
    return;
  } catch (e) {
    console.error('Erro ao deletar mensagem mutada:', e);
  }
}
// Resposta automática
if (
  isGroup &&
  msg.message?.extendedTextMessage?.contextInfo?.quotedMessage &&
  !msg.key.fromMe
) {
  try {
    const quoted = msg.message.extendedTextMessage.contextInfo;
    const quotedSender = quoted.participant || quoted.remoteJid || '';
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    if (quotedSender === botNumber) {
      const palavrasPath = './dados/sanizinha.json';
      if (fs.existsSync(palavrasPath)) {
        const palavras = JSON.parse(fs.readFileSync(palavrasPath));
        if (Array.isArray(palavras.respostas)) {
          const textoMsg =
            msg.message?.extendedTextMessage?.text ||
            msg.message?.conversation ||
            msg.message?.imageMessage?.caption ||
            '';
          if (textoMsg && !textoMsg.startsWith('.')) {
            const entrada = textoMsg
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim();
            for (const item of palavras.respostas) {
              if (
                Array.isArray(item.gatilhos) &&
                item.gatilhos.some(g => entrada === g)
              ) {
                await sock.sendMessage(from, {
                  text: item.resposta
                }, {
                  quoted: {
                    key: msg.key,
                    message: msg.message
                  }
                });
                break;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('❌ Erro ao processar resposta automática:', e);
  }
}
// ANTI IMG
if (isGroup) {
  const grupoInfo = await sock.groupMetadata(from);
  const groupAdmins = grupoInfo?.participants?.filter(p => p.admin)?.map(p => p.id) || [];
  const configPath = path.join(__dirname, 'dados', 'grupos', `${from}.json`);
  let configGrupo = {};
  if (fs.existsSync(configPath)) {
    configGrupo = JSON.parse(fs.readFileSync(configPath));
  }
  if (configGrupo.antiimagem && msg.message?.imageMessage) {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const isSenderAdmin = groupAdmins.includes(senderJid);
    if (isSenderAdmin) {
      try {
        await sock.sendMessage(from, { react: { text: '👀', key: msg.key } });
      } catch (e) {
        console.error('Erro ao reagir à imagem de admin:', e);
      }
    } else {
      try {
        await sock.sendMessage(from, { delete: msg.key });
        const response = await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
        if (response[0] && response[0].status === '200') {
          await sock.sendMessage(from, {
            text: `🚫 Usuário @${senderJid.split('@')[0]} removido por enviar imagem sem ser administrador.`,
            mentions: [senderJid]
          }, { quoted: msg });
        } else {
          await sock.sendMessage(from, {
            text: `⚠️ Não foi possível remover @${senderJid.split('@')[0]}. Verifique se o bot é administrador do grupo e tem permissão para remover membros.`,
            mentions: [senderJid]
          }, { quoted: msg });
        }
      } catch (e) {
        console.error('Erro ao remover usuário por AntiImagem:', e);
        await sock.sendMessage(from, {
          text: '❌ Ocorreu um erro ao tentar remover o usuário. Certifique-se de que o bot é administrador e tem permissões.'
        }, { quoted: msg });
      }
    }
    return;
  }
}
// Antitrava
const travasPerigosas = ['\u2063', '\u200B', '\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E'];
const contemTrava = text && travasPerigosas.some(char => text.includes(char));
const muitoGrande = text && text.length > 10000;
if (isGroup && configGrupo?.antitrava && (contemTrava || muitoGrande)) {
  try {
    const grupoInfo = await sock.groupMetadata(from);
    const participantes = grupoInfo.participants || [];
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    let senderId = msg.key?.participant || msg.participant || sender;
if (senderId.includes(':')) {
  senderId = senderId.split(':')[0] + '@s.whatsapp.net';
}
    const isFromBot = senderId === botNumber;
    const isSenderAdmin = participantes.some(p => p.id === senderId && (p.admin || p.superadmin));
    const isBotAdmin = participantes.some(p => p.id === botNumber && (p.admin || p.superadmin));
    if (isFromBot || isSenderAdmin) {
      await sock.sendMessage(from, {
        react: {
          text: '🤡',
          key: msg.key
        }
      });
      console.log(`🤡 Trava ignorada (admin ou bot): ${senderId}`);
    } else {
      await sock.sendMessage(from, {
        delete: {
          remoteJid: from,
          fromMe: false,
          id: msg.key.id,
          participant: senderId
        }
      });
      if (isBotAdmin) {
        const participanteExiste = participantes.some(p => p.id === senderId);
        const donoDoGrupo = grupoInfo.owner || grupoInfo.creator || null;
        if (!participanteExiste) {
          console.log('Usuário não está no grupo, não removendo:', senderId);
        } else if (senderId === donoDoGrupo) {
          console.log('Tentativa de remover dono do grupo, ignorando:', senderId);
        } else if (senderId === botNumber) {
          console.log('Tentativa de remover o próprio bot, ignorando');
        } else {
          try {
            await sock.groupParticipantsUpdate(from, [senderId], 'remove');
            console.log('Usuário removido com sucesso:', senderId);
          } catch (err) {
            console.error('❌ Erro ao remover usuário:', err);
          }
        }
      } else {
        await sock.sendMessage(from, {
          text: '⚠️ Detectei trava, mas não tenho permissão de admin para remover.',
          quoted: msg
        });
      }
    }
  } catch (err) {
    console.error('❌ Erro no antitrava:', err);
  }
  return;
}

// ----------- ANTI PORNO
if (
  isGroup &&
  (
    msg.message?.imageMessage ||
    msg.message?.stickerMessage ||
    msg.message?.viewOnceMessageV2?.message?.imageMessage ||
    msg.message?.viewOnceMessageV2?.message?.videoMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.videoMessage ||
    (msg.message?.documentMessage?.mimetype?.startsWith('video/'))
  )
) {
  let nomeGrupo = '';
  let grupoInfo;
  try {
    grupoInfo = await sock.groupMetadata(from);
    nomeGrupo = grupoInfo.subject || '';
  } catch (err) {
    console.error('❌ Erro ao obter nome do grupo:', err);
    return;
  }

  const configGrupo = carregarConfigGrupo(from, nomeGrupo);
  if (!configGrupo?.antiporno) return;

  const tmpDir = './dados/tmp';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const isVideo =
      msg.message?.videoMessage ||
      msg.message?.viewOnceMessageV2?.message?.videoMessage ||
      msg.message?.documentMessage?.mimetype?.startsWith('video/');

    let imageUrls = [];

    // ===== Processar vídeo =====
    if (isVideo) {
      let fullMsg = msg;
      if (msg.message?.viewOnceMessageV2?.message?.videoMessage) {
        fullMsg = {
          ...msg,
          message: { videoMessage: msg.message.viewOnceMessageV2.message.videoMessage }
        };
      }

      const buffer = await downloadMediaMessage(fullMsg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      if (!buffer) return;

      const timestamp = Date.now();
      const videoPath = `${tmpDir}/video_${timestamp}.mp4`;
      const framePrefix = `${tmpDir}/frame_${timestamp}`;
      fs.writeFileSync(videoPath, buffer);

      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${videoPath}" -vf "fps=1" -vframes 3 "${framePrefix}_%d.jpg"`, (err) => (err ? reject(err) : resolve()));
      });

      for (let i = 1; i <= 3; i++) {
        const framePath = `${framePrefix}_${i}.jpg`;
        if (!fs.existsSync(framePath)) continue;

        const bufferFrame = fs.readFileSync(framePath);
        const form = new FormData();
        form.append('image', bufferFrame, { filename: `frame${i}.jpg`, contentType: 'image/jpeg' });

        const agent = new https.Agent({ rejectUnauthorized: false });
        try {
          const upload = await axios.post(
            'https://api.imgbb.com/1/upload?key=c47bfc1637d9630c137daaf1e3a3cfb9',
            form,
            { headers: form.getHeaders(), httpsAgent: agent }
          );
          const url = upload.data?.data?.url;
          if (url) imageUrls.push(url);
        } catch (err) {
          console.error('❌ Erro ao enviar frame para imgbb:', err.message || err);
        }

        fs.unlinkSync(framePath);
      }
      fs.unlinkSync(videoPath);
    } else {
      // ===== Processar imagem ou figurinha =====
      let buffer;
      if (msg.message?.stickerMessage) {
        const inputPath = `${tmpDir}/sticker_${Date.now()}.webp`;
        const outputPath = inputPath.replace('.webp', '.jpg');
        buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
        fs.writeFileSync(inputPath, buffer);

        const isAnimated = buffer.includes(Buffer.from('ANIM'));
        const cmd = `magick "${inputPath}${isAnimated ? '[0]' : ''}" "${outputPath}"`;

        try {
          await new Promise((resolve, reject) => exec(cmd, (err) => (err ? reject(err) : resolve())));
          buffer = fs.readFileSync(outputPath);
        } catch (e) {
          console.error('❌ Erro ao processar figurinha:', e);
          return;
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      } else {
        let fullMsg = msg;
        if (msg.message?.viewOnceMessageV2?.message?.imageMessage) {
          fullMsg = { ...msg, message: { imageMessage: msg.message.viewOnceMessageV2.message.imageMessage } };
        }
        buffer = await downloadMediaMessage(fullMsg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
        if (!buffer) return;
      }

      const filePath = `${tmpDir}/${from}_${Date.now()}.jpg`;
      fs.writeFileSync(filePath, buffer);

      const form = new FormData();
      form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
      const agent = new https.Agent({ rejectUnauthorized: false });

      try {
        const upload = await axios.post(
          'https://api.imgbb.com/1/upload?key=c47bfc1637d9630c137daaf1e3a3cfb9',
          form,
          { headers: form.getHeaders(), httpsAgent: agent }
        );
        const url = upload.data?.data?.url;
        if (url) imageUrls.push(url);
      } catch (err) {
        console.error('❌ Erro ao enviar imagem para imgbb:', err.message || err);
      }

      fs.unlinkSync(filePath);
    }

    // ===== Analisar imagens nas APIs =====
    for (const imageUrl of imageUrls) {
      const apis = JSON.parse(fs.readFileSync('./dados/antiporno.json', 'utf-8')).apis;
      let data;
      let analiseOk = false;

      for (let i = 0; i < apis.length; i++) {
        const { user, secret } = apis[i];
        try {
          const res = await axios.get('https://api.sightengine.com/1.0/check.json', {
            params: {
              models: 'nudity-2.1,weapon,gore-2.0,qr-content',
              api_user: user,
              api_secret: secret,
              url: imageUrl
            }
          });
          data = res.data;

          if (data.error?.message?.includes('Daily usage limit')) {
            await sock.sendMessage(from, {
              text: `⚠️O limite diário da API *${user}* foi atingido. Tentando próxima...`
            }, { quoted: msg });
            continue; // Próxima API
          }

          analiseOk = true; // Deu certo
          break;
        } catch (err) {
          console.error(`❌ Erro com API user ${user}:`, err.response?.data || err.message);
        }
      }

      if (!analiseOk) {
        console.warn('❌ Nenhuma API funcionou. Abortando verificação.');
        return;
      }

      const nudez = data.nudity?.sexual_activity > 0.7 || data.nudity?.sexual_display > 0.7;
      const arma = data.weapon?.prob > 0.8;
      const gore = data.gore?.prob > 0.8;

      if (nudez || arma || gore) {
        const isSenderAdmin = grupoInfo?.participants?.some(p => p.id === sender && p.admin);
        const tipo = nudez ? '🔞Nudez' : arma ? '🔫Arma' : '🩸Gore';

        if (isSenderAdmin) {
          await sock.sendMessage(from, {
            text: `⚠️ @${sender.split('@')[0]}, ${tipo} detectado, mas você é admin.`,
            mentions: [sender]
          }, { quoted: msg });
          break;
        }

        try {
          await sock.sendMessage(from, {
            delete: { remoteJid: from, fromMe: false, id: msg.key.id, participant: msg.key.participant || sender }
          });
        } catch (err) {
          console.error('❌ Erro ao apagar mensagem imprópria:', err);
        }

        if (!infratoresAntiporno[from]) infratoresAntiporno[from] = {};
        if (!infratoresAntiporno[from][sender]) infratoresAntiporno[from][sender] = 0;
        infratoresAntiporno[from][sender]++;

        if (infratoresAntiporno[from][sender] === 1) {
          await sock.sendMessage(from, {
            text: `@${sender.split('@')[0]}, ${tipo} não pode o criatura 🤦🏼‍♀️ na próxima é ban.`,
            mentions: [sender]
          }, { quoted: msg });
        } else {
          await sock.sendMessage(from, {
            text: `Eu avisei kkkkk\n@${sender.split('@')[0]} será removido por enviar ${tipo.toLowerCase()}.`,
            mentions: [sender]
          }, { quoted: msg });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          delete infratoresAntiporno[from][sender];
        }
        break;
      }
    }
  } catch (err) {
    console.error('❌ Erro ao processar mídia para antiporno:', err);
  }
}
// ANTI LOC
if (isGroup && configGrupo?.antiloc) {
  const isSenderAdmin = grupoInfo?.participants?.find(p => p.id === sender)?.admin;
  const locMsg =
    msg.message?.locationMessage ||
    msg.message?.liveLocationMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.liveLocationMessage ||
    msg.message?.viewOnceMessage?.message?.locationMessage ||
    msg.message?.viewOnceMessage?.message?.liveLocationMessage ||
    msg.message?.viewOnceMessageV2?.message?.locationMessage ||
    msg.message?.viewOnceMessageV2?.message?.liveLocationMessage;
  if (locMsg) {
    if (!isSenderAdmin) {
      try {
        await sock.sendMessage(from, {
          delete: {
            remoteJid: from,
            fromMe: false,
            id: msg.key.id,
            participant: msg.key.participant || sender
          }
        });
      } catch (e) {
        console.error("Erro ao deletar localização:", e);
      }
      await sock.sendMessage(from, {
        text: `📍 *Localização não é permitida aqui*, ${pushName || 'usuário'}! Você será removido...`
      }, { quoted: msg });
      await sock.groupParticipantsUpdate(from, [sender], 'remove');
    } else {
      try {
        await sock.sendMessage(from, { react: { text: '🏳️', key: msg.key } });
      } catch (e) {}
    }
  }
}

  // Antilink e anti-marcação
if (isGroup && configGrupo?.antilink) {
  const regexLink = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\/|bit\.ly|tinyurl\.com|linktr\.ee|ouo\.io|shre\.ink|rebrand\.ly|cutt\.ly)[^\s]+/gi;
  const regexPornSites = /\b(xvideos\.com|pornhub\.com|xnxx\.com|redtube\.com|youporn\.com|brazzers\.com|spankbang\.com|xhamster\.com|onlyfans\.com)\b/i;
  const textoMsg = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    ''
  ).toLowerCase();
  const contemLink = regexLink.test(textoMsg);
  const contemPorn = regexPornSites.test(textoMsg);
  const participante = grupoInfo.participants.find(p => p.id === sender);
  const isSenderAdmin = participante ? (participante.admin === 'admin' || participante.admin === 'superadmin') : false;
  const isDono = sender === dono;
  const isFromMe = msg.key.fromMe;
  // Detecta menções para todos
  let mentioned = [];
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo ||
    msg.message?.conversation?.contextInfo ||
    msg.message?.contextInfo;
  if (contextInfo?.mentionedJid) {
    mentioned = contextInfo.mentionedJid;
  }
  if (mentioned.length === 0 && textoMsg.includes('@')) {
    mentioned = grupoInfo.participants
      .map(p => p.id)
      .filter(id => textoMsg.includes('@' + id.split('@')[0]));
  }
  const mencaoReal = mentioned.length >= (grupoInfo.participants.length * 0.8);
  const mencaoFake = textoMsg.includes('@todos') || textoMsg.includes('@everyone');
  const mencaoTodos = mencaoReal || mencaoFake;
  if ((contemLink || contemPorn || mencaoTodos) && (isSenderAdmin || isFromMe)) {
    await delay(300);
    await sock.sendMessage(from, { react: { text: '👀', key: msg.key } });
  }
  const devePunir = (!isSenderAdmin && !isDono && !isFromMe) && (contemLink || contemPorn || mencaoTodos);
  if (devePunir) {
    try {
      const motivo = contemPorn
        ? "conteúdo adulto"
        : mencaoTodos
          ? "marcação em massa"
          : "link proibido";
      // 🔹 Apaga apenas a mensagem atual
      await sock.sendMessage(from, {
        delete: {
          remoteJid: from,
          fromMe: false,
          id: msg.key.id,
          participant: sender
        }
      });
      await delay(300);
      await sock.groupSettingUpdate(from, 'announcement');
      await delay(300);
      await sock.groupParticipantsUpdate(from, [sender], 'remove');
      await delay(300);
      await sock.groupSettingUpdate(from, 'not_announcement');
      await sock.sendMessage(from, {
        text: `🚫 *${pushName || sender.split('@')[0]}* foi removido por ${motivo}.`
      }, { quoted: msg });
      return;
    } catch (err) {
      console.error('Erro ao aplicar punição automática:', err);
    }
  }
}
  // Executar comandos externos
  try {
    await comandos.executarComandos(sock, msg, from, msgLower, isGroup, isGroupAdmin, sender, pushName);
  } catch (e) {
    console.error('Erro ao executar comando:', e);
  }
}
// Evento para boas-vindas e atualizações de participantes
async function onGroupParticipantsUpdate(update, sock) {
  try {
    const groupId = update.id;
    let configGrupo = carregarConfigGrupo(groupId);
    let groupMetadata = null;
    if (configGrupo.antifake || configGrupo.bemvindo) {
      try {
        groupMetadata = await sock.groupMetadata(groupId);
      } catch (e) {
        console.error('Erro ao obter metadata do grupo:', e);
      }
    }
    for (const participant of update.participants) {
      if (update.action === 'add' && configGrupo.antifake) {
        const participantData = groupMetadata?.participants.find(p => p.id === participant);
        const isAdmin = participantData?.admin !== undefined && participantData?.admin !== null;
        if (!isAdmin && !participant.startsWith('55')) {
          await sock.groupParticipantsUpdate(groupId, [participant], 'remove');
          continue;
        }
      }
      if (update.action === 'add' && Array.isArray(configGrupo.listanegra) && configGrupo.listanegra.includes(participant)) {
        await sock.groupParticipantsUpdate(groupId, [participant], 'remove');
        await sock.sendMessage(groupId, {
          text: `opa vc não é bem vindo aqui kkk @${participant.split('@')[0]}`,
          mentions: [participant]
        });
        continue;
      }
      // Mensagem de boas-vindas
if (update.action === 'add' && configGrupo.bemvindo) {
  const jid = participant;
  const numero = jid.split('@')[0];
  const texto = configGrupo.legendabv
    .replace(/#membro#/g, `@${numero}`)
    .replace(/#grupo#/g, groupMetadata?.subject || 'o grupo');
  let profilePicBuffer = null;
  try {
    const url = await sock.profilePictureUrl(groupId, 'image');
    if (url) {
      const resp = await axios.get(url, { responseType: 'arraybuffer' });
      profilePicBuffer = resp.data;
    }
  } catch {}
  await sock.sendMessage(groupId, {
    text: texto,
    contextInfo: {
      mentionedJid: [jid],
      externalAdReply: {
        title: `🌸 Bem-vindo(a) ao grupo ${groupMetadata?.subject || 'desconhecido'}!`,
        body: '✨ Sombra 291 ✨',
        thumbnail: profilePicBuffer,
        mediaType: 1,
        showAdAttribution: false,
        sourceUrl: `https://youtube.com/@sombrabot?si=a8FxMLtTJqt1CgtM`
      }
    }
  });
}
}
    // Anti Promote
if (update.action === 'promote' && configGrupo.antipromote) {
  console.log('⚠️ Ação de promoção detectada');
  if (!update.author) {
    console.warn('⚠️ update.author está indefinido. Evento ignorado.');
    return;
  }
  const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const donoPath = path.resolve(__dirname, './dono/info.json');
  if (!fs.existsSync(donoPath)) {
    console.warn('❌ Arquivo de dono não encontrado:', donoPath);
    return;
  }
  const numeroDono = JSON.parse(fs.readFileSync(donoPath)).numerodono;
  const donoComSufixo = numeroDono.replace(/\D/g, '') + '@s.whatsapp.net';
  for (const promovido of update.participants) {
    const isPromotorDono = update.author === donoComSufixo;
    const isPromotorBot = update.author === botNumber;
    const isPromovidoDono = promovido === donoComSufixo;
    const isPromovidoBot = promovido === botNumber;
    if (!isPromotorDono && !isPromotorBot && !isPromovidoDono && !isPromovidoBot) {
      await sock.groupParticipantsUpdate(groupId, [update.author, promovido], 'demote');
      await sock.sendMessage(groupId, {
        text: `⛔ Promoção manual detectada!\n@${update.author.split('@')[0]} e @${promovido.split('@')[0]} foram rebaixados.`,
        mentions: [update.author, promovido]
      });
    } else {
    }
  }
}
  } catch (e) {
    console.error('Erro em onGroupParticipantsUpdate:', e);
  }
}
function setSock(sock) {
  sockGlobal = sock;
}
module.exports = {
  upsert,
  onGroupParticipantsUpdate,
  agendamentos,
  salvarAgendamentos,
  setSock
};