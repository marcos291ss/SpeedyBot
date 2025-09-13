// jogodavelha.js
const games = {}; // armazenará as partidas por grupo

// ===== FUNÇÃO PARA RENDERIZAR O TABULEIRO =====
function renderBoard(board) {
    return board.map(r => r.join(' ')).join('\n');
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
        return await sock.sendMessage(from, { text:'❌ Já existe uma partida de Jogo da Velha neste grupo.', quoted: msg });

    games[from] = {
        playerX: sender,
        playerO: citado,
        status: 'aguardando',
        turno: null,
        tabuleiro: [
            ['1️⃣','2️⃣','3️⃣'],
            ['4️⃣','5️⃣','6️⃣'],
            ['7️⃣','8️⃣','9️⃣']
        ],
        createdAt: Date.now()
    };

    await sock.sendMessage(from, {
        text:`🎮 @${sender.split('@')[0]} desafiou @${citado.split('@')[0]} para uma partida de Jogo da Velha!\nResponda apenas "sim" ou "não"`,
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

        let boardMessage = `${renderBoard(game.tabuleiro)}\n\n🎮 Partida iniciada!\n`;
        boardMessage += `❌ @${game.playerX.split('@')[0]}\n⭕ @${game.playerO.split('@')[0]}\n\n`;
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

    raw = raw.trim();

    // calcula linha/coluna
    let linha=-1, coluna=-1;
    if (/^[1-9]$/.test(raw)) {
        const pos = parseInt(raw,10)-1;
        linha = Math.floor(pos/3);
        coluna = pos%3;
    } else {
        const parts = raw.replace(/[,;:-]/g,' ').trim().split(/\s+/);
        if (parts.length===2 && /^[1-3]$/.test(parts[0]) && /^[1-3]$/.test(parts[1])) {
            linha = parseInt(parts[0],10)-1;
            coluna = parseInt(parts[1],10)-1;
        } else {
            return await sock.sendMessage(from, { text: 'Formato inválido. Use "linha coluna" (1-3) ou posição 1-9.', quoted: msg });
        }
    }

    // valida posição
    const casa = game.tabuleiro[linha][coluna];
    if (!'1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣'.includes(casa)) {
        return await sock.sendMessage(from, { text: '❌ Essa casa já está ocupada!', quoted: msg });
    }

    const simbolo = sender===game.playerX ? '❌' : '⭕';
    game.tabuleiro[linha][coluna] = simbolo;

    const venceu = (b,s) => [0,1,2].some(i=>b[i][0]===s&&b[i][1]===s&&b[i][2]===s) ||
                             [0,1,2].some(i=>b[0][i]===s&&b[1][i]===s&&b[2][i]===s) ||
                             (b[0][0]===s&&b[1][1]===s&&b[2][2]===s) ||
                             (b[0][2]===s&&b[1][1]===s&&b[2][0]===s);

    const board = renderBoard(game.tabuleiro);

    // Vitória
    if (venceu(game.tabuleiro,simbolo)) {
        await sock.sendMessage(from,{ 
            text:`🎉 Vitória de @${sender.split('@')[0]}!\n\n${board}`,
            mentions:[game.playerX, game.playerO]
        });
        delete games[from];
        return;
    }

    // Empate
    if (!game.tabuleiro.flat().some(c=>'1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣'.includes(c))) {
        await sock.sendMessage(from,{ text:`🤝 Empate!\n\n${board}` });
        delete games[from];
        return;
    }

    // troca turno
    game.turno = game.turno===game.playerX ? game.playerO : game.playerX;

    await sock.sendMessage(from,{ 
        text:`${board}\n\n👉 Sua vez @${game.turno.split('@')[0]}`,
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