# JavaScript 基础面试题

## 1. JS异步编程的发展历程以及优缺点

### 解答

JavaScript异步编程经历了多个阶段的演进。

#### 1. 回调函数（Callback）

**基础用法**
```javascript
// 最早的异步方案
function getData(callback) {
  setTimeout(() => {
    callback('data');
  }, 1000);
}

getData((data) => {
  console.log(data);
});
```

**优点：**
- 简单直接
- 广泛支持

**缺点：**
- 回调地狱（Callback Hell）
- 难以维护
- 错误处理困难

```javascript
// 回调地狱示例
getData((data1) => {
  processData(data1, (data2) => {
    saveData(data2, (data3) => {
      updateUI(data3, (data4) => {
        // 代码嵌套太深，难以维护
      });
    });
  });
});
```

#### 2. Promise

**基础用法**
```javascript
function getData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('data');
    }, 1000);
  });
}

getData()
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**链式调用**
```javascript
getData()
  .then(data1 => processData(data1))
  .then(data2 => saveData(data2))
  .then(data3 => updateUI(data3))
  .catch(error => console.error(error));
```

**优点：**
- 解决回调地狱
- 链式调用优雅
- 更好的错误处理
- 支持Promise.all、Promise.race等

**缺点：**
- 无法取消
- 链式调用仍有嵌套
- 错误需要catch捕获

#### 3. Generator + co

**基础用法**
```javascript
function* fetchData() {
  const data1 = yield getData();
  const data2 = yield processData(data1);
  const data3 = yield saveData(data2);
  return data3;
}

// 使用co库执行
const co = require('co');

co(fetchData)
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

**优点：**
- 同步写法处理异步
- 流程控制清晰

**缺点：**
- 需要额外的执行器（co）
- 语义不如async/await清晰
- 使用较少

#### 4. Async/Await（推荐）

**基础用法**
```javascript
async function fetchData() {
  try {
    const data1 = await getData();
    const data2 = await processData(data1);
    const data3 = await saveData(data2);
    return data3;
  } catch (error) {
    console.error(error);
  }
}

fetchData();
```

**并发请求**
```javascript
async function fetchAll() {
  // 串行：慢
  const user = await getUser();
  const posts = await getPosts();

  // 并行：快
  const [user, posts] = await Promise.all([
    getUser(),
    getPosts()
  ]);

  return { user, posts };
}
```

**优点：**
- 语法最清晰
- 同步写法处理异步
- 错误处理简单（try/catch）
- 原生支持

**缺点：**
- 需要ES2017+支持
- 容易忘记await关键字

#### 完整对比示例

```javascript
// 1. 回调函数
function getUser(id, callback) {
  setTimeout(() => callback(null, { id, name: 'John' }), 1000);
}

getUser(1, (err, user) => {
  if (err) return console.error(err);
  console.log(user);
});

// 2. Promise
function getUser(id) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id, name: 'John' }), 1000);
  });
}

getUser(1)
  .then(user => console.log(user))
  .catch(err => console.error(err));

// 3. Async/Await
async function fetchUser() {
  try {
    const user = await getUser(1);
    console.log(user);
  } catch (err) {
    console.error(err);
  }
}

fetchUser();
```

## 2. Http报文的请求会全有几个部分

### 解答

HTTP请求报文由三部分组成：请求行、请求头、请求体。

#### HTTP请求报文结构

```
请求行（Request Line）
请求头（Request Headers）
空行（CRLF）
请求体（Request Body）
```

#### 1. 请求行（Request Line）

包含：方法、URL、HTTP版本

```
GET /api/users HTTP/1.1
```

```javascript
// 请求行组成
方法: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
URL: /api/users?id=123
HTTP版本: HTTP/1.1
```

#### 2. 请求头（Request Headers）

```
Host: www.example.com
User-Agent: Mozilla/5.0
Accept: application/json
Content-Type: application/json
Authorization: Bearer token123
Cookie: sessionId=abc123
```

