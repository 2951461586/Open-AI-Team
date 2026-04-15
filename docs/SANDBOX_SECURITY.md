# Sandbox Security Guide

## Overview

AI Team Runtime implements a dual-layer sandbox security model:

1. **Application Layer (PathGuard)** - Filesystem access control
2. **Container Layer (Docker)** - OS-level isolation

## Security Layers

### Layer 1: PathGuard (Application Level)

PathGuard enforces filesystem access policies at the application level.

#### Access Tiers

| Tier | Description | Access Level |
|------|-------------|--------------|
| `read` | Read-only access | `.`, `src`, `config` |
| `write` | Read-write access | `artifacts`, `memory`, `desk`, `outputs` |
| `deny` | No access | System paths |
| `temp` | Temporary access | `/tmp` (with limits) |

#### Configuration

```javascript
// sandbox-policy.mjs
{
  mode: 'pathguard',
  workspaceDir: '/path/to/workspace',
  policy: {
    writablePrefixes: ['artifacts', 'memory', 'desk'],
    deniedPaths: ['/etc', '/root', '/var'],
    maxWriteBytes: 65536,
    maxReadBytes: 262144
  }
}
```

### Layer 2: Docker Sandbox (OS Level)

Docker sandbox provides container-level isolation with security profiles.

#### Security Features

- **Capability Dropping**: `--cap-drop ALL`
- **No New Privileges**: `--security-opt no-new-privileges`
- **Read-only Rootfs**: `--read-only`
- **Network Isolation**: `--network none` (default)
- **Resource Limits**: CPU, memory, PIDs

#### Default Security Args

```javascript
const securityArgs = [
  '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges',
  '--read-only',
  '--pids-limit', '32'
];
```

## Security Profiles

### Level 1: Minimal

For untrusted code:

```javascript
{
  mode: 'docker',
  allowNetwork: false,
  allowRead: ['/workspace'],
  allowWrite: ['/workspace/artifacts'],
  maxMemoryMb: 128,
  maxCpuSeconds: 1
}
```

### Level 2: Standard

For general use:

```javascript
{
  mode: 'docker',
  allowNetwork: false,
  allowRead: ['/workspace', '/tmp'],
  allowWrite: ['/workspace/artifacts', '/workspace/memory'],
  maxMemoryMb: 256,
  maxCpuSeconds: 2
}
```

### Level 3: Relaxed

For trusted operations:

```javascript
{
  mode: 'pathguard',
  allowNetwork: true,
  maxMemoryMb: 512,
  maxCpuSeconds: 10
}
```

## Best Practices

1. **Default Deny**: Start with minimal permissions
2. **Least Privilege**: Only grant necessary access
3. **Resource Limits**: Always set CPU and memory limits
4. **Network Isolation**: Disable network unless required
5. **Audit Trail**: Log all sandbox operations

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_MODE` | `auto` | sandbox mode: auto/pathguard/docker |
| `SANDBOX_DOCKER_IMAGE` | `node:22-alpine` | Docker image |
| `SANDBOX_MAX_MEMORY_MB` | `256` | Max memory |
| `SANDBOX_MAX_CPU_SECONDS` | `2` | Max CPU time |
| `SANDBOX_ALLOW_NETWORK` | `false` | Allow network access |

## Docker Security Options

### Seccomp Profile

The default seccomp profile allows only safe syscalls:

```javascript
{
  seccompProfile: 'default',  // or path to custom profile
}
```

### Custom Seccomp Profile

```javascript
{
  seccompProfile: '/path/to/custom-seccomp.json'
}
```

### AppArmor Profile

For enhanced isolation on Linux:

```javascript
{
  apparmorProfile: 'ai-team-sandbox'
}
```

## Troubleshooting

### Container Fails to Start

- Check Docker daemon is running
- Verify image is available
- Check resource limits are valid

### Permission Denied

- Verify workspace directory permissions
- Check PathGuard policy configuration
- Ensure Docker user has access to mounted volumes

### Security Policy Violations

- Review denied path patterns
- Check for path escape attempts (`../`)
- Verify allowlist/denylist configuration
