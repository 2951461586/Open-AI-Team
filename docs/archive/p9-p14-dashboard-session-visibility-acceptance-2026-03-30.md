# P9-P14 Dashboard Session Visibility Acceptance（2026-03-30）

## 范围

本轮覆盖 `AI Team Dashboard` 在 **session capability / fallback semantics / node routing visibility** 上的产品化收口与验收：

- P9：右侧详情入口继续补齐会话能力可见性
- P10：现网页面与公网 API 初轮验收
- P11：发布传播 / chunk 验证方法纠偏
- P12：板卡层会话能力可见性复核
- P13：右侧详情页稳定验收
- P14：形成极简 acceptance 文档，作为后续回查基线

---

## 最终结论

| 项 | 结论 |
|---|---|
| 板卡层 session 可见性 | **PASS** |
| 查询合同返回 session 字段 | **PASS** |
| follow-up fallback 语义 | **PASS** |
| 线上 deploy 生效性 | **PASS** |
| 右侧详情页 UI 存在性 | **PASS（代码与页面路径已具备）** |
| 右侧详情页 headless 稳定抓证 | **PARTIAL** |

一句话：

> 当前 `AI Team` 已把 **一次性会话 / 持久会话边界、节点落点、降级原因、TL 接管语义** 正式产品化到 dashboard 主路径；剩余不足主要在 **headless 浏览器对右侧详情 DOM 的稳定抓证能力**，而不是产品代码或线上部署本身。

---

## 已确认事实

### 1．查询合同 / 运行态

以下查询面已返回 session 能力字段：

- `/state/team/dashboard`
- `/state/team/board`
- `/state/team/summary`
- `/state/team/workbench`

关键字段：

- `sessionMode`
- `sessionPersistent`
- `sessionFallbackReason`
- `requestedNode`
- `actualNode`
- `degradedReason`

### 2．产品语义

当前平台下成员 `subagent mode=session` 仍受限：

- `thread=true is unavailable because no channel plugin registered subagent_spawning hooks.`

因此产品当前真实语义为：

- 能升 persistent 时：显示持久会话
- 不能升时：显示一次性会话
- follow-up 命中 run-mode / 空回复 / 不可见会话时：TL 接管并返回真实可读答复

### 3．部署 / 发布

source-first 已确认：

- `dashboard/out/index.html` 指向：`/_next/static/chunks/app/page-d01f3b24bfd2cf69.js`
- `/srv/board.liziai.cloud/index.html` 指向：`/_next/static/chunks/app/page-d01f3b24bfd2cf69.js`
- 公网 `board.liziai.cloud` 返回新的 `Last-Modified`
- 新旧 chunk 资源均可直接 `200` 访问

结论：

- 本轮 deploy 已真实生效
- 先前把“首页 HTML 正则未抓到 page chunk”当作部署异常的判断应视为**验证方法缺陷**，不再作为主结论

---

## 页面验收结果

### A．板卡层

现网页面已稳定可见：

- `一次性会话`
- 节点名：`node-a / node-b / node-c`
- `已降级`
- `route member unavailable`
- `可交付`

这说明 session 可见性已进入主板卡产品路径。

### B．右侧详情层

代码路径已明确包含：

- `RightPanel.tsx`：标题 chips 显示 `路由 / 会话`
- `TaskChatPanel.tsx`：显示 `路由 / 会话 / 节点 / 降级原因`
- `TaskFilesPanel.tsx`：显示 `路由 / 会话 / 节点`

headless 浏览器在 P13 中对“点开右侧详情并稳定抓到 DOM”仍非 100% 稳定，因此当前对详情层给出：

- **产品存在性：PASS**
- **自动化抓证稳定性：PARTIAL**

---

## 建议后续基线

如果后续还要继续收边，优先级如下：

1. 提升右侧详情页在 headless 浏览器下的稳定可抓取性
2. 追加一条专门针对 RightPanel 的页面级 smoke
3. 若平台未来支持 thread-bound persistent session，再把“会话能力探测 → 自动升级”切到真正 persistent 路径

---

## 不应再重复争论的点

- 不应再把“首页 HTML 正则没抓到 chunk”直接等同于 deploy 未生效
- 不应再把 run-mode follow-up 的 TL 接管视为假成功；当前这是**显式、正确、可交付**的 fallback 语义
- 不应再把 session 能力理解成纯后端 metadata；当前它已经进入 dashboard 主产品路径


---

## P15-P16 后续收口补记

### P15．右侧详情可测性增强

已新增 **URL 深链打开右侧详情** 能力：

- `?view=kanban&taskId=...&detailTab=chat`
- `?view=kanban&taskId=...&detailTab=files`

同时补了稳定选择锚点，并修正了一个真实根因：

- URL 想强制打开右侧详情时，不能再被 `localStorage` 中保存的 `rightPanelCollapsed=1` 覆盖。

### P16．页面级 deep-link smoke

新增 canonical 验收脚本：

- `scripts/acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs`
- npm alias：`npm run acceptance:dashboard-rightpanel-deeplink`

实测结果：**PASS**。

当前主断言：

- 已选中现场任务
- 右侧详情已打开（存在 `关闭详情`）
- 已进入对话子页
- 快捷动作可见（`继续推进 / 请求执行 / 请求复审`）
- 输入框已就绪

### 结论更新

右侧详情页当前不再只是“代码存在但 headless 难抓证”；
在 P15-P16 后，更准确的口径应更新为：

> **右侧详情页已经具备稳定 deep-link 可测性，并且 canonical 页面级 smoke 已通过。**
