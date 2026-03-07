# React 核心原理 - 面试准备

> **适用场景**: 高级前端 / 全栈工程师面试
> **关联项目**: QPON应用（React + TypeScript）、AI内容平台（Next.js/React）
> **重要程度**: ⭐⭐⭐⭐⭐ 6年React经验必问

---

## 📋 快速索引

| 主题 | 重要度 | 面试频率 |
|------|--------|----------|
| Fiber 架构 | ⭐⭐⭐⭐⭐ | 高级必问 |
| Hooks 原理 | ⭐⭐⭐⭐⭐ | 必问 |
| 性能优化 | ⭐⭐⭐⭐⭐ | 结合项目问 |
| Virtual DOM & Diff | ⭐⭐⭐⭐ | 常问 |
| Concurrent Mode | ⭐⭐⭐ | 了解即可 |
| 常见坑 | ⭐⭐⭐⭐ | 经验题 |

---

## 🎯 Q1: 说说 React Fiber 架构？为什么需要它？

### 背景问题

React 15 的 **Stack Reconciler** 是递归同步执行的：
- 一旦开始 diff，必须一次性完成整棵树
- 大组件树更新时，主线程被阻塞，可能超过 16ms（掉帧）
- 用户交互（点击、输入）得不到响应

### Fiber 解决方案

Fiber 是 React 16 引入的新架构，核心思想是**可中断的异步渲染**：

| 特性 | Stack Reconciler | Fiber Reconciler |
|------|------------------|------------------|
| 执行方式 | 递归，同步 | 链表，可中断 |
| 数据结构 | 函数调用栈 | Fiber 节点链表 |
| 优先级 | 无 | 有（lane 模型） |
| 中断恢复 | 不支持 | 支持 |

### 标准回答

> "Fiber 是 React 16 引入的新协调引擎，解决了老架构同步渲染阻塞主线程的问题。
>
> **核心变化有三个**：
>
> **1. 数据结构改变**
> - 每个组件对应一个 Fiber 节点
> - Fiber 节点通过 `child`、`sibling`、`return` 形成链表
> - 遍历方式从递归变成循环，可以随时中断保存进度
>
> **2. 两阶段渲染**
> - **Render 阶段**（可中断）：构建 Fiber 树，计算 diff，标记变更
> - **Commit 阶段**（不可中断）：把变更应用到 DOM
>
> **3. 优先级调度**
> - 用户交互（点击）> 动画 > 数据更新
> - 高优先级任务可以打断低优先级任务
> - 通过 `requestIdleCallback`（现在用 Scheduler）调度
>
> **实际效果**：大列表更新时，用户点击按钮能立即响应，不会有卡顿感。"

### 追问：Fiber 节点长什么样？

> "Fiber 节点是个普通 JS 对象，关键属性有：
>
> ```javascript
> {
>   // 静态结构
>   tag: 1,              // 组件类型（函数组件、类组件、原生DOM等）
>   type: 'div',         // 元素类型
>   key: null,
>
>   // 链表结构
>   child: Fiber,        // 第一个子节点
>   sibling: Fiber,      // 下一个兄弟节点
>   return: Fiber,       // 父节点
>
>   // 状态
>   memoizedState: {},   // Hooks 链表（函数组件）
>   memoizedProps: {},   // 上次渲染的 props
>
>   // 副作用
>   flags: Update,       // 需要执行的操作（插入/更新/删除）
>   nextEffect: Fiber,   // 下一个有副作用的节点
> }
> ```"

### 追问：时间切片是怎么实现的？

> "React 把渲染工作拆成小单元（每个 Fiber 节点），用 `shouldYield()` 检查是否要让出主线程：
>
> ```javascript
> function workLoop() {
>   while (workInProgress !== null && !shouldYield()) {
>     workInProgress = performUnitOfWork(workInProgress);
>   }
> }
> ```
>
> `shouldYield()` 检查当前帧是否还有剩余时间（默认 5ms），没有就暂停，把控制权还给浏览器处理用户交互，下一帧继续。"

