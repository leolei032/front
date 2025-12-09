# Redux 面试题库

## 1. Redux中步骤的请求怎么处理

### 解答

Redux处理异步请求通常使用中间件，最常见的是Redux Thunk和Redux Saga。

#### 使用Redux Thunk
```javascript
// Action Creators
export const fetchUserRequest = () => ({ type: 'FETCH_USER_REQUEST' });
export const fetchUserSuccess = (data) => ({ type: 'FETCH_USER_SUCCESS', payload: data });
export const fetchUserFailure = (error) => ({ type: 'FETCH_USER_FAILURE', payload: error });

// Thunk Action
export function fetchUser(userId) {
  return async (dispatch, getState) => {
    // 1. 发起请求前
    dispatch(fetchUserRequest());

    try {
      // 2. 发起异步请求
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();

      // 3. 请求成功
      dispatch(fetchUserSuccess(data));
    } catch (error) {
      // 4. 请求失败
      dispatch(fetchUserFailure(error.message));
    }
  };
}

// Reducer
function userReducer(state = { loading: false, data: null, error: null }, action) {
  switch (action.type) {
    case 'FETCH_USER_REQUEST':
      return { ...state, loading: true, error: null };
    case 'FETCH_USER_SUCCESS':
      return { loading: false, data: action.payload, error: null };
    case 'FETCH_USER_FAILURE':
      return { loading: false, data: null, error: action.payload };
    default:
      return state;
  }
}

// 组件中使用
function UserProfile({ userId }) {
  const dispatch = useDispatch();
  const { loading, data, error } = useSelector(state => state.user);

  useEffect(() => {
    dispatch(fetchUser(userId));
  }, [userId, dispatch]);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  if (!data) return null;

  return <div>{data.name}</div>;
}
```

#### 使用Redux Toolkit的createAsyncThunk
```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 创建异步thunk
export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('请求失败');
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 创建slice
const userSlice = createSlice({
  name: 'user',
  initialState: {
    loading: false,
    data: null,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export default userSlice.reducer;
```

#### 使用Redux Saga
```javascript
import { call, put, takeLatest } from 'redux-saga/effects';

// API函数
function* fetchUserSaga(action) {
  try {
    // 发起请求
    yield put({ type: 'FETCH_USER_REQUEST' });

    // 调用API
    const response = yield call(fetch, `/api/users/${action.payload}`);
    const data = yield call([response, 'json']);

    // 成功
    yield put({ type: 'FETCH_USER_SUCCESS', payload: data });
  } catch (error) {
    // 失败
    yield put({ type: 'FETCH_USER_FAILURE', payload: error.message });
  }
}

// 监听action
function* watchFetchUser() {
  yield takeLatest('FETCH_USER', fetchUserSaga);
}

// 组件中dispatch
dispatch({ type: 'FETCH_USER', payload: userId });
```

#### 多个并发请求
```javascript
// Thunk方式
export function fetchUserData(userId) {
  return async (dispatch) => {
    dispatch({ type: 'FETCH_START' });

    try {
      // 并发请求
      const [profile, posts, friends] = await Promise.all([
        fetch(`/api/users/${userId}`).then(r => r.json()),
        fetch(`/api/users/${userId}/posts`).then(r => r.json()),
        fetch(`/api/users/${userId}/friends`).then(r => r.json())
      ]);

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: { profile, posts, friends }
      });
    } catch (error) {
      dispatch({ type: 'FETCH_ERROR', payload: error });
    }
  };
}

// Saga方式
import { all, call, put } from 'redux-saga/effects';

function* fetchUserDataSaga(action) {
  try {
    const [profile, posts, friends] = yield all([
      call(fetchProfile, action.payload),
      call(fetchPosts, action.payload),
      call(fetchFriends, action.payload)
    ]);

    yield put({
      type: 'FETCH_SUCCESS',
      payload: { profile, posts, friends }
    });
  } catch (error) {
    yield put({ type: 'FETCH_ERROR', payload: error });
  }
}
```

