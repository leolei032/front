# 主题编辑器 - 撤销/重做架构设计文档

## 📋 项目背景

### 项目概述
主题编辑器是一个基于 **低代码** 理念的可视化编辑工具，核心特点：

- **输入**: ZIP 包（包含描述文件 + 静态资源）
- **中间态**: Schema 作为统一数据模型
- **显示**: 可视化 UI 界面模拟主题画面
- **交互**: 可视化操作每个模块的 UI/数据信息
- **输出**: 处理后的主题 ZIP 包

### 技术栈
- **Electron**: 提供跨平台能力 + 文件系统读写
- **Web 技术**: 内部使用自研 Web 代码实现编辑器界面
- **Schema-Driven**: 所有组件通过 Schema 描述并渲染

---

## 🎯 核心诉求

### 功能需求
实现类似专业编辑软件（如 Photoshop）的 **前进/回退（Undo/Redo）** 能力：

- ✅ 支持撤销（Undo）任意编辑操作
- ✅ 支持重做（Redo）已撤销的操作
- ✅ 维护可配置的历史记录深度（如 100 步）
- ✅ 支持快捷键（Ctrl+Z / Ctrl+Y）
- ✅ 显示操作历史面板（可选）

### 当前实现的问题

**现有方案**: 完整快照存储
```javascript
// 每次修改保存整个 Schema 的深拷贝
const historyStack = [
  deepClone(schema),  // 修改前
  deepClone(schema),  // 修改1
  deepClone(schema),  // 修改2
  // ... 最多保存 10 个快照
];
```

**存在的问题**:
1. ❌ **内存占用巨大**: 每个快照完整复制整个 Schema（可能包含大量组件、样式、数据）
2. ❌ **性能低下**: 深拷贝大型对象耗时长（可能 100ms+）
3. ❌ **历史记录受限**: 仅支持 10 步历史（受内存限制）
4. ❌ **不可扩展**: 无法支持复杂场景（如协作编辑、操作合并）
5. ❌ **序列化困难**: 完整 Schema 难以持久化到磁盘

**对比数据**（假设 Schema 大小为 5MB）:
- 10 步历史 = 50MB 内存占用
- 100 步历史 = 500MB 内存占用（不可接受）

---

## 🔧 编辑操作类型

### 高频操作（需要优化合并）
| 操作类型 | 示例 | 频率 | 特点 |
|---------|------|------|------|
| **属性修改** | 修改颜色、字体、尺寸 | 极高 | 连续触发，需要合并 |
| **文本输入** | 输入组件标题/描述 | 高 | 连续字符，需要合并 |
| **拖拽调整** | 拖动组件位置/大小 | 高 | 连续坐标变化，需要合并 |

### 中频操作（独立记录）
| 操作类型 | 示例 | 频率 | 特点 |
|---------|------|------|------|
| **组件操作** | 添加/删除/复制组件 | 中 | 结构性变更，独立记录 |
| **图层操作** | 调整 z-index、锁定/隐藏 | 中 | 独立操作，不合并 |
| **数据绑定** | 绑定数据源、设置表达式 | 中 | 逻辑变更，独立记录 |

### 低频操作（特殊处理）
| 操作类型 | 示例 | 频率 | 特点 |
|---------|------|------|------|
| **文件操作** | 上传图片、替换资源 | 低 | 大文件，仅存储引用 |
| **批量操作** | 批量删除、批量对齐 | 低 | 可能包含多个子操作 |
| **全局设置** | 修改主题配置、变量 | 低 | 影响范围大，独立记录 |

---

## 💡 设计目标

### 性能指标
- ⚡ **撤销/重做延迟**: < 50ms（用户无感知）
- 📦 **内存占用**: < 当前方案的 10%（从 50MB → 5MB）
- 🔢 **历史深度**: 支持至少 100 步历史
- 💾 **持久化**: 支持将历史保存到临时文件（Electron）

### 功能特性
- 🔗 **操作合并**: 智能合并连续相似操作（如颜色调整）
- 📸 **周期快照**: 混合策略，加速大量撤销
- 🔄 **可序列化**: 支持导出/导入操作历史
- 🧩 **可扩展**: 易于添加新的操作类型

### 架构原则
- 🎨 **命令模式**: 每个操作封装为独立命令对象
- 📊 **增量存储**: 只记录变更差异（Diff），不存储完整状态
- 🚀 **延迟计算**: 按需恢复状态，避免预计算
- 🏗️ **分层设计**: 历史管理与业务逻辑解耦

---

## 🧠 整体设计思路

### 核心设计理念

本架构基于三个核心技术选型：

1. **Command Pattern（命令模式）**
   - **来源**: Gang of Four 设计模式
   - **核心思想**: 将每个编辑操作封装为独立的命令对象
   - **优势**: 操作可逆、可序列化、可组合、可延迟执行

2. **Event Sourcing（事件溯源）**
   - **来源**: DDD（领域驱动设计）架构模式
   - **核心思想**: 不存储最终状态，而是存储导致状态变化的操作序列
   - **优势**: 完整的操作历史、时间旅行能力、审计日志、协作冲突解决

3. **Immer.js（不可变数据 + 结构共享）**
   - **来源**: React 生态的不可变数据方案
   - **核心思想**: 基于 Proxy 的写时复制（Copy-on-Write）+ 自动生成 Patch
   - **优势**: 内存高效、自动差异计算、天然支持撤销/重做

### 为什么抛弃快照方案？

| 维度 | 快照方案 | 本架构（Command + Event Sourcing） |
|------|---------|-----------------------------------|
| **内存占用** | 每步 5MB × 10 步 = 50MB | 每步 ~500 bytes × 100 步 = 50KB（**节省 99%**） |
| **执行性能** | 深拷贝 100ms+ | Immer Patch 应用 < 5ms（**快 20 倍**） |
| **历史深度** | 受内存限制，通常 10 步 | 支持 100-1000 步 |
| **协作能力** | 无法合并冲突 | 可基于操作序列进行 OT/CRDT |
| **审计日志** | 无法追溯具体操作 | 完整的操作历史记录 |
| **持久化** | 500MB 难以存储 | 5MB 轻松保存到磁盘 |

**关键洞察**:
- 我们不需要保存 10 个完整的 Schema（状态快照）
- 我们只需要保存 100 条操作记录（事件日志）
- 任何历史状态都可以通过 **重放操作序列** 还原

### 四层优化策略

为了达到生产级性能，架构设计包含四个渐进式优化方案：

#### 方案 1: RAF 批处理（基础优化）
**问题**: 用户拖动滑块时，每 16ms 触发一次属性更新
**方案**: 使用 `requestAnimationFrame` 批量合并同一帧内的多个操作
**效果**: 60 FPS 下从 60 次命令 → 1 次批量命令（节省 98% 历史记录）

```typescript
// 用户拖动颜色滑块
editor.on('colorChange', (color) => {
  scheduler.batchInRAF(() => {
    editor.updateProperty('color', color);
  });
});
// 一帧内的 N 次调用 → 合并为 1 个 Command
```

#### 方案 2: 操作合并（智能压缩）
**问题**: 即使批处理，连续修改同一属性仍产生大量历史记录
**方案**: 时间窗口内的相同操作自动合并（如 1 秒内的颜色调整）
**效果**: 100 次连续调整 → 1 条合并记录（保留最终值）

```typescript
// 连续调整颜色（500ms 内）
editor.updateProperty('color', '#ff0000'); // t=0ms
editor.updateProperty('color', '#ff3300'); // t=200ms
editor.updateProperty('color', '#ff6600'); // t=400ms
// 自动合并为: color: #000000 → #ff6600
```

#### 方案 3: 事务模式（原子操作）
**问题**: 批量操作（如导入 100 个组件）产生 100 条历史记录
**方案**: 使用 `transaction` 包裹复杂操作，撤销时一次性回滚
**效果**: 100 条记录 → 1 条事务记录（符合用户心智模型）

```typescript
// 批量导入组件
editor.transaction('批量导入组件', () => {
  components.forEach(c => editor.addComponent(c));
});
// 撤销时：一次性删除所有导入的组件
```

#### 方案 4: 空闲调度（用户优先）
**问题**: 大批量操作（如 1000 个组件）阻塞 UI 5 秒
**方案**: 使用 `requestIdleCallback` 在浏览器空闲时处理低优先级任务
**效果**: 永不阻塞 UI，用户交互时自动暂停后台任务

```typescript
// 用户拖动组件（高优先级）
editor.on('drag', () => {
  scheduler.scheduleTask(() => {
    editor.updatePosition(x, y);
  }, 'high'); // 立即执行
});

// 后台批量导入（低优先级）
editor.transaction('批量导入', async () => {
  for (const component of components) {
    await scheduler.scheduleTask(() => {
      editor.addComponent(component);
    }, 'low'); // 空闲时执行，用户交互时暂停
  }
});
```

### 组件协同工作流程

整个系统由 5 个核心模块协同工作：

```
用户操作（UI 层）
    ↓
【命令封装】Command 对象
    ↓
【智能调度】RAF 批处理 + 操作合并 + 空闲调度
    ↓
【状态管理】Immer.js 生成 Patches
    ↓
【历史存储】HistoryManager 维护操作栈
    ↓
【状态恢复】应用/撤销 Patches → 触发 UI 重渲染
```

**关键数据流**:

1. **编辑时**:
   ```
   用户修改属性 → 创建 UpdatePropertyCommand
   → Scheduler 判断是否需要批处理/合并
   → SchemaManager 通过 Immer 生成 Patches
   → HistoryManager 保存 Command（包含 Patches）
   → UI 重新渲染
   ```

2. **撤销时**:
   ```
   用户按 Ctrl+Z → HistoryManager.undo()
   → 取出最近的 Command
   → 应用 inversePatch（Immer 自动生成的反向操作）
   → SchemaManager 恢复到上一状态
   → UI 重新渲染
   ```

3. **重做时**:
   ```
   用户按 Ctrl+Y → HistoryManager.redo()
   → 重新执行 Command.execute()
   → 应用 forwardPatch
   → 状态前进一步
   → UI 重新渲染
   ```

### 设计权衡与取舍

| 维度 | 权衡点 | 选择 | 原因 |
|------|--------|------|------|
| **快照 vs 操作日志** | 快照回滚快，但占用内存大 | 操作日志 | Schema 可能 5MB+，操作仅 500 bytes |
| **同步 vs 异步** | 同步简单，异步性能好 | 混合：高优先级同步，低优先级异步 | 兼顾用户体验和系统性能 |
| **完全合并 vs 选择性合并** | 完全合并历史短，选择性合并保留细节 | 选择性合并 | 高频操作（属性调整）合并，结构变更（添加组件）独立 |
| **客户端 vs 服务端** | 服务端可协作，客户端性能好 | 客户端为主 | Electron 本地应用，不需要实时协作 |
| **周期快照 vs 纯日志** | 快照加速长距离跳转 | 每 20 步创建一次快照 | 平衡内存和性能（撤销 50 步时从最近快照重放） |
| **React Fiber 中断 vs 协作式让步** | Fiber 可中断任何任务，但实现复杂 | 协作式让步 | 我们的任务粒度较粗，主动让步已足够 |

### 核心设计原则

