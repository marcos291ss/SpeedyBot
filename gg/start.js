// NÃO MEXA AQUI PRA NÃO DAR MERDA!
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const colors = require('colors');
const gradient = require('gradient-string');
const readline = require('readline');
const { exec } = require('child_process');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { upsert, onGroupParticipantsUpdate, setSock } = require('./index.js');

const number = process.env.WHATSAPP_NUMBER || 'default';
const qrcodePath = `./dados/sessoes/session-${number}`;
const pairingCode = process.argv.includes("--code");

const question = (text) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(text, answer => {
      rl.close();
      resolve(answer);
    });
  });
};

let reconnecting = false;
let retryCount = 0;

async function STBLK() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(qrcodePath);
    const { version } = await fetchLatestBaileysVersion();

    // Logger filtrando para mostrar só erros importantes
    const logger = P({ level: 'error' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
      keepAliveIntervalMs: 10000,
      syncFullHistory: false,          // 🚫 não sincroniza histórico antigo
      markOnlineOnConnect: true,       // garante presença online
      generateHighQualityLinkPreview: true // previne erros com links
    });

    setSock(sock);

    sock.ev.on('messages.upsert', async (m) => {
      try {
        const msg = m.messages?.[0]; // ✅ mais seguro
        if (!msg?.message || msg.message.protocolMessage) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || 'Usuário';
        const isGroup = from.endsWith('@g.us');
        const tipo = Object.keys(msg.message)[0];

        let nomeGrupoOuPrivado = 'Privado';
        if (isGroup) {
          try {
            const metadata = await sock.groupMetadata(from);
            nomeGrupoOuPrivado = metadata.subject || 'Grupo';
          } catch (e) {
            console.error(
              'Erro ao obter metadata do grupo no upsert:',
              e?.message || e
            );
            nomeGrupoOuPrivado = 'Grupo Desconhecido';
          }
        }

        let conteudoMsg = '';
        switch (tipo) {
          case 'conversation': conteudoMsg = msg.message.conversation; break;
          case 'extendedTextMessage': conteudoMsg = msg.message.extendedTextMessage.text; break;
          case 'imageMessage': conteudoMsg = '📷 Foto'; break;
          case 'videoMessage': conteudoMsg = '🎥 Vídeo'; break;
          case 'stickerMessage': conteudoMsg = '🧩 Figurinha'; break;
          case 'audioMessage': conteudoMsg = '🎧 Áudio'; break;
          case 'documentMessage': conteudoMsg = '📄 Documento'; break;
          case 'contactMessage': conteudoMsg = '👤 Contato'; break;
          default: conteudoMsg = `[${tipo}]`;
        }

        console.log(colors.green('\n━━━━━━━━✰•𖧹❀⃘࣭࣭࣭࣭ٜꔷ⃔໑࣭࣭ٜ🚥❀⃘࣭࣭࣭࣭ٜꔷ⃔໑࣭࣭ٜ•✰━━━━━━━━━━'));
        console.log(`${chalk.hex('#00BFFF').bold('📍 Chat:')} ${chalk.white.bold(nomeGrupoOuPrivado)}`);
        console.log(`${chalk.hex('#FFA500').bold('👤 Usuário:')} ${chalk.white(`${pushName} @${sender.split('@')[0]}`)}`);
        console.log(`${chalk.hex('#ADFF2F').bold('💬 Mensagem:')} ${chalk.whiteBright(conteudoMsg)}`);
        console.log(colors.green('━━━━━━━━✰•𖧹❀⃘࣭࣭࣭࣭ٜꔷ⃔໑࣭࣭ٜ🚥❀⃘࣭࣭࣭࣭ٜꔷ⃔໑࣭࣭ٜ•✰━━━━━━━━━━'));

// <<< AAA - FUNÇÃO DE AUTO VISUALIZAÇÃO POR GRUPO
try {
  const grupoPath = `./dados/grupos/${from}.json`; // cada grupo tem seu JSON
  if (fs.existsSync(grupoPath)) {
    const configGrupo = JSON.parse(fs.readFileSync(grupoPath, 'utf-8'));
    if (configGrupo.autovisu && !msg.key.fromMe) { // só marca mensagens que não são do bot
      await sock.readMessages([msg.key]); // marca como lida
    }
  }
} catch (err) {
  console.error('Erro ao tentar marcar mensagem como lida:', err);
}

        await upsert(m, sock);
      } catch (e) {
        console.error('Erro no messages.upsert:', e);
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        let metadata;
        try {
          metadata = await sock.groupMetadata(update.id);
        } catch (e) {
          console.error('Erro ao obter metadata do grupo:', e?.message || e);
          return;
        }
        await onGroupParticipantsUpdate(update, sock);

        const { id: groupId, participants, action } = update;
        if (action === 'remove') {
          const contadorPath = './dados/contador.json';
          if (!fs.existsSync(contadorPath)) return;
          let contador = JSON.parse(fs.readFileSync(contadorPath, 'utf-8'));
          if (typeof contador !== 'object') return;

          for (const user of participants) {
            if (contador[groupId]?.[user]) delete contador[groupId][user];
            if (contador[groupId] && Object.keys(contador[groupId]).length === 0) {
              delete contador[groupId];
            }
          }
          fs.writeFileSync(contadorPath, JSON.stringify(contador, null, 2));
        }
      } catch (e) {
        console.error('Erro em group-participants.update:', e);
      }
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr && !pairingCode) {
        console.log('\n📷 Escaneie o QR code abaixo:\n');
        require('qrcode-terminal').generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error;
        const statusCode = new Boom(reason)?.output?.statusCode;

        if (lastDisconnect?.error?.output?.payload?.message === 'Stream Errored (unknown)' || statusCode === 503) {
          console.log(colors.red('❌ Erro de stream detectado (503 - Service Unavailable)'));
        }

        if (reconnecting) {
          console.log(colors.yellow('Já está tentando reconectar, ignorando chamada duplicada.'));
          return;
        }

        reconnecting = true;

        if (statusCode !== DisconnectReason.loggedOut) {
          retryCount++;
          const waitTime = Math.min(30000, 5000 * retryCount); // até 30s máximo
          console.log(colors.yellow(`Tentando reconectar em ${waitTime / 1000} segundos...`));
          await new Promise(resolve => setTimeout(resolve, waitTime));
          try {
            await STBLK();
          } catch (err) {
            console.error('Erro ao tentar reconectar:', err);
          }
          reconnecting = false;
        } else {
          console.log(colors.red("Sessão encerrada pelo logout. Excluindo diretório de sessão..."));
          exec(`rm -rf ${qrcodePath}`, (err) => {
            if (err) console.error('Erro ao excluir sessão:', err);
            process.exit(0);
          });
        }
      } else if (connection === 'open') {
        retryCount = 0;
        reconnecting = false;
        const texto = `
░██████╗░█████╗░███╗░░██╗██╗███████╗██╗███╗░░██╗██╗░░██╗░█████╗░
██╔════╝██╔══██╗████╗░██║██║╚════██║██║████╗░██║██║░░██║██╔══██╗
╚█████╗░███████║██╔██╗██║██║░░███╔═╝██║██╔██╗██║███████║███████║
░╚═══██╗██╔══██║██║╚████║██║██╔══╝░░██║██║╚████║██╔══██║██╔══██║
██████╔╝██║░░██║██║░╚███║██║███████╗██║██║░╚███║██║░░██║██║░░██║
╚═════╝░╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚══════╝╚═╝╚═╝░░╚══╝╚═╝░░╚═╝╚═╝░░╚═╝
                        ██╗░░░██╗░░░███╗
                        ██║░░░██║░░█████║
                        ╚██╗░██╔╝░╚██╔██║
                        ░╚████╔╝░░░╚═╝██║
                        ░░╚██╔╝░░░███████║
                        ░░░╚═╝░░░░╚══════╝`;
        const usernameBot = process.env.BOT_NAME || "Sombrabot";
        console.log(gradient.pastel.multiline(texto));
        console.log(chalk.yellow(`*ੈ🌸‧₊˚Sistema conectado com sucesso°❀⋆.ೃ࿔*･!`));
        console.log(chalk.magenta(`💻 Desenvolvido por ${chalk.bold('@SOMBRA291°❀⋆.ೃ࿔*:･')}`));
        console.log('');
      }
    });

    if (pairingCode && !sock.authState.creds.registered) {
      let phoneNumber = await question("Digite o número do bot (sem + e sem espaços): ");
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
      let code = await sock.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log("🔗 Código de pareamento:", code);
    }

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error('Erro geral na inicialização do bot:', err);
  }
}

STBLK().catch(e => console.error("Erro ao iniciar o bot:", e));