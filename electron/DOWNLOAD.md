# AI Team 下载与安装

## 直接下载 (exe / zip / dmg)

从 GitHub Releases 下载最新版本：

| 平台 | 安装包 | 便携版 (无需安装) |
|------|--------|-------------------|
| **Windows** | [AI Team-Setup-x.x.x.exe](https://github.com/ai-team/ai-team/releases) | [AI Team-x.x.x-win-portable.zip](https://github.com/ai-team/ai-team/releases) |
| **macOS** | [AI Team-x.x.x.dmg](https://github.com/ai-team/ai-team/releases) | [AI Team-x.x.x-mac.zip](https://github.com/ai-team/ai-team/releases) |
| **Linux** | [AI Team-x.x.x.AppImage](https://github.com/ai-team/ai-team/releases) | [AI Team-x.x.x-linux.tar.gz](https://github.com/ai-team/ai-team/releases) |

## Windows 便携版使用

1. 下载 `.zip` 便携版
2. 解压到任意目录
3. 双击 `AI Team.exe` 直接运行
4. 无需安装，数据保存在程序同级目录

## Windows 安装版

1. 下载 `.exe` 安装包
2. 双击运行安装向导
3. 选择安装目录
4. 创建桌面快捷方式（可选）
5. 完成安装

## 构建命令

```bash
cd electron

# 开发模式
npm run dev

# 构建安装包
npm run build

# 打包 (输出 dist/)
npm run package
```

## 构建输出

```
dist/
├── win-x64/
│   ├── AI Team Setup x.x.x.exe    # NSIS 安装包
│   ├── AI Team x.x.x win-portable.zip  # 便携版
│   └── AI Team x.x.x win.zip      # ZIP 压缩包
├── mac-arm64/
│   ├── AI Team x.x.x.dmg           # DMG 安装包
│   └── AI Team x.x.x mac.zip      # ZIP 压缩包
├── mac-x64/
│   └── ...
└── linux-x64/
    ├── AI Team x.x.x.AppImage      # AppImage
    └── AI Team x.x.x linux.tar.gz  # TAR.GZ 压缩包
```

## 环境要求

- Windows 10/11 (x64)
- macOS 10.15+ (Intel 或 Apple Silicon)
- Linux (x64, glibc 2.17+)