---

## 🎯 Q2: Hooks 的实现原理？为什么不能在条件语句中使用？

### 核心原理

Hooks 本质是**链表**，挂在 Fiber 节点的 `memoizedState` 上：

```javascript
// 组件内部调用
const [count, setCount] = useState(0);
const [name, setName] = useState('');

// Fiber 节点内部结构
fiber.memoizedState = {
  memoizedState: 0,        // useState(0) 的值
  next: {
    memoizedState: '',     // useState('') 的值
    next: null
  }
}
```

### 标准回答

> "Hooks 实现原理是**链表 + 顺序依赖**。
>
> **Mount 阶段**（首次渲染）：
> - 每调用一个 Hook，创建一个 Hook 节点
> - 节点按调用顺序串成链表
> - 挂在 Fiber 的 `memoizedState` 上
>
> **Update 阶段**（更新渲染）：
> - 按**同样的顺序**遍历链表
> - 取出对应位置的状态
>
> **为什么不能在条件语句中用？**
>
> ```javascript
> // ❌ 错误示例
> if (condition) {
>   const [a, setA] = useState(1);  // 条件为 false 时不执行
> }
> const [b, setB] = useState(2);
>
> // 第一次渲染：链表是 [a, b]
> // 第二次渲染（condition=false）：代码只调用了一个 useState
> // React 按顺序取第一个节点，但期望的是 b，导致错乱
> ```
>
> 所以 Hooks 有个铁律：**每次渲染，Hooks 的调用顺序必须完全一致**。"

### 追问：useState 和 useReducer 的区别？

> "底层实现几乎一样，useState 就是 useReducer 的语法糖：
>
> ```javascript
> // useState 内部实现
> function useState(initialState) {
>   return useReducer(
>     (state, action) => typeof action === 'function' ? action(state) : action,
>     initialState
>   );
> }
> ```
>
> 选择原则：
> - 简单状态用 `useState`
> - 复杂状态逻辑（多个子值、依赖前一个状态）用 `useReducer`"

---

## 🎯 Q3: useEffect 和 useLayoutEffect 的区别？

### 执行时机对比

| Hook | 执行时机 | 是否阻塞渲染 | 适用场景 |
|------|----------|--------------|----------|
| `useEffect` | DOM 更新后，浏览器绘制**后**异步执行 | 否 | 数据获取、订阅、日志 |
| `useLayoutEffect` | DOM 更新后，浏览器绘制**前**同步执行 | 是 | 测量 DOM、同步修改样式 |

### 标准回答

> "两者的区别在于**执行时机**：
>
> **useEffect**：
> - 在浏览器完成绘制**之后**异步执行
> - 不阻塞视觉更新，用户先看到 UI 变化
> - 99% 的场景用这个
>
> **useLayoutEffect**：
> - 在 DOM 变更**之后**、浏览器绘制**之前**同步执行
> - 会阻塞渲染，但能避免闪烁
>
> **什么时候用 useLayoutEffect？**
> - 需要**读取 DOM 布局**并**同步修改**的场景
> - 比如：测量元素尺寸后调整位置、Tooltip 定位
>
> ```javascript
> // 场景：根据内容高度决定展开/收起
> useLayoutEffect(() => {
>   const height = ref.current.scrollHeight;
>   if (height > 100) {
>     setShowMore(true);  // 同步设置，避免闪烁
>   }
> }, [content]);
> ```
>
> 我在 QPON 项目的**瀑布流布局**中用过，需要测量每个卡片高度后重新排列，用 useLayoutEffect 避免先看到错位再跳到正确位置。"

---

## 🎯 Q4: useMemo 和 useCallback 的区别？什么时候用？

### 核心区别

| Hook | 缓存的是 | 返回值 |
|------|----------|--------|
| `useMemo` | **计算结果** | 任意值 |
| `useCallback` | **函数引用** | 函数 |

