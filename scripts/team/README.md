# `scripts/team/` 目录说明

## 内容

集中存放 **AI Team 当前仍然有效的 smoke / 合同 / wiring / acceptance 辅助脚本**。

## 当前原则

- `scripts/team/` 只放 **仍在现役主链里有验证价值** 的 team 脚本。
- 默认入口优先走：
  - `scripts/smoke/team-mainline.mjs`
  - `scripts/smoke/team-batch.mjs`
- 公共 schema / fixture 验证当前入口：
  - `scripts/team/team-public-schema-fixtures-smoke.py`
  - `npm run smoke:public-schemas`
- dashboard public-contract 守门入口：
  - `scripts/team/team-dashboard-public-contract-smoke.mjs`
  - `npm run smoke:dashboard-public-contract`
- route-derived fixture 生成入口：
  - `scripts/team/team-generate-route-derived-fixtures.mjs`
  - `npm run fixtures:route-derived`
- fuller real-run published fixture 生成入口：
  - `scripts/team/team-generate-real-run-published-fixtures.mjs`
  - `npm run fixtures:real-run-published`
  - 生成 `fixtures/public-contracts/real-run/fixture-provenance.json`
- provenance 摘要入口：
  - `scripts/team/team-published-fixture-provenance-summary.mjs`
  - `npm run fixtures:real-run-provenance`
- public contract smoke 同时验证：
  - canonical fixtures
  - real-run published fixtures
  - fixture provenance manifest
  - published route catalog fixture
- query route catalog / published read model 示例：
  - `scripts/team/team-query-route-catalog-example.mjs`
  - `scripts/team/team-query-api-client-example.mjs`
- live acceptance 放 `scripts/acceptance/canonical/`。
- 已退役的旧 CloudBase 同步链、P1 baseline 壳、phase1 历史 shell，不再保留在当前主口径。

## 维护规则

- 新的结构性 smoke 优先放 `scripts/team/`。
- 默认入口不要再指向不存在脚本、历史壳、或兼容层假权威。
- 生成物／发布产物／临时报告不进入源码主版本面。
- 非 canonical 的临时实验脚本，如果没有稳定信号价值，不要长期留在这里。