**常见请求头：**
```javascript
// 内容相关
Content-Type: application/json        // 请求体类型
Content-Length: 123                   // 请求体长度
Accept: application/json              // 期望响应类型
Accept-Language: zh-CN,en             // 语言偏好
Accept-Encoding: gzip, deflate        // 支持的编码

// 认证相关
Authorization: Bearer token           // 认证令牌
Cookie: name=value                    // Cookie

// 缓存相关
Cache-Control: no-cache               // 缓存控制
If-None-Match: "etag123"             // 条件请求

// 连接相关
Connection: keep-alive                // 保持连接
Host: www.example.com                 // 目标主机
Origin: https://example.com           // 请求源
Referer: https://example.com/page     // 来源页面
```

#### 3. 空行（CRLF）

用于分隔请求头和请求体

```
\r\n
```

#### 4. 请求体（Request Body）

只有部分请求方法有body（POST、PUT、PATCH）

```javascript
// JSON格式
{
  "name": "John",
  "age": 25
}

// 表单格式
name=John&age=25

// 文件上传
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="test.txt"
Content-Type: text/plain

文件内容
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### 完整HTTP请求示例

```
POST /api/users HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Accept: application/json
Content-Type: application/json
Content-Length: 27
Authorization: Bearer eyJhbGc...
Cookie: sessionId=abc123

