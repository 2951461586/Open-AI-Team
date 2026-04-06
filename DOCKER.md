# Docker Compose 部署说明

## 生产模式

1. 准备环境变量：

```bash
cp .env.example .env
```

2. 启动：

```bash
make docker-start
```

3. 查看日志：

```bash
make docker-logs
```

4. 停止：

```bash
make docker-stop
```

## 开发模式

开发模式会：
- 挂载当前源码目录到容器内
- 保留独立 `node_modules` volume
- 使用 `node --watch src/index.mjs` 实现热重载

启动：

```bash
make docker-dev
```

或重新构建后启动：

```bash
make docker-dev-build
```

停止：

```bash
make docker-dev-stop
```

## 配置挂载

以下目录/文件会挂载到容器中：

- `./config/team` → `/app/config/team`（只读）
- `./state` → `/app/state`
- `./task_workspaces` → `/app/task_workspaces`
- `./.env` → `/app/.env`（生产 compose 中显式挂载）

因此 `config/team/*.json` 可直接在宿主机编辑并被容器读取。

## 健康检查

容器使用：

- `GET /health`

作为健康检查端点。

## 说明

- `Dockerfile` 使用 Node.js 22 多阶段构建。
- 生产镜像会预构建 `dashboard/` 的静态产物（`dashboard/out`）。
- 根服务仍按当前项目方式使用 `npm start` 启动。
