# Promise 和异步编程面试题

## 1. Promise的三种状态

### 解答

Promise有三种互斥状态：pending（等待）、fulfilled（成功）、rejected（失败）。

#### 状态转换

```javascript
// Promise状态转换图
pending（初始状态）
  ↓
fulfilled（成功） 或 rejected（失败）
  ↓
settled（已敲定，不可再改变）
```

#### 基础示例

```javascript
// 1. pending → fulfilled
const promise1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('成功');  // pending → fulfilled
  }, 1000);
});

promise1.then(value => {
  console.log(value);  // '成功'
});

// 2. pending → rejected
const promise2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject('失败');  // pending → rejected
  }, 1000);
});

promise2.catch(error => {
  console.log(error);  // '失败'
});

// 3. 状态不可逆
const promise3 = new Promise((resolve, reject) => {
  resolve('第一次');
  resolve('第二次');  // 无效，状态已经是fulfilled
  reject('失败');     // 无效，状态已经确定
});

promise3.then(value => {
  console.log(value);  // '第一次'（只执行第一次状态改变）
});
```

#### 状态检测

```javascript
// Promise没有直接的方法检测状态，但可以通过技巧实现
function getPromiseState(promise) {
  const pending = { state: 'pending' };

  return Promise.race([promise, pending]).then(
    value => value === pending ? 'pending' : 'fulfilled',
    () => 'rejected'
  );
}

// 使用
const p1 = new Promise(() => {});  // pending
const p2 = Promise.resolve();       // fulfilled
const p3 = Promise.reject();        // rejected

getPromiseState(p1).then(console.log);  // 'pending'
getPromiseState(p2).then(console.log);  // 'fulfilled'
getPromiseState(p3).then(console.log);  // 'rejected'
```

#### 状态传递

```javascript
// fulfilled状态传递
Promise.resolve(1)
  .then(value => {
    console.log(value);  // 1
    return 2;  // 返回值会包装成新的fulfilled Promise
  })
  .then(value => {
    console.log(value);  // 2
  });

// rejected状态传递
Promise.reject('error1')
  .catch(error => {
    console.log(error);  // 'error1'
    throw 'error2';  // 继续抛出错误
  })
  .catch(error => {
    console.log(error);  // 'error2'
  });

// fulfilled → rejected
Promise.resolve(1)
  .then(value => {
    throw new Error('出错了');  // fulfilled → rejected
  })
  .catch(error => {
    console.log(error.message);  // '出错了'
  });

// rejected → fulfilled
Promise.reject('error')
  .catch(error => {
    console.log(error);  // 'error'
    return 'recovered';  // 返回值，错误被捕获，变为fulfilled
  })
  .then(value => {
    console.log(value);  // 'recovered'
  });
```

#### 实现简单的Promise

```javascript
class MyPromise {
  constructor(executor) {
    this.state = 'pending';
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state === 'pending') {
        this.state = 'fulfilled';
        this.value = value;
        this.onFulfilledCallbacks.forEach(fn => fn());
      }
    };

    const reject = (reason) => {
      if (this.state === 'pending') {
        this.state = 'rejected';
        this.reason = reason;
        this.onRejectedCallbacks.forEach(fn => fn());
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    if (this.state === 'fulfilled') {
      onFulfilled(this.value);
    }
    if (this.state === 'rejected') {
      onRejected(this.reason);
    }
    if (this.state === 'pending') {
      this.onFulfilledCallbacks.push(() => {
        onFulfilled(this.value);
      });
      this.onRejectedCallbacks.push(() => {
        onRejected(this.reason);
      });
    }
  }
}

// 使用
const p = new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve('成功');
  }, 1000);
});

p.then(value => console.log(value));  // '成功'
```

## 2. Promise和Callback有什么区别

### 解答

Promise和Callback是两种不同的异步编程方案。

#### 语法对比

**Callback方式**
```javascript
// 回调函数
function getData(callback) {
  setTimeout(() => {
    callback(null, { data: 'result' });
  }, 1000);
}

getData((error, result) => {
  if (error) {
    console.error(error);
  } else {
    console.log(result);
  }
});

// 回调地狱
getUserId((err, userId) => {
  if (err) return console.error(err);

  getUserInfo(userId, (err, userInfo) => {
    if (err) return console.error(err);

    getUserPosts(userId, (err, posts) => {
      if (err) return console.error(err);

      console.log(userInfo, posts);
    });
  });
});
```

