const DEFAULT_TEMPLATE = [
  '你当前采用的人格模板如下：',
  '- 名称：{{name}}',
  '- 适用 Agent：{{agentName}}',
  '- 语气：{{tone}}',
  '- 风格：{{style}}',
  '- 行为特征：{{traits}}',
  '- 回复长度偏好：{{responseLength}}',
  '- Emoji 使用偏好：{{emojiPreference}}',
  '{{guidanceBlock}}',
].join('\n');

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

export function renderTemplate(template = '', variables = {}) {
  const source = normalizeString(template) || DEFAULT_TEMPLATE;
  return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

export function buildPersonalityPromptSection(personality = {}, context = {}) {
  if (!personality || typeof personality !== 'object') return '';

  const name = normalizeString(personality.name || personality.id || context.personalityId || 'default');
  const tone = normalizeString(personality.tone, '自然');
  const style = normalizeString(personality.style, '清晰');
  const traits = normalizeArray(personality.traits);
  const responseLength = normalizeString(personality.responseLength, 'medium');
  const emojiPreference = normalizeString(personality.emojiPreference, 'auto');
  const guidance = normalizeArray(personality.guidance);

  const variables = {
    agentName: normalizeString(context.agentName || context.role || 'agent'),
    role: normalizeString(context.role || context.agentName || 'agent'),
    personalityId: normalizeString(context.personalityId || personality.id || name),
    name,
    tone,
    style,
    traits: traits.length ? traits.join('、') : '无特别要求',
    responseLength,
    emojiPreference,
    guidanceBlock: guidance.length
      ? ['- 附加行为准则：', ...guidance.map((item) => `  - ${item}`)].join('\n')
      : '- 附加行为准则：无',
  };

  return renderTemplate(personality.promptTemplate, variables).trim();
}

export function mergeRoleAndPersonalityPrompt({
  rolePrompt = '',
  personalityPrompt = '',
  strategy = 'append',
  separator = '\n\n',
} = {}) {
  const normalizedRolePrompt = normalizeString(rolePrompt);
  const normalizedPersonalityPrompt = normalizeString(personalityPrompt);
  const normalizedStrategy = normalizeString(strategy, 'append').toLowerCase();

  if (!normalizedRolePrompt) return normalizedPersonalityPrompt;
  if (!normalizedPersonalityPrompt) return normalizedRolePrompt;

  switch (normalizedStrategy) {
    case 'prepend':
      return `${normalizedPersonalityPrompt}${separator}${normalizedRolePrompt}`;
    case 'replace':
      return normalizedPersonalityPrompt;
    case 'append':
    default:
      return `${normalizedRolePrompt}${separator}${normalizedPersonalityPrompt}`;
  }
}

export function injectPersonalityIntoSystemPrompt({
  systemPrompt = '',
  personality = null,
  context = {},
  strategy = 'append',
} = {}) {
  if (!personality) return normalizeString(systemPrompt);
  const personalityPrompt = buildPersonalityPromptSection(personality, context);
  return mergeRoleAndPersonalityPrompt({ rolePrompt: systemPrompt, personalityPrompt, strategy });
}

export function buildPromptInjectionMetadata({ personality = null, context = {} } = {}) {
  if (!personality) return { enabled: false, personalityId: '', scenario: normalizeString(context.scenario) };
  return {
    enabled: true,
    personalityId: normalizeString(personality.id || context.personalityId || personality.name),
    scenario: normalizeString(context.scenario),
    strategy: normalizeString(personality.mergeStrategy || 'append'),
    templateUsed: normalizeString(personality.promptTemplate) ? 'custom' : 'default',
  };
}
