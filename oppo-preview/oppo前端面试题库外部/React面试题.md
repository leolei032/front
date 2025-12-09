# React 面试题库

## 1. React声明周期及自己的理解

### 解答

React组件生命周期分为三个阶段：挂载、更新和卸载。

#### 挂载阶段（Mounting）
1. **constructor()** - 构造函数，初始化state和绑定方法
2. **static getDerivedStateFromProps()** - 从props派生state
3. **render()** - 渲染组件
4. **componentDidMount()** - 组件挂载后调用，适合发起网络请求

```javascript
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  componentDidMount() {
    // 组件已挂载，可以进行API调用
    fetch('/api/data')
      .then(res => res.json())
      .then(data => this.setState({ data }));
  }

  render() {
    return <div>{this.state.count}</div>;
  }
}
```

#### 更新阶段（Updating）
1. **static getDerivedStateFromProps()** - props变化时调用
2. **shouldComponentUpdate()** - 决定是否重新渲染（性能优化点）
3. **render()** - 重新渲染
4. **getSnapshotBeforeUpdate()** - 更新前获取DOM快照
5. **componentDidUpdate()** - 更新后调用

```javascript
shouldComponentUpdate(nextProps, nextState) {
  // 只有count变化时才重新渲染
  return nextState.count !== this.state.count;
}

componentDidUpdate(prevProps, prevState) {
  // 可以在这里根据props变化执行操作
  if (this.props.userId !== prevProps.userId) {
    this.fetchUserData(this.props.userId);
  }
}
```

#### 卸载阶段（Unmounting）
1. **componentWillUnmount()** - 组件卸载前调用，清理定时器、取消请求等

```javascript
componentWillUnmount() {
  // 清理工作
  clearInterval(this.timer);
  this.abortController.abort();
}
```

## 2. 如何配置React-Router

### 解答

React Router是React的路由库，用于处理单页应用的导航。

#### 基础配置
```javascript
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">首页</Link>
        <Link to="/about">关于</Link>
        <Link to="/users">用户</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

#### 路由参数和查询
```javascript
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

function UserDetail() {
  const { id } = useParams(); // 获取路由参数
  const [searchParams] = useSearchParams(); // 获取查询参数
  const navigate = useNavigate(); // 编程式导航

  const tab = searchParams.get('tab');

  return (
    <div>
      <h1>用户ID: {id}</h1>
      <p>当前Tab: {tab}</p>
      <button onClick={() => navigate('/users')}>返回列表</button>
    </div>
  );
}
```

#### 嵌套路由
```javascript
<Routes>
  <Route path="/dashboard" element={<Dashboard />}>
    <Route path="overview" element={<Overview />} />
    <Route path="stats" element={<Stats />} />
  </Route>
</Routes>

// Dashboard组件中
import { Outlet } from 'react-router-dom';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet /> {/* 嵌套路由渲染位置 */}
    </div>
  );
}
```

#### 路由守卫
```javascript
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// 使用
<Route
  path="/admin"
  element={
    <ProtectedRoute>
      <Admin />
    </ProtectedRoute>
  }
