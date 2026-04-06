function interpolate(text = '', vars = {}) {
  return String(text || '').replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ''));
}

const PROMPTS = [
  {
    name: 'team_task',
    title: 'Team task kickoff',
    description: 'Kick off a structured AI team task.',
    arguments: [
      { name: 'objective', required: true, description: 'Task objective' },
      { name: 'scope', required: false, description: 'Team or project scope' },
      { name: 'constraints', required: false, description: 'Constraints' },
    ],
    template: '你是 AI Team Harness 的任务发起器。\n目标：{objective}\n范围：{scope}\n约束：{constraints}\n请先拆解任务，再给出可执行计划、风险和交付物。',
  },
  {
    name: 'agent_config',
    title: 'Agent configuration',
    description: 'Generate or review agent role configuration.',
    arguments: [
      { name: 'role', required: true, description: 'Role name' },
      { name: 'capabilities', required: false, description: 'Capabilities list' },
      { name: 'personality', required: false, description: 'Personality constraints' },
    ],
    template: '为角色 {role} 生成/审查配置。\n能力：{capabilities}\n人格与行为要求：{personality}\n输出需兼顾运行时约束、工具权限和可观测性。',
  },
  {
    name: 'code_review',
    title: 'Code review',
    description: 'Structured code review prompt.',
    arguments: [
      { name: 'change_summary', required: true, description: 'Summary of code changes' },
      { name: 'focus', required: false, description: 'Review focus' },
      { name: 'risk_level', required: false, description: 'Risk level' },
    ],
    template: '请对以下变更做结构化代码审查。\n变更摘要：{change_summary}\n关注点：{focus}\n风险级别：{risk_level}\n请指出问题、位置、严重性、建议修复方案。',
  },
];

export function createMcpPrompts() {
  return {
    listPrompts() {
      return PROMPTS.map(({ template, ...rest }) => ({ ...rest }));
    },
    getPrompt(name = '', args = {}) {
      const prompt = PROMPTS.find((item) => item.name === name);
      if (!prompt) throw new Error(`prompt_not_found:${name}`);
      const text = interpolate(prompt.template, args || {});
      return {
        description: prompt.description,
        messages: [
          { role: 'user', content: { type: 'text', text } },
        ],
      };
    },
  };
}
