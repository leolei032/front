# Vue深入问题

## 1. Vue的v-model原理
**问题：** Vue的v-model原理是什么？

**考察要点：** 双向绑定原理，语法糖，自定义组件v-model

### 解答

#### v-model本质

v-model是一个**语法糖**，本质上是 `:value` + `@input` 的组合。

```vue
<!-- 使用v-model -->
<input v-model="message">

<!-- 等价于 -->
<input :value="message" @input="message = $event.target.value">
```

#### 不同元素的v-model

**input[type="text"]**
```vue
<input v-model="text">

<!-- 编译为 -->
<input
  :value="text"
  @input="text = $event.target.value"
>
```

**input[type="checkbox"]**
```vue
<input type="checkbox" v-model="checked">

<!-- 编译为 -->
<input
  type="checkbox"
  :checked="checked"
  @change="checked = $event.target.checked"
>
```

**input[type="radio"]**
```vue
<input type="radio" value="a" v-model="picked">
<input type="radio" value="b" v-model="picked">

<!-- 编译为 -->
<input
  type="radio"
  value="a"
  :checked="picked === 'a'"
  @change="picked = $event.target.value"
>
```

**select**
```vue
<select v-model="selected">
  <option value="a">A</option>
  <option value="b">B</option>
</select>

<!-- 编译为 -->
<select @change="selected = $event.target.value">
  <option value="a" :selected="selected === 'a'">A</option>
  <option value="b" :selected="selected === 'b'">B</option>
</select>
```

#### 修饰符

**.lazy** - 在change事件后同步
```vue
<input v-model.lazy="message">

<!-- 等价于 -->
<input :value="message" @change="message = $event.target.value">
```

**.number** - 转为数字
```vue
<input v-model.number="age" type="number">

<!-- 等价于 -->
<input
  :value="age"
  @input="age = parseFloat($event.target.value)"
  type="number"
>
```

**.trim** - 去除首尾空格
```vue
<input v-model.trim="message">

<!-- 等价于 -->
<input
  :value="message"
  @input="message = $event.target.value.trim()"
>
```

#### 自定义组件v-model

**Vue 2**
```vue
<!-- 父组件 -->
<CustomInput v-model="searchText" />

<!-- 等价于 -->
<CustomInput
  :value="searchText"
  @input="searchText = $event"
/>

<!-- CustomInput组件 -->
<template>
  <input
    :value="value"
    @input="$emit('input', $event.target.value)"
  >
</template>

<script>
export default {
  props: ['value'],
  model: {
    prop: 'value',
    event: 'input'
  }
};
</script>
```

**自定义prop和event**
```vue
<script>
export default {
  props: ['checked'],
  model: {
    prop: 'checked',
    event: 'change'
  },
  methods: {
    handleChange(e) {
      this.$emit('change', e.target.checked);
    }
  }
};
</script>

<!-- 使用 -->
<CustomCheckbox v-model="isChecked" />

<!-- 等价于 -->
<CustomCheckbox
  :checked="isChecked"
  @change="isChecked = $event"
/>
```

**Vue 3**
```vue
<!-- 父组件 -->
<CustomInput v-model="searchText" />

<!-- 等价于 -->
<CustomInput
  :modelValue="searchText"
  @update:modelValue="searchText = $event"
/>

<!-- CustomInput组件 -->
<template>
  <input
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  >
</template>

<script>
export default {
  props: ['modelValue'],
  emits: ['update:modelValue']
};
</script>
```

**Vue 3 多个v-model**
```vue
<!-- 父组件 -->
<UserName
  v-model:first-name="firstName"
  v-model:last-name="lastName"
/>

<!-- 等价于 -->
<UserName
  :first-name="firstName"
  :last-name="lastName"
  @update:first-name="firstName = $event"
  @update:last-name="lastName = $event"
/>

<!-- UserName组件 -->
<template>
  <input
    :value="firstName"
    @input="$emit('update:firstName', $event.target.value)"
  >
  <input
    :value="lastName"
    @input="$emit('update:lastName', $event.target.value)"
  >
</template>

<script>
export default {
  props: ['firstName', 'lastName'],
  emits: ['update:firstName', 'update:lastName']
};
</script>
```

#### 手写v-model

```javascript
// 简化的v-model实现
function vModel(element, binding) {
  const { value, modifiers } = binding;

  // 设置初始值
  element.value = value;

  // 监听输入事件
  element.addEventListener('input', (e) => {
    let val = e.target.value;

    // 处理修饰符
    if (modifiers.trim) {
      val = val.trim();
    }
    if (modifiers.number) {
      val = parseFloat(val);
    }

    // 更新数据
    binding.update(val);
  });

  // 处理lazy修饰符
  if (modifiers.lazy) {
    element.addEventListener('change', (e) => {
      binding.update(e.target.value);
    });
  }
}
```

## 2. Vue的$set和$delete
**问题：** Vue的$set和$delete是什么？为什么需要？

**考察要点：** Vue2响应式系统限制，Object.defineProperty局限性

### 解答

#### 为什么需要$set

**Vue2响应式限制：**
```javascript
// 1. 无法检测对象属性的添加
const obj = { a: 1 };
obj.b = 2;  // ❌ b不是响应式的

// 2. 无法检测数组索引和长度的变化
const arr = [1, 2, 3];
arr[0] = 10;      // ❌ 不会触发更新
arr.length = 0;   // ❌ 不会触发更新
```

#### $set用法

**Vue.set / vm.$set**
```javascript
// 语法
Vue.set(target, key, value)
vm.$set(target, key, value)

// 对象添加响应式属性
export default {
  data() {
    return {
      user: { name: 'John' }
    };
  },
  methods: {
    addAge() {
      // ❌ 不响应式
      this.user.age = 30;

      // ✅ 响应式
      this.$set(this.user, 'age', 30);
      // 或
      Vue.set(this.user, 'age', 30);
    }
  }
};

// 数组修改
export default {
  data() {
    return {
      items: ['a', 'b', 'c']
    };
  },
  methods: {
    updateItem() {
      // ❌ 不响应式
      this.items[0] = 'x';

      // ✅ 响应式
      this.$set(this.items, 0, 'x');
      // 或使用数组方法
      this.items.splice(0, 1, 'x');
    }
  }
};
```

#### $delete用法

**Vue.delete / vm.$delete**
```javascript
// 语法
Vue.delete(target, key)
vm.$delete(target, key)

// 删除对象属性
export default {
  data() {
    return {
      user: { name: 'John', age: 30 }
    };
  },
  methods: {
    removeAge() {
      // ❌ 不响应式
      delete this.user.age;

      // ✅ 响应式
      this.$delete(this.user, 'age');
      // 或
      Vue.delete(this.user, 'age');
    }
  }
};

// 删除数组元素
export default {
  data() {
    return {
      items: ['a', 'b', 'c']
    };
  },
  methods: {
    removeItem() {
      // ❌ 不响应式
      delete this.items[0];

      // ✅ 响应式
      this.$delete(this.items, 0);
      // 或使用数组方法
      this.items.splice(0, 1);
    }
  }
};
```

#### 实现原理

**$set实现**
```javascript
function set(target, key, val) {
  // 数组处理
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }

  // 已存在的属性，直接赋值
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }

  const ob = target.__ob__;

  // target不是响应式对象
  if (!ob) {
    target[key] = val;
    return val;
  }

  // 新增响应式属性
  defineReactive(ob.value, key, val);
  ob.dep.notify();  // 通知依赖更新
  return val;
}
```

