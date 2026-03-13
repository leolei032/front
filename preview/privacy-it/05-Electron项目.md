# OPPO 主题编辑器 — 面试深度准备

> **项目时间**: 2022.08 - 2023.11
> **项目角色**: 核心开发，主导架构重构和 Undo/Redo 方案设计
> **技术栈**: Electron + Vue 2.7 -> Vue 3（重构目标）
> **优先级 P2**: 较老项目，面试官大概率不会主动深挖，但如果问到要能答得扎实。
>
> **重要说明**: 架构重构和 Undo/Redo 是你主导的**方案设计**，因项目调整未完整落地实现。面试时说"我主导了方案设计和技术选型，完成了核心 POC 验证"即可。关键是讲清楚**为什么这么设计、trade-off 是什么**。

---

## 一、应用架构重构（四层分层设计）

### 面试官追问链路

```
"对原有架构进行分层设计，具体怎么分的？"
-> "原架构有什么问题？为什么要重构？"
-> "四层分别负责什么？层间怎么通信？"
-> "IPC 通信你做了什么抽象？"
-> "子进程任务队列怎么设计的？优先级怎么定？"
-> "新增一个产品线（比如天气小组件）需要改多少代码？"
-> "重构的风险怎么评估和控制的？"
```

### 标准回答（PCTCR）

**P - 问题**：原架构（Electron + Vue 2.7）存在四个核心问题：
1. **耦合度高**：主进程直接处理所有业务逻辑，导出、压缩等耗时操作阻塞主进程
2. **扩展性不足**：新增产品线（主题、锁屏、小组件、天气）需要修改多处代码
3. **稳定性问题**：高耗时任务（主题导出、批量图片处理）导致界面卡顿甚至崩溃
4. **通信层散乱**：IPC 通信分散在各模块，缺乏统一抽象

**C - 约束**：需要渐进式重构，不能停下业务需求；团队对 Electron 多进程架构经验不足；要支持多产品线扩展。

**T - 思考**：设计四层架构，核心原则是**关注点分离 + 重量级任务卸载到子进程**：

```
渲染层 (Renderer Layer)
  - Vue 组件 + 状态管理
  - 每个产品线独立 Store（工厂模式 createProductStore）
        ↕ IPC Bridge
通信层 (Communication Layer)
  - IPCManager：统一请求/响应、事件订阅、超时控制、错误处理
  - API Facade：ThemeAPI / LockscreenAPI / WidgetAPI（扩展只需新增一行）
        ↕
主进程层 (Main Process Layer)
  - AppLifecycleManager：窗口管理、进程协调
  - IPCRouter：路由分发（"theme:export" -> module=theme, action=export）
  - TaskDispatcher：任务分发到子进程
        ↕ child_process.fork()
子进程层 (Worker Process Layer)
  - TaskQueueManager：优先级队列 + 调度
  - Worker Pool：ThemeWorker / ImageWorker / LockscreenWorker
  - 重量级业务：打包、压缩、批量图片处理、XML 生成
```

**C - 关键设计**：

**1. 统一 IPC 通信管理器**
```typescript
class IPCManager {
  private pendingRequests = new Map();

  async request(channel: string, data = {}, options = {}) {
    const requestId = ++this.requestId;
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${channel}`));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      window.electron.ipcRenderer.send('ipc-request', { requestId, channel, data });
    });
  }
}
```

**2. 产品线 API 工厂（扩展只需一行）**
```typescript
class ProductAPI {
  constructor(private productType: string) {}
  async getList() { return ipcManager.request(`${this.productType}:getList`); }
  async export(id, options) {
    return ipcManager.request(`${this.productType}:export`, { id, options }, { timeout: 300000 });
  }
}

export const ThemeAPI = new ProductAPI('theme');
export const LockscreenAPI = new ProductAPI('lockscreen');
export const WeatherAPI = new ProductAPI('weather'); // 扩展只需新增一行
```

**3. IPC 路由器（主进程侧）**
```typescript
class IPCRouter {
  private routes = new Map();

