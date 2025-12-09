# React 18新特性深度解析

## 1. React 18概览

### 主要新特性

```javascript
// React 18的核心特性
/*
1. Automatic Batching（自动批处理）
2. Transitions（过渡更新）
3. Suspense改进
4. Concurrent Rendering（并发渲染）
5. 新的Hooks（useId、useTransition、useDeferredValue等）
6. Streaming SSR
7. Strict Mode改进
*/

// React 17 vs React 18
// React 17
import { render } from 'react-dom';
render(<App />, document.getElementById('root'));

// React 18 (Concurrent Features)
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Legacy模式 vs Concurrent模式
// Legacy: ReactDOM.render() - React 17行为
// Concurrent: createRoot() - 启用所有新特性
```

## 2. Automatic Batching（自动批处理）

### 什么是批处理

```javascript
// 批处理：将多个状态更新合并成一次重新渲染

// React 17的批处理
// 只在事件处理器中批处理
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // 只触发一次重新渲染 ✓
}

// 但在Promise、setTimeout等异步中不批处理
fetch('/api').then(() => {
  setCount(c => c + 1);  // 触发一次渲染
  setFlag(f => !f);      // 又触发一次渲染
});  // 总共2次渲染 ✗

setTimeout(() => {
  setCount(c => c + 1);  // 触发一次渲染
  setFlag(f => !f);      // 又触发一次渲染
}, 1000);  // 总共2次渲染 ✗

// React 18的自动批处理
// 在所有地方都批处理
fetch('/api').then(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // 只触发一次重新渲染 ✓
});

setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // 只触发一次重新渲染 ✓
}, 1000);

// 原生事件处理器中也批处理
document.addEventListener('click', () => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // 只触发一次重新渲染 ✓（React 17中是2次）
});
```

### 原理和实现

```javascript
// React 18的批处理原理

// 批处理上下文
let isBatchingUpdates = false;
const pendingUpdates = [];

function batchedUpdates(fn) {
  if (isBatchingUpdates) {
    // 已经在批处理中，直接执行
    return fn();
  }

  isBatchingUpdates = true;

  try {
    return fn();
  } finally {
    isBatchingUpdates = false;
    // 执行所有挂起的更新
    flushPendingUpdates();
  }
}

function setState(update) {
  if (isBatchingUpdates) {
    // 在批处理中，加入队列
    pendingUpdates.push(update);
  } else {
    // 不在批处理中，立即执行
    performUpdate(update);
  }
}

function flushPendingUpdates() {
  if (pendingUpdates.length === 0) return;

  // 合并所有更新
  const updates = [...pendingUpdates];
  pendingUpdates.length = 0;

  // 一次性执行
  performBatchedUpdates(updates);
}

// React 18自动包装所有更新
// 在事件处理器中
function handleClick() {
  // 自动包装在batchedUpdates中
  batchedUpdates(() => {
    setCount(c => c + 1);
    setFlag(f => !f);
  });
}

// 在异步回调中
fetch('/api').then(() => {
  // 也自动包装在batchedUpdates中
  batchedUpdates(() => {
    setCount(c => c + 1);
    setFlag(f => !f);
  });
});
```

### 退出批处理

```javascript
// 如果需要退出批处理，使用flushSync

import { flushSync } from 'react-dom';

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1);
  });  // 立即渲染，不批处理

  // 浏览器已经重新渲染了
  console.log(divRef.current.textContent);  // 新的count值

  setFlag(f => !f);  // 另一次渲染
}

// 使用场景：需要立即读取DOM
function ScrollToBottom() {
  const ref = useRef();

  function handleClick() {
    flushSync(() => {
      setItems(items => [...items, newItem]);
    });

    // 立即滚动到底部（DOM已更新）
    ref.current.scrollTop = ref.current.scrollHeight;
  }

  return (
    <div ref={ref}>
      {items.map(item => <div key={item.id}>{item.text}</div>)}
      <button onClick={handleClick}>Add and Scroll</button>
    </div>
  );
}

// ⚠️ 注意：flushSync会强制同步渲染，影响性能
// 只在必要时使用
```

## 3. Transitions（过渡更新）

### useTransition Hook

