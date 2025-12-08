# setState 完整流程详解

本文档详细描述从调用 `setState` 到整个应用更新完成的全过程。

## 流程概览

```
用户代码调用 setState
    ↓
创建 Update 对象
    ↓
加入 fiber.updateQueue
    ↓
调度更新 (scheduleUpdateOnFiber)
    ↓
注册调度任务 (ensureRootIsScheduled)
    ↓
Scheduler 调度执行
    ↓
Fiber 树构造 (renderRoot)
    ├─ beginWork (向下遍历)
    └─ completeWork (向上归并)
    ↓
Commit 提交 (commitRoot)
    ├─ before mutation
    ├─ mutation (DOM 更新)
    └─ layout
    ↓
页面更新完成
```

## 阶段一：触发更新

### 1. 用户调用 setState

```javascript
class Counter extends React.Component {
  state = { count: 0 };

  handleClick = () => {
    // 用户调用 setState
    this.setState({ count: this.state.count + 1 });
  };

  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

### 2. setState 执行流程

```javascript
// React.Component 的 setState 方法
Component.prototype.setState = function(partialState, callback) {
  // 调用 updater.enqueueSetState
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

### 3. enqueueSetState - 入队更新

```javascript
// react-reconciler/src/ReactFiberClassComponent.js
const classComponentUpdater = {
  enqueueSetState(inst, payload, callback) {
    // 1. 获取当前组件对应的 fiber 节点
    const fiber = getInstance(inst);

    // 2. 获取当前时间戳
    const eventTime = requestEventTime();

    // 3. 请求更新优先级（Lane）
    const lane = requestUpdateLane(fiber);

    // 4. 创建 update 对象
    const update = createUpdate(eventTime, lane);
    update.payload = payload;  // { count: 1 }

    if (callback !== undefined) {
      update.callback = callback;
    }

    // 5. 将 update 加入 fiber.updateQueue
    enqueueUpdate(fiber, update);

    // 6. 调度更新
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  },
};
```

### 4. 创建 Update 对象

```javascript
// Update 对象结构
const update = {
  eventTime: 1234567890,        // 创建时间
  lane: 0b0000000000000000010,  // 优先级（SyncLane）
  tag: UpdateState,             // 更新类型
  payload: { count: 1 },        // 更新内容
  callback: null,               // 回调函数
  next: null,                   // 下一个 Update
};
```

### 5. 加入更新队列

```javascript
function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue;

  if (updateQueue === null) {
    return;
  }

  const sharedQueue = updateQueue.shared;
  const pending = sharedQueue.pending;

  // 形成环形链表
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }

  // pending 始终指向最后一个 update
  sharedQueue.pending = update;
}
```

### 此时的数据结构

```
Counter Fiber
  ↓
updateQueue: {
  baseState: { count: 0 },
  shared: {
    pending ──→ Update
                  ├─ payload: { count: 1 }
                  ├─ lane: SyncLane
                  └─ next: Update (自己，环形)
  }
}
```

## 阶段二：调度更新

### 1. scheduleUpdateOnFiber - 调度入口

```javascript
export function scheduleUpdateOnFiber(
  fiber: Fiber,
  lane: Lane,
  eventTime: number,
) {
  // 1. 向上标记 lanes，直到 root
  const root = markUpdateLaneFromFiberToRoot(fiber, lane);

  // 标记 root 有待处理的更新
  markRootUpdated(root, lane, eventTime);

  // 2. 根据优先级决定执行方式
  if (lane === SyncLane) {
    // 同步优先级
    if (
      (executionContext & LegacyUnbatchedContext) !== NoContext &&
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      // 首次渲染，直接同步执行
      performSyncWorkOnRoot(root);
    } else {
      // 注册调度任务
      ensureRootIsScheduled(root, eventTime);
    }
  } else {
    // 并发模式，注册调度任务
    ensureRootIsScheduled(root, eventTime);
  }
}
```

### 2. markUpdateLaneFromFiberToRoot - 向上标记

```javascript
function markUpdateLaneFromFiberToRoot(
  sourceFiber: Fiber,
  lane: Lane,
): FiberRoot {
  // 标记当前 fiber 的 lanes
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);

  let node = sourceFiber;
  let parent = sourceFiber.return;

  // 向上遍历，标记所有祖先节点的 childLanes
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);

    // 同步标记 alternate（双缓冲）
    const alternate = parent.alternate;
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    }

    node = parent;
    parent = parent.return;
  }

  // 返回 FiberRoot
  if (node.tag === HostRoot) {
    return node.stateNode;
  }

  return null;
}
```

### 标记后的 Fiber 树

```
HostRootFiber
  ├─ childLanes: 0b010 ✓
  └─ child ↓
        App Fiber
          ├─ childLanes: 0b010 ✓
          └─ child ↓
                Counter Fiber
                  ├─ lanes: 0b010 ✓ (触发更新的节点)
                  └─ updateQueue.pending: Update
```

### 3. ensureRootIsScheduled - 注册调度

```javascript
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  const existingCallbackNode = root.callbackNode;

  // 1. 标记过期的 lanes
  markStarvedLanesAsExpired(root, currentTime);

  // 2. 获取下一批要处理的 lanes
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );

  if (nextLanes === NoLanes) {
    // 没有待处理的更新
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLanePriority;
    return;
  }

  // 3. 获取新的优先级
  const newCallbackPriority = returnNextLanesPriority();

  // 4. 如果优先级相同，复用现有调度
  if (existingCallbackNode !== null) {
    const existingCallbackPriority = root.callbackPriority;
    if (existingCallbackPriority === newCallbackPriority) {
      return;
    }
    // 取消旧的调度
    cancelCallback(existingCallbackNode);
  }

  // 5. 注册新的调度任务
  let newCallbackNode;

  if (newCallbackPriority === SyncLanePriority) {
    // 同步优先级，使用同步队列
    newCallbackNode = scheduleSyncCallback(
      performSyncWorkOnRoot.bind(null, root),
    );
  } else {
    // 并发模式，根据优先级调度
    const schedulerPriorityLevel =
      lanePriorityToSchedulerPriority(newCallbackPriority);

    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  }

  // 6. 保存调度信息
  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}
```

### 4. Scheduler 调度任务

```javascript
// 创建 Task 对象
const task = {
  id: taskIdCounter++,
  callback: performSyncWorkOnRoot.bind(null, root),
  priorityLevel: ImmediatePriority,
  startTime: currentTime,
  expirationTime: currentTime - 1,  // 立即过期
  sortIndex: -1,
};

// 加入任务队列（最小堆）
taskQueue.push(task);

// 请求执行
requestHostCallback(flushWork);

// 通过 MessageChannel 异步执行
port.postMessage(null);
```

## 阶段三：Fiber 树构造

### 1. performSyncWorkOnRoot - 执行任务

```javascript
function performSyncWorkOnRoot(root) {
  // 1. 获取要处理的 lanes
  let lanes = getNextLanes(root, NoLanes);

  // 2. 保存当前上下文
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;

  // 3. 准备新的 Fiber 树（workInProgress）
  let exitStatus = renderRootSync(root, lanes);

  // 4. 处理错误
  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // 错误恢复逻辑
  }

  // 5. 准备提交
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;

  // 6. 提交更新
  commitRoot(root);

  // 7. 恢复上下文
  executionContext = prevExecutionContext;

  // 8. 检查是否有新的更新
  ensureRootIsScheduled(root, now());

  return null;
}
```

### 2. renderRootSync - 构造 Fiber 树

```javascript
function renderRootSync(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;

  // 1. 准备新的 workInProgress 树
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes);
  }

  // 2. 循环构造 Fiber 树
  do {
    try {
      workLoopSync();
      break;
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);

  executionContext = prevExecutionContext;

  // 3. 重置全局变量
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  return workInProgressRootExitStatus;
}
```

### 3. workLoopSync - 工作循环

```javascript
function workLoopSync() {
  // 只要 workInProgress 不为空，就继续处理
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;

  // 1. beginWork - 向下构造
  let next = beginWork(current, unitOfWork, renderLanes);

  // 2. 保存新的 props
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // 没有子节点，开始 complete
    completeUnitOfWork(unitOfWork);
  } else {
    // 继续处理子节点
    workInProgress = next;
  }
}
```

### 4. beginWork - 处理 Counter Fiber

```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // 处理 ClassComponent
  if (workInProgress.tag === ClassComponent) {
    return updateClassComponent(
      current,
      workInProgress,
      Component,
      renderLanes,
    );
  }
  // ... 其他类型
}

function updateClassComponent(
  current,
  workInProgress,
  Component,
  renderLanes,
) {
  const instance = workInProgress.stateNode;

  // 1. 处理更新队列，计算新的 state
  processUpdateQueue(workInProgress, nextProps, instance, renderLanes);

  const newState = workInProgress.memoizedState;

  // 2. 调用生命周期
  if (shouldUpdate) {
    instance.componentWillUpdate(nextProps, newState);
  }

  // 3. 调用 render 获取新的 children
  const nextChildren = instance.render();

  // 4. 标记副作用
  workInProgress.flags |= PerformedWork;

  // 5. 协调子节点
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);

  // 6. 返回第一个子节点
  return workInProgress.child;
}
```

### 5. processUpdateQueue - 计算新状态

```javascript
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderLanes: Lanes,
): void {
  const queue: UpdateQueue<State> = workInProgress.updateQueue;

  // 1. 获取更新链表
  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  // 2. 将 pending 队列剪切到 base 队列
  let pendingQueue = queue.shared.pending;
  if (pendingQueue !== null) {
    queue.shared.pending = null;

    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;

    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    } else {
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;
  }

  // 3. 遍历更新链表，计算新状态
  if (firstBaseUpdate !== null) {
    let newState = queue.baseState;  // { count: 0 }

    let update = firstBaseUpdate;
    do {
      const updateLane = update.lane;

      // 检查优先级
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不够，跳过
        // ...
      } else {
        // 处理更新
        const payload = update.payload;  // { count: 1 }

        // 计算新状态
        if (typeof payload === 'function') {
          newState = payload.call(instance, newState, nextProps);
        } else {
          newState = Object.assign({}, newState, payload);
        }
        // newState = { count: 1 }
      }

      update = update.next;
    } while (update !== null);

    // 4. 保存新状态
    queue.baseState = newState;
    workInProgress.memoizedState = newState;
  }
}
```

### 6. reconcileChildren - 协调子节点

```javascript
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes,
) {
  if (current === null) {
    // Mount - 首次渲染
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes,
    );
  } else {
    // Update - 更新渲染，进行 Diff
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes,
    );
  }
}
```

### 7. completeWork - 向上归并

```javascript
function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case HostComponent: {
      if (current !== null && workInProgress.stateNode != null) {
        // 更新 DOM 节点
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          rootContainerInstance,
        );

        // 标记 Update flag
        if (current.ref !== workInProgress.ref) {
          markRef(workInProgress);
        }
      }
      return null;
    }

    case ClassComponent:
      // 不需要创建 DOM
      return null;
  }
}
```

### 8. updateHostComponent - 标记更新

```javascript
function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: Type,
  newProps: Props,
  rootContainerInstance: Container,
) {
  const oldProps = current.memoizedProps;

  if (oldProps === newProps) {
    // props 没变化，不需要更新
    return;
  }

  const instance: Instance = workInProgress.stateNode;

  // 计算需要更新的属性
  const updatePayload = prepareUpdate(
    instance,
    type,
    oldProps,
    newProps,
    rootContainerInstance,
  );

  // 保存更新内容
  workInProgress.updateQueue = (updatePayload: any);

  // 标记 Update flag
  if (updatePayload) {
    markUpdate(workInProgress);
  }
}
```

### 9. 收集副作用链表

```javascript
function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork = unitOfWork;

  do {
    // ... completeWork 处理

    // 收集副作用
    if (returnFiber !== null) {
      // 将子节点的副作用链表追加到父节点
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = completedWork.firstEffect;
      }

      if (completedWork.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
        }
        returnFiber.lastEffect = completedWork.lastEffect;
      }

      // 如果当前节点有副作用，也加入链表
      const flags = completedWork.flags;
      if (flags > PerformedWork) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = completedWork;
        } else {
          returnFiber.firstEffect = completedWork;
        }
        returnFiber.lastEffect = completedWork;
      }
    }

    // 处理兄弟节点或返回父节点
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
```

### 构造完成后的副作用链表

```
HostRootFiber.firstEffect
    ↓
  button (Update)
    ↓ nextEffect
  Counter Fiber (Update)
    ↓ nextEffect
  null
```

## 阶段四：Commit 提交

### 1. commitRoot - 提交入口

```javascript
function commitRoot(root) {
  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  // 设置优先级
  const priorityLevel = getCurrentPriorityLevel();

  // 执行提交
  commitRootImpl(root, priorityLevel);

  return null;
}
```

### 2. commitRootImpl - 提交实现

```javascript
function commitRootImpl(root, renderPriorityLevel) {
  // 1. 准备工作
  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  // 清空 FiberRoot 属性
  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  root.callbackNode = null;

  // 2. 获取副作用链表
  let firstEffect = finishedWork.firstEffect;

  if (firstEffect !== null) {
    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // ============ Before Mutation 阶段 ============
    nextEffect = firstEffect;
    do {
      try {
        commitBeforeMutationEffects();
      } catch (error) {
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // ============ Mutation 阶段 ============
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

    // ============ Layout 阶段 ============
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
  } else {
    // 没有副作用，直接切换
    root.current = finishedWork;
  }

  // 3. 检查是否有新的更新
  ensureRootIsScheduled(root, now());

  return null;
}
```

### 3. Before Mutation 阶段

```javascript
function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 调用 getSnapshotBeforeUpdate
    if ((flags & Snapshot) !== NoFlags) {
      const current = nextEffect.alternate;
      commitBeforeMutationEffectOnFiber(current, nextEffect);
    }

    // 调度 useEffect
    if ((flags & Passive) !== NoFlags) {
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalSchedulerPriority, () => {
          flushPassiveEffects();
          return null;
        });
      }
    }

    nextEffect = nextEffect.nextEffect;
  }
}

function commitBeforeMutationEffectOnFiber(current, finishedWork) {
  switch (finishedWork.tag) {
    case ClassComponent:
      if (finishedWork.flags & Snapshot) {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode;

          // 调用 getSnapshotBeforeUpdate
          const snapshot = instance.getSnapshotBeforeUpdate(
            prevProps,
            prevState,
          );
          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
      }
      break;
  }
}
```

### 4. Mutation 阶段 - 更新 DOM

```javascript
function commitMutationEffects(root, renderPriorityLevel) {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 重置文本内容
    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    // 更新 ref
    if (flags & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }

    // 处理 DOM 操作
    const primaryFlags = flags & (Placement | Update | Deletion | Hydrating);

    switch (primaryFlags) {
      case Placement: {
        commitPlacement(nextEffect);
        nextEffect.flags &= ~Placement;
        break;
      }

      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }

      case Deletion: {
        commitDeletion(root, nextEffect, renderPriorityLevel);
        break;
      }
    }

    nextEffect = nextEffect.nextEffect;
  }
}
```

### 5. commitWork - 更新 button 文本

```javascript
function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case HostComponent: {
      const instance = finishedWork.stateNode;

      if (instance != null) {
        const newProps = finishedWork.memoizedProps;
        const oldProps = current !== null ? current.memoizedProps : newProps;
        const type = finishedWork.type;
        const updatePayload = finishedWork.updateQueue;

        finishedWork.updateQueue = null;

        if (updatePayload !== null) {
          // 更新 DOM 属性
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork,
          );
        }
      }
      return;
    }
  }
}

function commitUpdate(
  domElement: Instance,
  updatePayload: Array<mixed>,
  type: string,
  oldProps: Props,
  newProps: Props,
) {
  // 更新 DOM 属性
  // updatePayload = ['children', '1']
  updateProperties(domElement, updatePayload, type, oldProps, newProps);

  // 保存 props
  updateFiberProps(domElement, newProps);
}

function updateProperties(
  domElement: Element,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object,
): void {
  // updatePayload 是 [key1, value1, key2, value2, ...] 格式
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];

    if (propKey === 'children') {
      // 更新文本内容
      setTextContent(domElement, propValue);  // button.textContent = '1'
    } else if (propKey === 'style') {
      setValueForStyles(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue);
    }
  }
}
```

### 6. Layout 阶段 - 调用生命周期

```javascript
function commitLayoutEffects(root: FiberRoot, committedLanes: Lanes) {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    // 调用生命周期和回调
    if (flags & (Update | Callback)) {
      const current = nextEffect.alternate;
      commitLayoutEffectOnFiber(root, current, nextEffect, committedLanes);
    }

    // 绑定 ref
    if (flags & Ref) {
      commitAttachRef(nextEffect);
    }

    nextEffect = nextEffect.nextEffect;
  }
}

function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes,
): void {
  switch (finishedWork.tag) {
    case ClassComponent: {
      const instance = finishedWork.stateNode;

      if (finishedWork.flags & Update) {
        if (current === null) {
          // Mount - 调用 componentDidMount
          instance.componentDidMount();
        } else {
          // Update - 调用 componentDidUpdate
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const snapshot = instance.__reactInternalSnapshotBeforeUpdate;

          instance.componentDidUpdate(prevProps, prevState, snapshot);
        }
      }

      // 执行 setState 的回调
      const updateQueue = finishedWork.updateQueue;
      if (updateQueue !== null) {
        commitUpdateQueue(finishedWork, updateQueue, instance);
      }

      return;
    }
  }
}
```

## 完整时序图

```
时间线 →

T0: 用户点击 button
    ├─ 触发原生事件
    └─ 调用 onClick 回调

T1: setState({ count: 1 })
    ├─ enqueueSetState
    ├─ 创建 Update { payload: { count: 1 } }
    ├─ 加入 updateQueue.shared.pending
    └─ scheduleUpdateOnFiber

T2: 调度阶段
    ├─ markUpdateLaneFromFiberToRoot (向上标记 lanes)
    ├─ ensureRootIsScheduled (注册调度任务)
    └─ scheduleCallback (Scheduler 调度)

T3: MessageChannel 触发
    ├─ performWorkUntilDeadline
    └─ workLoop

T4: 执行任务
    └─ performSyncWorkOnRoot

T5: Render 阶段（Fiber 树构造）
    ├─ prepareFreshStack (准备 workInProgress 树)
    ├─ workLoopSync
    │   ├─ beginWork(HostRootFiber)
    │   ├─ beginWork(App)
    │   ├─ beginWork(Counter)
    │   │   ├─ processUpdateQueue (计算新 state: { count: 1 })
    │   │   ├─ instance.render() (获取新的 ReactElement)
    │   │   └─ reconcileChildren (Diff 子节点)
    │   ├─ beginWork(button)
    │   ├─ completeWork(button) (标记 Update，收集副作用)
    │   ├─ completeWork(Counter)
    │   ├─ completeWork(App)
    │   └─ completeWork(HostRootFiber)
    └─ 形成副作用链表

T6: Commit 阶段（提交更新）
    ├─ Before Mutation
    │   ├─ commitBeforeMutationEffects
    │   └─ 调用 getSnapshotBeforeUpdate
    │
    ├─ Mutation
    │   ├─ commitMutationEffects
    │   ├─ commitWork(button)
    │   │   └─ button.textContent = '1' (真正的 DOM 更新！)
    │   └─ root.current = finishedWork (切换 Fiber 树)
    │
    └─ Layout
        ├─ commitLayoutEffects
        ├─ 调用 componentDidUpdate(prevProps, prevState)
        └─ 执行 setState 回调

T7: 浏览器重绘
    └─ 用户看到 button 文本从 0 变成 1

T8: 检查新更新
    └─ ensureRootIsScheduled (检查是否有新的更新)

完成！
```

## 关键数据流

### 1. State 的流转

```
Old State: { count: 0 }
    ↓ (存储在 fiber.memoizedState)
用户调用 setState({ count: 1 })
    ↓ (创建 Update 对象)
Update.payload: { count: 1 }
    ↓ (加入 updateQueue)
processUpdateQueue 处理
    ↓ (合并 baseState 和 payload)
New State: { count: 1 }
    ↓ (保存到 workInProgress.memoizedState)
Commit 阶段切换 Fiber 树
    ↓ (workInProgress → current)
New State 生效
```

### 2. Fiber 树的切换

```
Before Update:
  current ──→ Counter Fiber (old)
                ├─ memoizedState: { count: 0 }
                └─ child: button (textContent: '0')

  alternate ──→ null

During Render:
  current ──→ Counter Fiber (old)
  alternate ─┐
            ↓
  workInProgress ──→ Counter Fiber (new)
                      ├─ memoizedState: { count: 1 }
                      └─ child: button (textContent: '1')

After Commit:
  current ──→ Counter Fiber (new)
                ├─ memoizedState: { count: 1 }
                └─ child: button (textContent: '1')

  alternate ──→ Counter Fiber (old)
```

### 3. 优先级的传递

```
User Event (click)
    ↓
requestUpdateLane
    ↓ Lane: SyncLane (0b010)
Update.lane = SyncLane
    ↓
markUpdateLaneFromFiberToRoot
    ├─ Counter.lanes = SyncLane
    ├─ App.childLanes = SyncLane
    └─ HostRootFiber.childLanes = SyncLane
    ↓
lanePriorityToSchedulerPriority
    ↓ SchedulerPriority: ImmediatePriority
scheduleCallback(ImmediatePriority, callback)
    ↓
Task.priorityLevel = ImmediatePriority
    ↓
立即执行（优先级最高）
```

## 性能优化点

### 1. 批量更新

```javascript
handleClick = () => {
  this.setState({ a: 1 });  // Update1
  this.setState({ b: 2 });  // Update2
  this.setState({ c: 3 });  // Update3
};

// React 会将三次 setState 合并为一次渲染
// updateQueue.shared.pending ──→ Update3 → Update1 → Update2 → Update3
// 只触发一次 scheduleUpdateOnFiber
```

### 2. bailout 优化

```javascript
// 如果 props 和 state 都没变
if (
  oldProps === newProps &&
  oldState === newState &&
  !hasContextChanged()
) {
  // 跳过当前组件的渲染
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}
```

### 3. 优先级调度

```javascript
// 高优先级更新可以打断低优先级更新
Low Priority Update: Rendering...
    ↓
High Priority Update: Arrived!
    ↓
Interrupt rendering
    ↓
Process high priority update first
    ↓
Resume low priority update
```

## 总结

从 setState 到页面更新的完整流程：

1. **触发更新**（用户代码）
   - 调用 setState
   - 创建 Update 对象
   - 加入 updateQueue

2. **调度更新**（React Reconciler）
   - 标记 Fiber 树的 lanes
   - 注册调度任务
   - Scheduler 执行任务

3. **构造 Fiber 树**（Render 阶段）
   - beginWork：计算新 state，Diff 子节点
   - completeWork：创建/标记 DOM 操作
   - 收集副作用链表

4. **提交更新**（Commit 阶段）
   - Before Mutation：调用 getSnapshotBeforeUpdate
   - Mutation：真正更新 DOM
   - Layout：调用 componentDidUpdate

5. **浏览器重绘**
   - 用户看到最新的 UI

整个过程体现了 React 的核心设计理念：
- **声明式**：用户只需声明状态变化
- **异步可中断**：通过 Scheduler 实现
- **批量更新**：多次 setState 合并处理
- **优先级调度**：紧急更新优先处理

这就是 React 从一个简单的 setState 调用到最终页面更新的完整旅程！
