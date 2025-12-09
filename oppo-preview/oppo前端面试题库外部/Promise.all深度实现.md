# Promise.all深度实现

## 1. Promise.all的本质

### 什么是Promise.all

```javascript
// Promise.all：并行执行多个Promise，等待所有Promise都成功
// 特点：
// 1. 接收一个可迭代对象（通常是数组）
// 2. 返回一个新的Promise
// 3. 所有Promise都成功时，返回结果数组
// 4. 任一Promise失败时，立即返回失败原因

// 基础示例
const promise1 = Promise.resolve(1);
const promise2 = Promise.resolve(2);
const promise3 = Promise.resolve(3);

Promise.all([promise1, promise2, promise3])
  .then(results => {
    console.log(results);  // [1, 2, 3]
  });

// 应用场景：
// 1. 并行请求多个接口
// 2. 批量上传文件
// 3. 预加载多个资源
// 4. 并行执行多个异步任务

// 为什么需要Promise.all？
// 1. 提高性能：并行执行而非串行
// 2. 保持顺序：结果数组顺序与输入顺序一致
// 3. 统一错误处理：任一失败即可捕获
```

### Promise.all vs 串行执行

```javascript
// ❌ 串行执行（慢）
async function fetchDataSerial() {
  const result1 = await fetch('/api/user');    // 100ms
  const result2 = await fetch('/api/posts');   // 100ms
  const result3 = await fetch('/api/comments'); // 100ms

  return [result1, result2, result3];
  // 总耗时：300ms
}

// ✓ 并行执行（快）
async function fetchDataParallel() {
  const results = await Promise.all([
    fetch('/api/user'),
    fetch('/api/posts'),
    fetch('/api/comments')
  ]);

  return results;
  // 总耗时：100ms（最慢的那个）
}

// 性能对比
console.time('serial');
await fetchDataSerial();
console.timeEnd('serial');  // ~300ms

console.time('parallel');
await fetchDataParallel();
console.timeEnd('parallel');  // ~100ms

// 性能提升：200%
```

## 2. Promise.all手写实现

### 基础版实现

```javascript
// 实现Promise.all
function promiseAll(promises) {
  // 返回一个新的Promise
  return new Promise((resolve, reject) => {
    // 1. 参数校验
    if (!Array.isArray(promises)) {
      return reject(new TypeError('Argument must be an array'));
    }

    // 2. 空数组直接返回
    if (promises.length === 0) {
      return resolve([]);
    }

    // 3. 结果数组和计数器
    const results = [];
    let completedCount = 0;

    // 4. 遍历所有Promise
    promises.forEach((promise, index) => {
      // 将值包装为Promise（支持非Promise值）
      Promise.resolve(promise)
        .then(value => {
          // 保存结果（保持顺序）
          results[index] = value;
          completedCount++;

          // 所有Promise都成功了
          if (completedCount === promises.length) {
            resolve(results);
          }
        })
        .catch(error => {
          // 任一Promise失败，立即reject
          reject(error);
        });
    });
  });
}

// 测试
const p1 = Promise.resolve(1);
const p2 = new Promise(resolve => setTimeout(() => resolve(2), 100));
const p3 = Promise.resolve(3);

promiseAll([p1, p2, p3])
  .then(results => {
    console.log(results);  // [1, 2, 3]
  });

// 测试失败情况
const p4 = Promise.resolve(1);
const p5 = Promise.reject(new Error('Failed'));
const p6 = Promise.resolve(3);

promiseAll([p4, p5, p6])
  .catch(error => {
    console.log(error.message);  // "Failed"
  });
```

### 完整版实现（支持可迭代对象）