```javascript
// useTransition：标记非紧急更新

import { useState, useTransition } from 'react';

function App() {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [list, setList] = useState([]);

  function handleChange(e) {
    // 紧急更新：立即响应用户输入
    setInput(e.target.value);

    // 非紧急更新：可以延迟
    startTransition(() => {
      // 昂贵的计算
      const newList = filterList(e.target.value);
      setList(newList);
    });
  }

  return (
    <>
      <input value={input} onChange={handleChange} />
      {isPending && <Spinner />}
      <List items={list} />
    </>
  );
}

// 工作原理：
// 1. 用户输入 → setInput立即执行（SyncLane）
// 2. input更新 → 页面立即响应
// 3. startTransition中的更新 → 使用TransitionLane（低优先级）
// 4. 如果有新的输入 → 放弃当前transition，开始新的
// 5. isPending标志 → 显示加载状态
```

### Transition原理

```javascript
// Transition的优先级机制

// Lane定义
const SyncLane = 0b0000000000000000000000000000001;      // 最高
const InputContinuousLane = 0b0000000000000000000000000000100;
const DefaultLane = 0b0000000000000000000000000010000;
const TransitionLanes = 0b0000000001111111111111111000000;  // 低优先级
const IdleLane = 0b0100000000000000000000000000000;      // 最低

// useTransition实现（简化）
function useTransition() {
  const [isPending, setIsPending] = useState(false);

  const startTransition = useCallback((callback) => {
    // 1. 标记为pending
    setIsPending(true);

    // 2. 调度低优先级更新
    scheduleTransition(() => {
      callback();

      // 3. 完成后清除pending
      setIsPending(false);
    });
  }, []);

  return [isPending, startTransition];
}

function scheduleTransition(callback) {
  // 使用TransitionLane调度
  const previousLane = currentLane;
  currentLane = TransitionLane;

  try {
    callback();
  } finally {
    currentLane = previousLane;
  }
}

// 中断机制
let currentTransition = null;

function startNewTransition(callback) {
  // 取消旧的transition
  if (currentTransition) {
    currentTransition.cancel();
  }

  // 开始新的transition
  currentTransition = {
    callback,
    cancel: () => {
      currentTransition = null;
    }
  };

  scheduleTransition(callback);
}
```

### 实战案例

```javascript
// 案例1：搜索过滤

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value) {
    // 立即更新输入框
    setQuery(value);

    // 延迟更新搜索结果
    startTransition(() => {
      const filtered = largeDataset.filter(item =>
        item.name.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    });
  }

  return (
    <div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      {isPending && <div>Searching...</div>}
      <ResultsList results={results} />
    </div>
  );
}

// 案例2：Tab切换

function Tabs() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  function selectTab(nextTab) {
    startTransition(() => {
      setTab(nextTab);
    });
  }

  return (
    <>
      <TabButtons
        current={tab}
        onSelect={selectTab}
        isPending={isPending}
      />
      <TabPanel tab={tab} />
    </>
  );
}

// 案例3：虚拟列表滚动

function VirtualList({ items }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleItems, setVisibleItems] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleScroll(e) {
    const newScrollTop = e.target.scrollTop;

    // 立即更新滚动位置
    setScrollTop(newScrollTop);

    // 延迟更新可见项
    startTransition(() => {
      const newVisibleItems = calculateVisibleItems(newScrollTop, items);
      setVisibleItems(newVisibleItems);
    });
  }

  return (
    <div onScroll={handleScroll} style={{ height: 400, overflow: 'auto' }}>
      {isPending && <LoadingOverlay />}
      {visibleItems.map(item => <Item key={item.id} {...item} />)}
    </div>
  );
}
```

## 4. useDeferredValue

### 基础用法

```javascript
// useDeferredValue：延迟更新值

import { useState, useDeferredValue } from 'react';

function App() {
  const [input, setInput] = useState('');
  const deferredInput = useDeferredValue(input);

  return (
    <>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <SlowList text={deferredInput} />
    </>
  );
}

// 工作原理：
// 1. 用户输入 → input立即更新
// 2. deferredInput → 延迟更新（低优先级）
// 3. 如果input继续变化 → 放弃旧的deferredInput更新
// 4. input稳定后 → deferredInput才更新

// vs useTransition
// useTransition：包装更新逻辑，控制何时进入pending状态
// useDeferredValue：延迟值本身，自动跟随最新值
```

### 原理实现

