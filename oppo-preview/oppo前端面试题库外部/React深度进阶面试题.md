# React 深度进阶面试题

## 1. React 16.X生命周期的改变及Time Slicing和Suspense

### React 16.3+ 生命周期变化

React 16引入了Fiber架构，彻底改变了生命周期机制。

#### 废弃的生命周期（不安全）

```javascript
// ❌ 已废弃（在React 17中移除）
componentWillMount()          // 改用 constructor 或 componentDidMount
componentWillReceiveProps()   // 改用 getDerivedStateFromProps
componentWillUpdate()         // 改用 getSnapshotBeforeUpdate

// 为什么废弃？
// 1. Fiber架构下，render阶段可能被打断和重启
// 2. 这些生命周期可能被多次调用
// 3. 在其中执行副作用（API调用、订阅等）会导致问题
```

#### 新的生命周期

**1. static getDerivedStateFromProps**
```javascript
class UserProfile extends React.Component {
  state = {
    localUser: null,
    prevPropsUserId: null
  };

  // 静态方法，无法访问this
  static getDerivedStateFromProps(props, state) {
    // 当props.userId变化时，重置本地state
    if (props.userId !== state.prevPropsUserId) {
      return {
        localUser: null,  // 重置localUser
        prevPropsUserId: props.userId
      };
    }

    // 返回null表示不需要更新state
    return null;
  }

  componentDidMount() {
    this.fetchUser(this.props.userId);
  }

  componentDidUpdate(prevProps, prevState) {
    // 在这里处理副作用
    if (this.props.userId !== prevProps.userId) {
      this.fetchUser(this.props.userId);
    }
  }

  fetchUser(userId) {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(user => this.setState({ localUser: user }));
  }

  render() {
    return <div>{this.state.localUser?.name}</div>;
  }
}

// 使用场景：
// 1. props变化时派生state
// 2. 动画开始前重置state
// 3. 表单控件受控时同步state

// ⚠️ 注意：尽量避免使用，优先考虑：
// 1. 完全受控组件（不用state）
// 2. 使用key重置组件
// 3. 在componentDidUpdate中处理
```

**2. getSnapshotBeforeUpdate**
```javascript
class ScrollList extends React.Component {
  listRef = React.createRef();

  getSnapshotBeforeUpdate(prevProps, prevState) {
    // 在DOM更新前获取信息
    // 典型场景：聊天室保持滚动位置

    if (prevProps.list.length < this.props.list.length) {
      const list = this.listRef.current;
      return {
        scrollHeight: list.scrollHeight,
        scrollTop: list.scrollTop
      };
    }

    return null;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // snapshot是getSnapshotBeforeUpdate的返回值
    if (snapshot !== null) {
      const list = this.listRef.current;

      // 新内容插入后，保持原来的滚动位置
      list.scrollTop = snapshot.scrollTop + (list.scrollHeight - snapshot.scrollHeight);
    }
  }

  render() {
    return (
      <div ref={this.listRef} style={{ height: 400, overflow: 'auto' }}>
        {this.props.list.map(item => (
          <div key={item.id}>{item.text}</div>
        ))}
      </div>
    );
  }
}

// 使用场景：
// 1. 聊天室滚动位置
// 2. 图片画廊保持视口位置
// 3. 需要在DOM变更前后对比的场景
```

### Fiber架构原理

```javascript
// Fiber是什么？
// 1. 一种数据结构：表示组件和DOM节点
// 2. 一种工作单元：包含组件类型、props、state等
// 3. 一种调度机制：支持任务中断和恢复

// Fiber节点结构（简化）
class FiberNode {
  constructor(tag, pendingProps, key) {
    // 节点类型（FunctionComponent, ClassComponent, HostComponent等）
    this.tag = tag;

    // 属性
    this.key = key;
    this.type = null;  // 函数组件是函数，类组件是类，DOM是字符串
    this.stateNode = null;  // 对应的DOM节点或组件实例

    // Fiber树结构
    this.return = null;  // 父Fiber
    this.child = null;   // 第一个子Fiber
    this.sibling = null; // 下一个兄弟Fiber

    // 工作单元
    this.pendingProps = pendingProps;  // 新的props
    this.memoizedProps = null;         // 上次渲染的props
    this.memoizedState = null;         // 上次渲染的state
    this.updateQueue = null;           // 更新队列

    // 副作用
    this.effectTag = null;  // 副作用类型（插入、更新、删除）
    this.nextEffect = null; // 下一个有副作用的Fiber

    // 优先级
    this.lanes = NoLanes;      // 当前优先级
    this.childLanes = NoLanes; // 子树优先级

    // 双缓存
    this.alternate = null;  // 指向另一棵树的对应节点
  }
}

// Fiber工作循环
function workLoop(deadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    // 执行一个工作单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // 检查是否还有剩余时间
    shouldYield = deadline.timeRemaining() < 1;
  }

  // 如果还有工作，继续调度
  if (nextUnitOfWork) {
    requestIdleCallback(workLoop);
  } else {
    // 工作完成，提交更新
    commitRoot();
  }
}

// 启动调度
requestIdleCallback(workLoop);
```

