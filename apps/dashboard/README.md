# apps/dashboard

This is a placeholder for the future monorepo-managed dashboard application.

Current status:
- the real dashboard still lives at the repository root: `dashboard/`
- no files were moved by this scaffold

When migration begins:
- review Next.js config and env handling first
- update deployment/build scripts that currently assume `cd dashboard`
- move in a dedicated commit after CI and release paths are validated
