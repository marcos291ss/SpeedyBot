const games = {}; // armazenará partidas por grupo

const WHITE_PIECES = ['♙','♖','♘','♗','♕','♔','🫅🏻'];
const BLACK_PIECES = ['♟️','♜','♞','♝','♛','♚','🤴🏿'];

// ===== INICIAL =====
// Casas já preenchidas com emojis claros e escuros
function initialBoard() {
    return [
        [    '♜','♞','♝','♛','♚','♝','♞','♜'], // A
        ['♟️','♟️','♟️','♟️','♟️','♟️','♟️','♟️'], // B
        ['🟦','🟫','🟦','🟫','🟦','🟫','🟦','🟫'], // C
        ['🟫','🟦','🟫','🟦','🟫','🟦','🟫','🟦'], // D
        ['🟦','🟫','🟦','🟫','🟦','🟫','🟦','🟫'], // E
        ['🟫','🟦','🟫','🟦','🟫','🟦','🟫','🟦'], // F
        ['♙','♙','♙','♙','♙','♙','♙','♙'], // G
        [   '♖','♘','♗','♕','♔','♗','♘','♖']  // H
    ];
}

// ===== RENDER TABULEIRO COM ESPAÇOS ENTRE PEÇAS =====
function renderBoard(board) {
    const letras = ['A','B','C','D','E','F','G','H'];
    let header = '   1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣\n';
    let result = '';

    for (let i = 0; i < 8; i++) {
        let line = letras[i] + ' ';
        for (let j = 0; j < 8; j++) {
            line += board[i][j];
            if (j < 7) line += '  '; // espaço duplo entre as peças
        }
        result += line + '\n';
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
        return await sock.sendMessage(from, { text:'❌ Já existe uma partida de Xadrez neste grupo.', quoted: msg });  

    games[from] = {  
        playerWhite: sender,  
        playerBlack: citado,  
        status: 'aguardando',  
        turno: null,  
        board: initialBoard(),  
        createdAt: Date.now()  
    };  

    await sock.sendMessage(from, {  
        text:`🎮 @${sender.split('@')[0]} desafiou @${citado.split('@')[0]} para uma partida de Xadrez!\nResponda apenas "sim" ou "não"`,  
        mentions:[sender,citado]  
    });
}

// ===== ACEITAR OU RECUSAR =====
async function acceptOrDecline(sock, msg, from, text) {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    const game = games[from];
    if (!game || game.status !== 'aguardando') return;
    if (sender !== game.playerBlack) return;

    text = text.trim().toLowerCase();  
    if (['não','nao','n'].includes(text)) {  
        await sock.sendMessage(from,{ text:`❌ @${game.playerBlack.split('@')[0]} recusou o desafio.`, mentions:[game.playerBlack] });  
        delete games[from];  
        return;  
    }  
    if (['sim','s'].includes(text)) {  
        game.status = 'jogando';  
        game.turno = game.playerWhite;  

        const boardText = renderBoard(game.board);
        await sock.sendMessage(from,{  
            text:`${boardText}\n🎮 Partida iniciada!\n🔹 Branco: @${game.playerWhite.split('@')[0]}\n🔹 Preto: @${game.playerBlack.split('@')[0]}\n\nSua vez: @${game.turno.split('@')[0]}`,  
            mentions:[game.playerWhite, game.playerBlack, game.turno]  
        });  
    }
}

// ===== VALIDAÇÃO (simplificada ainda) =====
function isMoveValid(game, fromRow, fromCol, toRow, toCol) {
    const piece = game.board[fromRow][fromCol];
    if (piece === '🟦' || piece === '🟫') return false;
    const target = game.board[toRow][toCol];
    const isWhite = WHITE_PIECES.includes(piece);
    const isBlack = BLACK_PIECES.includes(piece);
    const targetIsWhite = WHITE_PIECES.includes(target);
    const targetIsBlack = BLACK_PIECES.includes(target);
    if ((isWhite && targetIsWhite) || (isBlack && targetIsBlack)) return false;

    const dr = toRow - fromRow;  
    const dc = toCol - fromCol;  

    switch(piece) {  
        case '♙': return (dc===0 && dr===-1 && (target==='🟦'||target==='🟫')) || (dc===0 && dr===-2 && fromRow===6 && (target==='🟦'||target==='🟫') && (game.board[fromRow-1][fromCol]==='🟦'||game.board[fromRow-1][fromCol]==='🟫')) || (Math.abs(dc)===1 && dr===-1 && target!=='🟦' && target!=='🟫');
        case '♟️': return (dc===0 && dr===1 && (target==='🟦'||target==='🟫')) || (dc===0 && dr===2 && fromRow===1 && (target==='🟦'||target==='🟫') && (game.board[fromRow+1][fromCol]==='🟦'||game.board[fromRow+1][fromCol]==='🟫')) || (Math.abs(dc)===1 && dr===1 && target!=='🟦' && target!=='🟫');
        case '♖': case '♜': return dr===0 || dc===0;
        case '♗': case '♝': return Math.abs(dr)===Math.abs(dc);
        case '♘': case '♞': return (Math.abs(dr)===2 && Math.abs(dc)===1)||(Math.abs(dr)===1 && Math.abs(dc)===2);
        case '♕': case '♛': return dr===0 || dc===0 || Math.abs(dr)===Math.abs(dc);
        case '♔': case '♚': return Math.abs(dr)<=1 && Math.abs(dc)<=1;
        case '🫅🏻': case '🤴🏿': return dr===0 || dc===0 || Math.abs(dr)===Math.abs(dc);
    }  
    return false;
}

// ===== RESETAR PARTIDA =====
async function resetGame(sock, msg, from) {
    if (!games[from]) return await sock.sendMessage(from, { text: '❌ Não há nenhuma partida ativa neste grupo.' }, { quoted: msg });
    
    const game = games[from];
    delete games[from];  

    await sock.sendMessage(from, { 
        text: `🛑 Partida de Xadrez entre @${game.playerWhite.split('@')[0]} e @${game.playerBlack.split('@')[0]} foi encerrada!`, 
        mentions: [game.playerWhite, game.playerBlack] 
    });
}

// ===== FAZER JOGADA =====
async function makeMove(sock, msg, from, raw) {
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    const game = games[from];
    if (!game || game.status!=='jogando') return;

    if (![game.playerWhite, game.playerBlack].includes(sender)) return;  
    if (sender !== game.turno) return await sock.sendMessage(from,{text:'⏳ Não é sua vez!',quoted: msg});  

    raw = raw.trim().toUpperCase();  
    const letras = ['A','B','C','D','E','F','G','H'];  
    if (!/^[A-H][1-8]\s*[A-H][1-8]$/.test(raw)) return await sock.sendMessage(from,{text:'❌ Formato inválido. Use "A2 A3"',quoted: msg});  

    const fromRow = letras.indexOf(raw[0]);        
    const fromCol = parseInt(raw[1]) - 1;          
    const toRow   = letras.indexOf(raw[3]);  
    const toCol   = parseInt(raw[4]) - 1;  

    const piece = game.board[fromRow][fromCol];  
    if (piece === '🟦' || piece === '🟫') return await sock.sendMessage(from,{text:'❌ Não há peça nessa posição!',quoted: msg});  
    if (sender === game.playerWhite && !WHITE_PIECES.includes(piece)) return await sock.sendMessage(from,{text:'⚪ Você só pode mover peças brancas!',quoted: msg});  
    if (sender === game.playerBlack && !BLACK_PIECES.includes(piece)) return await sock.sendMessage(from,{text:'⚫ Você só pode mover peças pretas!',quoted: msg});  
    if (!isMoveValid(game, fromRow, fromCol, toRow, toCol)) return await sock.sendMessage(from,{text:'❌ Movimento inválido!',quoted: msg});  

    // Movimento
    game.board[toRow][toCol] = piece;  
    game.board[fromRow][fromCol] = ( (fromRow + fromCol) % 2 === 0 ) ? '🟦' : '🟫';  

    // Promoção de peões
    if (piece==='♙' && toRow===0) game.board[toRow][toCol]='🫅🏻';  
    if (piece==='♟️' && toRow===7) game.board[toRow][toCol]='🤴🏿';  

    // Verifica vitória
    const flat = game.board.flat();  
    if (!flat.includes('♚')) {  
        await sock.sendMessage(from,{text:`🏆 Branco venceu!`,mentions:[game.playerWhite, game.playerBlack]});  
        delete games[from]; return;  
    }  
    if (!flat.includes('♔')) {  
        await sock.sendMessage(from,{text:`🏆 Preto venceu!`,mentions:[game.playerWhite, game.playerBlack]});  
        delete games[from]; return;  
    }  

    game.turno = sender === game.playerWhite ? game.playerBlack : game.playerWhite;  

    const boardText = renderBoard(game.board);
    await sock.sendMessage(from,{  
        text:`${boardText}\n\nSua vez: @${game.turno.split('@')[0]}`,  
        mentions:[game.playerWhite, game.playerBlack, game.turno]  
    });
}

module.exports = { games, renderBoard, resetGame, startChallenge, acceptOrDecline, makeMove };