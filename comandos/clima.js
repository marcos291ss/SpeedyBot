// clima.js
const axios = require('axios');

const WEATHER_API_KEY = process.env.WEATHER_KEY || '79bc54bf279eeddcb77fc27679a81de0';

// Busca a previsão de 5 dias (3 em 3 horas)
async function fetchForecast(city = 'São Paulo') {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
    city
  )}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`;

  const res = await axios.get(url);
  if (!res.data || !res.data.list) throw new Error('Erro ao buscar previsão');
  return res.data;
}

// Processa e resume a previsão por dia
async function getWeeklyWeather(city = 'São Paulo') {
  try {
    const data = await fetchForecast(city);

    const daily = {};

    data.list.forEach((entry) => {
      const dateObj = new Date(entry.dt * 1000);
      const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(
        dateObj.getMonth() + 1
      ).padStart(2, '0')}`;

      if (!daily[dateStr]) {
        daily[dateStr] = {
          min: entry.main.temp_min,
          max: entry.main.temp_max,
          weather: entry.weather[0].description,
        };
      } else {
        daily[dateStr].min = Math.min(daily[dateStr].min, entry.main.temp_min);
        daily[dateStr].max = Math.max(daily[dateStr].max, entry.main.temp_max);
      }
    });

    let msg = `🌤️ *Previsão para ${data.city.name}, ${data.city.country}* — próximos dias\n\n`;

    Object.entries(daily).forEach(([date, info]) => {
      msg += `📅 ${date}\n`;
      msg += `☁️ ${capitalize(info.weather)}\n`;
      msg += `🌡️ Min ${info.min.toFixed(1)}°C • Máx ${info.max.toFixed(1)}°C\n\n`;
    });

    return msg.trim();
  } catch (e) {
    console.error('Erro getWeeklyWeather:', e?.message || e);
    return '⚠️ Não foi possível obter a previsão do tempo.';
  }
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { getWeeklyWeather };