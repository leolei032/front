# React框架

## 1. React diff原理
**问题：** React diff原理

### 解答

#### React Diff算法三大策略

**1. Tree Diff（树层级）**
- React只会对同一层级的节点进行比较
- 如果节点不存在了，则该节点及其子节点会被完全删除
- 时间复杂度：O(n)

**2. Component Diff（组件层级）**
- 同一类型的组件，继续进行Tree Diff
- 不同类型的组件，直接替换整个组件及其子节点
- 可以使用shouldComponentUpdate()优化

**3. Element Diff（元素层级）**
- 对于同一层级的子节点，通过唯一key进行区分
- 插入、移动、删除操作

#### Diff算法流程

```javascript
// 简化的Diff算法实现
function diff(oldVNode, newVNode) {
  // 1. 节点类型不同，直接替换
  if (oldVNode.type !== newVNode.type) {
    return { type: 'REPLACE', newVNode };
  }

  // 2. 文本节点，比较文本内容
  if (typeof newVNode === 'string') {
    if (oldVNode !== newVNode) {
      return { type: 'TEXT', content: newVNode };
    }
    return null;
  }

  // 3. 同类型节点，比较属性
  const propsPatches = diffProps(oldVNode.props, newVNode.props);

  // 4. 比较子节点
  const childrenPatches = diffChildren(oldVNode.children, newVNode.children);

  return {
    type: 'UPDATE',
    props: propsPatches,
    children: childrenPatches
  };
}

function diffChildren(oldChildren, newChildren) {
  const patches = [];
  const oldKeys = oldChildren.map(child => child.key);
  const newKeys = newChildren.map(child => child.key);

  // 遍历新节点
  newChildren.forEach((newChild, index) => {
    const oldIndex = oldKeys.indexOf(newChild.key);

    if (oldIndex === -1) {
      // 新增节点
      patches.push({ type: 'INSERT', index, node: newChild });
    } else if (oldIndex !== index) {
      // 移动节点
      patches.push({ type: 'MOVE', from: oldIndex, to: index });
    } else {
      // 递归比较
      const patch = diff(oldChildren[oldIndex], newChild);
      if (patch) {
        patches.push({ type: 'PATCH', index, patch });
      }
    }
  });

  // 删除不存在的旧节点
  oldChildren.forEach((oldChild, index) => {
    if (!newKeys.includes(oldChild.key)) {
      patches.push({ type: 'REMOVE', index });
    }
  });

  return patches;
}
```

#### Key的重要性

```jsx
// 不使用key
{list.map((item, index) => (
  <div>{item.name}</div>
))}

// 使用key（推荐）
{list.map(item => (
  <div key={item.id}>{item.name}</div>
))}

// 不要使用index作为key（会导致性能问题）
{list.map((item, index) => (
  <div key={index}>{item.name}</div>
))}
```

#### React Fiber（React 16+）

React 16引入了Fiber架构，改进了Diff算法：
- **可中断的渲染**：将渲染工作分片，可以中断和恢复
- **优先级调度**：不同更新有不同优先级
- **增量渲染**：将渲染工作分散到多个帧

```javascript
// Fiber节点结构
{
  type: 'div',
  key: null,
  props: {},
  child: null,      // 第一个子节点
  sibling: null,    // 下一个兄弟节点
  return: null,     // 父节点
  alternate: null,  // 工作中的Fiber和已渲染的Fiber
  effectTag: null   // 副作用标记
}
```

## 2. React生命周期
**问题：** React生命周期

### 解答

#### 类组件生命周期（React 16.4+）

**挂载阶段**
```javascript
class Component extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
    // 初始化state、绑定方法
  }

  static getDerivedStateFromProps(props, state) {
    // 从props派生state，返回新state或null
    // 替代componentWillReceiveProps
    return null;
  }

  render() {
    // 渲染UI（必需）
    return <div>{this.state.count}</div>;
  }

  componentDidMount() {
    // 组件挂载后调用
    // 适合：发送网络请求、订阅、操作DOM
    fetch('/api/data').then(data => this.setState({ data }));
  }
}
```

**更新阶段**
```javascript
class Component extends React.Component {
  static getDerivedStateFromProps(props, state) {
    // 每次渲染前调用
    return null;
  }

  shouldComponentUpdate(nextProps, nextState) {
    // 决定是否重新渲染（性能优化）
    return nextState.count !== this.state.count;
  }

  render() {
    return <div>{this.state.count}</div>;
  }

  getSnapshotBeforeUpdate(prevProps, prevState) {
    // 在DOM更新前调用，返回值传给componentDidUpdate
    // 用于获取更新前的DOM信息
    return { scrollPosition: window.scrollY };
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // 组件更新后调用
    // 适合：网络请求（需判断props变化）、操作DOM
    if (prevProps.userId !== this.props.userId) {
      this.fetchData(this.props.userId);
    }
  }
}
```

**卸载阶段**
```javascript
class Component extends React.Component {
  componentWillUnmount() {
    // 组件卸载前调用
    // 适合：清理定时器、取消订阅、取消网络请求
    clearInterval(this.timer);
    this.subscription.unsubscribe();
  }
}
```

**错误处理**
```javascript
class ErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    // 渲染备用UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误日志
    console.error('Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
```

#### 函数组件Hooks

```javascript
import { useState, useEffect, useLayoutEffect } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  // 相当于 componentDidMount + componentDidUpdate
  useEffect(() => {
    // 副作用操作
    document.title = `Count: ${count}`;

    // 清理函数（相当于componentWillUnmount）
    return () => {
      // 清理操作
    };
  }, [count]); // 依赖数组

  // 空依赖数组：只在mount时执行
  useEffect(() => {
    fetch('/api/data');
  }, []);

  // useLayoutEffect：同步执行，在DOM更新后、浏览器绘制前
  useLayoutEffect(() => {
    // 操作DOM
  }, []);

  return <div>{count}</div>;
}
```

#### 生命周期对比

| 类组件 | 函数组件Hooks | 说明 |
|-------|--------------|------|
| constructor | useState | 初始化state |
| componentDidMount | useEffect(fn, []) | 挂载后执行 |
| componentDidUpdate | useEffect(fn, [deps]) | 更新后执行 |
| componentWillUnmount | useEffect返回函数 | 卸载前执行 |
| shouldComponentUpdate | React.memo | 性能优化 |

## 3. React Hooks
**问题：** React Hooks的使用和原理

### 解答

#### 常用Hooks

**1. useState**
```javascript
const [state, setState] = useState(initialState);

// 函数式更新
setState(prevState => prevState + 1);

// 惰性初始化
const [state, setState] = useState(() => {
  return expensiveComputation();
});
```

**2. useEffect**
```javascript
useEffect(() => {
  // 副作用操作
  const subscription = subscribe();

  // 清理函数
  return () => {
    subscription.unsubscribe();
  };
}, [dependency]);
```