### Time Slicing（时间切片）

```javascript
// Time Slicing原理：
// 将长任务分割成多个小任务，在浏览器空闲时执行

// React内部实现（简化）
const channel = new MessageChannel();
const port = channel.port2;

channel.port1.onmessage = () => {
  // 执行调度的任务
  const currentTime = getCurrentTime();
  const hasTimeRemaining = frameDeadline - currentTime > 0;

  if (hasTimeRemaining) {
    performWork();
  } else {
    // 时间片用完，下一帧继续
    scheduleCallback(performWork);
  }
};

function scheduleCallback(callback) {
  // 使用MessageChannel实现宏任务
  port.postMessage(null);
}

// 优先级调度
const ImmediatePriority = 1;  // 立即执行
const UserBlockingPriority = 2;  // 用户交互
const NormalPriority = 3;  // 普通更新
const LowPriority = 4;  // 低优先级
const IdlePriority = 5;  // 空闲时执行

// 不同优先级的超时时间
const IMMEDIATE_PRIORITY_TIMEOUT = -1;  // 立即
const USER_BLOCKING_PRIORITY_TIMEOUT = 250;  // 250ms
const NORMAL_PRIORITY_TIMEOUT = 5000;  // 5s
const LOW_PRIORITY_TIMEOUT = 10000;  // 10s
const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;  // 永不过期

// 实际应用示例
function LongList() {
  const [items] = useState(Array.from({ length: 10000 }, (_, i) => i));

  return (
    <div>
      {items.map(item => (
        // React会将渲染工作分片执行
        // 不会阻塞主线程
        <ExpensiveItem key={item} value={item} />
      ))}
    </div>
  );
}

// 对比：没有Time Slicing时
// 渲染10000个组件可能需要100ms，期间页面卡死
// 有Time Slicing后：
// 每5ms渲染一批，总时间可能是150ms，但页面流畅
```

### Suspense深度解析

```javascript
// Suspense是什么？
// 1. 一种组件，用于等待异步操作
// 2. 配合lazy实现代码分割
// 3. 未来支持数据获取（React 18+）

// 基础用法：代码分割
const LazyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
}

// Suspense原理（简化）
class Suspense extends React.Component {
  state = { isLoading: false };

  componentDidCatch(error) {
    // 捕获Promise抛出
    if (error instanceof Promise) {
      this.setState({ isLoading: true });

      error.then(() => {
        // Promise完成，重新渲染
        this.setState({ isLoading: false });
      });
    } else {
      throw error;
    }
  }

  render() {
    if (this.state.isLoading) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// lazy实现原理
function lazy(loader) {
  let status = 'pending';
  let result;
  let promise = loader().then(
    module => {
      status = 'fulfilled';
      result = module.default;
    },
    error => {
      status = 'rejected';
      result = error;
    }
  );

  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: {
      _status: status,
      _result: result,
      _promise: promise
    },
    _init: (payload) => {
      if (payload._status === 'pending') {
        // 抛出Promise，触发Suspense
        throw payload._promise;
      }
      if (payload._status === 'fulfilled') {
        return payload._result;
      }
      if (payload._status === 'rejected') {
        throw payload._result;
      }
    }
  };
}

// 高级用法：嵌套Suspense
function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Layout>
        <Suspense fallback={<SidebarLoader />}>
          <Sidebar />
        </Suspense>

        <Suspense fallback={<ContentLoader />}>
          <Content />
        </Suspense>
      </Layout>
    </Suspense>
  );
}

// React 18: Suspense for Data Fetching
function ProfilePage({ userId }) {
  // use hook（实验性）
  const user = use(fetchUser(userId));
  const posts = use(fetchPosts(userId));

  return (
    <div>
      <h1>{user.name}</h1>
      <PostList posts={posts} />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfilePage userId={1} />
    </Suspense>
  );
}

// 实现简单的数据获取Suspense
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
        throw suspender;  // 抛出Promise
      }
      if (status === 'error') {
        throw result;
      }
      return result;
    }
  };
}

// 使用
const resource = wrapPromise(fetch('/api/user').then(r => r.json()));

function User() {
  const user = resource.read();  // 如果pending，会抛出Promise
  return <div>{user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<div>Loading user...</div>}>
      <User />
    </Suspense>
  );
}
```

