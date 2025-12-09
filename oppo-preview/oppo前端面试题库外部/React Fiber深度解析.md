# React Fiber深度解析

## 1. Fiber的本质

### 什么是Fiber

```javascript
// Fiber是什么？
// 1. 一种数据结构（链表）
// 2. 一种工作单元（Unit of Work）
// 3. React 16的核心架构重写

// 为什么需要Fiber？
// React 15的问题：
// - 递归遍历虚拟DOM树（Stack Reconciler）
// - 无法中断，一旦开始必须完成
// - 大组件树会导致主线程长时间阻塞
// - 用户交互卡顿，动画掉帧

// 示例：React 15的问题
function heavyComponent() {
  // 假设这个组件很复杂
  const list = new Array(10000).fill(0).map((_, i) => <Item key={i} />);
  return <div>{list}</div>;
}

// React 15：
// 1. 开始递归遍历（16ms）
// 2. 创建10000个虚拟DOM节点（200ms）
// 3. 对比差异（100ms）
// 4. 提交DOM更新（50ms）
// 总计：366ms，期间主线程完全阻塞
// 结果：22帧被跳过，用户感觉卡顿

// Fiber的解决方案：
// 1. 将渲染工作分片（Time Slicing）
// 2. 可以暂停、继续、放弃
// 3. 为不同类型的工作分配优先级
// 4. 重用之前完成的工作

// Fiber架构：
/*
React 15 (Stack Reconciler)
├── Reconciler (协调器) - 找出变化的组件
└── Renderer (渲染器) - 将变化的组件渲染到页面

React 16+ (Fiber Reconciler)
├── Scheduler (调度器) - 调度任务优先级
├── Reconciler (协调器) - 找出变化的组件（可中断）
└── Renderer (渲染器) - 将变化的组件渲染到页面
*/
```

### Fiber数据结构

```javascript
// Fiber节点的数据结构
type Fiber = {
  // === 基础信息 ===
  tag: WorkTag;              // 标记不同的组件类型（函数组件、类组件等）
  key: null | string;        // key
  type: any;                 // 对应的组件类型（div、span、class、function）

  // === DOM实例 ===
  stateNode: any;            // 真实DOM节点

  // === Fiber树结构 ===
  return: Fiber | null;      // 父Fiber（指向父节点）
  child: Fiber | null;       // 第一个子Fiber
  sibling: Fiber | null;     // 下一个兄弟Fiber
  index: number;             // 在父Fiber中的索引

  // === 状态和副作用 ===
  pendingProps: any;         // 新的props
  memoizedProps: any;        // 上一次渲染的props
  memoizedState: any;        // 上一次渲染的state
  updateQueue: UpdateQueue;  // 更新队列

  // === 副作用 ===
  flags: Flags;              // 副作用标记（增、删、改）
  subtreeFlags: Flags;       // 子树的副作用标记
  deletions: Array<Fiber>;   // 要删除的子Fiber
  nextEffect: Fiber | null;  // 下一个有副作用的Fiber

  // === 优先级调度 ===
  lanes: Lanes;              // 优先级（越小优先级越高）
  childLanes: Lanes;         // 子树的优先级

  // === 双缓存 ===
  alternate: Fiber | null;   // 指向另一棵Fiber树中的对应节点
};

// WorkTag类型
const FunctionComponent = 0;        // 函数组件
const ClassComponent = 1;           // 类组件
const IndeterminateComponent = 2;   // 不确定的组件类型
const HostRoot = 3;                 // 根节点（ReactDOM.render）
const HostComponent = 5;            // 原生DOM组件（div、span等）
const HostText = 6;                 // 文本节点

// Flags（副作用标记）
const NoFlags = 0b00000000000000000000000;
const PerformedWork = 0b00000000000000000000001;
const Placement = 0b00000000000000000000010;    // 插入
const Update = 0b00000000000000000000100;       // 更新
const Deletion = 0b00000000000000000001000;     // 删除

// 示例：一个简单的Fiber树
/*
<div id="root">
  <h1>Title</h1>
  <p>Content</p>
</div>

对应的Fiber树：
        HostRoot (root)
             |
        HostComponent (div)
             |
        HostComponent (h1) → HostComponent (p)
             |                    |
        HostText ("Title")   HostText ("Content")

链表结构：
- return: 指向父节点（向上）
- child: 指向第一个子节点（向下）
- sibling: 指向下一个兄弟节点（向右）
*/
```

