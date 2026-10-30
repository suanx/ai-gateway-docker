// 配置持久化：环境变量初始化 → 落盘 config.json → 后台可改并热重载
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const FIELDS = [
  'groq_key',
  'llm7_key',
  'kilo_key',
  'nvidia_key',
  'pollinations_key',
  'aihorde_key',
  'access_key',
  'admin_password',
  'provider_order',
];

function defaultsFromEnv() {
  return {
    groq_key: process.env.GROQ_API_KEY || '',
    llm7_key: process.env.LLM7_API_KEY || '',
    kilo_key: process.env.KILO_API_KEY || '',
    nvidia_key: process.env.NVIDIA_API_KEY || '',
    pollinations_key: process.env.POLLINATIONS_API_KEY || '',
    aihorde_key: process.env.AIHORDE_API_KEY || '',
    access_key: process.env.ACCESS_KEY || '',
    admin_password: process.env.ADMIN_PASSWORD || '',
    provider_order: process.env.PROVIDER_ORDER || 'groq,llm7,kilo,nvidia',
  };
}

let cfg = null;

function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      cfg = { ...defaultsFromEnv(), ...JSON.parse(raw) };
      return cfg;
    }
  } catch (e) {
    console.error('[store] 读取配置失败，回退到环境变量:', e.message);
  }
  cfg = defaultsFromEnv();
  save(cfg);
  return cfg;
}

function save(next) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const clean = {};
    for (const f of FIELDS) clean[f] = (next && next[f]) || '';
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2), 'utf-8');
    cfg = clean;
    return true;
  } catch (e) {
    console.error('[store] 保存配置失败:', e.message);
    return false;
  }
}

function get() {
  if (!cfg) load();
  return cfg;
}

// 后台展示用：真实 Key 只留首尾，中间打码
function masked() {
  const c = get();
  const out = {};
  for (const f of FIELDS) {
    if (f === 'provider_order' || f === 'admin_password') {
      out[f] = c[f];
      continue;
    }
    const v = c[f] || '';
    out[f] = v ? v.slice(0, 6) + '••••' + v.slice(-4) : '';
    out[f + '_set'] = !!v;
  }
  return out;
}

// 保存时：前端若回传打码值（含 •），视为「不改」
function mergeUpdate(input) {
  const c = { ...get() };
  for (const f of FIELDS) {
    if (typeof input[f] !== 'string') continue;
    if (input[f].includes('••••')) continue; // 打码占位，跳过
    c[f] = input[f].trim();
  }
  return c;
}

// 简易会话：登录成功后发 token，存内存
const sessions = new Set();
function createSession() {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.add(t);
  return t;
}
function validSession(t) {
  return !!t && sessions.has(t);
}
function destroySession(t) {
  sessions.delete(t);
}

module.exports = {
  CONFIG_FILE,
  DATA_DIR,
  FIELDS,
  load,
  save,
  get,
  masked,
  mergeUpdate,
  createSession,
  validSession,
  destroySession,
};
