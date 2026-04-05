# Public Fixtures

> Public-safe sample payloads, route fixtures, and contract examples.

## What lives here

This directory contains canonical sample data used for:
- public contract validation
- schema/read-model examples
- release artifact staging
- contributor-facing fixture inspection

Primary current bucket:
- `public-contracts/`

## Boundary

`fixtures/` is part of the **public sample / validation surface**, but it is **not** the primary source authority for the product.

Treat fixtures as:
- examples of current contracts
- contributor-friendly sample data
- derived validation material

Do **not** treat fixtures as:
- runtime deployment authority
- live state
- the source of truth when current docs/schemas disagree

## Prefer these authorities first

- `../README.md`
- `../ARCHITECTURE.md`
- `../docs/architecture/`
- `../schemas/`

## One-line rule

Fixtures explain and validate the public surface; they do not replace the public surface authority.
