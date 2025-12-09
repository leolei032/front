# React Hooks 深度解析

## 1. Hooks的底层原理

### Hooks的数据结构

```javascript
// Hooks在Fiber节点上的存储结构
type Hook = {
  memoizedState: any;        // 上次渲染的state
  baseState: any;            // 基础state
  baseQueue: Update<any>;    // 基础更新队列
  queue: UpdateQueue<any>;   // 更新队列
  next: Hook | null;         // 指向下一个Hook（链表结构）
};

// Fiber节点
type Fiber = {
  // ...
  memoizedState: Hook | null;  // 指向第一个Hook
  updateQueue: any;
  // ...
};

// 关键点：Hooks通过链表连接，顺序固定！
// 这就是为什么Hooks不能在条件语句中使用
```

### Hooks执行流程

```javascript
// 全局变量（简化）
let currentlyRenderingFiber = null;  // 当前正在渲染的Fiber
let workInProgressHook = null;       // 当前处理的Hook
let currentHook = null;              // 旧Hook（用于update）

// 组件渲染时
function renderWithHooks(current, workInProgress, Component, props) {
  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;  // 重置Hooks链表
  workInProgress.updateQueue = null;

  // 区分mount和update
  ReactCurrentDispatcher.current =
    current === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;

  // 执行函数组件
  const children = Component(props);

  // 清理
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;

  return children;
}

// Mount阶段的useState
function mountState(initialState) {
  // 1. 创建Hook对象
  const hook = mountWorkInProgressHook();

  // 2. 初始化state
  if (typeof initialState === 'function') {
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;

  // 3. 创建更新队列
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState
  };
  hook.queue = queue;

  // 4. 创建dispatch函数（绑定当前Fiber和queue）
  const dispatch = dispatchAction.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [hook.memoizedState, dispatch];
}

// Update阶段的useState
function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState);
}

function updateReducer(reducer, initialArg) {
  // 1. 获取当前Hook
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  // 2. 处理更新队列
  const pending = queue.pending;
  if (pending !== null) {
    // 3. 计算新state
    const first = pending.next;
    let newState = hook.baseState;
    let update = first;

    do {
      const action = update.action;
      newState = reducer(newState, action);
      update = update.next;
    } while (update !== first);

    // 4. 更新Hook
    hook.memoizedState = newState;
    hook.baseState = newState;
    queue.pending = null;
  }

  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}

// 关键函数：创建或获取Hook
function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null
  };

  if (workInProgressHook === null) {
    // 第一个Hook
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 追加到链表末尾
    workInProgressHook = workInProgressHook.next = hook;
  }

  return workInProgressHook;
}

function updateWorkInProgressHook() {
  // 从current Fiber复制Hook
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate;
    currentHook = current.memoizedState;
  } else {
    currentHook = currentHook.next;
  }

  // 创建新的workInProgress Hook
  const newHook = {
    memoizedState: currentHook.memoizedState,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
    queue: currentHook.queue,
    next: null
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
  } else {
    workInProgressHook = workInProgressHook.next = newHook;
  }

  return workInProgressHook;
}
```

### 为什么Hooks必须在顶层调用

```javascript
// ❌ 错误：在条件语句中使用Hook
function BadComponent({ condition }) {
  const [count, setCount] = useState(0);

  if (condition) {
    const [name, setName] = useState('');  // 错误！
  }

  const [age, setAge] = useState(25);

  return <div>{count}</div>;
}

// 问题分析：
// 第一次渲染（condition=true）：
// Hook链表：count -> name -> age

// 第二次渲染（condition=false）：
// Hook链表：count -> age
// 但React会按照顺序读取：
// - 读取第1个：count ✓
// - 读取第2个：期望是name，实际是age ✗ 类型错误！
// - 读取第3个：期望是age，实际是null ✗ 崩溃！

// ✅ 正确：所有Hooks在顶层
function GoodComponent({ condition }) {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState(25);

  // 在返回的JSX中使用条件
  return (
    <div>
      {count}
      {condition && <div>{name}</div>}
    </div>
  );
}
```

