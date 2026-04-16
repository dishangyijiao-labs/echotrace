# 开发规则

编码实现时读取本文件。根据项目技术栈补充具体规则。

---

<!-- 以下为示例结构，根据你的项目替换具体内容 -->

## 常用命令

<!-- 替换为你的项目命令 -->

## 架构说明

<!-- 替换为你的项目架构 -->

## 数据库迁移规则

<!-- 替换为你的 ORM/迁移工具规则 -->

## 测试规则

- **编码实现流程遵循协作规则中的"Spec 驱动 + TDD"方法。** 人先定义 Spec，AI 生成测试骨架，人审查后 AI 实现代码。
- **每个新功能必须包含测试。**

## Git 规范

### 提交消息

遵循 Conventional Commits 规范：

```
<type>(<scope>): <description>

[可选正文]

Co-Authored-By: Claude <noreply@anthropic.com>
```

**类型：** `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`ci`

### 分支与 PR 规则

- **功能分支：** 从 `main` 创建 `feature/<简短描述>`。
- **Squash merge** 到 main 以保持历史整洁。
- **不要 force push 到 `main`。**

## 错误处理

<!-- 替换为你的项目错误处理模式 -->

## 日志规范

<!-- 替换为你的项目日志规范 -->