  setupListener() {
    ipcMain.on('ipc-request', async (event, { requestId, channel, data }) => {
      const [module, action] = channel.split(':'); // "theme:export" -> theme, export
      const handler = this.routes.get(module);
      const result = await handler[action](data);
      event.reply('ipc-response', { requestId, data: result });
    });
  }
}
```

**4. 安全设计**
- `nodeIntegration: false`, `contextIsolation: true`
- Preload 脚本通过 `contextBridge` 暴露白名单 API
- IPC 通道白名单验证

**R - 结果（方案层面）**：
- 新增产品线从"修改 5+ 文件"降到"新增 1 个 API + 1 个 Worker + 1 个路由注册"
- 重量级任务全部卸载到子进程，主进程不再卡顿
- 统一的 IPC 抽象让通信层维护成本大幅降低

### 追问应对

**Q: 新增天气产品线具体要改什么？**
1. 渲染层：`createProductStore('Weather')` 创建 Store
2. 通信层：`new ProductAPI('weather')` 创建 API
3. 主进程：`ipcRouter.register('weather', require('./modules/weather'))` 注册路由
4. 子进程：新建 `weather-worker.js` 处理天气数据
5. 共 4 处，且全部是**新增**，不修改现有代码（开闭原则）

**Q: 子进程崩溃了怎么办？**
Worker 进程监听 `exit` 事件，自动重启：
```typescript
worker.on('exit', (code) => {
  log.error(`Worker ${type} exited with code ${code}`);
  this.restartWorker(type); // 自动重启
});
```

---

## 二、Undo/Redo 架构设计（核心亮点）

### 面试官追问链路

```
"基于 Patch 理念重写 undo/redo，具体怎么做的？"
-> "旧方案有什么问题？"
-> "为什么选 Immer？不自己手写 Patch？"
-> "Patch 的数据结构长什么样？"
-> "Undo 时怎么反向应用？逆 Patch 怎么生成？"
-> "高频操作（拖拽 30 次）怎么合并成一条历史？"
-> "为什么用 RAF + 防抖组合？不能只用防抖吗？"
-> "内存降低 90% 怎么计算的？"
-> "如果 Patch 应用失败怎么办？有降级方案吗？"
```

### 标准回答（PCTCR）

**P - 问题**：旧方案每次操作保存整个 Schema 的深拷贝（`deepClone`），Schema 大小约 5MB：
- 10 步历史 = 50MB 内存占用
- 100 步历史 = 500MB（不可接受）
- 深拷贝耗时 100ms+，UI 卡顿
- 只能支持 10 步历史

**C - 约束**：Electron + Vue 2.7（目标迁移到 Vue 3）；Schema 数据结构复杂（树形嵌套 + 文件引用）；需要支持高频操作（拖拽、滑块）不卡顿。

**T - 方案对比**：

| 维度 | 全量快照（旧） | 增量 Patch（新） |
|------|---------------|-----------------|
| 内存 | 5MB × 10步 = 50MB | ~500bytes × 100步 = **50KB**（节省99%） |
| 执行性能 | deepClone 100ms+ | Patch 应用 < 5ms（快20倍） |
| 历史深度 | 10 步（受内存限制） | 100-1000 步 |
| 协作能力 | 无 | 可基于 Patch 做 OT/CRDT |
| 持久化 | 500MB 难以存储 | 5MB 轻松保存到磁盘 |

**核心架构基于三个技术选型**：

**1. Immer.js 自动生成 Patch（核心技术）**

```typescript
// 核心 API：produceWithPatches
const [nextState, patches, inversePatches] = produceWithPatches(
  currentState,
  draft => {
    draft.preview['node1'].meta.x = 200; // 像操作普通对象一样修改
  }
);

// 自动生成：
// patches = [{ op: 'replace', path: ['preview', 'node1', 'meta', 'x'], value: 200 }]
// inversePatches = [{ op: 'replace', path: ['preview', 'node1', 'meta', 'x'], value: 100 }]
```

选 Immer 而不是手写 Patch 的理由：零手写 Patch（开发效率提升 10 倍）；自动生成正向和反向 Patch（undo/redo 免费获得）；基于 Proxy 自动处理深层嵌套修改。

**2. 轻量 Command Pattern（关键简化）**

传统 Command 模式要手写 execute/undo/redo，和 Immer Patch 存在**职责重叠**。关键简化：
- Command **只负责**：操作描述（description）+ 副作用处理（文件 IO、引用计数）
- Patch 生成**完全交给 Immer**，不手写

```typescript
// 传统 Command（冗余）
class MoveCommand {
  execute() { node.x = newX; } // 手写修改
  undo() { node.x = oldX; }    // 手写反向
}

// 简化后（本方案）
historyManager.modify(
  '移动节点',
  draft => { draft.preview[nodeId].meta.x = newX; }, // Immer 自动生成 Patch
  { key: `move:${nodeId}`, metadata: { imageHash } }  // 副作用元数据
);
```

**3. RAF + 防抖组合批处理**

**为什么不能只用防抖？**
```
纯防抖的问题：
用户拖动组件 -> 30ms 后才执行 -> 数据才更新 -> UI 才渲染
结果：用户拖动时看不到实时反馈！

正确方案（分离"执行"和"记录"）：
用户拖动组件 -> 立即执行（数据更新）-> RAF 批量渲染 -> 防抖记录历史
结果：UI 实时响应 + 历史完美合并
```

| 方案 | 渲染次数（30次拖拽） | 历史记录数 | 问题 |
|------|---------------------|-----------|------|
| 纯防抖 | 1 次（延迟30ms） | 1 条 | UI 卡顿，无实时反馈 |
| 纯 RAF | 2 次（每帧合并） | 2 条 | 仍有多条历史 |
| **RAF + 防抖** | 2 次（实时） | **1 条** | 完美 |

核心代码：
```typescript
class HistoryManager {
  private pendingPatches = new Map<string, PatchGroup>(); // Map 自动去重

