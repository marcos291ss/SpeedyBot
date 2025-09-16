const palavras = [
  { palavra: 'ABACAXI', dica: 'Fruta tropical com coroa' },
  { palavra: 'JAVASCRIPT', dica: 'Linguagem de programação' },
  { palavra: 'FOGUETE', dica: 'Veículo espacial' },
  { palavra: 'ELEFANTE', dica: 'Maior mamífero terrestre' },
  { palavra: 'BICICLETA', dica: 'Tem duas rodas' },
  { palavra: 'AMARELO', dica: 'Cor do sol' },
  { palavra: 'GUITARRA', dica: 'Instrumento musical com cordas' },
];

const jogos = {}; // jogos[chatId] = { palavra, dica, letras, erros, tentativas, jogador1, jogador2 }

function criarNovoJogo(chatId, jogador1, jogador2 = null) {
  const escolha = palavras[Math.floor(Math.random() * palavras.length)];
  const palavra = escolha.palavra.toUpperCase();
  jogos[chatId] = {
    palavra,
    dica: escolha.dica,
    letras: [],
    erros: [],
    tentativas: 6,
    jogador1,
    jogador2,
    jogando: true,
  };
}

function mostrarForca(jogo) {
  let display = '';
  for (const letra of jogo.palavra) {
    display += jogo.letras.includes(letra) ? letra + ' ' : '_ ';
  }
  return display.trim();
}

function jogar(chatId, sender, tentativa) {
  const jogo = jogos[chatId];
  if (!jogo || !jogo.jogando) return '⚠️ Nenhum jogo em andamento.';

  if (jogo.jogador2 && sender !== jogo.jogador1 && sender !== jogo.jogador2)
    return '🚫 Você não está participando deste jogo.';

  tentativa = tentativa.toUpperCase();

  if (tentativa.length === 1) {
    if (jogo.letras.includes(tentativa) || jogo.erros.includes(tentativa)) {
      return `⚠️ A letra "${tentativa}" já foi usada.\n\n${mostrarForca(jogo)}\n\n❌ Erros: ${jogo.erros.join(', ')}\n❤️ Vidas: ${jogo.tentativas}`;
    }

    if (jogo.palavra.includes(tentativa)) {
      jogo.letras.push(tentativa);
    } else {
      jogo.erros.push(tentativa);
      jogo.tentativas--;
    }
  } else {
    if (tentativa === jogo.palavra) {
      jogo.letras = [...new Set(jogo.palavra.split(''))];
    } else {
      jogo.tentativas = 0;
    }
  }

  const venceu = jogo.palavra.split('').every(l => jogo.letras.includes(l));

  if (venceu) {
    jogo.jogando = false;
    return `🎉 Parabéns! A palavra era *${jogo.palavra}*.\n✅ Você venceu!`;
  }

  if (jogo.tentativas <= 0) {
    jogo.jogando = false;
    return `💀 Você perdeu!\nA palavra era *${jogo.palavra}*.`;
  }

  return `🎯 Dica: *${jogo.dica}*\n\n${mostrarForca(jogo)}\n\n❌ Erros: ${jogo.erros.join(', ') || 'Nenhum'}\n❤️ Vidas: ${jogo.tentativas}`;
}

module.exports = {
  criarNovoJogo,
  jogar,
  jogos,
};