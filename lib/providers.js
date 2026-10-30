// 上游注册表：Groq / LLM7 / Kilo / NVIDIA
// 新增上游只需在这里加一段

const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq 官方',
    desc: '速度极快，需 API Key，有地区封锁风险',
    base: 'https://api.groq.com/openai/v1',
    keyField: 'groq_key',
    envVar: 'GROQ_API_KEY',
    anonymous: false,
    defaultModel: 'openai/gpt-oss-120b',
    models: {
      'gpt-oss-120b': 'openai/gpt-oss-120b',
      'gpt-oss-20b': 'openai/gpt-oss-20b',
      'gpt-oss': 'openai/gpt-oss-120b',
      qwen: 'qwen/qwen3.8-27b',
    },
  },
  llm7: {
    id: 'llm7',
    label: 'LLM7.io',
    desc: '可匿名（10次/分），配 Key 后 60次/分',
    base: 'https://api.llm7.io/v1',
    keyField: 'llm7_key',
    envVar: 'LLM7_API_KEY',
    anonymous: true,
    placeholderKey: 'unused',
    defaultModel: 'gpt-oss',
    models: {
      'gpt-oss-120b': 'gpt-oss',
      'gpt-oss-20b': 'gpt-oss:20b',
      'gpt-oss': 'gpt-oss',
      qwen: 'qwen3-235b',
      deepseek: 'deepseek-v4-pro',
      glm: 'glm-5.2',
    },
  },
  kilo: {
    id: 'kilo',
    label: 'Kilo Gateway',
    desc: '完全匿名零注册，19+ 个 :free 模型',
    base: 'https://api.kilo.ai/api/gateway',
    keyField: 'kilo_key',
    envVar: 'KILO_API_KEY',
    anonymous: true,
    noAuth: true, // 匿名通道不接受 Bearer 头
    requireFreeSuffix: true, // 免费模型 ID 必须带 :free
    defaultModel: 'kilo-auto/free',
    models: {
      'gpt-oss-120b': 'kilo-auto/free',
      'gpt-oss-20b': 'kilo-auto/free',
      'gpt-oss': 'kilo-auto/free',
      qwen: 'nvidia/nemotron-3-super-120b-a12b:free',
      nemotron: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    },
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    desc: '100+ 开源模型，需 Key，约 40 RPM',
    base: 'https://integrate.api.nvidia.com/v1',
    keyField: 'nvidia_key',
    envVar: 'NVIDIA_API_KEY',
    anonymous: false,
    defaultModel: 'openai/gpt-oss-20b',
    models: {
      'gpt-oss-120b': 'openai/gpt-oss-120b',
      'gpt-oss-20b': 'openai/gpt-oss-20b',
      'gpt-oss': 'openai/gpt-oss-120b',
      qwen: 'qwen/qwen3-235b-a22b',
      deepseek: 'deepseek-ai/deepseek-v4.1-flash',
    },
  },
};

const DEFAULT_ORDER = ['groq', 'llm7', 'kilo', 'nvidia'];

function mapModel(model, p) {
  if (!model) return model;
  if (p.models && p.models[model]) return p.models[model];
  // Kilo 免费档只认 :free 后缀，其他一律交给自动路由
  if (p.requireFreeSuffix && !String(model).endsWith(':free')) return p.defaultModel;
  return model;
}

// 决定发往上游的 Authorization；null 表示完全不带该头
function upstreamAuth(p, cfg, incomingAuth) {
  const key = cfg && cfg[p.keyField];
  if (key) return `Bearer ${key}`;
  if (p.noAuth) return null;
  if (p.anonymous) return `Bearer ${p.placeholderKey || 'unused'}`;
  // 非匿名上游、没配 Key：若网关自身也没设访问密码，则透传客户端 Key
  if (!cfg || !cfg.access_key) return incomingAuth || '';
  return '';
}

function isAvailable(p, cfg) {
  if (cfg && cfg[p.keyField]) return true;
  if (p.anonymous) return true;
  return !(cfg && cfg.access_key); // 透传模式下也可用
}

function providerOrder(cfg, forced) {
  if (forced && PROVIDERS[forced]) return [forced];
  const raw = cfg && cfg.provider_order;
  if (raw) {
    const list = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => PROVIDERS[s]);
    if (list.length) return list;
  }
  return DEFAULT_ORDER.slice();
}

module.exports = {
  PROVIDERS,
  DEFAULT_ORDER,
  mapModel,
  upstreamAuth,
  isAvailable,
  providerOrder,
};
