# JavaScript 深度进阶面试题

## 1. 两个对象如何比较

### 深度解析

对象比较是JavaScript中的高频难点，涉及值比较、引用比较、深度比较等多个层面。

#### 引用比较 vs 值比较

```javascript
// 引用比较（浅比较）
const obj1 = { name: 'John' };
const obj2 = { name: 'John' };
const obj3 = obj1;

console.log(obj1 === obj2);  // false - 不同引用
console.log(obj1 === obj3);  // true  - 相同引用

// 问题：为什么引用不同？
// 深层原因：JavaScript中对象存储在堆内存中，变量存储的是指向堆内存的指针
// obj1和obj2虽然内容相同，但指向不同的内存地址
```

#### 浅比较实现（React中的策略）

```javascript
function shallowEqual(obj1, obj2) {
  // 1. 处理相同引用
  if (obj1 === obj2) return true;

  // 2. 处理null和undefined
  if (obj1 == null || obj2 == null) return false;

  // 3. 处理非对象类型
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return obj1 === obj2;
  }

  // 4. 获取所有key
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // 5. 比较key数量
  if (keys1.length !== keys2.length) return false;

  // 6. 比较每个key的值（只比较一层）
  for (let key of keys1) {
    if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

// 测试
const a = { x: 1, y: { z: 2 } };
const b = { x: 1, y: { z: 2 } };
console.log(shallowEqual(a, b));  // false - y指向不同对象

const c = { x: 1, y: a.y };
console.log(shallowEqual(a, c));  // true - y是相同引用
```

**为什么React使用浅比较？**
1. **性能考虑**：深度比较成本高，O(n)复杂度
2. **不可变数据**：配合immutable数据结构，浅比较足够
3. **可预测性**：开发者明确知道何时触发更新

#### 深度比较实现（完整版）

```javascript
function deepEqual(obj1, obj2, visited = new WeakMap()) {
  // 1. 相同引用直接返回true
  if (obj1 === obj2) return true;

  // 2. null和undefined处理
  if (obj1 == null || obj2 == null) return obj1 === obj2;

  // 3. 类型检查
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    // 处理NaN的特殊情况
    if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;
    return obj1 === obj2;
  }

  // 4. 循环引用检测（关键！）
  if (visited.has(obj1)) {
    return visited.get(obj1) === obj2;
  }
  visited.set(obj1, obj2);

  // 5. 处理Date对象
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // 6. 处理RegExp对象
  if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
    return obj1.toString() === obj2.toString();
  }

  // 7. 处理数组
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;

    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i], visited)) {
        return false;
      }
    }
    return true;
  }

  // 8. 处理Map
  if (obj1 instanceof Map && obj2 instanceof Map) {
    if (obj1.size !== obj2.size) return false;

    for (let [key, value] of obj1) {
      if (!obj2.has(key) || !deepEqual(value, obj2.get(key), visited)) {
        return false;
      }
    }
    return true;
  }

  // 9. 处理Set
  if (obj1 instanceof Set && obj2 instanceof Set) {
    if (obj1.size !== obj2.size) return false;

    for (let item of obj1) {
      if (!obj2.has(item)) return false;
    }
    return true;
  }

  // 10. 处理普通对象
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  // 11. 递归比较每个属性
  for (let key of keys1) {
    if (!obj2.hasOwnProperty(key)) return false;
    if (!deepEqual(obj1[key], obj2[key], visited)) return false;
  }

  return true;
}

// 测试各种情况
console.log(deepEqual(
  { a: 1, b: { c: 2 } },
  { a: 1, b: { c: 2 } }
));  // true

// 循环引用测试
const circular1 = { name: 'circular' };
circular1.self = circular1;
const circular2 = { name: 'circular' };
circular2.self = circular2;
console.log(deepEqual(circular1, circular2));  // true

// Date测试
console.log(deepEqual(
  { date: new Date('2024-01-01') },
  { date: new Date('2024-01-01') }
));  // true

// 数组测试
console.log(deepEqual([1, [2, 3]], [1, [2, 3]]));  // true
```

