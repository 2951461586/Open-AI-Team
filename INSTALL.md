# AI Team 安装指南

## 系统要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18+ | 22.x |
| pnpm | 9.0 | 9.x |
| Docker | 24.0 | 25.x |
| Docker Compose | 2.0 | 2.x |

## 安装方式

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/2951461586/Open-AI-Team.git
cd Open-AI-Team

# 复制环境变量
cp .env.example .env

# 编辑 .env 配置 API Keys
# 至少需要配置一个 LLM provider

# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

访问 http://localhost:19090

---

### 方式二：本地开发

```bash
# 克隆项目
git clone https://github.com/2951461586/Open-AI-Team.git
cd Open-AI-Team

# 安装依赖（需要 pnpm 9.x）
corepack enable
pnpm install

# 复制环境变量
cp .env.example .env

# 编辑 .env 配置 API Keys

# 开发模式启动
pnpm run dev

# 或单独启动 API Server
pnpm run start
```

---

### 方式三：Docker 开发模式

```bash
# 启动开发模式（代码挂载，热更新）
docker compose -f docker-compose.dev.yml up

# 或使用 Makefile
make docker-dev
```

---

## 环境变量配置

编辑 `.env` 文件：

```bash
# LLM Provider（至少配置一个）
OPENAI_API_KEY=sk-...
# 或
DEEPSEEK_API_KEY=sk-...

# 可选配置
PORT=3001
NODE_ENV=development
```

---

## 验证安装

```bash
# 运行冒烟测试
pnpm run smoke:team

# 或测试独立 Agent
pnpm run demo:oss-minimal
```

---

## 常见问题

### Q: docker-compose 启动失败？

```bash
# 检查 Docker 是否运行
docker --version
docker compose --version

# 清理并重启
docker compose down -v
docker compose up -d
```

### Q: pnpm install 失败？

```bash
# 确保使用正确版本的 pnpm
corepack enable
pnpm --version  # 应显示 9.x
```

### Q: 端口被占用？

```bash
# 修改 .env 中的 PORT
PORT=3002

# 或修改 docker-compose.yml 中的端口映射
```

---

## 快速命令参考

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 生产部署 |
| `docker compose -f docker-compose.dev.yml up` | 开发模式 |
| `make docker-start` | Docker 启动 |
| `make docker-stop` | Docker 停止 |
| `pnpm run dev` | 本地开发 |
| `pnpm run smoke:team` | 运行冒烟测试 |

---

## 下一步

- 阅读 [GETTING-STARTED.md](./GETTING-STARTED.md) 快速开始
- 阅读 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解架构
- 阅读 [DOCKER.md](./DOCKER.md) Docker 部署详情