```javascript
// 完整版Promise.all
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    // 1. 将可迭代对象转为数组
    let promises;
    try {
      promises = Array.from(iterable);
    } catch (error) {
      return reject(new TypeError('Argument is not iterable'));
    }

    // 2. 空数组直接返回
    if (promises.length === 0) {
      return resolve([]);
    }

    // 3. 结果数组和计数器
    const results = new Array(promises.length);
    let completedCount = 0;

    // 4. 遍历所有Promise
    promises.forEach((promise, index) => {
      // Promise.resolve处理非Promise值
      Promise.resolve(promise)
        .then(
          value => {
            results[index] = value;
            completedCount++;

            if (completedCount === promises.length) {
              resolve(results);
            }
          },
          error => {
            // 立即reject
            reject(error);
          }
        );
    });
  });
}

// 测试可迭代对象
// 1. 数组
promiseAll([1, 2, 3]).then(console.log);  // [1, 2, 3]

// 2. Set
const set = new Set([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3)
]);
promiseAll(set).then(console.log);  // [1, 2, 3]

// 3. Map
const map = new Map([
  ['a', Promise.resolve(1)],
  ['b', Promise.resolve(2)]
]);
promiseAll(map.values()).then(console.log);  // [1, 2]

// 4. Generator
function* gen() {
  yield Promise.resolve(1);
  yield Promise.resolve(2);
  yield Promise.resolve(3);
}
promiseAll(gen()).then(console.log);  // [1, 2, 3]

// 5. 字符串（可迭代）
promiseAll('abc').then(console.log);  // ['a', 'b', 'c']

// 6. 非Promise值
promiseAll([1, 2, 3]).then(console.log);  // [1, 2, 3]

// 7. 混合值
promiseAll([
  1,
  Promise.resolve(2),
  new Promise(resolve => setTimeout(() => resolve(3), 100))
]).then(console.log);  // [1, 2, 3]
```

### 边界情况处理

```javascript
// 处理所有边界情况的完整实现
function promiseAllComplete(iterable) {
  return new Promise((resolve, reject) => {
    // 边界情况1：非可迭代对象
    let promises;
    try {
      promises = Array.from(iterable);
    } catch (error) {
      return reject(new TypeError(
        `${typeof iterable} ${iterable} is not iterable`
      ));
    }

    // 边界情况2：空数组
    if (promises.length === 0) {
      return resolve([]);
    }

    const results = new Array(promises.length);
    let completedCount = 0;
    let rejected = false;  // 防止多次reject

    promises.forEach((promise, index) => {
      Promise.resolve(promise)
        .then(
          value => {
            // 边界情况3：已经rejected，不再处理
            if (rejected) return;

            results[index] = value;
            completedCount++;

            if (completedCount === promises.length) {
              resolve(results);
            }
          },
          error => {
            // 边界情况4：只reject一次
            if (rejected) return;
            rejected = true;
            reject(error);
          }
        );
    });
  });
}

// 测试边界情况

// 1. 非可迭代对象
promiseAllComplete(null)
  .catch(error => {
    console.log(error.message);  // "object null is not iterable"
  });

// 2. 空数组
promiseAllComplete([])
  .then(results => {
    console.log(results);  // []
  });

// 3. 多个Promise同时reject
const promises = [
  Promise.reject(new Error('Error 1')),
  Promise.reject(new Error('Error 2')),
  Promise.reject(new Error('Error 3'))
];

promiseAllComplete(promises)
  .catch(error => {
    console.log(error.message);  // "Error 1" (第一个错误)
  });

// 4. 部分Promise已经settled
const settledPromises = [
  Promise.resolve(1),
  Promise.reject(new Error('Error')),
  Promise.resolve(3)
];

promiseAllComplete(settledPromises)
  .catch(error => {
    console.log(error.message);  // "Error"
  });
```

## 3. Promise.race实现

### Promise.race原理

```javascript
// Promise.race：返回最先完成的Promise结果
// 特点：
// 1. 返回第一个完成的Promise（无论成功或失败）
// 2. 其他Promise继续执行，但结果被忽略
// 3. 常用于超时控制

// 基础示例
const p1 = new Promise(resolve => setTimeout(() => resolve('Fast'), 100));
const p2 = new Promise(resolve => setTimeout(() => resolve('Slow'), 500));

Promise.race([p1, p2])
  .then(result => {
    console.log(result);  // "Fast"
  });

// 应用场景：
// 1. 请求超时控制
// 2. 资源竞争（多个CDN）
// 3. 快速失败
```

### Promise.race手写实现

