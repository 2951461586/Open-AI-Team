export default async function skillCreator(request) {
  const { name, description, capabilities = [], tags = [] } = request;
  if (!name || !description) {
    return { error: 'name and description are required' };
  }
  return {
    skillId: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    description,
    capabilities,
    tags,
    status: 'created',
    message: `Skill '${name}' created successfully`,
  };
}

export async function execute(request) {
  return skillCreator(request);
}
