# Active Team Runtime Inventory (Maintainer-Facing)

> `config/team/` is the **maintainer-facing active runtime inventory / maintainer-facing config authority** for the current repository/runtime line, not the public example/default config surface.

## What lives here

- active role routing inventory
- governance defaults for the current runtime
- canonical-but-live runtime wiring metadata
- compatibility inventories retained for migration or investigation

## Boundary

This directory may remain in-tree during transition, but it should be read as:
- useful for maintainers
- secondary for contributors
- not the first config surface for public forks

For public-safe examples, prefer:
- `../examples/`
- `../examples/README.md`
- `../examples/*.json`

## Locked interpretation

- `roles.json` and `governance.json` are current runtime inventory inputs for the maintained runtime line
- `network-ports.json` is current runtime topology inventory, not a promise that every public fork should ship the same topology
- `network-ports.compat.json` is compatibility / investigation-only inventory
- public example configuration belongs under `config/examples/`