**3. useContext**
```javascript
const ThemeContext = React.createContext('light');

function Component() {
  const theme = useContext(ThemeContext);
  return <div className={theme}>Content</div>;
}
```

**4. useReducer**
```javascript
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

// 使用
dispatch({ type: 'increment' });
```

**5. useCallback**
```javascript
// 缓存函数，避免子组件不必要的渲染
const memoizedCallback = useCallback(
  () => {
    doSomething(a, b);
  },
  [a, b]
);
```

**6. useMemo**
```javascript
// 缓存计算结果
const memoizedValue = useMemo(
  () => computeExpensiveValue(a, b),
  [a, b]
);
```

**7. useRef**
```javascript
// 获取DOM引用
const inputRef = useRef(null);
<input ref={inputRef} />
inputRef.current.focus();

// 保存可变值（不触发重新渲染）
const countRef = useRef(0);
countRef.current += 1;
```

**8. useLayoutEffect**
```javascript
// 同步执行，阻塞浏览器绘制
useLayoutEffect(() => {
  // 读取DOM布局、同步更新
}, []);
```

**9. useImperativeHandle**
```javascript
// 自定义暴露给父组件的实例值
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef();
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current.focus();
    }
  }));
  return <input ref={inputRef} />;
});
```

#### 自定义Hooks

```javascript
// useLocalStorage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// 使用
const [name, setName] = useLocalStorage('name', 'Bob');
```

```javascript
// useFetch
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [url]);

  return { data, loading, error };
}

// 使用
const { data, loading, error } = useFetch('/api/users');
```

#### Hooks规则

1. **只在顶层调用Hooks**
```javascript
// ❌ 错误
if (condition) {
  const [state, setState] = useState(0);
}

// ✅ 正确
const [state, setState] = useState(0);
if (condition) {
  setState(1);
}
```

2. **只在React函数中调用Hooks**
```javascript
// ✅ 函数组件
function Component() {
  const [state, setState] = useState(0);
}

// ✅ 自定义Hooks
function useCustomHook() {
  const [state, setState] = useState(0);
}

// ❌ 普通函数
function helper() {
  const [state, setState] = useState(0); // 错误
}
```

## 4. React性能优化
**问题：** React性能优化方法

### 解答

#### 1. React.memo
```javascript
// 类似PureComponent，浅比较props
const MyComponent = React.memo(function MyComponent(props) {
  return <div>{props.value}</div>;
});

// 自定义比较函数
const MyComponent = React.memo(
  Component,
  (prevProps, nextProps) => {
    return prevProps.value === nextProps.value;
  }
);
```

#### 2. useMemo
```javascript
// 缓存计算结果
const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b);
}, [a, b]);
```

#### 3. useCallback
```javascript
// 缓存函数引用
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

#### 4. 虚拟列表
```javascript
import { FixedSizeList } from 'react-window';

function VirtualList({ items }) {
  return (
    <FixedSizeList
      height={500}
      itemCount={items.length}
      itemSize={35}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>{items[index]}</div>
      )}
    </FixedSizeList>
  );
}
```

#### 5. 懒加载
```javascript
// React.lazy + Suspense
const LazyComponent = React.lazy(() => import('./LazyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyComponent />
    </Suspense>
  );
}
```

#### 6. Code Splitting
```javascript
// 路由懒加载
const Home = React.lazy(() => import('./routes/Home'));
const About = React.lazy(() => import('./routes/About'));

function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

#### 7. shouldComponentUpdate
```javascript
class MyComponent extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.value !== this.props.value;
  }
}

// 或使用PureComponent
class MyComponent extends React.PureComponent {
  // 自动浅比较props和state
}
```

#### 8. 避免内联对象和函数
```javascript
// ❌ 每次渲染都创建新对象
<Component style={{ color: 'red' }} onClick={() => handleClick()} />

// ✅ 提取到外部
const style = { color: 'red' };
const handleClick = useCallback(() => {
  // ...
}, []);
<Component style={style} onClick={handleClick} />
```

#### 9. 使用key
```javascript
// ✅ 使用稳定的key
{items.map(item => (
  <Item key={item.id} {...item} />
))}

// ❌ 使用index作为key（可能导致性能问题）
{items.map((item, index) => (
  <Item key={index} {...item} />
))}
```

#### 10. Profiler API
```javascript
<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  console.log(`${id} took ${actualDuration}ms`);
}
```

## 5. React Context
**问题：** React Context是什么？

### 解答

#### Context基本用法

```javascript
// 1. 创建Context
const ThemeContext = React.createContext('light');

// 2. Provider提供值
function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 3. Consumer消费值（类组件）
class ThemedButton extends React.Component {
  static contextType = ThemeContext;

  render() {
    return <Button theme={this.context.theme} />;
  }
}

// 或使用Consumer
function ThemedButton() {
  return (
    <ThemeContext.Consumer>
      {({ theme, setTheme }) => (
        <Button theme={theme} onClick={() => setTheme('dark')} />
      )}
    </ThemeContext.Consumer>
  );
}

// 4. useContext（函数组件）
function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return <Button theme={theme} onClick={() => setTheme('dark')} />;
}
```

#### 多个Context
```javascript
const ThemeContext = React.createContext('light');
const UserContext = React.createContext(null);

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <UserContext.Provider value={{ name: 'John' }}>
        <Content />
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

function Content() {
  const theme = useContext(ThemeContext);
  const user = useContext(UserContext);
  return <div>Theme: {theme}, User: {user.name}</div>;
}
```

#### Context注意事项

**1. 避免不必要的渲染**
```javascript
// ❌ 每次渲染都创建新对象，导致所有Consumer重新渲染
function App() {
  const [count, setCount] = useState(0);
  return (
    <Context.Provider value={{ count, setCount }}>
      <Child />
    </Context.Provider>
  );
}

// ✅ 使用useMemo缓存value
function App() {
  const [count, setCount] = useState(0);
  const value = useMemo(() => ({ count, setCount }), [count]);
  return (
    <Context.Provider value={value}>
      <Child />
    </Context.Provider>
  );
}
```

**2. 拆分Context**
```javascript
// 将频繁变化的数据和不常变化的数据分开
const ThemeContext = React.createContext();
const UserContext = React.createContext();

// 而不是
const AppContext = React.createContext({ theme, user });
```

#### 使用场景
- 主题切换
- 国际化
- 用户认证信息
- 全局配置
- 避免props层层传递

## 6. 类组件vs函数组件
**问题：** 类组件和函数组件之间有什么区别？

### 深度解析

#### 1. 基本语法差异

**类组件**
```javascript
class Welcome extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState({ count: this.state.count + 1 });
  }

  render() {
    return (
      <div>
        <h1>Count: {this.state.count}</h1>
        <button onClick={this.handleClick}>Increment</button>
      </div>
    );
  }
}
```

