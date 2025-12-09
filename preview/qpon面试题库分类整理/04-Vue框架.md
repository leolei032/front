# Vue框架

## 1. Vue2响应式数据板的原理
**问题：** Vue2响应式数据板的原理，监测对象改变的区别

### 深度解析

#### 为什么需要响应式系统？

**传统开发的痛点：**
```javascript
// jQuery时代：手动操作DOM
let count = 0;
$('#button').click(() => {
  count++;
  $('#count').text(count); // 手动更新DOM
  if (count > 10) {
    $('#message').text('超过10了'); // 又要更新另一个DOM
  }
});

// 问题：
// 1. 数据变化需要手动更新所有相关DOM
// 2. 容易忘记更新某些地方，导致视图和数据不一致
// 3. 代码分散，难以维护
```

**Vue的解决方案：响应式系统**
```javascript
// Vue自动追踪数据依赖
export default {
  data() {
    return { count: 0 };
  },
  computed: {
    message() {
      return this.count > 10 ? '超过10了' : '';
    }
  }
};

// 修改count时，Vue自动更新所有依赖
this.count++; // DOM自动更新
```

#### Vue2响应式原理：Object.defineProperty

**核心思想：数据劫持 + 观察者模式**

```javascript
// 简化版实现，展示核心原理
function observe(data) {
  if (!data || typeof data !== 'object') return;

  Object.keys(data).forEach(key => {
    defineReactive(data, key, data[key]);
  });
}

function defineReactive(obj, key, val) {
  // 递归处理嵌套对象
  observe(val);

  // 每个属性都有一个依赖收集器
  const dep = new Dep();

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      // 依赖收集：记录谁在使用这个数据
      if (Dep.target) {
        dep.depend(); // 将Watcher添加到依赖列表
      }
      return val;
    },
    set(newVal) {
      if (newVal === val) return;

      // 新值也需要observe
      observe(newVal);
      val = newVal;

      // 通知更新：数据变了，通知所有依赖
      dep.notify();
    }
  });
}

// 依赖收集器：管理所有依赖
class Dep {
  constructor() {
    this.subs = []; // 存储所有Watcher
  }

  depend() {
    if (Dep.target) {
      this.subs.push(Dep.target);
    }
  }

  notify() {
    // 通知所有Watcher更新
    this.subs.forEach(sub => sub.update());
  }
}

// 观察者：连接数据和视图
class Watcher {
  constructor(vm, exp, cb) {
    this.vm = vm;
    this.exp = exp;
    this.cb = cb;
    this.value = this.get(); // 初始化时读取数据，触发依赖收集
  }

  get() {
    Dep.target = this; // 设置当前Watcher
    const value = this.vm[this.exp]; // 触发getter，收集依赖
    Dep.target = null;
    return value;
  }

  update() {
    const newValue = this.vm[this.exp];
    const oldValue = this.value;
    if (newValue !== oldValue) {
      this.value = newValue;
      this.cb.call(this.vm, newValue, oldValue); // 执行回调更新视图
    }
  }
}
```

**实际运行流程：**
```javascript
// 1. 初始化
const vm = new Vue({
  data: {
    message: 'Hello'
  },
  template: '<div>{{ message }}</div>'
});

// 2. 数据劫持：defineReactive(vm.data, 'message', 'Hello')
// 3. 编译模板：创建Watcher
new Watcher(vm, 'message', (newVal) => {
  // 更新DOM
  updateDOM(newVal);
});

// 4. Watcher执行get()，触发message的getter
// 5. getter中dep.depend()将Watcher添加到依赖列表

// 6. 修改数据
vm.message = 'World';

// 7. 触发setter
// 8. setter中dep.notify()通知所有Watcher
// 9. Watcher执行update()更新视图
```

#### Object.defineProperty的局限性

