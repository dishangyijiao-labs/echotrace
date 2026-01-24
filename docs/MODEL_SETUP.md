# 模型管理与首次启动体验

## 问题背景

**Q: 用户安装 DMG 后能直接使用吗？**

**A: 不能。** 用户首次使用时需要下载 Whisper 模型文件。

### 原因

1. **Whisper 模型文件较大**
   - Tiny: 75 MB
   - **Base: 142 MB（推荐）**
   - Small: 466 MB  
   - Medium: 1.5 GB
   - Large: 2.9 GB

2. **不适合打包到 DMG**
   - DMG 体积会非常大（最小也要 150+ MB）
   - 用户可能需要不同的模型（tiny 用于测试，large 用于高精度）
   - 模型更新频繁

3. **faster-whisper 默认行为**
   - 首次调用 `WhisperModel("base")` 时自动从 HuggingFace 下载
   - 缓存路径：`~/.cache/huggingface/hub/`
   - 无下载进度提示，用户体验差

---

## 解决方案

### ✅ 实现内容

#### 1. **首次启动引导界面**

新用户首次打开应用时会看到：

```
┌─────────────────────────────────────────┐
│     欢迎使用 EchoTrace                   │
│  首次使用需要下载 Whisper 转录模型       │
├─────────────────────────────────────────┤
│  推荐：下载 Base 模型                    │
│  Base 模型（142MB）提供了速度和          │
│  精度的最佳平衡，适合大多数使用场景。     │
│                                          │
│  [下载 Base 模型 (142 MB)]               │
├─────────────────────────────────────────┤
│  所有可用模型：                          │
│  ✓ tiny   - 最快，精度较低（仅测试用）    │
│  ○ base   - 推荐：速度快，精度适中        │
│  ○ small  - 较好的精度，速度较慢          │
│  ○ medium - 高精度，需要较长时间          │
│  ○ large  - 最高精度，处理很慢            │
└─────────────────────────────────────────┘
```

#### 2. **模型管理 API**

新增 API 端点：

```bash
# 列出所有模型及下载状态
GET /models

# 获取单个模型状态
GET /models/{model_name}

# 下载模型
POST /models/{model_name}/download
```

示例响应：

```json
{
  "models": [
    {
      "name": "base",
      "size_mb": 142,
      "params": "74M",
      "speed": "~16x",
      "downloaded": true,
      "cache_path": "~/.cache/huggingface/hub/models--Systran--faster-whisper-base"
    }
  ]
}
```

#### 3. **自动检测与引导**

应用启动流程：

```
启动 App
  ↓
检查 base 模型是否存在
  ↓
已下载 → 直接进入主界面
  ↓
未下载 → 显示模型设置界面 → 下载完成 → 进入主界面
```

---

## 用户体验流程

### 场景 1：全新用户首次使用

1. **安装 DMG** → 双击打开 EchoTrace
2. **首次启动** → 看到"欢迎使用"界面
3. **点击下载 Base 模型** → 显示下载进度（142 MB）
4. **下载完成** → 自动进入主界面
5. **开始转录** → 直接使用，无需等待

### 场景 2：需要更高精度模型

1. 打开设置 → 模型管理
2. 下载 Medium 或 Large 模型
3. 创建任务时选择模型："medium" 或 "large-v3"

### 场景 3：离线环境

**问题**：如果用户电脑无网络怎么办？

**解决方案**：

1. **在线电脑预下载**
   ```bash
   # 在有网络的电脑上运行
   python -m apps.core.pipeline.model_manager base
   ```

2. **拷贝缓存目录**
   ```bash
   # 拷贝整个 HuggingFace 缓存
   cp -r ~/.cache/huggingface /path/to/usb/

   # 在离线电脑上恢复
   cp -r /path/to/usb/huggingface ~/.cache/
   ```

3. **离线安装包（未来）**
   - 提供包含 Base 模型的 DMG（~180 MB）
   - 首次启动时检测并自动安装到缓存目录

---

## 技术实现

### 1. 模型管理模块

**文件**：`apps/core/pipeline/model_manager.py`

