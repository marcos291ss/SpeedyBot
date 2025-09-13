// memoria.js
const jogadores = {}; // Armazena jogos por grupo ou chat

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const emojis = ['🍎','🍌','🍇','🍉','🍓','🥝','🍍','🥥','🥑','🍒'];
const numeros = ['¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹','¹⁰','¹¹','¹²','¹³','¹⁴','¹⁵','¹⁶','¹⁷','¹⁸','¹⁹','²⁰'];

function mostrarTabuleiro(jogo) {
  const cartas = jogo.tabuleiro.map((v, i) => {
    if (jogo.reveladas.includes(i) || jogo.pares.includes(i)) return `${emojis[v]}`;
    return `${numeros[i] ?? i+1}⬜`;
  });
  return (
    `${cartas.slice(0,6).join('   ')}\n` +
    `${cartas.slice(6,12).join('   ')}\n` +
    `${cartas.slice(12,18).join('   ')}\n` +
    `${cartas.slice(18,20).join('   ')}`
  );
}

function iniciarJogo(id, jogador1, jogador2) {
  const pares = [...Array(10).keys(), ...Array(10).keys()];
  const embaralhado = embaralhar(pares);
  jogadores[id] = {
    tabuleiro: embaralhado,
    reveladas: [],
    pares: [],
    pontuacao: { [jogador1]: 0, [jogador2]: 0 },
    jogadores: [jogador1, jogador2],
    atual: jogador1
  };
}

function jogar(id, jogador, entrada) {
  const jogo = jogadores[id];
  if (!jogo || jogo.jogadores.indexOf(jogador) === -1) return { texto: '⚠️ Você não está no jogo.' };
  if (jogo.atual !== jogador) return { texto: '⏳ Aguarde sua vez.' };

  const [a, b] = entrada.split(/\s+/).map(n => parseInt(n) - 1);
  if (isNaN(a) || isNaN(b) || a === b || a < 0 || b < 0 || a >= 20 || b >= 20)
    return { texto: '❌ Jogada inválida. Digite dois números entre 1 e 20.' };

  if (jogo.pares.includes(a) || jogo.pares.includes(b))
    return { texto: '🟨 Essas cartas já foram encontradas.' };

  jogo.reveladas = [a, b];
  const cartasIguais = jogo.tabuleiro[a] === jogo.tabuleiro[b];

  if (cartasIguais) {
    jogo.pares.push(a, b);
    jogo.pontuacao[jogador]++;
  }

  const tabuleiroMostrado = mostrarTabuleiro(jogo);
  const fim = jogo.pares.length === 20;
  const proximo = jogo.jogadores.find(j => j !== jogador);

  const esconder = () => {
    if (!cartasIguais) jogo.atual = proximo;
    jogo.reveladas = [];
    return `${mostrarTabuleiro(jogo)}\n\n🎯 Agora é a vez de @${jogo.atual.split('@')[0]}`;
  };

  const texto = `${tabuleiroMostrado}\n\n${
    cartasIguais ? '✅ Par encontrado! Jogue novamente!' : '❌ Não é par!'
  }`;

  if (fim) {
    const [j1, j2] = jogo.jogadores;
    const p1 = jogo.pontuacao[j1];
    const p2 = jogo.pontuacao[j2];
    delete jogadores[id];
    return {
      texto: `🏁 *Fim do Jogo da Memória!*\n\n@${j1.split('@')[0]}: ${p1} pares\n@${j2.split('@')[0]}: ${p2} pares\n\n👑 ${
        p1 > p2 ? '@' + j1.split('@')[0] : p2 > p1 ? '@' + j2.split('@')[0] : 'Empate!'
      } venceu!`,
      fim: true,
      mentions: [j1, j2]
    };
  }

  return { texto, esconder, mentions: jogo.jogadores };
}

module.exports = { iniciarJogo, jogar, jogadores };