## 2. Hooks闭包陷阱

### 经典闭包陷阱示例

```javascript
// 问题：获取的是旧值
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Count:', count);  // 永远打印0！
      setCount(count + 1);           // 基于旧值更新
    }, 1000);

    return () => clearInterval(timer);
  }, []);  // 空依赖，只执行一次

  return <div>{count}</div>;
}

// 原因分析：
// 1. useEffect创建闭包，捕获count的初始值（0）
// 2. setInterval回调也形成闭包，引用的count始终是0
// 3. 虽然count在增加，但闭包中的count不变

// 解决方案1：添加依赖
function Counter1() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Count:', count);
      setCount(count + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [count]);  // 依赖count，每次都重新创建

  // 问题：每秒都会清除并重新创建定时器，性能差
  return <div>{count}</div>;
}

// 解决方案2：使用函数式更新
function Counter2() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => {
        console.log('Count:', c);  // 获取最新值
        return c + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);  // 空依赖，只创建一次

  // ✅ 完美：定时器只创建一次，且能获取最新值
  return <div>{count}</div>;
}

// 解决方案3：使用useRef
function Counter3() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  useEffect(() => {
    countRef.current = count;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Count:', countRef.current);  // 获取最新值
      setCount(countRef.current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

### 事件处理器的闭包陷阱

```javascript
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  // ❌ 问题：debounce捕获旧的query
  const debouncedSearch = useMemo(
    () => debounce(async () => {
      const data = await fetch(`/api/search?q=${query}`).then(r => r.json());
      setResults(data);
    }, 300),
    []  // 空依赖，query永远是初始值
  );

  useEffect(() => {
    debouncedSearch();
  }, [query]);

  // ✅ 解决方案1：添加query依赖（但会重新创建debounce）
  const debouncedSearch = useMemo(
    () => debounce(async () => {
      const data = await fetch(`/api/search?q=${query}`).then(r => r.json());
      setResults(data);
    }, 300),
    [query]  // 每次query变化都重新创建
  );

  // ✅ 解决方案2：使用ref保存最新值
  const queryRef = useRef(query);
  queryRef.current = query;

  const debouncedSearch = useMemo(
    () => debounce(async () => {
      const data = await fetch(`/api/search?q=${queryRef.current}`).then(r => r.json());
      setResults(data);
    }, 300),
    []  // 只创建一次
  );

  // ✅ 解决方案3：自定义Hook
  const debouncedSearch = useDebouncedCallback(
    async (searchQuery) => {
      const data = await fetch(`/api/search?q=${searchQuery}`).then(r => r.json());
      setResults(data);
    },
    300
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>
        {results.map(item => <li key={item.id}>{item.name}</li>)}
      </ul>
    </div>
  );
}

// 自定义Hook实现
function useDebouncedCallback(callback, delay) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef(null);

  // 保持callback最新
  useEffect(() => {
    callbackRef.current = callback;
  });

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}
```

### useEffect的闭包陷阱

```javascript
// 问题：props和state不同步
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  // ❌ 问题：userId变化时，可能会产生竞态条件
  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);  // 可能是旧的userId的结果！
    });
  }, [userId]);

  // 场景：
  // 1. userId=1，发起请求A
  // 2. userId=2，发起请求B
  // 3. 请求B先返回，设置user为用户2
  // 4. 请求A后返回，设置user为用户1（错误！）

  // ✅ 解决方案：使用cleanup和标志位
  useEffect(() => {
    let isActive = true;

    fetchUser(userId).then(data => {
      if (isActive) {
        setUser(data);
      }
    });

    return () => {
      isActive = false;  // 清理时标记为无效
    };
  }, [userId]);

  // ✅ 解决方案2：使用AbortController
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/users/${userId}`, {
      signal: controller.signal
    })
      .then(r => r.json())
      .then(data => setUser(data))
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      });

    return () => {
      controller.abort();  // 取消请求
    };
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

## 3. 自定义Hooks最佳实践

### 封装复用逻辑

```javascript
// 1. useAsync - 处理异步请求
function useAsync(asyncFunction, immediate = true) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback((...args) => {
    setStatus('pending');
    setData(null);
    setError(null);

    return asyncFunction(...args)
      .then(response => {
        setData(response);
        setStatus('success');
        return response;
      })
      .catch(error => {
        setError(error);
        setStatus('error');
        throw error;
      });
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, data, error };
}