### Concurrent Mode（并发模式）

```javascript
// React 18的并发特性

// 1. useTransition - 标记非紧急更新
function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    const value = e.target.value;

    // 紧急更新：立即更新输入框
    setQuery(value);

    // 非紧急更新：可以被打断
    startTransition(() => {
      // 耗时的搜索操作
      const filtered = hugeList.filter(item =>
        item.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultList results={results} />
    </>
  );
}

// 2. useDeferredValue - 延迟更新值
function ProductList({ query }) {
  const deferredQuery = useDeferredValue(query);

  // 使用延迟的query进行耗时操作
  const results = useMemo(() =>
    expensiveFilter(products, deferredQuery),
    [deferredQuery]
  );

  return (
    <>
      {query !== deferredQuery && <LoadingOverlay />}
      <List items={results} />
    </>
  );
}

// 3. Automatic Batching - 自动批处理
function App() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);

  function handleClick() {
    // React 18自动批处理，只触发一次渲染
    setCount(c => c + 1);
    setFlag(f => !f);

    // 在setTimeout、Promise等异步中也会批处理
    setTimeout(() => {
      setCount(c => c + 1);  // 批处理
      setFlag(f => !f);      // 批处理
    }, 1000);
  }

  // 只渲染一次
  console.log('render');

  return <button onClick={handleClick}>Next</button>;
}

// 退出批处理
import { flushSync } from 'react-dom';

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1);
  });
  // 此时会立即重新渲染

  flushSync(() => {
    setFlag(f => !f);
  });
  // 再次重新渲染
}
```

## 2. 虚拟DOM的深度原理

### 什么是虚拟DOM

```javascript
// 虚拟DOM是用JavaScript对象描述真实DOM
const vnode = {
  type: 'div',
  props: {
    className: 'container',
    onClick: handleClick
  },
  children: [
    {
      type: 'h1',
      props: { className: 'title' },
      children: ['Hello']
    },
    {
      type: 'p',
      props: null,
      children: ['World']
    }
  ]
};

// 对应的真实DOM
<div class="container" onclick="handleClick()">
  <h1 class="title">Hello</h1>
  <p>World</p>
</div>
```

### 为什么需要虚拟DOM

```javascript
// 问题：直接操作DOM的性能问题

// ❌ 不好：每次都操作真实DOM
for (let i = 0; i < 1000; i++) {
  const div = document.createElement('div');
  div.textContent = i;
  document.body.appendChild(div);  // 触发1000次重排
}

// ✅ 好：使用DocumentFragment批量操作
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const div = document.createElement('div');
  div.textContent = i;
  fragment.appendChild(div);
}
document.body.appendChild(fragment);  // 只触发1次重排

// 虚拟DOM的优势：
// 1. 批量更新：多次state变更合并为一次DOM操作
// 2. 跨平台：同一套代码可以渲染到DOM、Canvas、Native
// 3. Diff算法：精确找出需要更新的部分
// 4. 声明式编程：描述UI是什么，而不是怎么操作
```

### Diff算法详解