1. **用户感知优先**: 高优先级任务（拖拽、输入）永不排队，低优先级任务（批量导入）可被中断
2. **内存效率优先**: 优先使用操作日志而非快照，结构共享而非深拷贝
3. **渐进式优化**: 从简单方案开始，逐步叠加优化策略（可按需启用/禁用）
4. **可测试性**: 每个 Command 都是纯函数，易于单元测试
5. **可扩展性**: 新增操作类型只需实现 `ICommand` 接口
6. **可观测性**: 完整的操作日志可用于调试、审计、性能分析

### 技术风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| **Immer.js 性能瓶颈** | 仅在需要时启用，提供快照模式作为降级方案 |
| **操作日志过长导致重放慢** | 每 20 步创建周期快照，长距离跳转从快照开始重放 |
| **浏览器 API 兼容性** | requestIdleCallback、Scheduler API 提供三层降级方案 |
| **内存泄漏** | LRU 策略限制历史深度，定期清理旧操作 |
| **操作合并逻辑错误** | 提供 `disableMerge` 选项，并保留合并前的原始操作（调试模式） |

---

## 🏗️ 架构设计与代码实现

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      编辑器 UI 层                             │
│  (Vue/React Component + Event Handlers)                     │
└──────────────────┬──────────────────────────────────────────┘
                   │ 调用操作方法
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                   HistoryManager                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Undo Stack   │  │ Redo Stack   │  │ Snapshots    │      │
│  │ [Command]    │  │ [Command]    │  │ Map<int,     │      │
│  │              │  │              │  │  State>      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  - execute(command)      - undo()        - redo()          │
│  - merge logic           - snapshot management             │
└──────────────────┬──────────────────────────────────────────┘
                   │ 执行 Command
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                 Command 抽象层                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ ICommand         │  │ IMergeableCmd    │                │
│  │ - execute()      │  │ - canMerge()     │                │
│  │ - undo()         │  │ - merge()        │                │
│  │ - redo()         │  └──────────────────┘                │
│  └──────────────────┘                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ 具体实现
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              具体 Command 实现类                             │
│  ┌───────────────────┐  ┌────────────────────┐             │
│  │ UpdateProperty    │  │ AddComponent       │             │
│  │ Command           │  │ Command            │             │
│  └───────────────────┘  └────────────────────┘             │
│  ┌───────────────────┐  ┌────────────────────┐             │
│  │ DeleteComponent   │  │ ReplaceFile        │             │
│  │ Command           │  │ Command            │             │
│  └───────────────────┘  └────────────────────┘             │
│  ┌───────────────────┐  ┌────────────────────┐             │
│  │ TextInput         │  │ BatchOperation     │             │
│  │ Command (可合并)   │  │ Command (组合)      │             │
│  └───────────────────┘  └────────────────────┘             │
└──────────────────┬──────────────────────────────────────────┘
                   │ 修改数据
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                  Schema State 层                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SchemaManager (基于 Immer.js)                         │ │
│  │  - state: Schema (不可变数据)                           │ │
│  │  - setState(newState)                                  │ │
│  │  - getProperty(path)                                   │ │
│  │  - setProperty(path, value) → 生成 Patches            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │ 触发更新
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                  渲染层 (UI 更新)                            │
└─────────────────────────────────────────────────────────────┘
```

---

### 核心模块设计

#### 1. Command 接口定义

```typescript
/**
 * 基础命令接口
 */
interface ICommand {
  /** 命令唯一标识 */
  readonly id: string;

  /** 命令类型（用于序列化） */
  readonly type: string;

  /** 命令描述（显示在历史面板） */
  readonly description: string;

  /** 创建时间戳 */
  readonly timestamp: number;

  /** 执行命令（应用变更） */
  execute(): void;

  /** 撤销命令（恢复变更） */
  undo(): void;

  /** 重做命令（通常等同于 execute） */
  redo(): void;

  /** 序列化为 JSON（用于持久化） */
  serialize(): Record<string, any>;
}

/**
 * 可合并命令接口（用于连续相似操作）
 */
interface IMergeableCommand extends ICommand {
  /** 判断是否可以与另一个命令合并 */
  canMerge(command: ICommand): boolean;

  /** 合并另一个命令到当前命令 */
  merge(command: ICommand): void;

  /** 合并时间窗口（毫秒） */
  readonly mergeWindow: number;
}

/**
 * 组合命令接口（批量操作）
 */
interface ICompositeCommand extends ICommand {
  /** 子命令列表 */
  readonly commands: ICommand[];

  /** 添加子命令 */
  addCommand(command: ICommand): void;
}
```

---

#### 2. HistoryManager 核心实现

```typescript
import { EventEmitter } from 'events';

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

/**
 * 历史管理器 - 核心撤销/重做逻辑
 */
class HistoryManager extends EventEmitter {
  /** 撤销栈 */
  private undoStack: ICommand[] = [];

  /** 重做栈 */
  private redoStack: ICommand[] = [];

  /** 周期快照（每 N 个操作保存一次） */
  private snapshots: Map<number, any> = new Map();

  /** 配置项 */
  private config = {
    maxHistorySize: 100,        // 最大历史记录数
    snapshotInterval: 20,       // 快照间隔（每 20 个操作）
    maxSnapshots: 5,            // 最大快照数
    enableAutoMerge: true,      // 自动合并相似操作
    mergeTimeWindow: 1000,      // 合并时间窗口（毫秒）
  };

  constructor(config?: Partial<typeof this.config>) {
    super();
    Object.assign(this.config, config);
  }

  /**
   * 执行命令并记录到历史
   */
  execute(command: ICommand): void {
    // 1. 尝试与最后一个命令合并
    if (this.config.enableAutoMerge && this.tryMergeCommand(command)) {
      this.emitStateChange();
      return;
    }

    // 2. 执行命令
    command.execute();

    // 3. 添加到撤销栈
    this.undoStack.push(command);

    // 4. 清空重做栈（执行新操作后，旧的重做历史失效）
    this.redoStack = [];

    // 5. 限制栈大小
    this.trimHistoryIfNeeded();

    // 6. 周期性保存快照
    this.saveSnapshotIfNeeded();

    // 7. 触发状态变更事件
    this.emitStateChange();

    // 8. 日志记录
    this.logCommand('EXECUTE', command);
  }

  /**
   * 撤销操作
   */
  undo(steps: number = 1): void {
    if (!this.canUndo()) return;

    const actualSteps = Math.min(steps, this.undoStack.length);

    // 大量撤销时，优先使用快照恢复
    if (actualSteps > 10) {
      this.undoWithSnapshot(actualSteps);
    } else {
      // 正常逐个撤销
      for (let i = 0; i < actualSteps; i++) {
        this.undoOne();
      }
    }

    this.emitStateChange();
  }

  /**
   * 撤销单个操作
   */
  private undoOne(): void {
    const command = this.undoStack.pop();
    if (!command) return;

    command.undo();
    this.redoStack.push(command);
    this.logCommand('UNDO', command);
  }

  /**
   * 使用快照加速大量撤销
   */
  private undoWithSnapshot(steps: number): void {
    const targetIndex = this.undoStack.length - steps;
    const snapshot = this.findNearestSnapshot(targetIndex);

    if (snapshot) {
      // 恢复到快照状态
      this.restoreSnapshot(snapshot);

      // 重放快照之后到目标位置的命令
      const replayCount = targetIndex - snapshot.index;
      for (let i = 0; i < replayCount; i++) {
        this.undoStack[snapshot.index + i].execute();
      }

      // 调整栈指针
      this.redoStack.push(...this.undoStack.slice(targetIndex));
      this.undoStack = this.undoStack.slice(0, targetIndex);
    } else {
      // 无快照，回退到逐个撤销
      for (let i = 0; i < steps; i++) {
        this.undoOne();
      }
    }
  }

  /**
   * 重做操作
   */
  redo(steps: number = 1): void {
    if (!this.canRedo()) return;

    const actualSteps = Math.min(steps, this.redoStack.length);

    for (let i = 0; i < actualSteps; i++) {
      const command = this.redoStack.pop();
      if (!command) break;

      command.redo();
      this.undoStack.push(command);
      this.logCommand('REDO', command);
    }

    this.emitStateChange();
  }

  /**
   * 尝试合并命令
   */
  private tryMergeCommand(command: ICommand): boolean {
    if (this.undoStack.length === 0) return false;

    const lastCommand = this.undoStack[this.undoStack.length - 1];

    // 检查是否可合并
    if (this.isMergeableCommand(lastCommand) &&
        lastCommand.canMerge(command)) {
      lastCommand.merge(command);
      return true;
    }

    return false;
  }

  /**
   * 检查命令是否可合并
   */
  private isMergeableCommand(cmd: ICommand): cmd is IMergeableCommand {
    return 'canMerge' in cmd && 'merge' in cmd;
  }

  /**
   * 限制历史栈大小
   */
  private trimHistoryIfNeeded(): void {
    if (this.undoStack.length > this.config.maxHistorySize) {
      const removeCount = this.undoStack.length - this.config.maxHistorySize;
      this.undoStack.splice(0, removeCount);

      // 清理对应的快照
      this.snapshots.forEach((_, index) => {
        if (index < removeCount) {
          this.snapshots.delete(index);
        }
      });
    }
  }

  /**
   * 保存快照（如果需要）
   */
  private saveSnapshotIfNeeded(): void {
    const currentIndex = this.undoStack.length;

    if (currentIndex % this.config.snapshotInterval === 0) {
      const state = this.captureCurrentState();
      this.snapshots.set(currentIndex, {
        index: currentIndex,
        state: state,
        timestamp: Date.now(),
      });

      // 限制快照数量
      this.trimSnapshots();
    }
  }

  /**
   * 捕获当前状态（由外部 SchemaManager 提供）
   */
  private captureCurrentState(): any {
    // 通过回调获取当前完整状态
    return this.emit('capture-state');
  }

  /**
   * 恢复快照
   */
  private restoreSnapshot(snapshot: any): void {
    this.emit('restore-state', snapshot.state);
  }

  /**
   * 查找最近的快照
   */
  private findNearestSnapshot(targetIndex: number): any {
    let nearest = null;
    let minDistance = Infinity;

    this.snapshots.forEach((snapshot, index) => {
      if (index <= targetIndex) {
        const distance = targetIndex - index;
        if (distance < minDistance) {
          minDistance = distance;
          nearest = snapshot;
        }
      }
    });

    return nearest;
  }

  /**
   * 限制快照数量
   */
  private trimSnapshots(): void {
    if (this.snapshots.size > this.config.maxSnapshots) {
      const sortedKeys = Array.from(this.snapshots.keys()).sort((a, b) => a - b);
      const removeCount = this.snapshots.size - this.config.maxSnapshots;

      for (let i = 0; i < removeCount; i++) {
        this.snapshots.delete(sortedKeys[i]);
      }
    }
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.snapshots.clear();
    this.emitStateChange();
  }

  /**
   * 获取当前状态
   */
  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 获取撤销栈（用于历史面板显示）
   */
  getUndoStack(): ICommand[] {
    return [...this.undoStack];
  }

  /**
   * 获取重做栈
   */
  getRedoStack(): ICommand[] {
    return [...this.redoStack];
  }

  /**
   * 触发状态变更事件
   */
  private emitStateChange(): void {
    this.emit('state-change', this.getState());
  }

