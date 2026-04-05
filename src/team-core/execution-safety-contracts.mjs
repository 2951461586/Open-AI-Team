export function buildSearchEvidenceSafetyPrompt({ taskWorkspace = '', taskId = '', childTaskId = '', assignmentId = '' } = {}) {
  const scratchRoot = `/tmp/agent-harness-evidence/${String(childTaskId || assignmentId || taskId || 'task').replace(/[^a-zA-Z0-9_:-]/g, '_')}`;
  return `## 搜索留证安全护栏（强制）
如果你需要用 \`rg / grep / find / fd\` 做大范围搜索或生成“搜索证据”，必须遵守：
- **不要边扫描边把结果写回扫描根里的文件**。
- 尤其当扫描根包含 \`${taskWorkspace}\` 或它的上级目录时，**不要**把输出持续写到 \`${taskWorkspace}/artifacts/...\`。
- 否则会出现“输出文件本身又被扫描命中 → 继续写回 → 递归膨胀”的自吃尾巴问题。

安全做法：
- 先把搜索结果写到扫描根外的临时文件，例如：\`${scratchRoot}\`
- 显式排除这些路径：\`artifacts/**\`、\`.team-completions/**\`、当前输出文件路径
- 搜索完成后，再把**最终整理结果**一次性移动/复制回 task workspace
- 对超大搜索结果做截断/采样，不要无上限落盘

推荐模式：
\`TMP_OUT="$(mktemp ${scratchRoot}.XXXXXX.txt)"\`
\`rg -n --hidden --glob '!artifacts/**' --glob '!.team-completions/**' '关键词' <扫描根> > "$TMP_OUT"\`
\`head -c 1048576 "$TMP_OUT" > <最终证据文件>\`

底线：**输出文件不能位于本次扫描命中的根路径内。**`;
}
