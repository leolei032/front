# 通用 Undo/Redo 模块设计文档

> **版本**: v1.0 | **更新日期**: 2025-12-16 | **状态**: 架构设计 | **技术栈**: TypeScript + Immer.js

---

## 📑 文档导读

### 目标

将锁屏编辑器的 Undo/Redo 方案抽象为**业务无关的通用模块**，支持多种编辑器（锁屏、主题、Widget 等）复用核心能力。

### 核心特性

- ✅ **业务无关**: 核心层不依赖具体业务数据结构
- ✅ **插件化**: 通过插件扩展业务特定功能（文件管理、UI 同步等）
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **高性能**: RAF + 防抖 + Map 去重（继承原方案优势）
- ✅ **易集成**: 提供适配器基类，新业务 1-2 天即可接入

### 阅读路径

| 角色 | 推荐章节 | 预计时间 |
|------|---------|---------|
| **架构师** | 1-3 章（架构设计） | 30 分钟 |
| **核心开发** | 全部章节 | 2-3 小时 |
| **业务开发** | 4-6 章（使用指南） | 1 小时 |

---

## 📐 1. 整体架构设计

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    业务层 (Business Layer)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 锁屏编辑器   │  │ 主题编辑器   │  │ Widget编辑器 │      │
│  │ Adapter      │  │ Adapter      │  │ Adapter      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
│                  实现适配器接口                               │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│              通用核心层 (Core Layer)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UniversalHistoryManager<TState>                       │ │
│  │  - modify() / undo() / redo()                          │ │
│  │  - RAF + 防抖批处理                                     │ │
│  │  - 快照管理                                             │ │
│  │  - 插件系统                                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  RuntimeStateManager<TState>                           │ │
│  │  - modify() - 基于 Immer 生成 Patch                    │ │
│  │  - applyPatches() - 应用 Patch                         │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────┘
                            │
                   插件接口 (HistoryPlugin)
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                 扩展层 (Extension Layer)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ UI同步插件   │  │ 文件池插件   │  │ 性能监控插件 │      │
│  │ UIUpdate     │  │ FilePool     │  │ Performance  │      │
│  │ Plugin       │  │ Plugin       │  │ Monitor      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 自动保存插件 │  │ 历史面板插件 │  │ 自定义插件   │      │
│  │ AutoSave     │  │ HistoryPanel │  │ Custom       │      │
│  │ Plugin       │  │ Plugin       │  │ Plugin       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 | 实现方式 |
|------|------|---------|
| **依赖倒置** | 核心层不依赖业务 | 泛型 `<TState>` + 插件接口 |
| **开闭原则** | 核心稳定，扩展开放 | 插件系统 |
| **单一职责** | 核心只管 Patch | 业务逻辑在适配器 |
| **接口隔离** | 插件按需实现 | 可选的钩子函数 |

---

## 🏗️ 2. 核心层 API 设计

### 2.1 UniversalHistoryManager