**场景1：新增属性检测不到**
```javascript
// 实际开发中的问题
export default {
  data() {
    return {
      user: {
        name: 'John'
      }
    };
  },
  mounted() {
    // ❌ 新增age属性，不会触发更新
    this.user.age = 30;
    // 结果：data中有age，但视图不更新

    // 原因：defineProperty在data初始化时就完成了
    // 后来新增的属性没有被defineProperty处理

    // ✅ 解决方案1：$set
    this.$set(this.user, 'age', 30);

    // ✅ 解决方案2：初始化时声明
    data() {
      return {
        user: {
          name: 'John',
          age: null // 先声明
        }
      };
    }
  }
};
```

**场景2：数组索引修改检测不到**
```javascript
export default {
  data() {
    return {
      items: ['a', 'b', 'c']
    };
  },
  methods: {
    updateItem() {
      // ❌ 通过索引修改，不会触发更新
      this.items[0] = 'x';

      // 原因：defineProperty无法拦截数组索引操作
      // 因为性能考虑，Vue没有对数组索引使用defineProperty

      // ✅ 解决方案1：使用$set
      this.$set(this.items, 0, 'x');

      // ✅ 解决方案2：使用数组方法
      this.items.splice(0, 1, 'x');

      // ✅ 解决方案3：替换整个数组
      this.items = ['x', 'b', 'c'];
    }
  }
};
```

**Vue2对数组的特殊处理：**
```javascript
// Vue重写了7个数组方法
const arrayProto = Array.prototype;
const arrayMethods = Object.create(arrayProto);

['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(method => {
  const original = arrayProto[method];

  Object.defineProperty(arrayMethods, method, {
    value: function(...args) {
      // 执行原始方法
      const result = original.apply(this, args);

      // 获取Observer实例
      const ob = this.__ob__;

      // 新增的元素也需要observe
      let inserted;
      switch (method) {
        case 'push':
        case 'unshift':
          inserted = args;
          break;
        case 'splice':
          inserted = args.slice(2);
          break;
      }

      if (inserted) ob.observeArray(inserted);

      // 通知更新
      ob.dep.notify();

      return result;
    },
    enumerable: false,
    writable: true,
    configurable: true
  });
});

// 使用示例
const arr = [1, 2, 3];
arr.__proto__ = arrayMethods;

arr.push(4); // ✅ 触发更新
arr[0] = 10; // ❌ 不触发更新
arr.length = 0; // ❌ 不触发更新
```

#### Vue3的Proxy解决方案

**为什么Vue3切换到Proxy？**
```javascript
// Proxy可以拦截更多操作
const state = new Proxy(target, {
  get(target, key, receiver) {
    track(target, key); // 依赖收集
    return Reflect.get(target, key, receiver);
  },

  set(target, key, value, receiver) {
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);

    if (oldValue !== value) {
      trigger(target, key); // 触发更新
    }

    return result;
  },

  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const result = Reflect.deleteProperty(target, key);

    if (hadKey && result) {
      trigger(target, key); // 删除也能检测
    }

    return result;
  },

  has(target, key) {
    track(target, key);
    return Reflect.has(target, key);
  },

  ownKeys(target) {
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  }
});

// Vue3中完美解决Vue2的问题
const state = reactive({
  user: { name: 'John' },
  items: [1, 2, 3]
});

// ✅ 新增属性
state.user.age = 30; // 自动响应

// ✅ 删除属性
delete state.user.name; // 自动响应

// ✅ 数组索引
state.items[0] = 10; // 自动响应

// ✅ 数组长度
state.items.length = 0; // 自动响应
```

#### 性能对比

**Object.defineProperty vs Proxy：**
```javascript
// 测试：10000个属性的对象
const data = {};
for (let i = 0; i < 10000; i++) {
  data[`key${i}`] = i;
}

// Object.defineProperty：需要遍历所有属性
console.time('defineProperty');
Object.keys(data).forEach(key => {
  let val = data[key];
  Object.defineProperty(data, key, {
    get() { return val; },
    set(newVal) { val = newVal; }
  });
});
console.timeEnd('defineProperty'); // ~50ms

// Proxy：直接代理整个对象
console.time('Proxy');
const proxy = new Proxy(data, {
  get(target, key) { return target[key]; },
  set(target, key, value) { target[key] = value; return true; }
});
console.timeEnd('Proxy'); // ~0.1ms

// 结论：
// 1. 初始化：Proxy快500倍
// 2. 运行时：Proxy略慢（但可忽略）
// 3. 功能：Proxy更强大（支持新增、删除、数组索引等）
```

