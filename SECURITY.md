# Security Policy

## Supported Versions

This repository is currently pre-release. Security fixes are applied to the latest main branch state only unless stated otherwise.

## Reporting a Vulnerability

Please do not open a public issue for suspected security vulnerabilities.

Instead, report privately to the maintainers through the repository security advisory workflow or the designated maintainer contact once published.

When reporting, include:
- affected area
- reproduction steps
- impact assessment
- suggested mitigation if available

## Scope Notes

Particular care is required around:
- host/runtime adapters
- bridge and ingress surfaces
- command execution and tool routing
- credential handling in `.env` and deployment environments
- run report / artifact / memory data leakage
