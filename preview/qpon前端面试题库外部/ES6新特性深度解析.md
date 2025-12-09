# ES6新特性深度解析

## 1. 解构赋值（Destructuring）

### 数组解构

```javascript
// 基础解构
const arr = [1, 2, 3, 4, 5];
const [a, b, c] = arr;
console.log(a, b, c);  // 1 2 3

// 跳过元素
const [first, , third] = arr;
console.log(first, third);  // 1 3

// 剩余元素
const [head, ...tail] = arr;
console.log(head);  // 1
console.log(tail);  // [2, 3, 4, 5]

// 默认值
const [x = 0, y = 0] = [1];
console.log(x, y);  // 1 0

// 交换变量
let m = 1, n = 2;
[m, n] = [n, m];
console.log(m, n);  // 2 1

// 嵌套解构
const nested = [1, [2, 3], 4];
const [a1, [b1, c1], d1] = nested;
console.log(a1, b1, c1, d1);  // 1 2 3 4

// 解构原理（简化实现）
function destructureArray(pattern, array) {
  const result = {};
  let restIndex = -1;

  pattern.forEach((item, index) => {
    if (item.type === 'rest') {
      restIndex = index;
      result[item.name] = array.slice(index);
    } else if (item.type === 'identifier') {
      result[item.name] = array[index] !== undefined ? array[index] : item.default;
    }
  });

  return result;
}
```

### 对象解构

```javascript
// 基础解构
const person = { name: 'John', age: 30, city: 'New York' };
const { name, age } = person;
console.log(name, age);  // 'John' 30

// 重命名
const { name: personName, age: personAge } = person;
console.log(personName, personAge);  // 'John' 30

// 默认值
const { name, country = 'USA' } = person;
console.log(country);  // 'USA'

// 剩余属性
const { name: n, ...rest } = person;
console.log(rest);  // { age: 30, city: 'New York' }

// 嵌套解构
const user = {
  id: 1,
  profile: {
    name: 'Alice',
    contact: {
      email: 'alice@example.com',
      phone: '123-456'
    }
  }
};

const {
  id,
  profile: {
    name,
    contact: { email }
  }
} = user;

console.log(id, name, email);  // 1 'Alice' 'alice@example.com'

// 函数参数解构
function greet({ name, age = 18 }) {
  console.log(`Hello ${name}, you are ${age} years old`);
}

greet({ name: 'Tom' });  // "Hello Tom, you are 18 years old"
greet({ name: 'Jerry', age: 25 });  // "Hello Jerry, you are 25 years old"

// 数组和对象混合解构
const data = {
  users: [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
  ]
};

const { users: [{ name: firstName }, { name: secondName }] } = data;
console.log(firstName, secondName);  // 'Alice' 'Bob'
```

### 实战应用

```javascript
// 1. 提取API响应数据
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  const {
    data: { user },
    meta: { timestamp }
  } = await response.json();

  return { user, timestamp };
}

// 2. React Hooks
function UserProfile() {
  const [{ data, loading, error }, setState] = React.useState({
    data: null,
    loading: true,
    error: null
  });

  // ...
}

// 3. 配置对象
function createServer({
  port = 3000,
  host = 'localhost',
  ssl = false,
  ssl: { cert, key } = {}
}) {
  // 使用配置
}

// 4. 模块导入
import { useState, useEffect, useMemo } from 'react';

// 5. 函数返回多个值
function getCoordinates() {
  return { x: 10, y: 20 };
}

const { x, y } = getCoordinates();
```

## 2. 扩展运算符（Spread Operator）

### 数组扩展

```javascript
// 展开数组
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];

// 合并数组
const merged = [...arr1, ...arr2];
console.log(merged);  // [1, 2, 3, 4, 5, 6]

// 复制数组（浅拷贝）
const copy = [...arr1];
copy[0] = 999;
console.log(arr1[0]);  // 1 (原数组未改变)

// 添加元素
const withNew = [0, ...arr1, 4];
console.log(withNew);  // [0, 1, 2, 3, 4]

// 转换类数组为数组
function toArray() {
  return [...arguments];
}
console.log(toArray(1, 2, 3));  // [1, 2, 3]

// 字符串转数组
const str = 'hello';
const chars = [...str];
console.log(chars);  // ['h', 'e', 'l', 'l', 'o']

// Set和Map转数组
const set = new Set([1, 2, 3, 3, 4]);
const uniqueArr = [...set];
console.log(uniqueArr);  // [1, 2, 3, 4]

// 数组去重
const arr = [1, 2, 2, 3, 3, 4];
const unique = [...new Set(arr)];
console.log(unique);  // [1, 2, 3, 4]

// 找出最大值/最小值
const numbers = [5, 6, 2, 3, 7];
const max = Math.max(...numbers);
const min = Math.min(...numbers);
console.log(max, min);  // 7 2
```