## 2. 柯里化函数两个参数

### 解答

柯里化是把接受多个参数的函数变换成接受单一参数的函数序列。

#### 基础柯里化
```javascript
// 普通函数
function add(a, b, c) {
  return a + b + c;
}
add(1, 2, 3); // 6

// 柯里化后
function curriedAdd(a) {
  return function(b) {
    return function(c) {
      return a + b + c;
    };
  };
}
curriedAdd(1)(2)(3); // 6

// 箭头函数版本
const curriedAdd = a => b => c => a + b + c;
```

#### 实现通用柯里化函数
```javascript
function curry(fn) {
  return function curried(...args) {
    // 如果参数够了，直接执行
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }

    // 否则返回新函数继续收集参数
    return function(...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

// 使用
function sum(a, b, c) {
  return a + b + c;
}

const curriedSum = curry(sum);
curriedSum(1)(2)(3); // 6
curriedSum(1, 2)(3); // 6
curriedSum(1)(2, 3); // 6
curriedSum(1, 2, 3); // 6
```

#### Redux中间件的柯里化
```javascript
// Redux中间件就是三层柯里化
const middleware = store => next => action => {
  // 处理逻辑
  return next(action);
};

// 等价于
const middleware = function(store) {
  return function(next) {
    return function(action) {
      return next(action);
    };
  };
};

// 具体示例：日志中间件
const logger = ({ getState }) => next => action => {
  console.log('dispatching:', action);
  console.log('previous state:', getState());

  const result = next(action);

  console.log('next state:', getState());
  return result;
};
```

#### 实际应用场景
```javascript
// 1. 参数复用
const multiply = a => b => a * b;
const double = multiply(2);
const triple = multiply(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15

// 2. 延迟执行
const discount = rate => price => price * (1 - rate);
const studentDiscount = discount(0.2); // 8折
const vipDiscount = discount(0.3); // 7折

console.log(studentDiscount(100)); // 80
console.log(vipDiscount(100)); // 70

// 3. 动态生成函数
const hasPermission = permission => user => user.permissions.includes(permission);
const canRead = hasPermission('read');
const canWrite = hasPermission('write');

console.log(canRead({ permissions: ['read', 'write'] })); // true
console.log(canWrite({ permissions: ['read'] })); // false

// 4. 函数组合
const map = fn => array => array.map(fn);
const filter = fn => array => array.filter(fn);

const double = x => x * 2;
const isEven = x => x % 2 === 0;

const doubleEvens = arr => map(double)(filter(isEven)(arr));
console.log(doubleEvens([1, 2, 3, 4])); // [4, 8]
```

#### 偏函数 vs 柯里化
```javascript
// 柯里化：一次只传一个参数
const curriedSum = a => b => c => a + b + c;
curriedSum(1)(2)(3); // 必须一个个传

// 偏函数：固定部分参数
function partial(fn, ...fixedArgs) {
  return function(...remainingArgs) {
    return fn(...fixedArgs, ...remainingArgs);
  };
}

function sum(a, b, c) {
  return a + b + c;
}

const add5 = partial(sum, 5);
add5(2, 3); // 10 - 可以一次传多个
```

## 3. Redux状态管理器和变量挂载到window中有什么区别

### 解答

这是两种完全不同的状态管理方式。

#### 方式对比

**挂载到window**
```javascript
// 全局变量
window.userData = { name: 'John', age: 25 };
window.cartItems = [];

// 任何地方都可以访问和修改
window.userData.name = 'Jane';
window.cartItems.push({ id: 1, name: 'Product' });

// 组件中使用
function UserProfile() {
  const [, forceUpdate] = useState({});

  const changeName = () => {
    window.userData.name = 'New Name';
    forceUpdate({}); // 必须手动触发更新！
  };

  return <div>{window.userData.name}</div>;
}
```