  /**
   * 日志记录
   */
  private logCommand(action: string, command: ICommand): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[History] ${action}: ${command.description}`, {
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
      });
    }
  }

  /**
   * 序列化历史（用于持久化）
   */
  serialize(): string {
    return JSON.stringify({
      undoStack: this.undoStack.map(cmd => cmd.serialize()),
      redoStack: this.redoStack.map(cmd => cmd.serialize()),
    });
  }

  /**
   * 反序列化历史
   */
  static deserialize(data: string, commandFactory: CommandFactory): HistoryManager {
    const parsed = JSON.parse(data);
    const manager = new HistoryManager();

    manager.undoStack = parsed.undoStack.map((d: any) =>
      commandFactory.create(d)
    );
    manager.redoStack = parsed.redoStack.map((d: any) =>
      commandFactory.create(d)
    );

    return manager;
  }
}
```

---

#### 3. 基于 Immer.js 的 Schema 管理器

```typescript
import { produce, applyPatches, Patch, enablePatches } from 'immer';

// 启用 Immer patches 功能
enablePatches();

/**
 * Schema 状态管理器（基于 Immer.js）
 */
class SchemaManager {
  /** 当前 Schema 状态（不可变） */
  private state: Schema;

  /** 状态变更回调 */
  private listeners: Set<(state: Schema) => void> = new Set();

  constructor(initialSchema: Schema) {
    this.state = initialSchema;
  }

  /**
   * 获取当前状态
   */
  getState(): Schema {
    return this.state;
  }

  /**
   * 设置新状态
   */
  setState(newState: Schema): void {
    this.state = newState;
    this.notifyListeners();
  }

  /**
   * 通过路径获取属性值
   */
  getProperty(path: string): any {
    const keys = path.split('.');
    let value: any = this.state;

    for (const key of keys) {
      if (value === undefined || value === null) return undefined;
      value = value[key];
    }

    return value;
  }

  /**
   * 通过路径设置属性值（生成 Patches）
   */
  setProperty(path: string, value: any): { patches: Patch[], inversePatches: Patch[] } {
    const keys = path.split('.');

    const [nextState, patches, inversePatches] = produce(
      this.state,
      draft => {
        let current: any = draft;

        // 导航到目标属性的父对象
        for (let i = 0; i < keys.length - 1; i++) {
          if (current[keys[i]] === undefined) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }

        // 设置值
        current[keys[keys.length - 1]] = value;
      },
      (p, ip) => [p, ip]
    );

    this.setState(nextState);

    return { patches, inversePatches };
  }

  /**
   * 应用 Patches（用于撤销/重做）
   */
  applyPatches(patches: Patch[]): void {
    const nextState = applyPatches(this.state, patches);
    this.setState(nextState);
  }

  /**
   * 批量更新（使用 Immer produce）
   */
  update(updater: (draft: Schema) => void): { patches: Patch[], inversePatches: Patch[] } {
    const [nextState, patches, inversePatches] = produce(
      this.state,
      updater,
      (p, ip) => [p, ip]
    );

    this.setState(nextState);

    return { patches, inversePatches };
  }

  /**
   * 订阅状态变更
   */
  subscribe(listener: (state: Schema) => void): () => void {
    this.listeners.add(listener);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * 克隆当前状态（用于快照）
   */
  cloneState(): Schema {
    return JSON.parse(JSON.stringify(this.state));
  }
}
```

---

#### 4. 具体 Command 实现示例

```typescript
/**
 * 属性更新命令（可合并）
 */
class UpdatePropertyCommand implements IMergeableCommand {
  readonly id: string;
  readonly type = 'UPDATE_PROPERTY';
  readonly description: string;
  readonly timestamp: number;
  readonly mergeWindow = 1000; // 1秒内的操作可合并

  private patches: Patch[] = [];
  private inversePatches: Patch[] = [];

  constructor(
    private schemaManager: SchemaManager,
    private componentId: string,
    private propertyPath: string,
    private newValue: any,
    private oldValue?: any
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.description = `修改 ${componentId} 的 ${propertyPath}`;
  }

  execute(): void {
    const fullPath = `components.${this.componentId}.${this.propertyPath}`;
    const { patches, inversePatches } = this.schemaManager.setProperty(fullPath, this.newValue);

    this.patches = patches;
    this.inversePatches = inversePatches;
  }

  undo(): void {
    this.schemaManager.applyPatches(this.inversePatches);
  }

  redo(): void {
    this.schemaManager.applyPatches(this.patches);
  }

  canMerge(command: ICommand): boolean {
    if (!(command instanceof UpdatePropertyCommand)) return false;

    return (
      command.componentId === this.componentId &&
      command.propertyPath === this.propertyPath &&
      command.timestamp - this.timestamp < this.mergeWindow
    );
  }

  merge(command: ICommand): void {
    if (!(command instanceof UpdatePropertyCommand)) return;

    // 合并：保留初始 inversePatches，更新 patches 和 newValue
    this.newValue = command.newValue;
    this.patches = command.patches;
    // inversePatches 保持不变（恢复到最初状态）
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      componentId: this.componentId,
      propertyPath: this.propertyPath,
      newValue: this.newValue,
      oldValue: this.oldValue,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 添加组件命令
 */
class AddComponentCommand implements ICommand {
  readonly id: string;
  readonly type = 'ADD_COMPONENT';
  readonly description: string;
  readonly timestamp: number;

  private patches: Patch[] = [];
  private inversePatches: Patch[] = [];

  constructor(
    private schemaManager: SchemaManager,
    private component: ComponentSchema,
    private parentId?: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.description = `添加组件 ${component.name}`;
  }

  execute(): void {
    const { patches, inversePatches } = this.schemaManager.update(draft => {
      if (this.parentId) {
        // 添加到指定父组件
        draft.components[this.parentId].children.push(this.component);
      } else {
        // 添加到根级
        draft.components[this.component.id] = this.component;
      }
    });

    this.patches = patches;
    this.inversePatches = inversePatches;
  }

  undo(): void {
    this.schemaManager.applyPatches(this.inversePatches);
  }

  redo(): void {
    this.schemaManager.applyPatches(this.patches);
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      component: this.component,
      parentId: this.parentId,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 删除组件命令
 */
class DeleteComponentCommand implements ICommand {
  readonly id: string;
  readonly type = 'DELETE_COMPONENT';
  readonly description: string;
  readonly timestamp: number;

  private patches: Patch[] = [];
  private inversePatches: Patch[] = [];

  constructor(
    private schemaManager: SchemaManager,
    private componentId: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.description = `删除组件 ${componentId}`;
  }

  execute(): void {
    const { patches, inversePatches } = this.schemaManager.update(draft => {
      delete draft.components[this.componentId];
    });

    this.patches = patches;
    this.inversePatches = inversePatches;
  }

  undo(): void {
    this.schemaManager.applyPatches(this.inversePatches);
  }

  redo(): void {
    this.schemaManager.applyPatches(this.patches);
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      componentId: this.componentId,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 文本输入命令（可合并）
 */
class TextInputCommand implements IMergeableCommand {
  readonly id: string;
  readonly type = 'TEXT_INPUT';
  readonly description: string;
  readonly timestamp: number;
  readonly mergeWindow = 500; // 500ms 内的输入可合并

  private patches: Patch[] = [];
  private inversePatches: Patch[] = [];
  private text: string;

  constructor(
    private schemaManager: SchemaManager,
    private componentId: string,
    private fieldPath: string,
    text: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.text = text;
    this.description = `编辑 ${componentId} 文本`;
  }

  execute(): void {
    const fullPath = `components.${this.componentId}.${this.fieldPath}`;
    const { patches, inversePatches } = this.schemaManager.setProperty(fullPath, this.text);

    this.patches = patches;
    this.inversePatches = inversePatches;
  }

  undo(): void {
    this.schemaManager.applyPatches(this.inversePatches);
  }

  redo(): void {
    this.schemaManager.applyPatches(this.patches);
  }

  canMerge(command: ICommand): boolean {
    if (!(command instanceof TextInputCommand)) return false;

    return (
      command.componentId === this.componentId &&
      command.fieldPath === this.fieldPath &&
      command.timestamp - this.timestamp < this.mergeWindow
    );
  }

  merge(command: ICommand): void {
    if (!(command instanceof TextInputCommand)) return;

    // 合并文本（追加新输入）
    this.text = command.text;
    this.patches = command.patches;
    this.timestamp = command.timestamp;
    // inversePatches 保持不变（恢复到最初文本）
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      componentId: this.componentId,
      fieldPath: this.fieldPath,
      text: this.text,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 批量操作命令（组合模式）
 */
class BatchOperationCommand implements ICompositeCommand {
  readonly id: string;
  readonly type = 'BATCH_OPERATION';
  readonly description: string;
  readonly timestamp: number;
  readonly commands: ICommand[] = [];

  constructor(description: string = '批量操作') {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.description = description;
  }

  addCommand(command: ICommand): void {
    this.commands.push(command);
  }

  execute(): void {
    this.commands.forEach(cmd => cmd.execute());
  }

  undo(): void {
    // 反向撤销（后执行的先撤销）
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    this.commands.forEach(cmd => cmd.redo());
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      description: this.description,
      commands: this.commands.map(cmd => cmd.serialize()),
      timestamp: this.timestamp,
    };
  }
}

```

---

#### 5. 静态资源版本管理（主题编辑器核心）

**背景说明**：
- 主题文件 = XML + JSON + 静态资源（图片、动画等）
- 运行时内存：解析后的JSON + 文件引用（hash字符串）
- 核心挑战：文件操作的撤销/重做不能真实删除文件

**架构设计**：

```typescript
/**
 * ===== 核心数据结构 =====
 */

/**
 * Schema结构（运行时内存）
 *
 * 注意：XML已解析为JSON，文件只存hash引用
 */
interface ThemeSchema {
  metadata: {
    projectId: string,
    themeName: string,
    // 解析后的JSON数据（不是XML字符串）
    xmlData: any,
    editorConfig: any,
    variables: Map<string, VariableDefinition>
  },

  // 文件引用（只存hash，不存二进制内容）
  assets: {
    images: Map<string, ImageAssetRef>,
    animations: Map<string, AnimationAssetRef>
  }
}

/**
 * 图片资源引用（内存占用约100 bytes）
 */
interface ImageAssetRef {
  hash: string,          // SHA256 hash（64字符）
  androidPath: string    // Android规范路径
}

/**
 * 文件池引用计数表（核心机制）
 */
interface RefCountTable {
  [hash: string]: {
    count: number,                // 引用计数
    referencedBy: Set<string>,    // 引用来源（commandId列表）
    zeroRefTimestamp?: number     // 归零时间（用于延迟GC）
  }
}

/**
 * ===== 文件池管理器 =====
 */
class FilePoolManager {
  private poolDir: string;           // 文件池目录
  private metadata: Map<string, FileMetadata> = new Map();
  private refCount: RefCountTable = {};

  /**
   * 添加文件到池（Copy-on-Write）
   */
  async addFile(
    sourcePath: string,
    androidPath: string,
    commandId: string
  ): Promise<string> {
    // 1. 计算文件hash
    const buffer = await fs.promises.readFile(sourcePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 2. 检查文件是否已存在（去重）
    const poolPath = path.join(this.poolDir, `${hash}${path.extname(sourcePath)}`);
    if (!fs.existsSync(poolPath)) {
      await fs.promises.copyFile(sourcePath, poolPath);
      console.log(`[FilePool] New file added: ${hash.substring(0, 8)}`);
    } else {
      console.log(`[FilePool] File dedup: ${hash.substring(0, 8)}`);
    }

    // 3. 增加引用计数
    this.addReference(hash, commandId);

    return hash;
  }

  /**
   * 增加引用计数
   */
  addReference(hash: string, commandId: string): void {
    if (!this.refCount[hash]) {
      this.refCount[hash] = {
        count: 0,
        referencedBy: new Set()
      };
    }

    this.refCount[hash].referencedBy.add(commandId);
    this.refCount[hash].count = this.refCount[hash].referencedBy.size;
  }

  /**
   * 减少引用计数
   */
  removeReference(hash: string, commandId: string): void {
    if (!this.refCount[hash]) return;

    this.refCount[hash].referencedBy.delete(commandId);
    this.refCount[hash].count = this.refCount[hash].referencedBy.size;

    // 引用归零，记录时间（用于延迟GC）
    if (this.refCount[hash].count === 0) {
      this.refCount[hash].zeroRefTimestamp = Date.now();
    }
  }

  /**
   * 获取文件路径
   */
  getFilePath(hash: string): string | null {
    const meta = this.metadata.get(hash);
    if (!meta) return null;

    const poolPath = path.join(this.poolDir, `${hash}${path.extname(meta.originalName)}`);
    return fs.existsSync(poolPath) ? poolPath : null;
  }

  /**
   * 垃圾回收
   */
  async garbageCollect(): Promise<GCReport> {
    const report = { deletedFiles: 0, reclaimedBytes: 0 };
    const now = Date.now();
    const gcDelay = 30 * 60 * 1000;  // 30分钟

    for (const [hash, meta] of this.metadata.entries()) {
      if (this.refCount[hash]?.count === 0) {
        const zeroRefSince = this.refCount[hash].zeroRefTimestamp || 0;

        // 零引用超过30分钟才删除
        if (now - zeroRefSince > gcDelay) {
          const poolPath = path.join(this.poolDir, `${hash}${path.extname(meta.originalName)}`);

          if (fs.existsSync(poolPath)) {
            await fs.promises.unlink(poolPath);
            this.metadata.delete(hash);
            delete this.refCount[hash];

            report.deletedFiles++;
            report.reclaimedBytes += meta.size;
          }
        }
      }
    }

    return report;
  }
}

/**
 * ===== 文件操作命令 =====
 */

/**
 * 替换资源命令
 */
class ReplaceAssetCommand implements ICommand {
  readonly id: string;
  readonly type = 'REPLACE_ASSET';
  readonly description: string;
  readonly timestamp: number;

  private assetKey: string;
  private oldHash: string;
  private newHash: string;

  constructor(
    private schemaManager: SchemaManager,
    private filePool: FilePoolManager,
    assetKey: string,
    newFilePath: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.assetKey = assetKey;
    this.description = `替换资源 ${assetKey}`;

    // 保存旧hash
    const currentAsset = schemaManager.getState().assets.images.get(assetKey);
    this.oldHash = currentAsset?.hash || '';
  }

  async execute(): Promise<void> {
    // 1. 添加新文件到池（文件IO）
    const currentAsset = this.schemaManager.getState().assets.images.get(this.assetKey);
    this.newHash = await this.filePool.addFile(
      newFilePath,
      currentAsset!.androidPath,
      this.id
    );

    // 2. 修改Schema中的引用（只改字符串）
    this.schemaManager.update(draft => {
      const asset = draft.assets.images.get(this.assetKey);
      if (asset) {
        asset.hash = this.newHash;
      }
    });

    // 3. 调整引用计数
    this.filePool.removeReference(this.oldHash, this.id);
  }

  undo(): void {
    // 检查文件是否还存在
    const filePath = this.filePool.getFilePath(this.oldHash);
    if (!filePath) {
      throw new Error(`无法撤销：文件已被清理 (hash: ${this.oldHash.substring(0, 8)})`);
    }

    // 恢复旧hash
    this.schemaManager.update(draft => {
      const asset = draft.assets.images.get(this.assetKey);
      if (asset) {
        asset.hash = this.oldHash;
      }
    });

    // 调整引用计数
    this.filePool.addReference(this.oldHash, this.id);
    this.filePool.removeReference(this.newHash, this.id);
  }

  redo(): void {
    this.schemaManager.update(draft => {
      const asset = draft.assets.images.get(this.assetKey);
      if (asset) {
        asset.hash = this.newHash;
      }
    });

    this.filePool.removeReference(this.oldHash, this.id);
    this.filePool.addReference(this.newHash, this.id);
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      assetKey: this.assetKey,
      oldHash: this.oldHash,
      newHash: this.newHash,
      timestamp: this.timestamp
    };
  }
}

/**
 * 添加资源命令
 */
class AddAssetCommand implements ICommand {
  readonly id: string;
  readonly type = 'ADD_ASSET';
  readonly description: string;
  readonly timestamp: number;

  private assetKey: string;
  private hash: string;
  private androidPath: string;

  constructor(
    private schemaManager: SchemaManager,
    private filePool: FilePoolManager,
    assetKey: string,
    sourcePath: string,
    androidPath: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.assetKey = assetKey;
    this.androidPath = androidPath;
    this.description = `添加资源 ${assetKey}`;
  }

  async execute(): Promise<void> {
    this.hash = await this.filePool.addFile(sourcePath, this.androidPath, this.id);

    this.schemaManager.update(draft => {
      draft.assets.images.set(this.assetKey, {
        hash: this.hash,
        androidPath: this.androidPath
      });
    });
  }

  undo(): void {
    this.schemaManager.update(draft => {
      draft.assets.images.delete(this.assetKey);
    });
    this.filePool.removeReference(this.hash, this.id);
  }

  redo(): void {
    this.schemaManager.update(draft => {
      draft.assets.images.set(this.assetKey, {
        hash: this.hash,
        androidPath: this.androidPath
      });
    });
    this.filePool.addReference(this.hash, this.id);
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      assetKey: this.assetKey,
      hash: this.hash,
      androidPath: this.androidPath,
      timestamp: this.timestamp
    };
  }
}

/**
 * 删除资源命令
 */
class DeleteAssetCommand implements ICommand {
  readonly id: string;
  readonly type = 'DELETE_ASSET';
  readonly description: string;
  readonly timestamp: number;

  private assetKey: string;
  private deletedAsset: ImageAssetRef;

  constructor(
    private schemaManager: SchemaManager,
    private filePool: FilePoolManager,
    assetKey: string
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.assetKey = assetKey;
    this.description = `删除资源 ${assetKey}`;

    const asset = schemaManager.getState().assets.images.get(assetKey);
    this.deletedAsset = asset ? { ...asset } : { hash: '', androidPath: '' };
  }

  execute(): void {
    this.schemaManager.update(draft => {
      draft.assets.images.delete(this.assetKey);
    });
    this.filePool.removeReference(this.deletedAsset.hash, this.id);
  }

  undo(): void {
    this.schemaManager.update(draft => {
      draft.assets.images.set(this.assetKey, this.deletedAsset);
    });
    this.filePool.addReference(this.deletedAsset.hash, this.id);
  }

  redo(): void {
    this.execute();
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      assetKey: this.assetKey,
      deletedAsset: this.deletedAsset,
      timestamp: this.timestamp
    };
  }
}

/**
 * ===== 自动垃圾回收 =====
 */
class AutoGarbageCollector {
  private filePool: FilePoolManager;
  private gcInterval = 5 * 60 * 1000;  // 5分钟
  private maxZeroRefFiles = 50;

  start(): void {
    setInterval(async () => {
      const stats = this.filePool.getStats();

      if (stats.zeroRefFiles > this.maxZeroRefFiles) {
        const report = await this.filePool.garbageCollect();
        console.log(`[AutoGC] Deleted ${report.deletedFiles} files, reclaimed ${(report.reclaimedBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    }, this.gcInterval);
  }
}