### 对象扩展

```javascript
// 展开对象
const obj1 = { a: 1, b: 2 };
const obj2 = { c: 3, d: 4 };

// 合并对象
const merged = { ...obj1, ...obj2 };
console.log(merged);  // { a: 1, b: 2, c: 3, d: 4 }

// 属性覆盖
const obj3 = { a: 1, b: 2 };
const obj4 = { b: 3, c: 4 };
const merged2 = { ...obj3, ...obj4 };
console.log(merged2);  // { a: 1, b: 3, c: 4 }

// 复制对象（浅拷贝）
const original = { name: 'John', age: 30 };
const copy = { ...original };
copy.age = 31;
console.log(original.age);  // 30

// 添加/修改属性
const user = { name: 'John', age: 30 };
const updatedUser = { ...user, age: 31, city: 'NYC' };
console.log(updatedUser);  // { name: 'John', age: 31, city: 'NYC' }

// 条件属性
const shouldIncludeEmail = true;
const user2 = {
  name: 'Alice',
  ...(shouldIncludeEmail && { email: 'alice@example.com' })
};
console.log(user2);  // { name: 'Alice', email: 'alice@example.com' }

// 移除属性
const { age, ...rest } = user;
console.log(rest);  // { name: 'John' }
```

### 实战应用

```javascript
// 1. Redux reducer（不可变更新）
function todoReducer(state = [], action) {
  switch (action.type) {
    case 'ADD_TODO':
      return [...state, action.payload];

    case 'REMOVE_TODO':
      return state.filter(todo => todo.id !== action.payload);

    case 'UPDATE_TODO':
      return state.map(todo =>
        todo.id === action.payload.id
          ? { ...todo, ...action.payload.updates }
          : todo
      );

    default:
      return state;
  }
}

// 2. React state更新
function Component() {
  const [state, setState] = React.useState({
    user: { name: 'John', age: 30 },
    settings: { theme: 'dark' }
  });

  const updateUserAge = (newAge) => {
    setState(prevState => ({
      ...prevState,
      user: {
        ...prevState.user,
        age: newAge
      }
    }));
  };
}

// 3. 合并配置对象
const defaultConfig = {
  timeout: 5000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json'
  }
};

function request(url, userConfig = {}) {
  const config = {
    ...defaultConfig,
    ...userConfig,
    headers: {
      ...defaultConfig.headers,
      ...userConfig.headers
    }
  };

  return fetch(url, config);
}

// 4. 数组拼接性能对比
// ❌ 较慢
const result1 = arr1.concat(arr2).concat(arr3);

// ✓ 更快
const result2 = [...arr1, ...arr2, ...arr3];

// 5. 深拷贝（浅层实现）
function shallowClone(obj) {
  if (Array.isArray(obj)) {
    return [...obj];
  }
  if (obj && typeof obj === 'object') {
    return { ...obj };
  }
  return obj;
}
```

## 3. Symbol和Symbol的应用

### Symbol基础

```javascript
// 创建Symbol
const sym1 = Symbol();
const sym2 = Symbol();

console.log(sym1 === sym2);  // false (每个Symbol都是唯一的)

// 带描述的Symbol
const sym3 = Symbol('description');
console.log(sym3.toString());  // 'Symbol(description)'

// Symbol.for() - 全局Symbol注册表
const globalSym1 = Symbol.for('app.id');
const globalSym2 = Symbol.for('app.id');
console.log(globalSym1 === globalSym2);  // true

// Symbol.keyFor() - 获取全局Symbol的key
console.log(Symbol.keyFor(globalSym1));  // 'app.id'

// Symbol作为对象属性
const id = Symbol('id');
const user = {
  name: 'John',
  [id]: 12345  // Symbol属性
};

console.log(user[id]);  // 12345
console.log(user.id);   // undefined

// Symbol属性不会被遍历
console.log(Object.keys(user));  // ['name']
console.log(Object.getOwnPropertyNames(user));  // ['name']

// 获取Symbol属性
console.log(Object.getOwnPropertySymbols(user));  // [Symbol(id)]
console.log(Reflect.ownKeys(user));  // ['name', Symbol(id)]
```