## 2. 如何利用saas/less做多主题配色
**问题：** 如何利用saas/less做多主题配色

### 解答

#### 方法1：CSS变量
```scss
// theme.scss
:root {
  --primary-color: #409eff;
  --text-color: #333;
  --bg-color: #fff;
}

[data-theme='dark'] {
  --primary-color: #409eff;
  --text-color: #fff;
  --bg-color: #1a1a1a;
}

// 使用
.button {
  background-color: var(--primary-color);
  color: var(--text-color);
}
```

#### 方法2：Sass混合器
```scss
// themes.scss
$themes: (
  light: (
    primary-color: #409eff,
    text-color: #333,
    bg-color: #fff
  ),
  dark: (
    primary-color: #409eff,
    text-color: #fff,
    bg-color: #1a1a1a
  )
);

@mixin themed() {
  @each $theme, $map in $themes {
    .theme-#{$theme} & {
      $theme-map: () !global;
      @each $key, $value in $map {
        $theme-map: map-merge($theme-map, ($key: $value)) !global;
      }
      @content;
      $theme-map: null !global;
    }
  }
}

@function t($key) {
  @return map-get($theme-map, $key);
}

// 使用
.button {
  @include themed() {
    background-color: t(primary-color);
    color: t(text-color);
  }
}
```

#### 方法3：动态切换class
```javascript
// Vue组件
export default {
  data() {
    return {
      theme: 'light'
    };
  },
  methods: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
    }
  }
};
```

## 3. retina屏幕的1px边框问题解决方案
**问题：** retina屏幕的1px边框问题解决方案

### 解答

#### 方案1：使用transform scale
```css
.border-1px {
  position: relative;
}

.border-1px::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: #000;
  transform: scaleY(0.5);
  transform-origin: 0 0;
}

/* 适配不同dpr */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
  .border-1px::after {
    transform: scaleY(0.5);
  }
}

@media (-webkit-min-device-pixel-ratio: 3), (min-resolution: 3dppx) {
  .border-1px::after {
    transform: scaleY(0.33);
  }
}
```

#### 方案2：使用box-shadow
```css
.border-1px {
  box-shadow: 0 0 0 0.5px #000;
}
```

#### 方案3：使用viewport + rem
```javascript
// 根据dpr设置viewport
const dpr = window.devicePixelRatio;
const scale = 1 / dpr;
const viewport = document.querySelector('meta[name="viewport"]');
viewport.content = `width=device-width,initial-scale=${scale},minimum-scale=${scale},maximum-scale=${scale}`;
```

```css
/* 直接使用1px */
.border {
  border: 1px solid #000;
}
```

#### 方案4：使用图片
```css
.border-1px {
  border: none;
  background: url('data:image/png;base64,...') repeat-x left bottom;
  background-size: 100% 1px;
}
```

#### 方案5：使用SVG
```css
.border-1px {
  background: none;
  border: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='1'%3E%3Cline x1='0' y1='0' x2='100%25' y2='0' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  background-position: left bottom;
}
```

## 4. 如何利用$nextTick解决retina的效果
**问题：** 如何利用$nextTick解决retina的效果？viewPort的理解等

### 解答

#### $nextTick的使用
```javascript
// Vue组件
export default {
  methods: {
    updateData() {
      this.message = 'Updated';

      // DOM还没更新
      console.log(this.$el.textContent); // 旧值

      // 等待DOM更新完成
      this.$nextTick(() => {
        console.log(this.$el.textContent); // 新值

        // 在这里进行DOM相关操作，如测量尺寸
        const height = this.$el.offsetHeight;
      });
    }
  }
};
```