```typescript
/**
 * 通用历史管理器 (业务无关)
 *
 * @template TState - 业务状态类型
 */
class UniversalHistoryManager<TState = any> {
  private runtimeManager: RuntimeStateManager<TState>
  private undoStack: PatchGroup[] = []
  private redoStack: PatchGroup[] = []
  private plugins: HistoryPlugin[] = []
  private snapshots = new Map<number, Snapshot<TState>>()

  // RAF + 防抖
  private pendingPatchGroups = new Map<string, PatchGroup>()
  private rafTimer: number | null = null
  private debounceTimer: number | null = null

  // 配置
  private max: number
  private snapshotInterval: number
  private debounceDelay: number

  /**
   * 构造函数
   */
  constructor(config: HistoryConfig<TState>) {
    this.runtimeManager = new RuntimeStateManager(config.initialState)
    this.max = config.max ?? 100
    this.snapshotInterval = config.snapshotInterval ?? 20
    this.debounceDelay = config.debounceDelay ?? 30

    // 注册插件
    config.plugins?.forEach(plugin => this.use(plugin))
  }

  /**
   * ⭐ 核心方法: 修改状态并记录历史
   *
   * @param description - 操作描述（人类可读）
   * @param updater - 状态修改函数
   * @param options - 可选配置
   */
  modify(
    description: string,
    updater: (draft: TState) => void,
    options?: ModifyOptions
  ): void {
    // 1. 生成 Patch
    const { patches, inversePatches } = this.runtimeManager.modify(updater)

    // 2. 触发插件钩子 (beforeModify)
    const shouldContinue = this.triggerHook('beforeModify', {
      patches,
      inversePatches,
      description,
      options
    })
    if (shouldContinue === false) return

    // 3. 加入队列 (Map 去重)
    const key = options?.key || this.generateKey(patches)
    this.pendingPatchGroups.set(key, {
      patches,
      inversePatches,
      description,
      timestamp: Date.now(),
      metadata: options?.metadata // 业务自定义元数据
    })

    // 4. RAF 批量渲染
    this.scheduleRender()

    // 5. 防抖记录历史
    this.scheduleRecord()

    // 6. 触发插件钩子 (afterModify)
    this.triggerHook('afterModify', { patches, inversePatches, description })
  }

  /**
   * 撤销操作
   *
   * @param steps - 撤销步数
   * @returns 是否成功
   */
  undo(steps = 1): boolean {
    // 强制提交待处理的操作
    this.forceFlush()

    for (let i = 0; i < steps && this.canUndo(); i++) {
      const group = this.undoStack.pop()!

      // 触发插件钩子 (beforeUndo)
      const shouldContinue = this.triggerHook('beforeUndo', group)
      if (shouldContinue === false) {
        this.undoStack.push(group) // 放回栈
        break
      }

      try {
        // 应用反向 Patch
        this.runtimeManager.applyPatches(group.inversePatches)

        // 移动到重做栈
        this.redoStack.push(group)

        // 触发插件钩子 (afterUndo)
        this.triggerHook('afterUndo', { group, success: true })

        console.log(`[Undo] ${group.description}`)
      } catch (error) {
        console.error('[Undo Failed]', error)

        // 触发错误钩子
        this.triggerHook('onError', { type: 'undo', error, group })

        // 回滚失败，放回栈
        this.undoStack.push(group)
        return false
      }
    }

    return true
  }

  /**
   * 重做操作
   *
   * @param steps - 重做步数
   * @returns 是否成功
   */
  redo(steps = 1): boolean {
    for (let i = 0; i < steps && this.canRedo(); i++) {
      const group = this.redoStack.pop()!

      // 触发插件钩子 (beforeRedo)
      const shouldContinue = this.triggerHook('beforeRedo', group)
      if (shouldContinue === false) {
        this.redoStack.push(group)
        break
      }

      try {
        // 应用正向 Patch
        this.runtimeManager.applyPatches(group.patches)

        // 移动到撤销栈
        this.undoStack.push(group)

        // 触发插件钩子 (afterRedo)
        this.triggerHook('afterRedo', { group, success: true })

        console.log(`[Redo] ${group.description}`)
      } catch (error) {
        console.error('[Redo Failed]', error)

        this.triggerHook('onError', { type: 'redo', error, group })

        this.redoStack.push(group)
        return false
      }
    }

    return true
  }

  /**
   * 获取当前状态（只读）
   */
  getState(): Readonly<TState> {
    return this.runtimeManager.getState()
  }

  /**
   * 获取历史状态
   */
  getHistoryState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      pendingCount: this.pendingPatchGroups.size
    }
  }

  /**
   * 注册插件
   */
  use(plugin: HistoryPlugin): void {
    plugin.install?.(this)
    this.plugins.push(plugin)
  }

  /**
   * 立即刷新（强制提交待处理的操作）
   */
  forceFlush(): void {
    if (this.rafTimer !== null) {
      cancelAnimationFrame(this.rafTimer)
      this.rafTimer = null
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.flushRender()
    this.recordToHistory()
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.pendingPatchGroups.clear()
    this.snapshots.clear()

    this.triggerHook('onClear', {})
  }

  // ========== 私有方法 ==========

  private scheduleRender(): void {
    if (this.rafTimer !== null) return

    this.rafTimer = requestAnimationFrame(() => {
      this.flushRender()
    })
  }

  private flushRender(): void {
    if (this.pendingPatchGroups.size === 0) {
      this.rafTimer = null
      return
    }

    const groups = Array.from(this.pendingPatchGroups.values())

    // 触发插件钩子 (onRender)
    this.triggerHook('onRender', { groups })

    this.rafTimer = null
  }

  private scheduleRecord(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.recordToHistory()
    }, this.debounceDelay)
  }

  private recordToHistory(): void {
    if (this.pendingPatchGroups.size === 0) {
      this.debounceTimer = null
      return
    }

    const groups = Array.from(this.pendingPatchGroups.values())

    // 添加到历史栈
    groups.forEach(group => {
      this.undoStack.push(group)
    })

    // 清空重做栈
    this.redoStack = []

    // 裁剪 + 快照
    this.trim()
    this.saveSnapshotIfNeeded()

    // 清空队列
    this.pendingPatchGroups.clear()
    this.debounceTimer = null

    // 触发插件钩子 (onRecord)
    this.triggerHook('onRecord', { groups, totalCount: this.undoStack.length })
  }

  private generateKey(patches: Patch[]): string {
    if (patches.length === 0) return `empty_${Date.now()}`
    return patches[0].path.join(':')
  }

  private saveSnapshotIfNeeded(): void {
    const currentIndex = this.undoStack.length

    if (currentIndex % this.snapshotInterval === 0 && currentIndex > 0) {
      const state = this.runtimeManager.clone()
      this.snapshots.set(currentIndex, {
        state,
        timestamp: Date.now()
      })

      console.log(`[Snapshot] Saved at index ${currentIndex}`)

      // 限制快照数量
      if (this.snapshots.size > 10) {
        const oldestKey = Math.min(...this.snapshots.keys())
        this.snapshots.delete(oldestKey)
      }
    }
  }

  private trim(): void {
    if (this.undoStack.length > this.max) {
      const removeCount = this.undoStack.length - this.max
      this.undoStack.splice(0, removeCount)

      // 清理对应的快照
      this.snapshots.forEach((_, index) => {
        if (index < removeCount) {
          this.snapshots.delete(index)
        }
      })
    }
  }

  private triggerHook(hookName: keyof HistoryPlugin, data: any): any {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName]
      if (hook && typeof hook === 'function') {
        try {
          const result = hook.call(plugin, data)
          if (result === false) return false
        } catch (error) {
          console.error(`[Plugin Error] ${plugin.name}.${hookName}:`, error)
        }
      }
    }
  }

  private canUndo(): boolean {
    return this.undoStack.length > 0
  }

  private canRedo(): boolean {
    return this.redoStack.length > 0
  }
}
```

---

### 2.2 RuntimeStateManager