```javascript
// 实现Promise.race
function promiseRace(iterable) {
  return new Promise((resolve, reject) => {
    // 1. 转为数组
    let promises;
    try {
      promises = Array.from(iterable);
    } catch (error) {
      return reject(new TypeError('Argument is not iterable'));
    }

    // 2. 空数组永远pending（与原生行为一致）
    if (promises.length === 0) {
      return;  // 永远不resolve也不reject
    }

    // 3. 竞速：第一个完成的Promise决定结果
    let settled = false;

    promises.forEach(promise => {
      Promise.resolve(promise)
        .then(
          value => {
            if (!settled) {
              settled = true;
              resolve(value);
            }
          },
          error => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
        );
    });
  });
}

// 测试
const fast = new Promise(resolve =>
  setTimeout(() => resolve('Fast'), 100)
);
const slow = new Promise(resolve =>
  setTimeout(() => resolve('Slow'), 500)
);

promiseRace([fast, slow])
  .then(result => {
    console.log(result);  // "Fast" (100ms后)
  });

// 测试失败情况
const success = new Promise(resolve =>
  setTimeout(() => resolve('Success'), 200)
);
const failure = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Failed')), 100)
);

promiseRace([success, failure])
  .catch(error => {
    console.log(error.message);  // "Failed" (100ms后)
  });

// 测试空数组
const emptyRace = promiseRace([]);
console.log(emptyRace);  // Promise { <pending> } (永远pending)
```

### Promise.race实战应用

```javascript
// 1. 请求超时控制
function fetchWithTimeout(url, timeout = 5000) {
  const fetchPromise = fetch(url);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// 使用
fetchWithTimeout('/api/data', 3000)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error.message));

// 2. 多CDN资源加载
function loadResourceFromMultipleCDNs(cdnUrls) {
  const promises = cdnUrls.map(url => fetch(url));
  return Promise.race(promises);
}

// 使用
const cdns = [
  'https://cdn1.example.com/library.js',
  'https://cdn2.example.com/library.js',
  'https://cdn3.example.com/library.js'
];

loadResourceFromMultipleCDNs(cdns)
  .then(response => response.text())
  .then(code => eval(code))
  .catch(error => console.error('All CDNs failed'));

// 3. 快速失败（健康检查）
function checkServiceHealth(services) {
  const healthChecks = services.map(service =>
    fetch(service.healthUrl).then(() => service)
  );

  return Promise.race(healthChecks);
}

// 使用
const services = [
  { name: 'Service A', healthUrl: '/api/a/health' },
  { name: 'Service B', healthUrl: '/api/b/health' },
  { name: 'Service C', healthUrl: '/api/c/health' }
];

checkServiceHealth(services)
  .then(service => {
    console.log(`Using ${service.name}`);
  });

// 4. 延迟执行
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runWithMinTime(promise, minTime) {
  return Promise.race([
    promise,
    delay(minTime).then(() => 'min-time-reached')
  ]);
}

// 使用：确保加载动画至少显示1秒
const dataPromise = fetch('/api/data');
runWithMinTime(dataPromise, 1000)
  .then(result => {
    if (result === 'min-time-reached') {
      console.log('Still loading...');
    } else {
      console.log('Data loaded:', result);
    }
  });
```

## 4. Promise.allSettled实现

### Promise.allSettled原理

```javascript
// Promise.allSettled（ES2020）：
// 等待所有Promise完成（无论成功或失败）
// 特点：
// 1. 不会短路，等待所有Promise
// 2. 返回结果数组，每个结果包含状态和值/原因
// 3. 永远不会reject

// 基础示例
const promises = [
  Promise.resolve(1),
  Promise.reject(new Error('Failed')),
  Promise.resolve(3)
];

Promise.allSettled(promises)
  .then(results => {
    console.log(results);
    /*
    [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: Error: Failed },
      { status: 'fulfilled', value: 3 }
    ]
    */
  });

// 应用场景：
// 1. 批量操作（部分失败不影响其他）
// 2. 日志收集
// 3. 统计成功/失败数量
```

### Promise.allSettled手写实现

