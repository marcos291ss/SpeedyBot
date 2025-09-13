const fs = require('fs');
const path = require('path');
const contadorPath = path.join(__dirname, '../dados/contador.json');
const contador = {};
function carregarContador() {
  try {
    if (fs.existsSync(contadorPath)) {
      const data = fs.readFileSync(contadorPath, 'utf8');
      const json = JSON.parse(data);
      for (const grupoId in json) {
        contador[grupoId] = json[grupoId];
      }
    } else {
      console.log('ℹ️ Arquivo contador.json não encontrado, iniciando contador vazio.');
    }
  } catch (e) {
    console.error('❌ Erro ao carregar contador:', e);
  }
}
function salvarContador() {
  try {
    fs.writeFileSync(contadorPath, JSON.stringify(contador, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Erro ao salvar contador:', e);
  }
}
function zerarContadorGrupo(grupoId) {
  if (contador[grupoId]) {
    contador[grupoId].usuarios = {};
    salvarContador();
    console.log(`✅ Contador do grupo ${grupoId} zerado.`);
    return true;
  }
  return false;
}
module.exports = {
  contador,
  carregarContador,
  salvarContador,
  zerarContadorGrupo,
};