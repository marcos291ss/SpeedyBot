// campominado.js
const games = {}; // armazenará as partidas por grupo

// ===== FUNÇÃO PARA RENDERIZAR O TABULEIRO =====
function renderBoard(board) {
    const letras = ['A','B','C','D','E','F','G','H'];
    let header = '   1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣\n';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += letras[i] + ' ';
        for (let j = 0; j < 8; j++) {
            result += board[i][j];
        }
        result += '\n';
    }
    return header + result;
}

// ===== INICIAR DESAFIO =====
async function startChallenge(sock, msg, from, isGroup) {
    if (!isGroup) return await sock.sendMessage(from, { text:'❌ Este comando só pode ser usado em grupos.' }, { quoted: msg });

    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    const citado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                   msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!citado) return await sock.sendMessage(from, { text:'❌ Marque ou responda alguém para jogar.', quoted: msg });
    if (citado === sender) return await sock.sendMessage(from, { text:'❌ Você não pode jogar contra você mesmo!', quoted: msg });

    if (!games[from]) games[from] = {};
    if (games[from] && ['aguardando','jogando'].includes(games[from].status))
        return await sock.sendMessage(from, { text:'❌ Já existe uma partida de Campo Minado neste grupo.', quoted: msg });

    games[from] = {
        playerX: sender,
        playerO: citado,
        status: 'aguardando',
        vidas: { [sender]:3, [citado]:3 },
        tabuleiro: Array.from({length:8},()=>Array(8).fill('⬜')),
        minas: [],
        turno: null,
        createdAt: Date.now()
    };

    await sock.sendMessage(from, {
        text:`🎮 @${sender.split('@')[0]} te desafiou para uma partida de Campo Minado!\nResponda apenas "sim" ou "não"`,
        mentions:[sender,citado]
    });
}

// ===== ACEITAR OU RECUSAR =====
async function acceptOrDecline(sock, msg, from, text) {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    const game = games[from];
    if (!game || game.status !== 'aguardando') return;
    if (sender !== game.playerO) return;

    text = text.trim().toLowerCase();

    if (['não','nao','n'].includes(text)) {
        await sock.sendMessage(from,{ 
            text: `❌ @${game.playerO.split('@')[0]} recusou o desafio.`,
            mentions: [game.playerO]
        });
        delete games[from];
        return;
    }

    // Aceitou
    if (['sim','s'].includes(text)) {
        game.status = 'jogando';
        game.turno = game.playerX;

        // Cria minas aleatórias
        game.minas = [];
        while(game.minas.length < 16){
            const r = Math.floor(Math.random()*8);
            const c = Math.floor(Math.random()*8);
            if(!game.minas.some(m => m[0]===r && m[1]===c)) game.minas.push([r,c]);
        }

        let boardMessage = `${renderBoard(game.tabuleiro)}\n🎮 Partida iniciada!\n`;
        boardMessage += `❤️ @${game.playerX.split('@')[0]}\n`;
        boardMessage += `❤️ @${game.playerO.split('@')[0]}\n\n`;
        boardMessage += `Sua vez: @${game.turno.split('@')[0]}`;

        await sock.sendMessage(from, {
            text: boardMessage,
            mentions: [game.playerX, game.playerO, game.turno]
        });
    }
}

// ===== FAZER JOGADA =====
async function makeMove(sock, msg, from, raw) {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    const game = games[from];
    if (!game || game.status !== 'jogando') return;
    if (sender !== game.playerX && sender !== game.playerO) return;
    if (sender !== game.turno) return await sock.sendMessage(from,{text:'⏳ Não é sua vez!',quoted: msg});

    raw = raw.trim().toUpperCase();
    const letras = ['A','B','C','D','E','F','G','H'];
    const row = letras.indexOf(raw[0]);
    const col = parseInt(raw[1],10)-1;

    if(game.tabuleiro[row][col] !== '⬜') return await sock.sendMessage(from,{text:'❌ Esta posição já foi revelada!',quoted: msg});

    const ehMina = game.minas.some(m=>m[0]===row && m[1]===col);
    if(ehMina){
        game.vidas[sender]--;
        game.tabuleiro[row][col]='💥';
        if(game.vidas[sender] <= 0){
            await sock.sendMessage(from,{
                text:`💀 @${sender.split('@')[0]} perdeu todas as vidas!\nFim de jogo!`,
                mentions:[game.playerX, game.playerO]
            });
            delete games[from];
            return;
        }
    } else {
        game.tabuleiro[row][col]='✅';
    }

    // Troca turno
    game.turno = game.turno === game.playerX ? game.playerO : game.playerX;

    await sock.sendMessage(from,{
        text:`${renderBoard(game.tabuleiro)}\n\n@${game.playerX.split('@')[0]} ❤️${'❤️'.repeat(game.vidas[game.playerX]-1)}\n@${game.playerO.split('@')[0]} ❤️${'❤️'.repeat(game.vidas[game.playerO]-1)}\n\n👉 Sua vez: @${game.turno.split('@')[0]}`,
        mentions:[game.playerX, game.playerO]
    });
}

// ===== EXPORTS =====
module.exports = {
    games,
    renderBoard,
    startChallenge,
    acceptOrDecline,
    makeMove
};