**函数组件**
```javascript
function Welcome() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
}
```

#### 2. 核心区别

**思维模型的差异**
```javascript
// 类组件：面向对象思维
class ProfileClass extends React.Component {
  showMessage = () => {
    // this.props是可变的，指向最新的props
    alert('Followed ' + this.props.user);
  };

  handleClick = () => {
    setTimeout(this.showMessage, 3000);
  };

  render() {
    return <button onClick={this.handleClick}>Follow</button>;
  }
}

// 函数组件：闭包思维
function ProfileFunction({ user }) {
  const showMessage = () => {
    // user被闭包捕获，始终是点击时的值
    alert('Followed ' + user);
  };

  const handleClick = () => {
    setTimeout(showMessage, 3000);
  };

  return <button onClick={handleClick}>Follow</button>;
}

// 实际场景：
// 1. 用户在profile页面点击Follow按钮
// 2. 3秒内切换到另一个用户的profile
// 3. 弹出alert

// 类组件：显示新用户的名字（this.props已变）
// 函数组件：显示旧用户的名字（闭包捕获）
```

#### 3. 性能对比

**内存占用**
```javascript
// 类组件：每个实例都有完整的组件实例
class HeavyClass extends React.Component {
  render() {
    return <div>{this.props.data}</div>;
  }
}
// 内存占用：~300 bytes/instance

// 函数组件：只有函数和Hooks链表
function HeavyFunction({ data }) {
  return <div>{data}</div>;
}
// 内存占用：~100 bytes/instance

// 渲染1000个组件的差异：
// 类组件：~300KB
// 函数组件：~100KB（节省66%）
```

**渲染性能**
```javascript
// 类组件：需要实例化、this绑定
class ClassComponent extends React.Component {
  // 1. new ClassComponent(props)
  // 2. 绑定this
  // 3. 调用render方法
  render() {
    return <div>Hello</div>;
  }
}

// 函数组件：直接调用
function FunctionComponent(props) {
  // 1. 直接调用函数
  return <div>Hello</div>;
}

// 性能测试（渲染10000次）：
// 类组件：~120ms
// 函数组件：~80ms（快33%）
```

#### 4. 生命周期对比

**类组件生命周期**
```javascript
class LifecycleClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null };
  }

  componentDidMount() {
    // 挂载后：数据获取、订阅
    this.fetchData();
    this.subscription = subscribe();
  }

  componentDidUpdate(prevProps, prevState) {
    // 更新后：条件判断
    if (prevProps.id !== this.props.id) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    // 卸载前：清理
    this.subscription.unsubscribe();
  }

  fetchData() {
    fetch(`/api/data/${this.props.id}`)
      .then(res => res.json())
      .then(data => this.setState({ data }));
  }

  render() {
    return <div>{this.state.data}</div>;
  }
}
```

**函数组件Hooks**
```javascript
function LifecycleFunction({ id }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 挂载 + 更新：数据获取
    fetch(`/api/data/${id}`)
      .then(res => res.json())
      .then(setData);

    // 订阅
    const subscription = subscribe();

    // 清理函数
    return () => {
      subscription.unsubscribe();
    };
  }, [id]); // id变化时重新执行

  return <div>{data}</div>;
}

// Hooks的优势：
// 1. 逻辑复用更容易（自定义Hooks）
// 2. 相关逻辑聚合在一起（不分散在多个生命周期）
// 3. 避免this绑定问题
```

#### 5. 实际应用场景对比

**场景1：表单处理**

```javascript
// 类组件：需要手动绑定this
class FormClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      email: '',
      password: ''
    };
  }

  handleNameChange = (e) => {
    this.setState({ name: e.target.value });
  }

  handleEmailChange = (e) => {
    this.setState({ email: e.target.value });
  }

  handleSubmit = (e) => {
    e.preventDefault();
    // 提交逻辑
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <input value={this.state.name} onChange={this.handleNameChange} />
        <input value={this.state.email} onChange={this.handleEmailChange} />
        <button type="submit">Submit</button>
      </form>
    );
  }
}

// 函数组件：更简洁
function FormFunction() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 提交逻辑
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={formData.name} onChange={handleChange} />
      <input name="email" value={formData.email} onChange={handleChange} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

**场景2：逻辑复用**

```javascript
// 类组件：使用HOC或Render Props
class MouseTrackerClass extends React.Component {
  state = { x: 0, y: 0 };

  handleMouseMove = (e) => {
    this.setState({ x: e.clientX, y: e.clientY });
  }

  componentDidMount() {
    window.addEventListener('mousemove', this.handleMouseMove);
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.handleMouseMove);
  }

  render() {
    return <div>Mouse: {this.state.x}, {this.state.y}</div>;
  }
}

// 函数组件：使用自定义Hook
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
}

function MouseTrackerFunction() {
  const { x, y } = useMousePosition();
  return <div>Mouse: {x}, {y}</div>;
}

// Hook可以在多个组件中复用
function AnotherComponent() {
  const { x, y } = useMousePosition();
  // 使用相同的逻辑
}
```

#### 6. 性能优化对比

**类组件优化**
```javascript
class OptimizedClass extends React.PureComponent {
  // PureComponent自动实现shouldComponentUpdate
  handleClick = () => {
    this.props.onClick();
  }

  render() {
    console.log('OptimizedClass render');
    return <button onClick={this.handleClick}>Click</button>;
  }
}

// 或手动实现
class ManualOptimized extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.value !== this.props.value;
  }

  render() {
    return <div>{this.props.value}</div>;
  }
}
```

**函数组件优化**
```javascript
// 使用React.memo
const OptimizedFunction = React.memo(function OptimizedFunction({ value, onClick }) {
  console.log('OptimizedFunction render');

  // 使用useCallback避免函数重新创建
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  return <button onClick={handleClick}>Click</button>;
});

// 自定义比较函数
const CustomMemo = React.memo(
  MyComponent,
  (prevProps, nextProps) => {
    return prevProps.value === nextProps.value;
  }
);
```

#### 7. 选择建议

**使用函数组件的场景（推荐）**
- 新项目默认选择
- 需要逻辑复用
- 简单的UI组件
- 需要Hooks特性（如useEffect组合副作用）

**使用类组件的场景**
- 老项目维护
- 需要Error Boundary（getDerivedStateFromError）
- 需要getSnapshotBeforeUpdate
- 团队更熟悉面向对象

#### 8. 迁移策略

```javascript
// 渐进式迁移：新组件用函数式，老组件保持不变
// 类组件和函数组件可以混用

function App() {
  return (
    <div>
      <FunctionComponent />  {/* 新组件 */}
      <ClassComponent />     {/* 老组件 */}
    </div>
  );
}