{"name":"John","age":25}
```

#### JavaScript中发起请求

```javascript
// Fetch API
fetch('https://api.example.com/users', {
  method: 'POST',                    // 请求行：方法
  headers: {                         // 请求头
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({             // 请求体
    name: 'John',
    age: 25
  })
});

// XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.open('POST', '/api/users');      // 请求行
xhr.setRequestHeader('Content-Type', 'application/json');  // 请求头
xhr.send(JSON.stringify({ name: 'John' }));  // 请求体

// Axios
axios.post('/api/users', {           // 请求体
  name: 'John',
  age: 25
}, {
  headers: {                         // 请求头
    'Authorization': 'Bearer token'
  }
});
```

## 3. cookie和localStorage有哪些区别

### 解答

Cookie和localStorage是两种不同的客户端存储方案。

#### 详细对比

| 特性 | Cookie | localStorage |
|-----|--------|-------------|
| **容量** | 4KB | 5-10MB |
| **生命周期** | 可设置过期时间 | 永久（除非手动删除） |
| **作用域** | 同源且同路径 | 同源 |
| **发送到服务器** | 每次HTTP请求自动携带 | 不会自动发送 |
| **访问** | 前后端都可访问 | 仅前端访问 |
| **API** | 复杂（document.cookie） | 简单（setItem/getItem） |
| **兼容性** | 所有浏览器 | IE8+ |

#### Cookie详解

**设置Cookie**
```javascript
// 基础设置
document.cookie = "name=John";

// 设置过期时间
const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
document.cookie = `name=John; expires=${expires.toUTCString()}`;

// 完整选项
document.cookie = "name=John; max-age=3600; path=/; domain=.example.com; secure; samesite=strict";

// 封装Cookie操作
const CookieUtil = {
  set(name, value, options = {}) {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.expires) {
      cookie += `; expires=${options.expires.toUTCString()}`;
    }
    if (options.maxAge) {
      cookie += `; max-age=${options.maxAge}`;
    }
    if (options.path) {
      cookie += `; path=${options.path}`;
    }
    if (options.domain) {
      cookie += `; domain=${options.domain}`;
    }
    if (options.secure) {
      cookie += '; secure';
    }
    if (options.sameSite) {
      cookie += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookie;
  },

  get(name) {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
      const [key, value] = cookie.split('=');
      if (decodeURIComponent(key) === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  remove(name, options = {}) {
    this.set(name, '', {
      ...options,
      maxAge: -1
    });
  }
};

// 使用
CookieUtil.set('user', 'John', { maxAge: 3600 });
console.log(CookieUtil.get('user'));
CookieUtil.remove('user');
```

**Cookie属性**
```javascript
// expires: 过期时间
document.cookie = "name=John; expires=Thu, 18 Dec 2025 12:00:00 UTC";

// max-age: 有效秒数（优先级高于expires）
document.cookie = "name=John; max-age=3600";  // 1小时

// path: 有效路径
document.cookie = "name=John; path=/admin";  // 只在/admin下有效

// domain: 有效域名
document.cookie = "name=John; domain=.example.com";  // 所有子域名有效

// secure: 只在HTTPS下传输
document.cookie = "token=abc; secure";

// httpOnly: 禁止JavaScript访问（只能服务器设置）
// Set-Cookie: token=abc; httpOnly

// sameSite: 跨站请求限制
document.cookie = "name=John; samesite=strict";  // 严格模式
document.cookie = "name=John; samesite=lax";     // 宽松模式
document.cookie = "name=John; samesite=none; secure";  // 无限制
```

#### localStorage详解

**基础API**
```javascript
// 存储
localStorage.setItem('name', 'John');
localStorage.setItem('age', '25');

// 读取
const name = localStorage.getItem('name');  // 'John'

// 删除
localStorage.removeItem('name');

// 清空
localStorage.clear();

// 获取key
const firstKey = localStorage.key(0);

// 长度
const count = localStorage.length;
```

**存储对象**
```javascript
// 存储对象（需要序列化）
const user = { name: 'John', age: 25 };
localStorage.setItem('user', JSON.stringify(user));

// 读取对象
const storedUser = JSON.parse(localStorage.getItem('user'));

// 封装工具
const LocalStorage = {
  set(key, value, expire) {
    const data = {
      value,
      expire: expire ? Date.now() + expire : null
    };
    localStorage.setItem(key, JSON.stringify(data));
  },

  get(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const data = JSON.parse(item);

    // 检查过期
    if (data.expire && Date.now() > data.expire) {
      localStorage.removeItem(key);
      return null;
    }

    return data.value;
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  }
};

// 使用
LocalStorage.set('token', 'abc123', 3600000);  // 1小时后过期
const token = LocalStorage.get('token');
```

#### 使用场景对比

**Cookie适用：**
```javascript
// 1. 用户认证（需要服务器验证）
document.cookie = "sessionId=abc123; httpOnly; secure";

// 2. 跟踪用户行为
document.cookie = "ga=UA-123456; max-age=31536000";

// 3. 个性化设置（需要服务器知道）
document.cookie = "language=zh-CN";
```

**localStorage适用：**
```javascript
// 1. 前端缓存
localStorage.setItem('cachedData', JSON.stringify(data));

// 2. 用户设置（纯前端）
localStorage.setItem('theme', 'dark');

// 3. 表单草稿
localStorage.setItem('draft', formData);

// 4. 离线数据
localStorage.setItem('offlineArticles', JSON.stringify(articles));
```

#### sessionStorage补充

**与localStorage的区别**
```javascript
// sessionStorage: 会话级别，关闭标签页即清除
sessionStorage.setItem('tempData', 'value');

// localStorage: 永久存储
localStorage.setItem('permanentData', 'value');

// 使用场景
// sessionStorage: 单页应用状态、敏感临时数据
// localStorage: 长期缓存、用户偏好
```

#### 安全性对比

```javascript
// Cookie安全设置
document.cookie = "token=abc; secure; httpOnly; samesite=strict";

// localStorage安全注意
// ❌ 不要存储敏感信息（容易被XSS攻击）
localStorage.setItem('password', '123456');  // 危险！

// ✅ 可以存储非敏感数据
localStorage.setItem('theme', 'dark');  // 安全

// 加密存储
import CryptoJS from 'crypto-js';

function secureSet(key, value) {
  const encrypted = CryptoJS.AES.encrypt(value, 'secret-key').toString();
  localStorage.setItem(key, encrypted);
}

function secureGet(key) {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;

  const decrypted = CryptoJS.AES.decrypt(encrypted, 'secret-key');
  return decrypted.toString(CryptoJS.enc.Utf8);
}
```

## 4. cookie和token和session区别

### 解答

Cookie、Token和Session是三种不同的身份验证和会话管理机制。

#### Cookie

**定义：** 存储在浏览器的小型数据片段

```javascript
// 服务器设置Cookie
res.setHeader('Set-Cookie', 'sessionId=abc123; HttpOnly; Secure');

// 浏览器自动携带
GET /api/profile HTTP/1.1
Cookie: sessionId=abc123

// 服务器验证
const sessionId = req.cookies.sessionId;
const user = await getSessionUser(sessionId);
```

**特点：**
- 自动携带到服务器
- 有大小限制（4KB）
- 可设置过期时间
- 支持HttpOnly防止XSS

#### Session

**定义：** 服务器端存储的会话数据

```javascript
// Express + express-session
const session = require('express-session');

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,  // 24小时
    httpOnly: true,
    secure: true
  }
}));

