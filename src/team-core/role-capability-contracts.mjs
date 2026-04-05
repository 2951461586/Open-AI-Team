function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeCapabilityList(capabilities = []) {
  return [...new Set(
    ensureArray(capabilities)
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
  )];
}

export function normalizeExecutionSurfaceList(items = []) {
  return [...new Set(
    ensureArray(items)
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];
}

const BUILTIN_ROLE_CAPABILITY_CONTRACTS = {
  planner: {
    displayName: '规划师',
    capabilities: ['planning', 'decomposition', 'task-design'],
    contractVersion: 'planner.plan.v2',
    outputType: 'team.plan.v2',
    executionSurface: {
      skills: ['file-search', 'clawddocs'],
      tools: ['read', 'web_search', 'web_fetch'],
      mcpServers: [],
    },
  },
  critic: {
    displayName: '审查官',
    capabilities: ['review', 'risk-analysis', 'consistency-check'],
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    executionSurface: {
      skills: ['code-review'],
      tools: ['read', 'web_search', 'web_fetch'],
      mcpServers: [],
    },
  },
  judge: {
    displayName: '裁决官',
    capabilities: ['decision', 'approval', 'escalation'],
    contractVersion: 'judge.decision.v2',
    outputType: 'team.decision.v2',
    executionSurface: {
      skills: [],
      tools: ['read'],
      mcpServers: [],
    },
  },
  executor: {
    displayName: '执行者',
    capabilities: ['execution', 'implementation', 'drafting'],
    contractVersion: 'executor.result.v1',
    outputType: 'team.executor.result.v1',
    executionSurface: {
      skills: ['file-search', 'git-essentials'],
      tools: ['read', 'write', 'edit', 'exec', 'web_search', 'web_fetch'],
      mcpServers: [],
    },
  },
  observer: {
    displayName: '观察员',
    capabilities: ['heartbeat', 'observe', 'node-health'],
    contractVersion: '',
    outputType: '',
    executionSurface: {
      skills: [],
      tools: ['read'],
      mcpServers: [],
    },
  },
  monitor: {
    displayName: '监视员',
    capabilities: ['monitor', 'status-report', 'failover-watch'],
    contractVersion: '',
    outputType: '',
    executionSurface: {
      skills: ['system_resource_monitor'],
      tools: ['read', 'exec'],
      mcpServers: [],
    },
  },
  output: {
    displayName: '输出治理层',
    capabilities: ['visible-output', 'delivery', 'publish-summary', 'output-governance'],
    contractVersion: '',
    outputType: '',
    executionSurface: {
      skills: [],
      tools: ['read'],
      mcpServers: [],
    },
  },
};

export function getRoleCapabilityContract(role = '', roleConfig = {}) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedRole) return null;

  const configured = roleConfig?.roles?.[normalizedRole] || null;
  const builtin = BUILTIN_ROLE_CAPABILITY_CONTRACTS[normalizedRole] || null;
  if (!configured && !builtin) return null;

  const configuredContract = configured?.contract || {};
  const configuredExecutionSurface = configured?.executionSurface || {};
  return {
    role: normalizedRole,
    displayName: ensureString(configured?.displayName || builtin?.displayName || normalizedRole),
    capabilities: normalizeCapabilityList(configured?.capabilities || builtin?.capabilities || []),
    contractVersion: ensureString(configuredContract.version || builtin?.contractVersion || ''),
    outputType: ensureString(configuredContract.outputType || builtin?.outputType || ''),
    executionSurface: {
      skills: normalizeExecutionSurfaceList(configuredExecutionSurface.skills || builtin?.executionSurface?.skills || []),
      tools: normalizeExecutionSurfaceList(configuredExecutionSurface.tools || builtin?.executionSurface?.tools || []),
      mcpServers: normalizeExecutionSurfaceList(configuredExecutionSurface.mcpServers || builtin?.executionSurface?.mcpServers || []),
    },
  };
}