// React官方推荐：
// 1. 不需要重写已有的类组件
// 2. 新功能优先使用函数组件 + Hooks
// 3. 逐步迁移，而非一次性重写
```

## 7. React Refs详解
**问题：** React中的refs作用是什么？什么是forward refs?

### 深度解析

#### 1. Refs的基本使用

**获取DOM元素**
```javascript
function TextInputWithFocusButton() {
  const inputRef = useRef(null);

  const handleClick = () => {
    // 访问DOM节点
    inputRef.current.focus();
    inputRef.current.select();
    console.log(inputRef.current.value);
  };

  return (
    <>
      <input ref={inputRef} type="text" />
      <button onClick={handleClick}>Focus Input</button>
    </>
  );
}
```

**保存可变值（不触发重渲染）**
```javascript
function Timer() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // 保存interval ID，组件重渲染时不丢失
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const handleStop = () => {
    clearInterval(intervalRef.current);
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleStop}>Stop</button>
    </div>
  );
}
```

#### 2. useRef vs useState的区别

```javascript
function ComparisonExample() {
  const [stateValue, setStateValue] = useState(0);
  const refValue = useRef(0);

  const handleStateClick = () => {
    setStateValue(stateValue + 1);
    // 触发重新渲染，页面更新
    console.log('State:', stateValue); // 旧值（异步更新）
  };

  const handleRefClick = () => {
    refValue.current += 1;
    // 不触发重新渲染，页面不变
    console.log('Ref:', refValue.current); // 新值（同步更新）
  };

  return (
    <div>
      <p>State: {stateValue}</p>
      <p>Ref: {refValue.current}</p>
      <button onClick={handleStateClick}>Update State</button>
      <button onClick={handleRefClick}>Update Ref</button>
    </div>
  );
}

// 使用场景对比：
// useState: 需要触发UI更新的数据
// useRef: 不需要触发UI更新的数据（定时器ID、DOM引用、上一次的值）
```

#### 3. 类组件中的Refs

**createRef API**
```javascript
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
  }

  componentDidMount() {
    this.inputRef.current.focus();
  }

  render() {
    return <input ref={this.inputRef} />;
  }
}
```

**回调Refs**
```javascript
class CustomTextInput extends React.Component {
  constructor(props) {
    super(props);
    this.textInput = null;
  }

  focusTextInput = () => {
    if (this.textInput) {
      this.textInput.focus();
    }
  };

  render() {
    return (
      <>
        <input
          type="text"
          ref={element => {
            this.textInput = element;
            // 在这里可以执行额外的逻辑
          }}
        />
        <button onClick={this.focusTextInput}>Focus</button>
      </>
    );
  }
}
```

#### 4. Forward Refs详解

**问题场景**
```javascript
// 问题：函数组件不能直接接收ref
function MyButton(props) {
  return <button>{props.children}</button>;
}

function Parent() {
  const buttonRef = useRef(null);
  // ❌ 无法访问button的DOM节点
  return <MyButton ref={buttonRef}>Click</MyButton>;
}
```

**解决方案：forwardRef**
```javascript
const MyButton = React.forwardRef((props, ref) => {
  return (
    <button ref={ref} className="custom-button">
      {props.children}
    </button>
  );
});

function Parent() {
  const buttonRef = useRef(null);

  useEffect(() => {
    // ✅ 可以访问button的DOM节点
    buttonRef.current.focus();
  }, []);

  return <MyButton ref={buttonRef}>Click</MyButton>;
}
```

#### 5. useImperativeHandle高级用法

**自定义暴露的实例值**
```javascript
const FancyInput = React.forwardRef((props, ref) => {
  const inputRef = useRef();
  const [value, setValue] = useState('');

  // 自定义ref暴露的方法
  useImperativeHandle(ref, () => ({
    // 只暴露focus和clear方法，隐藏DOM细节
    focus: () => {
      inputRef.current.focus();
    },
    clear: () => {
      setValue('');
      inputRef.current.value = '';
    },
    getValue: () => {
      return value;
    }
  }));

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  );
});

function Parent() {
  const fancyInputRef = useRef();

  const handleClick = () => {
    fancyInputRef.current.focus();
    console.log(fancyInputRef.current.getValue());
    fancyInputRef.current.clear();

    // ❌ 不能直接访问DOM
    // fancyInputRef.current.select(); // 不存在
  };

  return (
    <>
      <FancyInput ref={fancyInputRef} />
      <button onClick={handleClick}>操作输入框</button>
    </>
  );
}
```

#### 6. 实战场景

**场景1：视频播放器控制**
```javascript
const VideoPlayer = React.forwardRef((props, ref) => {
  const videoRef = useRef();

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current.play(),
    pause: () => videoRef.current.pause(),
    seek: (time) => {
      videoRef.current.currentTime = time;
    },
    getProgress: () => {
      return videoRef.current.currentTime / videoRef.current.duration;
    }
  }));

  return (
    <video ref={videoRef} src={props.src} controls={false} />
  );
});

function App() {
  const playerRef = useRef();

  return (
    <div>
      <VideoPlayer ref={playerRef} src="/video.mp4" />
      <button onClick={() => playerRef.current.play()}>播放</button>
      <button onClick={() => playerRef.current.pause()}>暂停</button>
      <button onClick={() => playerRef.current.seek(30)}>跳转到30秒</button>
    </div>
  );
}
```

**场景2：表单验证**
```javascript
const FormInput = React.forwardRef(({ label, validation }, ref) => {
  const inputRef = useRef();
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    validate: () => {
      const value = inputRef.current.value;
      const isValid = validation(value);

      if (!isValid) {
        setError('Invalid input');
        return false;
      }

      setError('');
      return true;
    },
    getValue: () => inputRef.current.value,
    reset: () => {
      inputRef.current.value = '';
      setError('');
    }
  }));

  return (
    <div>
      <label>{label}</label>
      <input ref={inputRef} />
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
});

function Form() {
  const emailRef = useRef();
  const passwordRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();

    // 验证所有输入
    const emailValid = emailRef.current.validate();
    const passwordValid = passwordRef.current.validate();

    if (emailValid && passwordValid) {
      const formData = {
        email: emailRef.current.getValue(),
        password: passwordRef.current.getValue()
      };
      console.log('提交:', formData);
    }
  };

  const handleReset = () => {
    emailRef.current.reset();
    passwordRef.current.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormInput
        ref={emailRef}
        label="Email"
        validation={value => /\S+@\S+\.\S+/.test(value)}
      />
      <FormInput
        ref={passwordRef}
        label="Password"
        validation={value => value.length >= 8}
      />
      <button type="submit">提交</button>
      <button type="button" onClick={handleReset}>重置</button>
    </form>
  );
}
```

**场景3：滚动到元素**
```javascript
function ScrollToComponent() {
  const section1Ref = useRef();
  const section2Ref = useRef();
  const section3Ref = useRef();

  const scrollToSection = (ref) => {
    ref.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <div>
      <nav>
        <button onClick={() => scrollToSection(section1Ref)}>Section 1</button>
        <button onClick={() => scrollToSection(section2Ref)}>Section 2</button>
        <button onClick={() => scrollToSection(section3Ref)}>Section 3</button>
      </nav>

      <div ref={section1Ref} style={{ height: '100vh' }}>
        <h2>Section 1</h2>
      </div>
      <div ref={section2Ref} style={{ height: '100vh' }}>
        <h2>Section 2</h2>
      </div>
      <div ref={section3Ref} style={{ height: '100vh' }}>
        <h2>Section 3</h2>
      </div>
    </div>
  );
}
```

#### 7. Refs的注意事项

**1. 避免过度使用**
```javascript
// ❌ 不必要的ref
function BadExample() {
  const inputRef = useRef();

  const handleSubmit = () => {
    const value = inputRef.current.value; // 不推荐
    submitForm(value);
  };

  return <input ref={inputRef} />;
}