### 内置Symbol

```javascript
// Symbol.iterator - 使对象可迭代
const iterableObj = {
  data: [1, 2, 3],
  [Symbol.iterator]() {
    let index = 0;
    const data = this.data;

    return {
      next() {
        if (index < data.length) {
          return { value: data[index++], done: false };
        }
        return { done: true };
      }
    };
  }
};

for (const value of iterableObj) {
  console.log(value);  // 1, 2, 3
}

// Symbol.toStringTag - 自定义类型标签
class MyClass {
  get [Symbol.toStringTag]() {
    return 'MyClass';
  }
}

const instance = new MyClass();
console.log(Object.prototype.toString.call(instance));  // '[object MyClass]'

// Symbol.hasInstance - 自定义instanceof行为
class MyArray {
  static [Symbol.hasInstance](instance) {
    return Array.isArray(instance);
  }
}

console.log([] instanceof MyArray);  // true

// Symbol.toPrimitive - 自定义类型转换
const obj = {
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return 42;
    if (hint === 'string') return 'hello';
    return true;
  }
};

console.log(+obj);     // 42 (number)
console.log(`${obj}`); // 'hello' (string)
console.log(obj + ''); // 'true' (default)
```

### 实战应用

```javascript
// 1. 私有属性（虽然不是真正的私有）
const _private = Symbol('private');

class BankAccount {
  constructor(balance) {
    this[_private] = { balance };
  }

  deposit(amount) {
    this[_private].balance += amount;
  }

  getBalance() {
    return this[_private].balance;
  }
}

const account = new BankAccount(1000);
account.deposit(500);
console.log(account.getBalance());  // 1500
console.log(account[_private]);  // { balance: 1500 } (仍可访问，但不容易被发现)

// 2. 防止属性名冲突
// 场景：多个库为对象添加方法
const myLibraryMethod = Symbol('myLibrary.method');

Object.prototype[myLibraryMethod] = function() {
  console.log('My library method');
};

// 不会与其他库冲突
const obj = {};
obj[myLibraryMethod]();

// 3. 单例模式
const getInstance = (function() {
  const instance = Symbol('instance');

  class Singleton {
    constructor() {
      if (Singleton[instance]) {
        return Singleton[instance];
      }
      Singleton[instance] = this;
    }
  }

  return () => new Singleton();
})();

const s1 = getInstance();
const s2 = getInstance();
console.log(s1 === s2);  // true

// 4. 枚举值
const Colors = {
  RED: Symbol('red'),
  GREEN: Symbol('green'),
  BLUE: Symbol('blue')
};

function getColorName(color) {
  switch (color) {
    case Colors.RED:
      return 'Red';
    case Colors.GREEN:
      return 'Green';
    case Colors.BLUE:
      return 'Blue';
    default:
      return 'Unknown';
  }
}

console.log(getColorName(Colors.RED));  // 'Red'
```

## 4. Iterator和Generator

### Iterator迭代器

```javascript
// Iterator协议
const iterator = {
  data: [1, 2, 3],
  index: 0,

  next() {
    if (this.index < this.data.length) {
      return {
        value: this.data[this.index++],
        done: false
      };
    }
    return { done: true };
  }
};

console.log(iterator.next());  // { value: 1, done: false }
console.log(iterator.next());  // { value: 2, done: false }
console.log(iterator.next());  // { value: 3, done: false }
console.log(iterator.next());  // { done: true }

// 可迭代对象
const iterableObj = {
  data: ['a', 'b', 'c'],

  [Symbol.iterator]() {
    let index = 0;
    const data = this.data;

    return {
      next() {
        if (index < data.length) {
          return { value: data[index++], done: false };
        }
        return { done: true };
      }
    };
  }
};

// 使用for...of
for (const item of iterableObj) {
  console.log(item);  // 'a', 'b', 'c'
}

// 使用扩展运算符
const arr = [...iterableObj];
console.log(arr);  // ['a', 'b', 'c']

// 内置可迭代对象
// Array, String, Map, Set, arguments, NodeList等

// 自定义Range迭代器
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;

    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { done: true };
      }
    };
  }
}

const range = new Range(1, 5);
console.log([...range]);  // [1, 2, 3, 4, 5]

for (const num of range) {
  console.log(num);  // 1, 2, 3, 4, 5
}
```