```typescript
/**
 * 运行时状态管理器 (业务无关)
 *
 * @template TState - 业务状态类型
 */
class RuntimeStateManager<TState = any> {
  private state: TState

  constructor(initialState: TState) {
    this.state = initialState
  }

  /**
   * 修改状态并生成 Patch
   *
   * @param updater - 修改函数
   * @returns Patch 和反向 Patch
   */
  modify(updater: (draft: TState) => void): PatchResult {
    const [nextState, patches, inversePatches] = produceWithPatches(
      this.state,
      updater
    )

    this.state = nextState

    return { patches, inversePatches }
  }

  /**
   * 应用 Patch
   *
   * @param patches - Immer 标准 Patch 数组
   */
  applyPatches(patches: Patch[]): void {
    this.state = applyPatches(this.state, patches)
  }

  /**
   * 获取当前状态（只读）
   */
  getState(): Readonly<TState> {
    return this.state
  }

  /**
   * 直接设置状态（仅用于快照恢复）
   */
  setState(newState: TState): void {
    this.state = newState
  }

  /**
   * 克隆当前状态（用于快照）
   */
  clone(): TState {
    return JSON.parse(JSON.stringify(this.state))
  }
}
```

---

### 2.3 类型定义

```typescript
/**
 * 历史配置
 */
interface HistoryConfig<TState> {
  /** 初始状态 */
  initialState: TState

  /** 最大历史记录数 */
  max?: number

  /** 快照间隔（每 N 步） */
  snapshotInterval?: number

  /** 防抖延迟（毫秒） */
  debounceDelay?: number

  /** 插件列表 */
  plugins?: HistoryPlugin[]
}

/**
 * 修改选项
 */
interface ModifyOptions {
  /** 去重 key（用于高频操作合并） */
  key?: string

  /** 业务自定义元数据（传递给插件） */
  metadata?: Record<string, any>
}

/**
 * Patch 结果
 */
interface PatchResult {
  patches: Patch[]
  inversePatches: Patch[]
}

/**
 * Patch 组（历史记录单元）
 */
interface PatchGroup {
  patches: Patch[]
  inversePatches: Patch[]
  description: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Immer Patch 格式
 */
interface Patch {
  op: 'add' | 'remove' | 'replace'
  path: (string | number)[]
  value?: any
}

/**
 * 快照
 */
interface Snapshot<TState> {
  state: TState
  timestamp: number
}

/**
 * 历史状态
 */
interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  pendingCount: number
}
```

---

## 🔌 3. 插件系统设计

### 3.1 插件接口

```typescript
/**
 * 历史管理插件接口
 */
interface HistoryPlugin {
  /** 插件名称 */
  name: string

  /** 安装钩子（插件初始化） */
  install?(manager: UniversalHistoryManager): void

  /** 修改前钩子 */
  beforeModify?(data: BeforeModifyData): void | false

  /** 修改后钩子 */
  afterModify?(data: AfterModifyData): void

  /** 撤销前钩子 */
  beforeUndo?(group: PatchGroup): void | false

  /** 撤销后钩子 */
  afterUndo?(data: AfterUndoData): void

  /** 重做前钩子 */
  beforeRedo?(group: PatchGroup): void | false

  /** 重做后钩子 */
  afterRedo?(data: AfterRedoData): void

  /** 渲染钩子（RAF 触发） */
  onRender?(data: OnRenderData): void

  /** 记录钩子（防抖触发） */
  onRecord?(data: OnRecordData): void

  /** 错误钩子 */
  onError?(data: OnErrorData): void

  /** 清空钩子 */
  onClear?(data: {}): void
}

// 钩子数据类型
interface BeforeModifyData {
  patches: Patch[]
  inversePatches: Patch[]
  description: string
  options?: ModifyOptions
}

interface AfterModifyData {
  patches: Patch[]
  inversePatches: Patch[]
  description: string
}

interface AfterUndoData {
  group: PatchGroup
  success: boolean
}

interface AfterRedoData {
  group: PatchGroup
  success: boolean
}

interface OnRenderData {
  groups: PatchGroup[]
}

interface OnRecordData {
  groups: PatchGroup[]
  totalCount: number
}

interface OnErrorData {
  type: 'undo' | 'redo' | 'modify'
  error: Error
  group?: PatchGroup
}
```

---

### 3.2 通用插件实现

#### 3.2.1 性能监控插件

```typescript
/**
 * 性能监控插件（完全业务无关）
 */
class PerformanceMonitorPlugin implements HistoryPlugin {
  name = 'performance-monitor'

  private undoMetrics: number[] = []
  private redoMetrics: number[] = []
  private startTimer = 0

  beforeUndo() {
    this.startTimer = performance.now()
  }

  afterUndo(data: AfterUndoData) {
    const duration = performance.now() - this.startTimer
    this.undoMetrics.push(duration)

    if (duration > 50) {
      console.warn(`[Performance] Undo took ${duration.toFixed(2)}ms`)
    }
  }

  beforeRedo() {
    this.startTimer = performance.now()
  }

  afterRedo(data: AfterRedoData) {
    const duration = performance.now() - this.startTimer
    this.redoMetrics.push(duration)

    if (duration > 50) {
      console.warn(`[Performance] Redo took ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * 获取 P95 性能指标
   */
  getP95(type: 'undo' | 'redo'): number {
    const metrics = type === 'undo' ? this.undoMetrics : this.redoMetrics
    if (metrics.length === 0) return 0

    const sorted = [...metrics].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.95)]
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      undo: {
        count: this.undoMetrics.length,
        p95: this.getP95('undo'),
        avg: this.undoMetrics.reduce((a, b) => a + b, 0) / this.undoMetrics.length
      },
      redo: {
        count: this.redoMetrics.length,
        p95: this.getP95('redo'),
        avg: this.redoMetrics.reduce((a, b) => a + b, 0) / this.redoMetrics.length
      }
    }
  }
}
```

---

#### 3.2.2 自动保存插件

```typescript
/**
 * 自动保存插件（业务无关）
 */
