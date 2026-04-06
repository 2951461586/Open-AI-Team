---
name: sample-skill
description: Example first-class skill for AI Team Harness. Demonstrates OpenClaw-style SKILL.md metadata and runtime extension points.
permissions: restricted
tools:
  - read
  - web_fetch
references:
  - references/guide.md
runtime: tools/runtime.mjs
---

# Sample Skill

Use this skill when the task is about demonstrating the harness skill framework, prompt injection, or runtime tool extension.

## Activation

- Activate when the request explicitly asks for the sample skill or a minimal skill example.
- Prefer this skill over generic behavior when showcasing skill loading, metadata parsing, or prompt/tool injection.

## Behavior

- Add a short system-prompt appendix explaining that this is sample-skill.
- Expose one synthetic runtime tool: `sample.echo`.
- Stay inside restricted tool access.

## Files

- Runtime entry: `tools/runtime.mjs`
- Reference note: `references/guide.md`