### Generator生成器

```javascript
// 基础Generator
function* simpleGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

const gen = simpleGenerator();
console.log(gen.next());  // { value: 1, done: false }
console.log(gen.next());  // { value: 2, done: false }
console.log(gen.next());  // { value: 3, done: false }
console.log(gen.next());  // { done: true }

// Generator是可迭代的
for (const value of simpleGenerator()) {
  console.log(value);  // 1, 2, 3
}

// yield*委托
function* gen1() {
  yield 1;
  yield 2;
}

function* gen2() {
  yield* gen1();  // 委托给gen1
  yield 3;
}

console.log([...gen2()]);  // [1, 2, 3]

// Generator传参
function* generatorWithParams() {
  const a = yield 1;
  console.log('Received:', a);

  const b = yield 2;
  console.log('Received:', b);

  return 'done';
}

const gen3 = generatorWithParams();
console.log(gen3.next());      // { value: 1, done: false }
console.log(gen3.next('A'));   // Received: A, { value: 2, done: false }
console.log(gen3.next('B'));   // Received: B, { value: 'done', done: true }

// Generator错误处理
function* generatorWithError() {
  try {
    yield 1;
    yield 2;
  } catch (error) {
    console.log('Caught:', error);
  }
  yield 3;
}

const gen4 = generatorWithError();
console.log(gen4.next());  // { value: 1, done: false }
gen4.throw(new Error('Error!'));  // Caught: Error!
console.log(gen4.next());  // { value: 3, done: false }

// Generator实现异步流程控制
function* fetchUsers() {
  try {
    const users = yield fetch('/api/users').then(r => r.json());
    console.log('Users:', users);

    const details = yield fetch(`/api/users/${users[0].id}`).then(r => r.json());
    console.log('Details:', details);

    return details;
  } catch (error) {
    console.error('Error:', error);
  }
}

// 执行Generator（手动）
function runGenerator(generatorFn) {
  const gen = generatorFn();

  function handle(result) {
    if (result.done) return result.value;

    return Promise.resolve(result.value)
      .then(value => handle(gen.next(value)))
      .catch(error => handle(gen.throw(error)));
  }

  return handle(gen.next());
}

runGenerator(fetchUsers);

// 无限序列
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// 获取前10个斐波那契数
const fib = fibonacci();
const first10 = [];
for (let i = 0; i < 10; i++) {
  first10.push(fib.next().value);
}
console.log(first10);  // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### 实战应用

```javascript
// 1. 惰性求值
function* lazyMap(iterable, mapFn) {
  for (const item of iterable) {
    yield mapFn(item);
  }
}

function* lazyFilter(iterable, filterFn) {
  for (const item of iterable) {
    if (filterFn(item)) {
      yield item;
    }
  }
}

// 链式调用
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const result = lazyFilter(
  lazyMap(numbers, x => x * 2),
  x => x > 10
);

console.log([...result]);  // [12, 14, 16, 18, 20]

// 2. 分页数据获取
function* fetchPages(endpoint, pageSize = 10) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = yield fetch(`${endpoint}?page=${page}&size=${pageSize}`)
      .then(r => r.json());

    yield response.data;

    hasMore = response.hasMore;
    page++;
  }
}

// 3. 状态机
function* trafficLight() {
  while (true) {
    yield 'green';
    yield 'yellow';
    yield 'red';
  }
}

const light = trafficLight();
console.log(light.next().value);  // 'green'
console.log(light.next().value);  // 'yellow'
console.log(light.next().value);  // 'red'
console.log(light.next().value);  // 'green' (循环)