```javascript
// 实现Promise.allSettled
function promiseAllSettled(iterable) {
  return new Promise((resolve) => {  // 注意：只有resolve，没有reject
    // 1. 转为数组
    let promises;
    try {
      promises = Array.from(iterable);
    } catch (error) {
      return resolve([]);  // 非可迭代对象返回空数组
    }

    // 2. 空数组直接返回
    if (promises.length === 0) {
      return resolve([]);
    }

    // 3. 结果数组和计数器
    const results = new Array(promises.length);
    let completedCount = 0;

    // 4. 遍历所有Promise
    promises.forEach((promise, index) => {
      Promise.resolve(promise)
        .then(
          value => {
            // 成功
            results[index] = {
              status: 'fulfilled',
              value
            };
          },
          reason => {
            // 失败
            results[index] = {
              status: 'rejected',
              reason
            };
          }
        )
        .finally(() => {
          completedCount++;

          // 所有Promise都完成了
          if (completedCount === promises.length) {
            resolve(results);
          }
        });
    });
  });
}

// 测试
const promises = [
  Promise.resolve(1),
  Promise.reject(new Error('Error 2')),
  Promise.resolve(3),
  Promise.reject(new Error('Error 4'))
];

promiseAllSettled(promises)
  .then(results => {
    console.log(results);
    /*
    [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: Error: Error 2 },
      { status: 'fulfilled', value: 3 },
      { status: 'rejected', reason: Error: Error 4 }
    ]
    */

    // 统计成功/失败
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`Succeeded: ${succeeded.length}`);  // 2
    console.log(`Failed: ${failed.length}`);        // 2
  });
```

### Promise.allSettled实战应用

```javascript
// 1. 批量API请求
async function batchFetchUsers(userIds) {
  const promises = userIds.map(id =>
    fetch(`/api/users/${id}`).then(r => r.json())
  );

  const results = await Promise.allSettled(promises);

  // 分离成功和失败
  const succeeded = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);

  return { succeeded, failed };
}

// 使用
const { succeeded, failed } = await batchFetchUsers([1, 2, 3, 4, 5]);
console.log(`Loaded ${succeeded.length} users`);
console.log(`Failed to load ${failed.length} users`);

// 2. 批量文件上传
async function batchUploadFiles(files) {
  const uploadPromises = files.map(file =>
    uploadFile(file).then(url => ({ file: file.name, url }))
  );

  const results = await Promise.allSettled(uploadPromises);

  // 生成上传报告
  const report = {
    total: files.length,
    succeeded: 0,
    failed: 0,
    details: []
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      report.succeeded++;
      report.details.push({
        file: files[index].name,
        status: 'success',
        url: result.value.url
      });
    } else {
      report.failed++;
      report.details.push({
        file: files[index].name,
        status: 'failed',
        error: result.reason.message
      });
    }
  });

  return report;
}

// 使用
const files = [file1, file2, file3];
const report = await batchUploadFiles(files);
console.log(`Upload report: ${report.succeeded}/${report.total} succeeded`);

// 3. 服务健康检查
async function checkAllServices(services) {
  const healthChecks = services.map(service =>
    fetch(service.healthUrl)
      .then(() => ({ name: service.name, healthy: true }))
      .catch(error => ({ name: service.name, healthy: false, error }))
  );

  const results = await Promise.allSettled(healthChecks);

  return {
    services: results.map(r =>
      r.status === 'fulfilled' ? r.value : r.reason
    ),
    allHealthy: results.every(r =>
      r.status === 'fulfilled' && r.value.healthy
    )
  };
}

// 使用
const status = await checkAllServices([
  { name: 'Database', healthUrl: '/api/db/health' },
  { name: 'Cache', healthUrl: '/api/cache/health' },
  { name: 'Storage', healthUrl: '/api/storage/health' }
]);

console.log('Service status:', status);
```

## 5. Promise.any实现

### Promise.any原理