**Redux管理**
```javascript
// Redux store
const store = createStore(reducer);

// 组件自动响应变化
function UserProfile() {
  const userData = useSelector(state => state.user);
  const dispatch = useDispatch();

  const changeName = () => {
    dispatch({ type: 'UPDATE_NAME', payload: 'New Name' });
    // 自动更新所有使用该数据的组件
  };

  return <div>{userData.name}</div>;
}
```

#### 详细区别

| 特性 | window全局变量 | Redux |
|-----|---------------|-------|
| **可预测性** | 任何地方可随意修改 | 只能通过dispatch修改 |
| **调试** | 难以追踪修改来源 | 可通过Redux DevTools追踪 |
| **时间旅行** | 不支持 | 支持状态回溯 |
| **响应式更新** | 需手动触发更新 | 自动更新组件 |
| **状态持久化** | 需自己实现 | 中间件支持 |
| **异步处理** | 需自己管理 | 中间件支持 |
| **TypeScript支持** | 弱类型 | 强类型支持 |
| **测试** | 难以测试 | 易于测试 |

#### 可预测性对比
```javascript
// window方式：任何地方都能修改
function ComponentA() {
  window.count = 10;
}

function ComponentB() {
  window.count = 20; // 覆盖了ComponentA的值
}

function ComponentC() {
  delete window.count; // 甚至可以删除
}

// 很难知道count什么时候被谁修改了

// Redux方式：修改可追踪
function ComponentA() {
  dispatch({ type: 'SET_COUNT', payload: 10, meta: { from: 'ComponentA' } });
}

function ComponentB() {
  dispatch({ type: 'SET_COUNT', payload: 20, meta: { from: 'ComponentB' } });
}

// Redux DevTools清楚显示每次修改的来源和时间
```

#### 响应式更新
```javascript
// window方式：不会自动更新
window.theme = 'light';

function Header() {
  return <div className={window.theme}>Header</div>;
  // 修改window.theme后，组件不会重新渲染！
}

// 必须手动触发
function ThemeToggle() {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const toggle = () => {
    window.theme = window.theme === 'light' ? 'dark' : 'light';
    forceUpdate(); // 手动强制更新
    // 但其他使用window.theme的组件不会更新！
  };

  return <button onClick={toggle}>切换主题</button>;
}

// Redux方式：自动更新所有订阅组件
const theme = useSelector(state => state.theme);

function Header() {
  const theme = useSelector(state => state.theme);
  return <div className={theme}>Header</div>;
  // 自动重新渲染
}

function ThemeToggle() {
  const dispatch = useDispatch();
  const theme = useSelector(state => state.theme);

  const toggle = () => {
    dispatch({ type: 'TOGGLE_THEME' });
    // 所有使用theme的组件都会自动更新
  };

  return <button onClick={toggle}>切换主题</button>;
}
```

#### 调试体验
```javascript
// window方式
window.user = { name: 'John' };
// 某处被修改了...
window.user = { name: 'Jane' };
// 无法知道谁修改的，什么时候修改的

// Redux方式 + Redux DevTools
dispatch({ type: 'UPDATE_USER', payload: { name: 'John' } });
// DevTools显示：
// - Action类型
// - Payload内容
// - 修改前后的state
// - 触发时间
// - 调用栈
// 可以回放每一步操作
```

#### 最佳实践
```javascript
// ❌ 不推荐：混用
window.globalData = { count: 0 };

function App() {
  const reduxCount = useSelector(state => state.count);

  // 混乱！两个count不同步
  return (
    <div>
      Redux: {reduxCount}
      Window: {window.globalData.count}
    </div>
  );
}

// ✅ 推荐：统一使用Redux
function App() {
  const count = useSelector(state => state.count);

  return <div>Count: {count}</div>;
}

// ✅ 如果确实需要全局变量，用于常量
window.API_URL = 'https://api.example.com';
window.APP_VERSION = '1.0.0';
// 这些不会改变，不需要Redux管理
```

## 4. Redux有没有做封装

### 解答

Redux本身是一个轻量级库，但有很多封装方案来简化使用。