**$delete实现**
```javascript
function del(target, key) {
  // 数组处理
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }

  const ob = target.__ob__;

  // 属性不存在
  if (!(key in target)) {
    return;
  }

  // 删除属性
  delete target[key];

  // 通知更新
  if (ob) {
    ob.dep.notify();
  }
}
```

#### Vue 3改进

Vue 3使用Proxy，不再有这些限制：

```javascript
// Vue 3中不需要$set和$delete

const state = reactive({
  user: { name: 'John' }
});

// ✅ 直接添加属性
state.user.age = 30;

// ✅ 直接删除属性
delete state.user.age;

// ✅ 数组索引修改
const arr = reactive([1, 2, 3]);
arr[0] = 10;

// ✅ 数组长度修改
arr.length = 0;
```

## 3. Vue组件间数据传递方式
**问题：** Vue组件间数据传递方式有哪些？

**考察要点：** props、emit、provide/inject、Vuex、EventBus等多种通信方式

### 解答（已在[04-Vue框架.md](./04-Vue框架.md#7-vue组件之间的通信方式)详细说明）

## 4. Vue的diff算法
**问题：** Vue的diff算法原理

**考察要点：** 虚拟DOM对比，key的作用，双端比较算法

### 解答

#### Diff算法策略

**三大策略：**
1. **同层比较**：只比较同一层级的节点
2. **类型相同才复用**：type不同直接替换
3. **使用key优化**：通过key快速定位节点

#### Vue 2 的双端比较算法

```javascript
function updateChildren(oldCh, newCh) {
  let oldStartIdx = 0;
  let oldEndIdx = oldCh.length - 1;
  let oldStartVNode = oldCh[0];
  let oldEndVNode = oldCh[oldEndIdx];

  let newStartIdx = 0;
  let newEndIdx = newCh.length - 1;
  let newStartVNode = newCh[0];
  let newEndVNode = newCh[newEndIdx];

  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (sameVNode(oldStartVNode, newStartVNode)) {
      // 1. 旧开始 vs 新开始
      patchVNode(oldStartVNode, newStartVNode);
      oldStartVNode = oldCh[++oldStartIdx];
      newStartVNode = newCh[++newStartIdx];
    } else if (sameVNode(oldEndVNode, newEndVNode)) {
      // 2. 旧结束 vs 新结束
      patchVNode(oldEndVNode, newEndVNode);
      oldEndVNode = oldCh[--oldEndIdx];
      newEndVNode = newCh[--newEndIdx];
    } else if (sameVNode(oldStartVNode, newEndVNode)) {
      // 3. 旧开始 vs 新结束
      patchVNode(oldStartVNode, newEndVNode);
      nodeOps.insertBefore(parentElm, oldStartVNode.elm, nodeOps.nextSibling(oldEndVNode.elm));
      oldStartVNode = oldCh[++oldStartIdx];
      newEndVNode = newCh[--newEndIdx];
    } else if (sameVNode(oldEndVNode, newStartVNode)) {
      // 4. 旧结束 vs 新开始
      patchVNode(oldEndVNode, newStartVNode);
      nodeOps.insertBefore(parentElm, oldEndVNode.elm, oldStartVNode.elm);
      oldEndVNode = oldCh[--oldEndIdx];
      newStartVNode = newCh[++newStartIdx];
    } else {
      // 5. 使用key查找
      const idxInOld = findIdxInOld(newStartVNode, oldCh, oldStartIdx, oldEndIdx);

      if (idxInOld === undefined) {
        // 新增节点
        createElm(newStartVNode, parentElm, oldStartVNode.elm);
      } else {
        // 移动节点
        const vnodeToMove = oldCh[idxInOld];
        patchVNode(vnodeToMove, newStartVNode);
        oldCh[idxInOld] = undefined;
        nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVNode.elm);
      }

      newStartVNode = newCh[++newStartIdx];
    }
  }

  // 添加剩余新节点
  if (oldStartIdx > oldEndIdx) {
    addVNodes(newCh, newStartIdx, newEndIdx);
  }

  // 删除剩余旧节点
  if (newStartIdx > newEndIdx) {
    removeVNodes(oldCh, oldStartIdx, oldEndIdx);
  }
}
```

#### Key的作用

**不使用key**
```vue
<!-- 列表反转 -->
<ul>
  <li v-for="item in items">{{ item }}</li>
</ul>

<!-- 从 [A, B, C] 变成 [C, B, A] -->
<!-- Vue会复用li元素，只修改文本内容 -->
<!-- DOM操作：3次文本更新 -->
```

**使用key**
```vue
<ul>
  <li v-for="item in items" :key="item.id">{{ item }}</li>
</ul>

<!-- Vue会通过key识别节点，移动DOM元素 -->
<!-- DOM操作：移动元素位置（更高效） -->
```

**不要使用index作为key**
```vue
<!-- ❌ 错误用法 -->
<li v-for="(item, index) in items" :key="index">
  {{ item }}
</li>

<!-- 问题：删除中间元素时，后面元素的index都会改变 -->
<!-- 导致不必要的渲染 -->

<!-- ✅ 正确用法 -->
<li v-for="item in items" :key="item.id">
  {{ item }}
</li>
```

#### Vue 3的优化

**最长递增子序列算法**
```javascript
// Vue 3使用最长递增子序列优化移动次数
function patchKeyedChildren(c1, c2) {
  let i = 0;
  const l2 = c2.length;
  let e1 = c1.length - 1;
  let e2 = l2 - 1;

  // 1. 从头开始比较
  while (i <= e1 && i <= e2) {
    if (isSameVNodeType(c1[i], c2[i])) {
      patch(c1[i], c2[i]);
      i++;
    } else {
      break;
    }
  }

  // 2. 从尾开始比较
  while (i <= e1 && i <= e2) {
    if (isSameVNodeType(c1[e1], c2[e2])) {
      patch(c1[e1], c2[e2]);
      e1--;
      e2--;
    } else {
      break;
    }
  }

  // 3. 新增节点
  if (i > e1) {
    while (i <= e2) {
      mount(c2[i], container);
      i++;
    }
  }

  // 4. 删除节点
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i]);
      i++;
    }
  }

  // 5. 乱序比较（使用最长递增子序列）
  else {
    const seq = getSequence(newIndexToOldIndexMap);
    // 只需要移动不在递增子序列中的节点
    // 大大减少DOM操作次数
  }
}
```

## 5. Vue的nextTick原理
**问题：** Vue的nextTick实现原理

**考察要点：** 异步更新队列，事件循环，降级策略

### 解答

#### 为什么需要nextTick

**异步更新队列：**
```javascript
// Vue不会立即更新DOM
export default {
  data() {
    return { message: 'Hello' };
  },
  methods: {
    update() {
      this.message = 'World';
      console.log(this.$el.textContent);  // 还是'Hello'

      this.$nextTick(() => {
        console.log(this.$el.textContent);  // 'World'
      });
    }
  }
};
```

#### nextTick实现原理