```javascript
// useMemo：缓存计算结果
const expensiveValue = useMemo(() => computeExpensive(a, b), [a, b]);

// useCallback：缓存函数引用
const handleClick = useCallback(() => { doSomething(a, b) }, [a, b]);

// useCallback 等价于
const handleClick = useMemo(() => () => { doSomething(a, b) }, [a, b]);
```

### 标准回答

> "两者都是用来优化性能的，但**不要滥用**。
>
> **useMemo 使用场景**：
> 1. **计算量大**的派生状态（大数组过滤、排序）
> 2. **引用稳定性**（作为其他 Hook 的依赖）
>
> ```javascript
> // ✅ 好的用法：大列表过滤
> const filteredList = useMemo(
>   () => bigList.filter(item => item.name.includes(keyword)),
>   [bigList, keyword]
> );
> ```
>
> **useCallback 使用场景**：
> 1. 传给 **memo 包裹的子组件**的回调函数
> 2. 作为 **useEffect 的依赖**
>
> ```javascript
> // ✅ 好的用法：配合 memo
> const Child = memo(({ onClick }) => <button onClick={onClick}>Click</button>);
>
> function Parent() {
>   const handleClick = useCallback(() => {
>     console.log('clicked');
>   }, []);
>
>   return <Child onClick={handleClick} />;
> }
> ```
>
> **不要滥用的原因**：
> - 本身有开销（创建闭包、比较依赖）
> - 简单计算直接算比缓存快
> - 我的原则：**先写正常代码，遇到性能问题再优化**"

### 追问：React.memo 和 useMemo 的区别？

> "完全不同的东西：
>
> - `React.memo`：**高阶组件**，对组件的 props 做浅比较，props 不变就跳过渲染
> - `useMemo`：**Hook**，缓存组件内部的计算结果
>
> ```javascript
> // React.memo：缓存组件
> const MemoizedChild = React.memo(Child);
>
> // useMemo：缓存值
> const value = useMemo(() => compute(), [deps]);
> ```"

---

## 🎯 Q5: Virtual DOM 和 Diff 算法是怎么工作的？

### 标准回答

> "Virtual DOM 是用 **JS 对象描述 DOM 结构**，Diff 算法比较新旧两棵树找出变化。
>
> **为什么要 Virtual DOM？**
> - 直接操作 DOM 很慢（触发重排重绘）
> - 批量计算变化，最小化 DOM 操作
>
> **Diff 算法的三个假设（优化策略）**：
>
> **1. 同层比较**
> - 只比较同一层级的节点
> - 跨层级移动视为删除 + 新建
> - 复杂度从 O(n³) 降到 O(n)
>
> **2. 类型不同直接替换**
> - `<div>` 变成 `<span>`，直接销毁重建
> - 不会尝试复用子节点
>
> **3. key 标识节点**
> - 列表渲染时，用 key 识别节点身份
> - 没有 key 就按顺序比较（容易出错）
>
> **Diff 过程（简化）**：
> ```javascript
> function diff(oldNode, newNode) {
>   // 1. 类型不同，直接替换
>   if (oldNode.type !== newNode.type) {
>     return { type: 'REPLACE', node: newNode };
>   }
>
>   // 2. 都是文本节点，比较内容
>   if (typeof newNode === 'string') {
>     return oldNode !== newNode ? { type: 'TEXT', text: newNode } : null;
>   }
>
>   // 3. 同类型元素，比较 props
>   const propsDiff = diffProps(oldNode.props, newNode.props);
>
>   // 4. 递归比较子节点
>   const childrenDiff = diffChildren(oldNode.children, newNode.children);
>
>   return { propsDiff, childrenDiff };
> }
> ```"

### 追问：为什么不建议用 index 作为 key？

