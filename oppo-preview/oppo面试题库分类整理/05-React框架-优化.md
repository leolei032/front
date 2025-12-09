# React框架

## 1. React diff原理和Fiber架构
**问题：** React diff原理

### 深度解析

#### React为什么需要Fiber架构？

**React 15的痛点：**
```javascript
// React 15的递归diff过程
function reconcileChildren(current, workInProgress) {
  // 递归对比子节点
  for (let child of children) {
    reconcileChildren(child); // 递归，无法中断
  }
}

// 问题：大组件树的递归diff会长时间占用主线程
// 导致：动画卡顿、输入延迟、页面假死
```

**实际场景：**
```jsx
// 假设有个包含3000个节点的列表
function LargeList() {
  const [items, setItems] = useState(Array(3000).fill(0));

  return (
    <div>
      {items.map((_, i) => (
        <ComplexItem key={i} data={i} />
      ))}
    </div>
  );
}

// React 15: 一次性递归diff 3000个节点
// 耗时: 假设每个节点1ms，总共3000ms
// 结果: 页面卡死3秒，所有交互无响应
```

#### Fiber架构的核心思想

**时间切片（Time Slicing）**
```javascript
// Fiber将渲染工作拆分成小任务
function workLoop(deadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    // 执行一个工作单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // 检查是否还有剩余时间
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (nextUnitOfWork) {
    // 还有工作，等待下一帧
    requestIdleCallback(workLoop);
  } else {
    // 工作完成，提交更新
    commitRoot();
  }
}

requestIdleCallback(workLoop);
```

**关键特性：**
1. **可中断**：每个工作单元执行后检查是否需要让出主线程
2. **可恢复**：中断后可以从断点继续
3. **优先级**：紧急更新（用户输入）优先于不紧急更新（数据刷新）

#### Fiber的数据结构

```javascript
// Fiber节点（链表结构，而非树结构）
function FiberNode(tag, pendingProps, key) {
  // 标识fiber类型
  this.tag = tag;               // 0:FunctionComponent, 1:ClassComponent, 5:HostComponent
  this.key = key;
  this.type = null;             // 组件类型，如'div'、函数组件、类组件

  // Fiber树结构（链表）
  this.return = null;           // 父Fiber
  this.child = null;            // 第一个子Fiber
  this.sibling = null;          // 下一个兄弟Fiber

  // 双缓存
  this.alternate = null;        // 指向另一棵树中对应的Fiber

  // 副作用
  this.effectTag = null;        // 标记操作类型：Placement(插入)、Update(更新)、Deletion(删除)
  this.nextEffect = null;       // 指向下一个有副作用的Fiber

  // 数据
  this.pendingProps = pendingProps;
  this.memoizedProps = null;    // 上次渲染的props
  this.memoizedState = null;    // 上次渲染的state
  this.updateQueue = null;      // 更新队列

  // 优先级
  this.lanes = NoLanes;         // 当前Fiber的优先级
  this.childLanes = NoLanes;    // 子Fiber的优先级
}
```

**为什么用链表而非树？**
```javascript
// 链表可以中断和恢复遍历
function traverseFiber(fiber) {
  let currentFiber = fiber;

  while (currentFiber) {
    // 处理当前节点
    performWork(currentFiber);

    // 有子节点，进入子节点
    if (currentFiber.child) {
      currentFiber = currentFiber.child;
      continue;
    }

    // 没有子节点，找兄弟节点
    while (!currentFiber.sibling) {
      // 没有兄弟节点，返回父节点
      if (!currentFiber.return) return; // 遍历完成
      currentFiber = currentFiber.return;
    }

    currentFiber = currentFiber.sibling;
  }
}

// 可以在任何时刻记录currentFiber位置，中断后继续
```

#### 双缓存机制（Double Buffering）

```javascript
// React维护两棵Fiber树
const current = {
  // 当前屏幕显示的Fiber树
  // 对应已经渲染到页面的内容
};

const workInProgress = {
  // 正在内存中构建的Fiber树
  // 对应即将更新的内容
};

// 更新流程：
// 1. 基于current树，在内存中构建workInProgress树
// 2. workInProgress树构建完成后，替换current树
// 3. 一次性提交更新到DOM

// 类似canvas的双缓冲，避免闪烁
```

#### Diff算法的实际应用

**场景1：列表diff优化**

```jsx
// 问题：删除列表中间元素导致大量DOM操作
const oldList = ['A', 'B', 'C', 'D', 'E'];
const newList = ['A', 'B', 'D', 'E'];

// ❌ 不使用key：React无法识别'C'被删除
// 会认为：C变成D，D变成E，E被删除
// 操作：3次DOM更新
<ul>
  {newList.map((item, index) => (
    <li key={index}>{item}</li>
  ))}
</ul>

// ✅ 使用key：React知道只是删除了'C'
// 操作：1次DOM删除
<ul>
  {newList.map(item => (
    <li key={item}>{item}</li>
  ))}
</ul>
```