**Promise方式**
```javascript
// Promise
function getData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ data: 'result' });
    }, 1000);
  });
}

getData()
  .then(result => console.log(result))
  .catch(error => console.error(error));

// 链式调用，解决回调地狱
getUserId()
  .then(userId => getUserInfo(userId))
  .then(userInfo => getUserPosts(userInfo.id))
  .then(posts => console.log(posts))
  .catch(error => console.error(error));
```

#### 错误处理对比

**Callback错误处理**
```javascript
function fetchData(callback) {
  setTimeout(() => {
    try {
      const data = JSON.parse('invalid json');
      callback(null, data);
    } catch (error) {
      callback(error);  // 必须手动传递错误
    }
  }, 1000);
}

// 每一步都要检查错误
fetchData((error, data) => {
  if (error) return console.error(error);

  processData(data, (error, processed) => {
    if (error) return console.error(error);

    saveData(processed, (error, result) => {
      if (error) return console.error(error);
      console.log(result);
    });
  });
});
```

**Promise错误处理**
```javascript
function fetchData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const data = JSON.parse('invalid json');
        resolve(data);
      } catch (error) {
        reject(error);  // 自动传递到catch
      }
    }, 1000);
  });
}

// 统一错误处理
fetchData()
  .then(data => processData(data))
  .then(processed => saveData(processed))
  .then(result => console.log(result))
  .catch(error => console.error(error));  // 捕获所有错误
```

#### 组合多个异步操作

**Callback方式**
```javascript
// 并行执行多个回调
let count = 0;
let results = [];

function checkComplete() {
  if (count === 3) {
    console.log(results);
  }
}

getUser((err, user) => {
  results[0] = user;
  count++;
  checkComplete();
});

getPosts((err, posts) => {
  results[1] = posts;
  count++;
  checkComplete();
});

getComments((err, comments) => {
  results[2] = comments;
  count++;
  checkComplete();
});
```

**Promise方式**
```javascript
// Promise.all
Promise.all([
  getUser(),
  getPosts(),
  getComments()
])
  .then(([user, posts, comments]) => {
    console.log(user, posts, comments);
  })
  .catch(error => console.error(error));

// Promise.race（谁先完成用谁）
Promise.race([
  fetchFromCDN(),
  fetchFromBackup()
])
  .then(data => console.log(data))
  .catch(error => console.error(error));

// Promise.allSettled（等待所有完成）
Promise.allSettled([
  fetch('/api/user'),
  fetch('/api/posts'),
  fetch('/api/comments')
])
  .then(results => {
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        console.log('成功:', result.value);
      } else {
        console.log('失败:', result.reason);
      }
    });
  });
```

#### 链式调用对比

**Callback方式（难以实现链式）**
```javascript
function step1(callback) {
  setTimeout(() => callback(null, 1), 1000);
}

function step2(data, callback) {
  setTimeout(() => callback(null, data + 1), 1000);
}

function step3(data, callback) {
  setTimeout(() => callback(null, data + 1), 1000);
}

// 嵌套调用
step1((err, result1) => {
  step2(result1, (err, result2) => {
    step3(result2, (err, result3) => {
      console.log(result3);  // 3
    });
  });
});
```

**Promise方式（天然支持链式）**
```javascript
function step1() {
  return new Promise(resolve => {
    setTimeout(() => resolve(1), 1000);
  });
}

function step2(data) {
  return new Promise(resolve => {
    setTimeout(() => resolve(data + 1), 1000);
  });
}

function step3(data) {
  return new Promise(resolve => {
    setTimeout(() => resolve(data + 1), 1000);
  });
}

// 链式调用
step1()
  .then(result1 => step2(result1))
  .then(result2 => step3(result2))
  .then(result3 => console.log(result3));  // 3

// 或使用async/await
async function execute() {
  const result1 = await step1();
  const result2 = await step2(result1);
  const result3 = await step3(result2);
  console.log(result3);  // 3
}
```