// 登录时设置session
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (validateUser(username, password)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
  }
});

// 使用session
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = getUserById(req.session.userId);
  res.json(user);
});

// 登出
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
```

**Session存储方式**
```javascript
// 1. 内存存储（开发环境）
app.use(session({
  store: new session.MemoryStore()
}));

// 2. Redis存储（生产环境推荐）
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const redisClient = redis.createClient();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'secret-key'
}));

// 3. 数据库存储
const MongoStore = require('connect-mongo');

app.use(session({
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost/sessions' })
}));
```

**特点：**
- 服务器端存储
- 通过sessionId关联
- 占用服务器资源
- 易于管理和撤销

#### Token（JWT）

**定义：** 自包含的加密字符串

```javascript
const jwt = require('jsonwebtoken');

// 生成Token
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (validateUser(username, password)) {
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username
      },
      'secret-key',
      { expiresIn: '24h' }
    );

    res.json({ token });
  }
});

// 验证Token（中间件）
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, 'secret-key', (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  });
}

// 使用Token
app.get('/profile', authenticateToken, (req, res) => {
  const user = getUserById(req.user.userId);
  res.json(user);
});

// 客户端使用
fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**JWT结构**
```javascript
// JWT = Header.Payload.Signature

// Header（头部）
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload（负载）
{
  "userId": 123,
  "username": "john",
  "exp": 1735689600  // 过期时间
}

// Signature（签名）
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)

// 完整Token
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywi...
```

**特点：**
- 无状态（不占用服务器存储）
- 自包含（包含用户信息）
- 可跨域使用
- 适合分布式系统

#### 三者对比

| 特性 | Cookie | Session | Token(JWT) |
|-----|--------|---------|-----------|
| **存储位置** | 客户端 | 服务端 | 客户端 |
| **携带方式** | 自动 | 通过Cookie | 手动（Header） |
| **状态** | 无状态 | 有状态 | 无状态 |
| **容量** | 4KB | 无限制 | 较大 |
| **安全性** | 中等 | 高 | 较高 |
| **跨域** | 受限 | 受限 | 支持 |
| **服务器压力** | 无 | 有 | 无 |
| **撤销** | 容易 | 容易 | 困难 |
| **移动端** | 支持 | 支持 | 友好 |

#### 使用场景对比

**Cookie + Session方式（传统）**
```javascript
// 优点：
// - 服务器完全控制
// - 易于撤销和管理
// - 安全性高

// 缺点：
// - 服务器有状态，难以扩展
// - 需要存储空间
// - 跨域复杂

// 适用场景：
// - 传统Web应用
// - 需要严格控制的场景
// - 单体应用

app.post('/login', (req, res) => {
  req.session.userId = user.id;  // Session方式
  res.cookie('sessionId', sessionId);  // Cookie携带
});
```

**Token方式（现代）**
```javascript
// 优点：
// - 无状态，易扩展
// - 支持跨域
// - 移动端友好
// - 适合微服务

// 缺点：
// - 无法撤销（需要额外机制）
// - Token较大
// - 续期复杂

// 适用场景：
// - RESTful API
// - 微服务架构
// - 移动应用
// - 单页应用（SPA）

app.post('/login', (req, res) => {
  const token = jwt.sign({ userId: user.id }, 'secret');
  res.json({ token });  // 客户端存储和携带
});
```

#### 混合方案