#### 性能优化版本

```javascript
function optimizedDeepEqual(obj1, obj2) {
  // 使用JSON.stringify快速路径（有限制）
  try {
    const str1 = JSON.stringify(obj1, Object.keys(obj1).sort());
    const str2 = JSON.stringify(obj2, Object.keys(obj2).sort());
    return str1 === str2;
  } catch (e) {
    // 处理循环引用等情况，回退到深度比较
    return deepEqual(obj1, obj2);
  }
}

// JSON.stringify的限制：
// 1. 无法处理循环引用
// 2. 无法处理function
// 3. 无法处理undefined（会被忽略）
// 4. 无法处理Symbol
// 5. Date会被转为字符串
```

#### 实战应用

**1. React组件优化**
```javascript
class ExpensiveComponent extends React.PureComponent {
  // PureComponent内部使用shallowEqual
  render() {
    console.log('Rendering ExpensiveComponent');
    return <div>{this.props.data.value}</div>;
  }
}

// 问题：如果data是新对象，即使值相同也会重渲染
function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 每次都创建新对象，导致子组件重渲染
  const data = { value: 'constant' };

  // ✅ 使用useMemo保持引用
  const data = useMemo(() => ({ value: 'constant' }), []);

  return <ExpensiveComponent data={data} />;
}
```

**2. Redux中的状态比较**
```javascript
// Redux connect使用浅比较检测props变化
const mapStateToProps = (state) => ({
  user: state.user,  // ✅ 返回引用，浅比较有效
  // ❌ 每次都创建新对象
  userData: {
    name: state.user.name,
    age: state.user.age
  }
});

// 优化版本：使用reselect
import { createSelector } from 'reselect';

const getUserData = createSelector(
  [state => state.user.name, state => state.user.age],
  (name, age) => ({ name, age })  // 只有name或age变化时才返回新对象
);
```

**3. 缓存策略**
```javascript
class DataCache {
  constructor() {
    this.cache = new Map();
  }

  get(params) {
    // 使用深度比较查找缓存
    for (let [cachedParams, result] of this.cache) {
      if (deepEqual(params, cachedParams)) {
        console.log('Cache hit!');
        return result;
      }
    }
    return null;
  }

  set(params, result) {
    this.cache.set(params, result);
  }
}

// 使用
const cache = new DataCache();

async function fetchData(params) {
  const cached = cache.get(params);
  if (cached) return cached;

  const result = await fetch('/api/data', {
    method: 'POST',
    body: JSON.stringify(params)
  }).then(r => r.json());

  cache.set(params, result);
  return result;
}

// 两次调用使用缓存
await fetchData({ id: 1, filter: 'active' });
await fetchData({ id: 1, filter: 'active' });  // 使用缓存
```

## 2. JS的原型和原型链

### 深度解析

原型链是JavaScript实现继承和属性查找的核心机制。

#### 原型的本质

```javascript
// 原型的本质：一个普通对象，用于实现属性共享
function Person(name) {
  this.name = name;
}

// 在原型上定义方法，所有实例共享
Person.prototype.sayHello = function() {
  console.log(`Hello, I'm ${this.name}`);
};

const person1 = new Person('John');
const person2 = new Person('Jane');

// 两个实例共享同一个方法
console.log(person1.sayHello === person2.sayHello);  // true

// 内存结构：
// person1 --> Person.prototype --> Object.prototype --> null
//   ↓
// { name: 'John' }
```

#### 原型链的完整图谱

```javascript
// 揭示JavaScript原型链的完整结构
function Foo() {}
const foo = new Foo();

// 1. 实例的__proto__指向构造函数的prototype
console.log(foo.__proto__ === Foo.prototype);  // true

// 2. 构造函数的prototype的__proto__指向Object.prototype
console.log(Foo.prototype.__proto__ === Object.prototype);  // true

// 3. Object.prototype的__proto__是null（原型链终点）
console.log(Object.prototype.__proto__);  // null