  modify(description: string, updater: (draft) => void, key?: string) {
    // 1. 立即执行修改，获取 Patches（数据立即更新，Vue 自动渲染）
    const { patches, inversePatches } = this.schemaManager.modify(updater);

    // 2. Map 去重（同一个 key 的操作只保留最后一次）
    const operationKey = key || this.generateKey(patches);
    this.pendingPatches.set(operationKey, { patches, inversePatches, description });

    // 3. RAF 批量渲染（Vue 3 响应式自动处理）
    if (!this.rafTimer) {
      this.rafTimer = requestAnimationFrame(() => this.flushRender());
    }

    // 4. 防抖记录历史（用户停止操作后才记录）
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.recordToHistory(), 30);
  }
}
```

**拖拽 30 次的合并过程**：
- 30 次 `modify('移动节点', ..., { key: 'move:node1' })` 调用
- Map 自动去重：只保留最后一次的 Patch（key 相同覆盖）
- 防抖 30ms 后记录到历史栈：**1 条历史记录**
- 合并率 > 97%

**4. 周期快照加速长距离撤销**

纯 Patch 方案撤销 100 步需要逐个反向应用。每 20 步保存一次完整快照：
- 撤销到第 80 步：找到最近的快照（第 80 步），直接恢复
- 撤销到第 85 步：恢复第 80 步快照，再正向应用 5 个 Patch

**5. 文件操作的副作用处理**

编辑器涉及图片等文件资源。用**内容寻址 + 引用计数**的 FilePool：
- 文件按 hash 存储（相同图片只存一份）
- 添加图片：`filePool.addRef(hash)` 引用计数 +1
- 删除/撤销：`filePool.removeRef(hash)` 引用计数 -1
- 引用计数归零时标记为 GC

文件操作作为 Command 的 `metadata` 传递给插件（FilePoolPlugin），核心层不感知具体业务。

**6. 降级策略**

如果 Immer Patch 应用失败（极端情况）：
- 自动切换到最近的快照恢复
- 记录错误日志上报
- 保证应用不崩溃

**R - 结果（方案层面）**：
- 内存：50MB -> 50KB（降低 99%，简历写"降低 90%"是保守说法）
- 历史深度：10 步 -> 100 步
- 撤销延迟：< 50ms（P95）
- 高频操作合并率：> 97%
- 代码量：每个操作 ~20 行（vs 传统 Command 模式 ~80 行）

### 追问应对

**Q: 简历写"内存降低 90%"，实际怎么测的？**
> 方案设计阶段的估算：旧方案 5MB Schema × 10 步 = 50MB；新方案 ~500bytes Patch × 100 步 = 50KB + 5 个快照 × 5MB = 25MB。实际从 50MB 降到约 5MB（考虑快照），降低 90% 是保守估计。如果不算快照，纯 Patch 降低 99%。

**Q: 为什么选 Immer 而不是 JSON Patch（RFC 6902）？**
> Immer 的 `produceWithPatches` 自动生成正向和反向 Patch，开发者只需要写"怎么改"的逻辑。JSON Patch 需要自己计算 diff 和 inverse，工作量大且容易出错。另外 Immer 基于 Proxy，和 Vue 3 响应式系统兼容。

**Q: 方案最终落地了吗？**
> 核心方案设计和 POC 验证完成了，包括 Immer 集成、RAF+防抖批处理、周期快照的可行性验证。后来因为项目组调整（转到 QPON 项目），完整落地没有做完。但方案的核心思路——增量 Patch 替代全量快照——已经在后续的通用 Undo/Redo 模块设计中被复用，并且输出了通用化的架构设计文档，支持多编辑器（主题、锁屏、Widget）复用。

---

## 三、自动化测试（Selenium + Mocha）

### 追问链路（简要准备即可）

```
"为什么用 Selenium 而不是 Playwright/Cypress？"
-> "Electron 应用的自动化测试有什么特殊之处？"
-> "主题资源回归测试具体测什么？"
-> "测试效率提升 40% 怎么度量的？"
```

### 标准回答

- **Selenium 选型原因**：2022 年 Electron 的 Playwright 支持还不够成熟，Selenium + WebDriver 更稳定
- **Electron 测试特殊性**：需要连接 Electron 的 ChromeDriver，处理 IPC 调用的 mock
- **回归测试内容**：导出的主题资源文件完整性、尺寸、格式校验、ZIP 包结构验证
- **效率提升度量**：之前人工测试一轮 4 小时，自动化后 2.4 小时（测试效率提升 40%）
- **如果现在重新选型**：会用 Playwright（原生支持 Electron）
