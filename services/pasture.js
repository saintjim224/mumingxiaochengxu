const config = require('../config/api');

function request(path, data, method) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.baseUrl.replace(/\/$/, '') + path,
      data: data || {},
      method: method || 'GET',
      timeout: config.timeout,
      success(res) {
        if (!res || res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
          return reject(new Error('服务暂时没有连上'));
        }
        let payload = res.data;
        if (typeof payload === 'string') {
          if (payload.trim().startsWith('<!DOCTYPE') || payload.includes('<html')) {
            return reject(new Error('服务暂时没有连上'));
          }
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            return reject(new Error('服务暂时没有连上'));
          }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return reject(new Error('服务暂时没有连上'));
        }
        resolve(payload);
      },
      fail(err) {
        console.warn && console.warn('[pasture] 网络请求失败:', path, err);
        reject(new Error('网络没有连上，请稍后再试'));
      }
    });
  });
}

function normalizeWeather(payload, now) {
  const c = payload.current;
  if (!payload.ok || !c || c.temperature === null || c.temperature === undefined || !Number.isFinite(Number(c.temperature)) || !c.obsTime) throw new Error('当地天气暂时没有更新');
  const raw = payload.raw || {};
  const offset = Number.isFinite(Number(raw.utc_offset_seconds)) ? Number(raw.utc_offset_seconds) : 28800;
  const iso = String(c.obsTime);
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? Date.parse(iso) : Date.parse(iso + 'Z') - offset * 1000;
  if (!Number.isFinite(timestamp)) throw new Error('天气更新时间不完整');
  const age = (now === undefined ? Date.now() : now) - timestamp;
  const stale = age > 3 * 3600000 || age < -3600000;
  const units = raw.current_units || {};
  const wind = c.wind_speed === null || c.wind_speed === undefined || !Number.isFinite(Number(c.wind_speed)) ? '暂无' : c.wind_speed + ' ' + (units.wind_speed_10m || 'km/h');
  const wet = c.precipitation === null || c.precipitation === undefined || !Number.isFinite(Number(c.precipitation)) ? '暂无' : c.precipitation + ' mm';
  return { temperature: String(Math.round(Number(c.temperature))), description: c.weather || '天气已更新', wind, precipitation: wet, time: iso.replace('T', ' '), stale, status: stale ? '较早天气 · 请重新获取' : '最近天气', source: 'Open-Meteo · 县城附近参考' };
}

function parseDisasterForecast(data, county) {
  const series = data.forecast_series || {};
  const temps = series.temps_16 || [];
  const temp = temps.length > 0 && Number.isFinite(Number(temps[0])) ? Math.round(Number(temps[0])) : 0;
  const snow = data.snow_disaster || {};
  const gale = data.gale || {};
  const cold = data.cold_wave || {};
  const drought = data.drought || {};

  let desc = snow.level_cn || '天气平稳';
  if (snow.action_advice && snow.action_advice !== '常规放牧管理') {
    desc += ' · ' + snow.action_advice;
  } else if (cold.cold_wave_risk && cold.cold_wave_risk !== '低') {
    desc += ' · 寒潮' + cold.cold_wave_risk + '风险';
  } else if (drought.level_spi_3 && drought.level_spi_3 !== '正常') {
    desc += ' · ' + drought.level_spi_3;
  }

  const windSpeed = gale.max_wind_speed_mps != null ? gale.max_wind_speed_mps + ' m/s' : '暂无';
  const wet = (snow.max_simulated_snow_depth_cm != null ? snow.max_simulated_snow_depth_cm + ' cm 积雪' : '暂无');
  const d = new Date();
  const clock = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

  return {
    temperature: String(temp),
    description: desc,
    wind: windSpeed,
    precipitation: wet,
    time: d.toISOString().slice(0, 16).replace('T', ' '),
    clock: clock,
    stale: false,
    status: '融天气象平台实时感知',
    source: '融天气象 · 时空融合平台'
  };
}

async function getWeather(county) {
  const regionId = (county && (county.id || county.regionId)) || 'naqu-seni';
  try {
    const disaster = await request('/api/forecast/disaster/' + regionId);
    if (disaster && typeof disaster === 'object' && disaster.forecast_series) {
      return parseDisasterForecast(disaster, county);
    }
  } catch (err) {
    if (err && err.message === '服务暂时没有连上') {
      throw err;
    }
  }
  return normalizeWeather(await request('/api/integrations/open-meteo/now', { latitude: county.latitude, longitude: county.longitude }));
}

async function askQuestion(query, county, history) {
  const regionId = (county && (county.id || county.regionId)) || 'naqu-seni';
  const chatPayload = {
    message: query,
    history: (history || []).slice(-6).map(h => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: h.text || ''
    })),
    context: { region_id: regionId }
  };

  try {
    const rawRes = await new Promise((resolve, reject) => {
      wx.request({
        url: config.baseUrl.replace(/\/$/, '') + '/api/ai/chat',
        data: chatPayload,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        timeout: config.timeout,
        success(res) {
          if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
            return reject(new Error('服务暂时没有连上'));
          }
          if (typeof res.data === 'string' && (res.data.trim().startsWith('<!DOCTYPE') || res.data.includes('<html'))) {
            return reject(new Error('服务暂时没有连上'));
          }
          resolve(res.data);
        },
        fail() { reject(new Error('网络没有连上，请稍后再试')); }
      });
    });

    let answerText = '';
    if (typeof rawRes === 'string') {
      const texts = [];
      const lines = rawRes.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) texts.push(parsed.text);
          } catch (e) {}
        }
      }
      answerText = texts.join('');
    } else if (rawRes && typeof rawRes === 'object' && rawRes.answer) {
      answerText = rawRes.answer;
    }

    if (answerText && answerText.trim()) {
      return {
        text: answerText.trim(),
        source: '融天气象平台 AI 决策助手'
      };
    }
  } catch (err) {
    if (err && err.message === '服务暂时没有连上') {
      throw err;
    }
  }

  const character = /草料|饲草|补饲|储备|救援|暖棚/.test(query) ? 'an' : /草场|牧草|植被/.test(query) ? 'rong' : 'xiang';
  const result = await request('/api/chat/companion', { character, query: '我在' + (county.name || '高原牧区') + '。请用牧民容易理解的短句回答，不要编造实时天气、电话号码或安全时段。我的问题：' + query, history: history || [] }, 'POST');
  if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('暂时没有收到回答');
  return { text: result.answer, source: result.source === 'deepseek_llm' ? '智能建议，请结合当地情况' : '平台知识参考' };
}

module.exports = { getWeather, normalizeWeather, parseDisasterForecast, askQuestion };