class AutoSavePlugin implements HistoryPlugin {
  name = 'auto-save'

  private manager: UniversalHistoryManager | null = null
  private timer: number | null = null
  private interval: number
  private saveHandler: (state: any) => Promise<void>

  constructor(config: {
    interval?: number  // 保存间隔（毫秒）
    saveHandler: (state: any) => Promise<void>  // 业务保存逻辑
  }) {
    this.interval = config.interval ?? 30000  // 默认 30 秒
    this.saveHandler = config.saveHandler
  }

  install(manager: UniversalHistoryManager) {
    this.manager = manager
    this.startAutoSave()
  }

  onRecord() {
    // 每次记录历史后，重置定时器
    this.resetTimer()
  }

  private startAutoSave() {
    this.timer = setInterval(async () => {
      if (!this.manager) return

      try {
        const state = this.manager.getState()
        await this.saveHandler(state)
        console.log('[AutoSave] Saved successfully')
      } catch (error) {
        console.error('[AutoSave] Failed:', error)
      }
    }, this.interval) as any
  }

  private resetTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer)
    }
    this.startAutoSave()
  }

  /**
   * 停止自动保存
   */
  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
```

---

#### 3.2.3 历史面板插件

```typescript
/**
 * 历史面板插件（业务无关）
 */
class HistoryPanelPlugin implements HistoryPlugin {
  name = 'history-panel'

  private historyItems: HistoryItem[] = []
  private listeners: Set<(items: HistoryItem[]) => void> = new Set()

  afterModify(data: AfterModifyData) {
    // 暂不添加，等待 onRecord
  }

  onRecord(data: OnRecordData) {
    // 添加到历史面板
    data.groups.forEach(group => {
      this.historyItems.push({
        description: group.description,
        timestamp: group.timestamp,
        type: 'modify'
      })
    })

    this.notifyListeners()
  }

  afterUndo(data: AfterUndoData) {
    this.historyItems.push({
      description: `撤销: ${data.group.description}`,
      timestamp: Date.now(),
      type: 'undo'
    })

    this.notifyListeners()
  }

  afterRedo(data: AfterRedoData) {
    this.historyItems.push({
      description: `重做: ${data.group.description}`,
      timestamp: Date.now(),
      type: 'redo'
    })

    this.notifyListeners()
  }

  onClear() {
    this.historyItems = []
    this.notifyListeners()
  }

  /**
   * 订阅历史变化
   */
  subscribe(listener: (items: HistoryItem[]) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 获取历史列表
   */
  getHistory(): HistoryItem[] {
    return [...this.historyItems]
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      listener(this.historyItems)
    })
  }
}

interface HistoryItem {
  description: string
  timestamp: number
  type: 'modify' | 'undo' | 'redo'
}
```

---

### 3.3 业务相关插件（需业务实现）

#### 3.3.1 UI 同步插件接口

```typescript
/**
 * UI 同步插件（业务相关，需业务实现）
 */
class UIUpdatePlugin implements HistoryPlugin {
  name = 'ui-update'

  constructor(
    private uiStores: any,  // 业务的 UI Stores
    private patchDispatcher: PatchDispatcher  // 业务的 Patch 分发器
  ) {}

  onRender(data: OnRenderData) {
    // RAF 触发时，应用 Patch 到 UI
    data.groups.forEach(group => {
      this.patchDispatcher.apply(group.patches, this.uiStores)
    })
  }

  afterUndo(data: AfterUndoData) {
    // 撤销时，应用反向 Patch 到 UI
    this.patchDispatcher.apply(data.group.inversePatches, this.uiStores)
  }

  afterRedo(data: AfterRedoData) {
    // 重做时，应用正向 Patch 到 UI
    this.patchDispatcher.apply(data.group.patches, this.uiStores)
  }
}

/**
 * Patch 分发器接口（业务实现）
 */
interface PatchDispatcher {
  apply(patches: Patch[], uiStores: any): void
}
```

---

#### 3.3.2 文件池插件接口

```typescript
/**
 * 文件池插件（业务相关，需业务实现）
 */
class FilePoolPlugin implements HistoryPlugin {
  name = 'file-pool'

  constructor(private filePool: FilePoolManager) {}

  afterModify(data: AfterModifyData) {
    // 检测文件添加操作
    data.patches.forEach(patch => {
      if (this.isFileAddPatch(patch)) {
        const hash = patch.value?.hash
        if (hash) {
          this.filePool.addRef(hash)
        }
      }
    })
  }

  afterUndo(data: AfterUndoData) {
    // 从 metadata 中获取文件 hash
    const metadata = data.group.metadata
    if (metadata?.imageHash) {
      this.filePool.removeRef(metadata.imageHash)
    }
  }

  afterRedo(data: AfterRedoData) {
    const metadata = data.group.metadata
    if (metadata?.imageHash) {
      this.filePool.addRef(metadata.imageHash)
    }
  }

  private isFileAddPatch(patch: Patch): boolean {
    // 业务判断逻辑：是否是文件添加操作
    return patch.path.some(p => p === 'src') && patch.op === 'add'
  }
}

/**
 * 文件池管理器接口（业务实现）
 */
