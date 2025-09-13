// damas.js (com dama “voadora” e captura em sequência)
const games = {}; // partidas por grupo

// ===== CONSTANTES =====
const WHITE_PIECES = '⚪';
const BLACK_PIECES = '⚫';
const WHITE_KING   = '🫅🏻';
const BLACK_KING   = '🤴🏿';
const EMPTY_LIGHT  = '🟦';
const EMPTY_DARK   = '🟫';

const isEmpty = (cell) => cell === EMPTY_LIGHT || cell === EMPTY_DARK;
const isWhite = (cell) => cell === WHITE_PIECES || cell === WHITE_KING;
const isBlack = (cell) => cell === BLACK_PIECES || cell === BLACK_KING;
const isKing  = (cell) => cell === WHITE_KING   || cell === BLACK_KING;
const tileFor = (r,c)  => ((r+c)%2===0) ? EMPTY_LIGHT : EMPTY_DARK;
const inside  = (r,c)  => r>=0 && r<8 && c>=0 && c<8;

function initialBoard() {
  const b = Array.from({length:8},()=>Array(8).fill(EMPTY_DARK));
  for (let i=0;i<8;i++){
    for (let j=0;j<8;j++){
      b[i][j] = tileFor(i,j);
    }
  }
  // Pretas em cima (linhas 0..2), Brancas embaixo (5..7)
  for (let i=0;i<3;i++){
    for (let j=0;j<8;j++) if ((i+j)%2===1) b[i][j]=BLACK_PIECES;
  }
  for (let i=5;i<8;i++){
    for (let j=0;j<8;j++) if ((i+j)%2===1) b[i][j]=WHITE_PIECES;
  }
  return b;
}

function renderBoard(board) {
  const letras = ['A','B','C','D','E','F','G','H'];
  let header = '   1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣\n';
  let out = '';
  for (let i=0;i<8;i++){
    out += letras[i] + ' ';
    for (let j=0;j<8;j++) out += board[i][j];
    out += '\n';
  }
  return header + out;
}

// ===== INICIAR DESAFIO =====
async function startChallenge(sock, msg, from, isGroup) {
  if (!isGroup) return sock.sendMessage(from,{text:'❌ Este comando só pode ser usado em grupos.'},{quoted:msg});
  const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
  const citado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                 msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (!citado)      return sock.sendMessage(from,{text:'❌ Marque ou responda alguém para jogar.'},{quoted:msg});
  if (citado===sender) return sock.sendMessage(from,{text:'❌ Você não pode jogar contra você mesmo!'},{quoted:msg});

  if (!games[from]) games[from] = {};
  if (games[from] && ['aguardando','jogando'].includes(games[from].status))
    return sock.sendMessage(from,{text:'❌ Já existe uma partida de Damas neste grupo.'},{quoted:msg});

  games[from] = {
    playerWhite: sender,
    playerBlack: citado,
    status: 'aguardando',
    turno: null,
    board: initialBoard(),
    chain: null, // força continuar captura com a mesma peça
    createdAt: Date.now()
  };

  await sock.sendMessage(from,{
    text:`🎮 @${sender.split('@')[0]} te desafiou para uma partida de Damas!\nResponda apenas "sim" ou "não"`,
    mentions:[sender,citado]
  });
}

// ===== ACEITAR OU RECUSAR =====
async function acceptOrDecline(sock, msg, from, text) {
  const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
  const game = games[from];
  if (!game || game.status!=='aguardando') return;
  if (sender !== game.playerBlack) return;

  text = text.trim().toLowerCase();
  if (['não','nao','n'].includes(text)) {
    await sock.sendMessage(from,{text:`❌ @${game.playerBlack.split('@')[0]} recusou o desafio.`,mentions:[game.playerBlack]});
    delete games[from]; return;
  }
  if (['sim','s'].includes(text)) {
    game.status='jogando';
    game.turno = game.playerWhite;
    await sock.sendMessage(from,{
      text:`${renderBoard(game.board)}\n🎮 Partida iniciada!\n⚪ @${game.playerWhite.split('@')[0]}\n⚫ @${game.playerBlack.split('@')[0]}\n\n👉 Sua vez: @${game.turno.split('@')[0]}`,
      mentions:[game.playerWhite,game.playerBlack,game.turno]
    });
  }
}