#### viewport理解
```html
<!-- viewport配置 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**参数说明：**
- `width=device-width`：视口宽度等于设备宽度
- `initial-scale=1.0`：初始缩放比例为1
- `maximum-scale=1.0`：最大缩放比例
- `minimum-scale=1.0`：最小缩放比例
- `user-scalable=no`：禁止用户缩放

#### 结合retina屏幕
```javascript
// 动态设置viewport
const setupViewport = () => {
  const dpr = window.devicePixelRatio || 1;
  const scale = 1 / dpr;

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.content = `width=device-width,initial-scale=${scale},maximum-scale=${scale},minimum-scale=${scale},user-scalable=no`;
  }

  // 设置根元素字体大小
  const docEl = document.documentElement;
  const clientWidth = docEl.clientWidth;
  docEl.style.fontSize = (clientWidth * dpr / 10) + 'px';
};

// Vue中使用
export default {
  mounted() {
    setupViewport();

    this.$nextTick(() => {
      // 确保viewport设置生效后再进行DOM操作
      this.initLayout();
    });
  }
};
```

## 5. 如何用模块化和iconset改造
**问题：** 如何用模块化和iconset改造

### 解答

#### 使用SVG Sprite
```javascript
// 1. 创建svg-icon组件
// components/SvgIcon.vue
<template>
  <svg :class="svgClass" aria-hidden="true">
    <use :xlink:href="iconName"></use>
  </svg>
</template>

<script>
export default {
  name: 'SvgIcon',
  props: {
    iconClass: {
      type: String,
      required: true
    },
    className: {
      type: String,
      default: ''
    }
  },
  computed: {
    iconName() {
      return `#icon-${this.iconClass}`;
    },
    svgClass() {
      if (this.className) {
        return 'svg-icon ' + this.className;
      } else {
        return 'svg-icon';
      }
    }
  }
};
</script>

<style scoped>
.svg-icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}
</style>
```

```javascript
// 2. 自动导入所有svg图标
// icons/index.js
const req = require.context('./svg', false, /\.svg$/);
const requireAll = requireContext => requireContext.keys().map(requireContext);
requireAll(req);
```

```javascript
// 3. 配置webpack
// vue.config.js
module.exports = {
  chainWebpack: config => {
    // 排除icons目录
    config.module
      .rule('svg')
      .exclude.add(resolve('src/icons'))
      .end();

    // 使用svg-sprite-loader
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
      .end();
  }
};
```

```javascript
// 4. 全局注册组件
// main.js
import SvgIcon from '@/components/SvgIcon';
import '@/icons';

Vue.component('svg-icon', SvgIcon);
```

```vue
<!-- 5. 使用 -->
<template>
  <svg-icon icon-class="user" />
  <svg-icon icon-class="setting" class="custom-class" />
</template>
```

#### 使用Iconfont
```javascript
// 1. 引入iconfont
// main.js
import './assets/iconfont/iconfont.css';

// 2. 创建Icon组件
// components/Icon.vue
<template>
  <i :class="['iconfont', iconClass]"></i>
</template>

<script>
export default {
  props: {
    type: {
      type: String,
      required: true
    }
  },
  computed: {
    iconClass() {
      return `icon-${this.type}`;
    }
  }
};
</script>
```

## 6. CSS样式管理
**问题：** 对rem、em、vw单位的理解

### 解答

#### rem
- **定义**：相对于根元素(html)的font-size
- **特点**：全局统一基准，方便整体缩放

```css
html {
  font-size: 16px; /* 1rem = 16px */
}

.box {
  width: 10rem; /* 160px */
  font-size: 1.5rem; /* 24px */
}
```

```javascript
// 动态设置rem基准
function setRem() {
  const baseSize = 16;
  const scale = document.documentElement.clientWidth / 375;
  document.documentElement.style.fontSize = baseSize * Math.min(scale, 2) + 'px';
}

window.addEventListener('resize', setRem);
setRem();
```

#### em
- **定义**：相对于父元素的font-size
- **特点**：相对父元素，可能造成层层嵌套计算复杂

```css
.parent {
  font-size: 16px;
}

.child {
  font-size: 1.5em; /* 24px (16 * 1.5) */
  padding: 1em; /* 24px (相对于自身font-size) */
}

