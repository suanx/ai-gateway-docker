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
  pollinations: {
    id: 'pollinations',
    label: 'Pollinations',
    desc: '真匿名，零注册，共享容量，模型轮换',
    base: 'https://gen.pollinations.ai/v1',
    keyField: 'pollinations_key',
    envVar: 'POLLINATIONS_API_KEY',
    anonymous: true,
    noAuth: true, // 目录无需 auth；带 Key 时才发
    defaultModel: 'openai-large',
    models: {
      'gpt-oss-120b': 'openai-large',
      'gpt-oss-20b': 'openai-fast',
      'gpt-oss': 'openai-large',
      qwen: 'qwen-coder',
    },
  },
  aihorde: {
    id: 'aihorde',
    label: 'AI Horde',
    desc: '志愿算力，完全匿名但极慢（数十秒~分钟），仅作最后兜底',
    base: 'https://oai.aihorde.net/v1',
    keyField: 'aihorde_key',
    envVar: 'AIHORDE_API_KEY',
    anonymous: true,
    placeholderKey: '0000000000', // 官方公开匿名 Key，最低队列优先级
    defaultModel: 'koboldcpp/LLaMA2-13B-Tiefighter',
    slow: true, // 标记：降级时排最后，且需更长超时
    models: {
      'gpt-oss-120b': 'koboldcpp/LLaMA2-13B-Tiefighter',
      'gpt-oss-20b': 'koboldcpp/LLaMA2-13B-Tiefighter',
      'gpt-oss': 'koboldcpp/LLaMA2-13B-Tiefighter',
      qwen: 'aphrodite/Qwen2.5-7B-Instruct',
    },
    // oai.aihorde.net 的 OpenAI 代理有若干偏离契约的地方，必须规范化
    // 参考 FreeLLMAPI server/src/providers/aihorde.ts
    normalize: (body) => {
      const b = { ...body };
      // max_tokens < 16 会 422；缺省时给个合理值，避免 worker 跑到自己的上限
      const mt = Number(b.max_tokens);
      b.max_tokens = Number.isFinite(mt) && mt > 0 ? Math.max(16, mt) : 512;
      // stop 必须是数组，字符串会 422
      if (b.stop != null && !Array.isArray(b.stop)) b.stop = [b.stop];
      // 不支持 function/tool calling，直接丢弃，否则整个请求失败
      delete b.tools;
      delete b.tool_choice;
      delete b.parallel_tool_calls;
      delete b.functions;
      delete b.function_call;
      // 队列执行，强制非流式（代理本身也是整段返回）
      b.stream = false;
      return b;
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

// 慢速上游排在最后，避免正常请求被拖慢
const DEFAULT_ORDER = ['groq', 'llm7', 'kilo', 'nvidia', 'pollinations', 'aihorde'];

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

// 上游请求体规范化：不同上游对 OpenAI 契约有各自偏离
function normalizeBody(body, p) {
  if (!body) return body;
  return typeof p.normalize === 'function' ? p.normalize(body) : body;
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
  normalizeBody,
};