// ===== BUSCAS DE CAPTURA =====
function hasCaptureFrom(game, r, c) {
  const piece = game.board[r][c];
  if (!isWhite(piece) && !isBlack(piece)) return false;

  // Rei (dama) – procura inimigo numa diagonal com casa vazia depois
  if (isKing(piece)) {
    const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr,dc] of dirs){
      let i=r+dr, j=c+dc, seenEnemy=false;
      while (inside(i,j)) {
        const cell = game.board[i][j];
        if (isEmpty(cell)) { if (seenEnemy) return true; i+=dr; j+=dc; continue; }
        if ((isWhite(piece) && isWhite(cell)) || (isBlack(piece) && isBlack(cell))) break;
        if (!seenEnemy) { seenEnemy=true; i+=dr; j+=dc; } else break;
      }
    }
    return false;
  }

  // Peças normais – checam saltos de 2
  const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr,dc] of dirs){
    const mr=r+dr, mc=c+dc, tr=r+2*dr, tc=c+2*dc;
    if (!inside(tr,tc) || !inside(mr,mc)) continue;
    const mid = game.board[mr][mc];
    if (isEmpty(game.board[tr][tc]) &&
        ((isWhite(piece) && isBlack(mid)) || (isBlack(piece) && isWhite(mid))))
      return true;
  }
  return false;
}

function hasAnyCapture(game, isTurnWhite) {
  for (let r=0;r<8;r++){
    for (let c=0;c<8;c++){
      const cell = game.board[r][c];
      if (cell === (isTurnWhite? WHITE_PIECES:BLACK_PIECES) ||
          cell === (isTurnWhite? WHITE_KING  :BLACK_KING)) {
        if (hasCaptureFrom(game,r,c)) return true;
      }
    }
  }
  return false;
}

// ===== VALIDAÇÃO (inclui dama “voadora”) =====
function isMoveValid(game, fromRow, fromCol, toRow, toCol) {
  if (!inside(fromRow,fromCol) || !inside(toRow,toCol)) return {ok:false};
  const piece = game.board[fromRow][fromCol];
  const target = game.board[toRow][toCol];
  if (!isWhite(piece) && !isBlack(piece)) return {ok:false};
  if (!isEmpty(target)) return {ok:false};

  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  if (Math.abs(dr) !== Math.abs(dc)) return {ok:false}; // precisa ser diagonal

  // Rei/dama: desliza e pode capturar à distância (exatamente 1 inimigo no caminho)
  if (isKing(piece)) {
    const sr = dr>0?1:-1, sc = dc>0?1:-1;
    let i=fromRow+sr, j=fromCol+sc, enemies=0, captured=null;
    while (i!==toRow && j!==toCol) {
      const cell = game.board[i][j];
      if (isEmpty(cell)) { i+=sr; j+=sc; continue; }
      if ((isWhite(piece) && isWhite(cell)) || (isBlack(piece) && isBlack(cell))) return {ok:false};
      enemies++; captured=[i,j];
      if (enemies>1) return {ok:false};
      i+=sr; j+=sc;
    }
    return enemies===0 ? {ok:true,capture:false} : {ok:true,capture:true,captured};
  }

  // Peça normal:
  // movimento simples 1 casa na diagonal (branco sobe, preto desce)
  if (Math.abs(dr)===1 && Math.abs(dc)===1) {
    if (isWhite(piece) && dr===-1) return {ok:true,capture:false};
    if (isBlack(piece) && dr=== 1) return {ok:true,capture:false};
    return {ok:false};
  }

  // captura simples (salto de 2) – aceita captura para trás
  if (Math.abs(dr)===2 && Math.abs(dc)===2) {
    const mr = fromRow + dr/2, mc = fromCol + dc/2;
    const mid = game.board[mr][mc];
    if ((isWhite(piece) && isBlack(mid)) || (isBlack(piece) && isWhite(mid)))
      return {ok:true,capture:true,captured:[mr,mc]};
  }

  return {ok:false};
}

