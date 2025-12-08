# 状态 Hook 原理

状态 Hook（`useState` 和 `useReducer`）是函数组件中管理状态的核心 API。

## useState vs useReducer

### useState
```javascript
const [state, setState] = useState(initialState);

// 更新状态
setState(newState);                    // 直接设置
setState(prev => prev + 1);            // 函数式更新
```

### useReducer
```javascript
const [state, dispatch] = useReducer(reducer, initialState);

// 更新状态
dispatch({ type: 'increment' });

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return state + 1;
    default:
      return state;
  }
}
```

### 关系
```javascript
// useState 本质上是简化版的 useReducer
function useState(initialState) {
  return useReducer(
    basicStateReducer,  // 内置的简单 reducer
    initialState
  );
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

## Mount 阶段（创建 Hook）

### mountState

```javascript
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  // 1. 创建 Hook 对象
  const hook = mountWorkInProgressHook();

  // 2. 初始化状态
  if (typeof initialState === 'function') {
    initialState = initialState();  // 惰性初始化
  }

  hook.memoizedState = hook.baseState = initialState;

  // 3. 创建更新队列
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,  // 内置 reducer
    lastRenderedState: initialState,
  });

  // 4. 创建 dispatch 函数
  const dispatch: Dispatch<BasicStateAction<S>> =
    (queue.dispatch = dispatchAction.bind(
      null,
      currentlyRenderingFiber,
      queue,
    ));

  // 5. 返回 [状态, 更新函数]
  return [hook.memoizedState, dispatch];
}
```

### mountReducer

```javascript
function mountReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  // 1. 创建 Hook 对象
  const hook = mountWorkInProgressHook();

  // 2. 初始化状态
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = ((initialArg: any): S);
  }

  hook.memoizedState = hook.baseState = initialState;

  // 3. 创建更新队列
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,  // 用户提供的 reducer
    lastRenderedState: initialState,
  });

  // 4. 创建 dispatch 函数
  const dispatch: Dispatch<A> = (queue.dispatch = dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ));

  // 5. 返回 [状态, dispatch]
  return [hook.memoizedState, dispatch];
}
```

### 创建后的结构

```
Hook
  ├─ memoizedState: 初始状态
  ├─ baseState: 初始状态
  ├─ baseQueue: null
  ├─ queue: {
  │    pending: null,
  │    dispatch: dispatchAction,
  │    lastRenderedReducer: reducer函数,
  │    lastRenderedState: 初始状态
  │  }
  └─ next: null
```

## Update 阶段（更新 Hook）

### updateState

```javascript
function updateState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  // 本质上调用 updateReducer
  return updateReducer(basicStateReducer, initialState);
}
```

### updateReducer

```javascript
function updateReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  // 1. 获取当前 Hook
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  queue.lastRenderedReducer = reducer;

  const current: Hook = (currentHook: any);
  let baseQueue = current.baseQueue;

  // 2. 合并更新队列
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // 将 pending 队列合并到 base 队列
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  // 3. 处理更新队列
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;

    // 遍历更新队列
    do {
      const updateLane = update.lane;

      // 检查优先级
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不足，跳过
        const clone: Update<S, A> = {
          lane: updateLane,
          action: update.action,
          eagerReducer: update.eagerReducer,
          eagerState: update.eagerState,
          next: (null: any),
        };

        // 添加到 newBaseQueue
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }

        // 合并优先级
        currentlyRenderingFiber.lanes = mergeLanes(
          currentlyRenderingFiber.lanes,
          updateLane,
        );
      } else {
        // 优先级足够，处理更新

        // 如果有被跳过的更新，需要保存后续所有更新
        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            lane: NoLane,
            action: update.action,
            eagerReducer: update.eagerReducer,
            eagerState: update.eagerState,
            next: (null: any),
          };
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }

        // 计算新状态
        if (update.eagerReducer === reducer) {
          // 使用预计算的状态
          newState = ((update.eagerState: any): S);
        } else {
          const action = update.action;
          newState = reducer(newState, action);
        }
      }

      update = update.next;
    } while (update !== null && update !== first);

    // 4. 保存结果
    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = (newBaseQueueFirst: any);
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  // 5. 返回结果
  const dispatch: Dispatch<A> = (queue.dispatch: any);
  return [hook.memoizedState, dispatch];
}
```

## dispatchAction（触发更新）

### 核心逻辑

```javascript
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {
  // 1. 获取当前时间和优先级
  const eventTime = requestEventTime();
  const lane = requestUpdateLane(fiber);

  // 2. 创建 update 对象
  const update: Update<S, A> = {
    lane,
    action,
    eagerReducer: null,
    eagerState: null,
    next: (null: any),
  };

  // 3. 加入更新队列（环形链表）
  const pending = queue.pending;
  if (pending === null) {
    // 第一个更新
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  const alternate = fiber.alternate;

  // 4. 优化：尝试提前计算状态
  if (
    fiber.lanes === NoLanes &&
    (alternate === null || alternate.lanes === NoLanes)
  ) {
    // 队列为空，可以预计算
    const lastRenderedReducer = queue.lastRenderedReducer;

    if (lastRenderedReducer !== null) {
      try {
        const currentState: S = (queue.lastRenderedState: any);
        const eagerState = lastRenderedReducer(currentState, action);

        // 保存预计算结果
        update.eagerReducer = lastRenderedReducer;
        update.eagerState = eagerState;

        // 如果状态没变，不需要重新渲染
        if (is(eagerState, currentState)) {
          return;
        }
      } catch (error) {
        // 计算失败，继续正常流程
      }
    }
  }

  // 5. 调度更新
  scheduleUpdateOnFiber(fiber, lane, eventTime);
}
```

### 更新队列结构

```
// 调用 setState 三次
setState(1);
setState(2);
setState(3);

// 形成环形链表
queue.pending ──→ Update3
                    ↓ next
                  Update1
                    ↓ next
                  Update2
                    ↓ next
                  Update3 (回到开头)
```

## 状态计算示例

### 场景 1：连续更新

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);  // Update1: 0 + 1 = 1
    setCount(count + 1);  // Update2: 0 + 1 = 1
    setCount(count + 1);  // Update3: 0 + 1 = 1
  }

  // 最终 count = 1（不是 3）
}
```

**原因**：三次调用时 `count` 都是 0

### 场景 2：函数式更新

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(c => c + 1);  // Update1: 0 + 1 = 1
    setCount(c => c + 1);  // Update2: 1 + 1 = 2
    setCount(c => c + 1);  // Update3: 2 + 1 = 3
  }

  // 最终 count = 3
}
```

**原因**：函数接收上一次的结果

### 场景 3：优先级跳过

```javascript
// 低优先级更新
dispatch({ type: 'increment', value: 1 });  // Update1, lane: DefaultLane