## 2. Fiber工作原理

### Fiber的工作循环

```javascript
// Fiber的工作循环（Work Loop）

// 入口函数
function performConcurrentWorkOnRoot(root) {
  // 1. 获取任务优先级
  const lanes = getNextLanes(root);

  if (lanes === NoLanes) {
    return null;
  }

  // 2. 执行render阶段（可中断）
  const shouldTimeSlice = !includesBlockingLane(root, lanes);

  let exitStatus;
  if (shouldTimeSlice) {
    // 可中断的并发渲染
    exitStatus = renderRootConcurrent(root, lanes);
  } else {
    // 不可中断的同步渲染
    exitStatus = renderRootSync(root, lanes);
  }

  // 3. 执行commit阶段（不可中断）
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    commitRoot(root);
  }
}

// Render阶段：构建Fiber树（可中断）
function renderRootConcurrent(root, lanes) {
  // 准备工作
  prepareFreshStack(root, lanes);

  // 工作循环
  do {
    try {
      workLoopConcurrent();
      break;
    } catch (error) {
      handleError(root, error);
    }
  } while (true);

  return workInProgressRootExitStatus;
}

// 可中断的工作循环
function workLoopConcurrent() {
  // Scheduler让出执行权时，停止工作循环
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

// 同步的工作循环（不可中断）
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 执行单元工作
function performUnitOfWork(unitOfWork) {
  // 1. 获取旧的Fiber节点
  const current = unitOfWork.alternate;

  // 2. 开始工作（beginWork）
  let next = beginWork(current, unitOfWork, subtreeRenderLanes);

  // 3. 完成props赋值
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // 4. 如果没有子节点，完成工作（completeWork）
    completeUnitOfWork(unitOfWork);
  } else {
    // 5. 如果有子节点，继续处理子节点
    workInProgress = next;
  }
}

// beginWork：处理当前Fiber节点
function beginWork(current, workInProgress, renderLanes) {
  // 根据tag类型，调用不同的处理函数
  switch (workInProgress.tag) {
    case FunctionComponent:
      return updateFunctionComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      );
    case ClassComponent:
      return updateClassComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      );
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
    // ... 其他类型
  }
}

// completeWork：完成当前Fiber节点
function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;

  do {
    // 1. 完成当前节点
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    completeWork(current, completedWork, subtreeRenderLanes);

    // 2. 收集副作用
    if (returnFiber !== null) {
      // 将子节点的副作用链接到父节点
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = completedWork.firstEffect;
      }

      if (completedWork.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
        }
        returnFiber.lastEffect = completedWork.lastEffect;
      }

      // 如果当前节点有副作用，也加入链表
      if (completedWork.flags > PerformedWork) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = completedWork;
        } else {
          returnFiber.firstEffect = completedWork;
        }
        returnFiber.lastEffect = completedWork;
      }
    }

    // 3. 处理兄弟节点
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    // 4. 如果没有兄弟节点，返回父节点
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
```

### Fiber遍历过程