// ===== FAZER JOGADA =====
async function makeMove(sock, msg, from, raw) {
  const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
  const game = games[from];
  if (!game || game.status!=='jogando') return;
  if (sender !== game.playerWhite && sender !== game.playerBlack) return;

  // se estiver em sequência de captura, só pode mover a mesma peça
  if (game.chain) {
    // ok
  }
  const isTurnWhite = (sender === game.playerWhite);
  if ((isTurnWhite && game.turno !== game.playerWhite) || (!isTurnWhite && game.turno !== game.playerBlack))
    return sock.sendMessage(from,{text:'⏳ Não é sua vez!',quoted:msg});

  raw = raw.trim().toUpperCase().replace(/\s+/g,'');
  if (!/^[A-H][1-8][A-H][1-8]$/.test(raw))
    return sock.sendMessage(from,{text:'Formato inválido. Use "A3 D6"',quoted:msg});

  const letras = ['A','B','C','D','E','F','G','H'];
  const fromRow = letras.indexOf(raw[0]);
  const fromCol = parseInt(raw[1],10)-1;
  const toRow   = letras.indexOf(raw[2]);
  const toCol   = parseInt(raw[3],10)-1;

  const piece = game.board[fromRow][fromCol];

  // se está em corrente de captura, obrigar a mesma peça
  if (game.chain && (game.chain.r!==fromRow || game.chain.c!==fromCol))
    return sock.sendMessage(from,{text:'⚠️ Você deve continuar capturando com a MESMA peça.',quoted:msg});

  // Captura obrigatória global (se existir e o lance não capturar)
  const intent = isMoveValid(game, fromRow, fromCol, toRow, toCol);
  if (!intent.ok) return sock.sendMessage(from,{text:'❌ Movimento inválido!',quoted:msg});
  if (!intent.capture && hasAnyCapture(game, isTurnWhite))
    return sock.sendMessage(from,{text:'⚠️ Captura obrigatória disponível. Realize uma captura.',quoted:msg});

  // Executa movimento
  // remove capturada (se houver)
  let didCapture = !!intent.capture;
  if (didCapture) {
    const [cr,cc] = intent.captured; // no rei pode ser longe, já veio calculado
    game.board[cr][cc] = tileFor(cr,cc);
  }

  game.board[toRow][toCol] = piece;
  game.board[fromRow][fromCol] = tileFor(fromRow,fromCol);

  // Promoção
  if (piece === WHITE_PIECES && toRow === 0) game.board[toRow][toCol] = WHITE_KING;
  if (piece === BLACK_PIECES && toRow === 7) game.board[toRow][toCol] = BLACK_KING;

  const landed = game.board[toRow][toCol];

  // Verifica sequência de captura obrigatória a partir da CASA onde parou
  if (didCapture && hasCaptureFrom(game, toRow, toCol)) {
    game.chain = {r:toRow, c:toCol};
    // mantém o mesmo turno
    await sock.sendMessage(from,{
      text:`${renderBoard(game.board)}\n⚔️ Você tem outra captura! Jogue novamente com a mesma peça (ex.: ${raw.slice(2)} ... )\n👉 @${game.turno.split('@')[0]}`,
      mentions:[game.playerWhite, game.playerBlack, game.turno]
    });
    return;
  } else {
    game.chain = null;
  }

  // Conta peças para vitória
  let w=0, b=0;
  for (const row of game.board){
    for (const cell of row){
      if (cell===WHITE_PIECES || cell===WHITE_KING) w++;
      if (cell===BLACK_PIECES || cell===BLACK_KING) b++;
    }
  }
  if (w===0 || b===0){
    await sock.sendMessage(from,{text:`🏆 ${w===0?'Preto':'Branco'} venceu!`,mentions:[game.playerWhite, game.playerBlack]});
    delete games[from]; return;
  }

  // troca turno
  game.turno = (game.turno===game.playerWhite) ? game.playerBlack : game.playerWhite;

  await sock.sendMessage(from,{
    text:`${renderBoard(game.board)}\n👉 Sua vez: @${game.turno.split('@')[0]}`,
    mentions:[game.playerWhite, game.playerBlack, game.turno]
  });
}

// ===== RESET =====
async function resetGame(sock, msg, from) {
  const game = games[from];
  if (!game) return sock.sendMessage(from,{text:'❌ Não há partida ativa.',quoted:msg});
  delete games[from];
  await sock.sendMessage(from,{text:'🛑 Partida encerrada.'});
}

// ===== EXPORTS =====
module.exports = {
  games,
  renderBoard,
  startChallenge,
  acceptOrDecline,
  makeMove,
  resetGame
};