// 高优先级更新
dispatch({ type: 'increment', value: 10 }); // Update2, lane: SyncLane

// 第一次渲染（只处理高优先级）
renderLanes = SyncLane;
// 跳过 Update1
// 处理 Update2: state = 0 + 10 = 10

// 第二次渲染（处理所有更新）
renderLanes = DefaultLane | SyncLane;
// 处理 Update1: state = 0 + 1 = 1
// 处理 Update2: state = 1 + 10 = 11  // 重新计算

// 最终 state = 11
```

## 性能优化

### 1. eagerState（预计算）

```javascript
// 如果没有其他更新在进行
if (fiber.lanes === NoLanes) {
  // 立即计算新状态
  const eagerState = reducer(currentState, action);

  // 如果状态没变，直接返回
  if (is(eagerState, currentState)) {
    return;  // 不触发重新渲染
  }
}
```

### 2. 批量更新

```javascript
// React 18 自动批处理
function handleClick() {
  setCount(c => c + 1);  // 不会立即渲染
  setName('Alice');      // 不会立即渲染
  setAge(25);            // 不会立即渲染
}
// 三次 setState 合并为一次渲染
```

### 3. Object.is 比较

```javascript
// 浅比较，引用相同则认为没变化
const newState = { ...state };

setState(state);     // 不触发渲染（引用相同）
setState(newState);  // 触发渲染（引用不同）
```

## useState vs useReducer 的选择

### 使用 useState
```javascript
// 简单状态
const [count, setCount] = useState(0);
const [name, setName] = useState('');

// 优点：简洁，直观
// 缺点：复杂逻辑分散
```

### 使用 useReducer
```javascript
// 复杂状态
const initialState = {
  count: 0,
  name: '',
  todos: []
};

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'addTodo':
      return { ...state, todos: [...state.todos, action.payload] };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);

// 优点：逻辑集中，易于测试
// 缺点：代码量多，学习成本高
```

## 总结

状态 Hook 的核心机制：

1. **存储结构**
   - Hook 对象保存状态
   - UpdateQueue 管理更新

2. **两个阶段**
   - Mount：创建 Hook 和队列
   - Update：处理更新，计算新状态

3. **更新流程**
   - dispatchAction 创建 Update
   - 加入环形链表
   - 触发调度更新
   - updateReducer 计算状态

4. **优化机制**
   - eagerState 预计算
   - 批量更新合并
   - Object.is 跳过渲染

5. **优先级支持**
   - 低优先级可以跳过
   - 保证最终一致性
   - 支持高优先级插队

状态 Hook 是函数组件的核心能力，理解其原理有助于写出更高效的代码。
