const jogos = {}; // Armazena os jogos ativos

function criarTabuleiro(tabuleiro) {
  return `
${tabuleiro[0]} | ${tabuleiro[1]} | ${tabuleiro[2]}
---------
${tabuleiro[3]} | ${tabuleiro[4]} | ${tabuleiro[5]}
---------
${tabuleiro[6]} | ${tabuleiro[7]} | ${tabuleiro[8]}
`.replace(/[1-9]/g, m => `*${m}*`);
}
function verificarVitoria(tab, jogador) {
  const vitorias = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return vitorias.some(([a,b,c]) => tab[a] === jogador && tab[b] === jogador && tab[c] === jogador);
}
function criarNovoJogo(id, playerX, playerO, contraBot = false) {
  jogos[id] = {
    tabuleiro: ['1','2','3','4','5','6','7','8','9'],
    jogadorAtual: 'X',
    playerX,
    playerO,
    contraBot,
    jogando: true
  };
}
function jogar(id, jogador, posicao) {
  const jogo = jogos[id];
  if (!jogo || !jogo.jogando) return '❌ Nenhum jogo em andamento.';  
  const idx = parseInt(posicao) - 1;
  if (isNaN(idx) || idx < 0 || idx > 8) return '❌ Jogada inválida.';  
  if (jogo.tabuleiro[idx] === 'X' || jogo.tabuleiro[idx] === 'O') 
    return '❌ Essa posição já foi jogada.';
  // Define o símbolo do jogador (X ou O)
  let simbolo = null;
  if (jogo.playerX === jogador) simbolo = 'X';
  else if (jogo.playerO === jogador) simbolo = 'O';
  else return '❌ Você não está participando deste jogo.';
  if (jogo.jogadorAtual !== simbolo) return '⏳ Aguarde sua vez.';
  // Marca a jogada
  jogo.tabuleiro[idx] = simbolo;
  // Verifica vitória
  if (verificarVitoria(jogo.tabuleiro, simbolo)) {
    jogo.jogando = false;
    return `🎉 *${simbolo} venceu!* (${simbolo === 'X' ? jogo.playerX : jogo.playerO})\n${criarTabuleiro(jogo.tabuleiro)}`;
  }
  // Verifica empate (não há mais posições numéricas)
  if (!jogo.tabuleiro.some(c => /[1-9]/.test(c))) {
    jogo.jogando = false;
    return `🤝 *Empate!*\n${criarTabuleiro(jogo.tabuleiro)}`;
  }
  // Alterna jogador
  jogo.jogadorAtual = simbolo === 'X' ? 'O' : 'X';
  // Jogada do bot (se for modo contra bot e for vez do bot)
  if (jogo.contraBot && jogo.jogadorAtual === 'O') {
    const livres = jogo.tabuleiro
      .map((v, i) => (/[1-9]/.test(v) ? i : -1))
      .filter(i => i >= 0);
    if (livres.length === 0) {
      jogo.jogando = false;
      return `🤝 *Empate!*\n${criarTabuleiro(jogo.tabuleiro)}`;
    }
    const jogadaBot = livres[Math.floor(Math.random() * livres.length)];
    jogo.tabuleiro[jogadaBot] = 'O';
    // Verifica se o bot venceu
    if (verificarVitoria(jogo.tabuleiro, 'O')) {
      jogo.jogando = false;
      return `🤖 *Bot venceu!*\n${criarTabuleiro(jogo.tabuleiro)}`;
    }
    // Verifica empate após jogada do bot
    if (!jogo.tabuleiro.some(c => /[1-9]/.test(c))) {
      jogo.jogando = false;
      return `🤝 *Empate!*\n${criarTabuleiro(jogo.tabuleiro)}`;
    }
    jogo.jogadorAtual = 'X';
    return `🎮 *Jogo da Velha*\n${criarTabuleiro(jogo.tabuleiro)}\n\n🔁 Vez de: *${jogo.playerX}* (X)`;
  }
  // Se não for contra bot ou não é vez do bot, retorna o tabuleiro e quem joga
  return `🎮 *Jogo da Velha*\n${criarTabuleiro(jogo.tabuleiro)}\n\n🔁 Vez de: *${jogo.jogadorAtual === 'X' ? jogo.playerX : jogo.playerO}* (${jogo.jogadorAtual})`;
}
module.exports = { criarNovoJogo, jogar, jogos };