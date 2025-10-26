# EchoTrace 前端

EchoTrace 智能媒体转录管理系统的前端应用，基于 React 19 + Vite 7 构建。

## 技术栈

- **React 19.1** - 核心 UI 框架
- **React Router 6.28** - 客户端路由
- **Vite 7.1.7** - 构建工具与开发服务器
- **Tailwind CSS** - 样式框架
- **Axios 1.12.2** - HTTP 客户端 + JWT 拦截器
- **Lucide React** - 图标库

## 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### Docker 开发

```bash
# 在项目根目录
docker-compose up frontend

# 访问 http://localhost:8080
```

## 构建

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## 代码规范

```bash
# ESLint 检查
npm run lint

# 自动修复
npm run lint:fix
```

## 项目结构

```
src/
├── components/     # 可复用组件
├── pages/         # 页面组件
├── hooks/         # 自定义 Hooks
├── services/      # API 服务
├── utils/         # 工具函数
└── App.jsx        # 应用入口
```

## 环境变量

- `VITE_API_BASE` - 后端 API 地址（默认: http://localhost:8001/api）

## 相关文档

- [系统架构文档](../docs/ARCHITECTURE.md)
- [项目主 README](../README.md)