// 4. 函数也是对象，有自己的原型链
console.log(Foo.__proto__ === Function.prototype);  // true
console.log(Function.prototype.__proto__ === Object.prototype);  // true

// 5. Function是特殊的，它的__proto__指向自己的prototype
console.log(Function.__proto__ === Function.prototype);  // true

// 完整的原型链关系图：
/*
foo
  .__proto__ → Foo.prototype
                 .__proto__ → Object.prototype
                                .__proto__ → null

Foo
  .__proto__ → Function.prototype
                 .__proto__ → Object.prototype
                                .__proto__ → null

Function
  .__proto__ → Function.prototype (特殊！)
*/
```

#### 属性查找机制（关键）

```javascript
function Animal(name) {
  this.name = name;
  this.type = 'animal';
}

Animal.prototype.eat = function() {
  console.log(`${this.name} is eating`);
};

function Dog(name, breed) {
  Animal.call(this, name);  // 继承属性
  this.breed = breed;
}

// 继承方法
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

Dog.prototype.bark = function() {
  console.log(`${this.name} is barking`);
};

const dog = new Dog('Buddy', 'Golden Retriever');

// 属性查找顺序：
dog.bark();
// 1. 查找dog自身 → 没有bark
// 2. 查找Dog.prototype → 找到bark，执行
// 时间复杂度：O(1)

dog.eat();
// 1. 查找dog自身 → 没有eat
// 2. 查找Dog.prototype → 没有eat
// 3. 查找Animal.prototype → 找到eat，执行
// 时间复杂度：O(n)，n为原型链深度

dog.toString();
// 1. 查找dog自身 → 没有toString
// 2. 查找Dog.prototype → 没有toString
// 3. 查找Animal.prototype → 没有toString
// 4. 查找Object.prototype → 找到toString，执行

// 性能影响：原型链越长，查找越慢
```

#### 原型污染攻击（安全问题）

```javascript
// 原型污染攻击示例
const user = { name: 'John' };

// 攻击：修改Object.prototype
Object.prototype.isAdmin = true;

// 影响所有对象！
console.log(user.isAdmin);  // true
console.log({}.isAdmin);    // true

// 防御措施1：使用Object.create(null)创建纯净对象
const safeObj = Object.create(null);
safeObj.name = 'Safe';
console.log(safeObj.isAdmin);  // undefined

// 防御措施2：使用hasOwnProperty检查
function isSafe(obj, prop) {
  return obj.hasOwnProperty(prop);
}

// 防御措施3：冻结原型
Object.freeze(Object.prototype);

// 防御措施4：使用Map代替对象
const safeMap = new Map();
safeMap.set('name', 'Safe');
// Map没有原型链污染问题
```

#### 现代继承方案

```javascript
// ES6 Class语法（语法糖）
class Animal {
  constructor(name) {
    this.name = name;
  }

  eat() {
    console.log(`${this.name} is eating`);
  }

  // 静态方法
  static compare(a, b) {
    return a.name.localeCompare(b.name);
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);  // 调用父类构造函数
    this.breed = breed;
  }

  bark() {
    console.log(`${this.name} is barking`);
  }

  // 方法重写
  eat() {
    super.eat();  // 调用父类方法
    console.log('Dog specific eating');
  }
}

// 编译后的ES5代码（简化）
function _inherits(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  subClass.__proto__ = superClass;  // 继承静态方法
}

// 组合继承（最优方案）
function ComposedDog(name, breed) {
  Animal.call(this, name);  // 继承实例属性
  this.breed = breed;
}
ComposedDog.prototype = Object.create(Animal.prototype);
ComposedDog.prototype.constructor = ComposedDog;
```

#### 实战应用：插件系统

```javascript
// 基于原型链的插件系统
class PluginSystem {
  constructor() {
    this.plugins = [];
  }

  use(plugin) {
    // 插件扩展原型
    Object.assign(this.constructor.prototype, plugin);
    this.plugins.push(plugin);
  }
}