**核心代码：**
```javascript
const callbacks = [];
let pending = false;

function flushCallbacks() {
  pending = false;
  const copies = callbacks.slice(0);
  callbacks.length = 0;

  for (let i = 0; i < copies.length; i++) {
    copies[i]();
  }
}

// 降级策略
let timerFunc;

if (typeof Promise !== 'undefined') {
  // 优先使用Promise（微任务）
  const p = Promise.resolve();
  timerFunc = () => {
    p.then(flushCallbacks);
  };
} else if (typeof MutationObserver !== 'undefined') {
  // 降级到MutationObserver（微任务）
  let counter = 1;
  const observer = new MutationObserver(flushCallbacks);
  const textNode = document.createTextNode(String(counter));

  observer.observe(textNode, {
    characterData: true
  });

  timerFunc = () => {
    counter = (counter + 1) % 2;
    textNode.data = String(counter);
  };
} else if (typeof setImmediate !== 'undefined') {
  // 降级到setImmediate（宏任务）
  timerFunc = () => {
    setImmediate(flushCallbacks);
  };
} else {
  // 最后降级到setTimeout（宏任务）
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}

export function nextTick(cb, ctx) {
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx);
      } catch (e) {
        handleError(e, ctx, 'nextTick');
      }
    }
  });

  if (!pending) {
    pending = true;
    timerFunc();
  }

  // 支持Promise
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      callbacks.push(() => {
        resolve(ctx);
      });
    });
  }
}
```

#### 使用方式

```javascript
// 1. 回调函数
this.$nextTick(() => {
  console.log('DOM已更新');
});

// 2. Promise
this.$nextTick().then(() => {
  console.log('DOM已更新');
});

// 3. async/await
async update() {
  this.message = 'New';
  await this.$nextTick();
  console.log('DOM已更新');
}

// 4. 全局API
import { nextTick } from 'vue';

nextTick(() => {
  console.log('DOM已更新');
});
```

#### 应用场景

```javascript
// 1. 获取更新后的DOM
methods: {
  update() {
    this.list.push('new item');

    this.$nextTick(() => {
      const height = this.$refs.list.scrollHeight;
      console.log('列表高度:', height);
    });
  }
}

// 2. 第三方库初始化
mounted() {
  this.$nextTick(() => {
    // 确保DOM已渲染
    new Swiper('.swiper-container');
  });
}

// 3. 获取输入框焦点
methods: {
  showInput() {
    this.inputVisible = true;

    this.$nextTick(() => {
      this.$refs.input.focus();
    });
  }
}
```

## 6. Vue中mixin是什么,如何使用
**问题:** Vue中mixin是什么,如何使用?

**考察要点:** 代码复用,mixin合并策略,命名冲突,替代方案

### 解答

#### Mixin基本概念

**定义:** Mixin是一种分发Vue组件可复用功能的灵活方式。mixin对象可以包含任意组件选项,当组件使用mixin时,所有mixin选项将被"混入"该组件本身的选项。

#### 基本用法

```javascript
// 定义mixin
const myMixin = {
  data() {
    return {
      message: 'Hello from mixin'
    };
  },

  created() {
    console.log('Mixin created hook');
  },

  methods: {
    hello() {
      console.log('Hello from mixin');
    }
  }
};

// 使用mixin
export default {
  mixins: [myMixin],

  data() {
    return {
      localMessage: 'Hello from component'
    };
  },

  created() {
    console.log('Component created hook');
    this.hello();  // 可以直接调用mixin的方法
    console.log(this.message);  // 可以访问mixin的data
  }
};

// 输出顺序:
// "Mixin created hook"
// "Component created hook"
// "Hello from mixin"
// "Hello from mixin"
```

#### 实用示例

**1. 表单验证mixin**
```javascript
// formValidationMixin.js
export const formValidationMixin = {
  data() {
    return {
      errors: {}
    };
  },

  methods: {
    // 验证邮箱
    validateEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    },

    // 验证手机号
    validatePhone(phone) {
      const re = /^1[3-9]\d{9}$/;
      return re.test(phone);
    },

    // 验证必填
    validateRequired(value, fieldName) {
      if (!value || value.trim() === '') {
        this.$set(this.errors, fieldName, `${fieldName}不能为空`);
        return false;
      }
      this.$delete(this.errors, fieldName);
      return true;
    },

    // 清空错误
    clearErrors() {
      this.errors = {};
    }
  }
};

// 使用
export default {
  mixins: [formValidationMixin],

  data() {
    return {
      email: '',
      phone: ''
    };
  },

  methods: {
    submit() {
      this.clearErrors();

      if (!this.validateRequired(this.email, '邮箱')) return;
      if (!this.validateEmail(this.email)) {
        this.errors.email = '邮箱格式不正确';
        return;
      }

      // 提交表单
      this.submitForm();
    }
  }
};
```

**2. 页面加载mixin**
```javascript
// loadingMixin.js
export const loadingMixin = {
  data() {
    return {
      loading: false,
      error: null
    };
  },

  methods: {
    async asyncData(fn) {
      this.loading = true;
      this.error = null;

      try {
        const result = await fn();
        return result;
      } catch (error) {
        this.error = error.message;
        console.error('Error:', error);
      } finally {
        this.loading = false;
      }
    }
  }
};

// 使用
export default {
  mixins: [loadingMixin],

  async mounted() {
    await this.asyncData(async () => {
      const response = await fetch('/api/users');
      this.users = await response.json();
    });
  }
};
```

**3. 权限检查mixin**
```javascript
// permissionMixin.js
export const permissionMixin = {
  methods: {
    hasPermission(permission) {
      const userPermissions = this.$store.state.user.permissions || [];
      return userPermissions.includes(permission);
    },

    hasRole(role) {
      const userRoles = this.$store.state.user.roles || [];
      return userRoles.includes(role);
    },

    checkPermission(permission) {
      if (!this.hasPermission(permission)) {
        this.$message.error('没有权限');
        return false;
      }
      return true;
    }
  }
};

// 使用
export default {
  mixins: [permissionMixin],

  methods: {
    deleteUser(userId) {
      if (!this.checkPermission('user:delete')) {
        return;
      }
      // 执行删除操作
    }
  }
};
```

**4. 生命周期日志mixin**
```javascript
// lifecycleLogMixin.js
export const lifecycleLogMixin = {
  created() {
    console.log(`[${this.$options.name}] created`);
  },

  mounted() {
    console.log(`[${this.$options.name}] mounted`);
  },

  updated() {
    console.log(`[${this.$options.name}] updated`);
  },

  destroyed() {
    console.log(`[${this.$options.name}] destroyed`);
  }
};
```

#### 选项合并策略

**1. Data合并**
```javascript
const mixin = {
  data() {
    return {
      message: 'mixin message',
      count: 1
    };
  }
};

export default {
  mixins: [mixin],
  data() {
    return {
      message: 'component message',  // 组件data优先
      title: 'title'
    };
  }
};

// 结果: { message: 'component message', count: 1, title: 'title' }
```

**2. 生命周期钩子合并**
```javascript
const mixin = {
  created() {
    console.log('mixin created');
  }
};

export default {
  mixins: [mixin],
  created() {
    console.log('component created');
  }
};

// 输出:
// "mixin created"      <- mixin的钩子先执行
// "component created"  <- 组件的钩子后执行
```

**3. Methods/Computed/Watch合并**
```javascript
const mixin = {
  methods: {
    foo() {
      console.log('mixin foo');
    },
    bar() {
      console.log('mixin bar');
    }
  }
};

export default {
  mixins: [mixin],
  methods: {
    foo() {
      console.log('component foo');  // 组件方法会覆盖mixin方法
    }
  }
};

// this.foo() -> "component foo"
// this.bar() -> "mixin bar"
```

#### 全局Mixin

```javascript
// main.js
Vue.mixin({
  created() {
    console.log('Global mixin created');
  },

  methods: {
    formatDate(date) {
      return new Date(date).toLocaleDateString();
    }
  }
});

// 所有组件都会混入这些选项
// 谨慎使用!会影响所有组件,包括第三方组件
```

#### Mixin的问题

