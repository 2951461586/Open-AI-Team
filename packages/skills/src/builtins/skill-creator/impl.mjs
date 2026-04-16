export default async function skillCreator(request) {
  const { name, description, capabilities = [], tags = [], version = '1.0.0' } = request;
  if (!name || !description) {
    return { error: 'name and description are required' };
  }

  const skillId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const capabilityTypes = ['read', 'write', 'execute', 'stream'];
  const validatedCapabilities = capabilities.length > 0
    ? capabilities.filter(c => capabilityTypes.includes(c))
    : ['execute'];

  const manifest = {
    id: skillId,
    name,
    version,
    type: 'skill',
    description,
    entry: './impl.mjs',
    capabilities: validatedCapabilities,
    tags: tags.length > 0 ? tags : generateTags(name, description),
    dependencies: [],
    createdBy: 'skill-creator',
    createdAt: new Date().toISOString(),
    schema: {
      request: { type: 'object', properties: {} },
      response: { type: 'object', properties: {} },
    },
  };

  const implTemplate = `export default async function ${skillId}(request) {
  const { /* parameters */ } = request;

  // TODO: Implement skill logic

  return {
    status: 'success',
    data: {},
    message: 'Skill executed successfully',
    timestamp: new Date().toISOString(),
  };
}

export async function execute(request) {
  return ${skillId}(request);
}
`;

  return {
    skillId,
    manifest,
    implTemplate,
    registrationCommand: `registry.register(${JSON.stringify(manifest, null, 2)}, { rootDir: './skills/${skillId}' })`,
    status: 'created',
    createdAt: new Date().toISOString(),
  };
}

function generateTags(name, description) {
  const nameWords = name.toLowerCase().split(/\s+/);
  const descWords = description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const combined = [...nameWords, ...descWords].slice(0, 5);
  return [...new Set(combined)];
}

export async function execute(request) {
  return skillCreator(request);
}
