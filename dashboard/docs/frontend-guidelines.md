# Dashboard Frontend Guidelines

## 1. Task focus is a public UI contract

Use `TaskFocusRef` / `TaskFocusTarget` as the only shared contract for task-focus state.

- `TaskFocusRef` = focus identity only
  - `assignmentId?`
  - `childTaskId?`
- `TaskFocusTarget` = focus identity + UI routing / intent / summary

Do **not** invent ad-hoc variants in panel-local types.

## 2. Read focus fields through `src/lib/task-focus.ts`

Always prefer:

- `focusAssignmentId(source)`
- `focusChildTaskId(source)`
- `pickTaskFocusRef(source)`
- `hasTaskFocus(source)`
- `focusSummaryLabel(target)`
- `withFocusOpenTab(target, openTab)`

Why:

1. keeps focus semantics centralized
2. avoids repeated compat logic across panels
3. reduces accidental protocol words leaking into visible bundle output

## 3. Naming boundary

Keep these meanings separate:

- `focusTarget` / `TaskFocusTarget`: UI navigation + contextual focus
- `assignmentId` / `childTaskId`: task identity fields from runtime/protocol
- `subtaskId`: legacy / fallback source field, normalize at the boundary and do not spread further than necessary

Rule: **normalize at the boundary, consume through task-focus helpers, present through human labels.**

## 4. Visible copy rules

Do not expose internal protocol wording directly in user-facing UI when a human label exists.

Examples:

- prefer `总控` over `TL`
- prefer `当前子任务` over raw id labels
- do not render raw `assignmentId` / `childTaskId` chips unless explicitly debugging
- do not surface `ID：...` in standard dashboard views

## 5. Bundle residue check

Before deploy, run:

```bash
npm run check:bundle
```

Or separately:

```bash
npm run build
npm run scan:bundle
```

Default residue scan blocks these known **user-facing copy** regressions:

- `TL 已给出新的局部规划。`
- `TL 分析`
- `TL 完成分析`
- `TL 做出决策`
- `ID：`

Notes:
- raw protocol field names such as `assignmentId` / `childTaskId` may still exist inside compiled JavaScript as internal transport keys
- the scan is meant to catch leaked visible copy, not legitimate internal object keys used by the app runtime

If a new leakage pattern appears, add it to `scripts/scan-bundle-residue.mjs`.

## 6. Review checklist for new panels / routes

When adding or changing task-focus behavior:

- [ ] use `TaskFocusTarget` instead of panel-local focus shapes
- [ ] normalize protocol payloads once at the boundary
- [ ] use task-focus helpers instead of direct ad-hoc field reads where possible
- [ ] verify visible labels are human wording, not protocol wording
- [ ] run `npm run check:bundle`
- [ ] if deploy path changes, verify online bundle, not only local build artifacts
