# React 事件机制

React 实现了一套合成事件系统（Synthetic Event System），统一处理各种浏览器事件，提供了跨浏览器的一致性体验。

## 为什么需要合成事件？

### 1. 浏览器兼容性

```javascript
// 原生事件在不同浏览器中的差异
element.addEventListener('click', handler);  // 标准浏览器
element.attachEvent('onclick', handler);     // IE8 及以下

// React 合成事件统一处理
<button onClick={handler}>Click</button>
```

### 2. 性能优化

```javascript
// 原生事件：每个元素都绑定监听器
<div onClick={handler1}>
  <button onClick={handler2}>Button1</button>
  <button onClick={handler3}>Button2</button>
  <button onClick={handler4}>Button3</button>
</div>
// 需要绑定 4 个监听器

// React：事件委托，只在根节点绑定
// 只需要 1 个监听器
```

### 3. 事件池优化

```javascript
// 合成事件对象可以被重用
function handleClick(e) {
  console.log(e.type);  // 'click'

  setTimeout(() => {
    console.log(e.type);  // null (事件对象已被重置)
  }, 0);
}

// 如果需要异步访问事件属性
function handleClick(e) {
  e.persist();  // 阻止事件池回收
  setTimeout(() => {
    console.log(e.type);  // 'click'
  }, 0);
}
```

## React 17 的重要变化

### 事件委托位置的变化

```javascript
// React 16 及之前：委托到 document
document.addEventListener('click', dispatchEvent, false);
document.addEventListener('click', dispatchEvent, true);

// React 17 及之后：委托到 root 容器
const root = document.getElementById('root');
root.addEventListener('click', dispatchEvent, false);
root.addEventListener('click', dispatchEvent, true);
```

### 为什么改变？

1. **微前端支持**：多个 React 应用可以共存
2. **与其他框架混用**：避免事件冲突
3. **事件传播更符合预期**

```
React 16:
  document ← 事件委托在这里
    ↓
  #root
    ↓
  React App

React 17:
  document
    ↓
  #root ← 事件委托在这里
    ↓
  React App
```

## 事件系统架构

```
┌─────────────────────────────────────────┐
│         原生事件（浏览器）                │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│      事件委托（根容器监听）              │
│  root.addEventListener(type, listener)  │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│       事件派发（dispatchEvent）          │
│  1. 查找触发事件的 DOM 节点              │
│  2. 找到对应的 Fiber 节点                │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│      收集监听器（Plugin System）         │
│  遍历 Fiber 树，收集所有 listener        │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│      构造合成事件（SyntheticEvent）      │
│  包装原生事件，提供统一接口              │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│      执行监听器（processDispatchQueue）  │
│  按照捕获/冒泡顺序执行回调               │
└─────────────────────────────────────────┘
```

## 阶段一：事件绑定

### 1. 启动时绑定

```javascript
// ReactDOM.render 或 createRoot 时
function createRootImpl(container, tag, options) {
  // 创建 FiberRoot
  const root = createContainer(container, tag, ...);

  // 绑定所有支持的事件
  if (enableEagerRootListeners) {
    const rootContainerElement =
      container.nodeType === COMMENT_NODE
        ? container.parentNode
        : container;

    // 在根容器上绑定所有事件
    listenToAllSupportedEvents(rootContainerElement);
  }

  return root;
}
```

### 2. listenToAllSupportedEvents

```javascript
// 支持的所有原生事件
const allNativeEvents = new Set([
  'abort',
  'animationend',
  'animationstart',
  'blur',
  'cancel',
  'click',
  'close',
  // ... 约 80+ 种事件
]);

export function listenToAllSupportedEvents(rootContainerElement) {
  // 1. 防止重复绑定
  if (rootContainerElement[listeningMarker]) {
    return;
  }
  rootContainerElement[listeningMarker] = true;

  // 2. 遍历所有事件类型
  allNativeEvents.forEach((domEventName) => {
    // 一些特殊事件直接绑定到目标元素
    if (!nonDelegatedEvents.has(domEventName)) {
      // 冒泡阶段监听
      listenToNativeEvent(
        domEventName,
        false,  // isCapturePhaseListener
        rootContainerElement,
        null,
      );
    }

    // 捕获阶段监听
    listenToNativeEvent(
      domEventName,
      true,   // isCapturePhaseListener
      rootContainerElement,
      null,
    );
  });
}
```