class App extends PluginSystem {
  constructor() {
    super();
    this.data = {};
  }
}

// 插件1：日志功能
const LoggerPlugin = {
  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
};

// 插件2：存储功能
const StoragePlugin = {
  save(key, value) {
    this.data[key] = value;
    this.log?.(`Saved ${key}`);
  },

  load(key) {
    return this.data[key];
  }
};

// 使用
const app = new App();
app.use(LoggerPlugin);
app.use(StoragePlugin);

app.save('name', 'John');  // 调用StoragePlugin的save
app.log('App started');     // 调用LoggerPlugin的log
```

## 3. call、apply、bind的深度对比

### 核心原理

这三个方法都用于改变函数的`this`指向，但实现方式和使用场景不同。

#### 手写call实现

```javascript
Function.prototype.myCall = function(context, ...args) {
  // 1. 处理context为null/undefined的情况
  context = context || window;  // 浏览器环境

  // 2. 防止context为原始类型
  context = Object(context);

  // 3. 使用Symbol确保不会覆盖原有属性
  const fnSymbol = Symbol('fn');
  context[fnSymbol] = this;  // this指向调用myCall的函数

  // 4. 执行函数
  const result = context[fnSymbol](...args);

  // 5. 删除临时属性
  delete context[fnSymbol];

  // 6. 返回结果
  return result;
};

// 测试
function greet(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`;
}

const person = { name: 'John' };
console.log(greet.myCall(person, 'Hello', '!'));
// "Hello, I'm John!"

// 原理解释：
// 通过将函数作为对象的方法调用，this自然指向该对象
// 等价于：person.greet('Hello', '!');
```

#### 手写apply实现

```javascript
Function.prototype.myApply = function(context, argsArray) {
  context = context || window;
  context = Object(context);

  const fnSymbol = Symbol('fn');
  context[fnSymbol] = this;

  // apply接收数组参数
  const result = Array.isArray(argsArray)
    ? context[fnSymbol](...argsArray)
    : context[fnSymbol]();

  delete context[fnSymbol];
  return result;
};

// 使用场景：参数是数组
const numbers = [5, 6, 2, 3, 7];

// 找出最大值
const max = Math.max.apply(null, numbers);
console.log(max);  // 7

// ES6替代方案
const max2 = Math.max(...numbers);
```

#### 手写bind实现（复杂）

```javascript
Function.prototype.myBind = function(context, ...bindArgs) {
  const fn = this;

  // 返回新函数
  const boundFunction = function(...callArgs) {
    // 判断是否作为构造函数调用
    // 如果是new调用，this指向新创建的对象
    // 如果是普通调用，this指向bind的context
    const isNew = this instanceof boundFunction;

    return fn.apply(
      isNew ? this : context,
      [...bindArgs, ...callArgs]
    );
  };

  // 继承原函数的原型（支持new调用）
  if (fn.prototype) {
    boundFunction.prototype = Object.create(fn.prototype);
  }

  return boundFunction;
};

// 测试普通调用
function greet(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`;
}

const person = { name: 'John' };
const boundGreet = greet.myBind(person, 'Hello');
console.log(boundGreet('!'));  // "Hello, I'm John!"

// 测试构造函数调用
function Person(name, age) {
  this.name = name;
  this.age = age;
}

const BoundPerson = Person.myBind({ name: 'Ignored' }, 'John');
const instance = new BoundPerson(25);
console.log(instance.name);  // 'John' (bind的context被忽略)
console.log(instance.age);   // 25
console.log(instance instanceof Person);  // true
```

#### 性能对比

```javascript
const obj = { name: 'Test' };
function fn() { return this.name; }

// 性能测试
console.time('call');
for (let i = 0; i < 1000000; i++) {
  fn.call(obj);
}
console.timeEnd('call');  // ~15ms

console.time('apply');
for (let i = 0; i < 1000000; i++) {
  fn.apply(obj);
}
console.timeEnd('apply');  // ~15ms