> "用 index 作为 key，在列表**增删**时会导致错误复用：
>
> ```javascript
> // 原列表：[A, B, C]，key 是 [0, 1, 2]
> // 删除 A 后：[B, C]，key 变成 [0, 1]
>
> // React 比较：
> // key=0: A → B（props 变了，更新）
> // key=1: B → C（props 变了，更新）
> // key=2: C → 无（删除）
>
> // 实际上只删了 A，但 React 更新了 B 和 C，还删除了 C
> ```
>
> **应该用什么？**
> - 后端返回的唯一 ID
> - 如果没有 ID，用内容生成稳定的 hash
> - 只有**纯展示、不会增删**的列表才能用 index"

---

## 🎯 Q6: React 18 的 Concurrent Mode 是什么？

### 标准回答

> "Concurrent Mode 是 React 18 正式发布的**并发渲染能力**，让渲染可以被中断和恢复。
>
> **核心特性**：
>
> **1. startTransition**
> - 标记低优先级更新，不阻塞用户输入
>
> ```javascript
> import { startTransition } from 'react';
>
> function handleSearch(input) {
>   // 高优先级：立即更新输入框
>   setInput(input);
>
>   // 低优先级：搜索结果可以延后
>   startTransition(() => {
>     setSearchResults(search(input));
>   });
> }
> ```
>
> **2. useDeferredValue**
> - 延迟更新某个值，类似防抖但更智能
>
> ```javascript
> const deferredQuery = useDeferredValue(query);
> // query 立即更新，deferredQuery 延迟更新
> // 当 query 和 deferredQuery 不同时，可以显示 loading
> ```
>
> **3. Suspense 增强**
> - 配合 Server Components 实现流式渲染
> - 数据获取时显示 fallback
>
> **我的项目应用**：
> - AI 搜索输入框用 `startTransition` 包裹搜索请求
> - 用户快速输入时，搜索结果延后渲染，输入框保持流畅"

---

## 🎯 Q7: 常见的闭包陷阱？怎么解决？