**Token + Refresh Token**
```javascript
// 解决Token无法撤销的问题
app.post('/login', (req, res) => {
  // 短期访问Token（15分钟）
  const accessToken = jwt.sign(
    { userId: user.id },
    'access-secret',
    { expiresIn: '15m' }
  );

  // 长期刷新Token（7天）
  const refreshToken = jwt.sign(
    { userId: user.id },
    'refresh-secret',
    { expiresIn: '7d' }
  );

  // 刷新Token存储到数据库（可撤销）
  await saveRefreshToken(user.id, refreshToken);

  res.json({ accessToken, refreshToken });
});

// 刷新访问Token
app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, 'refresh-secret');

    // 检查Token是否被撤销
    const valid = await checkRefreshToken(decoded.userId, refreshToken);
    if (!valid) {
      return res.status(403).json({ error: 'Token revoked' });
    }

    // 生成新的访问Token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      'access-secret',
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// 登出（撤销刷新Token）
app.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);
  res.json({ success: true });
});
```

**Cookie + JWT**
```javascript
// 结合两者优点
app.post('/login', (req, res) => {
  const token = jwt.sign({ userId: user.id }, 'secret');

  // Token存储在HttpOnly Cookie中
  res.cookie('token', token, {
    httpOnly: true,  // 防止XSS
    secure: true,    // 仅HTTPS
    sameSite: 'strict'  // 防止CSRF
  });

  res.json({ success: true });
});

// 中间件自动从Cookie读取
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  // 验证token...
}
```

## 5. 表单有序列表如何转化为Array是Object类型吗

### 解答

表单数据的序列化和数据类型转换。

#### FormData转Array

```javascript
// HTML表单
<form id="myForm">
  <input name="name" value="John" />
  <input name="age" value="25" />
  <input name="skills" value="JavaScript" />
  <input name="skills" value="React" />
</form>

// 方法1: FormData.entries()
const form = document.getElementById('myForm');
const formData = new FormData(form);

// 转为数组
const dataArray = Array.from(formData.entries());
console.log(dataArray);
// [
//   ['name', 'John'],
//   ['age', '25'],
//   ['skills', 'JavaScript'],
//   ['skills', 'React']
// ]

// 方法2: 展开运算符
const dataArray2 = [...formData];
console.log(dataArray2);
// 结果同上

// 方法3: forEach
const dataArray3 = [];
formData.forEach((value, key) => {
  dataArray3.push([key, value]);
});
```

#### FormData转Object

```javascript
// 基础转换（不处理重复key）
const dataObject = Object.fromEntries(formData);
console.log(dataObject);
// {
//   name: 'John',
//   age: '25',
//   skills: 'React'  // 只保留最后一个值
// }

// 处理重复key（转为数组）
function formDataToObject(formData) {
  const obj = {};

  for (const [key, value] of formData) {
    if (obj[key]) {
      // 如果key已存在，转为数组
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

const result = formDataToObject(formData);
console.log(result);
// {
//   name: 'John',
//   age: '25',
//   skills: ['JavaScript', 'React']
// }

// 总是使用数组的版本
function formDataToObjectArray(formData) {
  const obj = {};

  for (const [key, value] of formData) {
    if (!obj[key]) {
      obj[key] = [];
    }
    obj[key].push(value);
  }

  return obj;
}

const result2 = formDataToObjectArray(formData);
console.log(result2);
// {
//   name: ['John'],
//   age: ['25'],
//   skills: ['JavaScript', 'React']
// }
```

#### 数据类型判断

```javascript
const formData = new FormData();
console.log(typeof formData);  // 'object'
console.log(formData instanceof FormData);  // true
console.log(Array.isArray(formData));  // false

const dataArray = [...formData];
console.log(Array.isArray(dataArray));  // true

const dataObject = Object.fromEntries(formData);
console.log(typeof dataObject);  // 'object'
console.log(Array.isArray(dataObject));  // false
```

#### URL参数转对象

```javascript
// URLSearchParams（类似FormData）
const params = new URLSearchParams('name=John&age=25&skills=JS&skills=React');

// 转数组
const paramsArray = [...params];
console.log(paramsArray);
// [['name', 'John'], ['age', '25'], ['skills', 'JS'], ['skills', 'React']]

// 转对象
function paramsToObject(params) {
  const obj = {};

  for (const [key, value] of params) {
    if (obj[key]) {
      obj[key] = Array.isArray(obj[key])
        ? [...obj[key], value]
        : [obj[key], value];
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

console.log(paramsToObject(params));
// { name: 'John', age: '25', skills: ['JS', 'React'] }
```

#### 实用工具函数