### 3. listenToNativeEvent

```javascript
export function listenToNativeEvent(
  domEventName,
  isCapturePhaseListener,
  rootContainerElement,
  targetElement,
  eventSystemFlags = 0,
) {
  let target = rootContainerElement;

  // 使用 Set 防止重复绑定
  const listenerSet = getEventListenerSet(target);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener,
  );

  if (!listenerSet.has(listenerSetKey)) {
    if (isCapturePhaseListener) {
      eventSystemFlags |= IS_CAPTURE_PHASE;
    }

    // 注册事件监听
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhaseListener,
    );

    listenerSet.add(listenerSetKey);
  }
}
```

### 4. addTrappedEventListener - 创建 listener

```javascript
function addTrappedEventListener(
  targetContainer,
  domEventName,
  eventSystemFlags,
  isCapturePhaseListener,
) {
  // 1. 根据事件优先级创建不同的 listener
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags,
  );

  // 2. 注册原生事件监听
  if (isCapturePhaseListener) {
    addEventCaptureListener(targetContainer, domEventName, listener);
  } else {
    addEventBubbleListener(targetContainer, domEventName, listener);
  }
}

// 注册冒泡事件
export function addEventBubbleListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, false);
  return listener;
}

// 注册捕获事件
export function addEventCaptureListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, true);
  return listener;
}
```

### 5. 事件优先级

```javascript
export function createEventListenerWrapperWithPriority(
  targetContainer,
  domEventName,
  eventSystemFlags,
) {
  // 根据事件类型获取优先级
  const eventPriority = getEventPriorityForPluginSystem(domEventName);

  let listenerWrapper;

  switch (eventPriority) {
    case DiscreteEvent:
      // 离散事件：click, keydown, input 等
      // 优先级最高
      listenerWrapper = dispatchDiscreteEvent;
      break;

    case UserBlockingEvent:
      // 用户阻塞事件：drag, scroll 等
      // 优先级中等
      listenerWrapper = dispatchUserBlockingUpdate;
      break;

    case ContinuousEvent:
    default:
      // 连续事件：animation, load 等
      // 优先级最低
      listenerWrapper = dispatchEvent;
      break;
  }

  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer,
  );
}
```

### 绑定完成后的结构

```
#root 容器
  ├─ Capture Phase Listeners (捕获阶段)
  │   ├─ click → dispatchDiscreteEvent (capture)
  │   ├─ keydown → dispatchDiscreteEvent (capture)
  │   ├─ scroll → dispatchUserBlockingUpdate (capture)
  │   └─ ... (80+ 种事件)
  │
  └─ Bubble Phase Listeners (冒泡阶段)
      ├─ click → dispatchDiscreteEvent (bubble)
      ├─ keydown → dispatchDiscreteEvent (bubble)
      ├─ scroll → dispatchUserBlockingUpdate (bubble)
      └─ ... (80+ 种事件)
```

## 阶段二：事件触发

### 完整调用链

```
用户点击 button
    ↓
浏览器触发原生 click 事件
    ↓
root.addEventListener 的 listener 被调用
    ↓
dispatchDiscreteEvent (wrapper)
    ↓
dispatchEvent (核心派发函数)
    ↓
attemptToDispatchEvent (关联 Fiber)
    ↓
dispatchEventForPluginEventSystem (插件系统)
    ↓
SimpleEventPlugin.extractEvents (收集 listener)
    ↓
accumulateSinglePhaseListeners (遍历 Fiber 树)
    ↓
创建 SyntheticEvent (构造合成事件)
    ↓
processDispatchQueue (执行派发)
    ↓
executeDispatch (执行用户的 onClick 回调)
```