```javascript
// Fiber树的遍历过程（深度优先遍历）

// 示例组件树
function App() {
  return (
    <div>
      <Header />
      <Content>
        <Article />
        <Sidebar />
      </Content>
      <Footer />
    </div>
  );
}

// 对应的Fiber树结构
/*
         App
          |
         div
          |
      Header → Content → Footer
                  |
            Article → Sidebar
*/

// 遍历顺序（深度优先）：
// 1. App (beginWork)
// 2. div (beginWork)
// 3. Header (beginWork)
// 4. Header (completeWork) - 无子节点
// 5. Content (beginWork)
// 6. Article (beginWork)
// 7. Article (completeWork) - 无子节点
// 8. Sidebar (beginWork)
// 9. Sidebar (completeWork) - 无子节点
// 10. Content (completeWork) - 所有子节点完成
// 11. Footer (beginWork)
// 12. Footer (completeWork) - 无子节点
// 13. div (completeWork) - 所有子节点完成
// 14. App (completeWork) - 所有子节点完成

// 代码实现
function traverseFiber(fiber) {
  console.log('Begin:', fiber.type);

  // 1. 处理子节点
  let child = fiber.child;
  while (child !== null) {
    traverseFiber(child);
    child = child.sibling;
  }

  // 2. 完成当前节点
  console.log('Complete:', fiber.type);
}

// 实际的遍历（使用循环而非递归）
function workLoop() {
  let fiber = rootFiber;

  while (fiber !== null) {
    // 1. beginWork
    const next = beginWork(fiber);

    if (next !== null) {
      // 有子节点，继续向下
      fiber = next;
    } else {
      // 无子节点，开始completeWork
      while (fiber !== null) {
        completeWork(fiber);

        if (fiber.sibling !== null) {
          // 有兄弟节点，处理兄弟节点
          fiber = fiber.sibling;
          break;
        }

        // 无兄弟节点，返回父节点
        fiber = fiber.return;
      }
    }
  }
}
```

## 3. 双缓存机制

### 什么是双缓存

```javascript
// 双缓存（Double Buffering）
// React使用两棵Fiber树：
// 1. current树：当前屏幕上显示的内容
// 2. workInProgress树：正在内存中构建的树

// 工作流程：
// 1. 首次渲染：构建workInProgress树
// 2. 完成后：workInProgress树变成current树
// 3. 更新时：基于current树创建新的workInProgress树
// 4. 完成后：新的workInProgress树变成current树

// 数据结构
class FiberRootNode {
  constructor() {
    this.current = null;        // 指向current Fiber树的根节点
    this.finishedWork = null;   // 已完成的workInProgress树
  }
}

class FiberNode {
  constructor() {
    this.alternate = null;  // 指向另一棵树中的对应节点
  }
}

// 初始化
function createFiberRoot(containerInfo) {
  // 1. 创建FiberRootNode
  const root = new FiberRootNode();

  // 2. 创建HostRootFiber（current树的根）
  const uninitializedFiber = createHostRootFiber();
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  return root;
}

// 首次渲染
function performConcurrentWorkOnRoot(root) {
  // 1. 创建workInProgress树
  const current = root.current;
  const workInProgress = createWorkInProgress(current, null);

  // 2. 构建workInProgress树
  renderRoot(root, workInProgress);

  // 3. 切换指针（workInProgress → current）
  root.finishedWork = workInProgress;
  commitRoot(root);
}

function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 首次渲染，创建新的Fiber节点
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    );

    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    // 建立双向连接
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 更新渲染，复用现有节点
    workInProgress.pendingProps = pendingProps;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // 复制其他属性
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  return workInProgress;
}

// 提交阶段：切换current树
function commitRoot(root) {
  const finishedWork = root.finishedWork;

  // 执行DOM操作
  commitMutationEffects(finishedWork);

  // 切换指针：workInProgress树 → current树
  root.current = finishedWork;

  // 执行生命周期和副作用
  commitLayoutEffects(finishedWork);
}

// 示例：更新过程
/*
初始状态：
FiberRootNode
  ├── current → Fiber(App)

首次渲染：
FiberRootNode
  ├── current → Fiber(App)
  └── finishedWork → Fiber'(App) [workInProgress]

Fiber(App) ←→ Fiber'(App)  (alternate双向连接)

渲染完成后：
FiberRootNode
  ├── current → Fiber'(App)  [切换了]

Fiber(App) ←→ Fiber'(App)

更新时：
FiberRootNode
  ├── current → Fiber'(App)
  └── finishedWork → Fiber(App) [新的workInProgress]

复用了旧的Fiber(App)节点
*/
```

### 双缓存的优势