interface FilePoolManager {
  addRef(hash: string): void
  removeRef(hash: string): void
}
```

---

## 🎯 4. 业务适配器设计

### 4.1 适配器基类

```typescript
/**
 * 历史管理适配器基类
 *
 * @template TState - 业务状态类型
 */
abstract class HistoryAdapter<TState> {
  protected historyManager: UniversalHistoryManager<TState>

  constructor(config: HistoryConfig<TState>) {
    this.historyManager = new UniversalHistoryManager(config)
  }

  /**
   * 修改状态（业务调用）
   */
  protected modify(
    description: string,
    updater: (draft: TState) => void,
    options?: ModifyOptions
  ): void {
    this.historyManager.modify(description, updater, options)
  }

  /**
   * 撤销
   */
  undo(steps = 1): boolean {
    return this.historyManager.undo(steps)
  }

  /**
   * 重做
   */
  redo(steps = 1): boolean {
    return this.historyManager.redo(steps)
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<TState> {
    return this.historyManager.getState()
  }

  /**
   * 获取历史状态
   */
  getHistoryState(): HistoryState {
    return this.historyManager.getHistoryState()
  }

  /**
   * 强制刷新
   */
  forceFlush(): void {
    this.historyManager.forceFlush()
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.historyManager.clear()
  }

  /**
   * 注册插件
   */
  use(plugin: HistoryPlugin): void {
    this.historyManager.use(plugin)
  }
}
```

---

### 4.2 锁屏编辑器适配器示例

```typescript
/**
 * 锁屏状态类型
 */
interface LockscreenState {
  tree: {
    layers: Record<string, LayerNode>
    layerOrder: string[]
  }
  preview: Record<string, PreviewNode>
  json: {
    elements: JsonElement[]
  }
  vars: Variable[]
  xml: string
  meta: Record<string, any>
}

/**
 * 锁屏编辑器历史管理适配器
 */
class LockscreenHistoryAdapter extends HistoryAdapter<LockscreenState> {
  private filePool: FilePoolManager
  private uiStores: LockscreenUIStores

  constructor(
    initialState: LockscreenState,
    filePool: FilePoolManager,
    uiStores: LockscreenUIStores
  ) {
    super({
      initialState,
      max: 100,
      snapshotInterval: 20,
      plugins: [
        new UIUpdatePlugin(uiStores, new LockscreenPatchDispatcher()),
        new FilePoolPlugin(filePool),
        new PerformanceMonitorPlugin(),
        new AutoSavePlugin({
          interval: 30000,
          saveHandler: async (state) => {
            await saveLockscreenToServer(state)
          }
        })
      ]
    })

    this.filePool = filePool
    this.uiStores = uiStores
  }

  /**
   * 业务方法: 添加组件
   */
  async addComponent(name: string, imagePath?: string) {
    const newId = genId()
    let imageHash: string | undefined

    // 1. 文件预处理
    if (imagePath) {
      imageHash = await this.filePool.addFile(imagePath, `drawable/${path.basename(imagePath)}`)
    }

    // 2. 修改状态
    this.modify(
      `添加 ${name} 组件`,
      draft => {
        // 更新 tree
        draft.tree.layers[newId] = {
          id: newId,
          pid: 'root',
          type: name,
          name: name
        }

        // 更新 preview
        draft.preview[newId] = {
          id: newId,
          pid: 'root',
          meta: { x: 0, y: 0, w: 120, h: 120, visible: true },
          renderType: 'image'
        }

        // 更新 json
        draft.json.elements.push({
          name,
          attributes: {
            id: newId,
            src: imageHash ? { hash: imageHash } : undefined,
            x: '0',
            y: '0',
            w: '120',
            h: '120'
          }
        })
      },
      {
        key: `add:${newId}`,
        metadata: { imageHash }  // 传递给 FilePoolPlugin
      }
    )

    return newId
  }

  /**
   * 业务方法: 删除组件
   */
  deleteComponent(nodeId: string) {
    const state = this.getState()
    const node = state.json.elements.find(e => e.attributes?.id === nodeId)
    const imageHash = node?.attributes?.src?.hash

    this.modify(
      `删除组件 ${nodeId}`,
      draft => {
        delete draft.tree.layers[nodeId]
        delete draft.preview[nodeId]
        draft.json.elements = draft.json.elements.filter(
          e => e.attributes?.id !== nodeId
        )
      },
      {
        key: `delete:${nodeId}`,
        metadata: { imageHash }
      }
    )
  }

  /**
   * 业务方法: 更新属性
   */
  updateProperty(nodeId: string, property: string, value: any) {
    this.modify(
      `修改 ${property}`,
      draft => {
        const node = draft.preview[nodeId]
        if (node) {
          node.meta[property] = value
        }
      },
      {
        key: `update:${nodeId}:${property}`
      }
    )
  }

  /**
   * 业务方法: 移动节点
   */
  moveNode(nodeId: string, x: number, y: number) {
    this.modify(
      `移动节点 ${nodeId}`,
      draft => {
        const node = draft.preview[nodeId]
        if (node) {
          node.meta.x = x
          node.meta.y = y
        }
      },
      {
        key: `move:${nodeId}`  // 同一节点的移动操作会自动合并
      }
    )
  }
}
```

---

### 4.3 主题编辑器适配器示例

```typescript
/**
 * 主题状态类型
 */
interface ThemeState {
  global: GlobalConfig
  desktop: DesktopConfig
  allApps: AllAppsConfig
  lockscreen: LockscreenConfig
}

/**
 * 主题编辑器历史管理适配器
 */
class ThemeHistoryAdapter extends HistoryAdapter<ThemeState> {
  constructor(
    initialState: ThemeState,
    filePool: FilePoolManager,
    uiStores: ThemeUIStores
  ) {
    super({
      initialState,
      max: 100,
      plugins: [
        new UIUpdatePlugin(uiStores, new ThemePatchDispatcher()),
        new FilePoolPlugin(filePool),
        new PerformanceMonitorPlugin()
      ]
    })
  }