.grandchild {
  font-size: 0.5em; /* 12px (24 * 0.5) */
}
```

#### vw/vh
- **定义**：相对于视口宽度/高度的百分比
- **特点**：直接相对于视口，不受父元素影响

```css
.box {
  width: 50vw; /* 视口宽度的50% */
  height: 50vh; /* 视口高度的50% */
  font-size: 3.75vw; /* 375px设计稿上14px: 14/375*100 */
}
```

#### 单位对比

| 单位 | 参考基准 | 适用场景 | 优点 | 缺点 |
|-----|---------|---------|------|------|
| px | 固定像素 | 精确控制 | 精确 | 不响应式 |
| rem | 根元素font-size | 整体缩放 | 统一基准 | 需要JS动态设置 |
| em | 父元素font-size | 局部缩放 | 灵活 | 层层嵌套复杂 |
| vw/vh | 视口尺寸 | 响应式布局 | 直接响应 | 兼容性稍差 |
| % | 父元素尺寸 | 自适应 | 灵活 | 参考值不一致 |

#### 实践建议
```scss
// 使用PostCSS自动转换px为rem
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-pxtorem': {
      rootValue: 16,
      propList: ['*']
    }
  }
};

// 源码
.box {
  width: 160px;
  font-size: 24px;
}

// 编译后
.box {
  width: 10rem;
  font-size: 1.5rem;
}
```

## 7. Vue组件之间的通信方式
**问题：** Vue组件之间的通信方式

### 解答

#### 1. Props / $emit（父子组件）
```vue
<!-- 父组件 -->
<template>
  <Child :message="msg" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { msg: 'Hello' };
  },
  methods: {
    handleUpdate(val) {
      this.msg = val;
    }
  }
};
</script>

<!-- 子组件 -->
<template>
  <button @click="$emit('update', 'New Value')">Update</button>
</template>

<script>
export default {
  props: ['message']
};
</script>
```

#### 2. $parent / $children
```javascript
// 子组件访问父组件
this.$parent.someMethod();
this.$parent.someData;

// 父组件访问子组件
this.$children[0].someMethod();
```

#### 3. $refs
```vue
<template>
  <Child ref="child" />
</template>

<script>
export default {
  mounted() {
    this.$refs.child.someMethod();
  }
};
</script>
```

#### 4. Provide / Inject（跨级组件）
```javascript
// 祖先组件
export default {
  provide() {
    return {
      theme: 'dark',
      user: this.user
    };
  }
};

// 后代组件
export default {
  inject: ['theme', 'user'],
  mounted() {
    console.log(this.theme); // 'dark'
  }
};
```

#### 5. EventBus（事件总线）
```javascript
// eventBus.js
import Vue from 'vue';
export const EventBus = new Vue();

// 组件A
EventBus.$emit('customEvent', data);

// 组件B
EventBus.$on('customEvent', data => {
  console.log(data);
});

// 销毁
EventBus.$off('customEvent');
```

#### 6. Vuex（状态管理）
```javascript
// store.js
export default new Vuex.Store({
  state: {
    count: 0
  },
  mutations: {
    increment(state) {
      state.count++;
    }
  },
  actions: {
    incrementAsync({ commit }) {
      setTimeout(() => {
        commit('increment');
      }, 1000);
    }
  }
});

// 组件中使用
this.$store.state.count;
this.$store.commit('increment');
this.$store.dispatch('incrementAsync');
```

#### 7. $attrs / $listeners
```vue
<!-- 中间组件 -->
<template>
  <GrandChild v-bind="$attrs" v-on="$listeners" />
</template>

<script>
export default {
  inheritAttrs: false
};
</script>
```

#### 通信方式选择

| 场景 | 推荐方式 |
|-----|---------|
| 父子组件 | Props / $emit |
| 子父组件 | $emit / $parent |
| 兄弟组件 | EventBus / Vuex |
| 跨级组件 | Provide/Inject / Vuex |
| 复杂状态管理 | Vuex |