```javascript
// 双缓存的优势

// 1. 内存复用
// 不需要每次都创建新的Fiber节点
function updateComponent() {
  // 复用现有的Fiber节点
  const workInProgress = current.alternate || createFiber();

  // 只更新变化的部分
  workInProgress.pendingProps = newProps;

  return workInProgress;
}

// 2. 回滚能力
// 如果更新过程出错，可以放弃workInProgress树，保持current树不变
function renderRootConcurrent(root) {
  try {
    workLoop();
  } catch (error) {
    // 出错了，放弃workInProgress树
    workInProgress = null;
    // current树保持不变，页面不受影响
    return;
  }

  // 成功了，切换到新树
  root.current = root.finishedWork;
}

// 3. 并发渲染
// workInProgress树可以在后台慢慢构建
// current树继续服务用户交互
function concurrentUpdate() {
  // 用户交互：基于current树
  handleUserInput(root.current);

  // 后台更新：构建workInProgress树
  buildWorkInProgressTree();

  // 完成后再切换
  if (isCompleted) {
    root.current = workInProgress;
  }
}

// 4. 时间切片
// 可以中断workInProgress树的构建，不影响current树
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }

  // 时间片用完，暂停
  // current树依然在页面上显示
}
```

## 4. 优先级调度

### Lane模型

```javascript
// React 17+使用Lane模型表示优先级
// Lane是一个31位的二进制数，每一位代表一个优先级

// Lane定义
const NoLanes = 0b0000000000000000000000000000000;
const NoLane = 0b0000000000000000000000000000000;

const SyncLane = 0b0000000000000000000000000000001;  // 同步优先级（最高）

const InputContinuousLane = 0b0000000000000000000000000000100;  // 连续输入
const DefaultLane = 0b0000000000000000000000000010000;          // 默认优先级
const TransitionLanes = 0b0000000001111111111111111000000;      // 过渡优先级

const IdleLane = 0b0100000000000000000000000000000;            // 空闲优先级（最低）

// 优先级分类
const SyncLanePriority = 17;        // 同步（用户交互）
const InputContinuousPriority = 10; // 连续输入（滚动）
const DefaultPriority = 8;          // 默认
const TransitionPriority = 6;       // 过渡
const IdlePriority = 2;             // 空闲

// 计算优先级
function getHighestPriorityLane(lanes) {
  // 找到最右边的1（最高优先级）
  return lanes & -lanes;
}

// 示例
const lanes1 = 0b0000000000000000000000000010101;
const highestLane = getHighestPriority(lanes1);
// highestLane = 0b0000000000000000000000000000001 (SyncLane)

// 合并优先级
function mergeLanes(a, b) {
  return a | b;
}

// 移除优先级
function removeLanes(set, subset) {
  return set & ~subset;
}

// 检查是否包含优先级
function includesLane(set, lane) {
  return (set & lane) !== NoLanes;
}
```

### 优先级调度流程