// 使用
function UserProfile({ userId }) {
  const { data: user, status, error } = useAsync(
    () => fetch(`/api/users/${userId}`).then(r => r.json()),
    true
  );

  if (status === 'pending') return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error.message}</div>;
  if (status === 'success') return <div>{user.name}</div>;
  return null;
}

// 2. useLocalStorage - 同步到localStorage
function useLocalStorage(key, initialValue) {
  // 惰性初始化
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      // 支持函数式更新
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// 使用
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  return (
    <div>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('light')}>Light</button>
    </div>
  );
}

// 3. useDebounce - 防抖值
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 使用
function SearchComponent() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery) {
      fetch(`/api/search?q=${debouncedQuery}`)
        .then(r => r.json())
        .then(data => console.log(data));
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// 4. usePrevious - 获取上一次的值
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}

// 使用
function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <div>
      <p>Now: {count}, Before: {prevCount}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}

// 5. useInterval - 声明式定时器
function useInterval(callback, delay) {
  const savedCallback = useRef();

  // 保存最新的callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // 设置定时器
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// 使用
function Timer() {
  const [count, setCount] = useState(0);

  useInterval(() => {
    setCount(count + 1);
  }, 1000);

  return <div>{count}</div>;
}

// 6. useWindowSize - 响应窗口大小
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// 使用
function ResponsiveComponent() {
  const { width } = useWindowSize();

  return (
    <div>
      {width < 768 ? <MobileView /> : <DesktopView />}
    </div>
  );
}

// 7. useOnClickOutside - 点击外部
function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// 使用
function Modal() {
  const ref = useRef();
  const [isOpen, setIsOpen] = useState(false);

  useOnClickOutside(ref, () => setIsOpen(false));

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && (
        <div ref={ref} className="modal">
          Modal Content
        </div>
      )}
    </>
  );
}
```

## 4. Hooks性能优化

### useMemo和useCallback的正确使用

```javascript
// ❌ 过度使用useMemo
function BadComponent({ items }) {
  // 不需要：计算很简单
  const count = useMemo(() => items.length, [items]);

  // 不需要：每次都要重新创建
  const obj = useMemo(() => ({ value: 1 }), []);

  return <div>{count}</div>;
}

// ✅ 合理使用useMemo
function GoodComponent({ items, filter }) {
  // 需要：计算复杂
  const filteredItems = useMemo(() => {
    console.log('Expensive calculation');
    return items
      .filter(item => item.type === filter)
      .map(item => ({ ...item, processed: true }))
      .sort((a, b) => a.value - b.value);
  }, [items, filter]);

  // 需要：避免子组件重渲染
  const config = useMemo(() => ({
    option1: true,
    option2: false
  }), []);

  return <ExpensiveChild items={filteredItems} config={config} />;
}