#### 对比总结

| 特性 | Callback | Promise |
|-----|----------|---------|
| **语法** | 嵌套函数 | 链式调用 |
| **可读性** | 回调地狱 | 清晰直观 |
| **错误处理** | 每层检查 | 统一catch |
| **组合** | 复杂 | 简单（all/race） |
| **状态** | 无 | 有（三种状态） |
| **取消** | 可以 | 困难 |
| **同步错误** | 需try-catch | 自动catch |
| **调试** | 困难 | 较容易 |

## 3. Async/Await怎么实现

### 解答

Async/Await是基于Promise和Generator的语法糖。

#### 基本原理

```javascript
// async函数返回Promise
async function getData() {
  return 'data';
}

// 等价于
function getData() {
  return Promise.resolve('data');
}

// await等待Promise完成
async function fetchUser() {
  const response = await fetch('/api/user');
  const data = await response.json();
  return data;
}

// 等价于
function fetchUser() {
  return fetch('/api/user')
    .then(response => response.json())
    .then(data => data);
}
```

#### Generator实现Async/Await

**Generator版本**
```javascript
function* fetchUser() {
  const response = yield fetch('/api/user');
  const data = yield response.json();
  return data;
}

// 自动执行器
function run(generatorFunc) {
  return new Promise((resolve, reject) => {
    const generator = generatorFunc();

    function step(nextFunc) {
      let next;
      try {
        next = nextFunc();
      } catch (error) {
        return reject(error);
      }

      if (next.done) {
        return resolve(next.value);
      }

      Promise.resolve(next.value).then(
        value => step(() => generator.next(value)),
        error => step(() => generator.throw(error))
      );
    }

    step(() => generator.next());
  });
}

// 使用
run(fetchUser).then(data => console.log(data));
```

#### 手写Async/Await实现

```javascript
// 完整的async/await模拟实现
function asyncToGenerator(generatorFunc) {
  return function(...args) {
    const generator = generatorFunc.apply(this, args);

    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let result;

        try {
          result = generator[key](arg);
        } catch (error) {
          return reject(error);
        }

        const { value, done } = result;

        if (done) {
          return resolve(value);
        } else {
          return Promise.resolve(value).then(
            val => step('next', val),
            err => step('throw', err)
          );
        }
      }

      step('next');
    });
  };
}

// 使用示例
const fetchUser = asyncToGenerator(function* () {
  const response = yield fetch('/api/user');
  const data = yield response.json();
  return data;
});

// 等价于
async function fetchUser() {
  const response = await fetch('/api/user');
  const data = await response.json();
  return data;
}
```

#### Babel转译示例

```javascript
// 源代码
async function getData() {
  const result = await fetch('/api/data');
  return result.json();
}

// Babel转译后（简化版）
function getData() {
  return _asyncToGenerator(function* () {
    const result = yield fetch('/api/data');
    return result.json();
  })();
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this;
    var args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'next', value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'throw', err);
      }

      _next(undefined);
    });
  };
}

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}
```

#### 错误处理实现

```javascript
// 错误处理
async function fetchWithError() {
  try {
    const data = await fetch('/api/data');
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Generator等价实现
function* fetchWithErrorGen() {
  try {
    const data = yield fetch('/api/data');
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 执行器支持错误处理
function runWithError(generatorFunc) {
  return new Promise((resolve, reject) => {
    const generator = generatorFunc();

    function step(value) {
      let result;

      try {
        result = generator.next(value);
      } catch (error) {
        return reject(error);
      }

      if (result.done) {
        return resolve(result.value);
      }

      Promise.resolve(result.value).then(
        value => step(value),
        error => {
          // 传递错误给generator
          try {
            step(generator.throw(error));
          } catch (err) {
            reject(err);
          }
        }
      );
    }

    step();
  });
}
```

#### 并发控制实现

```javascript
// async/await并发
async function fetchAll() {
  // 串行
  const user = await getUser();
  const posts = await getPosts();
  // 慢！

  // 并行
  const [user2, posts2] = await Promise.all([
    getUser(),
    getPosts()
  ]);
  // 快！
}

// Generator实现
function* fetchAllGen() {
  // 并行
  const [user, posts] = yield Promise.all([
    getUser(),
    getPosts()
  ]);

  return { user, posts };
}
```