```javascript
// React Diff算法的三个策略

// 策略1：Tree Diff - 同层比较
// 只比较同一层级的节点，不会跨层级比较
// 时间复杂度：O(n)而不是O(n³)

function treeDiff(oldVNode, newVNode) {
  if (oldVNode.type !== newVNode.type) {
    // 类型不同，直接替换整个节点
    return { type: 'REPLACE', node: newVNode };
  }

  // 类型相同，继续比较属性和子节点
  const patches = [];

  // 比较属性
  const propsPatch = diffProps(oldVNode.props, newVNode.props);
  if (propsPatch) {
    patches.push({ type: 'PROPS', props: propsPatch });
  }

  // 比较子节点
  const childrenPatch = diffChildren(oldVNode.children, newVNode.children);
  if (childrenPatch.length > 0) {
    patches.push({ type: 'CHILDREN', patches: childrenPatch });
  }

  return patches;
}

// 策略2：Component Diff - 组件比较
// 同类型组件，按照Tree Diff比较
// 不同类型组件，直接替换

function componentDiff(oldComponent, newComponent) {
  if (oldComponent.type !== newComponent.type) {
    // 不同类型，直接替换
    return { type: 'REPLACE', component: newComponent };
  }

  if (oldComponent.type.prototype instanceof React.Component) {
    // 类组件：使用shouldComponentUpdate
    const instance = oldComponent.instance;
    if (instance.shouldComponentUpdate(newComponent.props, newComponent.state)) {
      return treeDiff(oldComponent, newComponent);
    }
    return null;  // 不需要更新
  }

  // 函数组件：总是更新
  return treeDiff(oldComponent, newComponent);
}

// 策略3：Element Diff - 列表比较
// 使用key优化列表diff

function elementDiff(oldList, newList) {
  const oldMap = new Map();
  const newMap = new Map();
  const patches = [];

  // 建立key映射
  oldList.forEach((item, index) => {
    oldMap.set(item.key || index, { item, index });
  });

  newList.forEach((item, index) => {
    newMap.set(item.key || index, { item, index });
  });

  // 1. 找出需要删除的节点
  oldMap.forEach((value, key) => {
    if (!newMap.has(key)) {
      patches.push({ type: 'REMOVE', index: value.index });
    }
  });

  // 2. 找出需要插入或移动的节点
  let lastIndex = 0;
  newList.forEach((newItem, newIndex) => {
    const key = newItem.key || newIndex;
    const oldValue = oldMap.get(key);

    if (!oldValue) {
      // 新节点，插入
      patches.push({ type: 'INSERT', index: newIndex, node: newItem });
    } else {
      // 节点存在，检查是否需要移动
      if (oldValue.index < lastIndex) {
        // 需要移动
        patches.push({ type: 'MOVE', from: oldValue.index, to: newIndex });
      } else {
        lastIndex = oldValue.index;
      }

      // 更新节点
      const patch = treeDiff(oldValue.item, newItem);
      if (patch) {
        patches.push({ type: 'UPDATE', index: newIndex, patch });
      }
    }
  });

  return patches;
}
```

### 完整的虚拟DOM实现

