# Hook 概览

Hook 是 React 16.8 引入的特性，让函数组件能够使用状态和其他 React 特性。

## Hook 的本质

### 函数组件的状态管理

```javascript
// class 组件
class Counter extends React.Component {
  state = { count: 0 };

  render() {
    return <div>{this.state.count}</div>;
  }
}

// 函数组件 + Hook
function Counter() {
  const [count, setCount] = useState(0);

  return <div>{count}</div>;
}
```

### Hook 对象

```typescript
type Hook = {
  memoizedState: any,         // Hook 的状态
  baseState: any,             // 基础状态
  baseQueue: Update | null,   // 基础更新队列
  queue: UpdateQueue | null,  // 更新队列
  next: Hook | null,          // 下一个 Hook
}
```

## Hook 的分类

### 1. 状态 Hook

**特点**：实现状态持久化

- `useState` - 基础状态管理
- `useReducer` - 复杂状态管理

### 2. 副作用 Hook

**特点**：维护 fiber.flags，提供副作用回调

- `useEffect` - 异步副作用
- `useLayoutEffect` - 同步副作用
- `useInsertionEffect` - 样式插入副作用

### 3. 优化 Hook

- `useMemo` - 缓存计算结果
- `useCallback` - 缓存函数引用
- `useRef` - 持久化引用

### 4. 上下文 Hook

- `useContext` - 读取 Context

### 5. 其他 Hook

- `useImperativeHandle` - 自定义 ref 暴露
- `useDebugValue` - 开发工具显示
- `useDeferredValue` - 延迟值
- `useTransition` - 过渡更新
- `useId` - 生成唯一 ID

## Hook 的存储结构

### Hook 链表

```
Fiber.memoizedState
    ↓
Hook1 (useState)
  ↓ next
Hook2 (useEffect)
  ↓ next
Hook3 (useMemo)
  ↓ next
null
```

### 示例代码

```javascript
function App() {
  const [count, setCount] = useState(0);      // Hook1
  const [name, setName] = useState('');       // Hook2

  useEffect(() => {                           // Hook3
    document.title = `Count: ${count}`;
  }, [count]);

  const double = useMemo(() => count * 2, [count]);  // Hook4

  return <div>{double}</div>;
}
```

### 对应的 Hook 链表

```
fiber.memoizedState
    ↓
Hook1
  ├─ memoizedState: 0
  ├─ queue: UpdateQueue { dispatch: setCount }
  └─ next ↓
        Hook2
          ├─ memoizedState: ''
          ├─ queue: UpdateQueue { dispatch: setName }
          └─ next ↓
                Hook3
                  ├─ memoizedState: Effect对象
                  ├─ queue: null
                  └─ next ↓
                        Hook4
                          ├─ memoizedState: [double, [count]]
                          ├─ queue: null
                          └─ next: null
```

## Hook 的调用流程

### 渲染时机

```javascript
// beginWork 阶段
function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps,
  renderLanes,
) {
  // 调用函数组件
  let children = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    renderLanes,
  );

  return children;
}
```

### renderWithHooks

```javascript
export function renderWithHooks(
  current,
  workInProgress,
  Component,
  props,
  renderLanes,
) {
  renderLanes = renderLanes;
  currentlyRenderingFiber = workInProgress;

  // 1. 重置 Hook 状态
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;

  // 2. 根据 current 决定使用哪套 Hook 实现
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount      // 首次渲染
      : HooksDispatcherOnUpdate;    // 更新渲染

  // 3. 执行函数组件
  let children = Component(props);

  // 4. 重置全局变量
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;

  return children;
}
```

## Hook 的两套实现

React 为 Hook 提供了两套实现：

### 1. Mount 阶段（首次渲染）

```javascript
const HooksDispatcherOnMount = {
  useState: mountState,
  useEffect: mountEffect,
  useMemo: mountMemo,
  // ...
};

function mountState(initialState) {
  // 创建 Hook 对象
  const hook = mountWorkInProgressHook();

  hook.memoizedState = hook.baseState = initialState;

  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  });

  const dispatch = (queue.dispatch = dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ));

  return [hook.memoizedState, dispatch];
}
```

### 2. Update 阶段（更新渲染）

```javascript
const HooksDispatcherOnUpdate = {
  useState: updateState,
  useEffect: updateEffect,
  useMemo: updateMemo,
  // ...
};

function updateState(initialState) {
  // 获取对应的 Hook 对象
  return updateReducer(basicStateReducer, initialState);
}

function updateReducer(reducer, initialArg, init) {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  // 处理更新队列
  const pending = queue.pending;
  if (pending !== null) {
    // 计算新状态
    const newState = calculateState(hook, queue, pending);
    hook.memoizedState = newState;
  }

  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}
```