```python
# 检查模型是否已下载
is_model_downloaded("base")  # → True/False

# 获取模型信息
get_model_info("base")  # → {size_mb, downloaded, cache_path, ...}

# 下载模型（阻塞调用）
download_model("base", device="cpu", progress_callback=print)

# 确保模型可用（自动下载）
ensure_model_available("base")
```

### 2. React 组件

**文件**：`apps/desktop/src/components/ModelSetup.jsx`

- 自动检测模型状态
- 显示下载进度
- 推荐 Base 模型
- 支持切换其他模型
- 下载完成后自动跳转

### 3. App.jsx 集成

```jsx
function App() {
  const [modelReady, setModelReady] = useState(null);

  // 检查 base 模型是否存在
  useEffect(() => {
    checkModelStatus();
  }, []);

  if (!modelReady) {
    return <ModelSetup onComplete={() => setModelReady(true)} />;
  }

  return <MainApp />; // 正常界面
}
```

---

## 未来改进

### 短期（v0.2）

- [ ] **后台异步下载** - 不阻塞 UI
- [ ] **下载进度条** - 显示百分比和剩余时间
- [ ] **断点续传** - 支持网络中断后继续下载
- [ ] **模型验证** - 下载后校验 SHA256

### 中期（v0.3）

- [ ] **离线安装包** - 提供包含 Base 模型的 DMG
- [ ] **智能模型推荐** - 根据硬件配置推荐合适模型
- [ ] **模型自动更新** - 检测并下载新版本模型
- [ ] **模型管理界面** - 查看、删除、切换模型

### 长期（v1.0）

- [ ] **自定义模型** - 支持加载用户训练的模型
- [ ] **模型服务器** - 企业内网部署模型缓存服务器
- [ ] **增量更新** - 只下载模型差异部分

---

## FAQ

### Q1: 为什么不把模型打包到 DMG？

**A**: 
1. DMG 体积太大（最小 180 MB）
2. 用户可能需要不同模型（tiny/base/large）
3. 模型更新频繁，每次都要重新下载整个 DMG

### Q2: 下载模型需要多久？

**A**: 取决于网络速度

| 模型   | 大小    | 100Mbps 网速 | 10Mbps 网速 |
|--------|---------|--------------|-------------|
| Tiny   | 75 MB   | 6 秒         | 60 秒       |
| Base   | 142 MB  | 11 秒        | 114 秒      |
| Small  | 466 MB  | 37 秒        | 6 分钟      |
| Medium | 1.5 GB  | 2 分钟       | 20 分钟     |
| Large  | 2.9 GB  | 4 分钟       | 39 分钟     |

### Q3: 模型存储在哪里？占多少空间？

**A**: 
- **路径**: `~/.cache/huggingface/hub/`
- **空间**: 根据下载的模型数量
  - 仅 Base: 142 MB
  - Base + Medium: 1.6 GB
  - 全部模型: 约 5 GB

### Q4: 可以删除模型吗？

**A**: 可以手动删除缓存目录，或等待"模型管理"功能上线。

```bash
# 查看所有模型
ls -lh ~/.cache/huggingface/hub/

# 删除特定模型
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-base
```

### Q5: 离线环境如何使用？

**A**: 
1. 在有网络的电脑下载模型
2. 拷贝 `~/.cache/huggingface/` 到离线电脑
3. 离线电脑可直接使用

---

## 开发者注意事项

### 测试首次启动流程

```bash
# 1. 清除模型缓存
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-*

# 2. 重启应用
npm run dev

# 3. 应该看到模型设置界面
```

### 手动下载模型

```bash
# 使用 Python 脚本
cd apps/core
python -m pipeline.model_manager base

# 使用 API
curl -X POST http://127.0.0.1:8787/models/base/download
```

### 检查模型状态

```bash
# API 方式
curl http://127.0.0.1:8787/models

# Python 方式
python -c "from pipeline.model_manager import get_model_info; print(get_model_info('base'))"
```

---

## 总结

✅ **用户无需手动操作** - 首次启动自动引导  
✅ **体验流畅** - 一键下载，自动完成  
✅ **灵活选择** - 支持多种模型  
✅ **离线友好** - 可预下载模型  
✅ **占用合理** - 仅下载需要的模型（142 MB 起）

**首次使用时间**：下载 Base 模型 ≈ 10-120 秒（取决于网速）
