export function createSkillRuntime() {
  return {
    name: 'sample-skill',
    prompt: {
      appendSystemPrompt(context = {}) {
        return [
          '## Sample Skill Runtime',
          `- activeSkill: sample-skill`,
          `- task: ${String(context?.task || context?.objective || '').trim() || 'n/a'}`,
          '- guidance: keep output concise and demonstrative.',
        ].join('\n');
      },
    },
    tools: [
      {
        id: 'sample.echo',
        kind: 'tool',
        note: 'Echo structured sample payload',
        async execute(args = {}) {
          return {
            echoed: true,
            args,
            ts: Date.now(),
          };
        },
      },
    ],
    async onActivate(context = {}) {
      return { ok: true, activated: true, role: context?.role || '' };
    },
    async beforeTool(tool = '', args = {}) {
      return { ok: true, tool, args };
    },
    async afterTool(tool = '', result = {}) {
      return { ok: true, tool, result };
    },
  };
}

export default createSkillRuntime;