#### 实用工具封装

```javascript
// 超时控制
function asyncWithTimeout(asyncFunc, timeout) {
  return async function(...args) {
    return Promise.race([
      asyncFunc.apply(this, args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  };
}

// 重试机制
function asyncWithRetry(asyncFunc, retries = 3) {
  return async function(...args) {
    for (let i = 0; i < retries; i++) {
      try {
        return await asyncFunc.apply(this, args);
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  };
}

// 使用
const fetchWithTimeout = asyncWithTimeout(fetchData, 5000);
const fetchWithRetry = asyncWithRetry(fetchData, 3);

async function getData() {
  const data = await fetchWithTimeout();
  return data;
}
```

## 4. Promise如何实现的

### 解答

Promise是一个遵循Promise/A+规范的实现。

#### 基础实现

```javascript
class MyPromise {
  constructor(executor) {
    // 初始状态
    this.state = 'pending';
    this.value = undefined;
    this.reason = undefined;

    // 存储回调
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    // resolve函数
    const resolve = (value) => {
      if (this.state === 'pending') {
        this.state = 'fulfilled';
        this.value = value;
        // 执行所有成功回调
        this.onFulfilledCallbacks.forEach(fn => fn());
      }
    };

    // reject函数
    const reject = (reason) => {
      if (this.state === 'pending') {
        this.state = 'rejected';
        this.reason = reason;
        // 执行所有失败回调
        this.onRejectedCallbacks.forEach(fn => fn());
      }
    };

    // 执行executor
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    // 参数校验，确保是函数
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason };

    // 返回新的Promise实现链式调用
    const promise2 = new MyPromise((resolve, reject) => {
      if (this.state === 'fulfilled') {
        // 使用微任务
        queueMicrotask(() => {
          try {
            const x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      }

      if (this.state === 'rejected') {
        queueMicrotask(() => {
          try {
            const x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      }

      if (this.state === 'pending') {
        // 存储回调
        this.onFulfilledCallbacks.push(() => {
          queueMicrotask(() => {
            try {
              const x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (error) {
              reject(error);
            }
          });
        });

        this.onRejectedCallbacks.push(() => {
          queueMicrotask(() => {
            try {
              const x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (error) {
              reject(error);
            }
          });
        });
      }
    });

    return promise2;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(callback) {
    return this.then(
      value => MyPromise.resolve(callback()).then(() => value),
      reason => MyPromise.resolve(callback()).then(() => { throw reason })
    );
  }

  // 静态方法
  static resolve(value) {
    if (value instanceof MyPromise) {
      return value;
    }
    return new MyPromise(resolve => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let completed = 0;

      if (promises.length === 0) {
        return resolve(results);
      }

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          value => {
            results[index] = value;
            completed++;
            if (completed === promises.length) {
              resolve(results);
            }
          },
          reason => reject(reason)
        );
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {
        MyPromise.resolve(promise).then(resolve, reject);
      });
    });
  }

  static allSettled(promises) {
    return new MyPromise(resolve => {
      const results = [];
      let completed = 0;

      if (promises.length === 0) {
        return resolve(results);
      }

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          value => {
            results[index] = { status: 'fulfilled', value };
            completed++;
            if (completed === promises.length) {
              resolve(results);
            }
          },
          reason => {
            results[index] = { status: 'rejected', reason };
            completed++;
            if (completed === promises.length) {
              resolve(results);
            }
          }
        );
      });
    });
  }

  static any(promises) {
    return new MyPromise((resolve, reject) => {
      const errors = [];
      let rejected = 0;

      if (promises.length === 0) {
        return reject(new AggregateError('All promises were rejected'));
      }

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          value => resolve(value),
          reason => {
            errors[index] = reason;
            rejected++;
            if (rejected === promises.length) {
              reject(new AggregateError(errors, 'All promises were rejected'));
            }
          }
        );
      });
    });
  }
}

// 处理Promise解析
function resolvePromise(promise2, x, resolve, reject) {
  // 不能返回自己
  if (promise2 === x) {
    return reject(new TypeError('Chaining cycle detected'));
  }

  // 如果x是Promise
  if (x instanceof MyPromise) {
    x.then(resolve, reject);
  }
  // 如果x是对象或函数
  else if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let then;
    try {
      then = x.then;
    } catch (error) {
      return reject(error);
    }

    if (typeof then === 'function') {
      let called = false;
      try {
        then.call(
          x,
          value => {
            if (called) return;
            called = true;
            resolvePromise(promise2, value, resolve, reject);
          },
          reason => {
            if (called) return;
            called = true;
            reject(reason);
          }
        );
      } catch (error) {
        if (called) return;
        reject(error);
      }
    } else {
      resolve(x);
    }
  }
  // 普通值
  else {
    resolve(x);
  }
}

// 使用示例
const p = new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve('成功');
  }, 1000);
});

p.then(value => {
  console.log(value);
  return value + ' 2';
}).then(value => {
  console.log(value);
});
```