```javascript
// 调度器（Scheduler）根据优先级调度任务

// 1. 创建更新
function createUpdate(lane) {
  return {
    lane,           // 优先级
    tag: UpdateState,
    payload: null,
    callback: null,
    next: null
  };
}

// 2. 标记更新
function markUpdateLaneFromFiberToRoot(fiber, lane) {
  // 标记当前Fiber的lanes
  fiber.lanes = mergeLanes(fiber.lanes, lane);

  // 向上标记所有父Fiber的childLanes
  let parent = fiber.return;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    parent = parent.return;
  }
}

// 3. 调度更新
function scheduleUpdateOnFiber(fiber, lane) {
  // 标记更新
  markUpdateLaneFromFiberToRoot(fiber, lane);

  // 根据优先级选择调度方式
  if (lane === SyncLane) {
    // 同步更新：立即执行
    performSyncWorkOnRoot(root);
  } else {
    // 异步更新：调度到Scheduler
    ensureRootIsScheduled(root);
  }
}

// 4. 确保根节点被调度
function ensureRootIsScheduled(root) {
  // 获取下一个要处理的lanes
  const nextLanes = getNextLanes(root);

  if (nextLanes === NoLanes) {
    return;
  }

  // 取消之前的调度
  if (root.callbackNode !== null) {
    cancelCallback(root.callbackNode);
  }

  // 根据lanes计算优先级
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // 调度新任务
  if (newCallbackPriority === SyncLane) {
    // 同步优先级
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    // 异步优先级
    const schedulerPriorityLevel = lanesToSchedulerPriority(newCallbackPriority);

    root.callbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
}

// 5. Scheduler调度
import { scheduleCallback, ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority, IdlePriority } from 'scheduler';

function lanesToSchedulerPriority(lanes) {
  const lane = getHighestPriorityLane(lanes);

  if (lane === SyncLane) {
    return ImmediatePriority;
  }
  if (includesLane(lane, InputContinuousLane)) {
    return UserBlockingPriority;
  }
  if (includesLane(lane, DefaultLane)) {
    return NormalPriority;
  }
  if (includesLane(lane, TransitionLanes)) {
    return LowPriority;
  }
  return IdlePriority;
}

// 示例：不同优先级的更新
function App() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  // 用户点击：SyncLane（最高优先级）
  const handleClick = () => {
    setCount(count + 1);  // 立即更新
  };

  // 用户输入：InputContinuousLane
  const handleInput = (e) => {
    setText(e.target.value);  // 高优先级
  };

  // 数据获取：DefaultLane
  useEffect(() => {
    fetch('/api/data').then(data => {
      setCount(data.count);  // 默认优先级
    });
  }, []);

  // Transition更新：TransitionLane
  const [isPending, startTransition] = useTransition();

  const handleHeavyUpdate = () => {
    startTransition(() => {
      // 低优先级更新，不阻塞用户交互
      setHeavyData(compute());
    });
  };

  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
      <input onChange={handleInput} value={text} />
      <button onClick={handleHeavyUpdate}>Heavy Update</button>
    </div>
  );
}
```

## 5. 可中断渲染

### 时间切片

```javascript
// 时间切片（Time Slicing）
// React将长任务分割成小任务，在浏览器空闲时执行

// Scheduler的时间切片实现
const frameInterval = 5;  // 5ms一个时间片

let startTime = -1;
let currentTask = null;

function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);  // 获取最高优先级任务

  while (currentTask !== null) {
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      // 时间片用完，暂停
      break;
    }

    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;

      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);

      if (typeof continuationCallback === 'function') {
        // 任务未完成，继续
        currentTask.callback = continuationCallback;
      } else {
        // 任务完成，移除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
    } else {
      pop(taskQueue);
    }

    currentTask = peek(taskQueue);
  }

  // 如果还有任务，继续调度
  if (currentTask !== null) {
    return true;
  }

  return false;
}

function shouldYieldToHost() {
  const currentTime = getCurrentTime();
  return currentTime >= startTime + frameInterval;
}

// React中的应用
function performConcurrentWorkOnRoot(root) {
  const originalCallbackNode = root.callbackNode;

  const exitStatus = renderRootConcurrent(root, lanes);

  if (exitStatus === RootInProgress) {
    // 任务未完成，返回函数供下次继续
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  if (exitStatus === RootCompleted) {
    // 任务完成，提交
    commitRoot(root);
  }

  return null;
}

function renderRootConcurrent(root, lanes) {
  do {
    try {
      workLoopConcurrent();
      break;
    } catch (error) {
      handleError(root, error);
    }
  } while (true);

  if (workInProgress !== null) {
    // 未完成
    return RootInProgress;
  }

  // 完成
  return RootCompleted;
}

function workLoopConcurrent() {
  // 检查是否需要让出执行权
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

### 优先级插队

```javascript
// 高优先级更新可以打断低优先级更新

function ensureRootIsScheduled(root) {
  const nextLanes = getNextLanes(root);
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  const existingCallbackPriority = root.callbackPriority;

  if (newCallbackPriority === existingCallbackPriority) {
    // 优先级相同，复用现有调度
    return;
  }

  // 取消低优先级任务
  if (root.callbackNode !== null) {
    cancelCallback(root.callbackNode);
  }

  // 调度新的高优先级任务
  root.callbackPriority = newCallbackPriority;
  root.callbackNode = scheduleCallback(
    priorityLevel,
    performConcurrentWorkOnRoot.bind(null, root)
  );
}

