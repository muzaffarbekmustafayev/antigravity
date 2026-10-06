// Rasmiy Google Antigravity Modellari
const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    emoji: '⚡',
    badge: 'YANGI / DEFAULT',
    desc: 'Eng yangi, o\'ta tezkor va aqlli (Asosiy model)',
    supportsEffort: true,
    fiveHourLimit: 250,
  },
  {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    emoji: '🚀',
    badge: 'TEZKOR',
    desc: 'Tez va ko\'p qirrali vazifalar uchun',
    supportsEffort: true,
    fiveHourLimit: 250,
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    emoji: '🔥',
    badge: 'BARQAROR',
    desc: 'Oldingi avlod, yengil skriptlar va buyruqlar',
    supportsEffort: true,
    fiveHourLimit: 300,
  },
  {
    id: 'gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    emoji: '🧠',
    badge: 'PRO CODING',
    desc: 'Murakkab arxitektura va og\'ir dasturlash',
    supportsEffort: true,
    fiveHourLimit: 50,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    emoji: '🤖',
    badge: 'THINKING',
    desc: 'Anthropic Thinking, chuqur tahlil va mantiq',
    supportsEffort: false,
    fiveHourLimit: 50,
  },
  {
    id: 'claude-opus-4-6-thinking',
    label: 'Claude Opus 4.6',
    emoji: '🦾',
    badge: 'OPUS DEEP',
    desc: 'Anthropic eng kuchli fikrlash modeli',
    supportsEffort: false,
    fiveHourLimit: 25,
  },
  {
    id: 'gpt-oss-120b-medium',
    label: 'GPT-OSS 120B',
    emoji: '🟢',
    badge: 'OPEN SOURCE',
    desc: 'Ochiq manbali 120B quvvatli model',
    supportsEffort: false,
    fiveHourLimit: 100,
  },
];

// Ishlash Tezligi / Reasoning Effort Darajalari
const EFFORT_LEVELS = [
  { id: 'low',    label: 'Low (Tezkor)',        emoji: '⚡', desc: 'Minimal fikrlash, tez javob, kam token sarfi' },
  { id: 'medium', label: 'Medium (O\'rtacha)',   emoji: '⚖️', desc: 'Standart balanslashgan tezlik va fikrlash' },
  { id: 'high',   label: 'High (Chuqur tahlil)', emoji: '🧠', desc: 'Maksimal fikrlash, yuqori sifat, chuqur tahlil' },
];

function getModelInfo(modelId) {
  return AVAILABLE_MODELS.find(m => m.id === modelId) || {
    id: modelId,
    label: modelId,
    emoji: '🤖',
    badge: 'CUSTOM',
    desc: 'Maxsus model',
    supportsEffort: false,
    fiveHourLimit: 100
  };
}

function getEffortInfo(effortId) {
  return EFFORT_LEVELS.find(e => e.id === effortId) || {
    id: effortId || 'high',
    label: 'High (Chuqur)',
    emoji: '🧠',
    desc: 'Standart chuqur tahlil'
  };
}

module.exports = {
  AVAILABLE_MODELS,
  EFFORT_LEVELS,
  getModelInfo,
  getEffortInfo
};