#### 测试Promise实现

```javascript
// 测试用例
async function testMyPromise() {
  // 1. 基础功能
  const p1 = new MyPromise(resolve => {
    setTimeout(() => resolve('p1'), 100);
  });
  console.log(await p1);  // 'p1'

  // 2. 链式调用
  const p2 = MyPromise.resolve(1)
    .then(v => v + 1)
    .then(v => v + 1);
  console.log(await p2);  // 3

  // 3. 错误处理
  const p3 = MyPromise.reject('error')
    .catch(err => 'caught: ' + err);
  console.log(await p3);  // 'caught: error'

  // 4. Promise.all
  const p4 = MyPromise.all([
    MyPromise.resolve(1),
    MyPromise.resolve(2),
    MyPromise.resolve(3)
  ]);
  console.log(await p4);  // [1, 2, 3]

  // 5. Promise.race
  const p5 = MyPromise.race([
    new MyPromise(resolve => setTimeout(() => resolve('slow'), 100)),
    new MyPromise(resolve => setTimeout(() => resolve('fast'), 50))
  ]);
  console.log(await p5);  // 'fast'
}

testMyPromise();
```

## 5. Promise和setTimeout的执行顺序、then呢

### 解答

这涉及到JavaScript的事件循环机制和宏任务/微任务的执行顺序。

#### 基础概念

```javascript
// 宏任务（Macro Task）: setTimeout, setInterval, I/O, UI rendering
// 微任务（Micro Task）: Promise.then, MutationObserver, queueMicrotask

// 执行顺序：
// 1. 执行同步代码
// 2. 执行所有微任务
// 3. 执行一个宏任务
// 4. 重复2-3
```

#### 基础示例

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
}, 0);

Promise.resolve().then(() => {
  console.log('3');
});

console.log('4');

// 输出顺序: 1, 4, 3, 2
// 解释:
// - '1' 和 '4' 是同步代码，立即执行
// - Promise.then 是微任务，在同步代码后立即执行
// - setTimeout 是宏任务，在所有微任务后执行
```

#### 复杂示例

```javascript
console.log('start');

setTimeout(() => {
  console.log('setTimeout 1');
  Promise.resolve().then(() => {
    console.log('promise in setTimeout');
  });
}, 0);

Promise.resolve().then(() => {
  console.log('promise 1');
}).then(() => {
  console.log('promise 2');
});

setTimeout(() => {
  console.log('setTimeout 2');
}, 0);

console.log('end');

// 输出顺序:
// start
// end
// promise 1
// promise 2
// setTimeout 1
// promise in setTimeout
// setTimeout 2

// 执行过程:
// 1. 同步代码: start, end
// 2. 微任务队列: promise 1, promise 2
// 3. 宏任务1: setTimeout 1
// 4. 微任务: promise in setTimeout
// 5. 宏任务2: setTimeout 2
```

#### then的链式调用

```javascript
Promise.resolve()
  .then(() => {
    console.log('then 1');
    return Promise.resolve();
  })
  .then(() => {
    console.log('then 2');
  });

Promise.resolve()
  .then(() => {
    console.log('then 3');
  })
  .then(() => {
    console.log('then 4');
  });

// 输出顺序:
// then 1
// then 3
// then 4
// then 2