console.time('bind');
const boundFn = fn.bind(obj);
for (let i = 0; i < 1000000; i++) {
  boundFn();
}
console.timeEnd('bind');  // ~10ms (bind只创建一次)

// 结论：
// 1. call和apply性能相近
// 2. bind需要预先创建函数，但多次调用更快
// 3. 在循环中频繁改变this，使用call/apply
// 4. 需要固定this，使用bind
```

#### 实战应用

**1. 类数组转数组**
```javascript
function arrayLike() {
  // arguments是类数组对象

  // 方法1：使用call
  const arr1 = Array.prototype.slice.call(arguments);

  // 方法2：使用apply
  const arr2 = Array.prototype.concat.apply([], arguments);

  // 方法3：ES6
  const arr3 = Array.from(arguments);
  const arr4 = [...arguments];

  return arr1;
}

// DOM元素集合转数组
const divs = document.querySelectorAll('div');
const divsArray = Array.prototype.slice.call(divs);
```

**2. 借用方法**
```javascript
// 借用Object.prototype.toString判断类型
function getType(value) {
  return Object.prototype.toString.call(value).slice(8, -1);
}

console.log(getType([]));        // 'Array'
console.log(getType({}));        // 'Object'
console.log(getType(null));      // 'Null'
console.log(getType(undefined)); // 'Undefined'
console.log(getType(new Date())); // 'Date'
```

**3. 函数柯里化**
```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...moreArgs) {
      return curried.apply(this, [...args, ...moreArgs]);
    };
  };
}

function add(a, b, c) {
  return a + b + c;
}

const curriedAdd = curry(add);
console.log(curriedAdd(1)(2)(3));  // 6
console.log(curriedAdd(1, 2)(3));  // 6
```

**4. React事件处理**
```javascript
class Button extends React.Component {
  constructor(props) {
    super(props);
    this.state = { clicked: false };

    // 方法1：bind in constructor (推荐)
    this.handleClick1 = this.handleClick1.bind(this);
  }

  handleClick1() {
    this.setState({ clicked: true });
  }

  // 方法2：箭头函数（自动绑定）
  handleClick2 = () => {
    this.setState({ clicked: true });
  }

  render() {
    return (
      <>
        {/* 方法3：bind in render (不推荐，每次render创建新函数) */}
        <button onClick={this.handleClick1.bind(this)}>Click 1</button>

        {/* 方法4：箭头函数 in render (不推荐，同样每次创建新函数) */}
        <button onClick={() => this.handleClick1()}>Click 2</button>

        {/* 推荐：已经绑定的函数 */}
        <button onClick={this.handleClick1}>Click 3</button>
        <button onClick={this.handleClick2}>Click 4</button>
      </>
    );
  }
}
```

## 4. 防抖和节流的深度实现

### 核心区别

- **防抖（Debounce）**：延迟执行，在停止触发后才执行
- **节流（Throttle）**：限制频率，按固定间隔执行

#### 防抖的多种实现

```javascript
// 1. 基础版防抖
function debounce(func, wait) {
  let timeout;

  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// 2. 立即执行版本
function debounceImmediate(func, wait, immediate = false) {
  let timeout;

  return function(...args) {
    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) {
        func.apply(this, args);
      }
    }, wait);

    if (callNow) {
      func.apply(this, args);
    }
  };
}

// 3. 可取消版本
function debounceWithCancel(func, wait) {
  let timeout;

  const debounced = function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };

  debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}