**1. 命名冲突**
```javascript
// 多个mixin可能有同名属性/方法
const mixin1 = {
  methods: {
    submit() {
      console.log('mixin1 submit');
    }
  }
};

const mixin2 = {
  methods: {
    submit() {
      console.log('mixin2 submit');
    }
  }
};

export default {
  mixins: [mixin1, mixin2],  // mixin2会覆盖mixin1
  // this.submit() -> "mixin2 submit"
};
```

**2. 依赖不明确**
```javascript
// 组件使用了mixin的属性,但不清楚来源
export default {
  mixins: [mixinA, mixinB, mixinC],

  methods: {
    doSomething() {
      // this.someData来自哪个mixin?
      // 需要查看每个mixin才能知道
      console.log(this.someData);
    }
  }
};
```

**3. 隐式依赖**
```javascript
// mixin可能依赖组件的某些属性
const mixin = {
  methods: {
    submit() {
      // 假设组件有formData属性
      this.postData(this.formData);
    }
  }
};
```

#### Composition API替代方案(Vue 3)

Mixin的问题促使Vue 3引入Composition API:

```javascript
// useValidation.js - 组合式函数
import { ref, reactive } from 'vue';

export function useValidation() {
  const errors = reactive({});

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateRequired = (value, fieldName) => {
    if (!value || value.trim() === '') {
      errors[fieldName] = `${fieldName}不能为空`;
      return false;
    }
    delete errors[fieldName];
    return true;
  };

  const clearErrors = () => {
    Object.keys(errors).forEach(key => delete errors[key]);
  };

  return {
    errors,
    validateEmail,
    validateRequired,
    clearErrors
  };
}

// 使用 - 更清晰的依赖关系
export default {
  setup() {
    const { errors, validateEmail, validateRequired, clearErrors } = useValidation();
    const email = ref('');

    const submit = () => {
      clearErrors();

      if (!validateRequired(email.value, '邮箱')) return;
      if (!validateEmail(email.value)) {
        errors.email = '邮箱格式不正确';
        return;
      }

      // 提交表单
    };

    return {
      email,
      errors,
      submit
    };
  }
};
```

#### Mixin最佳实践

1. **命名规范:** 使用明确的前缀避免冲突
```javascript
const userMixin = {
  data() {
    return {
      userMixin_loading: false,
      userMixin_error: null
    };
  }
};
```

2. **文档化:** 清楚说明mixin的依赖和提供的功能
```javascript
/**
 * 表单验证Mixin
 *
 * 提供的方法:
 * - validateEmail(email): 验证邮箱
 * - validatePhone(phone): 验证手机号
 *
 * 提供的数据:
 * - errors: 错误信息对象
 */
export const formValidationMixin = {
  // ...
};
```

3. **避免全局mixin:** 仅在必要时使用,优先使用局部mixin

4. **Vue 3推荐使用Composition API:** 更灵活,依赖更清晰

## 7. Vue组件中data属性为什么需要返回一个函数

**问题:** Vue组件中data属性为什么需要返回一个函数?

**考察要点:** 组件复用,数据独立性,闭包,作用域

### 解答

#### 核心原因:确保每个组件实例有独立的数据副本

#### 问题演示

**错误方式(对象形式):**
```javascript
// ❌ 错误:使用对象
const MyComponent = {
  template: '<div>{{ count }}</div>',
  data: {
    count: 0
  }
};

// 创建多个实例
const instance1 = new Vue(MyComponent).$mount('#app1');
const instance2 = new Vue(MyComponent).$mount('#app2');

// 问题:所有实例共享同一个data对象
instance1.count = 10;
console.log(instance2.count);  // 10 - 被影响了!
```

**正确方式(函数形式):**
```javascript
// ✅ 正确:使用函数
const MyComponent = {
  template: '<div>{{ count }}</div>',
  data() {
    return {
      count: 0
    };
  }
};

// 创建多个实例
const instance1 = new Vue(MyComponent).$mount('#app1');
const instance2 = new Vue(MyComponent).$mount('#app2');

// 每个实例有独立的data
instance1.count = 10;
console.log(instance2.count);  // 0 - 不受影响
```

#### 实际场景示例

```vue
<!-- Counter.vue -->
<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="count++">+1</button>
  </div>
</template>

<script>
export default {
  name: 'Counter',

  // ✅ 正确:每个Counter实例有独立的count
  data() {
    return {
      count: 0
    };
  }
};
</script>
```

```vue
<!-- App.vue -->
<template>
  <div>
    <Counter />  <!-- count: 0, 1, 2... -->
    <Counter />  <!-- count: 0, 1, 2... (独立的) -->
    <Counter />  <!-- count: 0, 1, 2... (独立的) -->
  </div>
</template>

<script>
import Counter from './Counter.vue';

export default {
  components: { Counter }
};
</script>
```

#### 原理分析

**Vue源码中的处理:**
```javascript
// Vue源码简化版
function initData(vm) {
  let data = vm.$options.data;

  // 如果data是函数,调用函数获取数据对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {};

  // 对data进行响应式处理
  observe(data);
}

function getData(data, vm) {
  try {
    // 调用data函数,每次调用都返回新对象
    return data.call(vm, vm);
  } catch (e) {
    handleError(e, vm, 'data()');
    return {};
  }
}
```

**闭包原理:**
```javascript
// 每次调用data函数都创建新的作用域
function createComponent() {
  return {
    data() {
      // 这是一个新的作用域
      const count = 0;  // 独立的变量
      return {
        count
      };
    }
  };
}

// 每个组件实例调用data()时,都创建新的数据对象
const component1 = createComponent();
const data1 = component1.data();  // { count: 0 }

const component2 = createComponent();
const data2 = component2.data();  // { count: 0 } (新对象)

data1.count = 10;
console.log(data2.count);  // 0 - 完全独立
```

#### JavaScript引用类型的特性

```javascript
// 对象是引用类型
const obj = { count: 0 };
const ref1 = obj;
const ref2 = obj;

ref1.count = 10;
console.log(ref2.count);  // 10 - 共享同一对象

// 函数返回新对象
function createObj() {
  return { count: 0 };
}

const obj1 = createObj();
const obj2 = createObj();

obj1.count = 10;
console.log(obj2.count);  // 0 - 不同对象
```

#### 根实例的特殊情况

```javascript
// 根实例可以使用对象形式
new Vue({
  el: '#app',

  // ✅ 根实例可以用对象
  data: {
    message: 'Hello'
  }
});

// 原因:根实例只会创建一次,不会复用
```

#### 深拷贝 vs 函数返回

```javascript
// 即使深拷贝对象,仍然不如函数
const dataTemplate = {
  user: { name: 'John' },
  items: [1, 2, 3]
};

// ❌ 方案1:深拷贝(性能差)
const MyComponent1 = {
  data: JSON.parse(JSON.stringify(dataTemplate))
};

// ✅ 方案2:函数(推荐)
const MyComponent2 = {
  data() {
    return {
      user: { name: 'John' },
      items: [1, 2, 3]
    };
  }
};
```

#### 类比理解

```javascript
// 类比:工厂模式
class ComponentFactory {
  // 对象形式 = 所有产品共享一个模板(引用)
  static sharedData = {
    count: 0
  };

  // 函数形式 = 每个产品有独立的数据
  createData() {
    return {
      count: 0
    };
  }
}

// 共享数据的问题
const product1 = ComponentFactory.sharedData;
const product2 = ComponentFactory.sharedData;
product1.count = 10;
console.log(product2.count);  // 10 - 污染了!

// 独立数据的好处
const factory = new ComponentFactory();
const product3 = factory.createData();
const product4 = factory.createData();
product3.count = 10;
console.log(product4.count);  // 0 - 独立的
```