// 4. 树的遍历
class TreeNode {
  constructor(value, children = []) {
    this.value = value;
    this.children = children;
  }

  *[Symbol.iterator]() {
    yield this.value;
    for (const child of this.children) {
      yield* child;
    }
  }
}

const tree = new TreeNode(1, [
  new TreeNode(2, [
    new TreeNode(4),
    new TreeNode(5)
  ]),
  new TreeNode(3)
]);

console.log([...tree]);  // [1, 2, 4, 5, 3]

// 5. 实现take、skip等操作
function* take(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count++ >= n) return;
    yield item;
  }
}

function* skip(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count++ < n) continue;
    yield item;
  }
}

const numbers2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log([...take(numbers2, 5)]);  // [1, 2, 3, 4, 5]
console.log([...skip(numbers2, 5)]);  // [6, 7, 8, 9, 10]
```

## 5. Proxy和Reflect

### Proxy基础

```javascript
// 创建Proxy
const target = {
  name: 'John',
  age: 30
};

const handler = {
  get(target, property) {
    console.log(`Getting ${property}`);
    return target[property];
  },

  set(target, property, value) {
    console.log(`Setting ${property} to ${value}`);
    target[property] = value;
    return true;
  }
};

const proxy = new Proxy(target, handler);

console.log(proxy.name);  // "Getting name", "John"
proxy.age = 31;  // "Setting age to 31"

// 所有Proxy拦截方法
const fullHandler = {
  // 读取属性
  get(target, property, receiver) {},

  // 设置属性
  set(target, property, value, receiver) {},

  // 检查属性是否存在
  has(target, property) {},

  // 删除属性
  deleteProperty(target, property) {},

  // 获取所有属性名
  ownKeys(target) {},

  // 获取属性描述符
  getOwnPropertyDescriptor(target, property) {},

  // 定义属性
  defineProperty(target, property, descriptor) {},

  // 阻止扩展
  preventExtensions(target) {},

  // 获取原型
  getPrototypeOf(target) {},

  // 设置原型
  setPrototypeOf(target, proto) {},

  // 检查是否可扩展
  isExtensible(target) {},

  // 调用函数
  apply(target, thisArg, argumentsList) {},

  // new调用
  construct(target, argumentsList, newTarget) {}
};
```

### Reflect对象

```javascript
// Reflect提供与Proxy handler方法对应的静态方法

const obj = { name: 'John', age: 30 };

// Reflect.get()
console.log(Reflect.get(obj, 'name'));  // 'John'

// Reflect.set()
Reflect.set(obj, 'age', 31);
console.log(obj.age);  // 31

// Reflect.has()
console.log(Reflect.has(obj, 'name'));  // true

// Reflect.deleteProperty()
Reflect.deleteProperty(obj, 'age');
console.log(obj.age);  // undefined

// Reflect.ownKeys()
const obj2 = { a: 1, b: 2 };
Object.defineProperty(obj2, 'c', {
  value: 3,
  enumerable: false
});
console.log(Reflect.ownKeys(obj2));  // ['a', 'b', 'c']

// Reflect.apply()
function sum(a, b) {
  return a + b;
}
console.log(Reflect.apply(sum, null, [1, 2]));  // 3

// Reflect.construct()
class Person {
  constructor(name) {
    this.name = name;
  }
}
const person = Reflect.construct(Person, ['Alice']);
console.log(person.name);  // 'Alice'
```

### 实战应用

```javascript
// 1. 数据验证
function createValidator(target, validators) {
  return new Proxy(target, {
    set(target, property, value) {
      const validator = validators[property];

      if (validator && !validator(value)) {
        throw new Error(`Invalid value for ${property}: ${value}`);
      }

      target[property] = value;
      return true;
    }
  });
}

const userValidators = {
  age: value => typeof value === 'number' && value >= 0 && value <= 150,
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
};

const user = createValidator({}, userValidators);

user.age = 25;  // ✓
// user.age = -1;  // ✗ Error: Invalid value for age: -1
// user.email = 'invalid';  // ✗ Error

// 2. 只读对象
function readonly(target) {
  return new Proxy(target, {
    set() {
      throw new Error('Cannot modify readonly object');
    },
    deleteProperty() {
      throw new Error('Cannot delete property from readonly object');
    }
  });
}

