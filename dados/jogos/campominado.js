// campominado.js
const jogos = {};
const letras = 'abcdefgh';

function gerarTabuleiro() {
  const minas = new Set();
  while (minas.size < 10) {
    const linha = Math.floor(Math.random() * 8);
    const coluna = Math.floor(Math.random() * 8);
    minas.add(`${linha},${coluna}`);
  }

  const tabuleiro = Array.from({ length: 8 }, () => Array(8).fill('⬛'));
  return { minas, revelado: new Set(), tabuleiro };
}

function mostrarTabuleiro(jogo) {
  let visual = '   1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣\n';
  for (let i = 0; i < 8; i++) {
    visual += `${letras[i]}  `;
    for (let j = 0; j < 8; j++) {
      const key = `${i},${j}`;
      visual += jogo.revelado.has(key) ? jogo.tabuleiro[i][j] : '⬛';
    }
    visual += '\n';
  }
  return visual;
}

function revelar(jogo, i, j) {
  const key = `${i},${j}`;
  if (jogo.revelado.has(key)) return;

  if (jogo.minas.has(key)) {
    jogo.tabuleiro[i][j] = '💣';
    jogo.revelado.add(key);
    jogo.status = 'perdeu';
    return;
  }

  jogo.tabuleiro[i][j] = '🟩';
  jogo.revelado.add(key);
}

function iniciarJogo(chatId, jogador) {
  jogos[chatId] = {
    ...gerarTabuleiro(),
    jogador,
    status: 'jogando',
  };
}

function jogar(chatId, jogador, jogada) {
  const jogo = jogos[chatId];
  if (!jogo || jogo.status !== 'jogando') return '⚠️ Nenhum jogo ativo. Use *.cm* para iniciar.';

  if (jogador !== jogo.jogador) return '⏳ Aguarde sua vez ou inicie um novo jogo.';

  if (!/^[a-h][1-8]$/i.test(jogada)) {
    return '❌ Jogada inválida. Use de *a1* até *h8*. Exemplo: b3';
  }

  const letra = jogada[0].toLowerCase();
  const numero = jogada.slice(1);
  const i = letras.indexOf(letra);
  const j = parseInt(numero) - 1;

  if (i < 0 || j < 0 || i > 7 || j > 7) return '❌ Posição inválida. Ex: b3, g7';

  revelar(jogo, i, j);

  if (jogo.status === 'perdeu') {
    // Revela todas as minas
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const key = `${x},${y}`;
        if (!jogo.revelado.has(key)) {
          if (jogo.minas.has(key)) {
            jogo.tabuleiro[x][y] = '💣';
            jogo.revelado.add(key);
          }
        }
      }
    }

    const fim = mostrarTabuleiro(jogo);
    delete jogos[chatId];
    return `💥 *BOOM! Você perdeu!*\n\n${fim}`;
  }

  if (jogo.revelado.size === 64 - 10) {
    jogo.status = 'ganhou';
    const fim = mostrarTabuleiro(jogo);
    delete jogos[chatId];
    return `🎉 *Parabéns! Você venceu o Campo Minado!*\n\n${fim}`;
  }

  return `🧨 *Campo Minado - Jogando...*\n\n${mostrarTabuleiro(jogo)}`;
}

module.exports = {
  iniciarJogo,
  jogar,
  jogos
};