// 解释:
// - then 1 执行，返回Promise.resolve()会产生额外的微任务
// - then 3 执行（第二个Promise链）
// - then 4 执行
// - then 2 执行（因为then 1返回的Promise需要额外的tick）
```

#### 混合示例

```javascript
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}

async function async2() {
  console.log('async2');
}

console.log('script start');

setTimeout(() => {
  console.log('setTimeout');
}, 0);

async1();

new Promise(resolve => {
  console.log('promise1');
  resolve();
}).then(() => {
  console.log('promise2');
});

console.log('script end');

// 输出顺序:
// script start
// async1 start
// async2
// promise1
// script end
// async1 end
// promise2
// setTimeout

// 解释:
// 1. 同步: script start, async1 start, async2, promise1, script end
// 2. 微任务: async1 end (await后), promise2
// 3. 宏任务: setTimeout
```

#### 详细的事件循环示例

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => {
    console.log('3');
  });
}, 0);

new Promise((resolve) => {
  console.log('4');
  resolve();
}).then(() => {
  console.log('5');
  setTimeout(() => {
    console.log('6');
  }, 0);
}).then(() => {
  console.log('7');
});

setTimeout(() => {
  console.log('8');
  Promise.resolve().then(() => {
    console.log('9');
  });
}, 0);

console.log('10');

// 输出顺序:
// 1, 4, 10, 5, 7, 2, 3, 8, 9, 6

// 详细过程:
// === 第一轮 ===
// 同步: 1, 4, 10
// 微任务队列: [then(5), then(7)]
//
// === 第二轮 ===
// 执行微任务: 5 (产生新的setTimeout)
// 微任务队列: [then(7)]
// 执行微任务: 7
//
// === 第三轮 ===
// 宏任务: setTimeout(2)
// 输出: 2
// 微任务队列: [then(3)]
// 执行微任务: 3
//
// === 第四轮 ===
// 宏任务: setTimeout(8)
// 输出: 8
// 微任务队列: [then(9)]
// 执行微任务: 9
//
// === 第五轮 ===
// 宏任务: setTimeout(6)
// 输出: 6
```

#### 实用技巧

```javascript
// 1. 确保在微任务中执行
function runInMicrotask(fn) {
  Promise.resolve().then(fn);
}

// 2. 确保在宏任务中执行
function runInMacrotask(fn) {
  setTimeout(fn, 0);
}

// 3. 立即执行Promise
Promise.resolve().then(() => {
  console.log('立即执行（微任务）');
});

// 4. 延迟到下一个宏任务
setTimeout(() => {
  console.log('延迟执行（宏任务）');
}, 0);

// 5. queueMicrotask（推荐）
queueMicrotask(() => {
  console.log('微任务（原生API）');
});
```

## 6. 发布-订阅和观察者模式的区别

### 解答

发布-订阅模式和观察者模式虽然相似，但有关键区别。

#### 观察者模式（Observer Pattern）

**定义：** 对象间一对多的依赖关系，当对象状态改变时，所有依赖者都会收到通知。

```javascript
// 观察者模式实现
class Subject {
  constructor() {
    this.observers = [];
  }

  // 添加观察者
  attach(observer) {
    this.observers.push(observer);
  }

  // 移除观察者
  detach(observer) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  // 通知所有观察者
  notify(data) {
    this.observers.forEach(observer => {
      observer.update(data);
    });
  }
}

// 观察者
class Observer {
  constructor(name) {
    this.name = name;
  }

  update(data) {
    console.log(`${this.name} received:`, data);
  }
}

// 使用
const subject = new Subject();

const observer1 = new Observer('Observer 1');
const observer2 = new Observer('Observer 2');

subject.attach(observer1);
subject.attach(observer2);

subject.notify('Hello!');
// Observer 1 received: Hello!
// Observer 2 received: Hello!
```

#### 发布-订阅模式（Pub-Sub Pattern）

**定义：** 通过事件中心解耦发布者和订阅者，他们不直接通信。