#### 实战案例

```vue
<!-- 购物车组件 -->
<template>
  <div>
    <h3>{{ title }}</h3>
    <ul>
      <li v-for="item in items" :key="item.id">
        {{ item.name }} - ${{ item.price }}
        <button @click="removeItem(item.id)">删除</button>
      </li>
    </ul>
    <p>Total: ${{ total }}</p>
  </div>
</template>

<script>
export default {
  name: 'ShoppingCart',

  // 每个购物车组件有独立的商品列表
  data() {
    return {
      title: '购物车',
      items: []
    };
  },

  computed: {
    total() {
      return this.items.reduce((sum, item) => sum + item.price, 0);
    }
  },

  methods: {
    removeItem(id) {
      this.items = this.items.filter(item => item.id !== id);
    }
  }
};
</script>

<!-- 使用多个购物车组件 -->
<template>
  <div>
    <ShoppingCart />  <!-- 用户A的购物车 -->
    <ShoppingCart />  <!-- 用户B的购物车 -->
  </div>
</template>
```

**如果不用函数:**
```javascript
// ❌ 错误示例
data: {
  items: []
}

// 结果:所有用户共享同一个购物车!
// 用户A添加商品,用户B的购物车也会显示
```

#### 总结

**为什么data必须是函数:**
1. **组件复用:** 组件可能被多次实例化
2. **数据独立:** 每个实例需要独立的数据副本
3. **引用类型:** JavaScript对象是引用类型,直接使用会共享
4. **函数闭包:** 函数返回新对象,利用闭包创建独立作用域

**记忆技巧:**
- 根实例 = 单例 → 可以用对象
- 组件 = 多例 → 必须用函数

## 8. Vue2和Vue3的区别

**问题:** Vue2和Vue3有哪些主要区别?

**考察要点:** 响应式原理,Composition API,性能优化,Tree-shaking,TypeScript支持

### 解答

#### 1. 响应式系统

**Vue 2: Object.defineProperty**
```javascript
// Vue 2响应式原理
function defineReactive(obj, key, val) {
  Object.defineProperty(obj, key, {
    get() {
      // 依赖收集
      return val;
    },
    set(newVal) {
      // 派发更新
      val = newVal;
    }
  });
}

// 限制:
// 1. 无法检测属性的添加/删除
const obj = { a: 1 };
obj.b = 2;  // ❌ 不是响应式的
delete obj.a;  // ❌ 不是响应式的

// 2. 无法检测数组索引和长度变化
const arr = [1, 2, 3];
arr[0] = 10;  // ❌ 不是响应式的
arr.length = 0;  // ❌ 不是响应式的

// 需要使用$set/$delete
this.$set(obj, 'b', 2);
this.$delete(obj, 'a');
```

**Vue 3: Proxy**
```javascript
// Vue 3响应式原理
function reactive(target) {
  return new Proxy(target, {
    get(target, key) {
      track(target, key);  // 依赖收集
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      const result = Reflect.set(target, key, value);
      trigger(target, key);  // 派发更新
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return result;
    }
  });
}

// ✅ 解决了Vue 2的限制
const state = reactive({ a: 1 });
state.b = 2;  // ✅ 响应式的
delete state.a;  // ✅ 响应式的

const arr = reactive([1, 2, 3]);
arr[0] = 10;  // ✅ 响应式的
arr.length = 0;  // ✅ 响应式的
```

#### 2. Composition API vs Options API

**Vue 2: Options API**
```javascript
export default {
  data() {
    return {
      count: 0,
      user: null
    };
  },

  computed: {
    doubleCount() {
      return this.count * 2;
    }
  },

  methods: {
    increment() {
      this.count++;
    },

    async fetchUser() {
      this.user = await fetch('/api/user').then(r => r.json());
    }
  },

  mounted() {
    this.fetchUser();
  }
};

// 问题:
// 1. 相关逻辑分散在不同选项中
// 2. 大组件难以维护
// 3. 代码复用困难(mixin有命名冲突)
```

**Vue 3: Composition API**
```javascript
import { ref, computed, onMounted } from 'vue';

export default {
  setup() {
    // 计数器逻辑
    const count = ref(0);
    const doubleCount = computed(() => count.value * 2);
    const increment = () => count.value++;

    // 用户逻辑
    const user = ref(null);
    const fetchUser = async () => {
      user.value = await fetch('/api/user').then(r => r.json());
    };

    onMounted(() => {
      fetchUser();
    });

    return {
      count,
      doubleCount,
      increment,
      user
    };
  }
};

// 优势:
// 1. 相关逻辑组织在一起
// 2. 更好的TypeScript支持
// 3. 更灵活的代码复用(组合式函数)
```

**组合式函数(替代mixin):**
```javascript
// useCounter.js
import { ref, computed } from 'vue';

export function useCounter() {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);
  const increment = () => count.value++;

  return {
    count,
    doubleCount,
    increment
  };
}

// 使用
import { useCounter } from './useCounter';

export default {
  setup() {
    const { count, doubleCount, increment } = useCounter();

    return {
      count,
      doubleCount,
      increment
    };
  }
};
```

#### 3. 生命周期变化

| Vue 2 | Vue 3 Composition API | 说明 |
|-------|----------------------|------|
| beforeCreate | setup() | setup在beforeCreate之前执行 |
| created | setup() | setup替代created |
| beforeMount | onBeforeMount | |
| mounted | onMounted | |
| beforeUpdate | onBeforeUpdate | |
| updated | onUpdated | |
| beforeDestroy | onBeforeUnmount | 改名 |
| destroyed | onUnmounted | 改名 |
| errorCaptured | onErrorCaptured | |
| - | onRenderTracked | 新增,调试用 |
| - | onRenderTriggered | 新增,调试用 |

```javascript
// Vue 2
export default {
  beforeCreate() {},
  created() {},
  mounted() {},
  beforeDestroy() {},
  destroyed() {}
};

// Vue 3
import { onMounted, onBeforeUnmount, onUnmounted } from 'vue';

export default {
  setup() {
    onMounted(() => {
      console.log('mounted');
    });

    onBeforeUnmount(() => {
      console.log('before unmount');
    });

    onUnmounted(() => {
      console.log('unmounted');
    });
  }
};
```

#### 4. 多个根节点

**Vue 2: 必须单根节点**
```vue
<template>
  <!-- ❌ 错误 -->
  <div>Content 1</div>
  <div>Content 2</div>

  <!-- ✅ 必须包裹 -->
  <div>
    <div>Content 1</div>
    <div>Content 2</div>
  </div>
</template>
```

**Vue 3: 支持多根节点(Fragment)**
```vue
<template>
  <!-- ✅ 正确 -->
  <div>Content 1</div>
  <div>Content 2</div>
  <div>Content 3</div>
</template>
```

#### 5. v-model变化

**Vue 2:**
```vue
<!-- 组件只能有一个v-model -->
<CustomInput v-model="value" />

<!-- 等价于 -->
<CustomInput
  :value="value"
  @input="value = $event"
/>

<!-- 组件定义 -->
<script>
export default {
  props: ['value'],
  model: {
    prop: 'value',
    event: 'input'
  }
};
</script>
```

