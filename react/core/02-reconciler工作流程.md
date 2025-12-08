# Reconciler 工作流程

Reconciler（协调器）是 React 的核心，负责协调 React、Scheduler 和 Renderer 三个包的工作。

## 四个核心步骤

```
1. 输入 (scheduleUpdateOnFiber)
        ↓
2. 注册调度任务 (ensureRootIsScheduled)
        ↓
3. 执行任务回调 (performWorkOnRoot)
        ├─ Fiber 树构造
        └─ 异常处理
        ↓
4. 输出 (commitRoot)
        ├─ Before Mutation
        ├─ Mutation
        └─ Layout
```

## 步骤 1：输入

### scheduleUpdateOnFiber - 唯一入口

```javascript
// 所有更新都必须经过这个函数
export function scheduleUpdateOnFiber(
  fiber: Fiber,
  lane: Lane,
  eventTime: number,
) {
  // 1. 标记更新路径
  const root = markUpdateLaneFromFiberToRoot(fiber, lane);

  // 2. 根据优先级决定执行方式
  if (lane === SyncLane) {
    // 同步模式
    if (
      executionContext === LegacyUnbatchedContext &&
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      // 直接执行 Fiber 构造
      performSyncWorkOnRoot(root);
    } else {
      // 注册调度任务
      ensureRootIsScheduled(root, eventTime);
    }
  } else {
    // 并发模式：注册调度任务
    ensureRootIsScheduled(root, eventTime);
  }
}
```

### 触发 scheduleUpdateOnFiber 的场景

```javascript
// 1. 首次渲染
ReactDOM.render(<App />, root);
  ↓
updateContainer
  ↓
scheduleUpdateOnFiber

// 2. class 组件更新
this.setState({ count: 1 });
  ↓
enqueueSetState
  ↓
scheduleUpdateOnFiber

// 3. function 组件更新
const [count, setCount] = useState(0);
setCount(1);
  ↓
dispatchAction
  ↓
scheduleUpdateOnFiber

// 4. forceUpdate
this.forceUpdate();
  ↓
scheduleUpdateOnFiber
```

## 步骤 2：注册调度任务

### ensureRootIsScheduled

```javascript
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  // ======== 前半部分：判断是否需要新调度 ========

  const existingCallbackNode = root.callbackNode;

  // 1. 计算下一批要处理的优先级
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );

  // 2. 获取新的回调优先级
  const newCallbackPriority = returnNextLanesPriority();

  // 3. 无更新，退出
  if (nextLanes === NoLanes) {
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLanePriority;
    return;
  }

  // 4. 优先级相同，复用当前调度
  if (existingCallbackNode !== null) {
    const existingCallbackPriority = root.callbackPriority;
    if (existingCallbackPriority === newCallbackPriority) {
      return;  // 无需新调度
    }
    // 取消旧调度
    cancelCallback(existingCallbackNode);
  }

  // ======== 后半部分：注册新的调度任务 ========

  let newCallbackNode;

  if (newCallbackPriority === SyncLanePriority) {
    // 同步优先级
    newCallbackNode = scheduleSyncCallback(
      performSyncWorkOnRoot.bind(null, root),
    );
  } else if (newCallbackPriority === SyncBatchedLanePriority) {
    // 同步批量
    newCallbackNode = scheduleCallback(
      ImmediateSchedulerPriority,
      performSyncWorkOnRoot.bind(null, root),
    );
  } else {
    // 并发模式
    const schedulerPriorityLevel =
      lanePriorityToSchedulerPriority(newCallbackPriority);

    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  }

  // 5. 保存新的调度信息
  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}
```

### 关键逻辑

```
判断流程：
  有待处理的 lane？
    ├─ 否 → 取消调度，退出
    └─ 是 ↓

  已有调度任务？
    ├─ 是 → 优先级相同？
    │       ├─ 是 → 复用，退出
    │       └─ 否 → 取消旧任务
    └─ 否 ↓

注册新调度：
  同步优先级？
    ├─ 是 → scheduleSyncCallback(performSyncWorkOnRoot)
    └─ 否 → scheduleCallback(performConcurrentWorkOnRoot)
```

## 步骤 3：执行任务回调

### performSyncWorkOnRoot（同步）

```javascript
function performSyncWorkOnRoot(root) {
  // 1. 获取优先级
  let lanes = getNextLanes(root, NoLanes);

  // 2. 构造 Fiber 树
  let exitStatus = renderRootSync(root, lanes);

  // 3. 异常处理
  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // 错误恢复逻辑
    const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
    if (errorRetryLanes !== NoLanes) {
      lanes = errorRetryLanes;
      exitStatus = renderRootSync(root, lanes);
    }
  }

  // 4. 致命错误
  if (exitStatus === RootFatalErrored) {
    throw fatalError;
  }

  // 5. 准备提交
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;

  // 6. 提交更新
  commitRoot(root);

  // 7. 检查是否有新的更新
  ensureRootIsScheduled(root, now());

  return null;
}
```

### performConcurrentWorkOnRoot（并发）