```javascript
// Promise.any（ES2021）：
// 返回第一个成功的Promise
// 特点：
// 1. 只要有一个成功，就返回该结果
// 2. 所有Promise都失败时，返回AggregateError
// 3. 与Promise.race相反（race返回第一个完成的，any返回第一个成功的）

// 基础示例
const promises = [
  Promise.reject(new Error('Error 1')),
  Promise.resolve(2),
  Promise.reject(new Error('Error 3'))
];

Promise.any(promises)
  .then(result => {
    console.log(result);  // 2
  });

// 全部失败
const allFailed = [
  Promise.reject(new Error('Error 1')),
  Promise.reject(new Error('Error 2')),
  Promise.reject(new Error('Error 3'))
];

Promise.any(allFailed)
  .catch(error => {
    console.log(error);  // AggregateError: All promises were rejected
    console.log(error.errors);  // [Error: Error 1, Error: Error 2, Error: Error 3]
  });

// 应用场景：
// 1. 多个备用方案（fallback）
// 2. 最快成功响应
// 3. 容错处理
```

### Promise.any手写实现

```javascript
// 实现AggregateError
class AggregateError extends Error {
  constructor(errors, message) {
    super(message);
    this.name = 'AggregateError';
    this.errors = errors;
  }
}

// 实现Promise.any
function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    // 1. 转为数组
    let promises;
    try {
      promises = Array.from(iterable);
    } catch (error) {
      return reject(new TypeError('Argument is not iterable'));
    }

    // 2. 空数组直接reject
    if (promises.length === 0) {
      return reject(new AggregateError([], 'All promises were rejected'));
    }

    // 3. 错误数组和计数器
    const errors = new Array(promises.length);
    let rejectedCount = 0;
    let resolved = false;

    // 4. 遍历所有Promise
    promises.forEach((promise, index) => {
      Promise.resolve(promise)
        .then(
          value => {
            // 第一个成功的Promise
            if (!resolved) {
              resolved = true;
              resolve(value);
            }
          },
          error => {
            // 记录错误
            errors[index] = error;
            rejectedCount++;

            // 所有Promise都失败了
            if (rejectedCount === promises.length) {
              reject(new AggregateError(
                errors,
                'All promises were rejected'
              ));
            }
          }
        );
    });
  });
}

// 测试
const promises1 = [
  Promise.reject(new Error('Error 1')),
  Promise.resolve(2),
  Promise.reject(new Error('Error 3'))
];

promiseAny(promises1)
  .then(result => {
    console.log(result);  // 2
  });

// 测试全部失败
const promises2 = [
  Promise.reject(new Error('Error 1')),
  Promise.reject(new Error('Error 2')),
  Promise.reject(new Error('Error 3'))
];

promiseAny(promises2)
  .catch(error => {
    console.log(error.message);  // "All promises were rejected"
    console.log(error.errors);   // [Error, Error, Error]
  });
```

### Promise.any实战应用

```javascript
// 1. 多CDN资源加载（容错）
async function loadFromMultipleCDNs(resource) {
  const cdnUrls = [
    `https://cdn1.example.com/${resource}`,
    `https://cdn2.example.com/${resource}`,
    `https://cdn3.example.com/${resource}`
  ];

  const promises = cdnUrls.map(url =>
    fetch(url).then(response => {
      if (!response.ok) throw new Error(`Failed to load from ${url}`);
      return response.blob();
    })
  );

  try {
    const blob = await Promise.any(promises);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('All CDNs failed:', error.errors);
    throw new Error('Resource not available');
  }
}

// 使用
loadFromMultipleCDNs('library.js')
  .then(url => {
    const script = document.createElement('script');
    script.src = url;
    document.head.appendChild(script);
  })
  .catch(error => {
    console.error('Failed to load library:', error);
  });

// 2. 多数据源查询
async function queryMultipleDatabases(query) {
  const databases = [
    queryMainDB(query),
    queryReplicaDB1(query),
    queryReplicaDB2(query)
  ];

  try {
    return await Promise.any(databases);
  } catch (error) {
    console.error('All databases failed:', error);
    return null;
  }
}

// 使用
const result = await queryMultipleDatabases('SELECT * FROM users');
if (result) {
  console.log('Data retrieved:', result);
} else {
  console.log('All databases unavailable');
}

// 3. 用户登录（多种认证方式）
async function login(credentials) {
  const authMethods = [
    loginWithPassword(credentials),
    loginWithBiometric(credentials),
    loginWithOAuth(credentials)
  ];

  try {
    const user = await Promise.any(authMethods);
    console.log(`Logged in as ${user.name}`);
    return user;
  } catch (error) {
    console.error('All login methods failed:', error.errors);
    throw new Error('Authentication failed');
  }
}