// 示例：优先级插队
function App() {
  const [count, setCount] = useState(0);
  const [list, setList] = useState([]);

  // 低优先级更新
  const handleHeavyUpdate = () => {
    startTransition(() => {
      const newList = new Array(10000).fill(0).map((_, i) => i);
      setList(newList);  // TransitionLane
    });
  };

  // 高优先级更新
  const handleClick = () => {
    setCount(count + 1);  // SyncLane
    // 会打断低优先级的list更新
  };

  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
      <button onClick={handleHeavyUpdate}>Update List</button>
      {list.map(item => <div key={item}>{item}</div>)}
    </div>
  );
}

// 执行流程：
// 1. 用户点击"Update List" → 开始渲染10000个div（TransitionLane）
// 2. 渲染到第100个时，用户点击"Count" → 高优先级更新（SyncLane）
// 3. 立即停止list渲染，保存进度
// 4. 执行count更新，立即反映到页面
// 5. 继续之前的list渲染（从第100个开始）
```

## 6. Fiber实战案例

### 手写简易Fiber架构

```javascript
// 简化版Fiber实现

class Fiber {
  constructor(type, props) {
    this.type = type;
    this.props = props;
    this.parent = null;
    this.child = null;
    this.sibling = null;
    this.alternate = null;
    this.effectTag = null;  // 'PLACEMENT' | 'UPDATE' | 'DELETION'
    this.dom = null;
  }
}

let workInProgress = null;
let currentRoot = null;
let deletions = [];

// 创建Fiber树
function createFiber(element, parent) {
  const fiber = new Fiber(element.type, element.props);
  fiber.parent = parent;
  return fiber;
}

// Render阶段
function render(element, container) {
  // 创建根Fiber
  workInProgress = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  };

  deletions = [];
  workLoop();
}

function workLoop() {
  while (workInProgress) {
    workInProgress = performUnitOfWork(workInProgress);
  }

  // Commit阶段
  commitRoot();
}

function performUnitOfWork(fiber) {
  // 1. 执行工作
  if (!fiber.dom) {
    fiber.dom = createDOM(fiber);
  }

  // 2. 协调子节点
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  // 3. 返回下一个工作单元
  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

function reconcileChildren(fiber, elements) {
  let index = 0;
  let oldFiber = fiber.alternate?.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // 更新
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: fiber,
        alternate: oldFiber,
        effectTag: 'UPDATE'
      };
    }

    if (element && !sameType) {
      // 新增
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: fiber,
        alternate: null,
        effectTag: 'PLACEMENT'
      };
    }

    if (oldFiber && !sameType) {
      // 删除
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

// Commit阶段
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(workInProgress.child);
  currentRoot = workInProgress;
  workInProgress = null;
}

function commitWork(fiber) {
  if (!fiber) return;

  const parentDOM = fiber.parent.dom;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
    parentDOM.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    parentDOM.removeChild(fiber.dom);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function createDOM(fiber) {
  const dom = fiber.type === 'TEXT_ELEMENT'
    ? document.createTextNode('')
    : document.createElement(fiber.type);

  updateDOM(dom, {}, fiber.props);
  return dom;
}

function updateDOM(dom, prevProps, nextProps) {
  // 移除旧属性
  Object.keys(prevProps)
    .filter(key => key !== 'children')
    .filter(key => !(key in nextProps))
    .forEach(name => {
      if (name.startsWith('on')) {
        const eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
      } else {
        dom[name] = '';
      }
    });

  // 添加/更新新属性
  Object.keys(nextProps)
    .filter(key => key !== 'children')
    .filter(key => prevProps[key] !== nextProps[key])
    .forEach(name => {
      if (name.startsWith('on')) {
        const eventType = name.toLowerCase().substring(2);
        dom.addEventListener(eventType, nextProps[name]);
      } else {
        dom[name] = nextProps[name];
      }
    });
}
```

React Fiber是现代React的核心架构，深入理解Fiber对于掌握React原理和性能优化至关重要！
