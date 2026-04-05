# Accio Work — Agent Team Guide (extracted from accio.com)

> Source: https://www.accio.com/work/doc?slug=agent-team-guide
> Extracted: 2026-03-27

---

## Core Architecture

### What is Agent Team?

Multi-Agent collaboration feature — multiple AI Agents form a team and work together in a single group chat.

**Core benefits:**
- **Division of labor** — Agents with different expertise handle their own domains
- **Automatic orchestration** — TL analyzes tasks and decides whether to handle directly or delegate
- **Shared context** — Team members share chat history
- **Task tracking** — Built-in persistent task system

### Roles

| Role | Responsibility | Count |
|------|----------------|-------|
| **Team Lead (TL)** | Analyze tasks, assign work, summarize results, manage members | 1 |
| **Member** | Activated when @mentioned; executes assigned tasks and reports results | Up to 10 |
| **SubAgent** | Background subtask executor, spawned by any Agent | Per-task |

### TL-specific capabilities

| Capability | Description |
|------------|-------------|
| Invite members | Add new Agents to the current team |
| Remove members | Remove Agents from the current team |
| Create Agent | Dynamically create a new specialist Agent at runtime |
| Send message | Send a message directly to a specified Agent and wait for a reply |

---

## Collaboration Mechanics

### Message Flow

**Phase 1: TL Analysis and Decision**

```
User message → TL receives → TL analyzes task
                              ├── Simple question → TL answers directly
                              └── Complex task → TL @Member to assign sub-tasks
```

Members are started **only after the TL's reply and assignment decisions are complete**. This ensures Members see the TL's full analysis when they start.

**Phase 2: Members Execute in Parallel**

```
TL assignment done → @ Members start in parallel
                     ├── Member A handles sub-task A
                     ├── Member B handles sub-task B
                     └── Member C handles sub-task C
                         └── All Members done → Group chat ends
```

### @ Mention Rules

| Action | Behavior |
|--------|----------|
| User sends message (no @) | Message goes to TL by default |
| User @ a Member | That Member is activated directly |
| TL @ a Member | Member activates after TL completes |
| Member @ another Member | Target Member activates |
| Member @ TL | TL executes first; other Members in queue start after TL completes |

### Shared Context

- All messages visible to TL and all Members
- Each Agent only sees **new messages since its last reply** (incremental delta)
- Concurrency reminders injected to prevent duplicate @ of same Agent

---

## Task Management

**Persistent task system** — central to group chat collaboration.

- **Survive across sessions** — Tasks not lost when session ends
- **Shared by the team** — All Agents share one task list
- **State transitions** — Full lifecycle

---

## SubAgent vs Member

| Aspect | Member | SubAgent |
|--------|--------|----------|
| Visibility | In group chat; all messages visible | Not in group chat; separate Session |
| Activation | Activated when @ | Created by parent Agent via tool call |
| Lifecycle | Persists | Ends when task is done |
| Capabilities | Full Agent capabilities | Limited tool set; cannot create sub-tasks |

SubAgent types: **explore** (code search), **bash** (commands), **browser** (web), **general** (inherits parent tools)

---

## Best Practices

### Right-Size the Team

- **2–3 members** — Focused tasks
- **4–5 members** — Full workflows
- **Avoid more than 7** — Coordination cost

### Recommended Configurations

| Scenario | Setup |
|----------|-------|
| Supplier sourcing | TL (Procurement) + Researcher + Analyst |
| Listing optimization | TL (Ops) + SEO + Copywriter + Competitor Analyst |
| Code development | TL (Tech Lead) + Coder + Reviewer |
| Product planning | TL (Product Director) + PM + Data Analyst |

### Use Task System for Complex Work

- Have TL create full task plan first
- Use dependencies to control execution order
- Let Agents update task status

---

## Key Design Principles (distilled)

1. **TL is the orchestrator** — Not a pipeline stage, but the actual decision-maker
2. **Members are real agents** — Each with own session, tools, context
3. **Activation is explicit** — @ mention triggers execution, not a pipeline
4. **Execution is parallel** — Members run simultaneously after TL assigns
5. **Visibility is real-time** — Click member avatar to see progress
6. **SubAgents for isolation** — Background work that doesn't need group visibility
7. **Workspace is sandboxed** — Each team has isolated file scope
8. **Skills extend capabilities** — Account-level or Agent-level