### 1. dispatchEvent - 核心派发函数

```javascript
export function dispatchEvent(
  domEventName,          // 'click'
  eventSystemFlags,      // 捕获或冒泡标志
  targetContainer,       // root 容器
  nativeEvent,          // 原生事件对象
) {
  if (!_enabled) {
    return;
  }

  // 尝试派发事件
  const blockedOn = attemptToDispatchEvent(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent,
  );

  // 处理被阻塞的情况（如 Suspense）
  if (blockedOn === null) {
    return;
  }

  // 如果被阻塞，处理阻塞逻辑
  // ...
}
```

### 2. attemptToDispatchEvent - 关联 Fiber 树

```javascript
export function attemptToDispatchEvent(
  domEventName,
  eventSystemFlags,
  targetContainer,
  nativeEvent,
) {
  // 1. 获取触发事件的原生 DOM 节点
  const nativeEventTarget = getEventTarget(nativeEvent);

  // 2. 从 DOM 节点找到对应的 Fiber 节点
  let targetInst = getClosestInstanceFromNode(nativeEventTarget);

  if (targetInst !== null) {
    // 检查是否在 Suspense 边界内被挂起
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted === null) {
      targetInst = null;
    }
  }

  // 3. 通过插件系统派发事件
  dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst,      // Fiber 节点
    targetContainer,
  );

  return null;
}
```

### DOM 节点与 Fiber 节点的关联

```javascript
// DOM 节点创建时保存 Fiber 引用
function createInstance(type, props, rootContainerInstance) {
  const domElement = document.createElement(type);

  // 关键：在 DOM 节点上保存对应的 Fiber
  precacheFiberNode(internalInstanceHandle, domElement);
  updateFiberProps(domElement, props);

  return domElement;
}

// 保存引用
export function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}

// 获取 Fiber 节点
export function getClosestInstanceFromNode(targetNode) {
  let targetInst = targetNode[internalInstanceKey];

  if (targetInst) {
    return targetInst;
  }

  // 如果当前节点没有，向上查找父节点
  while (!targetInst) {
    targetNode = targetNode.parentNode;
    if (!targetNode) {
      return null;
    }
    targetInst = targetNode[internalInstanceKey];
  }

  return targetInst;
}
```

### 3. 插件系统派发

```javascript
export function dispatchEventForPluginEventSystem(
  domEventName,
  eventSystemFlags,
  nativeEvent,
  targetInst,
  targetContainer,
) {
  let ancestorInst = targetInst;

  // 找到最近的根容器
  if (
    (eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
    (eventSystemFlags & IS_NON_DELEGATED) === 0
  ) {
    const targetContainerNode = targetContainer;

    if (targetInst !== null) {
      let node = targetInst;

      // 向上查找到根节点
      while (node !== null) {
        ancestorInst = node;
        node = getParent(node);
      }
    }
  }

  // 创建派发队列
  const dispatchQueue = [];

  // 通过插件提取事件
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );

  // 处理派发队列
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}
```

### 4. SimpleEventPlugin.extractEvents - 收集 listener

```javascript
function extractEvents(
  dispatchQueue,
  domEventName,
  targetInst,
  nativeEvent,
  nativeEventTarget,
  eventSystemFlags,
  targetContainer,
) {
  // 1. 获取 React 事件名（onClick, onClickCapture）
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return;
  }

  // 2. 确定合成事件构造函数
  let SyntheticEventCtor = SyntheticEvent;
  let reactEventType = domEventName;

  // 特殊事件使用特殊的构造函数
  switch (domEventName) {
    case 'keypress':
    case 'keydown':
    case 'keyup':
      SyntheticEventCtor = SyntheticKeyboardEvent;
      break;
    case 'click':
      if (nativeEvent.button === 2) {
        return;  // 右键点击不触发
      }
    case 'dblclick':
    case 'mousedown':
    case 'mouseup':
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
    // ... 其他事件类型
  }

  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  // 3. 收集所有监听该事件的函数
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
  );

  // 4. 如果有 listener，创建合成事件并加入队列
  if (listeners.length > 0) {
    const event = new SyntheticEventCtor(
      reactName,
      reactEventType,
      null,
      nativeEvent,
      nativeEventTarget,
    );

    dispatchQueue.push({ event, listeners });
  }
}
```