**场景2：复杂组件的diff**

```jsx
function ComplexComponent({ user }) {
  return (
    <div>
      <Header />
      <Profile user={user} />
      <Posts userId={user.id} />
    </div>
  );
}

// 当user变化时：
// 1. React对比div（type相同，复用）
// 2. 对比Header（type相同，props没变，跳过）
// 3. 对比Profile（type相同，props变了，更新）
// 4. 对比Posts（type相同，props变了，更新）

// 如果没有React.memo或shouldComponentUpdate：
// Header也会重新渲染（即使props没变）

// 优化：
const Header = React.memo(function Header() {
  return <header>...</header>;
});
```

#### 优先级调度

```javascript
// React中的优先级级别（从高到低）
const ImmediatePriority = 1;    // 立即执行，如用户输入
const UserBlockingPriority = 2; // 用户交互，如点击、滚动
const NormalPriority = 3;       // 普通更新，如网络请求
const LowPriority = 4;          // 低优先级，如分析统计
const IdlePriority = 5;         // 空闲时执行

// 实际应用场景
function SearchInput() {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleChange = (e) => {
    // 高优先级：立即更新输入框
    setInputValue(e.target.value);

    // 低优先级：延迟更新搜索结果
    startTransition(() => {
      fetchSearchResults(e.target.value).then(setSearchResults);
    });
  };

  return (
    <>
      <input value={inputValue} onChange={handleChange} />
      <Results data={searchResults} />
    </>
  );
}

// startTransition让搜索结果更新不会阻塞输入
// 用户输入时，输入框实时响应
// 搜索结果在空闲时更新
```

#### Fiber带来的性能提升

**对比测试：**
```javascript
// 测试场景：渲染1000个复杂组件
function App() {
  const [items] = useState(Array(1000).fill(0));

  return (
    <div>
      {items.map((_, i) => (
        <ComplexItem key={i} data={i} />
      ))}
    </div>
  );
}

// React 15（递归）：
// - 总耗时：~300ms
// - 阻塞主线程：300ms连续占用
// - 用户体验：页面卡死，无法交互

// React 16+（Fiber）：
// - 总耗时：~320ms（略慢，因为调度开销）
// - 阻塞主线程：每次5ms，分60次执行
// - 用户体验：始终保持60fps，交互流畅
```

## 2. React Hooks的底层实现
**问题：** React Hooks使用和原理

### 深度解析

#### Hooks为什么必须遵守规则？

**Hooks的底层数据结构：链表**

```javascript
// Fiber节点中的memoizedState
fiber.memoizedState = {
  // Hook1: useState
  memoizedState: 0,        // state值
  queue: {                 // 更新队列
    pending: null
  },
  next: {
    // Hook2: useEffect
    memoizedState: {
      create: () => {},    // effect函数
      destroy: undefined,   // 清理函数
      deps: [dep1, dep2]   // 依赖数组
    },
    next: {
      // Hook3: useState
      memoizedState: 'hello',
      queue: { pending: null },
      next: null
    }
  }
};
```

**为什么不能在条件语句中使用Hooks？**

```javascript
// ❌ 错误示例
function Component({ condition }) {
  const [a, setA] = useState(1);  // Hook1

  if (condition) {
    const [b, setB] = useState(2); // Hook2（有时存在）
  }

  const [c, setC] = useState(3);  // Hook3（位置会变）

  // 第一次渲染(condition=true):  Hook1 -> Hook2 -> Hook3
  // 第二次渲染(condition=false): Hook1 -> Hook3
  // React用链表顺序标识Hook，顺序变了会出错
}

// ✅ 正确做法
function Component({ condition }) {
  const [a, setA] = useState(1);
  const [b, setB] = useState(condition ? 2 : null);
  const [c, setC] = useState(3);
}
```

#### useState的实现原理

```javascript
// 简化版useState实现
let hookIndex = 0;
let hooks = [];

function useState(initialValue) {
  const currentIndex = hookIndex;

  // 初始化
  hooks[currentIndex] = hooks[currentIndex] || initialValue;

  const setState = (newValue) => {
    // 更新state
    hooks[currentIndex] = newValue;

    // 触发重新渲染
    scheduleUpdate();
  };

  // 移动到下一个hook
  hookIndex++;

  return [hooks[currentIndex], setState];
}

// 重新渲染时重置索引
function render() {
  hookIndex = 0;
  Component();
}
```

#### useEffect的执行时机

**useEffect vs useLayoutEffect**

