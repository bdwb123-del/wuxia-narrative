// 写入配置到 localStorage（仅本机生效，不会提交到 Git）
localStorage.setItem('wuxia_llm_config', JSON.stringify({
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',  // 出于安全考虑，Key 你自己在设置页面粘贴
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 65536,
}));
console.log('配置已写入（不含 Key），刷新页面后在设置里粘贴 Key 即可');