// 使用
login({ username: 'user', password: 'pass' })
  .then(user => console.log('Welcome', user.name))
  .catch(error => console.error(error.message));
```

## 6. 四种方法对比

```javascript
// Promise.all vs Promise.race vs Promise.allSettled vs Promise.any

// 对比表格
/*
| 方法              | 返回时机               | 返回值                | 失败行为           |
|-------------------|------------------------|----------------------|-------------------|
| Promise.all       | 所有成功时             | 结果数组              | 任一失败立即reject |
| Promise.race      | 第一个完成时           | 第一个结果            | 第一个失败就reject |
| Promise.allSettled| 所有完成时             | 状态+结果数组         | 永不reject        |
| Promise.any       | 第一个成功时           | 第一个成功结果        | 全部失败才reject   |
*/

// 示例对比
const promises = [
  new Promise(resolve => setTimeout(() => resolve(1), 100)),
  new Promise((_, reject) => setTimeout(() => reject(new Error('2')), 50)),
  new Promise(resolve => setTimeout(() => resolve(3), 150))
];

// 1. Promise.all - 50ms后reject（第一个失败）
Promise.all(promises)
  .then(results => console.log('all:', results))
  .catch(error => console.log('all error:', error.message));
// 输出: "all error: 2"

// 2. Promise.race - 50ms后reject（第一个完成）
Promise.race(promises)
  .then(result => console.log('race:', result))
  .catch(error => console.log('race error:', error.message));
// 输出: "race error: 2"

// 3. Promise.allSettled - 150ms后resolve（所有完成）
Promise.allSettled(promises)
  .then(results => {
    console.log('allSettled:', results);
    /*
    [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: Error: 2 },
      { status: 'fulfilled', value: 3 }
    ]
    */
  });

// 4. Promise.any - 100ms后resolve（第一个成功）
Promise.any(promises)
  .then(result => console.log('any:', result));
// 输出: "any: 1"

// 选择建议：
// 1. 全部成功才继续 → Promise.all
// 2. 最快响应（无论成败） → Promise.race
// 3. 需要所有结果（无论成败） → Promise.allSettled
// 4. 至少一个成功即可 → Promise.any
```

## 7. 实战综合案例

### 批量API请求管理器

```javascript
// 实现一个功能完整的批量请求管理器
class BatchRequestManager {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 3;  // 并发数
    this.retries = options.retries || 2;          // 重试次数
    this.timeout = options.timeout || 5000;       // 超时时间
  }

  // 带超时的请求
  fetchWithTimeout(url, timeout = this.timeout) {
    const fetchPromise = fetch(url);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  // 带重试的请求
  async fetchWithRetry(url, retries = this.retries) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.fetchWithTimeout(url);
      } catch (error) {
        if (i === retries) throw error;

        // 指数退避
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 限制并发数的批量请求
  async batchFetch(urls) {
    const results = [];
    const executing = [];

    for (const [index, url] of urls.entries()) {
      const promise = this.fetchWithRetry(url)
        .then(response => ({ index, status: 'fulfilled', response }))
        .catch(error => ({ index, status: 'rejected', error }));

      results.push(promise);

      // 限制并发数
      if (urls.length >= this.concurrency) {
        const executingPromise = promise.then(() => {
          executing.splice(executing.indexOf(executingPromise), 1);
        });

        executing.push(executingPromise);

        if (executing.length >= this.concurrency) {
          await Promise.race(executing);
        }
      }
    }

    // 等待所有请求完成
    const settled = await Promise.allSettled(results);

    // 按原始顺序排序
    return settled
      .map(r => r.value)
      .sort((a, b) => a.index - b.index);
  }

  // 智能批量请求（all + fallback）
  async smartBatch(urls, fallbackUrls) {
    try {
      // 先尝试主URL
      const responses = await Promise.all(
        urls.map(url => this.fetchWithTimeout(url))
      );
      return responses;
    } catch (error) {
      console.warn('Primary requests failed, trying fallback...');

      // 主URL失败，尝试备用URL
      return await Promise.any(
        fallbackUrls.map(backupUrls =>
          Promise.all(backupUrls.map(url => this.fetchWithTimeout(url)))
        )
      );
    }
  }
}