```javascript
// useDeferredValue实现（简化）

function useDeferredValue(value) {
  const [deferredValue, setDeferredValue] = useState(value);

  useEffect(() => {
    // 使用TransitionLane调度更新
    startTransition(() => {
      setDeferredValue(value);
    });
  }, [value]);

  return deferredValue;
}

// 完整实现
function useDeferredValue(value, initialValue) {
  const [prevValue, setPrevValue] = useState(initialValue ?? value);

  useEffect(() => {
    if (prevValue !== value) {
      // 调度低优先级更新
      scheduleTransition(() => {
        setPrevValue(value);
      });
    }
  }, [value, prevValue]);

  return prevValue;
}
```

### 实战案例

```javascript
// 案例1：实时搜索

function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => search(deferredQuery),
    [deferredQuery]
  );

  return (
    <div>
      {query !== deferredQuery && <div>Loading...</div>}
      <ResultsList results={results} />
    </div>
  );
}

// 案例2：图表渲染

function Chart({ data }) {
  const deferredData = useDeferredValue(data);

  return (
    <ExpensiveChart data={deferredData} />
  );
}

// 案例3：markdown预览

function MarkdownEditor() {
  const [markdown, setMarkdown] = useState('');
  const deferredMarkdown = useDeferredValue(markdown);

  const html = useMemo(
    () => renderMarkdown(deferredMarkdown),
    [deferredMarkdown]
  );

  return (
    <div className="editor">
      <textarea
        value={markdown}
        onChange={e => setMarkdown(e.target.value)}
      />
      <Preview html={html} />
    </div>
  );
}
```

## 5. Suspense改进

### Suspense for Data Fetching

```javascript
// React 18的Suspense支持数据获取

// 创建resource
function wrapPromise(promise) {
  let status = 'pending';
  let result;

  const suspender = promise.then(
    r => {
      status = 'success';
      result = r;
    },
    e => {
      status = 'error';
      result = e;
    }
  );

  return {
    read() {
      if (status === 'pending') {
        throw suspender;  // Suspense会捕获这个Promise
      }
      if (status === 'error') {
        throw result;
      }
      return result;
    }
  };
}

// 使用Suspense
function ProfilePage({ userId }) {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileDetails userId={userId} />
      <Suspense fallback={<PostsLoading />}>
        <ProfilePosts userId={userId} />
      </Suspense>
    </Suspense>
  );
}

function ProfileDetails({ userId }) {
  const user = userResource.read();  // 可能抛出Promise
  return <div>{user.name}</div>;
}

function ProfilePosts({ userId }) {
  const posts = postsResource.read();  // 可能抛出Promise
  return posts.map(post => <Post key={post.id} {...post} />);
}

// 数据获取
const userResource = wrapPromise(fetchUser(userId));
const postsResource = wrapPromise(fetchPosts(userId));
```

### Suspense列表

```javascript
// SuspenseList：协调多个Suspense的显示顺序

import { SuspenseList, Suspense } from 'react';

function App() {
  return (
    <SuspenseList revealOrder="forwards">
      <Suspense fallback={<Loading />}>
        <ProfilePicture />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <ProfileDetails />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <ProfilePosts />
      </Suspense>
    </SuspenseList>
  );
}

// revealOrder选项：
// - "forwards": 从前到后依次显示
// - "backwards": 从后到前依次显示
// - "together": 一起显示
```

## 6. 新的Hooks

### useId

```javascript
// useId：生成唯一ID，支持SSR

import { useId } from 'react';

function PasswordField() {
  const passwordHintId = useId();

  return (
    <>
      <label>
        Password:
        <input type="password" aria-describedby={passwordHintId} />
      </label>
      <p id={passwordHintId}>
        密码至少8个字符
      </p>
    </>
  );
}

// 为什么需要useId？
// 问题：使用随机ID在SSR中会不一致
function Bad() {
  const id = Math.random(); // ✗ 服务端和客户端不一致
  return <label htmlFor={id}>Name</label>;
}

// 解决：useId保证SSR和客户端一致
function Good() {
  const id = useId(); // ✓ 一致
  return <label htmlFor={id}>Name</label>;
}

// 生成多个ID
function Form() {
  const id = useId();
  return (
    <>
      <label htmlFor={id + '-name'}>Name</label>
      <input id={id + '-name'} />

      <label htmlFor={id + '-email'}>Email</label>
      <input id={id + '-email'} />
    </>
  );
}
```