```javascript
// 完整的表单序列化工具
class FormSerializer {
  // FormData转对象
  static toObject(formData, options = {}) {
    const { arrays = true, types = true } = options;
    const obj = {};

    for (const [key, value] of formData) {
      // 处理数组
      if (arrays && key.endsWith('[]')) {
        const realKey = key.slice(0, -2);
        if (!obj[realKey]) obj[realKey] = [];
        obj[realKey].push(this.convertType(value, types));
      }
      // 处理重复key
      else if (obj[key]) {
        obj[key] = Array.isArray(obj[key])
          ? [...obj[key], this.convertType(value, types)]
          : [obj[key], this.convertType(value, types)];
      }
      // 普通值
      else {
        obj[key] = this.convertType(value, types);
      }
    }

    return obj;
  }

  // 类型转换
  static convertType(value, enable) {
    if (!enable) return value;

    // 数字
    if (/^\d+$/.test(value)) return Number(value);

    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;

    // null/undefined
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    return value;
  }

  // 对象转FormData
  static fromObject(obj) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        value.forEach(item => formData.append(key, item));
      } else if (value instanceof File) {
        formData.append(key, value);
      } else if (typeof value === 'object' && value !== null) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    }

    return formData;
  }

  // 对象转URL参数
  static toQueryString(obj) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        value.forEach(item => params.append(key, item));
      } else if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    }

    return params.toString();
  }
}

// 使用示例
const form = document.getElementById('myForm');
const formData = new FormData(form);

// 转对象
const obj = FormSerializer.toObject(formData, {
  arrays: true,  // 处理数组
  types: true    // 自动类型转换
});

// 对象转FormData
const newFormData = FormSerializer.fromObject({
  name: 'John',
  age: 25,
  skills: ['JS', 'React']
});

// 转URL参数
const queryString = FormSerializer.toQueryString(obj);
```

## 6. 数据结构栈如何存储

### 解答

栈（Stack）是一种后进先出（LIFO）的数据结构。

#### JavaScript实现栈

**方法1：使用数组**
```javascript
class Stack {
  constructor() {
    this.items = [];
  }

  // 入栈
  push(element) {
    this.items.push(element);
  }

  // 出栈
  pop() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items.pop();
  }

  // 查看栈顶元素
  peek() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[this.items.length - 1];
  }

  // 检查是否为空
  isEmpty() {
    return this.items.length === 0;
  }

  // 获取栈的大小
  size() {
    return this.items.length;
  }

  // 清空栈
  clear() {
    this.items = [];
  }

  // 打印栈
  print() {
    console.log(this.items.toString());
  }
}

// 使用
const stack = new Stack();
stack.push(1);
stack.push(2);
stack.push(3);
console.log(stack.peek());  // 3
console.log(stack.pop());   // 3
console.log(stack.size());  // 2
```

**方法2：使用对象（更高效）**
```javascript
class Stack {
  constructor() {
    this.count = 0;
    this.items = {};
  }

  push(element) {
    this.items[this.count] = element;
    this.count++;
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    }
    this.count--;
    const result = this.items[this.count];
    delete this.items[this.count];
    return result;
  }

  peek() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[this.count - 1];
  }

  isEmpty() {
    return this.count === 0;
  }

  size() {
    return this.count;
  }

  clear() {
    this.items = {};
    this.count = 0;
  }

  toString() {
    if (this.isEmpty()) {
      return '';
    }
    let str = `${this.items[0]}`;
    for (let i = 1; i < this.count; i++) {
      str = `${str},${this.items[i]}`;
    }
    return str;
  }
}
```

**方法3：使用链表**
```javascript
class Node {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedStack {
  constructor() {
    this.top = null;
    this.count = 0;
  }

  push(value) {
    const node = new Node(value);
    node.next = this.top;
    this.top = node;
    this.count++;
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    }
    const value = this.top.value;
    this.top = this.top.next;
    this.count--;
    return value;
  }

  peek() {
    return this.top?.value || null;
  }

  isEmpty() {
    return this.top === null;
  }

  size() {
    return this.count;
  }
}
```

#### 栈的应用场景