export function getRoleExecutionSurfaceContract(role = '', roleConfig = {}) {
  const contract = getRoleCapabilityContract(role, roleConfig);
  if (!contract) return null;
  return {
    role: contract.role,
    displayName: contract.displayName,
    skills: normalizeExecutionSurfaceList(contract.executionSurface?.skills || []),
    tools: normalizeExecutionSurfaceList(contract.executionSurface?.tools || []),
    mcpServers: normalizeExecutionSurfaceList(contract.executionSurface?.mcpServers || []),
  };
}

export function buildRoleCapabilityContractPrompt(role = '', roleConfig = {}) {
  const contract = getRoleCapabilityContract(role, roleConfig);
  if (!contract) return '';

  const lines = [
    '## 角色能力合同',
    `- role：${contract.role}`,
    `- displayName：${contract.displayName}`,
    `- allowedCapabilities：${contract.capabilities.join('、') || '（未声明）'}`,
  ];

  if (contract.contractVersion) lines.push(`- expectedContractVersion：${contract.contractVersion}`);
  if (contract.outputType) lines.push(`- expectedOutputType：${contract.outputType}`);
  lines.push('- 你只能在上述能力边界内行动；不要替代其他角色做 review / decision / execution 之外的职责。');

  return lines.join('\n');
}

export function buildExecutionSurfacePrompt(role = '', item = {}, roleConfig = {}) {
  const surface = getRoleExecutionSurfaceContract(role, roleConfig);
  if (!surface) return '';
  const requiredSkills = normalizeExecutionSurfaceList(item?.requiredSkills || item?.skillsNeeded || []);
  const requiredTools = normalizeExecutionSurfaceList(item?.requiredTools || item?.toolsNeeded || []);
  const requiredMcpServers = normalizeExecutionSurfaceList(item?.requiredMcpServers || item?.mcpServersNeeded || []);

  const lines = [
    '## Skill / Tool / MCP 执行面',
    `- allowedSkills：${surface.skills.join('、') || '（未声明）'}`,
    `- allowedTools：${surface.tools.join('、') || '（未声明）'}`,
    `- allowedMcpServers：${surface.mcpServers.join('、') || '（未声明）'}`,
    `- requiredSkills：${requiredSkills.join('、') || '（无）'}`,
    `- requiredTools：${requiredTools.join('、') || '（无）'}`,
    `- requiredMcpServers：${requiredMcpServers.join('、') || '（无）'}`,
    '- 如果当前任务声明了 requiredSkills / requiredTools / requiredMcpServers，就把它们视为显式执行合同；不要擅自换成未声明面。',
  ];

  return lines.join('\n');
}

export function validateWorkItemCapabilityContract(item = {}, roleConfig = {}) {
  const role = String(item?.role || '').trim().toLowerCase();
  const contract = getRoleCapabilityContract(role, roleConfig);
  const title = ensureString(item?.title || item?.objective || item?.task || role || 'workItem');

  if (!contract) {
    return {
      ok: false,
      role,
      contract: null,
      requiredCapabilities: [],
      expectedContractVersion: ensureString(item?.expectedContractVersion || ''),
      expectedOutputType: ensureString(item?.expectedOutputType || ''),
      errors: [{
        code: 'unknown_role',
        role,
        title,
        message: `未知角色：${role || '(empty)'}`,
      }],
    };
  }

  const requiredCapabilities = normalizeCapabilityList(
    item?.requiredCapabilities || item?.capabilitiesNeeded || []
  );
  const expectedContractVersion = ensureString(item?.expectedContractVersion || contract.contractVersion || '');
  const expectedOutputType = ensureString(item?.expectedOutputType || contract.outputType || '');
  const errors = [];

  const missingCapabilities = requiredCapabilities.filter((cap) => !contract.capabilities.includes(cap));
  if (missingCapabilities.length > 0) {
    errors.push({
      code: 'role_capability_mismatch',
      role,
      title,
      missingCapabilities,
      allowedCapabilities: contract.capabilities,
      message: `${role} 缺少能力：${missingCapabilities.join('，')}`,
    });
  }

  if (expectedContractVersion && contract.contractVersion && expectedContractVersion !== contract.contractVersion) {
    errors.push({
      code: 'role_contract_version_mismatch',
      role,
      title,
      expectedContractVersion,
      allowedContractVersion: contract.contractVersion,
      message: `${role} 期望合同版本不匹配：${expectedContractVersion} ≠ ${contract.contractVersion}`,
    });
  }

  if (expectedOutputType && contract.outputType && expectedOutputType !== contract.outputType) {
    errors.push({
      code: 'role_output_type_mismatch',
      role,
      title,
      expectedOutputType,
      allowedOutputType: contract.outputType,
      message: `${role} 期望输出类型不匹配：${expectedOutputType} ≠ ${contract.outputType}`,
    });
  }

  return {
    ok: errors.length === 0,
    role,
    contract,
    requiredCapabilities,
    expectedContractVersion,
    expectedOutputType,
    errors,
  };
}