// ✅ 使用受控组件
function GoodExample() {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    submitForm(value); // 推荐
  };

  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

**2. Refs和重新渲染**
```javascript
function Example() {
  const countRef = useRef(0);

  const increment = () => {
    countRef.current += 1;
    console.log(countRef.current); // 值已更新
    // 但组件不会重新渲染，UI不会更新
  };

  return (
    <div>
      <p>Count: {countRef.current}</p> {/* 不会更新 */}
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

**3. Ref的时机**
```javascript
function TimingExample() {
  const divRef = useRef();

  // ❌ render期间访问ref
  console.log(divRef.current); // 可能为null

  useEffect(() => {
    // ✅ effect中访问ref
    console.log(divRef.current); // 确保存在
  }, []);

  return <div ref={divRef}>Content</div>;
}
```

## 8. 高阶组件(HOC)
**问题：** 什么是高阶组件（HOC）？

### 深度解析

#### 1. HOC的定义和原理

**基本概念**
```javascript
// 高阶组件：接收组件，返回新组件的函数
function withEnhancement(WrappedComponent) {
  return function EnhancedComponent(props) {
    // 增强逻辑
    return <WrappedComponent {...props} />;
  };
}

// 使用
const EnhancedComponent = withEnhancement(BaseComponent);
```

**完整示例**
```javascript
function withLoading(WrappedComponent) {
  return function WithLoadingComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <div>Loading...</div>;
    }
    return <WrappedComponent {...props} />;
  };
}