// useCallback的场景
function Parent() {
  const [count, setCount] = useState(0);
  const [other, setOther] = useState(0);

  // ❌ 不需要：没有传给子组件
  const handleClick1 = useCallback(() => {
    console.log('clicked');
  }, []);

  // ✅ 需要：传给使用memo的子组件
  const handleClick2 = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  // ✅ 需要：作为useEffect的依赖
  const fetchData = useCallback(async () => {
    const data = await fetch('/api/data').then(r => r.json());
    setCount(data.count);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <button onClick={handleClick1}>Regular</button>
      <MemoizedChild onClick={handleClick2} />
      <div>{count}</div>
    </>
  );
}

const MemoizedChild = React.memo(({ onClick }) => {
  console.log('Child rendered');
  return <button onClick={onClick}>Click me</button>;
});
```

### 批量更新优化

```javascript
// React 18自动批处理
function AutoBatchingComponent() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);

  function handleClick() {
    // 自动批处理，只触发一次渲染
    setCount(c => c + 1);
    setFlag(f => !f);

    // 异步中也会批处理
    setTimeout(() => {
      setCount(c => c + 1);
      setFlag(f => !f);
    }, 1000);
  }

  console.log('render');  // 只打印一次

  return <button onClick={handleClick}>Next</button>;
}

// 退出批处理（少见）
import { flushSync } from 'react-dom';

function ForceRenderComponent() {
  const [count, setCount] = useState(0);

  function handleClick() {
    flushSync(() => {
      setCount(c => c + 1);
    });
    // 此时DOM已更新，可以读取
    console.log(document.getElementById('count').textContent);
  }

  return (
    <>
      <div id="count">{count}</div>
      <button onClick={handleClick}>+1</button>
    </>
  );
}
```

### 避免不必要的重渲染

```javascript
// 1. 拆分组件
// ❌ 整个父组件重渲染
function BadParent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <ExpensiveComponent />  {/* 每次都重渲染 */}
    </div>
  );
}

// ✅ 只有计数器重渲染
function GoodParent() {
  return (
    <div>
      <Counter />
      <ExpensiveComponent />  {/* 不会重渲染 */}
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// 2. children作为prop
// ✅ children不会重渲染
function Container({ children }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      {children}  {/* 不会重渲染 */}
    </div>
  );
}

function App() {
  return (
    <Container>
      <ExpensiveComponent />
    </Container>
  );
}

// 3. 使用React.memo
const ExpensiveComponent = React.memo(({ data }) => {
  console.log('Expensive render');
  return <div>{data.value}</div>;
});

// 自定义比较
const SmartComponent = React.memo(
  ({ user }) => <div>{user.name}</div>,
  (prevProps, nextProps) => {
    // 返回true表示不重渲染
    return prevProps.user.id === nextProps.user.id;
  }
);
```

## 5. Hooks常见错误和解决方案

### 错误1：无限循环

```javascript
// ❌ 无限循环
function InfiniteLoop() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1);  // 导致重渲染，又触发useEffect
  });  // 没有依赖数组

  return <div>{count}</div>;
}

// ✅ 添加依赖数组
function Fixed() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 只在组件挂载时执行一次
  }, []);

  return <div>{count}</div>;
}
```

### 错误2：过时的state

```javascript
// ❌ 获取过时的state
function StaleState() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setTimeout(() => {
      setCount(count + 1);  // count是点击时的值
    }, 3000);
  };

  // 快速点击3次，count只会变成1！
  return <button onClick={handleClick}>{count}</button>;
}

// ✅ 使用函数式更新
function Fresh() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setTimeout(() => {
      setCount(c => c + 1);  // 获取最新值
    }, 3000);
  };

  return <button onClick={handleClick}>{count}</button>;
}
```

### 错误3：useEffect的竞态条件

```javascript
// ❌ 竞态条件
function RaceCondition({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(data => setUser(data));
  }, [userId]);

  // 问题：快速切换userId时，可能显示错误的用户
}

// ✅ 使用cleanup
function Fixed({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchUser(userId).then(data => {
      if (!cancelled) {
        setUser(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

这是React Hooks的深度解析，涵盖了底层原理、闭包陷阱、自定义Hooks、性能优化和常见错误。每个部分都包含了原理分析和实战代码！