  /**
   * 业务方法: 修改桌面壁纸
   */
  async updateDesktopWallpaper(imagePath: string) {
    const imageHash = await this.filePool.addFile(imagePath, 'wallpaper/desktop.png')

    this.modify(
      '修改桌面壁纸',
      draft => {
        draft.desktop.wallpaper = {
          hash: imageHash,
          path: 'wallpaper/desktop.png'
        }
      },
      {
        metadata: { imageHash }
      }
    )
  }

  /**
   * 业务方法: 修改图标包
   */
  updateIconPack(iconPackId: string) {
    this.modify(
      '修改图标包',
      draft => {
        draft.global.iconPack = iconPackId
      }
    )
  }
}
```

---

### 4.4 Widget 编辑器适配器示例

```typescript
/**
 * Widget 状态类型
 */
interface WidgetState {
  components: WidgetComponent[]
  config: WidgetConfig
}

/**
 * Widget 编辑器历史管理适配器
 */
class WidgetHistoryAdapter extends HistoryAdapter<WidgetState> {
  constructor(
    initialState: WidgetState,
    uiStores: WidgetUIStores
  ) {
    super({
      initialState,
      max: 50,  // Widget 较简单，历史记录少一些
      plugins: [
        new UIUpdatePlugin(uiStores, new WidgetPatchDispatcher()),
        new PerformanceMonitorPlugin()
        // Widget 不需要 FilePool
      ]
    })
  }

  /**
   * 业务方法: 添加组件
   */
  addComponent(type: string) {
    const newId = genId()

    this.modify(
      `添加 ${type} 组件`,
      draft => {
        draft.components.push({
          id: newId,
          type,
          config: {}
        })
      },
      {
        key: `add:${newId}`
      }
    )
  }

  /**
   * 业务方法: 更新配置
   */
  updateConfig(key: string, value: any) {
    this.modify(
      `修改配置 ${key}`,
      draft => {
        draft.config[key] = value
      },
      {
        key: `config:${key}`
      }
    )
  }
}
```

---

## 📚 5. 使用指南

### 5.1 快速开始

#### 步骤 1: 定义业务状态类型

```typescript
// 定义你的业务状态
interface MyEditorState {
  nodes: Record<string, Node>
  edges: Edge[]
  config: Config
}
```

#### 步骤 2: 创建适配器

```typescript
class MyEditorHistoryAdapter extends HistoryAdapter<MyEditorState> {
  constructor(initialState: MyEditorState) {
    super({
      initialState,
      max: 100,
      plugins: [
        // 根据需要添加插件
        new PerformanceMonitorPlugin()
      ]
    })
  }

  // 实现业务方法
  addNode(node: Node) {
    this.modify(
      '添加节点',
      draft => {
        draft.nodes[node.id] = node
      }
    )
  }

  deleteNode(nodeId: string) {
    this.modify(
      '删除节点',
      draft => {
        delete draft.nodes[nodeId]
      }
    )
  }
}
```

#### 步骤 3: 初始化并使用

```typescript
// 初始化
const historyAdapter = new MyEditorHistoryAdapter({
  nodes: {},
  edges: [],
  config: {}
})

// 使用
historyAdapter.addNode({ id: 'node1', ... })
historyAdapter.deleteNode('node1')

// 撤销/重做
historyAdapter.undo()
historyAdapter.redo()
```

---

### 5.2 集成 UI 同步

#### 实现 PatchDispatcher

```typescript
class MyPatchDispatcher implements PatchDispatcher {
  apply(patches: Patch[], uiStores: any) {
    patches.forEach(patch => {
      const [root, ...rest] = patch.path

      switch (root) {
        case 'nodes':
          this.applyToNodesStore(patch, rest, uiStores.nodesStore)
          break
        case 'edges':
          this.applyToEdgesStore(patch, rest, uiStores.edgesStore)
          break
      }
    })
  }

  private applyToNodesStore(patch: Patch, path: any[], store: any) {
    const [nodeId, field] = path

    switch (patch.op) {
      case 'add':
        store.addNode(patch.value)
        break
      case 'remove':
        store.removeNode(nodeId)
        break
      case 'replace':
        store.updateNode(nodeId, { [field]: patch.value })
        break
    }
  }

  // ...
}
```

#### 注册 UI 同步插件

```typescript
const historyAdapter = new MyEditorHistoryAdapter(initialState)

historyAdapter.use(
  new UIUpdatePlugin(
    myUIStores,
    new MyPatchDispatcher()
  )
)
```

---

### 5.3 集成文件管理

#### 实现 FilePoolManager

```typescript
class MyFilePoolManager implements FilePoolManager {
  private refCount = new Map<string, number>()

  addRef(hash: string) {
    const count = this.refCount.get(hash) || 0
    this.refCount.set(hash, count + 1)
  }