**1. 括号匹配**
```javascript
function isValidParentheses(str) {
  const stack = new Stack();
  const pairs = {
    '(': ')',
    '[': ']',
    '{': '}'
  };

  for (const char of str) {
    if (pairs[char]) {
      // 左括号入栈
      stack.push(char);
    } else {
      // 右括号，检查是否匹配
      const left = stack.pop();
      if (pairs[left] !== char) {
        return false;
      }
    }
  }

  return stack.isEmpty();
}

console.log(isValidParentheses('()[]{}'));     // true
console.log(isValidParentheses('([)]'));       // false
console.log(isValidParentheses('{[()]}'));     // true
```

**2. 进制转换**
```javascript
function decimalToBinary(decimal) {
  const stack = new Stack();

  while (decimal > 0) {
    stack.push(decimal % 2);
    decimal = Math.floor(decimal / 2);
  }

  let binary = '';
  while (!stack.isEmpty()) {
    binary += stack.pop();
  }

  return binary;
}

console.log(decimalToBinary(10));  // '1010'
console.log(decimalToBinary(25));  // '11001'
```

**3. 函数调用栈**
```javascript
// JavaScript函数调用就是栈结构
function a() {
  console.log('a start');
  b();
  console.log('a end');
}

function b() {
  console.log('b start');
  c();
  console.log('b end');
}

function c() {
  console.log('c');
}

a();

// 执行过程：
// 调用栈: [a]
// 调用栈: [a, b]
// 调用栈: [a, b, c]
// 输出: c
// 调用栈: [a, b]
// 输出: b end
// 调用栈: [a]
// 输出: a end
// 调用栈: []
```

**4. 浏览器历史记录**
```javascript
class BrowserHistory {
  constructor(homepage) {
    this.current = homepage;
    this.backStack = new Stack();
    this.forwardStack = new Stack();
  }

  visit(url) {
    this.backStack.push(this.current);
    this.current = url;
    this.forwardStack.clear();  // 访问新页面清空前进栈
  }

  back() {
    if (!this.backStack.isEmpty()) {
      this.forwardStack.push(this.current);
      this.current = this.backStack.pop();
    }
    return this.current;
  }

  forward() {
    if (!this.forwardStack.isEmpty()) {
      this.backStack.push(this.current);
      this.current = this.forwardStack.pop();
    }
    return this.current;
  }
}

// 使用
const history = new BrowserHistory('google.com');
history.visit('baidu.com');
history.visit('zhihu.com');
console.log(history.back());     // 'baidu.com'
console.log(history.back());     // 'google.com'
console.log(history.forward());  // 'baidu.com'
```

**5. 表达式求值**
```javascript
function evaluatePostfix(expression) {
  const stack = new Stack();
  const tokens = expression.split(' ');

  for (const token of tokens) {
    if (!isNaN(token)) {
      stack.push(Number(token));
    } else {
      const b = stack.pop();
      const a = stack.pop();

      switch (token) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          stack.push(a / b);
          break;
      }
    }
  }

  return stack.pop();
}

console.log(evaluatePostfix('3 4 + 2 *'));  // (3 + 4) * 2 = 14
console.log(evaluatePostfix('5 1 2 + 4 * + 3 -'));  // 5 + ((1 + 2) * 4) - 3 = 14
```

## 7. var、let、const的区别

### 解答

这是JavaScript中三种变量声明方式。

#### 详细对比

| 特性 | var | let | const |
|-----|-----|-----|-------|
| **作用域** | 函数作用域 | 块级作用域 | 块级作用域 |
| **变量提升** | 是 | 是（但有TDZ） | 是（但有TDZ） |
| **重复声明** | 允许 | 不允许 | 不允许 |
| **重新赋值** | 允许 | 允许 | 不允许 |
| **全局对象属性** | 是 | 否 | 否 |
| **暂时性死区** | 无 | 有 | 有 |

#### 作用域差异

```javascript
// var: 函数作用域
function testVar() {
  if (true) {
    var x = 1;
  }
  console.log(x);  // 1 - 可以访问
}

// let: 块级作用域
function testLet() {
  if (true) {
    let y = 1;
  }
  console.log(y);  // ReferenceError: y is not defined
}

// const: 块级作用域
function testConst() {
  if (true) {
    const z = 1;
  }
  console.log(z);  // ReferenceError: z is not defined
}

// 经典问题：循环中的var
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 输出: 3, 3, 3（因为var是函数作用域）

// 使用let解决
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 输出: 0, 1, 2（每次循环创建新的块级作用域）
```