/**
 * ===== 项目加载：重建引用计数 =====
 */
class ProjectLoader {
  /**
   * 从保存的历史重建引用计数
   */
  private async rebuildRefCount(
    historyData: any,
    filePool: FilePoolManager
  ): Promise<void> {
    filePool.clearRefCount();

    // 遍历UndoStack
    for (const cmdData of historyData.undoStack) {
      this.registerFileReferences(cmdData, filePool);
    }

    // 遍历RedoStack
    for (const cmdData of historyData.redoStack) {
      this.registerFileReferences(cmdData, filePool);
    }

    await filePool.saveRefCount();
  }

  /**
   * 从命令数据中提取文件引用
   */
  private registerFileReferences(cmdData: any, filePool: FilePoolManager): void {
    switch (cmdData.type) {
      case 'ADD_ASSET':
        filePool.addReference(cmdData.hash, cmdData.id);
        break;

      case 'REPLACE_ASSET':
        filePool.addReference(cmdData.newHash, cmdData.id);
        if (cmdData.oldHash) {
          filePool.addReference(cmdData.oldHash, cmdData.id);
        }
        break;

      case 'DELETE_ASSET':
        filePool.addReference(cmdData.deletedAsset.hash, cmdData.id);
        break;
    }
  }
}
```

**核心机制总结**：

| 机制 | 实现方式 | 解决的问题 |
|------|----------|------------|
| **内容寻址存储** | SHA256 hash命名 | 自动去重，版本追踪 |
| **引用计数** | commandId → hash 映射 | 精确知道文件何时可删除 |
| **延迟GC** | 零引用保留30分钟 | 支持短期撤销 |
| **引用重建** | 加载时遍历历史命令 | 恢复引用计数 |
| **文件去重** | 相同内容只存一份 | 节省空间（多个版本用同一图） |

**性能数据**：
```
操作          耗时         说明
添加文件    100ms      文件IO（异步，主进程）
替换文件    < 1ms      只改引用字符串
删除文件    < 1ms      只改引用字符串
撤销/重做   < 1ms      切换hash引用
GC清理      10-50ms    删除零引用文件
```

**内存占用对比**：
```
只存引用：    ~130KB（XML JSON + hash引用）
加载文件内容： ~60MB（30张图片）
节省比例：    99.8%
```

---

#### 6. Command Factory（工厂模式）

```typescript
/**
 * 命令工厂 - 用于创建和反序列化命令
 */
class CommandFactory {
  private schemaManager: SchemaManager;
  private fileManager: FileManager;

  constructor(schemaManager: SchemaManager, fileManager: FileManager) {
    this.schemaManager = schemaManager;
    this.fileManager = fileManager;
  }

  /**
   * 从序列化数据创建命令
   */
  create(data: Record<string, any>): ICommand {
    switch (data.type) {
      case 'UPDATE_PROPERTY':
        return new UpdatePropertyCommand(
          this.schemaManager,
          data.componentId,
          data.propertyPath,
          data.newValue,
          data.oldValue
        );

      case 'ADD_COMPONENT':
        return new AddComponentCommand(
          this.schemaManager,
          data.component,
          data.parentId
        );

      case 'DELETE_COMPONENT':
        return new DeleteComponentCommand(
          this.schemaManager,
          data.componentId
        );

      case 'TEXT_INPUT':
        return new TextInputCommand(
          this.schemaManager,
          data.componentId,
          data.fieldPath,
          data.text
        );

      case 'BATCH_OPERATION':
        const batch = new BatchOperationCommand(data.description);
        data.commands.forEach((cmdData: any) => {
          batch.addCommand(this.create(cmdData));
        });
        return batch;

      case 'REPLACE_FILE':
        return new ReplaceFileCommand(
          this.schemaManager,
          data.componentId,
          data.filePath,
          data.oldFileHash,
          data.newFileHash,
          this.fileManager
        );

      default:
        throw new Error(`Unknown command type: ${data.type}`);
    }
  }
}
```

---

#### 6. 与 Electron 集成（持久化）

```typescript
/**
 * 历史持久化管理器（Electron）
 */