  removeRef(hash: string) {
    const count = this.refCount.get(hash) || 0
    if (count <= 1) {
      this.refCount.delete(hash)
      // 标记为 GC
    } else {
      this.refCount.set(hash, count - 1)
    }
  }
}
```

#### 注册文件池插件

```typescript
const filePool = new MyFilePoolManager()

historyAdapter.use(
  new FilePoolPlugin(filePool)
)
```

---

### 5.4 高频操作合并

```typescript
// 拖拽场景：30 次 mousemove 合并为 1 条历史
function onMouseMove(nodeId: string, x: number, y: number) {
  historyAdapter.modify(
    `移动节点 ${nodeId}`,
    draft => {
      draft.nodes[nodeId].x = x
      draft.nodes[nodeId].y = y
    },
    {
      key: `move:${nodeId}`  // ⭐ 关键：指定 key，相同 key 会覆盖
    }
  )
}

// 用户拖拽触发 30 次
for (let i = 0; i < 30; i++) {
  onMouseMove('node1', 100 + i, 200 + i)
}
// 结果：只有 1 条历史记录（保留最后一次）
```

---

### 5.5 自定义插件

```typescript
/**
 * 自定义日志插件
 */
class LoggerPlugin implements HistoryPlugin {
  name = 'logger'

  afterModify(data: AfterModifyData) {
    console.log(`[Logger] Modified: ${data.description}`)
  }

  afterUndo(data: AfterUndoData) {
    console.log(`[Logger] Undid: ${data.group.description}`)
  }