#### 原生Redux（未封装）
```javascript
// 需要大量样板代码
import { createStore } from 'redux';

// Action Types
const INCREMENT = 'INCREMENT';
const DECREMENT = 'DECREMENT';

// Action Creators
function increment() {
  return { type: INCREMENT };
}

function decrement() {
  return { type: DECREMENT };
}

// Reducer
function counterReducer(state = { value: 0 }, action) {
  switch (action.type) {
    case INCREMENT:
      return { value: state.value + 1 };
    case DECREMENT:
      return { value: state.value - 1 };
    default:
      return state;
  }
}

// 创建store
const store = createStore(counterReducer);

// 使用
store.dispatch(increment());
```

#### Redux Toolkit（官方推荐封装）
```javascript
import { configureStore, createSlice } from '@reduxjs/toolkit';

// 一个slice包含了reducer、actions、types
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => {
      // 可以直接"修改"state（内部使用Immer）
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    }
  }
});

// 自动生成action creators
export const { increment, decrement, incrementByAmount } = counterSlice.actions;

// 创建store（自动配置了DevTools、Thunk等）
const store = configureStore({
  reducer: {
    counter: counterSlice.reducer
  }
});

// 使用
store.dispatch(increment());
```

#### React-Redux封装
```javascript
import { Provider, useSelector, useDispatch } from 'react-redux';

// 封装前：手动订阅
class Counter extends React.Component {
  componentDidMount() {
    this.unsubscribe = store.subscribe(() => {
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    return <div>{store.getState().counter.value}</div>;
  }
}

// 封装后：使用hooks
function Counter() {
  const value = useSelector(state => state.counter.value);
  const dispatch = useDispatch();

  return (
    <div>
      <p>{value}</p>
      <button onClick={() => dispatch(increment())}>+</button>
    </div>
  );
}
```

#### 自定义封装示例
```javascript
// 1. 简化的action创建
function createActions(types) {
  const actions = {};
  types.forEach(type => {
    actions[type] = (payload) => ({ type, payload });
  });
  return actions;
}

const actions = createActions(['ADD_TODO', 'DELETE_TODO', 'TOGGLE_TODO']);
dispatch(actions.ADD_TODO({ text: 'Learn Redux' }));

// 2. 简化的reducer创建
function createReducer(initialState, handlers) {
  return function reducer(state = initialState, action) {
    if (handlers.hasOwnProperty(action.type)) {
      return handlers[action.type](state, action);
    }
    return state;
  };
}

const todoReducer = createReducer([], {
  'ADD_TODO': (state, action) => [...state, action.payload],
  'DELETE_TODO': (state, action) => state.filter(todo => todo.id !== action.payload),
});

// 3. 异步action封装
function createAsyncAction(type, apiCall) {
  return (params) => async (dispatch) => {
    dispatch({ type: `${type}_REQUEST` });
    try {
      const data = await apiCall(params);
      dispatch({ type: `${type}_SUCCESS`, payload: data });
    } catch (error) {
      dispatch({ type: `${type}_FAILURE`, payload: error.message });
    }
  };
}

const fetchUser = createAsyncAction('FETCH_USER', (id) =>
  fetch(`/api/users/${id}`).then(r => r.json())
);

// 4. 选择器封装
function createSelector(selector) {
  let lastState;
  let lastResult;

  return (state) => {
    if (state === lastState) {
      return lastResult;
    }
    lastState = state;
    lastResult = selector(state);
    return lastResult;
  };
}

const selectTodoCount = createSelector(state => state.todos.length);
```

#### Redux Toolkit Query（高级封装）
```javascript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// 自动生成hooks，处理缓存、加载状态等
const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getUser: builder.query({
      query: (id) => `users/${id}`
    }),
    updateUser: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `users/${id}`,
        method: 'PATCH',
        body: patch
      })
    })
  })
});

// 自动生成的hooks
export const { useGetUserQuery, useUpdateUserMutation } = api;

// 使用
function UserProfile({ id }) {
  const { data, isLoading, error } = useGetUserQuery(id);
  const [updateUser] = useUpdateUserMutation();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => updateUser({ id, name: 'New Name' })}>
        Update
      </button>
    </div>
  );
}
```