```javascript
// 发布-订阅模式实现
class EventBus {
  constructor() {
    this.events = {};
  }

  // 订阅事件
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // 返回取消订阅函数
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  // 发布事件
  publish(event, data) {
    if (!this.events[event]) return;

    this.events[event].forEach(callback => {
      callback(data);
    });
  }

  // 取消所有订阅
  unsubscribe(event) {
    if (this.events[event]) {
      delete this.events[event];
    }
  }
}

// 使用
const eventBus = new EventBus();

// 订阅者A
const unsubscribe1 = eventBus.subscribe('message', (data) => {
  console.log('Subscriber 1:', data);
});

// 订阅者B
const unsubscribe2 = eventBus.subscribe('message', (data) => {
  console.log('Subscriber 2:', data);
});

// 发布者
eventBus.publish('message', 'Hello World!');
// Subscriber 1: Hello World!
// Subscriber 2: Hello World!

// 取消订阅
unsubscribe1();

eventBus.publish('message', 'Second message');
// Subscriber 2: Second message（只有订阅者2收到）
```

#### 关键区别

| 特性 | 观察者模式 | 发布-订阅模式 |
|-----|----------|-------------|
| **耦合度** | 高（直接依赖） | 低（通过事件中心） |
| **通信方式** | 直接通信 | 间接通信 |
| **中介者** | 无 | 有（事件中心） |
| **灵活性** | 低 | 高 |
| **复杂度** | 简单 | 相对复杂 |
| **应用场景** | 内部模块 | 跨模块通信 |

```javascript
// 观察者模式：Subject直接通知Observer
Subject → Observer1
       → Observer2
       → Observer3

// 发布-订阅模式：通过EventBus中转
Publisher → EventBus → Subscriber1
                    → Subscriber2
                    → Subscriber3
```

#### 增强的EventBus实现

```javascript
class EnhancedEventBus {
  constructor() {
    this.events = new Map();
  }

  // 订阅一次
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  // 订阅（别名）
  on(event, callback, priority = 0) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    this.events.get(event).push({ callback, priority });

    // 按优先级排序
    this.events.get(event).sort((a, b) => b.priority - a.priority);

    return () => this.off(event, callback);
  }

  // 发布（别名）
  emit(event, ...args) {
    if (!this.events.has(event)) return;

    this.events.get(event).forEach(({ callback }) => {
      callback(...args);
    });
  }

  // 取消订阅
  off(event, callback) {
    if (!this.events.has(event)) return;

    if (callback) {
      const callbacks = this.events.get(event);
      const index = callbacks.findIndex(item => item.callback === callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.events.delete(event);
    }
  }

  // 清空所有事件
  clear() {
    this.events.clear();
  }
}

// 使用示例
const bus = new EnhancedEventBus();

// 带优先级的订阅
bus.on('click', () => console.log('优先级0'), 0);
bus.on('click', () => console.log('优先级10'), 10);
bus.on('click', () => console.log('优先级5'), 5);

bus.emit('click');
// 优先级10
// 优先级5
// 优先级0

// 只执行一次
bus.once('load', () => console.log('只执行一次'));
bus.emit('load');  // 只执行一次
bus.emit('load');  // 不执行
```

#### 实际应用

**观察者模式应用**
```javascript
// Vue的响应式系统（简化）
class Dep {
  constructor() {
    this.subs = [];
  }

  addSub(sub) {
    this.subs.push(sub);
  }

  notify() {
    this.subs.forEach(sub => sub.update());
  }
}

class Watcher {
  constructor(vm, key, cb) {
    this.vm = vm;
    this.key = key;
    this.cb = cb;
    Dep.target = this;
    this.value = vm[key];  // 触发getter，添加依赖
    Dep.target = null;
  }

  update() {
    const newValue = this.vm[this.key];
    if (newValue !== this.value) {
      this.value = newValue;
      this.cb(newValue);
    }
  }
}
```

**发布-订阅模式应用**
```javascript
// Redux的中间件系统
class Store {
  constructor(reducer) {
    this.state = {};
    this.reducer = reducer;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  dispatch(action) {
    this.state = this.reducer(this.state, action);
    this.listeners.forEach(listener => listener());
  }

  getState() {
    return this.state;
  }
}

// 使用
const store = new Store(reducer);

store.subscribe(() => {
  console.log('State changed:', store.getState());
});

store.dispatch({ type: 'INCREMENT' });
```

