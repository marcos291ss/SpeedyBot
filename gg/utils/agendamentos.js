//  VAI BEBER ÁGUA CURIOSO😹
const fs = require('fs');
const path = './dados/agendamentos.json';
let agendamentos = {};
if (fs.existsSync(path)) {
  agendamentos = JSON.parse(fs.readFileSync(path));
}
function salvarAgendamentos() {
  fs.writeFileSync(path, JSON.stringify(agendamentos, null, 2));
}
module.exports = {
  agendamentos,
  salvarAgendamentos
};