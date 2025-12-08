# Fiber 树构造

Fiber 树的构造是 React 渲染的核心过程，理解这个过程对深入掌握 React 至关重要。

## 两种构造场景

### 1. 初次创建
- 应用首次启动时
- 不存在旧的 Fiber 树
- 直接构造全新的树

### 2. 对比更新
- 应用运行后的更新
- 存在旧的 Fiber 树（current）
- 新旧 Fiber 对比，复用或创建

## 双缓冲技术

React 使用双缓冲技术管理 Fiber 树：

```
┌─────────────────────┐      ┌─────────────────────┐
│   current 树         │      │  workInProgress 树   │
│  (显示在屏幕上)      │ ←──→ │   (内存中构建)       │
└─────────────────────┘      └─────────────────────┘
      alternate                    alternate
```

### 为什么需要双缓冲？

1. **提高性能**：可以在内存中完成所有计算
2. **支持中断**：构造过程可以随时中断和恢复
3. **保证一致性**：只在完成后才切换到新树

### 切换时机

```javascript
// commit 阶段切换
function commitRootImpl(root) {
  // ... mutation 阶段

  // 切换 Fiber 树
  root.current = finishedWork;  // workInProgress → current

  // ... layout 阶段
}
```

## Fiber 树构造过程

### 两个阶段

```
beginWork（向下）
    ↓ 深度优先遍历
completeWork（向上）
    ↓ 收集副作用
形成副作用链表
```

### 1. beginWork - 向下构造

#### 核心逻辑

```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // 1. 根据 tag 进行不同处理
  switch (workInProgress.tag) {
    case FunctionComponent:
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        renderLanes,
      );

    case ClassComponent:
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        renderLanes,
      );

    case HostComponent:  // div, span 等
      return updateHostComponent(current, workInProgress, renderLanes);

    // ... 其他类型
  }
}
```

#### 处理函数组件

```javascript
function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  renderLanes,
) {
  // 1. 执行函数组件，获取 children
  const children = renderWithHooks(
    current,
    workInProgress,
    Component,
    workInProgress.pendingProps,
    renderLanes,
  );

  // 2. 标记 flags
  if (current !== null && !didReceiveUpdate) {
    // 可以复用
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // 3. 协调子节点
  reconcileChildren(current, workInProgress, children, renderLanes);

  // 4. 返回第一个子节点
  return workInProgress.child;
}
```

#### 处理类组件

```javascript
function updateClassComponent(
  current,
  workInProgress,
  Component,
  renderLanes,
) {
  // 1. 创建实例（首次渲染）
  const instance = workInProgress.stateNode;
  if (instance === null) {
    constructClassInstance(workInProgress, Component, props);
    mountClassInstance(workInProgress, Component, props, renderLanes);
  } else {
    // 更新实例
    updateClassInstance(current, workInProgress, Component, props, renderLanes);
  }

  // 2. 调用 render 获取 children
  const nextChildren = instance.render();

  // 3. 协调子节点
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);

  // 4. 返回第一个子节点
  return workInProgress.child;
}
```

#### 处理原生组件

```javascript
function updateHostComponent(
  current,
  workInProgress,
  renderLanes,
) {
  // 1. 获取 props
  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  // 2. 获取 children
  let nextChildren = nextProps.children;

  // 3. 优化：纯文本子节点
  if (typeof nextChildren === 'string' || typeof nextChildren === 'number') {
    nextChildren = null;  // 不创建 Fiber，直接在 complete 阶段处理
  }

  // 4. 协调子节点
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);

  // 5. 返回第一个子节点
  return workInProgress.child;
}
```

### 2. reconcileChildren - 协调子节点

#### 单节点协调

```javascript
function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement,
  lanes: Lanes,
): Fiber {
  const key = element.key;
  let child = currentFirstChild;

  // 1. 尝试复用
  while (child !== null) {
    if (child.key === key) {
      if (child.elementType === element.type) {
        // key 和 type 都相同，可以复用
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;

        // 删除其他兄弟节点
        deleteRemainingChildren(returnFiber, child.sibling);
        return existing;
      } else {
        // key 相同但 type 不同，删除所有
        deleteRemainingChildren(returnFiber, child);
        break;
      }
    } else {
      // key 不同，删除
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }

  // 2. 无法复用，创建新 Fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.return = returnFiber;
  return created;
}
```

#### 多节点协调（Diff 算法）

```javascript
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<any>,
  lanes: Lanes,
): Fiber | null {
  let resultingFirstChild: Fiber | null = null;
  let previousNewFiber: Fiber | null = null;

  let oldFiber = currentFirstChild;
  let newIdx = 0;
  let lastPlacedIndex = 0;

  // 第一轮：处理相同位置的节点
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    const newChild = newChildren[newIdx];

    if (oldFiber.key === newChild.key) {
      // key 相同，尝试复用
      const newFiber = updateSlot(returnFiber, oldFiber, newChild, lanes);
      if (newFiber !== null) {
        // 复用成功
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      oldFiber = oldFiber.sibling;
    } else {
      // key 不同，退出第一轮
      break;
    }
  }

  // 新节点遍历完了
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }

  // 旧节点遍历完了
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }

  // 第二轮：处理剩余节点（使用 Map）
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

  for (; newIdx < newChildren.length; newIdx++) {
    const newChild = newChildren[newIdx];
    const matchedFiber = existingChildren.get(
      newChild.key === null ? newIdx : newChild.key,
    );

    const newFiber = matchedFiber
      ? updateElement(returnFiber, matchedFiber, newChild, lanes)
      : createChild(returnFiber, newChild, lanes);

    if (matchedFiber) {
      existingChildren.delete(newChild.key === null ? newIdx : newChild.key);
    }

    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
  }

  // 删除未匹配的旧节点
  existingChildren.forEach(child => deleteChild(returnFiber, child));

  return resultingFirstChild;
}
```