## Hook 的规则

### 为什么 Hook 必须按顺序调用？

```javascript
// ❌ 错误：条件调用
function App({ condition }) {
  const [a, setA] = useState(1);     // Hook1

  if (condition) {
    const [b, setB] = useState(2);   // Hook2（可能不存在）
  }

  const [c, setC] = useState(3);     // Hook3 或 Hook2
}
```

**问题**：
- 首次渲染：`Hook1 → Hook2 → Hook3`
- 更新渲染（condition=false）：`Hook1 → Hook3`
- Hook 顺序错乱，导致状态混乱

```javascript
// ✅ 正确：始终按顺序
function App({ condition }) {
  const [a, setA] = useState(1);     // Hook1
  const [b, setB] = useState(2);     // Hook2
  const [c, setC] = useState(3);     // Hook3

  // 使用条件控制逻辑
  if (condition) {
    // 使用 b
  }
}
```

### Hook 的获取逻辑

```javascript
// Mount 阶段
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // 第一个 Hook
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 后续 Hook，追加到链表
    workInProgressHook = workInProgressHook.next = hook;
  }

  return workInProgressHook;
}

// Update 阶段
function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;

  if (currentHook === null) {
    // 第一个 Hook
    nextCurrentHook = currentlyRenderingFiber.alternate.memoizedState;
  } else {
    // 后续 Hook，按顺序获取
    nextCurrentHook = currentHook.next;
  }

  // 克隆 Hook
  const newHook: Hook = {
    memoizedState: nextCurrentHook.memoizedState,
    baseState: nextCurrentHook.baseState,
    baseQueue: nextCurrentHook.baseQueue,
    queue: nextCurrentHook.queue,
    next: null,
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
  } else {
    workInProgressHook = workInProgressHook.next = newHook;
  }

  currentHook = nextCurrentHook;

  return workInProgressHook;
}
```

## Hook 与 Fiber 的关系

```
┌────────────────────────────────┐
│          Fiber                 │
│  ┌──────────────────────────┐ │
│  │ tag: FunctionComponent   │ │
│  │ memoizedState: Hook链表  │ │
│  │ updateQueue: Effect链表  │ │
│  └──────────────────────────┘ │
└────────────────────────────────┘
         ↓ memoizedState
┌────────────────────────────────┐
│        Hook 链表                │
│  Hook1 → Hook2 → Hook3 → null  │
└────────────────────────────────┘
         ↓ (useState 的 Hook)
┌────────────────────────────────┐
│      Hook.queue                │
│  ┌──────────────────────────┐ │
│  │ pending: Update环形链表  │ │
│  │ dispatch: 触发更新函数   │ │
│  └──────────────────────────┘ │
└────────────────────────────────┘
```

## 状态 Hook vs 副作用 Hook

### 状态 Hook

```javascript
const [state, setState] = useState(0);

// Hook 对象
{
  memoizedState: 0,           // 当前状态
  queue: {
    pending: Update链表,       // 待处理的更新
    dispatch: setState,       // 触发更新的函数
  },
  next: 下一个Hook
}
```

### 副作用 Hook

```javascript
useEffect(() => {
  // effect 函数
  return () => {
    // cleanup 函数
  };
}, [deps]);

// Hook 对象
{
  memoizedState: {            // Effect 对象
    create: effect函数,
    destroy: cleanup函数,
    deps: [deps],
    next: 下一个Effect,
    tag: HookFlags,
  },
  queue: null,
  next: 下一个Hook
}
```

## 总结

Hook 的核心机制：

1. **存储结构**
   - Hook 链表挂载在 `fiber.memoizedState`
   - 通过 `next` 指针连接

2. **两套实现**
   - Mount：创建 Hook
   - Update：复用 Hook

3. **调用规则**
   - 必须在顶层调用
   - 必须按相同顺序
   - 不能在条件/循环中

4. **分类**
   - 状态 Hook：管理状态
   - 副作用 Hook：处理副作用
   - 优化 Hook：性能优化

5. **与 Fiber 集成**
   - Fiber 树构造时调用
   - 状态持久化在 Fiber 节点
   - 更新触发重新调度

Hook 让函数组件拥有了状态和生命周期能力，是 React 现代开发的基础。