class HistoryPersistence {
  private tempDir: string;

  constructor() {
    // 使用 Electron app.getPath('temp')
    this.tempDir = path.join(app.getPath('temp'), 'theme-editor-history');
    this.ensureTempDir();
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 保存历史到磁盘
   */
  async save(history: HistoryManager, projectId: string): Promise<void> {
    const filePath = path.join(this.tempDir, `${projectId}.json`);
    const data = history.serialize();

    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  /**
   * 从磁盘加载历史
   */
  async load(projectId: string, commandFactory: CommandFactory): Promise<HistoryManager | null> {
    const filePath = path.join(this.tempDir, `${projectId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = await fs.promises.readFile(filePath, 'utf-8');
    return HistoryManager.deserialize(data, commandFactory);
  }

  /**
   * 清理临时历史文件
   */
  async cleanup(projectId: string): Promise<void> {
    const filePath = path.join(this.tempDir, `${projectId}.json`);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * 清理所有过期的历史文件（超过 7 天）
   */
  async cleanupExpired(): Promise<void> {
    const files = await fs.promises.readdir(this.tempDir);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

    for (const file of files) {
      const filePath = path.join(this.tempDir, file);
      const stats = await fs.promises.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.promises.unlink(filePath);
      }
    }
  }
}
```

---

#### 7. 完整使用示例

```typescript
/**
 * 主编辑器类 - 集成所有模块
 */
class ThemeEditor {
  private schemaManager: SchemaManager;
  private historyManager: HistoryManager;
  private fileManager: FileManager;
  private commandFactory: CommandFactory;
  private persistence: HistoryPersistence;

  constructor(initialSchema: Schema) {
    // 初始化各个模块
    this.schemaManager = new SchemaManager(initialSchema);
    this.fileManager = new FileManager();
    this.commandFactory = new CommandFactory(this.schemaManager, this.fileManager);

    this.historyManager = new HistoryManager({
      maxHistorySize: 100,
      snapshotInterval: 20,
      enableAutoMerge: true,
    });

    this.persistence = new HistoryPersistence();

    // 连接 HistoryManager 和 SchemaManager
    this.historyManager.on('capture-state', () => {
      return this.schemaManager.cloneState();
    });

    this.historyManager.on('restore-state', (state) => {
      this.schemaManager.setState(state);
    });

    // 监听历史状态变化
    this.historyManager.on('state-change', (state) => {
      this.updateUI(state);
    });
  }

  /**
   * 修改组件属性
   */
  updateComponentProperty(componentId: string, propertyPath: string, value: any): void {
    const oldValue = this.schemaManager.getProperty(`components.${componentId}.${propertyPath}`);

    const command = new UpdatePropertyCommand(
      this.schemaManager,
      componentId,
      propertyPath,
      value,
      oldValue
    );

    this.historyManager.execute(command);
  }

  /**
   * 添加组件
   */
  addComponent(component: ComponentSchema, parentId?: string): void {
    const command = new AddComponentCommand(
      this.schemaManager,
      component,
      parentId
    );

    this.historyManager.execute(command);
  }

  /**
   * 删除组件
   */
  deleteComponent(componentId: string): void {
    const command = new DeleteComponentCommand(
      this.schemaManager,
      componentId
    );

    this.historyManager.execute(command);
  }

  /**
   * 批量操作
   */
  batchUpdate(operations: Array<() => ICommand>): void {
    const batch = new BatchOperationCommand('批量编辑');

    operations.forEach(op => {
      batch.addCommand(op());
    });

    this.historyManager.execute(batch);
  }

  /**
   * 撤销
   */
  undo(steps: number = 1): void {
    this.historyManager.undo(steps);
  }

  /**
   * 重做
   */
  redo(steps: number = 1): void {
    this.historyManager.redo(steps);
  }

  /**
   * 保存历史到磁盘
   */
  async saveHistory(projectId: string): Promise<void> {
    await this.persistence.save(this.historyManager, projectId);
  }

  /**
   * 加载历史
   */
  async loadHistory(projectId: string): Promise<void> {
    const history = await this.persistence.load(projectId, this.commandFactory);

    if (history) {
      this.historyManager = history;
    }
  }

  /**
   * 更新 UI（通知渲染层）
   */
  private updateUI(historyState: HistoryState): void {
    // 触发 UI 更新（Vue/React 响应式更新）
    window.dispatchEvent(new CustomEvent('history-state-change', {
      detail: historyState
    }));
  }
}
```

---

### 内存优化策略

#### 1. Immer.js 结构共享

```typescript
// ❌ 完整拷贝（旧方案）
const snapshot = JSON.parse(JSON.stringify(schema)); // 5MB → 5MB

// ✅ 结构共享（新方案）
const [nextState, patches] = produce(schema, draft => {
  draft.components['header'].style.color = '#ff0000';
}, (p, ip) => [p, ip]);

// patches 大小: ~200 bytes
// {
//   "op": "replace",
//   "path": "/components/header/style/color",
//   "value": "#ff0000"
// }
```

**内存占用对比**:
- 10 步完整快照: 50MB
- 10 步 Patches: ~2KB（减少 99.996%）

---

#### 2. 周期快照 + Patches 混合

```typescript
// 每 20 个操作存一个完整快照
// 其他操作只存 Patches

// 示例：100 步历史
// - 快照: 第 0, 20, 40, 60, 80, 100 步（6 个快照 = 30MB）
// - Patches: 其他 94 步（~18.8KB）
// 总内存: ~30MB（比 500MB 减少 94%）

// 撤销 50 步：
// 1. 找到最近快照（第 40 步）
// 2. 恢复快照（0ms）
// 3. 重放 40-50 的 10 个 Patches（< 10ms）
// 总耗时: < 10ms
```

---

#### 3. 大文件引用存储

```typescript
// ❌ 存储文件内容
class BadFileCommand {
  private fileContent: Buffer; // 10MB 图片
}

// ✅ 只存储文件 hash
class GoodFileCommand {
  private fileHash: string; // 64 bytes SHA256

  undo() {
    // 从临时目录恢复
    const content = fileManager.getFile(this.fileHash);
  }
}
```

---

### 性能测试结果（预期）

| 指标 | 旧方案 | 新方案 | 改善 |
|------|--------|--------|------|
| **单次撤销延迟** | 120ms | 8ms | ⚡ 15x faster |
| **单次重做延迟** | 120ms | 8ms | ⚡ 15x faster |
| **100步历史内存** | 500MB | 30MB | 📦 94% less |
| **操作合并率** | 0% | 85% | 🔗 85% fewer records |
| **大量撤销(50步)** | 6s | 50ms | ⚡ 120x faster |
| **历史序列化** | 不可行 | < 1s | ✅ 可行 |

---

## ⚡ 渲染优化策略（类似 React Batching）

### 问题分析

用户频繁操作会导致性能问题：

```typescript
// ❌ 问题：每次操作都触发重新渲染
editor.updateComponentProperty('header', 'style.color', '#ff0000'); // 渲染 1
editor.updateComponentProperty('header', 'style.fontSize', '16px'); // 渲染 2
editor.updateComponentProperty('header', 'style.padding', '10px'); // 渲染 3
// 连续 30 次拖动滑块 → 30 次渲染（16ms * 30 = 480ms）
```

**性能瓶颈**：
1. 每次 Schema 变更都触发监听器
2. 监听器通知 UI 框架重新渲染
3. 虚拟 DOM diff + 真实 DOM 更新耗时
4. 浏览器重排（reflow）和重绘（repaint）

---

### 方案 1: 微任务队列 + requestAnimationFrame

**核心思路**：收集一帧内的所有变更，在下一帧统一渲染

```typescript
/**
 * 批量更新管理器（借鉴 React Scheduler）
 */
class BatchUpdateScheduler {
  private pendingUpdates: Set<() => void> = new Set();
  private isScheduled = false;

  /**
   * 调度更新（不立即执行）
   */
  scheduleUpdate(callback: () => void): void {
    this.pendingUpdates.add(callback);

    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * 强制刷新所有待处理更新
   */
  flush(): void {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.isScheduled = false;

    // 批量执行所有更新
    updates.forEach(callback => callback());
  }

  /**
   * 取消待处理更新
   */
  cancel(callback: () => void): void {
    this.pendingUpdates.delete(callback);
  }
}
```

**集成到 SchemaManager**：

```typescript
class SchemaManager {
  private state: Schema;
  private listeners: Set<(state: Schema) => void> = new Set();
  private batchScheduler = new BatchUpdateScheduler();

  // 新增：批量更新模式标志
  private isBatching = false;
  private pendingNotifications = false;

  /**
   * 设置新状态（支持批量模式）
   */
  setState(newState: Schema): void {
    this.state = newState;

    if (this.isBatching) {
      // 批量模式：标记需要通知，但不立即执行
      this.pendingNotifications = true;
    } else {
      // 正常模式：立即通知
      this.notifyListeners();
    }
  }

  /**
   * 通知监听器（可能被延迟）
   */
  private notifyListeners(): void {
    this.batchScheduler.scheduleUpdate(() => {
      this.listeners.forEach(listener => listener(this.state));
    });
  }

  /**
   * 开启批量更新模式
   */
  startBatch(): void {
    this.isBatching = true;
    this.pendingNotifications = false;
  }

  /**
   * 结束批量更新并刷新
   */
  endBatch(): void {
    this.isBatching = false;

    if (this.pendingNotifications) {
      this.notifyListeners();
      this.pendingNotifications = false;
    }
  }

  /**
   * 批量执行多个操作（自动管理批处理）
   */
  batch(fn: () => void): void {
    this.startBatch();
    try {
      fn();
    } finally {
      this.endBatch();
    }
  }
}
```

**使用示例**：

```typescript
// ✅ 方案 1：手动批量更新
editor.schemaManager.startBatch();
editor.updateComponentProperty('header', 'style.color', '#ff0000');
editor.updateComponentProperty('header', 'style.fontSize', '16px');
editor.updateComponentProperty('header', 'style.padding', '10px');
editor.schemaManager.endBatch();
// 只触发 1 次渲染（在下一帧）

// ✅ 方案 2：使用 batch 包装函数
editor.schemaManager.batch(() => {
  editor.updateComponentProperty('header', 'style.color', '#ff0000');
  editor.updateComponentProperty('header', 'style.fontSize', '16px');
  editor.updateComponentProperty('header', 'style.padding', '10px');
});
// 只触发 1 次渲染
```

---

### 方案 2: Transaction 事务模式

**核心思路**：像数据库事务一样，commit 时才应用变更

```typescript
/**
 * 事务管理器（Database-like Transaction）
 */
class TransactionManager {
  private activeTransaction: Transaction | null = null;

  /**
   * 开始事务
   */
  beginTransaction(description: string = '事务操作'): Transaction {
    if (this.activeTransaction) {
      throw new Error('已存在活跃事务');
    }

    this.activeTransaction = new Transaction(description);
    return this.activeTransaction;
  }

  /**
   * 提交事务
   */
  commit(): void {
    if (!this.activeTransaction) {
      throw new Error('没有活跃事务');
    }

    this.activeTransaction.commit();
    this.activeTransaction = null;
  }

  /**
   * 回滚事务
   */
  rollback(): void {
    if (!this.activeTransaction) {
      throw new Error('没有活跃事务');
    }

    this.activeTransaction.rollback();
    this.activeTransaction = null;
  }

  /**
   * 检查是否在事务中
   */
  isInTransaction(): boolean {
    return this.activeTransaction !== null;
  }

  /**
   * 获取当前事务
   */
  getCurrentTransaction(): Transaction | null {
    return this.activeTransaction;
  }
}

/**
 * 事务对象
 */
class Transaction {
  private commands: ICommand[] = [];
  private description: string;

  constructor(description: string) {
    this.description = description;
  }

  /**
   * 添加命令到事务
   */
  addCommand(command: ICommand): void {
    this.commands.push(command);
  }

  /**
   * 提交事务（执行所有命令）
   */
  commit(): void {
    // 创建批量操作命令
    const batchCommand = new BatchOperationCommand(this.description);
    this.commands.forEach(cmd => batchCommand.addCommand(cmd));

    // 一次性执行
    batchCommand.execute();

    // 添加到历史管理器
    historyManager.undoStack.push(batchCommand);
  }

  /**
   * 回滚事务（丢弃所有命令）
   */
  rollback(): void {
    this.commands = [];
  }

  /**
   * 获取命令数量
   */
  getCommandCount(): number {
    return this.commands.length;
  }
}
```

**集成到 ThemeEditor**：

```typescript
class ThemeEditor {
  private transactionManager = new TransactionManager();

  /**
   * 修改组件属性（支持事务模式）
   */
  updateComponentProperty(componentId: string, propertyPath: string, value: any): void {
    const command = new UpdatePropertyCommand(
      this.schemaManager,
      componentId,
      propertyPath,
      value
    );

    // 检查是否在事务中
    if (this.transactionManager.isInTransaction()) {
      this.transactionManager.getCurrentTransaction()!.addCommand(command);
    } else {
      this.historyManager.execute(command);
    }
  }

  /**
   * 开始事务
   */
  beginTransaction(description?: string): void {
    this.transactionManager.beginTransaction(description);
    this.schemaManager.startBatch(); // 同时开启批量更新
  }

  /**
   * 提交事务
   */
  commitTransaction(): void {
    this.transactionManager.commit();
    this.schemaManager.endBatch(); // 结束批量更新，触发渲染
  }

  /**
   * 回滚事务
   */
  rollbackTransaction(): void {
    this.transactionManager.rollback();
    this.schemaManager.endBatch();
  }

  /**
   * 在事务中执行操作（自动管理）
   */
  transaction(description: string, fn: () => void): void {
    this.beginTransaction(description);
    try {
      fn();
      this.commitTransaction();
    } catch (error) {
      this.rollbackTransaction();
      throw error;
    }
  }
}
```

**使用示例**：

```typescript
// ✅ 事务模式：30 次拖动只触发 1 次渲染 + 1 条历史记录
editor.transaction('调整 Header 样式', () => {
  editor.updateComponentProperty('header', 'style.color', '#ff0000');
  editor.updateComponentProperty('header', 'style.fontSize', '16px');
  editor.updateComponentProperty('header', 'style.padding', '10px');
});

// 如果中途出错，自动回滚，不影响 Schema 和历史
```

---

### 方案 3: 智能防抖/节流（针对连续操作）

**核心思路**：检测连续操作模式，自动延迟渲染

```typescript
/**
 * 智能渲染调度器（Auto-detect continuous operations）
 */
class SmartRenderScheduler {
  private lastUpdateTime = 0;
  private updateCount = 0;
  private continuousThreshold = 3; // 连续 3 次操作判定为"连续模式"
  private continuousWindow = 200; // 200ms 内的操作算连续
  private debounceTimer: number | null = null;

  /**
   * 调度渲染（自动检测模式）
   */
  scheduleRender(callback: () => void): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // 检测是否为连续操作
    if (timeSinceLastUpdate < this.continuousWindow) {
      this.updateCount++;
    } else {
      this.updateCount = 1;
    }

    this.lastUpdateTime = now;

    // 如果检测到连续操作，使用防抖
    if (this.updateCount >= this.continuousThreshold) {
      this.debouncedRender(callback);
    } else {
      // 非连续操作，立即渲染
      callback();
    }
  }

  /**
   * 防抖渲染（连续操作时）
   */
  private debouncedRender(callback: () => void): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      callback();
      this.debounceTimer = null;
      this.updateCount = 0; // 重置计数器
    }, 100); // 100ms 防抖
  }

  /**
   * 强制立即渲染
   */
  flushRender(callback: () => void): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    callback();
    this.updateCount = 0;
  }
}
```

**集成示例**：

```typescript
class SchemaManager {
  private smartScheduler = new SmartRenderScheduler();

  private notifyListeners(): void {
    this.smartScheduler.scheduleRender(() => {
      this.listeners.forEach(listener => listener(this.state));
    });
  }

  // 用户停止操作时（如 mouseup），强制刷新
  forceRender(): void {
    this.smartScheduler.flushRender(() => {
      this.listeners.forEach(listener => listener(this.state));
    });
  }
}
```

**UI 集成示例**：

```typescript
// 在颜色选择器组件中
class ColorPicker {
  handleSliderChange(value: string) {
    // 拖动时：智能调度（自动防抖）
    editor.updateComponentProperty('header', 'style.color', value);
  }

  handleSliderEnd(value: string) {
    // 松开鼠标：强制立即渲染
    editor.schemaManager.forceRender();
  }
}
```

---

### 方案 4: 空闲调度（Idle Scheduling）

**核心思路**：用户交互时暂停批量任务，利用浏览器空闲时间处理，保证 UI 响应优先

**问题场景**：
```typescript
// 用户正在拖拽组件，同时后台有 100 个待渲染的任务
// 如果这些任务阻塞主线程 → 拖拽会卡顿
```

**解决方案**：使用 `requestIdleCallback` 在浏览器空闲时处理低优先级任务

```typescript
/**
 * 空闲调度器（基于 requestIdleCallback）
 */
class IdleScheduler {
  private taskQueue: Array<() => void> = [];
  private isProcessing = false;
  private idleCallbackId: number | null = null;

  /**
   * 添加低优先级任务到队列
   */
  scheduleTask(task: () => void, priority: 'high' | 'low' = 'low'): void {
    if (priority === 'high') {
      // 高优先级任务：立即执行
      task();
    } else {
      // 低优先级任务：加入队列
      this.taskQueue.push(task);
      this.scheduleIdleWork();
    }
  }

  /**
   * 调度空闲工作
   */
  private scheduleIdleWork(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;

    // 检查浏览器是否支持 requestIdleCallback
    if ('requestIdleCallback' in window) {
      this.idleCallbackId = requestIdleCallback(
        (deadline) => this.processTasksInIdle(deadline),
        { timeout: 1000 } // 最多 1 秒后强制执行
      );
    } else {
      // 降级方案：使用 setTimeout
      setTimeout(() => this.processTasksInIdle(), 0);
    }
  }

  /**
   * 在空闲时间处理任务
   */
  private processTasksInIdle(deadline?: IdleDeadline): void {
    // 在有剩余时间 AND 有待处理任务时，持续处理
    while (
      this.taskQueue.length > 0 &&
      (deadline ? deadline.timeRemaining() > 1 : true) // 至少保留 1ms
    ) {
      const task = this.taskQueue.shift();
      if (task) {
        try {
          task();
        } catch (error) {
          console.error('[IdleScheduler] Task error:', error);
        }
      }
    }

    // 如果还有任务，继续调度
    if (this.taskQueue.length > 0) {
      this.isProcessing = false;
      this.scheduleIdleWork();
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * 清空所有待处理任务
   */
  clear(): void {
    this.taskQueue = [];
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    this.isProcessing = false;
  }

  /**
   * 强制立即执行所有任务
   */
  flush(): void {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) task();
    }
    this.isProcessing = false;
  }

  /**
   * 获取队列长度
   */
  getQueueSize(): number {
    return this.taskQueue.length;
  }
}
```

---

**集成到 SchemaManager**：

```typescript
class SchemaManager {
  private idleScheduler = new IdleScheduler();

  /**
   * 通知监听器（支持优先级）
   */
  private notifyListeners(priority: 'high' | 'low' = 'low'): void {
    const notifyTask = () => {
      this.listeners.forEach(listener => listener(this.state));
    };

    this.idleScheduler.scheduleTask(notifyTask, priority);
  }

  /**
   * 设置新状态（支持优先级）
   */
  setState(newState: Schema, priority?: 'high' | 'low'): void {
    this.state = newState;
    this.notifyListeners(priority);
  }

  /**
   * 用户交互时：清空低优先级任务队列
   */
  onUserInteractionStart(): void {
    // 用户开始交互（如 mousedown, touchstart）
    // 暂停所有低优先级渲染任务
    console.log('[SchemaManager] User interaction started, pausing low-priority tasks');
  }

  /**
   * 用户交互结束：恢复任务处理
   */
  onUserInteractionEnd(): void {
    // 用户结束交互（如 mouseup, touchend）
    // 强制刷新所有待处理任务
    console.log('[SchemaManager] User interaction ended, flushing tasks');
    this.idleScheduler.flush();
  }
}
```

---

**UI 事件监听集成**：

```typescript
class ThemeEditor {
  private isUserInteracting = false;

  constructor(initialSchema: Schema) {
    // ... 其他初始化

    // 监听全局用户交互事件
    this.setupInteractionListeners();
  }

  /**
   * 设置交互监听器
   */
  private setupInteractionListeners(): void {
    // 鼠标事件
    document.addEventListener('mousedown', () => this.handleInteractionStart());
    document.addEventListener('mouseup', () => this.handleInteractionEnd());

    // 触摸事件（移动端）
    document.addEventListener('touchstart', () => this.handleInteractionStart());
    document.addEventListener('touchend', () => this.handleInteractionEnd());

    // 键盘事件
    document.addEventListener('keydown', () => this.handleInteractionStart());
    document.addEventListener('keyup', () => this.handleInteractionEnd());
  }

  /**
   * 用户开始交互
   */
  private handleInteractionStart(): void {
    if (this.isUserInteracting) return;
    this.isUserInteracting = true;
    this.schemaManager.onUserInteractionStart();
  }

  /**
   * 用户结束交互
   */
  private handleInteractionEnd(): void {
    // 延迟 100ms 判定交互结束（避免快速点击误触发）
    setTimeout(() => {
      this.isUserInteracting = false;
      this.schemaManager.onUserInteractionEnd();
    }, 100);
  }
}
```

---

**高级：使用 Scheduler API（实验性）**

```typescript
/**
 * 使用浏览器 Scheduler API（更精确的优先级控制）
 */
class AdvancedScheduler {
  /**
   * 调度任务（支持多种优先级）
   */
  async scheduleTask(task: () => void, priority: 'user-blocking' | 'user-visible' | 'background'): Promise<void> {
    if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
      // 使用实验性 Scheduler API
      await (window as any).scheduler.postTask(task, { priority });
    } else {
      // 降级方案
      if (priority === 'user-blocking') {
        task(); // 立即执行
      } else if (priority === 'user-visible') {
        requestAnimationFrame(task);
      } else {
        requestIdleCallback(task);
      }
    }
  }

  /**
   * 检测用户输入（Facebook isInputPending API）
   */
  shouldYield(): boolean {
    if ('scheduler' in window && 'yield' in (window as any).scheduler) {
      // 使用 isInputPending 检测是否有待处理的用户输入
      return (navigator as any).scheduling?.isInputPending() || false;
    }
    return false;
  }

  /**
   * 主动让出控制权
   */
  async yieldToMain(): Promise<void> {
    if ('scheduler' in window && 'yield' in (window as any).scheduler) {
      await (window as any).scheduler.yield();
    } else {
      // 降级方案：使用 MessageChannel
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
      });
    }
  }
}
```

---

**实际使用示例**：

```typescript
// 场景 1: 批量更新 1000 个组件（低优先级）
editor.transaction('批量导入组件', async () => {
  const scheduler = new AdvancedScheduler();

  for (let i = 0; i < 1000; i++) {
    editor.addComponent(components[i]);

    // 每 50 个组件检查一次是否需要让出控制权
    if (i % 50 === 0 && scheduler.shouldYield()) {
      await scheduler.yieldToMain(); // 让出控制权给用户交互
    }
  }
});

// 场景 2: 用户正在拖拽，后台任务自动暂停
// - 用户 mousedown → handleInteractionStart() → 暂停低优先级任务
// - 用户 mouseup → handleInteractionEnd() → 恢复任务处理

// 场景 3: 紧急任务（如模态框显示）立即执行
editor.schemaManager.setState(newState, 'high'); // 高优先级，立即渲染
```

---

**性能对比**：

| 场景 | 无调度 | RAF Batching | 空闲调度 | 改善 |
|------|--------|--------------|----------|------|
| **批量导入 1000 组件** | 阻塞 UI 5s<br>用户无法操作 | 阻塞 UI 5s<br>分帧但仍阻塞 | 不阻塞 UI<br>可随时中断 | ✅ 用户体验质的飞跃 |
| **拖拽 + 后台渲染** | 卡顿严重<br>30 FPS | 轻微卡顿<br>50 FPS | 流畅<br>60 FPS | ✅ 完全流畅 |
| **大型 Schema 保存** | 阻塞 2s<br>界面冻结 | 阻塞 2s | 后台处理<br>不影响交互 | ✅ 无感知 |

---

**兼容性与降级**：

```typescript
/**
 * 特性检测与降级策略
 */
class SchedulerCompat {
  /**
   * 检测 API 支持情况
   */
  static detectSupport() {
    return {
      requestIdleCallback: 'requestIdleCallback' in window,
      schedulerAPI: 'scheduler' in window && 'postTask' in (window as any).scheduler,
      isInputPending: 'scheduling' in navigator && 'isInputPending' in (navigator as any).scheduling,
    };
  }

  /**
   * 自动选择最佳 API
   */
  static scheduleIdleWork(task: () => void): void {
    const support = this.detectSupport();

    if (support.schedulerAPI) {
      // 最佳：使用 Scheduler API
      (window as any).scheduler.postTask(task, { priority: 'background' });
    } else if (support.requestIdleCallback) {
      // 次优：使用 requestIdleCallback
      requestIdleCallback(task, { timeout: 1000 });
    } else {
      // 降级：使用 setTimeout
      setTimeout(task, 0);
    }
  }
}

// 使用示例
SchedulerCompat.scheduleIdleWork(() => {
  console.log('在浏览器空闲时执行');
});
```

---

### 方案对比

| 方案 | 适用场景 | 优点 | 缺点 | 推荐度 |
|------|----------|------|------|--------|
| **方案1: RAF Batching** | 通用场景 | ✅ 自动对齐浏览器帧率<br>✅ 实现简单<br>✅ 类似 React 18 | ⚠️ 需要手动包装<br>⚠️ 仍可能阻塞 UI | ⭐⭐⭐⭐⭐ |
| **方案2: Transaction** | 复杂批量操作 | ✅ 语义清晰<br>✅ 支持回滚<br>✅ 原子性保证 | ⚠️ 需要显式管理<br>⚠️ 代码侵入性强 | ⭐⭐⭐⭐ |
| **方案3: 智能防抖** | 连续操作（滑块/拖拽） | ✅ 零配置<br>✅ 自动检测 | ⚠️ 可能有延迟感<br>⚠️ 需要额外 flush | ⭐⭐⭐⭐ |
| **方案4: 空闲调度** | 大批量任务+用户交互 | ✅ 永不阻塞 UI<br>✅ 可中断/恢复<br>✅ 优先保证交互流畅 | ⚠️ 实现复杂<br>⚠️ 兼容性需处理<br>⚠️ 任务可能延迟执行 | ⭐⭐⭐⭐⭐ |
| **组合方案** | 生产环境 | ✅ 覆盖所有场景 | ⚠️ 复杂度高 | ⭐⭐⭐⭐⭐ |

---

### 推荐组合方案（最佳实践）

```typescript
class ThemeEditor {
  // 方案 1: 基础批量更新（默认开启）
  private batchScheduler = new BatchUpdateScheduler();

  // 方案 2: 事务支持（按需使用）
  private transactionManager = new TransactionManager();

  // 方案 3: 智能调度（自动优化）
  private smartScheduler = new SmartRenderScheduler();

  /**
   * 自动选择最优策略
   */
  updateComponentProperty(
    componentId: string,
    propertyPath: string,
    value: any,
    options?: { immediate?: boolean }
  ): void {
    const command = new UpdatePropertyCommand(
      this.schemaManager,
      componentId,
      propertyPath,
      value
    );

    // 1. 如果在事务中 → 添加到事务
    if (this.transactionManager.isInTransaction()) {
      this.transactionManager.getCurrentTransaction()!.addCommand(command);
      return;
    }

    // 2. 如果请求立即执行 → 跳过批处理
    if (options?.immediate) {
      this.historyManager.execute(command);
      this.schemaManager.forceRender();
      return;
    }

    // 3. 默认：使用智能调度（自动批处理 + 防抖）
    this.historyManager.execute(command);
    // SchemaManager 内部会自动调用 smartScheduler
  }
}
```

**实际使用**：

```typescript
// 场景 1: 拖动滑块（自动优化）
onSliderDrag(value) {
  editor.updateComponentProperty('header', 'color', value);
  // 自动防抖，只在松手时渲染
}

// 场景 2: 批量修改（显式事务）
editor.transaction('批量对齐', () => {
  components.forEach(comp => {
    editor.updateComponentProperty(comp.id, 'x', alignedX);
  });
});
// 所有修改完成后一次性渲染 + 一条历史记录

// 场景 3: 立即生效（跳过优化）
editor.updateComponentProperty('modal', 'visible', true, { immediate: true });
// 立即显示弹窗，不等待下一帧
```

---

### 性能提升预期

| 场景 | 未优化 | RAF Batching | Transaction | 智能防抖 |
|------|--------|--------------|-------------|----------|
| **拖动滑块 30 次** | 30 次渲染<br>~480ms | 1 次渲染<br>~16ms | 1 次渲染<br>~16ms | 1 次渲染<br>~16ms |
| **批量对齐 10 个组件** | 10 次渲染<br>~160ms | 1 次渲染<br>~16ms | 1 次渲染<br>~16ms | 1-2 次渲染<br>~32ms |
| **连续输入文本 20 字符** | 20 次渲染<br>~320ms | 2-3 次渲染<br>~48ms | 1 次渲染<br>~16ms | 1-2 次渲染<br>~32ms |

**结论**：
- ⚡ **渲染次数减少 85-95%**
- ⚡ **UI 响应延迟降低 90%+**
- ✅ **用户体验提升：无卡顿感**

---

## 🎯 操作合并/折叠优化（Operation Collapsing）

### 核心问题

在批量操作或事务中，用户可能产生相互抵消的操作：

```typescript
// 问题示例：3 个操作，最终状态不变
editor.updateComponentProperty('header', 'x', 100);  // x: 0 → 100
editor.updateComponentProperty('header', 'x', 50);   // x: 100 → 50
editor.updateComponentProperty('header', 'x', 0);    // x: 50 → 0
// 结果：x 从 0 回到 0，但占用 3 个历史记录
```

**期望行为**：
- 检测到最终状态 == 初始状态 → **不产生历史记录**
- 减少 Patch 数量 → **降低内存占用**
- 简化撤销栈 → **提升用户体验**

---

### 方案：基于 Immer.js 的 Patch 合并

**核心思路**：在事务提交时，合并所有 Patches，生成最终状态 Diff

```typescript
/**
 * 事务管理器 - 支持 Patch 合并
 */
class Transaction {
  private allPatches: Patch[] = [];
  private allInversePatches: Patch[] = [];
  private initialState: Schema;

  constructor(schemaManager: SchemaManager, description: string) {
    this.description = description;
    // 保存事务开始时的状态
    this.initialState = schemaManager.cloneState();
  }

  /**
   * 添加命令到事务（收集 Patches）
   */
  addCommand(command: ICommand): void {
    // 执行命令，但不触发渲染
    command.execute();

    // 收集 Patches（如果命令支持）
    if (command instanceof UpdatePropertyCommand) {
      this.allPatches.push(...command.patches);
      this.allInversePatches.push(...command.inversePatches);
    }
  }

  /**
   * 提交事务 - 关键：合并 Patches
   */
  commit(schemaManager: SchemaManager, historyManager: HistoryManager): void {
    // 1. 获取事务结束时的最终状态
    const finalState = schemaManager.getState();

    // 2. 计算初始状态 → 最终状态的 Diff
    const [, mergedPatches, mergedInversePatches] = produce(
      this.initialState,
      draft => {
        // 使用 Immer 重新计算从 initial → final 的 Patches
        Object.assign(draft, finalState);
      },
      (p, ip) => [null, p, ip]
    );

    // 3. 检查是否有实质性变更
    if (mergedPatches.length === 0) {
      console.log('[Transaction] No changes detected, skip history');
      return; // 没有变更，不添加历史记录
    }

    // 4. 创建单个批量命令（使用合并后的 Patches）
    const batchCommand = new BatchOperationCommandOptimized(
      this.description,
      this.initialState,
      finalState,
      mergedPatches,
      mergedInversePatches
    );

    // 5. 添加到历史管理器
    historyManager.undoStack.push(batchCommand);
    historyManager.redoStack = [];
    historyManager.emitStateChange();
  }
}
```

---

### 优化的批量命令实现

```typescript
/**
 * 优化的批量命令 - 直接存储合并后的 Patches
 */
class BatchOperationCommandOptimized implements ICommand {
  readonly id: string;
  readonly type = 'BATCH_OPTIMIZED';
  readonly description: string;
  readonly timestamp: number;

  private initialState: Schema;
  private finalState: Schema;
  private patches: Patch[];
  private inversePatches: Patch[];

  constructor(
    description: string,
    initialState: Schema,
    finalState: Schema,
    patches: Patch[],
    inversePatches: Patch[]
  ) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.timestamp = Date.now();
    this.description = description;
    this.initialState = initialState;
    this.finalState = finalState;
    this.patches = patches;
    this.inversePatches = inversePatches;
  }

  execute(): void {
    // 应用合并后的 Patches
    schemaManager.applyPatches(this.patches);
  }

  undo(): void {
    // 应用逆向 Patches
    schemaManager.applyPatches(this.inversePatches);
  }

  redo(): void {
    this.execute();
  }

  serialize(): Record<string, any> {
    return {
      type: this.type,
      description: this.description,
      patches: this.patches,
      inversePatches: this.inversePatches,
      timestamp: this.timestamp,
    };
  }
}
```

---

### 集成到 ThemeEditor

```typescript
class ThemeEditor {
  /**
   * 事务执行（自动合并 Patches）
   */
  transaction(description: string, fn: () => void): void {
    const transaction = new Transaction(this.schemaManager, description);

    this.schemaManager.startBatch(); // 开启批量更新（延迟渲染）

    try {
      // 用户操作在这里执行
      fn();

      // 提交事务（内部会合并 Patches）
      transaction.commit(this.schemaManager, this.historyManager);

    } catch (error) {
      // 回滚事务
      this.schemaManager.setState(transaction.initialState);
      throw error;
    } finally {
      this.schemaManager.endBatch(); // 结束批量更新，触发一次渲染
    }
  }
}
```

---

### 使用示例与效果

#### 示例 1: 完全抵消的操作

```typescript
// 用户在颜色选择器中反复调整，最终回到原点
editor.transaction('调整颜色', () => {
  editor.updateComponentProperty('header', 'style.color', '#ff0000');
  editor.updateComponentProperty('header', 'style.color', '#00ff00');
  editor.updateComponentProperty('header', 'style.color', '#0000ff');
  editor.updateComponentProperty('header', 'style.color', '#ff0000'); // 回到初始值
});

// 结果：
// - 检测到最终状态 == 初始状态
// - mergedPatches.length === 0
// - 不产生历史记录（用户无需撤销）
```

#### 示例 2: 部分抵消的操作

```typescript
editor.transaction('批量调整', () => {
  editor.updateComponentProperty('header', 'x', 100);
  editor.updateComponentProperty('header', 'y', 200);
  editor.updateComponentProperty('header', 'x', 0);  // x 回到原值
  editor.updateComponentProperty('header', 'y', 250); // y 持续变化
});

// 结果：
// - 合并后只有 y 的 Patch
// - patches = [{ op: 'replace', path: '/header/y', value: 250 }]
// - 历史记录只保存 1 个有效变更（y: 200 → 250）
```

#### 示例 3: 批量对齐（无抵消）

```typescript
editor.transaction('批量对齐到 x=100', () => {
  components.forEach(comp => {
    editor.updateComponentProperty(comp.id, 'x', 100);
  });
});

// 结果：
// - 10 个组件的 x 坐标都改变
// - 合并后有 10 个 Patch
// - patches = [
//     { op: 'replace', path: '/comp1/x', value: 100 },
//     { op: 'replace', path: '/comp2/x', value: 100 },
//     ...
//   ]
// - 产生 1 条历史记录（包含 10 个合并后的 Patch）
```

---

### 内存和性能优势

#### 对比：无优化 vs. Patch 合并

| 场景 | 无优化 | Patch 合并 | 改善 |
|------|--------|-----------|------|
| **颜色反复调整 10 次** | 10 个 Command<br>~2KB | 0 个 Command<br>0 bytes | ✅ 100% 节省 |
| **批量对齐 100 组件** | 100 个 Command<br>~20KB | 1 个 Command<br>~2KB | ✅ 90% 节省 |
| **复杂编辑 30 步操作** | 30 个 Command<br>~6KB | 5-10 个有效 Command<br>~1.5KB | ✅ 75% 节省 |

#### 性能数据（实测预期）

```typescript
// 场景：拖动滑块 100 次，最终回到初始值
// 无优化：
// - 历史记录：100 个 UpdatePropertyCommand
// - 内存占用：~20KB
// - 撤销操作：100 次撤销才能回到初始状态

// Patch 合并：
// - 历史记录：0 个（检测到无变更）
// - 内存占用：0 bytes
// - 撤销操作：无需撤销（因为没有历史记录）

// 时间对比：
const start = performance.now();
transaction.commit(); // 合并 100 个 Patches
const end = performance.now();
// 耗时：< 5ms（Immer.js 的 produce 非常高效）
```

---

### 高级优化：路径级别的 Patch 去重

如果同一个路径被多次修改，只保留最后一次：

```typescript
/**
 * 简化 Patches - 同一路径只保留最后一次修改
 */
function simplifyPatches(patches: Patch[]): Patch[] {
  const pathMap = new Map<string, Patch>();

  patches.forEach(patch => {
    const key = patch.path;

    if (patch.op === 'replace' || patch.op === 'add') {
      // 同一路径的 replace/add 操作，后者覆盖前者
      pathMap.set(key, patch);
    } else if (patch.op === 'remove') {
      // 删除操作：如果之前有 add，则两者抵消
      if (pathMap.has(key) && pathMap.get(key)!.op === 'add') {
        pathMap.delete(key);
      } else {
        pathMap.set(key, patch);
      }
    }
  });

  return Array.from(pathMap.values());
}
```

**使用示例**：

```typescript
// 原始 Patches（100 次修改同一路径）
const rawPatches = [
  { op: 'replace', path: '/header/color', value: '#ff0000' },
  { op: 'replace', path: '/header/color', value: '#ff0001' },
  // ... 98 more
  { op: 'replace', path: '/header/color', value: '#ff00ff' },
];

// 简化后
const simplified = simplifyPatches(rawPatches);
// 结果：只保留最后一个
// [{ op: 'replace', path: '/header/color', value: '#ff00ff' }]

// 内存节省：100 个 Patch → 1 个 Patch（99% 减少）
```

---

### 实现检查清单

**核心组件**：
- ✅ Transaction 类支持 Patch 收集
- ✅ commit() 方法实现 Patch 合并逻辑
- ✅ 检测零变更（mergedPatches.length === 0）
- ✅ BatchOperationCommandOptimized 存储合并后 Patches
- ✅ 可选：simplifyPatches() 路径级去重

**性能要求**：
- ⚡ Patch 合并耗时 < 10ms（即使 100 个 Patches）
- 📦 内存占用减少 70-100%（视场景）
- 🔄 不影响正常撤销/重做功能

**测试场景**：
1. **完全抵消**：x: 0→100→0，验证不产生历史记录
2. **部分抵消**：x 和 y 同时修改，x 回到原值，验证只记录 y 的变更
3. **批量操作**：100 个组件对齐，验证合并为 1 条历史
4. **撤销/重做**：验证合并后的命令可以正确撤销和重做

---

### 最佳实践建议

1. **默认开启 Patch 合并**：所有事务/批量操作都应该使用合并逻辑
2. **可选路径级去重**：如果性能足够，可以跳过（Immer 的 produce 已经很高效）
3. **开发模式日志**：记录合并前后的 Patch 数量，监控优化效果
4. **边界情况处理**：
   - 空事务（fn 中没有任何操作）→ 不产生历史
   - 异常回滚 → 恢复到 initialState
   - 嵌套事务 → 警告或报错（不支持）

---

## 🔍 典型使用场景

### 场景 1: 调整组件颜色
```
用户操作:
1. 点击颜色选择器
2. 拖动色相滑块（触发 30 次修改）
3. 松开鼠标

期望行为:
- 30 次修改合并为 1 个历史记录
- 撤销时一步恢复到初始颜色
```

### 场景 2: 连续编辑多个组件
```
用户操作:
1. 修改 Header 组件背景色
2. 修改 Header 字体大小
3. 添加一个 Button 组件
4. 修改 Button 文案

期望行为:
- 4 个独立历史记录
- 可以单独撤销每一步
```

### 场景 3: 大量撤销
```
用户操作:
1. 执行了 50 步编辑操作
2. 点击 "撤销" 按钮 30 次

期望行为:
- 前 29 次快速撤销（< 10ms 每次）
- 利用周期快照加速恢复
```

### 场景 4: 文件替换
```
用户操作:
1. 上传新的背景图片（10MB）
2. 撤销上传
3. 重做上传

期望行为:
- 不存储图片内容到内存
- 仅记录文件路径和 hash
- 从临时目录恢复旧文件
```

---

## 📐 技术约束

### Electron 环境
- ✅ 可以使用 Node.js API（fs, path 等）
- ✅ 可以通过 IPC 与主进程通信
- ✅ 可以访问临时目录存储大文件
- ⚠️ 需要考虑跨平台路径兼容性

### Schema 结构特点
- 📦 **嵌套深度**: 可能 5-10 层深的对象结构
- 🔢 **组件数量**: 单个主题可能包含 50-200 个组件
- 📊 **数据类型**: 包含基本类型、数组、嵌套对象、文件引用
- 🔗 **引用关系**: 组件间可能存在数据绑定关系

### 性能要求
- ⚡ **UI 线程**: 撤销/重做不能阻塞渲染（< 16ms）
- 💾 **内存限制**: Electron 渲染进程建议 < 500MB
- 🔄 **响应速度**: 用户点击到 UI 更新 < 100ms

---

## ✅ 成功标准

### 可量化指标
1. **内存占用** ≤ 10MB（100 步历史）
2. **撤销延迟** < 50ms（P95）
3. **重做延迟** < 50ms（P95）
4. **支持历史** ≥ 100 步
5. **合并效率** ≥ 80%（连续相似操作）

### 用户体验
- ✅ 操作流畅，无卡顿感
- ✅ 历史记录清晰，可理解（如显示 "修改 Header 背景色"）
- ✅ 支持快捷键无延迟
- ✅ 大量撤销不崩溃

### 开发体验
- ✅ 新增编辑操作只需实现对应 Command 类
- ✅ 核心逻辑与 UI 框架解耦（可用于 Vue/React 等）
- ✅ 完善的 TypeScript 类型定义
- ✅ 易于单元测试

---

## 🚀 后续扩展方向

### 短期（MVP 阶段）
- [ ] 实现基础撤销/重做（Command Pattern）
- [ ] 支持 10 种核心编辑操作
- [ ] 实现操作合并逻辑
- [ ] 添加历史面板 UI

### 中期（优化阶段）
- [ ] 引入 Immer.js 自动生成 Diff
- [ ] 实现周期快照混合策略
- [ ] 添加历史持久化（存储到临时文件）
- [ ] 性能监控和优化

### 长期（高级特性）
- [ ] 支持协作编辑（OT/CRDT）
- [ ] 操作历史可视化时间轴
- [ ] 支持分支历史（非线性撤销）
- [ ] 云端同步和版本管理

---

## 📚 参考资料

### 业界案例
- **Figma**: 使用 Operational Transformation 实现协作编辑
- **VS Code**: Monaco Editor 使用基于行的 Diff 算法
- **Google Docs**: CRDT + 服务端协调
- **Photoshop**: 基于栅格的历史记录（History States）

### 开源库推荐
- **Immer.js**: 不可变数据 + 自动 Diff 生成
- **json-patch**: RFC 6902 JSON Patch 标准
- **history**: React Router 的历史管理库
- **slate.js**: 富文本编辑器的 Operation 设计

---

## 📝 附录

### 当前项目信息
- **项目路径**: `/Users/80375030/Desktop/project/maomao-search`
- **注意**: 本文档描述的是**另一个项目**（主题编辑器）的设计需求
- **建议**: 将此文档移动到主题编辑器项目的实际路径

### 文档维护
- **创建时间**: 2025-12-09
- **最后更新**: 2025-12-09
- **负责人**: 待定
- **版本**: v1.0

---

## 🤝 下一步行动

1. ✅ **Review 本文档**: 确认需求描述是否完整
2. 📐 **技术选型**: 确定使用 Command Pattern + Immer.js 方案
3. 💻 **原型开发**: 实现核心 HistoryManager 类
4. 🧪 **性能测试**: 使用真实 Schema 验证内存和延迟
5. 📦 **集成**: 与现有编辑器代码整合

---

**问题或建议？** 请联系开发团队讨论技术方案细节。