// 原始组件
function UserList({ users }) {
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 增强组件
const UserListWithLoading = withLoading(UserList);

// 使用
function App() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then(data => {
      setUsers(data);
      setIsLoading(false);
    });
  }, []);

  return <UserListWithLoading isLoading={isLoading} users={users} />;
}
```

#### 2. 常见HOC模式

**模式1：属性代理**
```javascript
// 操作props
function withExtraProps(WrappedComponent) {
  return function(props) {
    const extraProps = {
      timestamp: Date.now(),
      userId: getCurrentUserId()
    };

    // 合并props
    return <WrappedComponent {...props} {...extraProps} />;
  };
}
```

**模式2：反向继承**
```javascript
// 继承被包装组件
function withAuth(WrappedComponent) {
  return class extends WrappedComponent {
    componentDidMount() {
      // 调用原组件的生命周期
      if (super.componentDidMount) {
        super.componentDidMount();
      }

      // 添加额外逻辑
      if (!this.props.isAuthenticated) {
        this.props.history.push('/login');
      }
    }

    render() {
      if (!this.props.isAuthenticated) {
        return <div>Please login</div>;
      }
      return super.render();
    }
  };
}
```

#### 3. 实战HOC示例

**权限控制HOC**
```javascript
function withPermission(WrappedComponent, requiredPermissions) {
  return function WithPermissionComponent(props) {
    const userPermissions = useUserPermissions();

    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return (
        <div style={{ color: 'red' }}>
          You don't have permission to view this content
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

// 使用
const AdminPanel = ({ data }) => <div>Admin Panel: {data}</div>;
const ProtectedAdminPanel = withPermission(AdminPanel, ['admin', 'write']);

function App() {
  return <ProtectedAdminPanel data="sensitive data" />;
}
```

**数据获取HOC**
```javascript
function withData(WrappedComponent, fetchData) {
  return function WithDataComponent(props) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      setLoading(true);
      fetchData(props)
        .then(data => {
          setData(data);
          setError(null);
        })
        .catch(err => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }, [props.id]); // 依赖props变化

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return <WrappedComponent {...props} data={data} />;
  };
}

// 使用
function UserProfile({ data }) {
  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}

const UserProfileWithData = withData(
  UserProfile,
  (props) => fetch(`/api/users/${props.id}`).then(res => res.json())
);

function App() {
  return <UserProfileWithData id="123" />;
}
```

**埋点统计HOC**
```javascript
function withTracking(WrappedComponent, eventName) {
  return function WithTrackingComponent(props) {
    useEffect(() => {
      // 组件挂载时发送埋点
      analytics.track(`${eventName}_view`, {
        timestamp: Date.now(),
        props: props
      });
    }, []);

    const handleClick = (e) => {
      // 点击事件埋点
      analytics.track(`${eventName}_click`, {
        timestamp: Date.now(),
        target: e.target
      });

      if (props.onClick) {
        props.onClick(e);
      }
    };

    return (
      <div onClick={handleClick}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}

// 使用
const ProductCard = ({ product }) => (
  <div>
    <h3>{product.name}</h3>
    <p>${product.price}</p>
  </div>
);

const TrackedProductCard = withTracking(ProductCard, 'product_card');
```

#### 4. 组合多个HOC

```javascript
// 多个HOC组合
const enhance = compose(
  withRouter,
  withAuth,
  withLoading,
  withData(fetchUserData)
);

const EnhancedComponent = enhance(BaseComponent);

// compose函数实现
function compose(...funcs) {
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

// 等价于：
const EnhancedComponent = withRouter(
  withAuth(
    withLoading(
      withData(fetchUserData)(BaseComponent)
    )
  )
);
```

#### 5. HOC的注意事项

**1. 不要在render中使用HOC**
```javascript
// ❌ 错误：每次渲染都创建新组件
function Parent() {
  const EnhancedComponent = withLoading(MyComponent); // 错误
  return <EnhancedComponent />;
}

// ✅ 正确：在组件外部使用HOC
const EnhancedComponent = withLoading(MyComponent);
function Parent() {
  return <EnhancedComponent />;
}
```

**2. 务必复制静态方法**
```javascript
function withHOC(WrappedComponent) {
  class Enhance extends React.Component {
    render() {
      return <WrappedComponent {...this.props} />;
    }
  }

  // 复制静态方法
  Enhance.staticMethod = WrappedComponent.staticMethod;

  // 或使用hoist-non-react-statics库
  // hoistNonReactStatic(Enhance, WrappedComponent);

  return Enhance;
}
```

**3. Refs不会被传递**
```javascript
// ❌ ref会指向HOC，而非原组件
function withHOC(WrappedComponent) {
  return function(props) {
    return <WrappedComponent {...props} />;
  };
}

const Enhanced = withHOC(MyComponent);
<Enhanced ref={myRef} /> // myRef指向withHOC返回的组件

// ✅ 使用React.forwardRef
function withHOC(WrappedComponent) {
  function WithHOC(props, ref) {
    return <WrappedComponent {...props} ref={ref} />;
  }
  return React.forwardRef(WithHOC);
}
```

#### 6. HOC vs Hooks

**相同功能对比**
```javascript
// HOC实现
function withWindowSize(WrappedComponent) {
  return function(props) {
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

    return <WrappedComponent {...props} windowSize={size} />;
  };
}

const MyComponentWithSize = withWindowSize(MyComponent);

// Hook实现（更简洁）
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

function MyComponent() {
  const windowSize = useWindowSize();
  // 直接使用
}

// Hooks优势：
// 1. 更简洁，无需嵌套
// 2. 更灵活，可以在组件内部调用多次
// 3. 更容易理解，没有"包装地狱"
// 4. 更好的类型推导（TypeScript）
```

#### 7. 何时使用HOC

**适合使用HOC的场景**
- 需要操作组件实例（生命周期、state）
- 需要包装组件的render输出
- 需要给多个组件添加相同的UI（如loading、error boundary）

**适合使用Hooks的场景（推荐）**
- 逻辑复用
- 数据获取
- 订阅事件
- 副作用管理

## 9. 受控组件vs非受控组件
**问题：** 什么是受控组件？

### 深度解析

#### 1. 受控组件

**定义和原理**
```javascript
// 受控组件：表单数据由React组件state管理
function ControlledInput() {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    // React控制输入值
    setValue(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('提交:', value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}                    // 值由state控制
        onChange={handleChange}          // 更新state
      />
      <button type="submit">提交</button>
    </form>
  );
}

// 特点：
// 1. value由state控制
// 2. 每次输入都会触发onChange
// 3. 单一数据源（state）
// 4. 可以实时验证、格式化
```

#### 2. 非受控组件

**定义和原理**
```javascript
// 非受控组件：表单数据由DOM自己管理
function UncontrolledInput() {
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    // 从DOM获取值
    console.log('提交:', inputRef.current.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        defaultValue="默认值"            // 使用defaultValue而非value
        ref={inputRef}                  // 通过ref访问DOM
      />
      <button type="submit">提交</button>
    </form>
  );
}

// 特点：
// 1. 值存储在DOM中
// 2. 使用ref获取值
// 3. 使用defaultValue设置默认值
// 4. 更接近传统HTML表单
```

#### 3. 完整对比

**受控组件完整示例**
```javascript
function ControlledForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    gender: 'male',
    interests: [],
    bio: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      // 处理checkbox
      const newInterests = checked
        ? [...formData.interests, value]
        : formData.interests.filter(i => i !== value);

      setFormData({
        ...formData,
        interests: newInterests
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }

    // 实时验证
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let error = '';

    if (name === 'email' && !value.match(/\S+@\S+\.\S+/)) {
      error = 'Invalid email';
    }

    if (name === 'password' && value.length < 8) {
      error = 'Password must be at least 8 characters';
    }

    setErrors({
      ...errors,
      [name]: error
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('提交:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
        />
      </div>

      <div>
        <input
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
        />
        {errors.email && <span style={{ color: 'red' }}>{errors.email}</span>}
      </div>

      <div>
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
        />
        {errors.password && <span style={{ color: 'red' }}>{errors.password}</span>}
      </div>

      <div>
        <label>
          <input
            type="radio"
            name="gender"
            value="male"
            checked={formData.gender === 'male'}
            onChange={handleChange}
          />
          Male
        </label>
        <label>
          <input
            type="radio"
            name="gender"
            value="female"
            checked={formData.gender === 'female'}
            onChange={handleChange}
          />
          Female
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            name="interests"
            value="sports"
            checked={formData.interests.includes('sports')}
            onChange={handleChange}
          />
          Sports
        </label>
        <label>
          <input
            type="checkbox"
            name="interests"
            value="music"
            checked={formData.interests.includes('music')}
            onChange={handleChange}
          />
          Music
        </label>
      </div>

      <div>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder="Bio"
        />
      </div>

      <button type="submit">Submit</button>
    </form>
  );
}
```

**非受控组件完整示例**
```javascript
function UncontrolledForm() {
  const formRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    // 从DOM获取所有值
    const formData = new FormData(formRef.current);
    const data = {
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
      gender: formData.get('gender'),
      interests: formData.getAll('interests')
    };

    console.log('提交:', data);
  };

  const handleReset = () => {
    formRef.current.reset();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div>
        <input
          ref={usernameRef}
          name="username"
          defaultValue=""
          placeholder="Username"
        />
      </div>

      <div>
        <input
          ref={emailRef}
          name="email"
          defaultValue=""
          placeholder="Email"
        />
      </div>

      <div>
        <input
          ref={passwordRef}
          name="password"
          type="password"
          defaultValue=""
          placeholder="Password"
        />
      </div>

      <div>
        <label>
          <input
            type="radio"
            name="gender"
            value="male"
            defaultChecked
          />
          Male
        </label>
        <label>
          <input
            type="radio"
            name="gender"
            value="female"
          />
          Female
        </label>
      </div>

      <div>
        <label>
          <input type="checkbox" name="interests" value="sports" />
          Sports
        </label>
        <label>
          <input type="checkbox" name="interests" value="music" />
          Music
        </label>
      </div>

      <button type="submit">Submit</button>
      <button type="button" onClick={handleReset}>Reset</button>
    </form>
  );
}
```

#### 4. 性能对比

**受控组件性能问题**
```javascript
// 问题：每次输入都触发重渲染
function ControlledPerformance() {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    setValue(e.target.value);
    // 每次输入都会：
    // 1. 调用setState
    // 2. 触发重渲染
    // 3. diff算法
    // 4. 更新DOM
    console.log('渲染');
  };

  return <input value={value} onChange={handleChange} />;
}

// 优化方案1：防抖
function ControlledWithDebounce() {
  const [value, setValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);

    return () => clearTimeout(handler);
  }, [value]);

  return (
    <div>
      <input value={value} onChange={e => setValue(e.target.value)} />
      <p>实时值: {value}</p>
      <p>防抖值: {debouncedValue}</p>
    </div>
  );
}

// 优化方案2：混合模式
function HybridApproach() {
  const inputRef = useRef();
  const [submittedValue, setSubmittedValue] = useState('');

  const handleSubmit = () => {
    // 只在提交时更新state
    setSubmittedValue(inputRef.current.value);
  };

  return (
    <div>
      {/* 输入时不更新state */}
      <input ref={inputRef} defaultValue="" />
      <button onClick={handleSubmit}>提交</button>
      <p>提交的值: {submittedValue}</p>
    </div>
  );
}
```

#### 5. 使用场景选择

**受控组件适用场景**
```javascript
// 1. 需要实时验证
function RealTimeValidation() {
  const [password, setPassword] = useState('');

  const strength = calculatePasswordStrength(password);

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <div>密码强度: {strength}</div>
    </div>
  );
}

// 2. 需要格式化输入
function FormattedInput() {
  const [phone, setPhone] = useState('');

  const handleChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');

    // 格式化为 (123) 456-7890
    if (value.length > 6) {
      value = `(${value.slice(0,3)}) ${value.slice(3,6)}-${value.slice(6,10)}`;
    } else if (value.length > 3) {
      value = `(${value.slice(0,3)}) ${value.slice(3)}`;
    }

    setPhone(value);
  };

  return <input value={phone} onChange={handleChange} />;
}