### 3. completeWork - 向上归并

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
        // 更新
        updateHostComponent(current, workInProgress, type, newProps);
      } else {
        // 创建 DOM 节点
        const instance = createInstance(
          type,
          newProps,
          rootContainerInstance,
          currentHostContext,
          workInProgress,
        );

        // 将子节点插入到当前节点
        appendAllChildren(instance, workInProgress, false, false);

        // 保存 DOM 节点
        workInProgress.stateNode = instance;

        // 处理 props
        if (
          finalizeInitialChildren(
            instance,
            type,
            newProps,
            rootContainerInstance,
            currentHostContext,
          )
        ) {
          markUpdate(workInProgress);
        }
      }
      return null;
    }

    case FunctionComponent:
    case ClassComponent:
      // 不需要创建 DOM
      return null;
  }
}
```

#### appendAllChildren - 插入子节点

```javascript
function appendAllChildren(
  parent: Instance,
  workInProgress: Fiber,
  needsVisibilityToggle: boolean,
  isHidden: boolean,
) {
  let node = workInProgress.child;

  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      // 原生节点，直接插入
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      // 组件节点，继续向下找
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === workInProgress) {
      return;
    }

    // 向上回溯
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}
```

### 4. 收集副作用

```javascript
function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork = unitOfWork;

  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    // 1. 完成当前节点
    const next = completeWork(current, completedWork, renderLanes);

    if (next !== null) {
      workInProgress = next;
      return;
    }

    // 2. 收集副作用
    if (returnFiber !== null) {
      // 将当前节点的副作用链表追加到父节点
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

    // 3. 处理兄弟节点
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    // 4. 返回父节点
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
```

## 遍历示例

```jsx
<App>
  <div>
    <p>Hello</p>
    <span>World</span>
  </div>
</App>
```

### 构造顺序

```
1. beginWork(App)        → 返回 div Fiber
2. beginWork(div)        → 返回 p Fiber
3. beginWork(p)          → 返回 text Fiber
4. beginWork(text)       → 返回 null
5. completeWork(text)    ← 回溯
6. completeWork(p)       ← 回溯，返回 span
7. beginWork(span)       → 返回 text Fiber
8. beginWork(text)       → 返回 null
9. completeWork(text)    ← 回溯
10. completeWork(span)   ← 回溯
11. completeWork(div)    ← 回溯
12. completeWork(App)    ← 完成
```

### 副作用链表

```
HostRootFiber.firstEffect
    ↓
  div (Placement)
    ↓ nextEffect
   p (Placement)
    ↓ nextEffect
  text (Placement)
    ↓ nextEffect
  span (Placement)
    ↓ nextEffect
  text (Placement)
    ↓ nextEffect
  null
```

## 关键优化

### 1. bailout 优化

```javascript
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  // 1. 标记跳过
  workInProgress.lanes = NoLanes;

  // 2. 检查子节点是否需要更新
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // 整个子树都不需要更新
    return null;
  }

  // 3. 子树需要更新，克隆子节点
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
```

### 2. 纯文本优化

```javascript
// 文本节点不创建 Fiber
if (typeof children === 'string' || typeof children === 'number') {
  // 在 completeWork 中直接设置 textContent
  workInProgress.stateNode.textContent = children;
}
```

### 3. key 优化

```javascript
// 有 key：O(n) 复杂度
for (let i = 0; i < newChildren.length; i++) {
  const matchedFiber = existingChildren.get(newChildren[i].key);
}

// 无 key：O(n²) 复杂度
for (let i = 0; i < newChildren.length; i++) {
  for (let j = 0; j < oldChildren.length; j++) {
    if (canReuse(oldChildren[j], newChildren[i])) {
      // ...
    }
  }
}
```

## 总结

Fiber 树构造过程：

1. **双缓冲**
   - current 树：当前显示
   - workInProgress 树：内存中构建

2. **两个阶段**
   - beginWork：向下遍历，创建/复用 Fiber
   - completeWork：向上归并，创建 DOM、收集副作用

3. **深度优先遍历**
   - 先子节点，后兄弟节点
   - 利用 return、child、sibling 指针

4. **协调算法**
   - 单节点：key + type 判断复用
   - 多节点：两轮遍历 + Map 优化

5. **副作用收集**
   - 形成单向链表
   - 供 commit 阶段使用

这个过程支持中断和恢复，是 React Concurrent 模式的基础。
