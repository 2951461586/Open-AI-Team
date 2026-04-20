# AI Team 安装指南

## 系统要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18+ | 22.x |
| pnpm | 9.0 | 9.x |
| Docker | 24.0 | 25.x |
| Docker Compose | 2.0 | 2.x |

## 快速部署

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/2951461586/Open-AI-Team.git
cd Open-AI-Team

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 LLM API Key（如 OPENAI_API_KEY）

# 3. 一键部署
make deploy
# 访问 http://localhost:19090
```

### 方式二：Docker Compose

```bash
cp .env.example .env
# 编辑 .env 配置 API Keys

docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 方式三：本地开发

```bash
# 克隆项目
git clone https://github.com/2951461586/Open-AI-Team.git
cd Open-AI-Team

# 安装依赖
corepack enable
pnpm install

# 配置
cp .env.example .env
# 编辑 .env 配置 API Keys

# 启动开发服务
pnpm run dev
```

### 方式四：Docker 开发模式（热重载）

```bash
cp .env.example .env
make docker-dev
# 代码修改会自动重载
```

## 环境变量配置

编辑 `.env` 文件，至少配置一个 LLM Provider：

```bash
# LLM Provider（必填，至少一个）
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...

# 或 Anthropic
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=...

# 或 DeepSeek
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=...

# 服务器配置
PORT=19090
NODE_ENV=production
```

## 验证部署

```bash
# 检查健康状态
curl http://localhost:19090/health

# 运行冒烟测试
pnpm run smoke:team
```

## 常见问题

### Q: Docker 启动失败？

```bash
# 检查 Docker 是否运行
docker --version
docker compose version

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

编辑 `.env`：
```bash
PORT=19091
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `make deploy` | 一键部署 |
| `docker compose up -d` | 启动服务 |
| `docker compose down` | 停止服务 |
| `make docker-logs` | 查看日志 |
| `make docker-dev` | 开发模式（热重载） |
| `pnpm run dev` | 本地开发 |
| `npm test` | 运行测试 |