const config = readonly({ apiKey: '12345', timeout: 5000 });
console.log(config.apiKey);  // '12345'
// config.apiKey = '67890';  // ✗ Error

// 3. 负数组索引
function createArray(arr) {
  return new Proxy(arr, {
    get(target, property) {
      const index = Number(property);
      if (index < 0) {
        property = target.length + index;
      }
      return Reflect.get(target, property);
    }
  });
}

const arr = createArray([1, 2, 3, 4, 5]);
console.log(arr[-1]);  // 5
console.log(arr[-2]);  // 4

// 4. 属性访问日志
function createLogger(target) {
  return new Proxy(target, {
    get(target, property) {
      console.log(`[${new Date().toISOString()}] GET ${property}`);
      return Reflect.get(target, property);
    },
    set(target, property, value) {
      console.log(`[${new Date().toISOString()}] SET ${property} = ${value}`);
      return Reflect.set(target, property, value);
    }
  });
}

const loggedObj = createLogger({ name: 'John' });
loggedObj.name;  // "[timestamp] GET name"
loggedObj.age = 30;  // "[timestamp] SET age = 30"

// 5. 观察者模式（响应式数据）
function createObservable(target, callback) {
  return new Proxy(target, {
    set(target, property, value) {
      const oldValue = target[property];
      const result = Reflect.set(target, property, value);

      if (oldValue !== value) {
        callback(property, value, oldValue);
      }

      return result;
    }
  });
}

const data = createObservable(
  { count: 0 },
  (property, newValue, oldValue) => {
    console.log(`${property} changed from ${oldValue} to ${newValue}`);
  }
);

data.count = 1;  // "count changed from 0 to 1"
data.count = 2;  // "count changed from 1 to 2"

// 6. 默认值
function createWithDefaults(target, defaults) {
  return new Proxy(target, {
    get(target, property) {
      return Reflect.has(target, property)
        ? Reflect.get(target, property)
        : defaults[property];
    }
  });
}

const settings = createWithDefaults(
  { theme: 'dark' },
  { theme: 'light', language: 'en', fontSize: 14 }
);

console.log(settings.theme);     // 'dark' (来自target)
console.log(settings.language);  // 'en' (来自defaults)
console.log(settings.fontSize);  // 14 (来自defaults)

// 7. Vue 3的响应式实现（简化）
function reactive(target) {
  const handlers = {
    get(target, property, receiver) {
      // 依赖收集
      track(target, property);
      return Reflect.get(target, property, receiver);
    },

    set(target, property, value, receiver) {
      const oldValue = target[property];
      const result = Reflect.set(target, property, value, receiver);

      if (oldValue !== value) {
        // 触发更新
        trigger(target, property);
      }

      return result;
    }
  };

  return new Proxy(target, handlers);
}

const state = reactive({ count: 0 });
// 访问count时收集依赖，修改count时触发更新
```

## 6. async/await深度实现

```javascript
// async/await是Generator + Promise的语法糖

// 手写async/await实现
function asyncToGenerator(generatorFn) {
  return function(...args) {
    const gen = generatorFn.apply(this, args);

    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let result;

        try {
          result = gen[key](arg);
        } catch (error) {
          return reject(error);
        }

        const { value, done } = result;

        if (done) {
          return resolve(value);
        }

        return Promise.resolve(value).then(
          val => step('next', val),
          err => step('throw', err)
        );
      }

      step('next');
    });
  };
}

// 使用
function* fetchData() {
  try {
    const users = yield fetch('/api/users').then(r => r.json());
    const user = yield fetch(`/api/users/${users[0].id}`).then(r => r.json());
    return user;
  } catch (error) {
    console.error(error);
  }
}

const fetchDataAsync = asyncToGenerator(fetchData);
fetchDataAsync().then(result => console.log(result));

// 等价于
async function fetchDataAsync2() {
  try {
    const users = await fetch('/api/users').then(r => r.json());
    const user = await fetch(`/api/users/${users[0].id}`).then(r => r.json());
    return user;
  } catch (error) {
    console.error(error);
  }
}
```

这些ES6新特性是现代JavaScript开发的基础，深入理解它们的原理和应用场景能够写出更优雅、更高效的代码！