**Vue 3:**
```vue
<!-- 支持多个v-model -->
<CustomInput
  v-model:title="title"
  v-model:content="content"
/>

<!-- 等价于 -->
<CustomInput
  :title="title"
  :content="content"
  @update:title="title = $event"
  @update:content="content = $event"
/>

<!-- 组件定义 -->
<script>
export default {
  props: ['title', 'content'],
  emits: ['update:title', 'update:content']
};
</script>
```

#### 6. Teleport(传送门)

**Vue 2: 需要第三方库**
```javascript
// Vue 2需要使用portal-vue
import PortalVue from 'portal-vue';
Vue.use(PortalVue);
```

**Vue 3: 内置Teleport**
```vue
<template>
  <div>
    <!-- 渲染到body -->
    <Teleport to="body">
      <div class="modal">
        Modal Content
      </div>
    </Teleport>

    <!-- 渲染到#app之外 -->
    <Teleport to="#modal-container">
      <div>Teleported</div>
    </Teleport>
  </div>
</template>
```

#### 7. Suspense(异步组件)

**Vue 2: 手动处理loading**
```vue
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <AsyncComponent v-else />
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: true
    };
  },

  async mounted() {
    await someAsyncWork();
    this.loading = false;
  }
};
</script>
```

**Vue 3: Suspense组件**
```vue
<template>
  <Suspense>
    <!-- 异步组件 -->
    <template #default>
      <AsyncComponent />
    </template>

    <!-- loading状态 -->
    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>

<script>
// AsyncComponent.vue
export default {
  async setup() {
    const data = await fetch('/api/data').then(r => r.json());
    return { data };
  }
};
</script>
```

#### 8. 性能优化

**Tree-shaking优化:**
```javascript
// Vue 2: 所有API都在Vue对象上
import Vue from 'vue';
Vue.nextTick(() => {});
Vue.observable({});

// Vue 3: 按需导入,支持Tree-shaking
import { nextTick, reactive } from 'vue';
nextTick(() => {});
reactive({});

// 构建体积对比:
// Vue 2: ~32KB (gzip)
// Vue 3: ~13KB (gzip, 仅核心)
```

**编译优化:**
```vue
<!-- Vue 3静态提升 -->
<template>
  <div>
    <span>Static</span>  <!-- 静态节点,只创建一次 -->
    <span>{{ dynamic }}</span>  <!-- 动态节点 -->
  </div>
</template>

<!-- 编译结果 -->
<script>
// 静态节点被提升到render函数外
const _hoisted_1 = createElementVNode("span", null, "Static");

export function render(_ctx) {
  return createElementVNode("div", null, [
    _hoisted_1,  // 复用静态节点
    createElementVNode("span", null, _toDisplayString(_ctx.dynamic))
  ]);
}
</script>
```

**PatchFlag(更新优化):**
```vue
<template>
  <div>
    <span>{{ text }}</span>
  </div>
</template>

<!-- Vue 3编译结果 -->
<script>
export function render(_ctx) {
  return createElementVNode("div", null, [
    createElementVNode("span", null, _toDisplayString(_ctx.text), 1 /* TEXT */)
    // PatchFlag: 1表示只有文本会变化
    // 更新时只需要比较文本,不需要比较属性、子节点等
  ]);
}
</script>
```

#### 9. TypeScript支持

**Vue 2: 类型推导困难**
```typescript
// Vue 2
import Vue from 'vue';

export default Vue.extend({
  data() {
    return {
      count: 0
    };
  },

  methods: {
    increment() {
      // this的类型推导不够好
      this.count++;
    }
  }
});
```

**Vue 3: 完美的TypeScript支持**
```typescript
// Vue 3
import { defineComponent, ref, computed } from 'vue';

export default defineComponent({
  setup() {
    const count = ref(0);  // Ref<number>
    const doubleCount = computed(() => count.value * 2);  // ComputedRef<number>

    const increment = () => {
      count.value++;  // 完美的类型提示
    };

    return {
      count,
      doubleCount,
      increment
    };
  }
});
```

#### 10. 其他改进

**移除的API:**
```javascript
// Vue 2
Vue.filter('capitalize', value => value.toUpperCase());
Vue.set(obj, key, value);
Vue.delete(obj, key);
this.$on('event', handler);
this.$off('event');
this.$once('event', handler);

// Vue 3: 移除了
// 使用computed、reactive、event emitter库替代
```

**新增API:**
```javascript
// watchEffect: 自动追踪依赖
import { ref, watchEffect } from 'vue';

const count = ref(0);
watchEffect(() => {
  console.log(count.value);  // 自动追踪count
});

// defineAsyncComponent: 定义异步组件
import { defineAsyncComponent } from 'vue';

const AsyncComp = defineAsyncComponent(() =>
  import('./components/AsyncComponent.vue')
);
```

#### 性能对比

| 指标 | Vue 2 | Vue 3 | 提升 |
|-----|-------|-------|------|
| 首次渲染 | 1x | 1.3-2x | 30-100% |
| 更新性能 | 1x | 1.3-1.9x | 30-90% |
| 内存占用 | 1x | 0.8x | 减少20% |
| 包体积(gzip) | 23KB | 13.5KB | 减少40% |

#### 迁移建议

1. **渐进式迁移:** Vue 3支持大部分Vue 2语法
2. **使用@vue/compat:** 兼容模式帮助迁移
3. **优先迁移新功能:** 用Composition API重写新组件
4. **工具支持:** 使用eslint-plugin-vue检查不兼容代码

## 9. Vue的computed和watch的区别

**问题:** Vue的computed和watch有什么区别?

**考察要点:** 响应式系统,计算属性缓存,侦听器应用场景

### 解答(详见 [14-补充问题.md](./14-补充问题.md#1-vue的watch和computed的区别))

核心区别:
1. **computed有缓存,watch无缓存**
2. **computed必须有返回值,watch不需要**
3. **computed不支持异步,watch支持异步**
4. **computed用于模板渲染,watch用于数据变化响应**

## 10. Vue的SSR原理

**问题:** Vue的SSR(服务端渲染)原理是什么?

**考察要点:** 服务端渲染,首屏优化,SEO,同构应用

### 解答

#### SSR vs CSR

**CSR(Client Side Rendering)客户端渲染:**
```
浏览器请求 -> 服务器返回空HTML + JS bundle
-> 浏览器下载JS -> 执行JS -> 渲染页面

问题:
1. 首屏加载慢(需要下载和执行大量JS)
2. SEO不友好(搜索引擎爬虫看不到内容)
3. 白屏时间长
```

**SSR(Server Side Rendering)服务端渲染:**
```
浏览器请求 -> 服务器执行Vue应用 -> 生成HTML
-> 返回完整HTML(含内容) -> 浏览器显示(首屏快)
-> 下载JS -> Hydration(激活) -> 完全交互

优势:
1. 首屏加载快(服务器直接返回HTML)
2. SEO友好(HTML中包含完整内容)
3. 更好的用户体验
```

#### Vue SSR架构

```javascript
// 1. entry-client.js - 客户端入口
import { createApp } from './app';

const { app, router } = createApp();

router.isReady().then(() => {
  // 挂载应用(hydration)
  app.mount('#app');
});

// 2. entry-server.js - 服务端入口
import { createApp } from './app';
import { renderToString } from '@vue/server-renderer';

export async function render(url) {
  const { app, router } = createApp();

  // 设置路由
  router.push(url);
  await router.isReady();

  // 渲染为HTML字符串
  const html = await renderToString(app);

  return html;
}

// 3. app.js - 通用应用代码
import { createSSRApp } from 'vue';
import { createRouter } from './router';
import { createStore } from './store';

export function createApp() {
  const app = createSSRApp(App);
  const router = createRouter();
  const store = createStore();

  app.use(router);
  app.use(store);

  return { app, router, store };
}
```