### 5. accumulateSinglePhaseListeners - 遍历 Fiber 树

```javascript
export function accumulateSinglePhaseListeners(
  targetFiber,
  reactName,
  nativeEventType,
  inCapturePhase,
  accumulateTargetOnly,
) {
  const captureName = reactName !== null ? reactName + 'Capture' : null;
  const reactEventName = inCapturePhase ? captureName : reactName;

  const listeners = [];
  let instance = targetFiber;
  let lastHostComponent = null;

  // 从触发事件的 Fiber 节点向上遍历到根节点
  while (instance !== null) {
    const { stateNode, tag } = instance;

    // 只处理 HostComponent（DOM 元素）
    if (tag === HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      if (reactEventName !== null) {
        // 获取该节点上绑定的 listener
        const listener = getListener(instance, reactEventName);

        if (listener != null) {
          listeners.push(
            createDispatchListener(instance, listener, lastHostComponent),
          );
        }
      }
    }

    // 如果只收集目标节点，不向上遍历
    if (accumulateTargetOnly) {
      break;
    }

    // 向上到父节点
    instance = instance.return;
  }

  return listeners;
}
```

### getListener - 从 Fiber 获取回调

```javascript
export default function getListener(inst, registrationName) {
  const stateNode = inst.stateNode;

  if (stateNode === null) {
    return null;
  }

  // 从 props 中获取事件回调
  const props = getFiberCurrentPropsFromNode(stateNode);

  if (props === null) {
    return null;
  }

  // registrationName: 'onClick', 'onClickCapture' 等
  const listener = props[registrationName];

  if (listener && typeof listener !== 'function') {
    throw new Error(
      `Expected \`${registrationName}\` listener to be a function, ` +
      `instead got a value of \`${typeof listener}\` type.`,
    );
  }

  return listener;
}
```

### 示例：收集过程

```jsx
<div onClick={handler1}>
  <span onClick={handler2}>
    <button onClick={handler3}>Click</button>
  </span>
</div>

// 用户点击 button，收集 listener 过程：
```

```
1. 从 button Fiber 开始
   ├─ 获取 listener: handler3
   └─ listeners.push({ instance: buttonFiber, listener: handler3 })

2. 向上到 span Fiber
   ├─ 获取 listener: handler2
   └─ listeners.push({ instance: spanFiber, listener: handler2 })

3. 向上到 div Fiber
   ├─ 获取 listener: handler1
   └─ listeners.push({ instance: divFiber, listener: handler1 })

4. 向上到 root，遍历结束

最终 listeners = [
  { instance: buttonFiber, listener: handler3 },
  { instance: spanFiber, listener: handler2 },
  { instance: divFiber, listener: handler1 },
]
```

## 阶段三：合成事件

### SyntheticEvent 对象

```javascript
function SyntheticEvent(
  reactName,
  reactEventType,
  targetInst,
  nativeEvent,
  nativeEventTarget,
) {
  this._reactName = reactName;
  this._targetInst = targetInst;
  this.type = reactEventType;
  this.nativeEvent = nativeEvent;
  this.target = nativeEventTarget;
  this.currentTarget = null;

  // 复制原生事件的属性
  for (const propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }

    const normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      this[propName] = nativeEvent[propName];
    }
  }

  // 防止默认行为
  const defaultPrevented =
    nativeEvent.defaultPrevented != null
      ? nativeEvent.defaultPrevented
      : nativeEvent.returnValue === false;

  if (defaultPrevented) {
    this.isDefaultPrevented = functionThatReturnsTrue;
  } else {
    this.isDefaultPrevented = functionThatReturnsFalse;
  }

  this.isPropagationStopped = functionThatReturnsFalse;

  return this;
}