// 4. 完整版（支持返回值）
function debounceComplete(func, wait, options = {}) {
  let timeout, result;
  const { leading = false, trailing = true, maxWait } = options;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait && timeSinceLastInvoke >= maxWait)
    );
  }

  let lastArgs, lastThis;

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (!timeout) {
        // Leading edge
        if (leading) {
          result = invokeFunc(lastCallTime);
        }
      }

      if (maxWait) {
        timeout = setTimeout(() => {
          const time = Date.now();
          if (shouldInvoke(time)) {
            result = invokeFunc(time);
          }
        }, wait);
      }
    }

    if (!timeout && trailing) {
      timeout = setTimeout(() => {
        result = invokeFunc(Date.now());
        timeout = null;
      }, wait);
    }

    return result;
  }

  debounced.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = undefined;
  };

  debounced.flush = function() {
    return timeout ? invokeFunc(Date.now()) : result;
  };

  return debounced;
}
```

#### 节流的多种实现

```javascript
// 1. 时间戳版本（立即执行）
function throttleTimestamp(func, wait) {
  let previous = 0;

  return function(...args) {
    const now = Date.now();

    if (now - previous >= wait) {
      previous = now;
      func.apply(this, args);
    }
  };
}

// 2. 定时器版本（延迟执行）
function throttleTimer(func, wait) {
  let timeout;

  return function(...args) {
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func.apply(this, args);
      }, wait);
    }
  };
}

// 3. 结合版本（首次立即，结束时再执行一次）
function throttleCombined(func, wait) {
  let timeout, previous = 0;

  return function(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

// 4. 完整版（lodash实现）
function throttleComplete(func, wait, options = {}) {
  let timeout, context, args, result;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  const later = function() {
    previous = leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  const throttled = function(...params) {
    const now = Date.now();
    if (!previous && leading === false) previous = now;

    const remaining = wait - (now - previous);
    context = this;
    args = params;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && trailing !== false) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };

  throttled.cancel = function() {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
}
```

#### 实战应用场景

**1. 搜索框输入（防抖）**
```javascript
// 用户停止输入300ms后才发起请求
const searchInput = document.getElementById('search');

const search = debounce(async (keyword) => {
  const results = await fetch(`/api/search?q=${keyword}`).then(r => r.json());
  displayResults(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  search(e.target.value);
});

// 性能对比：
// 不使用防抖：用户输入"hello"，发起5次请求
// 使用防抖：只发起1次请求（节省4次请求）
```

**2. 窗口resize（节流）**
```javascript
// 每200ms最多执行一次
const handleResize = throttle(() => {
  console.log('Window resized to:', window.innerWidth, 'x', window.innerHeight);
  // 重新计算布局
  recalculateLayout();
}, 200);

window.addEventListener('resize', handleResize);

// 性能对比：
// 不使用节流：1秒内可能触发60次（每帧一次）
// 使用节流：1秒最多触发5次（200ms间隔）
```

**3. 滚动加载（节流）**
```javascript
const handleScroll = throttle(() => {
  const scrollTop = window.pageYOffset;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // 距离底部100px时加载更多
  if (scrollTop + windowHeight >= documentHeight - 100) {
    loadMore();
  }
}, 100);

window.addEventListener('scroll', handleScroll);
```

**4. 按钮提交（防抖+节流组合）**
```javascript
// 防止用户快速点击提交按钮
const handleSubmit = debounce(
  throttle(async (formData) => {
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showSuccess('提交成功！');
      }
    } catch (error) {
      showError('提交失败，请重试');
    }
  }, 1000),  // 节流：1秒内最多提交1次
  300        // 防抖：停止点击300ms后执行
);

submitButton.addEventListener('click', () => {
  const formData = getFormData();
  handleSubmit(formData);
});
```

#### React Hooks版本

```javascript
import { useRef, useCallback, useEffect } from 'react';

// 防抖Hook
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // 保持callback最新
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}

// 节流Hook
function useThrottle(callback, delay) {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    if (timeSinceLastRun >= delay) {
      callbackRef.current(...args);
      lastRun.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastRun.current = Date.now();
      }, delay - timeSinceLastRun);
    }
  }, [delay]);
}

// 使用示例
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const debouncedSearch = useDebounce(async (searchQuery) => {
    const data = await fetch(`/api/search?q=${searchQuery}`).then(r => r.json());
    setResults(data);
  }, 300);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return (
    <div>
      <input value={query} onChange={handleInputChange} />
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

我会继续补充更多深度内容...