#### 服务器端实现

```javascript
// server.js
import express from 'express';
import { render } from './entry-server.js';
import fs from 'fs';

const app = express();
const template = fs.readFileSync('./index.html', 'utf-8');

app.get('*', async (req, res) => {
  try {
    // 1. 渲染Vue应用为HTML
    const appHtml = await render(req.url);

    // 2. 注入到模板
    const html = template.replace('<!--app-html-->', appHtml);

    // 3. 返回完整HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000);
```

#### HTML模板

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Vue SSR App</title>
</head>
<body>
  <div id="app"><!--app-html--></div>
  <script src="/client-bundle.js"></script>
</body>
</html>
```

#### 数据预取

```javascript
// 组件中定义asyncData方法
export default {
  async asyncData({ route, store }) {
    // 在服务端和客户端都会调用
    const data = await fetch(`/api/user/${route.params.id}`).then(r => r.json());
    store.commit('setUser', data);
    return { user: data };
  }
};

// 服务端渲染时
const { app, router, store } = createApp();
router.push(url);
await router.isReady();

// 获取匹配的组件
const matchedComponents = router.currentRoute.value.matched
  .flatMap(record => Object.values(record.components));

// 调用asyncData
await Promise.all(
  matchedComponents.map(component => {
    if (component.asyncData) {
      return component.asyncData({ route: router.currentRoute.value, store });
    }
  })
);

// 将store状态序列化并注入HTML
const state = store.state;
const html = template.replace(
  '<!--app-html-->',
  `<script>window.__INITIAL_STATE__=${JSON.stringify(state)}</script>${appHtml}`
);
```

#### 客户端激活(Hydration)

```javascript
// entry-client.js
import { createApp } from './app';

const { app, router, store } = createApp();

// 恢复服务端状态
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__);
}

router.isReady().then(() => {
  // Hydration: 将静态HTML激活为可交互的Vue应用
  app.mount('#app', true);  // true表示hydration模式
});
```

#### Hydration过程

```javascript
// Vue内部的hydration过程(简化版)
function hydrate(vnode, container) {
  // 1. 遍历服务端渲染的DOM
  // 2. 将DOM节点与虚拟节点关联
  // 3. 添加事件监听器
  // 4. 激活响应式数据

  const el = container.firstChild;

  // 验证节点类型匹配
  if (vnode.type !== el.tagName.toLowerCase()) {
    console.warn('Hydration mismatch');
    // 删除旧节点,重新渲染
    return mount(vnode, container);
  }

  // 关联DOM和VNode
  vnode.el = el;

  // 添加事件监听
  if (vnode.props) {
    for (const key in vnode.props) {
      if (key.startsWith('on')) {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, vnode.props[key]);
      }
    }
  }

  // 递归处理子节点
  if (vnode.children) {
    hydrateChildren(vnode.children, el);
  }
}
```

#### SSR注意事项

**1. 生命周期限制**
```javascript
export default {
  // ✅ SSR会执行
  setup() {},
  beforeCreate() {},
  created() {},

  // ❌ SSR不会执行(仅客户端)
  beforeMount() {},
  mounted() {},
  beforeUpdate() {},
  updated() {},
  beforeUnmount() {},
  unmounted() {}
};
```

**2. 避免使用浏览器API**
```javascript
// ❌ 错误: 服务端没有window对象
export default {
  created() {
    window.addEventListener('scroll', this.handleScroll);
  }
};

// ✅ 正确: 只在客户端使用
export default {
  mounted() {
    // mounted只在客户端执行
    window.addEventListener('scroll', this.handleScroll);
  }
};

// ✅ 或者判断环境
export default {
  created() {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.handleScroll);
    }
  }
};
```

**3. 避免状态污染**
```javascript
// ❌ 错误: 全局单例
const store = createStore();

export default function createApp() {
  const app = createSSRApp(App);
  app.use(store);  // 所有请求共享同一个store
  return app;
}

// ✅ 正确: 每个请求创建新实例
export default function createApp() {
  const app = createSSRApp(App);
  const store = createStore();  // 每次创建新store
  app.use(store);
  return { app, store };
}
```

#### 性能优化

**1. 组件级缓存**
```javascript
import LRU from 'lru-cache';

const cache = new LRU({
  max: 100,
  maxAge: 1000 * 60 * 5  // 5分钟
});

// 缓存组件渲染结果
const { serverPrefetch } = component;
component.serverPrefetch = async function() {
  const key = this.$route.fullPath;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const result = await serverPrefetch.call(this);
  cache.set(key, result);
  return result;
};
```

**2. 页面级缓存**
```javascript
const pageCache = new LRU({
  max: 100,
  maxAge: 1000 * 60 * 5
});

app.get('*', async (req, res) => {
  const key = req.url;
  const cached = pageCache.get(key);

  if (cached) {
    return res.send(cached);
  }

  const html = await render(req.url);
  pageCache.set(key, html);
  res.send(html);
});
```

**3. 流式渲染**
```javascript
import { renderToNodeStream } from '@vue/server-renderer';

app.get('*', async (req, res) => {
  const { app } = createApp();

  res.setHeader('Content-Type', 'text/html');

  // 发送HTML头部
  res.write('<!DOCTYPE html><html><head>...</head><body><div id="app">');

  // 流式渲染
  const stream = renderToNodeStream(app);
  stream.pipe(res, { end: false });

  stream.on('end', () => {
    // 发送HTML尾部
    res.end('</div><script src="/client-bundle.js"></script></body></html>');
  });
});
```

#### Nuxt.js框架

Nuxt.js是Vue的SSR框架,简化了SSR配置:

```javascript
// nuxt.config.js
export default {
  // SSR配置
  ssr: true,

  // 自动路由
  // pages/index.vue -> /
  // pages/user/[id].vue -> /user/:id

  // 异步数据
  async asyncData({ params, $axios }) {
    const user = await $axios.$get(`/api/user/${params.id}`);
    return { user };
  }
};
```

#### SSR适用场景

**适合SSR:**
- 内容型网站(博客、新闻)
- 需要SEO的网站
- 首屏性能要求高
- 用户体验要求高

**不适合SSR:**
- 管理后台(不需要SEO)
- 实时性要求高(WebSocket为主)
- 服务器资源有限
- 开发成本考虑

#### 性能对比

| 指标 | CSR | SSR |
|-----|-----|-----|
| 首屏时间 | 慢 | 快 |
| SEO | 差 | 好 |
| 服务器负载 | 低 | 高 |
| 开发复杂度 | 低 | 高 |
| 可交互时间 | 慢 | 慢(需要hydration) |

## 11. keep-alive的作用

**问题:** Vue的keep-alive组件有什么作用?

**考察要点:** 组件缓存,性能优化,生命周期

### 解答

#### keep-alive基本用法

**定义:** keep-alive是Vue的内置组件,用于缓存组件实例,避免重复渲染。

```vue
<template>
  <!-- 缓存单个组件 -->
  <keep-alive>
    <component :is="currentComponent" />
  </keep-alive>

  <!-- 缓存router-view -->
  <keep-alive>
    <router-view />
  </keep-alive>
</template>
```

#### 生命周期变化

```vue
<template>
  <keep-alive>
    <MyComponent />
  </keep-alive>
</template>