#### 变量提升

```javascript
// var会提升
console.log(a);  // undefined（不报错）
var a = 1;

// 等价于
var a;
console.log(a);  // undefined
a = 1;

// let/const也会提升，但有TDZ（暂时性死区）
console.log(b);  // ReferenceError: Cannot access 'b' before initialization
let b = 2;

console.log(c);  // ReferenceError: Cannot access 'c' before initialization
const c = 3;
```

#### 重复声明

```javascript
// var允许重复声明
var x = 1;
var x = 2;  // OK
console.log(x);  // 2

// let不允许
let y = 1;
let y = 2;  // SyntaxError: Identifier 'y' has already been declared

// const不允许
const z = 1;
const z = 2;  // SyntaxError: Identifier 'z' has already been declared
```

#### 重新赋值

```javascript
// var可以重新赋值
var a = 1;
a = 2;  // OK

// let可以重新赋值
let b = 1;
b = 2;  // OK

// const不能重新赋值
const c = 1;
c = 2;  // TypeError: Assignment to constant variable

// 但const对象的属性可以修改
const obj = { name: 'John' };
obj.name = 'Jane';  // OK
obj.age = 25;       // OK
obj = {};           // TypeError: Assignment to constant variable

// 完全冻结对象
const frozen = Object.freeze({ name: 'John' });
frozen.name = 'Jane';  // 静默失败（严格模式下报错）
```

#### 暂时性死区（TDZ）

```javascript
// var没有TDZ
function testVar() {
  console.log(x);  // undefined
  var x = 1;
}

// let/const有TDZ
function testLet() {
  // TDZ开始
  console.log(y);  // ReferenceError
  let y = 1;  // TDZ结束
}

// TDZ的作用
{
  // TDZ开始
  const func = () => console.log(x);  // 不报错（定义时不执行）
  // func();  // 调用会报错（x在TDZ中）

  let x = 3;  // TDZ结束

  func();  // 3（x已声明）
}
```

#### 全局对象属性

```javascript
// var会成为全局对象属性
var globalVar = 1;
console.log(window.globalVar);  // 1（浏览器环境）

// let不会
let globalLet = 2;
console.log(window.globalLet);  // undefined

// const不会
const globalConst = 3;
console.log(window.globalConst);  // undefined
```

#### 最佳实践

```javascript
// ✅ 推荐使用const（默认）
const PI = 3.14159;
const MAX_SIZE = 100;
const user = { name: 'John' };

// ✅ 需要重新赋值时使用let
let count = 0;
let isActive = true;

for (let i = 0; i < 10; i++) {
  // let在循环中很有用
}

// ❌ 避免使用var（除非需要兼容老代码）
var oldStyle = 'not recommended';

// 常见模式
const getData = async () => {
  let result;  // 需要后续赋值
  try {
    result = await fetch('/api');
  } catch (error) {
    result = null;
  }
  return result;
};

// 对象属性修改
const config = {
  debug: false,
  timeout: 5000
};
config.debug = true;  // OK，const限制的是引用，不是值

// 数组操作
const arr = [1, 2, 3];
arr.push(4);          // OK
arr = [5, 6];         // Error

// 使用Object.freeze防止修改
const CONSTANTS = Object.freeze({
  API_URL: 'https://api.example.com',
  MAX_RETRIES: 3
});
CONSTANTS.API_URL = 'other';  // 静默失败（严格模式报错）
```

#### 性能对比

```javascript
// 性能测试
console.time('var');
for (var i = 0; i < 1000000; i++) {
  var x = i;
}
console.timeEnd('var');

console.time('let');
for (let i = 0; i < 1000000; i++) {
  let y = i;
}
console.timeEnd('let');

console.time('const');
for (let i = 0; i < 1000000; i++) {
  const z = i;
}
console.timeEnd('const');

// 结果：性能差异非常小，可忽略
// 应该根据语义选择，而不是性能
```