// 3. 需要条件禁用提交按钮
function FormWithValidation() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isValid = email.includes('@') && password.length >= 8;

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button disabled={!isValid}>Submit</button>
    </form>
  );
}

// 4. 需要动态更新
function DynamicForm() {
  const [fields, setFields] = useState(['']);

  const addField = () => {
    setFields([...fields, '']);
  };

  const updateField = (index, value) => {
    const newFields = [...fields];
    newFields[index] = value;
    setFields(newFields);
  };

  return (
    <div>
      {fields.map((field, index) => (
        <input
          key={index}
          value={field}
          onChange={e => updateField(index, e.target.value)}
        />
      ))}
      <button onClick={addField}>Add Field</button>
    </div>
  );
}
```

**非受控组件适用场景**
```javascript
// 1. 文件上传
function FileUpload() {
  const fileInputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    const file = fileInputRef.current.files[0];
    console.log('上传文件:', file);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        ref={fileInputRef}
      />
      <button type="submit">Upload</button>
    </form>
  );
}

// 2. 集成第三方库
function ThirdPartyEditor() {
  const editorRef = useRef();

  useEffect(() => {
    // 初始化第三方编辑器
    const editor = new SomeEditor(editorRef.current);

    return () => {
      editor.destroy();
    };
  }, []);

  const getValue = () => {
    // 从第三方库获取值
    return editorRef.current.getContent();
  };

  return (
    <div>
      <div ref={editorRef} />
      <button onClick={() => console.log(getValue())}>
        Get Value
      </button>
    </div>
  );
}