<script>
export default {
  name: 'MyComponent',

  // 普通生命周期
  created() {
    console.log('created - 只在首次创建时调用');
  },

  mounted() {
    console.log('mounted - 只在首次挂载时调用');
  },

  unmounted() {
    console.log('unmounted - 被缓存时不会调用');
  },

  // keep-alive特有的生命周期
  activated() {
    console.log('activated - 每次从缓存中激活时调用');
  },

  deactivated() {
    console.log('deactivated - 每次被缓存时调用');
  }
};
</script>
```

#### include/exclude属性

```vue
<template>
  <!-- 只缓存name为UserList和UserDetail的组件 -->
  <keep-alive include="UserList,UserDetail">
    <router-view />
  </keep-alive>

  <!-- 缓存除了UserForm之外的所有组件 -->
  <keep-alive exclude="UserForm">
    <router-view />
  </keep-alive>

  <!-- 使用正则表达式 -->
  <keep-alive :include="/User.*/">
    <router-view />
  </keep-alive>

  <!-- 使用数组 -->
  <keep-alive :include="['UserList', 'UserDetail']">
    <router-view />
  </keep-alive>
</template>
```

#### max属性

```vue
<template>
  <!-- 最多缓存10个组件,超过后按LRU策略移除最久未使用的 -->
  <keep-alive :max="10">
    <router-view />
  </keep-alive>
</template>
```

#### 实战示例

**1. 列表页和详情页缓存**
```vue
<!-- App.vue -->
<template>
  <keep-alive include="UserList">
    <router-view />
  </keep-alive>
</template>

<!-- UserList.vue -->
<script>
export default {
  name: 'UserList',

  data() {
    return {
      list: [],
      page: 1,
      scrollTop: 0
    };
  },

  activated() {
    // 从详情页返回时,恢复滚动位置
    this.$nextTick(() => {
      window.scrollTo(0, this.scrollTop);
    });
  },

  deactivated() {
    // 跳转到详情页时,保存滚动位置
    this.scrollTop = window.scrollY;
  },

  async mounted() {
    // 首次加载数据
    await this.loadData();
  },

  methods: {
    async loadData() {
      const res = await fetch(`/api/users?page=${this.page}`);
      this.list = await res.json();
    }
  }
};
</script>
```

**2. 动态缓存控制**
```vue
<template>
  <keep-alive :include="cachedComponents">
    <router-view />
  </keep-alive>
</template>

<script>
export default {
  data() {
    return {
      cachedComponents: []
    };
  },

  watch: {
    '$route'(to, from) {
      // 根据路由meta决定是否缓存
      if (to.meta.keepAlive) {
        if (!this.cachedComponents.includes(to.name)) {
          this.cachedComponents.push(to.name);
        }
      }

      // 离开时移除缓存
      if (from.meta.noCache) {
        const index = this.cachedComponents.indexOf(from.name);
        if (index > -1) {
          this.cachedComponents.splice(index, 1);
        }
      }
    }
  }
};
</script>

<!-- 路由配置 -->
<script>
const routes = [
  {
    path: '/user/list',
    name: 'UserList',
    component: UserList,
    meta: { keepAlive: true }  // 需要缓存
  },
  {
    path: '/user/:id',
    name: 'UserDetail',
    component: UserDetail,
    meta: { keepAlive: false }  // 不缓存
  }
];
</script>
```

**3. 手动清除缓存**
```vue
<template>
  <div>
    <button @click="clearCache">清除缓存</button>

    <keep-alive ref="keepAlive" :include="cachedComponents">
      <router-view />
    </keep-alive>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cachedComponents: ['UserList', 'UserDetail']
    };
  },

  methods: {
    clearCache() {
      // Vue 2
      const cache = this.$refs.keepAlive.cache;
      const keys = this.$refs.keepAlive.keys;

      // 清除指定组件缓存
      const key = keys.find(k => cache[k].componentOptions.tag === 'UserList');
      if (key) {
        delete cache[key];
        const index = keys.indexOf(key);
        if (index > -1) {
          keys.splice(index, 1);
        }
      }

      // 或者重置include来清除所有缓存
      this.cachedComponents = [];
      this.$nextTick(() => {
        this.cachedComponents = ['UserList', 'UserDetail'];
      });
    }
  }
};
</script>
```

#### 实现原理

```javascript
// keep-alive组件简化实现
const KeepAlive = {
  name: 'keep-alive',

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  },

  setup(props, { slots }) {
    const cache = new Map();  // 缓存组件实例
    const keys = new Set();   // 缓存key集合

    // 获取当前组件
    const instance = getCurrentInstance();

    // LRU缓存策略
    function pruneCache(key) {
      if (cache.has(key)) {
        cache.delete(key);
        keys.delete(key);
      }
    }

    function pruneCacheEntry() {
      if (props.max && keys.size > parseInt(props.max)) {
        // 移除最久未使用的缓存
        const oldestKey = keys.values().next().value;
        pruneCache(oldestKey);
      }
    }

    // 监听include/exclude变化
    watch(() => [props.include, props.exclude], () => {
      // 清除不匹配的缓存
      cache.forEach((vnode, key) => {
        const name = vnode.type.name;
        if (!matches(name, props.include) || matches(name, props.exclude)) {
          pruneCache(key);
        }
      });
    });

    return () => {
      const children = slots.default?.();
      const vnode = children[0];

      if (!vnode) return null;

      const name = vnode.type.name;

      // 检查是否需要缓存
      if (
        (props.include && !matches(name, props.include)) ||
        (props.exclude && matches(name, props.exclude))
      ) {
        return vnode;
      }

      // 生成缓存key
      const key = vnode.key ?? vnode.type;

      // 从缓存中获取
      const cachedVNode = cache.get(key);

      if (cachedVNode) {
        // 使用缓存的组件实例
        vnode.component = cachedVNode.component;

        // 更新key顺序(LRU)
        keys.delete(key);
        keys.add(key);
      } else {
        // 缓存新组件
        cache.set(key, vnode);
        keys.add(key);

        // 检查max限制
        pruneCacheEntry();
      }

      // 标记为keep-alive组件
      vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;

      return vnode;
    };
  }
};

function matches(name, pattern) {
  if (Array.isArray(pattern)) {
    return pattern.includes(name);
  }
  if (typeof pattern === 'string') {
    return pattern.split(',').includes(name);
  }
  if (pattern instanceof RegExp) {
    return pattern.test(name);
  }
  return false;
}
```

#### 性能优化场景

**1. 表单页面**
```vue
<!-- 用户填写了表单,切换到其他页面后再回来,数据还在 -->
<keep-alive>
  <UserForm />
</keep-alive>
```

**2. 列表页面**
```vue
<!-- 列表页滚动位置、筛选条件、分页状态保持 -->
<keep-alive>
  <UserList />
</keep-alive>
```

**3. Tab切换**
```vue
<template>
  <div>
    <button @click="currentTab = 'Tab1'">Tab1</button>
    <button @click="currentTab = 'Tab2'">Tab2</button>

    <keep-alive>
      <component :is="currentTab" />
    </keep-alive>
  </div>
</template>
```

#### 注意事项

1. **组件必须有name属性:** include/exclude根据name匹配
2. **不能在keep-alive中使用v-if:** 使用v-show或动态组件
3. **activated/deactivated钩子:** 用于处理缓存激活/失活逻辑
4. **内存占用:** 缓存过多组件会占用内存,合理设置max

#### keep-alive的应用价值

1. **减少不必要的渲染:** 避免重复创建销毁组件
2. **保持用户状态:** 表单输入、滚动位置、筛选条件
3. **提升用户体验:** 页面切换更流畅
4. **减少API请求:** 数据保持在缓存中