#### 第三方封装库对比

**1. Rematch**
```javascript
import { init } from '@rematch/core';

const count = {
  state: 0,
  reducers: {
    increment: (state) => state + 1
  },
  effects: (dispatch) => ({
    async fetchCount() {
      const count = await fetchCountApi();
      dispatch.count.increment(count);
    }
  })
};

const store = init({ models: { count } });
```

**2. Easy-Peasy**
```javascript
import { createStore, action, thunk } from 'easy-peasy';

const store = createStore({
  count: 0,
  increment: action((state) => {
    state.count += 1;
  }),
  fetchCount: thunk(async (actions) => {
    const count = await fetchCountApi();
    actions.increment(count);
  })
});
```

**3. Redux-Actions**
```javascript
import { createAction, handleActions } from 'redux-actions';

const increment = createAction('INCREMENT');
const decrement = createAction('DECREMENT');

const reducer = handleActions(
  {
    [increment]: (state) => ({ count: state.count + 1 }),
    [decrement]: (state) => ({ count: state.count - 1 })
  },
  { count: 0 }
);
```

## 5. 常用的Redux两端的参数具体是什么东西

### 解答

这里指的是Redux中间件的柯里化参数。

#### 中间件的三层参数

```javascript
const middleware = ({ dispatch, getState }) => next => action => {
  // 第一层参数: { dispatch, getState }
  // 第二层参数: next
  // 第三层参数: action
};
```

#### 第一层参数：Store API
```javascript
const exampleMiddleware = ({ dispatch, getState }) => next => action => {
  // dispatch: 派发action的函数
  // 可以在中间件中派发新的action
  dispatch({ type: 'SOME_ACTION' });

  // getState: 获取当前state的函数
  const currentState = getState();
  console.log('Current state:', currentState);

  return next(action);
};
```

**实际应用：**
```javascript
// 1. 条件派发
const conditionalMiddleware = ({ dispatch, getState }) => next => action => {
  const state = getState();

  // 根据当前状态决定是否派发action
  if (action.type === 'ADD_TODO' && state.todos.length >= 10) {
    dispatch({ type: 'SHOW_WARNING', payload: 'Too many todos!' });
    return; // 阻止原action
  }

  return next(action);
};

// 2. 状态检查
const authMiddleware = ({ getState }) => next => action => {
  const { isAuthenticated } = getState().auth;

  // 检查是否已登录
  if (action.meta?.requiresAuth && !isAuthenticated) {
    return next({ type: 'REDIRECT_TO_LOGIN' });
  }

  return next(action);
};
```

#### 第二层参数：next函数
```javascript
const loggerMiddleware = ({ getState }) => next => action => {
  console.log('Dispatching:', action);

  // next是下一个中间件或最终的dispatch
  const result = next(action);

  console.log('New state:', getState());
  return result;
};
```

**next的作用：**
```javascript
// 中间件链: A -> B -> C -> reducer

// 在A中调用next(action)
const middlewareA = store => next => action => {
  console.log('A: before');
  const result = next(action); // 传递给B
  console.log('A: after');
  return result;
};

// 在B中调用next(action)
const middlewareB = store => next => action => {
  console.log('B: before');
  const result = next(action); // 传递给C
  console.log('B: after');
  return result;
};

// 在C中调用next(action)
const middlewareC = store => next => action => {
  console.log('C: before');
  const result = next(action); // 到达reducer
  console.log('C: after');
  return result;
};

// 执行顺序：
// A: before
// B: before
// C: before
// (reducer执行)
// C: after
// B: after
// A: after
```

#### 第三层参数：action对象
```javascript
const actionMiddleware = store => next => action => {
  console.log('Action type:', action.type);
  console.log('Action payload:', action.payload);
  console.log('Action meta:', action.meta);

  // 可以修改action
  const modifiedAction = {
    ...action,
    meta: {
      ...action.meta,
      timestamp: Date.now()
    }
  };

  return next(modifiedAction);
};
```