```javascript
// 1. 创建虚拟DOM
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children.flat()
  };
}

// 使用JSX（编译后）
const vnode = h('div', { className: 'app' },
  h('h1', null, 'Title'),
  h('p', null, 'Content')
);

// 2. 渲染虚拟DOM到真实DOM
function render(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(vnode);
  }

  const { type, props, children } = vnode;
  const element = document.createElement(type);

  // 设置属性
  if (props) {
    Object.entries(props).forEach(([key, value]) => {
      setAttribute(element, key, value);
    });
  }

  // 渲染子节点
  children.forEach(child => {
    element.appendChild(render(child));
  });

  return element;
}

function setAttribute(element, key, value) {
  if (key.startsWith('on')) {
    // 事件监听
    const eventName = key.substring(2).toLowerCase();
    element.addEventListener(eventName, value);
  } else if (key === 'className') {
    element.setAttribute('class', value);
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(element.style, value);
  } else {
    element.setAttribute(key, value);
  }
}

// 3. Diff和Patch
function diff(oldVNode, newVNode) {
  // 节点被删除
  if (newVNode === undefined) {
    return { type: 'REMOVE' };
  }

  // 文本节点
  if (typeof oldVNode === 'string' || typeof newVNode === 'string') {
    if (oldVNode !== newVNode) {
      return { type: 'TEXT', text: newVNode };
    }
    return null;
  }

  // 节点类型改变
  if (oldVNode.type !== newVNode.type) {
    return { type: 'REPLACE', vnode: newVNode };
  }

  // 比较属性
  const propsPatch = diffProps(oldVNode.props, newVNode.props);

  // 比较子节点
  const childrenPatch = diffChildren(oldVNode.children, newVNode.children);

  if (propsPatch || childrenPatch.length > 0) {
    return { type: 'UPDATE', props: propsPatch, children: childrenPatch };
  }

  return null;
}

function diffProps(oldProps, newProps) {
  const patches = {};

  // 找出修改和新增的属性
  for (let key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      patches[key] = newProps[key];
    }
  }

  // 找出删除的属性
  for (let key in oldProps) {
    if (!(key in newProps)) {
      patches[key] = null;
    }
  }

  return Object.keys(patches).length > 0 ? patches : null;
}

function diffChildren(oldChildren, newChildren) {
  const patches = [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLength; i++) {
    patches.push(diff(oldChildren[i], newChildren[i]));
  }

  return patches;
}

// 4. 应用patch
function patch(parent, patch, element, index = 0) {
  if (!patch) return element;

  switch (patch.type) {
    case 'REMOVE':
      parent.removeChild(element);
      return null;

    case 'TEXT':
      if (element.nodeType === Node.TEXT_NODE) {
        element.textContent = patch.text;
        return element;
      } else {
        const textNode = document.createTextNode(patch.text);
        parent.replaceChild(textNode, element);
        return textNode;
      }

    case 'REPLACE':
      const newElement = render(patch.vnode);
      parent.replaceChild(newElement, element);
      return newElement;

    case 'UPDATE':
      // 更新属性
      if (patch.props) {
        for (let [key, value] of Object.entries(patch.props)) {
          if (value === null) {
            element.removeAttribute(key);
          } else {
            setAttribute(element, key, value);
          }
        }
      }

      // 更新子节点
      if (patch.children) {
        patch.children.forEach((childPatch, i) => {
          patch(element, childPatch, element.childNodes[i], i);
        });
      }

      return element;

    default:
      return element;
  }
}

// 5. 完整示例
class Component {
  constructor(props) {
    this.props = props;
    this.state = {};
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.update();
  }

  update() {
    const newVNode = this.render();
    const patches = diff(this.vnode, newVNode);
    this.element = patch(this.parent, patches, this.element);
    this.vnode = newVNode;
  }

  mount(parent) {
    this.parent = parent;
    this.vnode = this.render();
    this.element = render(this.vnode);
    parent.appendChild(this.element);
  }

  render() {
    throw new Error('render() must be implemented');
  }
}

// 使用
class Counter extends Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  render() {
    return h('div', null,
      h('h1', null, `Count: ${this.state.count}`),
      h('button', {
        onClick: () => this.setState({ count: this.state.count + 1 })
      }, 'Increment')
    );
  }
}

const counter = new Counter();
counter.mount(document.getElementById('root'));
```

### React Fiber的虚拟DOM

```javascript
// React Fiber中的虚拟DOM节点
interface Fiber {
  // 节点类型
  tag: WorkTag;  // FunctionComponent | ClassComponent | HostComponent等
  type: any;     // 函数/类/字符串

  // Fiber关系
  return: Fiber | null;   // 父节点
  child: Fiber | null;    // 第一个子节点
  sibling: Fiber | null;  // 兄弟节点

  // 数据
  pendingProps: any;      // 新props
  memoizedProps: any;     // 旧props
  memoizedState: any;     // 旧state
  updateQueue: any;       // 更新队列

  // 副作用
  effectTag: SideEffectTag;  // Placement | Update | Deletion等
  nextEffect: Fiber | null;   // 下一个有副作用的节点

  // 双缓存
  alternate: Fiber | null;    // 指向另一棵树的对应节点

  // 优先级
  lanes: Lanes;            // 当前优先级
  childLanes: Lanes;       // 子树优先级
}

// Fiber双缓存机制
// current树：当前显示的Fiber树
// workInProgress树：正在构建的Fiber树

function reconcileChildren(current, workInProgress, nextChildren) {
  if (current === null) {
    // 初次渲染
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren);
  } else {
    // 更新
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    );
  }
}

// 提交阶段：将workInProgress树切换为current树
function commitRoot(root) {
  // 1. before mutation: 执行getSnapshotBeforeUpdate
  commitBeforeMutationEffects(root);

  // 2. mutation: 操作DOM
  commitMutationEffects(root);

  // 3. layout: 执行componentDidMount/Update
  root.current = finishedWork;  // 切换树
  commitLayoutEffects(root);
}
```

这些内容展示了React内部的深层运作机制，是高级前端工程师必须掌握的知识！