// 3. 性能优化场景
function LargeForm() {
  const formRef = useRef();

  // 不需要实时验证，减少重渲染
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    // 提交时一次性验证
    validateAndSubmit(formData);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input name="field1" defaultValue="" />
      <input name="field2" defaultValue="" />
      {/* 100个输入框... */}
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### 6. 最佳实践

```javascript
// 推荐：根据场景选择
function BestPractice() {
  // 受控：需要实时反馈的字段
  const [email, setEmail] = useState('');

  // 非受控：不需要实时反馈的字段
  const nameRef = useRef();
  const bioRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      email: email,                    // 从state获取
      name: nameRef.current.value,     // 从DOM获取
      bio: bioRef.current.value        // 从DOM获取
    };

    submitForm(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 受控：需要验证 */}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email (实时验证)"
      />
      {!email.includes('@') && <span>Invalid email</span>}

      {/* 非受控：只在提交时需要 */}
      <input
        ref={nameRef}
        defaultValue=""
        placeholder="Name"
      />

      <textarea
        ref={bioRef}
        defaultValue=""
        placeholder="Bio"
      />

      <button type="submit">Submit</button>
    </form>
  );
}
```

## 10. Pure Components详解
**问题：** 什么是Pure Components?

### 深度解析

Pure Components通过浅比较props和state来决定是否重新渲染，避免不必要的渲染，提升性能。类组件使用`React.PureComponent`，函数组件使用`React.memo`。核心原理是在更新前比较新旧props/state，如果相等则跳过渲染。

**使用场景**：列表项组件、复杂UI组件、高频更新的兄弟组件。注意避免对象/数组/函数props陷阱，需配合`useMemo`/`useCallback`使用。

## 11. Hooks状态管理实战
**问题：** 如何使用Hooks实现状态管理？

### 实战方案

**1. Context + useReducer全局状态**：适合中小型应用，创建Store Provider包裹应用，通过自定义Hooks访问状态。

**2. 自定义Hooks封装**：`useLocalStorage`持久化状态、`useAsync`异步数据、`useForm`表单管理等。

**3. 状态分层原则**：
- 本地状态用useState
- 跨组件共享用Context
- 全局状态用Context + useReducer

## 12. Immutable数据原理
**问题：** immutable的原理是什么？

### 深度解析

#### 核心原理

**结构共享（Structural Sharing）**
```javascript
// 普通对象：修改会影响原对象
const obj1 = { a: 1, b: { c: 2 } };
const obj2 = obj1;
obj2.a = 2; // obj1也被修改

// Immutable：返回新对象，原对象不变
import { Map } from 'immutable';
const map1 = Map({ a: 1, b: Map({ c: 2 }) });
const map2 = map1.set('a', 2); // map1不变，map2是新对象
// 但map1和map2共享b的内存，节省空间
```

**持久化数据结构（Persistent Data Structures）**
- 使用Trie树（字典树）存储数据
- 修改时只复制路径上的节点
- 未修改部分共享内存

#### React中的应用

```javascript
// 1. 优化shouldComponentUpdate
class UserList extends React.PureComponent {
  render() {
    // Immutable对象，浅比较即可检测变化
    return this.props.users.map(user => (
      <User key={user.get('id')} data={user} />
    ));
  }
}

// 2. Redux中使用
import { fromJS } from 'immutable';

const initialState = fromJS({
  users: [],
  loading: false
});

function reducer(state = initialState, action) {
  switch (action.type) {
    case 'ADD_USER':
      // 不可变更新
      return state.update('users', users => users.push(action.payload));

    case 'UPDATE_USER':
      return state.updateIn(
        ['users', action.index, 'name'],
        () => action.name
      );

    default:
      return state;
  }
}
```

#### 性能对比

```javascript
// 场景：1000次深拷贝 vs Immutable更新
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

// 方案1：深拷贝（慢）
let obj = { a: 1, b: { c: 2, d: { e: 3 } } };
console.time('deepCopy');
for (let i = 0; i < 1000; i++) {
  obj = deepCopy(obj);
  obj.b.d.e = i;
}
console.timeEnd('deepCopy'); // ~500ms

// 方案2：Immutable（快）
let map = fromJS({ a: 1, b: { c: 2, d: { e: 3 } } });
console.time('immutable');
for (let i = 0; i < 1000; i++) {
  map = map.setIn(['b', 'd', 'e'], i);
}
console.timeEnd('immutable'); // ~50ms

// 提升：10倍性能
```

#### 优缺点

**优点**：
- 避免副作用，数据可预测
- 优化React渲染（浅比较）
- 支持时间旅行（undo/redo）
- 线程安全

**缺点**：
- 学习成本高
- 增加包体积（~60KB）
- 与原生JS API不兼容
- 调试困难

## 13. React服务端渲染(SSR)
**问题：** React怎么做服务端渲染？

### 深度解析

#### SSR vs CSR

**CSR（客户端渲染）流程**
1. 浏览器请求HTML（空壳）
2. 下载JS bundle
3. 执行React代码
4. 请求API数据
5. 渲染页面

**SSR（服务端渲染）流程**
1. 服务器执行React代码
2. 请求API数据
3. 生成HTML字符串
4. 返回完整HTML
5. 浏览器接管（Hydration）

#### 实现方案

**1. 使用Next.js（推荐）**
```javascript
// pages/index.js
export async function getServerSideProps() {
  // 服务端执行
  const res = await fetch('https://api.example.com/data');
  const data = await res.json();

  return {
    props: { data }
  };
}

export default function Home({ data }) {
  return (
    <div>
      <h1>Server-Side Rendered</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

**2. 手动实现**
```javascript
// server.js
import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

const server = express();

server.get('*', async (req, res) => {
  // 1. 获取数据
  const data = await fetchData();

  // 2. 渲染React组件为HTML字符串
  const html = renderToString(<App data={data} />);

  // 3. 注入到HTML模板
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SSR App</title>
      </head>
      <body>
        <div id="root">${html}</div>
        <script>
          window.__INITIAL_DATA__ = ${JSON.stringify(data)};
        </script>
        <script src="/bundle.js"></script>
      </body>
    </html>
  `);
});

server.listen(3000);
```

```javascript
// client.js
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Hydration：附加事件监听器
const data = window.__INITIAL_DATA__;
hydrateRoot(
  document.getElementById('root'),
  <App data={data} />
);
```

#### SSR优化

**1. 数据预取**
```javascript
// 服务端预取所有数据，避免客户端多次请求
export async function getServerSideProps({ params }) {
  const [user, posts, comments] = await Promise.all([
    fetchUser(params.id),
    fetchPosts(params.id),
    fetchComments(params.id)
  ]);

  return {
    props: { user, posts, comments }
  };
}
```

**2. 流式渲染**
```javascript
import { renderToPipeableStream } from 'react-dom/server';

server.get('*', (req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    onShellReady() {
      res.setHeader('Content-Type', 'text/html');
      pipe(res); // 边渲染边发送
    }
  });
});
```

**3. 缓存策略**
```javascript
// 页面级缓存
export async function getServerSideProps({ res }) {
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=10, stale-while-revalidate=59'
  );

  const data = await fetchData();
  return { props: { data } };
}
```

#### 性能数据

```
首屏渲染时间对比（3G网络）：
┌─────────┬────────┬────────┬────────┐
│ 指标    │ CSR    │ SSR    │ 提升   │
├─────────┼────────┼────────┼────────┤
│ FCP     │ 3.2s   │ 1.1s   │ 66%    │
│ TTI     │ 5.8s   │ 3.2s   │ 45%    │
│ SEO     │ 差     │ 好     │ +++    │
└─────────┴────────┴────────┴────────┘
```

## 14. React组件通信
**问题：** React父子组件如何通信？

### 全面总结

#### 1. 父传子：Props

```javascript
function Parent() {
  const data = { name: 'John', age: 30 };

  return <Child user={data} onUpdate={handleUpdate} />;
}

function Child({ user, onUpdate }) {
  return (
    <div>
      <p>{user.name}</p>
      <button onClick={() => onUpdate('Jane')}>Update</button>
    </div>
  );
}
```

#### 2. 子传父：回调函数

```javascript
function Parent() {
  const [message, setMessage] = useState('');

  const handleChildData = (data) => {
    setMessage(data);
  };

  return (
    <div>
      <p>From child: {message}</p>
      <Child onSendData={handleChildData} />
    </div>
  );
}

function Child({ onSendData }) {
  return (
    <button onClick={() => onSendData('Hello from child')}>
      Send Data
    </button>
  );
}
```

#### 3. 兄弟组件：状态提升

```javascript
function Parent() {
  const [sharedData, setSharedData] = useState('');

  return (
    <>
      <Brother1 data={sharedData} onUpdate={setSharedData} />
      <Brother2 data={sharedData} onUpdate={setSharedData} />
    </>
  );
}
```

#### 4. 跨层级：Context

```javascript
const DataContext = createContext();

function Grandparent() {
  const [data, setData] = useState('shared data');

  return (
    <DataContext.Provider value={{ data, setData }}>
      <Parent />
    </DataContext.Provider>
  );
}

function Grandchild() {
  const { data, setData } = useContext(DataContext);
  return <div>{data}</div>;
}
```

#### 5. 全局通信：状态管理库

```javascript
// Redux
import { useSelector, useDispatch } from 'react-redux';

function ComponentA() {
  const dispatch = useDispatch();
  dispatch({ type: 'UPDATE_DATA', payload: 'new data' });
}

function ComponentB() {
  const data = useSelector(state => state.data);
  return <div>{data}</div>;
}

// Zustand（轻量）
import create from 'zustand';

const useStore = create((set) => ({
  data: '',
  updateData: (newData) => set({ data: newData })
}));

function ComponentA() {
  const updateData = useStore(state => state.updateData);
  updateData('new data');
}

function ComponentB() {
  const data = useStore(state => state.data);
  return <div>{data}</div>;
}
```

#### 6. 事件总线（不推荐）

```javascript
// EventEmitter模式
import EventEmitter from 'events';
const emitter = new EventEmitter();

function ComponentA() {
  useEffect(() => {
    emitter.emit('data-update', 'new data');
  }, []);
}

function ComponentB() {
  useEffect(() => {
    const handler = (data) => console.log(data);
    emitter.on('data-update', handler);
    return () => emitter.off('data-update', handler);
  }, []);
}
```

#### 通信方式选择指南

```
场景               → 推荐方案
─────────────────────────────────
父→子              → Props
子→父              → 回调函数
兄弟组件           → 状态提升
跨2-3层            → Props逐层传递
跨多层             → Context
复杂全局状态       → Redux/Zustand
简单全局状态       → Context + useReducer
```

---

**总结**：本文档深度解析了React核心概念，包括类组件vs函数组件、Refs、HOC、受控组件、Pure Components、Hooks状态管理、Immutable、SSR和组件通信。每个主题都包含原理剖析、性能对比、实战案例和最佳实践，帮助开发者全面掌握React技术栈。