#### 完整示例：API中间件
```javascript
const apiMiddleware = ({ dispatch, getState }) => next => action => {
  // 只处理API类型的action
  if (action.type !== 'API_CALL') {
    return next(action);
  }

  const { endpoint, method, body, onSuccess, onError } = action.payload;

  // 获取当前状态
  const state = getState();
  const token = state.auth.token;

  // 派发请求开始action
  dispatch({ type: 'API_REQUEST', payload: { endpoint } });

  // 发起请求
  fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })
    .then(response => response.json())
    .then(data => {
      // 成功：派发成功action
      dispatch({ type: onSuccess, payload: data });
    })
    .catch(error => {
      // 失败：派发失败action
      dispatch({ type: onError, payload: error.message });
    });

  // 不继续传递原action
  return;
};

// 使用
dispatch({
  type: 'API_CALL',
  payload: {
    endpoint: '/api/users',
    method: 'POST',
    body: { name: 'John' },
    onSuccess: 'CREATE_USER_SUCCESS',
    onError: 'CREATE_USER_ERROR'
  }
});
```

#### 多个中间件协作
```javascript
// 日志中间件
const logger = ({ getState }) => next => action => {
  console.group(action.type);
  console.log('Previous state:', getState());
  console.log('Action:', action);

  const result = next(action);

  console.log('Next state:', getState());
  console.groupEnd();

  return result;
};

// 错误处理中间件
const errorHandler = ({ dispatch }) => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Error in action:', action, error);
    dispatch({ type: 'SHOW_ERROR', payload: error.message });
  }
};

// 性能监控中间件
const performance = () => next => action => {
  const start = performance.now();

  const result = next(action);

  const end = performance.now();
  console.log(`Action ${action.type} took ${end - start}ms`);

  return result;
};

// 应用中间件
const store = createStore(
  reducer,
  applyMiddleware(logger, errorHandler, performance)
);
```

#### 中间件参数总结

```javascript
const middleware =
  // 第一层：Store API
  ({ dispatch, getState }) => {
    // 初始化阶段调用一次
    // 可以访问store的dispatch和getState

    return (
      // 第二层：next函数
      (next) => {
        // 中间件链接时调用一次
        // next是下一个中间件或最终dispatch

        return (
          // 第三层：action
          (action) => {
            // 每次dispatch时调用
            // 可以访问当前action

            // 处理逻辑
            const result = next(action);
            return result;
          }
        );
      }
    );
  };
```

## 6. 中间件是什么东西，接收几个参数

### 解答

Redux中间件是在action到达reducer之前的拦截器，用于扩展Redux功能。

#### 中间件定义
```javascript
// 中间件接收3个参数（三层柯里化）
const middleware =
  (storeAPI) =>      // 第1个参数：{ dispatch, getState }
  (next) =>          // 第2个参数：下一个中间件或dispatch
  (action) => {      // 第3个参数：当前action
    // 中间件逻辑
    return next(action);
  };
```

#### 中间件作用

**1. 日志记录**
```javascript
const logger = ({ getState }) => next => action => {
  console.log('dispatching', action);
  let result = next(action);
  console.log('next state', getState());
  return result;
};
```

**2. 异步操作**
```javascript
const thunk = ({ dispatch, getState }) => next => action => {
  if (typeof action === 'function') {
    return action(dispatch, getState);
  }
  return next(action);
};

// 使用
dispatch((dispatch) => {
  dispatch({ type: 'LOADING' });
  fetch('/api').then(data => dispatch({ type: 'SUCCESS', payload: data }));
});
```

**3. 崩溃报告**
```javascript
const crashReporter = () => next => action => {
  try {
    return next(action);
  } catch (err) {
    console.error('Caught an exception!', err);
    Raven.captureException(err, {
      extra: { action, state: store.getState() }
    });
    throw err;
  }
};
```

**4. 路由同步**
```javascript
const routerMiddleware = ({ dispatch }) => next => action => {
  if (action.type === 'NAVIGATE') {
    window.history.pushState(null, '', action.payload.url);
  }
  return next(action);
};
```