  afterRedo(data: AfterRedoData) {
    console.log(`[Logger] Redid: ${data.group.description}`)
  }
}

// 使用
historyAdapter.use(new LoggerPlugin())
```

---

## 🔧 6. 最佳实践

### 6.1 状态设计原则

#### ✅ 使用对象 + 稳定 ID

```typescript
// ✅ 正确
interface State {
  nodes: Record<string, Node>  // 对象，key 是 ID
  nodeOrder: string[]           // 顺序数组
}

// ❌ 错误
interface State {
  nodes: Node[]  // 数组索引不稳定
}
```

#### ✅ 避免数据污染

```typescript
// ✅ 正确：UI 状态分离
interface State {
  data: { nodes: {} }      // 纯数据
  meta: { selected: [] }   // 元数据
}

// ❌ 错误：混合存储
interface State {
  nodes: {
    node1: {
      x: 100,
      __isSelected: true  // ❌ UI 状态污染数据
    }
  }
}
```

---

### 6.2 操作合并策略

| 场景 | key 设计 | 效果 |
|------|---------|------|
| **拖拽节点** | `move:${nodeId}` | 同一节点的移动合并 |
| **滑块调整** | `slider:${property}:${nodeId}` | 同一属性的调整合并 |
| **连续输入** | `input:${fieldId}` | 同一字段的输入合并 |
| **不同节点** | 不指定 key（自动生成） | 不合并 |

---

### 6.3 性能优化建议

#### 1. 控制历史深度

```typescript
// 简单编辑器
const historyAdapter = new MyAdapter({
  initialState,
  max: 50  // 50 步足够
})

// 复杂编辑器
const historyAdapter = new MyAdapter({
  initialState,
  max: 100  // 100 步
})
```

#### 2. 调整快照间隔

```typescript
// 频繁撤销场景
const historyAdapter = new MyAdapter({
  initialState,
  snapshotInterval: 10  // 每 10 步快照
})

// 正常场景
const historyAdapter = new MyAdapter({
  initialState,
  snapshotInterval: 20  // 每 20 步快照
})
```

#### 3. 调整防抖延迟

```typescript
// 高频操作多
const historyAdapter = new MyAdapter({
  initialState,
  debounceDelay: 50  // 延长防抖
})

// 正常场景
const historyAdapter = new MyAdapter({
  initialState,
  debounceDelay: 30  // 默认 30ms
})
```

---

### 6.4 错误处理

```typescript
// 监听错误
historyAdapter.use({
  name: 'error-handler',

  onError(data: OnErrorData) {
    // 记录错误
    console.error(`[Error] ${data.type}:`, data.error)

    // 上报到监控系统
    reportError({
      type: data.type,
      error: data.error,
      group: data.group
    })

    // 提示用户
    if (data.type === 'undo' || data.type === 'redo') {
      alert(`操作失败: ${data.error.message}`)
    }
  }
})
```

---

### 6.5 测试建议

#### 单元测试

```typescript
describe('MyEditorHistoryAdapter', () => {
  let adapter: MyEditorHistoryAdapter

  beforeEach(() => {
    adapter = new MyEditorHistoryAdapter({
      nodes: {},
      edges: []
    })
  })

  test('add and undo', () => {
    // 添加节点
    adapter.addNode({ id: 'node1', x: 0, y: 0 })
    expect(adapter.getState().nodes['node1']).toBeDefined()

    // 撤销
    adapter.undo()
    expect(adapter.getState().nodes['node1']).toBeUndefined()
  })

  test('high frequency merge', () => {
    // 模拟拖拽 30 次
    for (let i = 0; i < 30; i++) {
      adapter.moveNode('node1', i, i)
    }

    // 强制刷新
    adapter.forceFlush()

    // 检查历史记录数量
    expect(adapter.getHistoryState().undoCount).toBe(1)
  })
})
```

---

## 📊 7. 性能指标

### 7.1 性能目标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **单步撤销/重做** | < 50ms (P95) | Performance API |
| **内存占用** | < 100MB (100 步) | Chrome DevTools |
| **合并率** | > 90% | 拖拽场景 |
| **RAF 渲染** | < 16ms (60fps) | Performance Monitor |

### 7.2 性能监控

```typescript
// 使用性能监控插件
const perfMonitor = new PerformanceMonitorPlugin()
historyAdapter.use(perfMonitor)

// 定期检查性能
setInterval(() => {
  const stats = perfMonitor.getStats()

  if (stats.undo.p95 > 50) {
    console.warn('[Performance] Undo P95 exceeds 50ms:', stats.undo.p95)
  }

  if (stats.redo.p95 > 50) {
    console.warn('[Performance] Redo P95 exceeds 50ms:', stats.redo.p95)
  }
}, 60000)  // 每分钟检查
```

---

## 🚀 8. 实施路线图

### 阶段 1: 核心层开发（1 周）

- [ ] 实现 `RuntimeStateManager`
- [ ] 实现 `UniversalHistoryManager`
- [ ] 定义插件接口
- [ ] 编写单元测试

### 阶段 2: 通用插件开发（1 周）

- [ ] 实现 `PerformanceMonitorPlugin`
- [ ] 实现 `AutoSavePlugin`
- [ ] 实现 `HistoryPanelPlugin`
- [ ] 编写插件测试

### 阶段 3: 业务适配器（2 周）

- [ ] 锁屏编辑器适配器
- [ ] 主题编辑器适配器
- [ ] Widget 编辑器适配器
- [ ] 集成测试

### 阶段 4: 文档与示例（1 周）

- [ ] 完善 API 文档
- [ ] 编写使用示例
- [ ] 编写最佳实践指南
- [ ] 编写迁移指南

---

## 📦 9. NPM 包设计

### 9.1 包结构

```
@myapp/universal-history/
├── src/
│   ├── core/
│   │   ├── UniversalHistoryManager.ts
│   │   ├── RuntimeStateManager.ts
│   │   └── types.ts
│   ├── plugins/
│   │   ├── PerformanceMonitorPlugin.ts
│   │   ├── AutoSavePlugin.ts
│   │   └── HistoryPanelPlugin.ts
│   ├── adapters/
│   │   └── HistoryAdapter.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 9.2 导出接口

```typescript
// src/index.ts
export { UniversalHistoryManager } from './core/UniversalHistoryManager'
export { RuntimeStateManager } from './core/RuntimeStateManager'
export { HistoryAdapter } from './adapters/HistoryAdapter'

export { PerformanceMonitorPlugin } from './plugins/PerformanceMonitorPlugin'
export { AutoSavePlugin } from './plugins/AutoSavePlugin'
export { HistoryPanelPlugin } from './plugins/HistoryPanelPlugin'

export type {
  HistoryConfig,
  HistoryPlugin,
  ModifyOptions,
  PatchGroup,
  Patch,
  HistoryState
} from './core/types'
```

### 9.3 使用示例

```typescript
// 安装
npm install @myapp/universal-history immer

// 使用
import {
  HistoryAdapter,
  PerformanceMonitorPlugin,
  AutoSavePlugin
} from '@myapp/universal-history'

class MyAdapter extends HistoryAdapter<MyState> {
  // ...
}

const adapter = new MyAdapter({
  initialState: {},
  plugins: [
    new PerformanceMonitorPlugin(),
    new AutoSavePlugin({ ... })
  ]
})
```

---

## 🎯 10. 总结

### 10.1 核心优势

| 优势 | 说明 |
|------|------|
| **业务无关** | 核心层完全不依赖具体业务 |
| **类型安全** | 完整的 TypeScript 类型支持 |
| **高性能** | RAF + 防抖 + Map 去重 |
| **易扩展** | 插件系统支持灵活扩展 |
| **易集成** | 适配器模式，1-2 天接入新业务 |
| **可测试** | 核心逻辑独立，易于单元测试 |

### 10.2 适用场景

✅ **适合**:
- 多种编辑器需要 undo/redo 功能
- 需要统一的历史管理能力
- 需要高性能的撤销/重做
- 需要灵活的扩展能力

⚠️ **不适合**:
- 只有一个编辑器（直接用原方案即可）
- 不需要高性能优化
- 状态结构极其简单

### 10.3 与原方案对比

| 维度 | 原方案（锁屏专用） | 通用方案 |
|------|------------------|---------|
| **代码复用** | 无法复用 | 核心层可复用 |
| **维护成本** | 每个业务独立维护 | 核心层统一维护 |
| **新增业务** | 从零开始 | 实现适配器（1-2 天） |
| **性能优化** | 各业务独立优化 | 核心层优化，所有业务受益 |
| **测试成本** | 每个业务单独测试 | 核心层测试一次 |
| **学习成本** | 低（直接使用） | 中（需要理解架构） |

---

## 📝 附录

### A. 完整代码示例

完整代码示例请参考：
- `examples/lockscreen-adapter.ts` - 锁屏编辑器适配器
- `examples/theme-adapter.ts` - 主题编辑器适配器
- `examples/widget-adapter.ts` - Widget 编辑器适配器

### B. API 参考

详细 API 文档请参考：
- [UniversalHistoryManager API](./docs/api/UniversalHistoryManager.md)
- [RuntimeStateManager API](./docs/api/RuntimeStateManager.md)
- [HistoryPlugin API](./docs/api/HistoryPlugin.md)

### C. 迁移指南

从原方案迁移到通用方案的详细步骤请参考：
- [锁屏编辑器迁移指南](./docs/migration/lockscreen.md)
- [主题编辑器迁移指南](./docs/migration/theme.md)

---

## 📞 联系方式

- **作者**: [Your Name]
- **邮箱**: [your.email@example.com]
- **GitHub**: [https://github.com/yourorg/universal-history](https://github.com/yourorg/universal-history)

---

**文档版本**: v1.0
**最后更新**: 2025-12-16
**许可证**: MIT