// 使用
const manager = new BatchRequestManager({
  concurrency: 3,
  retries: 2,
  timeout: 3000
});

// 批量请求
const urls = [
  '/api/user/1',
  '/api/user/2',
  '/api/user/3',
  '/api/user/4',
  '/api/user/5'
];

const results = await manager.batchFetch(urls);

results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log(`Request ${result.index} succeeded`);
  } else {
    console.log(`Request ${result.index} failed:`, result.error.message);
  }
});

// 智能批量请求（带备用方案）
const primaryUrls = ['/api/data/1', '/api/data/2'];
const fallbackUrls = [
  ['/backup1/data/1', '/backup1/data/2'],
  ['/backup2/data/1', '/backup2/data/2']
];

const data = await manager.smartBatch(primaryUrls, fallbackUrls);
console.log('Data loaded:', data);
```

### 资源预加载管理器

```javascript
// 实现一个资源预加载管理器
class ResourcePreloader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  // 预加载单个资源
  async preload(url, type = 'fetch') {
    // 检查缓存
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // 检查是否正在加载
    if (this.loading.has(url)) {
      return this.loading.get(url);
    }

    // 开始加载
    const promise = this._load(url, type);
    this.loading.set(url, promise);

    try {
      const resource = await promise;
      this.cache.set(url, resource);
      return resource;
    } finally {
      this.loading.delete(url);
    }
  }

  async _load(url, type) {
    switch (type) {
      case 'image':
        return this._loadImage(url);
      case 'script':
        return this._loadScript(url);
      case 'style':
        return this._loadStyle(url);
      default:
        return fetch(url).then(r => r.blob());
    }
  }

  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  _loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => resolve(script);
      script.onerror = reject;
      script.src = url;
      document.head.appendChild(script);
    });
  }

  _loadStyle(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.onload = () => resolve(link);
      link.onerror = reject;
      link.href = url;
      document.head.appendChild(link);
    });
  }

  // 批量预加载（all）
  async preloadAll(resources) {
    const promises = resources.map(({ url, type }) =>
      this.preload(url, type)
    );

    return Promise.all(promises);
  }

  // 批量预加载（allSettled）
  async preloadAllSettled(resources) {
    const promises = resources.map(({ url, type }) =>
      this.preload(url, type)
    );

    const results = await Promise.allSettled(promises);

    return {
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      details: results
    };
  }

  // 竞速预加载（从多个CDN）
  async preloadRace(urls, type) {
    const promises = urls.map(url => this.preload(url, type));
    return Promise.race(promises);
  }
}

// 使用
const preloader = new ResourcePreloader();

// 预加载关键资源（all - 全部成功才继续）
const criticalResources = [
  { url: '/images/logo.png', type: 'image' },
  { url: '/styles/critical.css', type: 'style' },
  { url: '/scripts/core.js', type: 'script' }
];

try {
  await preloader.preloadAll(criticalResources);
  console.log('All critical resources loaded');
  // 显示页面
  document.body.style.visibility = 'visible';
} catch (error) {
  console.error('Failed to load critical resources:', error);
}

// 预加载非关键资源（allSettled - 允许部分失败）
const optionalResources = [
  { url: '/images/banner1.jpg', type: 'image' },
  { url: '/images/banner2.jpg', type: 'image' },
  { url: '/images/banner3.jpg', type: 'image' }
];

const result = await preloader.preloadAllSettled(optionalResources);
console.log(`Loaded ${result.succeeded}/${optionalResources.length} optional resources`);

// 从多个CDN加载（race - 最快的）
const cdnUrls = [
  'https://cdn1.example.com/library.js',
  'https://cdn2.example.com/library.js',
  'https://cdn3.example.com/library.js'
];

const library = await preloader.preloadRace(cdnUrls, 'script');
console.log('Library loaded from fastest CDN');
```

Promise.all及其变体是前端异步编程的核心工具，深入理解其原理和实现对于编写高质量的异步代码至关重要！