#### 完整的三个参数详解

```javascript
const fullMiddleware = (storeAPI) => {
  // 参数1: storeAPI = { dispatch, getState }
  console.log('初始化中间件，只执行一次');

  const { dispatch, getState } = storeAPI;

  return (next) => {
    // 参数2: next - 下一个中间件或最终dispatch
    console.log('连接中间件链，只执行一次');

    return (action) => {
      // 参数3: action - 每次dispatch都会执行
      console.log('处理action:', action);

      // 可以在这里：
      // 1. 修改action
      const newAction = { ...action, timestamp: Date.now() };

      // 2. 发起其他action
      dispatch({ type: 'LOG_ACTION', payload: action.type });

      // 3. 读取当前state
      const state = getState();

      // 4. 阻止action继续传递
      if (state.user.banned) {
        return; // 不调用next
      }

      // 5. 正常传递
      const result = next(newAction);

      // 6. 执行后续操作
      console.log('action处理完成');

      return result;
    };
  };
};
```

#### 多个中间件的执行顺序
```javascript
const middleware1 = () => next => action => {
  console.log('1: before');
  const result = next(action);
  console.log('1: after');
  return result;
};

const middleware2 = () => next => action => {
  console.log('2: before');
  const result = next(action);
  console.log('2: after');
  return result;
};

const middleware3 = () => next => action => {
  console.log('3: before');
  const result = next(action);
  console.log('3: after');
  return result;
};

const store = createStore(
  reducer,
  applyMiddleware(middleware1, middleware2, middleware3)
);

store.dispatch({ type: 'TEST' });

// 输出顺序：
// 1: before
// 2: before
// 3: before
// (reducer执行)
// 3: after
// 2: after
// 1: after
```

#### 实用中间件示例集合

**1. 防抖中间件**
```javascript
const debounceMiddleware = () => {
  const timers = {};

  return next => action => {
    const { meta } = action;

    if (meta?.debounce) {
      clearTimeout(timers[action.type]);

      return new Promise((resolve) => {
        timers[action.type] = setTimeout(() => {
          resolve(next(action));
        }, meta.debounce);
      });
    }

    return next(action);
  };
};

// 使用
dispatch({
  type: 'SEARCH',
  payload: query,
  meta: { debounce: 300 }
});
```

**2. 批量处理中间件**
```javascript
const batchMiddleware = () => {
  let queue = [];
  let timeout = null;

  return next => action => {
    if (action.type === 'BATCH') {
      queue.push(action.payload);

      if (!timeout) {
        timeout = setTimeout(() => {
          next({ type: 'BATCH_COMPLETE', payload: queue });
          queue = [];
          timeout = null;
        }, 100);
      }

      return;
    }

    return next(action);
  };
};
```

**3. 权限检查中间件**
```javascript
const permissionMiddleware = ({ getState }) => next => action => {
  const { meta } = action;

  if (meta?.permission) {
    const { user } = getState();

    if (!user.permissions.includes(meta.permission)) {
      console.error('Permission denied:', meta.permission);
      return next({
        type: 'PERMISSION_DENIED',
        payload: meta.permission
      });
    }
  }

  return next(action);
};

// 使用
dispatch({
  type: 'DELETE_USER',
  payload: userId,
  meta: { permission: 'admin' }
});
```

**4. 分析中间件**
```javascript
const analyticsMiddleware = () => next => action => {
  if (action.meta?.track) {
    // 发送到分析服务
    analytics.track(action.type, {
      ...action.payload,
      timestamp: Date.now()
    });
  }

  return next(action);
};
```

#### 应用中间件
```javascript
import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

const store = createStore(
  rootReducer,
  compose(
    applyMiddleware(
      logger,
      thunk,
      crashReporter,
      analyticsMiddleware
    ),
    // Redux DevTools
    window.__REDUX_DEVTOOLS_EXTENSION__?.()
  )
);
```

