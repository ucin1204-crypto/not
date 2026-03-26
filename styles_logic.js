// ==========================================
// 🌸 styles_logic.js: 界面主题与颜色逻辑配置
// ==========================================

// 🌸 1. 荧光笔与笔记本主题色 (5 种基础色彩)
const COLORS = [
    { name: '蜜桃粉', cls: 'hl-pink', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
    { name: '清新绿', cls: 'hl-green', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
    { name: '天空蓝', cls: 'hl-blue', bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200' },
    { name: '香芋紫', cls: 'hl-purple', bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
    { name: '柠檬黄', cls: 'hl-yellow', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
];

// 🌸 2. 卡片盒 (Anki Deck) 的专属颜色配置
const DECK_COLORS = [
    { bg: 'bg-indigo-400', light: 'bg-indigo-50', text: 'text-indigo-400' },
    { bg: 'bg-rose-400', light: 'bg-rose-50', text: 'text-rose-400' },
    { bg: 'bg-emerald-400', light: 'bg-emerald-50', text: 'text-emerald-400' },
    { bg: 'bg-amber-400', light: 'bg-amber-50', text: 'text-amber-400' },
    { bg: 'bg-sky-400', light: 'bg-sky-50', text: 'text-sky-400' },
    { bg: 'bg-slate-700', light: 'bg-slate-50', text: 'text-slate-700' },
];

// 🌸 3. 编辑器文字颜色下拉菜单配置 (将原先写在 EditorView 里的数组抽离出来)
const TEXT_COLORS = [
    { hex: '#374151', name: '默认黑' },
    { hex: '#ef4444', name: '警示红' },
    { hex: '#3b82f6', name: '深邃蓝' },
    { hex: '#10b981', name: '森林绿' },
    { hex: '#8b5cf6', name: '优雅紫' },
    { hex: '#6b7280', name: '低调灰' },
    { hex: '#f59e0b', name: '琥珀黄' }, 
    { hex: '#ec4899', name: '少女粉' }, 
];