export function validateWorkItemCapabilityContracts(items = [], roleConfig = {}) {
  const details = ensureArray(items).map((item) => validateWorkItemCapabilityContract(item, roleConfig));
  const errors = details.flatMap((detail) => ensureArray(detail?.errors));
  return {
    ok: errors.length === 0,
    error: errors[0]?.code || '',
    errors,
    details,
  };
}

export function validateWorkItemExecutionSurfaceContract(item = {}, roleConfig = {}) {
  const role = String(item?.role || '').trim().toLowerCase();
  const surface = getRoleExecutionSurfaceContract(role, roleConfig);
  const title = ensureString(item?.title || item?.objective || item?.task || role || 'workItem');

  if (!surface) {
    return {
      ok: false,
      role,
      surface: null,
      requiredSkills: [],
      requiredTools: [],
      requiredMcpServers: [],
      errors: [{
        code: 'unknown_role',
        role,
        title,
        message: `未知角色：${role || '(empty)'}`,
      }],
    };
  }

  const requiredSkills = normalizeExecutionSurfaceList(item?.requiredSkills || item?.skillsNeeded || []);
  const requiredTools = normalizeExecutionSurfaceList(item?.requiredTools || item?.toolsNeeded || []);
  const requiredMcpServers = normalizeExecutionSurfaceList(item?.requiredMcpServers || item?.mcpServersNeeded || []);
  const errors = [];

  const missingSkills = requiredSkills.filter((value) => !surface.skills.includes(value));
  if (missingSkills.length > 0) {
    errors.push({
      code: 'role_skill_surface_mismatch',
      role,
      title,
      missingSkills,
      allowedSkills: surface.skills,
      message: `${role} 缺少 skills：${missingSkills.join('，')}`,
    });
  }

  const missingTools = requiredTools.filter((value) => !surface.tools.includes(value));
  if (missingTools.length > 0) {
    errors.push({
      code: 'role_tool_surface_mismatch',
      role,
      title,
      missingTools,
      allowedTools: surface.tools,
      message: `${role} 缺少 tools：${missingTools.join('，')}`,
    });
  }

  const missingMcpServers = requiredMcpServers.filter((value) => !surface.mcpServers.includes(value));
  if (missingMcpServers.length > 0) {
    errors.push({
      code: 'role_mcp_surface_mismatch',
      role,
      title,
      missingMcpServers,
      allowedMcpServers: surface.mcpServers,
      message: `${role} 缺少 MCP servers：${missingMcpServers.join('，')}`,
    });
  }

  return {
    ok: errors.length === 0,
    role,
    surface,
    requiredSkills,
    requiredTools,
    requiredMcpServers,
    errors,
  };
}

export function validateWorkItemExecutionSurfaceContracts(items = [], roleConfig = {}) {
  const details = ensureArray(items).map((item) => validateWorkItemExecutionSurfaceContract(item, roleConfig));
  const errors = details.flatMap((detail) => ensureArray(detail?.errors));
  return {
    ok: errors.length === 0,
    error: errors[0]?.code || '',
    errors,
    details,
  };
}