// 添加方法
Object.assign(SyntheticEvent.prototype, {
  preventDefault: function() {
    this.defaultPrevented = true;
    const event = this.nativeEvent;
    if (!event) {
      return;
    }

    if (event.preventDefault) {
      event.preventDefault();
    } else {
      event.returnValue = false;
    }
    this.isDefaultPrevented = functionThatReturnsTrue;
  },

  stopPropagation: function() {
    const event = this.nativeEvent;
    if (!event) {
      return;
    }

    if (event.stopPropagation) {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
    this.isPropagationStopped = functionThatReturnsTrue;
  },

  persist: function() {
    // 阻止事件池回收
  },

  isPersistent: functionThatReturnsTrue,
});
```

## 阶段四：执行派发

### processDispatchQueue

```javascript
export function processDispatchQueue(
  dispatchQueue,
  eventSystemFlags,
) {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  // 遍历队列中的每个事件
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i];

    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
  }

  // 清理事件池
  rethrowCaughtError();
}
```

### processDispatchQueueItemsInOrder - 按顺序执行

```javascript
function processDispatchQueueItemsInOrder(
  event,
  dispatchListeners,
  inCapturePhase,
) {
  let previousInstance;

  if (inCapturePhase) {
    // 捕获阶段：倒序遍历（从父到子）
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { instance, currentTarget, listener } = dispatchListeners[i];

      // 检查是否停止传播
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }

      // 执行 listener
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  } else {
    // 冒泡阶段：顺序遍历（从子到父）
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, currentTarget, listener } = dispatchListeners[i];

      // 检查是否停止传播
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }

      // 执行 listener
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}
```

### executeDispatch - 执行用户回调

```javascript
function executeDispatch(event, listener, currentTarget) {
  const type = event.type || 'unknown-event';
  event.currentTarget = currentTarget;

  try {
    // 调用用户的事件处理函数
    listener(event);
  } catch (error) {
    // 捕获并报告错误
    reportGlobalError(error);
  }

  event.currentTarget = null;
}
```

### 执行顺序示例

```jsx
<div
  onClick={handler1}
  onClickCapture={captureHandler1}
>
  <button
    onClick={handler2}
    onClickCapture={captureHandler2}
  >
    Click
  </button>
</div>

// 点击 button 的执行顺序：
```

```
1. 捕获阶段（从父到子）
   ├─ captureHandler1 (div)
   └─ captureHandler2 (button)

2. 目标阶段
   └─ 取决于绑定顺序

3. 冒泡阶段（从子到父）
   ├─ handler2 (button)
   └─ handler1 (div)
```

## 特殊事件处理

### 1. 不委托的事件

```javascript
const nonDelegatedEvents = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'toggle',
  // ... 其他
]);

// 这些事件直接绑定到目标元素
function listenToNonDelegatedEvent(domEventName, targetElement) {
  const listenerSet = getEventListenerSet(targetElement);
  const listenerSetKey = getListenerSetKey(domEventName, false);

  if (!listenerSet.has(listenerSetKey)) {
    const listener = createEventListenerWrapperWithPriority(
      targetElement,
      domEventName,
      eventSystemFlags,
    );

    targetElement.addEventListener(domEventName, listener, false);
    listenerSet.add(listenerSetKey);
  }
}
```

### 2. onChange 事件的特殊处理

```javascript
// onChange 实际监听多个原生事件
function registerSimpleEvents() {
  registerDirectEvent('onChange', [
    'change',
    'click',
    'focusin',
    'focusout',
    'input',
    'keydown',
    'keyup',
    'selectionchange',
  ]);
}

// 根据不同的输入类型，触发不同的原生事件
function getInstIfValueChanged(targetInst) {
  const targetNode = getNodeFromInstance(targetInst);

  if (updateValueIfChanged(targetNode)) {
    return targetInst;
  }
}
```

### 3. onScroll 事件

```javascript
// scroll 事件不冒泡，需要在捕获阶段处理
registerDirectEvent('onScroll', ['scroll']);