```javascript
function Component() {
  useEffect(() => {
    console.log('useEffect执行');
    // 浏览器绘制后执行（异步）
  });

  useLayoutEffect(() => {
    console.log('useLayoutEffect执行');
    // 浏览器绘制前执行（同步）
  });

  return <div>Hello</div>;
}

// 执行顺序：
// 1. 渲染虚拟DOM
// 2. 提交到DOM
// 3. 执行useLayoutEffect（阻塞绘制）
// 4. 浏览器绘制
// 5. 执行useEffect（不阻塞）

// 使用场景：
// useEffect: 大部分情况（数据获取、订阅）
// useLayoutEffect: 需要读取DOM布局并同步更新（测量尺寸、位置）
```

**实际应用：测量元素尺寸**

```jsx
function MeasuredComponent() {
  const [height, setHeight] = useState(0);
  const ref = useRef(null);

  // ❌ 使用useEffect会闪烁
  useEffect(() => {
    setHeight(ref.current.offsetHeight);
  }, []);

  // ✅ 使用useLayoutEffect避免闪烁
  useLayoutEffect(() => {
    setHeight(ref.current.offsetHeight);
  }, []);

  return (
    <div ref={ref}>
      <p>高度: {height}px</p>
    </div>
  );
}
```

#### useCallback和useMemo的性能陷阱

```javascript
// ❌ 过度使用反而降低性能
function Component({ data }) {
  // 每次渲染都要检查依赖、比较
  const memoizedValue = useMemo(() => data.value, [data.value]);
  const memoizedCallback = useCallback(() => {
    console.log(data.value);
  }, [data.value]);

  // 如果data.value每次都变，useMemo/useCallback反而增加开销
}

// ✅ 正确使用场景
function ParentComponent() {
  const [count, setCount] = useState(0);
  const [other, setOther] = useState(0);

  // 避免子组件不必要的重渲染
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []); // 依赖为空，函数引用永远不变

  return (
    <>
      <ExpensiveChild onIncrement={increment} />
      <button onClick={() => setOther(other + 1)}>
        更新other不会导致ExpensiveChild重渲染
      </button>
    </>
  );
}

const ExpensiveChild = React.memo(({ onIncrement }) => {
  console.log('ExpensiveChild渲染');
  return <button onClick={onIncrement}>Increment</button>;
});
```

#### 自定义Hook的实战模式

**网络请求Hook**
```javascript
function useFetch(url, options) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url, options);

        if (!response.ok) throw new Error(response.statusText);

        const json = await response.json();

        // 避免组件卸载后更新state
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url]); // options变化不重新请求

  return { data, loading, error };
}

// 使用
function UserProfile({ userId }) {
  const { data: user, loading, error } = useFetch(`/api/users/${userId}`);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;
  return <Profile user={user} />;
}
```

**防抖Hook**
```javascript
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

// 使用：搜索输入
function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      // 只有在用户停止输入500ms后才搜索
      fetchSearchResults(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      placeholder="搜索..."
    />
  );
}
```

## 3. React性能优化实战
**问题：** React性能优化方法

### 实战案例

#### 案例1：长列表优化

**问题场景：**
```jsx
// 渲染10000条数据，页面卡死
function LongList({ data }) {
  return (
    <div style={{ height: '600px', overflow: 'auto' }}>
      {data.map(item => (
        <ListItem key={item.id} data={item} />
      ))}
    </div>
  );
}
```

**优化方案：虚拟列表**
```jsx
import { FixedSizeList } from 'react-window';

function VirtualizedList({ data }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={data.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ListItem data={data[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}

// 优化效果：
// - 只渲染可见区域的~20个元素
// - 初次渲染时间：从3000ms降到50ms
// - 内存占用：降低98%
// - 滚动帧率：稳定60fps
```

#### 案例2：避免不必要的重渲染

**问题：**
```jsx
function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <ExpensiveTree />
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

// 每次点击按钮，ExpensiveTree都会重渲染（即使它不依赖count）
```

**优化1：提升状态**
```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}

function App() {
  return (
    <div>
      <ExpensiveTree />
      <Counter />
    </div>
  );
}
// ExpensiveTree不再随Counter更新而重渲染
```

**优化2：children prop**
```jsx
function App({ children }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      {children}
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

// 使用
<App>
  <ExpensiveTree />
</App>

// ExpensiveTree作为children传入，不会随App的state变化而重渲染
```

#### 案例3：代码分割

```jsx
// 路由级代码分割
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./routes/Home'));
const About = lazy(() => import('./routes/About'));
const Contact = lazy(() => import('./routes/Contact'));

function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// 优化效果：
// - 首屏bundle大小：从500KB降到150KB
// - 首屏加载时间：从3s降到1s
// - 其他路由按需加载
```