```javascript
function performConcurrentWorkOnRoot(root) {
  const originalCallbackNode = root.callbackNode;

  // 1. 刷新 passive effects
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    // passive effects 可能取消了本次任务
    if (root.callbackNode !== originalCallbackNode) {
      return null;
    }
  }

  // 2. 获取优先级
  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );

  if (lanes === NoLanes) {
    return null;
  }

  // 3. 构造 Fiber 树（可中断）
  let exitStatus = renderRootConcurrent(root, lanes);

  // 4. 检查是否需要重新开始
  if (
    includesSomeLane(
      workInProgressRootIncludedLanes,
      workInProgressRootUpdatedLanes,
    )
  ) {
    // render 过程中产生了新的高优先级更新
    prepareFreshStack(root, NoLanes);
  } else if (exitStatus !== RootIncomplete) {
    // 5. 渲染完成，准备提交
    if (exitStatus === RootErrored) {
      // 错误处理
      const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
      if (errorRetryLanes !== NoLanes) {
        lanes = errorRetryLanes;
        exitStatus = renderRootSync(root, lanes);
      }
    }

    if (exitStatus === RootFatalErrored) {
      throw fatalError;
    }

    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLanes = lanes;

    // 6. 提交更新
    finishConcurrentRender(root, exitStatus, lanes);
  }

  // 7. 检查是否有新的更新
  ensureRootIsScheduled(root, now());

  // 8. 如果被中断，返回continuation函数
  if (root.callbackNode === originalCallbackNode) {
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  return null;
}
```

### 同步 vs 并发

| 特性 | performSyncWorkOnRoot | performConcurrentWorkOnRoot |
|------|----------------------|---------------------------|
| 可中断性 | 不可中断 | 可中断 |
| 渲染函数 | renderRootSync | renderRootConcurrent |
| 中断处理 | 无 | 返回 continuation |
| 优先级切换 | 无 | 支持 |

## 步骤 4：输出

### commitRoot

```javascript
function commitRootImpl(root, renderPriorityLevel) {
  // 1. 准备工作
  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  // 清空属性
  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  root.callbackNode = null;

  // 2. 获取副作用链表
  let firstEffect = finishedWork.firstEffect;

  if (firstEffect !== null) {
    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // ======== 阶段 1: Before Mutation ========
    // DOM 变更之前
    nextEffect = firstEffect;
    do {
      try {
        commitBeforeMutationEffects();
      } catch (error) {
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // ======== 阶段 2: Mutation ========
    // DOM 变更，界面更新
    nextEffect = firstEffect;
    do {
      try {
        commitMutationEffects(root, renderPriorityLevel);
      } catch (error) {
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // 切换 Fiber 树
    root.current = finishedWork;

    // ======== 阶段 3: Layout ========
    // DOM 变更后
    nextEffect = firstEffect;
    do {
      try {
        commitLayoutEffects(root, lanes);
      } catch (error) {
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    nextEffect = null;
    executionContext = prevExecutionContext;
  }

  // 3. 检查是否有新的更新
  ensureRootIsScheduled(root, now());

  return null;
}
```

### Commit 三个子阶段

#### 1. Before Mutation
```javascript
// 处理 Snapshot 和 Passive 副作用
function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 调用 getSnapshotBeforeUpdate
    if ((flags & Snapshot) !== NoFlags) {
      commitBeforeMutationEffectOnFiber(nextEffect);
    }

    // 调度 useEffect
    if ((flags & Passive) !== NoFlags) {
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null;
      });
    }

    nextEffect = nextEffect.nextEffect;
  }
}
```

#### 2. Mutation
```javascript
// 真正修改 DOM
function commitMutationEffects(root, renderPriorityLevel) {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 处理 Ref
    if (flags & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }

    // 根据 flags 处理 DOM 操作
    const primaryFlags = flags & (Placement | Update | Deletion | Hydrating);

    switch (primaryFlags) {
      case Placement:
        commitPlacement(nextEffect);
        nextEffect.flags &= ~Placement;
        break;

      case Update:
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;

      case Deletion:
        commitDeletion(root, nextEffect);
        break;
    }

    nextEffect = nextEffect.nextEffect;
  }
}
```

#### 3. Layout
```javascript
// 调用生命周期和回调
function commitLayoutEffects(root, committedLanes) {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 调用生命周期
    if (flags & (Update | Callback)) {
      commitLayoutEffectOnFiber(root, nextEffect, committedLanes);
    }

    // 绑定 Ref
    if (flags & Ref) {
      commitAttachRef(nextEffect);
    }

    nextEffect = nextEffect.nextEffect;
  }
}
```

### 三个阶段的作用

| 阶段 | 时机 | 主要工作 | 典型操作 |
|------|------|---------|---------|
| Before Mutation | DOM 变更前 | 快照、调度副作用 | getSnapshotBeforeUpdate、调度 useEffect |
| Mutation | DOM 变更 | 修改 DOM | 插入、删除、更新节点 |
| Layout | DOM 变更后 | 同步副作用 | componentDidMount/Update、useLayoutEffect、绑定 ref |

## 完整流程图

```
用户操作（setState/dispatch）
        ↓
scheduleUpdateOnFiber（输入）
        ↓
  是否需要调度？
    ├─ 否 → 直接执行
    └─ 是 ↓
ensureRootIsScheduled（注册调度）
        ↓
scheduleCallback（Scheduler）
        ↓
performWorkOnRoot（执行回调）
        ├─ renderRoot（构造 Fiber 树）
        │    ├─ beginWork（向下）
        │    └─ completeWork（向上）
        │
        └─ commitRoot（提交更新）
             ├─ before mutation（变更前）
             ├─ mutation（DOM 变更）
             └─ layout（变更后）
        ↓
ensureRootIsScheduled（检查新更新）
        ↓
完成（或开始新一轮）
```

## 总结

Reconciler 的四个步骤形成了一个完整的闭环：

1. **输入**：scheduleUpdateOnFiber 统一入口
2. **注册调度**：ensureRootIsScheduled 智能判断
3. **执行回调**：performWorkOnRoot 构造 Fiber 树
4. **输出**：commitRoot 三阶段提交

这个流程是固定的，每次更新都会经历这四个步骤。