// 直接绑定到目标元素
listenToNonDelegatedEvent('scroll', targetElement);
```

## 事件优先级与调度

### 事件优先级映射

```javascript
export function getEventPriorityForPluginSystem(domEventName) {
  const priority = eventPriorities.get(domEventName);
  return priority === undefined ? ContinuousEvent : priority;
}

// 离散事件（最高优先级）
const discreteEventPairsForSimpleEventPlugin = [
  'click',
  'keydown',
  'keyup',
  'input',
  'change',
  // ...
];

// 用户阻塞事件（中优先级）
const userBlockingPairsForSimpleEventPlugin = [
  'drag',
  'dragover',
  'mouseenter',
  'mouseleave',
  'scroll',
  // ...
];
```

### 优先级与更新的结合

```javascript
function dispatchDiscreteEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent,
) {
  // 1. 设置当前优先级
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = null;

  try {
    // 2. 设置为离散事件优先级
    setCurrentUpdatePriority(DiscreteEventPriority);

    // 3. 派发事件
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    // 4. 恢复优先级
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}
```

## 常见问题

### 1. 为什么 e.stopPropagation() 有时不生效？

```javascript
// React 事件
<div onClick={handler1}>
  <button onClick={(e) => {
    e.stopPropagation();  // 只阻止 React 事件冒泡
    handler2(e);
  }}>
    Click
  </button>
</div>

// 原生事件（在 useEffect 中绑定）
useEffect(() => {
  document.addEventListener('click', () => {
    console.log('document clicked');  // 仍然会触发
  });
}, []);

// 解决方案：阻止原生事件传播
<button onClick={(e) => {
  e.nativeEvent.stopImmediatePropagation();  // 阻止原生事件
  handler2(e);
}}>
```

### 2. 为什么异步访问事件对象会报错？

```javascript
function handleClick(e) {
  console.log(e.type);  // 'click'

  setTimeout(() => {
    console.log(e.type);  // Warning: This synthetic event is reused
  }, 0);
}

// React 17 之前需要 persist()
function handleClick(e) {
  e.persist();  // 阻止事件对象被重用

  setTimeout(() => {
    console.log(e.type);  // 'click'
  }, 0);
}

// React 17+ 不再需要 persist()
// 事件池被移除了
```

### 3. React 事件 vs 原生事件执行顺序

```javascript
useEffect(() => {
  // 原生事件（捕获）
  document.addEventListener('click', () => {
    console.log('1. Native capture');
  }, true);

  // 原生事件（冒泡）
  document.addEventListener('click', () => {
    console.log('4. Native bubble');
  }, false);

  return () => {
    document.removeEventListener('click', ...);
  };
}, []);

// React 事件
<div onClick={() => console.log('3. React bubble')}>
  <button onClick={() => console.log('2. React target')}>
    Click
  </button>
</div>

// 执行顺序：
// 1. Native capture (document 捕获)
// 2. React target (React 事件)
// 3. React bubble (React 事件)
// 4. Native bubble (document 冒泡)
```

## 总结

React 事件机制的核心特点：

1. **事件委托**
   - React 17+：委托到根容器
   - 性能优化：减少监听器数量

2. **合成事件**
   - 跨浏览器兼容
   - 统一的事件接口
   - 事件池优化（17 之前）

3. **事件流程**
   - 绑定：启动时在根容器绑定所有事件
   - 触发：原生事件 → 找到 Fiber → 收集 listener
   - 派发：构造合成事件 → 按顺序执行回调

4. **优先级调度**
   - 离散事件：最高优先级
   - 用户阻塞：中等优先级
   - 连续事件：最低优先级

5. **与原生事件的交互**
   - React 事件在原生事件之后执行
   - stopPropagation 只影响 React 事件
   - 需要 stopImmediatePropagation 阻止原生事件

React 事件系统是 React 与浏览器交互的桥梁，理解它的原理有助于解决事件相关的问题。