/>
```

## 3. 路由的动态加载模块

### 解答

动态加载（懒加载）可以按需加载组件，减少初始包体积。

```javascript
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 懒加载组件
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Users = lazy(() => import('./pages/Users'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>加载中...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

#### 带加载状态的懒加载
```javascript
function Loading() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>页面加载中...</p>
    </div>
  );
}

function ErrorBoundary({ children }) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    return <div>加载失败，请刷新重试</div>;
  }

  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* 路由配置 */}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 4. 服务端渲染SSR

### 解答

服务端渲染（Server-Side Rendering）是在服务器上将React组件渲染成HTML字符串。

#### SSR的优势
1. **SEO友好** - 搜索引擎可以直接抓取完整HTML
2. **首屏加载快** - 用户直接看到渲染好的HTML
3. **更好的性能指标** - FCP、LCP等指标更优

#### SSR基础实现
```javascript
// server.js
import express from 'express';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from './App';

const app = express();

app.get('*', (req, res) => {
  const html = ReactDOMServer.renderToString(<App />);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SSR App</title>
      </head>
      <body>
        <div id="root">${html}</div>
        <script src="/bundle.js"></script>
      </body>
    </html>
  `);
});

app.listen(3000);
```

#### 客户端hydration
```javascript
// client.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 使用hydrate而不是render
ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <App />
);
```

#### Next.js实现SSR
```javascript
// pages/index.js
export default function Home({ data }) {
  return <div>{data.title}</div>;
}

// 服务端获取数据
export async function getServerSideProps() {
  const res = await fetch('https://api.example.com/data');
  const data = await res.json();

  return {
    props: { data }
  };
}
```

## 5. 介绍路由的history

### 解答

React Router支持多种history模式来管理浏览器历史记录。

#### BrowserRouter（History模式）
使用HTML5 History API（pushState、replaceState）

```javascript
import { BrowserRouter } from 'react-router-dom';

// URL形式：http://example.com/about
<BrowserRouter>
  <App />
</BrowserRouter>
```

**特点：**
- URL干净美观，没有#号
- 需要服务器配置支持（所有路由返回index.html）
- 支持SSR

**Nginx配置：**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

#### HashRouter（Hash模式）
使用URL的hash部分（#）来管理路由

```javascript
import { HashRouter } from 'react-router-dom';

// URL形式：http://example.com/#/about
<HashRouter>
  <App />
</HashRouter>
```

**特点：**
- URL带有#号
- 不需要服务器配置
- 不支持SSR
- hash变化不会触发页面刷新

#### MemoryRouter（内存模式）
将历史记录保存在内存中，不改变URL

```javascript
import { MemoryRouter } from 'react-router-dom';

// 适用于非浏览器环境（如React Native）
<MemoryRouter>
  <App />
</MemoryRouter>
```

#### 编程式导航
```javascript
import { useNavigate, useLocation } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();
  const location = useLocation();

  // 跳转
  navigate('/about');

  // 带状态跳转
  navigate('/about', { state: { from: 'home' } });

  // 后退
  navigate(-1);

  // 前进
  navigate(1);

  // 替换当前历史记录
  navigate('/about', { replace: true });

  console.log(location.pathname); // 当前路径
  console.log(location.state); // 路由状态
}
```

## 6. 介绍Redux数据流的流程

### 解答

Redux是一个状态管理库，遵循单向数据流。

#### Redux核心概念

**1. Store** - 存储应用状态的容器
```javascript
import { createStore } from 'redux';

const store = createStore(reducer);
```

**2. Action** - 描述发生了什么的对象
```javascript
// Action
const incrementAction = {
  type: 'INCREMENT',
  payload: 1
};

// Action Creator
function increment(amount) {
  return {
    type: 'INCREMENT',
    payload: amount
  };
}
```

**3. Reducer** - 根据action更新state的纯函数
```javascript
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + action.payload };
    case 'DECREMENT':
      return { count: state.count - action.payload };
    default:
      return state;
  }
}
```

**4. Dispatch** - 发送action的方法
```javascript
store.dispatch(increment(1));
```

#### Redux数据流

```
View → Action → Dispatcher → Reducer → Store → View
  ↑                                              ↓
  └──────────────────────────────────────────────┘
```

**完整流程：**
1. 用户在View中触发事件
2. 通过dispatch发送Action
3. Store调用Reducer处理Action
4. Reducer返回新的State
5. Store更新，通知所有订阅者
6. View重新渲染

#### React中使用Redux
```javascript
import { createStore } from 'redux';
import { Provider, useSelector, useDispatch } from 'react-redux';

// Reducer
function reducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    default:
      return state;
  }
}

// 创建store
const store = createStore(reducer);

// 根组件
function App() {
  return (
    <Provider store={store}>
      <Counter />
    </Provider>
  );
}

// 使用Redux的组件
function Counter() {
  const count = useSelector(state => state.count);
  const dispatch = useDispatch();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>
        +1
      </button>
    </div>
  );
}
```

## 7. Redux如何实现多个组件之间的通信

### 解答

Redux通过共享状态实现组件间通信。

#### 基础通信模式
```javascript
// store.js
import { createStore } from 'redux';

const initialState = {
  user: null,
  notifications: [],
  theme: 'light'
};

function rootReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

export const store = createStore(rootReducer);
```

#### 组件A - 发送消息
```javascript
import { useDispatch } from 'react-redux';

function ComponentA() {
  const dispatch = useDispatch();

  const sendNotification = () => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: Date.now(),
        message: 'Hello from Component A',
        timestamp: new Date()
      }
    });
  };

  return <button onClick={sendNotification}>发送通知</button>;
}
```

#### 组件B - 接收消息
```javascript
import { useSelector } from 'react-redux';

function ComponentB() {
  const notifications = useSelector(state => state.notifications);

  return (
    <div>
      <h3>通知列表</h3>
      {notifications.map(notif => (
        <div key={notif.id}>
          {notif.message} - {notif.timestamp.toLocaleString()}
        </div>
      ))}
    </div>
  );
}
```

#### 多个组件同时监听同一状态
```javascript
// Header组件
function Header() {
  const user = useSelector(state => state.user);
  const theme = useSelector(state => state.theme);

  return (
    <header className={`header-${theme}`}>
      <div>欢迎, {user?.name}</div>
    </header>
  );
}

// Sidebar组件
function Sidebar() {
  const user = useSelector(state => state.user);

  return (
    <aside>
      <img src={user?.avatar} />
      <p>{user?.name}</p>
    </aside>
  );
}

// Settings组件
function Settings() {
  const theme = useSelector(state => state.theme);
  const dispatch = useDispatch();

  return (
    <div>
      <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'dark' })}>
        切换主题
      </button>
      <p>当前主题: {theme}</p>
    </div>
  );
}
```

## 8. 多个组件之间如何拆分各自的state，每块小的组件有自己的状态

### 解答

可以使用combineReducers将多个reducer组合，每个组件管理自己的状态。

#### 拆分Reducer
```javascript
import { combineReducers, createStore } from 'redux';

// 用户模块的reducer
function userReducer(state = { profile: null, isLoggedIn: false }, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, profile: action.payload, isLoggedIn: true };
    case 'LOGOUT':
      return { profile: null, isLoggedIn: false };
    default:
      return state;
  }
}

// 购物车模块的reducer
function cartReducer(state = { items: [], total: 0 }, action) {
  switch (action.type) {
    case 'ADD_TO_CART':
      return {
        items: [...state.items, action.payload],
        total: state.total + action.payload.price
      };
    case 'REMOVE_FROM_CART':
      const newItems = state.items.filter(item => item.id !== action.payload);
      return {
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price, 0)
      };
    default:
      return state;
  }
}

// 通知模块的reducer
function notificationReducer(state = { list: [] }, action) {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return { list: [...state.list, action.payload] };
    case 'CLEAR_NOTIFICATIONS':
      return { list: [] };
    default:
      return state;
  }
}

// 组合所有reducer
const rootReducer = combineReducers({
  user: userReducer,
  cart: cartReducer,
  notifications: notificationReducer
});

const store = createStore(rootReducer);

// 最终state结构：
// {
//   user: { profile: null, isLoggedIn: false },
//   cart: { items: [], total: 0 },
//   notifications: { list: [] }
// }
```

#### 组件使用各自的state
```javascript
// UserProfile组件 - 只使用user state
function UserProfile() {
  const { profile, isLoggedIn } = useSelector(state => state.user);
  const dispatch = useDispatch();

  if (!isLoggedIn) {
    return <button onClick={() => dispatch({ type: 'LOGIN', payload: userData })}>
      登录
    </button>;
  }

  return <div>欢迎, {profile.name}</div>;
}

// ShoppingCart组件 - 只使用cart state
function ShoppingCart() {
  const { items, total } = useSelector(state => state.cart);
  const dispatch = useDispatch();

  return (
    <div>
      <h3>购物车 ({items.length})</h3>
      {items.map(item => (
        <div key={item.id}>
          {item.name} - ¥{item.price}
          <button onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })}>
            删除
          </button>
        </div>
      ))}
      <p>总计: ¥{total}</p>
    </div>
  );
}

// NotificationPanel组件 - 只使用notifications state
function NotificationPanel() {
  const notifications = useSelector(state => state.notifications.list);
  const dispatch = useDispatch();

  return (
    <div>
      {notifications.map(notif => (
        <div key={notif.id}>{notif.message}</div>
      ))}
      <button onClick={() => dispatch({ type: 'CLEAR_NOTIFICATIONS' })}>
        清空
      </button>
    </div>
  );
}
```

#### 使用Redux Toolkit简化
```javascript
import { configureStore, createSlice } from '@reduxjs/toolkit';

// 用户slice
const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, isLoggedIn: false },
  reducers: {
    login: (state, action) => {
      state.profile = action.payload;
      state.isLoggedIn = true;
    },
    logout: (state) => {
      state.profile = null;
      state.isLoggedIn = false;
    }
  }
});

// 购物车slice
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], total: 0 },
  reducers: {
    addToCart: (state, action) => {
      state.items.push(action.payload);
      state.total += action.payload.price;
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.total = state.items.reduce((sum, item) => sum + item.price, 0);
    }
  }
});

// 创建store
const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    cart: cartSlice.reducer
  }
});

// 导出actions
export const { login, logout } = userSlice.actions;
export const { addToCart, removeFromCart } = cartSlice.actions;
```

## 9. 它们如何通过reducer函数来更新data的变化，怎么更新，更新怎么调度

### 解答

Reducer是纯函数，接收旧state和action，返回新state。

#### Reducer基本原理
```javascript
// Reducer是纯函数：(state, action) => newState
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      // 返回新对象，不修改原state
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'SET_COUNT':
      return { count: action.payload };
    default:
      return state; // 未知action，返回原state
  }
}
```

#### 更新机制
```javascript
// 1. 用户触发事件
<button onClick={handleClick}>+1</button>

// 2. dispatch action
function handleClick() {
  dispatch({ type: 'INCREMENT' });
}

// 3. Redux内部调用reducer
// newState = reducer(currentState, action)
const newState = counterReducer({ count: 5 }, { type: 'INCREMENT' });
// 返回: { count: 6 }

// 4. Redux更新store
// store.state = newState

// 5. 通知所有订阅者
// listeners.forEach(listener => listener())

// 6. React组件重新渲染
```

#### 复杂状态更新
```javascript
function todoReducer(state = { todos: [], filter: 'all' }, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state, // 保留其他属性
        todos: [...state.todos, action.payload] // 创建新数组
      };

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      };

    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.payload)
      };

    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload
      };

    default:
      return state;
  }
}
```

#### 调度流程详解
```javascript
// Redux内部简化实现
function createStore(reducer) {
  let state;
  let listeners = [];

  // 获取当前状态
  function getState() {
    return state;
  }

  // 订阅状态变化
  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }

  // 派发action
  function dispatch(action) {
    // 1. 调用reducer获取新state
    state = reducer(state, action);

    // 2. 通知所有订阅者
    listeners.forEach(listener => listener());

    return action;
  }

  // 初始化state
  dispatch({ type: '@@INIT' });

  return { getState, dispatch, subscribe };
}
```

#### 中间件处理异步调度
```javascript
// Redux Thunk中间件：支持dispatch函数
function thunkMiddleware({ dispatch, getState }) {
  return next => action => {
    // 如果action是函数，调用它
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }

    // 否则继续传递action
    return next(action);
  };
}

// 使用thunk处理异步
function fetchUser(id) {
  return async (dispatch, getState) => {
    dispatch({ type: 'FETCH_USER_REQUEST' });

    try {
      const response = await fetch(`/api/users/${id}`);
      const user = await response.json();
      dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'FETCH_USER_FAILURE', payload: error.message });
    }
  };
}

// 调用
dispatch(fetchUser(123));
```

## 10. 如果更新的时候还有其他任务在怎么处理

### 解答

React使用时间切片（Time Slicing）和优先级调度来处理并发更新。

#### React并发特性（React 18+）
```javascript
import { useTransition, useDeferredValue } from 'react';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState([]);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value); // 高优先级：立即更新输入框

    // 低优先级：推迟搜索结果更新
    startTransition(() => {
      const filtered = bigList.filter(item =>
        item.includes(value)
      );
      setResults(filtered);
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <div>搜索中...</div>}
      <ResultList results={results} />
    </div>
  );
}
```

#### useDeferredValue推迟更新
```javascript
function ProductList({ query }) {
  // 推迟query的更新，保持UI响应
  const deferredQuery = useDeferredValue(query);
  const products = useMemo(() =>
    filterProducts(deferredQuery),
    [deferredQuery]
  );

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
```

#### Redux中处理并发
```javascript
// 使用防抖处理高频更新
import { debounce } from 'lodash';

function SearchInput() {
  const dispatch = useDispatch();

  // 防抖dispatch
  const debouncedSearch = useMemo(
    () => debounce((value) => {
      dispatch({ type: 'SEARCH', payload: value });
    }, 300),
    [dispatch]
  );

  const handleChange = (e) => {
    debouncedSearch(e.target.value);
  };

  return <input onChange={handleChange} />;
}
```

#### 取消过期请求
```javascript
function DataFetcher() {
  const dispatch = useDispatch();

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchData() {
      dispatch({ type: 'FETCH_START' });

      try {
        const response = await fetch('/api/data', {
          signal: abortController.signal
        });
        const data = await response.json();
        dispatch({ type: 'FETCH_SUCCESS', payload: data });
      } catch (error) {
        if (error.name !== 'AbortError') {
          dispatch({ type: 'FETCH_ERROR', payload: error });
        }
      }
    }

    fetchData();

    // 组件卸载或依赖变化时取消请求
    return () => abortController.abort();
  }, [dispatch]);

  return <div>...</div>;
}
```

#### 任务优先级管理
```javascript
// 使用Redux中间件管理任务优先级
const taskQueue = [];
let isProcessing = false;

const priorityMiddleware = store => next => action => {
  if (action.meta?.priority === 'high') {
    // 高优先级任务立即执行
    return next(action);
  }

  // 低优先级任务加入队列
  taskQueue.push(() => next(action));

  if (!isProcessing) {
    processQueue();
  }
};

function processQueue() {
  if (taskQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const task = taskQueue.shift();

  // 使用requestIdleCallback在空闲时处理
  requestIdleCallback(() => {
    task();
    processQueue();
  });
}
```

## 11. key主要是解决哪一类的问题，为什么不建议用引入index（重绘）

### 解答

key是React识别列表元素的唯一标识，用于优化diff算法。

#### key的作用
```javascript
// 没有key
<ul>
  {items.map(item => (
    <li>{item.name}</li> // ❌ Warning: Each child should have a unique "key"
  ))}
</ul>

// 使用key
<ul>
  {items.map(item => (
    <li key={item.id}>{item.name}</li> // ✅
  ))}
</ul>
```

#### 为什么不用index作为key

**问题1：列表顺序改变时的bug**
```javascript
const [items, setItems] = useState([
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' }
]);

// ❌ 使用index作为key
{items.map((item, index) => (
  <input key={index} defaultValue={item.name} />
))}

// 删除第一项后：
// 原来：Apple(key=0), Banana(key=1), Cherry(key=2)
// 现在：Banana(key=0), Cherry(key=1)
// React认为：key=0和key=1的元素还在，只是值变了，删除了key=2
// 结果：输入框的值错乱！

// ✅ 使用稳定的id作为key
{items.map(item => (
  <input key={item.id} defaultValue={item.name} />
))}
// 删除后React能正确识别哪个元素被删除了
```

**问题2：性能问题**
```javascript
// 在列表头部插入新元素
const newItems = [{ id: 4, name: 'Orange' }, ...items];

// 使用index作为key：
// 旧列表：Apple(0), Banana(1), Cherry(2)
// 新列表：Orange(0), Apple(1), Banana(2), Cherry(3)
// React认为所有元素都变了，全部重新渲染！

// 使用id作为key：
// React识别出只是新增了Orange，其他元素复用
```

#### 正确的key使用
```javascript
// ✅ 使用唯一ID
{users.map(user => (
  <UserCard key={user.id} user={user} />
))}

// ✅ 组合多个字段
{posts.map(post => (
  <Post key={`${post.userId}-${post.id}`} post={post} />
))}

// ✅ 静态列表可以用index
const staticMenu = ['Home', 'About', 'Contact'];
{staticMenu.map((item, index) => (
  <MenuItem key={index} label={item} />
))}
// 因为这个列表永远不会重排序、插入或删除

// ❌ 不要用随机值
{items.map(item => (
  <Item key={Math.random()} item={item} />
))}
// 每次渲染都会生成新key，导致元素被销毁重建
```

#### key对比示例
```javascript
// 初始列表
<ul>
  <li key="1">Apple</li>
  <li key="2">Banana</li>
</ul>

// 在头部插入Orange
<ul>
  <li key="3">Orange</li>  {/* 新增 */}
  <li key="1">Apple</li>   {/* 复用 */}
  <li key="2">Banana</li>  {/* 复用 */}
</ul>
// React只会创建一个新的<li>，其他两个复用

// 如果用index作为key
<ul>
  <li key="0">Orange</li>  {/* key=0，但内容从Apple变成Orange，需要更新 */}
  <li key="1">Apple</li>   {/* key=1，但内容从Banana变成Apple，需要更新 */}
  <li key="2">Banana</li>  {/* 新增 */}
</ul>
// React会更新前两个<li>的内容，再创建一个新的
// 性能更差！
```

## 12. Redux中组件是什么东西，接收几个参数（两端的柯里化函数）

### 解答

这里应该是指Redux中间件（Middleware）。

#### 中间件是什么
中间件是Redux的插件系统，在action到达reducer之前进行拦截和处理。

```javascript
// 中间件签名：接收3个参数
const middleware = ({ dispatch, getState }) => next => action => {
  // 中间件逻辑
  return next(action);
};
```

#### 参数说明
1. **第一层参数：** `{ dispatch, getState }`
   - `dispatch`: 派发action的函数
   - `getState`: 获取当前state的函数

2. **第二层参数：** `next`
   - 下一个中间件或最终的dispatch函数

3. **第三层参数：** `action`
   - 当前被派发的action对象

#### Logger中间件示例
```javascript
const loggerMiddleware = ({ getState }) => next => action => {
  console.log('派发前:', action);
  console.log('状态前:', getState());

  const result = next(action); // 传递给下一个中间件

  console.log('状态后:', getState());
  return result;
};
```

#### Thunk中间件实现
```javascript
const thunkMiddleware = ({ dispatch, getState }) => next => action => {
  // 如果action是函数，调用它并传入dispatch和getState
  if (typeof action === 'function') {
    return action(dispatch, getState);
  }

  // 否则继续传递action
  return next(action);
};

// 使用thunk
function fetchUser(id) {
  return async (dispatch, getState) => {
    dispatch({ type: 'LOADING' });
    const data = await fetch(`/api/users/${id}`).then(r => r.json());
    dispatch({ type: 'SUCCESS', payload: data });
  };
}

dispatch(fetchUser(123));
```

#### 应用中间件
```javascript
import { createStore, applyMiddleware } from 'redux';

const store = createStore(
  reducer,
  applyMiddleware(
    loggerMiddleware,
    thunkMiddleware,
    customMiddleware
  )
);
```

#### 自定义中间件示例
```javascript
// API调用中间件
const apiMiddleware = ({ dispatch }) => next => action => {
  if (action.type !== 'API_CALL') {
    return next(action);
  }

  const { endpoint, method, onSuccess, onError } = action.payload;

  fetch(endpoint, { method })
    .then(res => res.json())
    .then(data => dispatch({ type: onSuccess, payload: data }))
    .catch(error => dispatch({ type: onError, payload: error }));
};

// 使用
dispatch({
  type: 'API_CALL',
  payload: {
    endpoint: '/api/users',
    method: 'GET',
    onSuccess: 'FETCH_USERS_SUCCESS',
    onError: 'FETCH_USERS_ERROR'
  }
});
```

#### 执行流程
```javascript
// 多个中间件的执行顺序
const store = createStore(
  reducer,
  applyMiddleware(
    middlewareA,  // 1. 先执行A的before逻辑
    middlewareB,  // 2. 再执行B的before逻辑
    middlewareC   // 3. 最后执行C的before逻辑
                  // 4. 到达reducer
                  // 5. 执行C的after逻辑
                  // 6. 执行B的after逻辑
                  // 7. 执行A的after逻辑
  )
);

// 示例
const middlewareA = store => next => action => {
  console.log('A: before');
  const result = next(action);
  console.log('A: after');
  return result;
};

const middlewareB = store => next => action => {
  console.log('B: before');
  const result = next(action);
  console.log('B: after');
  return result;
};

// 输出顺序：
// A: before
// B: before
// (reducer执行)
// B: after
// A: after
```