### 经典场景

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // 永远是 0
      setCount(count + 1); // 永远设置成 1
    }, 1000);
    return () => clearInterval(timer);
  }, []);  // 依赖数组为空

  return <div>{count}</div>;
}
```

### 标准回答

> "这是 React Hooks 最经典的坑——**闭包陷阱**。
>
> **原因**：
> - `useEffect` 的回调在 mount 时创建，捕获了当时的 `count`（0）
> - 依赖数组是 `[]`，不会重新创建回调
> - 定时器里的 `count` 永远是初始值
>
> **解决方案**：
>
> **方案1：函数式更新**
> ```javascript
> setCount(prev => prev + 1);  // 不依赖外部 count
> ```
>
> **方案2：添加依赖**
> ```javascript
> useEffect(() => {
>   const timer = setInterval(() => {
>     setCount(count + 1);
>   }, 1000);
>   return () => clearInterval(timer);
> }, [count]);  // count 变化时重新创建定时器
> ```
>
> **方案3：useRef 存最新值**
> ```javascript
> const countRef = useRef(count);
> countRef.current = count;  // 每次渲染更新 ref
>
> useEffect(() => {
>   const timer = setInterval(() => {
>     setCount(countRef.current + 1);
>   }, 1000);
>   return () => clearInterval(timer);
> }, []);
> ```
>
> **我的原则**：
> - 优先用**函数式更新**，最简单
> - 需要读取最新值但不想重建回调，用 **useRef**"

### 追问：useEffect 的清理函数什么时候执行？

> "清理函数在两种情况下执行：
> 1. **组件卸载时**
> 2. **下一次 effect 执行前**（依赖变化时）
>
> ```javascript
> useEffect(() => {
>   console.log('effect', count);
>   return () => console.log('cleanup', count);
> }, [count]);
>
> // count: 0 → 1 时
> // 输出：cleanup 0 → effect 1
> ```
>
> 这就是为什么 `setInterval` 要在清理函数里 `clearInterval`，否则会有多个定时器同时运行。"

---

## 🎯 Q8: React 性能优化有哪些手段？

### 标准回答

> "结合我在 QPON 项目的实践，性能优化分几个层面：
>
> **1. 减少不必要的渲染**
> - `React.memo` 包裹纯展示组件
> - `useMemo` 缓存复杂计算
> - `useCallback` 稳定回调引用
>
> **2. 减少渲染量**
> - **虚拟列表**：长列表只渲染可视区域（react-window）
> - **懒加载**：`React.lazy` + `Suspense` 按需加载组件
> - **分页/无限滚动**：不要一次渲染太多数据
>
> **3. 优化 Context**
> - 拆分 Context，避免无关组件重渲染
> - 用 `useMemo` 包裹 Provider 的 value
>
> ```javascript
> // ❌ 每次渲染都创建新对象
> <Context.Provider value={{ user, setUser }}>
>
> // ✅ 稳定引用
> const value = useMemo(() => ({ user, setUser }), [user]);
> <Context.Provider value={value}>
> ```
>
> **4. 代码层面**
> - 避免在 render 中创建新对象/函数
> - 列表 key 使用稳定 ID
> - 避免过深的组件嵌套
>
> **我的实际案例**：
> - QPON 首页有 200+ 个 POI 卡片，用 `react-window` 虚拟化后，渲染时间从 800ms 降到 50ms
> - 搜索输入框用 `useDeferredValue`，输入时不卡顿"

---

## 🎯 Q9: 状态管理方案怎么选？

### 标准回答

> "现在状态管理方案很多，选型原则是**够用就好**：
>
> | 方案 | 适用场景 | 复杂度 |
> |------|----------|--------|
> | `useState` + `useContext` | 简单全局状态 | 低 |
> | `useReducer` + `useContext` | 复杂状态逻辑 | 中 |
> | **Zustand** | 中型应用，简洁 | 低 |
> | **Redux Toolkit** | 大型应用，需要中间件 | 中高 |
> | **Jotai/Recoil** | 细粒度原子状态 | 中 |
>
> **我的项目选择**：
> - **QPON 应用**：Redux Toolkit，因为团队熟悉，中间件生态好
> - **AI 内容平台**：Zustand，个人项目追求简洁
>
> ```javascript
> // Zustand 示例
> const useStore = create((set) => ({
>   count: 0,
>   increment: () => set((state) => ({ count: state.count + 1 })),
> }));
>
> // 使用
> function Counter() {
>   const { count, increment } = useStore();
>   return <button onClick={increment}>{count}</button>;
> }
> ```
>
> **为什么喜欢 Zustand？**
> - 不需要 Provider 包裹
> - 支持 selector 细粒度订阅
> - 体积小（1KB），学习成本低"

---

## 💡 常见追问

### Q: Class 组件和函数组件有什么区别？

> "现在基本都用函数组件了，区别主要是：
> - 函数组件更**简洁**，Hooks 比生命周期更灵活
> - 函数组件**闭包捕获**当时的 props/state，Class 组件是 `this` 引用
> - Class 组件的 `this` 问题容易出错
>
> 我已经 2 年没写过 Class 组件了，但能看懂和维护。"

### Q: React 和 Vue 的区别？

> "核心设计理念不同：
> - **React**：函数式，UI = f(state)，手动优化
> - **Vue**：响应式，自动追踪依赖，自动优化
>
> React 给你更多控制权，但需要自己处理优化；Vue 更'智能'，但黑盒更多。
>
> 我更熟悉 React，因为它的心智模型更简单（就是函数），调试更透明。"

---

## 📝 面试模拟题

1. "Hooks 为什么不能写在条件语句里？"
2. "useState 的更新是同步还是异步的？"
3. "如何避免 useEffect 的无限循环？"
4. "React.memo 和 PureComponent 有什么区别？"
5. "说说 Fiber 架构的双缓冲机制"
6. "useRef 和 useState 有什么区别？什么时候用 useRef？"

---

**文档生成时间**: 2026-03-06