### useSyncExternalStore

```javascript
// useSyncExternalStore：订阅外部store

import { useSyncExternalStore } from 'react';

// 订阅window尺寸
function useWindowSize() {
  const size = useSyncExternalStore(
    // subscribe函数
    callback => {
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    // getSnapshot函数
    () => ({ width: window.innerWidth, height: window.innerHeight }),
    // getServerSnapshot（SSR）
    () => ({ width: 0, height: 0 })
  );

  return size;
}

// 使用
function Component() {
  const { width, height } = useWindowSize();
  return <div>Window size: {width} x {height}</div>;
}

// 订阅Redux store
function useStore(selector) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

// 使用
function Component() {
  const user = useStore(state => state.user);
  return <div>Hello {user.name}</div>;
}
```

### useInsertionEffect

```javascript
// useInsertionEffect：在DOM变更前触发，用于CSS-in-JS

import { useInsertionEffect } from 'react';

function useCSS(rule) {
  useInsertionEffect(() => {
    // 在DOM变更前插入样式
    const style = document.createElement('style');
    style.textContent = rule;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [rule]);
}

// 使用
function Button() {
  useCSS('.button { color: red; }');
  return <button className="button">Click me</button>;
}

// 执行顺序：
// useInsertionEffect → DOM变更 → useLayoutEffect → 浏览器绘制 → useEffect
```

## 7. Streaming SSR

### Selective Hydration

```javascript
// React 18的SSR改进：选择性hydration

// 服务端
import { renderToPipeableStream } from 'react-dom/server';

function handleRequest(req, res) {
  const { pipe } = renderToPipeableStream(<App />, {
    onShellReady() {
      // HTML外壳准备好了，开始流式传输
      res.setHeader('Content-Type', 'text/html');
      pipe(res);
    },
    onAllReady() {
      // 所有内容都准备好了
    }
  });
}

// 使用Suspense分块传输
function App() {
  return (
    <html>
      <head />
      <body>
        <Header />
        <Suspense fallback={<Spinner />}>
          <Comments />  {/* 延迟加载 */}
        </Suspense>
        <Footer />
      </body>
    </html>
  );
}

// 传输过程：
// 1. 立即发送：<Header /> + <Spinner /> + <Footer />
// 2. Comments准备好后：发送<script>替换Spinner
// 3. 客户端：自动替换，无需等待整个页面

// 客户端
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document, <App />);
// 自动按优先级hydrate：
// 1. 用户交互的组件优先
// 2. 其他组件按顺序
```

## 8. Strict Mode改进

```javascript
// React 18的Strict Mode会double-render

// 开发环境中的行为
function Component() {
  useEffect(() => {
    console.log('Mount');

    return () => {
      console.log('Unmount');
    };
  }, []);

  return <div>Component</div>;
}

// React 17 Strict Mode:
// Mount

// React 18 Strict Mode:
// Mount
// Unmount
// Mount

// 目的：测试组件是否正确清理副作用
// 确保组件能够多次mount/unmount

// 如何适配：
function useUser(userId) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchUser(userId).then(data => {
      if (!cancelled) {
        setUser(data);
      }
    });

    return () => {
      cancelled = true;  // 清理标志
    };
  }, [userId]);

  return user;
}
```

## 9. 迁移到React 18

```javascript
// 升级步骤

// 1. 安装React 18
npm install react@18 react-dom@18

// 2. 更新render方法
// 旧代码
import { render } from 'react-dom';
render(<App />, document.getElementById('root'));

// 新代码
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);

// 3. 更新TypeScript类型
npm install @types/react@18 @types/react-dom@18

// 4. 处理breaking changes
// - 去除ReactDOM.render的回调
// - 更新测试工具
// - 检查第三方库兼容性

// 5. 启用Concurrent Features
// 自动启用：
// - Automatic Batching
// - Suspense改进
// - Streaming SSR

// 手动使用：
// - useTransition
// - useDeferredValue
// - Suspense for Data Fetching

// 6. 性能测试
// 使用React DevTools Profiler
// 测试关键用户交互
// 对比React 17和18的性能
```

React 18带来了并发渲染的能力，深入理解这些新特性对于构建高性能的React应用至关重要！
