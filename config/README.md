# Config Surface Map

> Configuration in this repository is intentionally split into **public-safe example config** and **maintainer-facing active runtime inventory**.

## Final layering

### `config/examples/`
Public-safe example configuration for:
- onboarding external contributors
- public documentation
- forks / independent deployments
- example topology and role layout reference

Use this when you need a **public starting point**.

### `config/team/`
Maintainer-facing active runtime inventory for the **current repository/runtime line**.

This surface may contain:
- active role routing inventory
- governance defaults used by the current runtime
- current deployment-oriented topology metadata
- compatibility/investigation config kept for maintainers

Use this when you are maintaining the current runtime implementation, not when teaching the public product story.

### `config/system.manifest.json`
Top-level manifest describing current primary product / runtime entry linkage.

## One-line rule

- `config/examples/` = **public-safe example authority**
- `config/team/` = **maintainer-facing runtime inventory authority**
- `config/system.manifest.json` = **top-level manifest authority**

## Public/open-source rule

If a new contributor asks “which config should I copy first?”, the answer should be:
1. `config/examples/`
2. only then `config/team/` if they are maintaining the current repository runtime itself
