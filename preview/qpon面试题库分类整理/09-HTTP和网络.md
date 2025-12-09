# HTTP和网络

## 1. 为什么HTTPS安全？HTTPS是怎么保证的？
**问题：** 为什么HTTPS安全？HTTPS是怎么保证的？

### 解答

#### HTTPS是什么
HTTPS = HTTP + SSL/TLS，在HTTP的基础上加入了加密层。

#### HTTPS安全性保证

**1. 加密传输**
```
客户端 → [加密] → 网络 → [加密] → 服务器
```
- 对称加密：传输数据（AES）
- 非对称加密：交换密钥（RSA）

**2. 身份认证**
- 通过数字证书验证服务器身份
- 防止中间人攻击

**3. 数据完整性**
- 使用消息摘要（Hash）
- 防止数据被篡改

#### HTTPS握手过程

```
客户端                                    服务器
  |                                        |
  |-------- 1. Client Hello -------------->|
  |  (支持的加密套件、随机数)                |
  |                                        |
  |<------- 2. Server Hello ---------------|
  |  (选择的加密套件、随机数、证书)          |
  |                                        |
  |-------- 3. 验证证书 ------------------->|
  |  (用CA公钥验证证书)                     |
  |                                        |
  |-------- 4. Pre-Master Secret --------->|
  |  (用服务器公钥加密)                     |
  |                                        |
  |-------- 5. 生成会话密钥 --------------->|
  |  (双方独立生成相同的会话密钥)            |
  |                                        |
  |-------- 6. 加密通信 ------------------->|
  |  (使用会话密钥对称加密)                 |
```

#### 详细步骤

**1. Client Hello**
```javascript
{
  version: 'TLS 1.3',
  cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_AES_128_GCM_SHA256'],
  randomBytes: 'abc123...',
  extensions: [...]
}
```

**2. Server Hello**
```javascript
{
  version: 'TLS 1.3',
  cipherSuite: 'TLS_AES_256_GCM_SHA384',
  randomBytes: 'def456...',
  certificate: {
    publicKey: '...',
    signature: '...',
    issuer: 'CA',
    validity: '...'
  }
}
```

**3. 证书验证**
```javascript
// 客户端验证证书
1. 检查证书是否过期
2. 检查域名是否匹配
3. 检查证书颁发机构（CA）
4. 验证证书签名

// 使用CA公钥解密证书签名
const isValid = verifySignature(
  certificate.signature,
  CA_PUBLIC_KEY
);
```

**4. 生成会话密钥**
```javascript
// Pre-Master Secret
const preMasterSecret = generateRandomBytes(48);

// 用服务器公钥加密
const encrypted = rsaEncrypt(preMasterSecret, serverPublicKey);

// 客户端和服务器都用以下算法生成会话密钥
const masterSecret = PRF(
  preMasterSecret,
  clientRandom + serverRandom
);

const sessionKey = deriveKey(masterSecret);
```

**5. 加密通信**
```javascript
// 使用对称加密（AES）
const encryptedData = AES.encrypt(data, sessionKey);
```

#### HTTPS优点
- 数据加密传输
- 身份认证
- 数据完整性校验
- SEO优化（搜索引擎优先）

#### HTTPS缺点
- 握手延迟（多次往返）
- 证书成本
- 计算资源消耗

## 2. 30秒没有连接，怎么处理，会产生什么样的问题？
**问题：** 30秒没有连接，怎么处理，会产生什么样的问题？

### 解答

#### 超时问题分析

**1. 常见超时场景**
```javascript
// 网络请求超时
fetch('/api/data', {
  signal: AbortSignal.timeout(30000)  // 30秒超时
});

// XMLHttpRequest超时
const xhr = new XMLHttpRequest();
xhr.timeout = 30000;
xhr.ontimeout = () => {
  console.log('请求超时');
};
```

#### 超时处理策略

**1. 请求超时**
```javascript
// 方案1：使用AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

fetch('/api/data', {
  signal: controller.signal
})
  .then(res => res.json())
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('请求超时');
    }
  })
  .finally(() => {
    clearTimeout(timeoutId);
  });

// 方案2：Promise.race
function fetchWithTimeout(url, timeout = 30000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('请求超时')), timeout)
    )
  ]);
}

fetchWithTimeout('/api/data')
  .then(res => res.json())
  .catch(err => {
    console.error(err.message);
  });
```

**2. 重试机制**
```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const { timeout = 30000, retryDelay = 1000 } = options;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      console.log(`尝试 ${i + 1}/${maxRetries} 失败:`, error.message);

      if (i === maxRetries - 1) {
        throw error;
      }

      // 指数退避
      const delay = retryDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 使用
fetchWithRetry('/api/data', { timeout: 30000 }, 3)
  .then(res => res.json())
  .catch(err => {
    console.error('最终失败:', err);
    // 显示错误提示
    showError('网络请求失败，请稍后重试');
  });
```

**3. 降级策略**
```javascript
async function fetchWithFallback(url) {
  try {
    // 尝试主接口
    return await fetchWithTimeout(url, 30000);
  } catch (error) {
    console.log('主接口失败，使用备用接口');

    try {
      // 备用接口
      return await fetchWithTimeout(url.replace('/api/', '/backup-api/'), 30000);
    } catch (backupError) {
      console.log('备用接口失败，使用缓存');

      // 使用缓存数据
      const cached = localStorage.getItem(url);
      if (cached) {
        return { json: () => JSON.parse(cached) };
      }

      throw new Error('所有方案都失败了');
    }
  }
}
```

**4. 用户体验优化**
```javascript
function DataFetcher() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeoutWarning, setTimeoutWarning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setTimeoutWarning(false);

    // 15秒后显示警告
    const warningTimer = setTimeout(() => {
      setTimeoutWarning(true);
    }, 15000);

    try {
      const response = await fetchWithRetry('/api/data', {
        timeout: 30000
      }, 3);

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('网络请求失败，请检查网络连接');
    } finally {
      clearTimeout(warningTimer);
      setLoading(false);
      setTimeoutWarning(false);
    }
  };

  return (
    <div>
      {loading && (
        <div>
          加载中...
          {timeoutWarning && <p>网络较慢，请耐心等待</p>}
        </div>
      )}
      {error && <div>{error}</div>}
      {data && <div>{JSON.stringify(data)}</div>}
      <button onClick={fetchData}>重新加载</button>
    </div>
  );
}
```

#### 产生的问题

**1. 资源占用**
- 连接占用服务器资源
- 客户端内存占用

**2. 用户体验**
- 白屏时间过长
- 用户焦虑

**3. 系统问题**
- 连接池耗尽
- 服务器压力

**4. 解决方案**
```javascript
// 1. Keep-Alive（复用连接）
fetch('/api/data', {
  keepalive: true
});

// 2. 连接池管理
class ConnectionPool {
  constructor(maxConnections = 6) {
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
    this.queue = [];
  }

  async request(url) {
    if (this.activeConnections >= this.maxConnections) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.activeConnections++;

    try {
      const response = await fetch(url);
      return response;
    } finally {
      this.activeConnections--;

      if (this.queue.length > 0) {
        const resolve = this.queue.shift();
        resolve();
      }
    }
  }
}

const pool = new ConnectionPool(6);

// 3. 请求取消（组件卸载时）
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', {
    signal: controller.signal
  });

  return () => {
    controller.abort();  // 组件卸载时取消请求
  };
}, []);
```

## 3. HTTP/2.0的优化点和原理
**问题：** HTTP/2.0的优化点有哪些？与HTTP/1.x的区别？

### 解答

#### HTTP/2.0核心优化

**1. 二进制分帧（Binary Framing）**
```javascript
// HTTP/1.x: 文本协议
GET /index.html HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0

// HTTP/2: 二进制协议
// 将数据分割成更小的帧（Frame）
/*
+-----------------------------------------------+
|                 Length (24)                   |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |
+-+-------------+---------------+-------------------------------+
|R|                 Stream Identifier (31)                      |
+=+=============================================================+
|                   Frame Payload (0...)                      ...
+---------------------------------------------------------------+
*/

// 帧类型：
// - HEADERS Frame: 传输HTTP头部
// - DATA Frame: 传输HTTP消息体
// - PRIORITY Frame: 设置流的优先级
// - RST_STREAM Frame: 终止流
// - SETTINGS Frame: 配置连接参数
// - PUSH_PROMISE Frame: 服务器推送
// - PING Frame: 心跳检测
// - GOAWAY Frame: 关闭连接
```

**2. 多路复用（Multiplexing）**
```javascript
// HTTP/1.x的问题：队头阻塞（Head-of-Line Blocking）
// 浏览器对同一域名的并发连接数限制：6个
/*
连接1: [=====请求1=====][=====请求2=====]
连接2: [=====请求3=====][=====请求4=====]
连接3: [=====请求5=====][=====请求6=====]
等待... 请求7, 请求8...
*/

// HTTP/2: 单连接多路复用
/*
单个TCP连接:
Stream 1: [==请求1==][==响应1==]
Stream 2:   [==请求2==][==响应2==]
Stream 3:     [==请求3==][==响应3==]
Stream 4: [==请求4==][==响应4==]
... 可以并发无数个请求
*/

// 实现原理
// 1. 每个请求都有唯一的Stream ID
// 2. 帧可以交错发送，不必按顺序
// 3. 接收端根据Stream ID重组数据

// Node.js HTTP/2服务器示例
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
});

server.on('stream', (stream, headers) => {
  // 每个请求对应一个stream
  console.log('Stream ID:', stream.id);

  stream.respond({
    ':status': 200,
    'content-type': 'text/html'
  });

  stream.end('<h1>Hello HTTP/2</h1>');
});

server.listen(443);

// 性能对比
/*
HTTP/1.1 (6个连接):
- 100个请求 = 17轮请求 (100/6 ≈ 17)
- 每轮RTT: 100ms
- 总时间: 1700ms

HTTP/2 (1个连接):
- 100个请求 = 1轮请求（多路复用）
- RTT: 100ms
- 总时间: 100ms
性能提升: 17倍
*/
```

**3. 头部压缩（HPACK）**
```javascript
// HTTP/1.x的问题：头部冗余
// 每个请求都要发送完整的头部
/*
请求1:
GET /api/user HTTP/1.1
Host: api.example.com
User-Agent: Mozilla/5.0 ...
Accept: application/json
Cookie: session=abc123...
Authorization: Bearer token...
总大小: ~500字节

请求2:
GET /api/posts HTTP/1.1
Host: api.example.com
User-Agent: Mozilla/5.0 ...
Accept: application/json
Cookie: session=abc123...
Authorization: Bearer token...
总大小: ~500字节
*/

// HTTP/2: HPACK压缩
// 1. 静态表：预定义的常用头部
const STATIC_TABLE = {
  1: [':authority', ''],
  2: [':method', 'GET'],
  3: [':method', 'POST'],
  4: [':path', '/'],
  5: [':path', '/index.html'],
  // ... 61个预定义条目
};

// 2. 动态表：自定义头部缓存
const dynamicTable = new Map();

// 3. 头部编码
/*
首次请求:
GET /api/user HTTP/2
Host: api.example.com
User-Agent: Mozilla/5.0 ...

编码后:
:method: 2 (引用静态表)
:path: /api/user (字面量，加入动态表)
host: api.example.com (字面量，加入动态表)
user-agent: ... (字面量，加入动态表)

后续请求:
GET /api/posts HTTP/2
Host: api.example.com
User-Agent: Mozilla/5.0 ...

编码后:
:method: 2 (引用静态表)
:path: /api/posts (字面量)
host: 62 (引用动态表)
user-agent: 63 (引用动态表)
*/

// 压缩效果
/*
原始头部: 500字节
压缩后: 50-100字节
压缩率: 80-90%
*/

// Node.js示例
const http2 = require('http2');

const client = http2.connect('https://example.com');

// 第一个请求
const req1 = client.request({
  ':path': '/api/user',
  'custom-header': 'value1'
});

// 第二个请求：自动复用头部
const req2 = client.request({
  ':path': '/api/posts',
  'custom-header': 'value1'  // 自动引用缓存
});
```

**4. 服务器推送（Server Push）**
```javascript
// HTTP/1.x的问题：多次往返
/*
客户端请求HTML:
GET /index.html
↓
服务器返回HTML:
<html>
  <link href="/style.css">
  <script src="/app.js">
</html>
↓
客户端解析HTML，发现需要CSS和JS:
GET /style.css
GET /app.js
↓
服务器返回CSS和JS

总RTT: 3次
*/

// HTTP/2: 服务器推送
/*
客户端请求HTML:
GET /index.html
↓
服务器主动推送:
PUSH_PROMISE /style.css
PUSH_PROMISE /app.js
返回 /index.html
返回 /style.css
返回 /app.js

总RTT: 1次
性能提升: 3倍
*/

// Node.js实现服务器推送
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
});

server.on('stream', (stream, headers) => {
  if (headers[':path'] === '/index.html') {
    // 主动推送CSS和JS
    stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
      if (err) throw err;
      pushStream.respond({ ':status': 200, 'content-type': 'text/css' });
      pushStream.end(fs.readFileSync('style.css'));
    });

    stream.pushStream({ ':path': '/app.js' }, (err, pushStream) => {
      if (err) throw err;
      pushStream.respond({ ':status': 200, 'content-type': 'application/javascript' });
      pushStream.end(fs.readFileSync('app.js'));
    });

    // 返回HTML
    stream.respond({ ':status': 200, 'content-type': 'text/html' });
    stream.end(fs.readFileSync('index.html'));
  }
});

server.listen(443);

// 客户端处理推送
// 浏览器会自动缓存推送的资源
// 如果不需要，可以发送RST_STREAM拒绝

// Link头部方式（更简单）
app.get('/index.html', (req, res) => {
  res.set('Link', '</style.css>; rel=preload; as=style, </app.js>; rel=preload; as=script');
  res.sendFile('index.html');
});
```

**5. 流优先级（Stream Priority）**
```javascript
// 为不同的请求设置优先级
/*
优先级树:
        Root
         |
    +----+----+
    |         |
  HTML      CSS (依赖HTML)
    |
  +---+---+
  |       |
 JS      IMG (依赖HTML)

权重分配:
- HTML: weight=256 (最高优先级)
- CSS: weight=220 (依赖HTML)
- JS: weight=192
- IMG: weight=32 (最低优先级)
*/

// Node.js设置优先级
const http2 = require('http2');

const client = http2.connect('https://example.com');

// 关键资源：高优先级
const htmlReq = client.request({
  ':path': '/index.html'
});
htmlReq.priority({
  weight: 256,
  parent: 0,
  exclusive: false
});

// 次要资源：低优先级
const imgReq = client.request({
  ':path': '/background.jpg'
});
imgReq.priority({
  weight: 32,
  parent: 0,
  exclusive: false
});

// 浏览器自动设置优先级
/*
最高优先级: HTML, CSS
高优先级: JavaScript
中优先级: Fonts
低优先级: 图片, 视频
*/
```

**6. 请求响应模型对比**
```javascript
// HTTP/1.x: Keep-Alive
/*
优点:
- 复用TCP连接
- 减少握手开销

缺点:
- 管道化（Pipelining）很少使用（兼容性问题）
- 队头阻塞：一个慢请求阻塞后续请求
- 需要多个连接（浏览器限制6个）

示例:
连接1: [请求1][等待响应1][请求2][等待响应2]
如果响应1很慢，请求2必须等待
*/

// HTTP/2: 多路复用
/*
优点:
- 单连接，无限并发
- 无队头阻塞
- 自动优先级调度
- 服务器推送

缺点:
- TCP层的队头阻塞仍存在
- 需要HTTPS（大部分实现）

示例:
单连接: [Stream1][Stream2][Stream3]...
所有请求并发执行，互不影响
*/

// HTTP/3 (QUIC): 解决TCP队头阻塞
/*
使用UDP替代TCP:
- 无TCP队头阻塞
- 更快的连接建立（0-RTT）
- 连接迁移（IP切换不断线）
*/
```

#### HTTP/2性能优化实践

**1. 资源合并策略变化**
```javascript
// HTTP/1.x: 合并资源（减少请求数）
// ✓ 合并CSS
<link rel="stylesheet" href="bundle.css">  // 包含所有CSS

// ✓ 合并JavaScript
<script src="bundle.js"></script>  // 包含所有JS

// ✓ 雪碧图（CSS Sprites）
.icon1 { background-position: 0 0; }
.icon2 { background-position: -20px 0; }

// HTTP/2: 拆分资源（利用多路复用和缓存）
// ✓ 按模块拆分
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="header.css">
<link rel="stylesheet" href="footer.css">

// ✓ 按路由拆分
<script src="common.js"></script>
<script src="home.js"></script>

// ✓ 独立图片（利用缓存）
<img src="icon1.png">
<img src="icon2.png">

// 优势：
// 1. 更好的缓存粒度（修改header.css不影响base.css缓存）
// 2. 按需加载（首页不需要footer.css）
// 3. 更快的增量更新
```

**2. 域名分片策略变化**
```javascript
// HTTP/1.x: 域名分片（突破6个连接限制）
<img src="https://img1.example.com/a.jpg">
<img src="https://img2.example.com/b.jpg">
<img src="https://img3.example.com/c.jpg">
<img src="https://img4.example.com/d.jpg">

// 问题：
// - DNS解析开销（每个域名都要解析）
// - TCP握手开销（每个域名都要握手）
// - TLS握手开销

// HTTP/2: 单域名（利用多路复用）
<img src="https://img.example.com/a.jpg">
<img src="https://img.example.com/b.jpg">
<img src="https://img.example.com/c.jpg">
<img src="https://img.example.com/d.jpg">

// 优势：
// - 1次DNS解析
// - 1次TCP握手
// - 1次TLS握手
// - 1个连接处理所有请求
```

**3. Nginx配置HTTP/2**
```nginx
# 启用HTTP/2
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HTTP/2服务器推送
    location = /index.html {
        http2_push /style.css;
        http2_push /app.js;
        http2_push /logo.png;
    }

    # 优化缓存策略
    location ~* \.(css|js)$ {
        # 小文件不合并，利用多路复用
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 优先级提示
    location ~* \.(css)$ {
        add_header Link "</style.css>; rel=preload; as=style";
    }

    # HPACK静态表大小
    http2_max_field_size 16k;
    http2_max_header_size 32k;
}
```

**4. 前端优化策略**
```html
<!-- 1. 使用资源提示 -->
<!-- 预连接（适用于HTTP/1.x和HTTP/2） -->
<link rel="preconnect" href="https://api.example.com">

<!-- HTTP/2中不需要预加载太多（自动推送） -->
<!-- 但仍可用于关键资源 -->
<link rel="preload" href="/critical.css" as="style">

<!-- 2. 模块化加载 -->
<script type="module">
  // 利用HTTP/2并发加载多个模块
  import { header } from './header.js';
  import { footer } from './footer.js';
</script>

<!-- 3. 避免内联（利用缓存） -->
<!-- HTTP/1.x: 内联减少请求 -->
<style>
  /* 关键CSS内联 */
  body { margin: 0; }
</style>

<!-- HTTP/2: 外部文件利用缓存和推送 -->
<link rel="stylesheet" href="/critical.css">
```

**5. 性能监控**
```javascript
// 检测HTTP/2支持
if (window.PerformanceObserver) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(entry.name, entry.nextHopProtocol);
      // 输出: "h2" (HTTP/2), "http/1.1", "h3" (HTTP/3)
    }
  });

  observer.observe({ entryTypes: ['resource'] });
}

// 对比HTTP/1.x和HTTP/2性能
async function benchmark() {
  const urls = Array.from({ length: 100 }, (_, i) => `/image${i}.jpg`);

  const start = performance.now();

  await Promise.all(urls.map(url => fetch(url)));

  const end = performance.now();

  console.log(`加载100个资源耗时: ${end - start}ms`);

  // HTTP/1.x: ~5000ms (受连接数限制)
  // HTTP/2: ~500ms (多路复用)
}

// 服务器推送检测
performance.getEntriesByType('navigation').forEach(entry => {
  if (entry.nextHopProtocol === 'h2') {
    console.log('HTTP/2已启用');
  }
});

performance.getEntriesByType('resource').forEach(entry => {
  if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
    console.log(`${entry.name} 可能来自服务器推送`);
  }
});
```

#### HTTP/2最佳实践总结

```javascript
// 1. 启用HTTP/2
// ✓ 使用HTTPS（大部分浏览器要求）
// ✓ 配置服务器支持（Nginx, Apache, Node.js）

// 2. 资源策略调整
// ✓ 拆分资源，不要过度合并
// ✓ 按模块组织资源
// ✓ 利用缓存粒度

// 3. 减少域名分片
// ✓ 使用单个域名
// ✓ 利用CDN时注意

// 4. 服务器推送
// ✓ 推送关键资源（CSS, JS）
// ✓ 不要推送太多（浪费带宽）
// ✓ 配合缓存策略

// 5. 优先级管理
// ✓ 关键资源高优先级
// ✓ 次要资源低优先级

// 6. 监控和测试
// ✓ 使用Chrome DevTools
// ✓ 对比HTTP/1.x性能
// ✓ 检测服务器推送效果

// 性能提升预期：
// - 首屏加载: 20-30%提升
// - 多资源页面: 50-60%提升
// - 弱网环境: 30-40%提升
```

## 4. 浏览器缓存策略及其使用
**问题：** 浏览器缓存策略及其使用

### 解答

#### 缓存分类

**1. 强缓存（不发请求）**
```
客户端 → 检查缓存 → 直接使用
```

**2. 协商缓存（发请求验证）**
```
客户端 → 服务器验证 → 304（使用缓存）或 200（新数据）
```

#### 强缓存

**Expires（HTTP/1.0）**
```
Expires: Wed, 21 Oct 2025 07:28:00 GMT
```
- 缺点：使用绝对时间，客户端时间可能不准

**Cache-Control（HTTP/1.1）**
```
Cache-Control: max-age=31536000
```

常用指令：
```javascript
// 公共资源，可被CDN缓存
Cache-Control: public, max-age=31536000

// 私有资源，不能被CDN缓存
Cache-Control: private, max-age=3600

// 不缓存
Cache-Control: no-store

// 每次使用前验证
Cache-Control: no-cache

// 必须验证（代理服务器也要验证）
Cache-Control: must-revalidate

// 过期后可使用，但需异步验证
Cache-Control: stale-while-revalidate=86400
```

#### 协商缓存

**Last-Modified / If-Modified-Since**
```
// 响应头
Last-Modified: Wed, 21 Oct 2023 07:28:00 GMT

// 请求头
If-Modified-Since: Wed, 21 Oct 2023 07:28:00 GMT

// 响应
304 Not Modified（使用缓存）
200 OK（返回新数据）
```

**ETag / If-None-Match**
```
// 响应头
ETag: "abc123"

// 请求头
If-None-Match: "abc123"

// 响应
304 Not Modified
```

#### 缓存策略对比

| 方式 | 优点 | 缺点 | 适用场景 |
|-----|------|------|---------|
| Expires | 简单 | 时间不准 | HTTP/1.0 |
| Cache-Control | 灵活 | - | 推荐使用 |
| Last-Modified | 简单 | 精度1秒 | 大文件 |
| ETag | 精确 | 计算开销 | 小文件 |

#### 实战应用

**1. Webpack配置**
```javascript
module.exports = {
  output: {
    // 内容hash，文件变化hash就变
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js'
  }
};
```

**2. HTML文件**
```html
<!-- 不缓存HTML -->
<meta http-equiv="Cache-Control" content="no-cache">
<meta http-equiv="Expires" content="0">
```

```nginx
# Nginx配置
location ~* \.html$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

**3. JS/CSS文件**
```nginx
# 带hash的文件，长期缓存
location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

**4. 图片文件**
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
    add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

**5. API接口**
```javascript
// Express
app.get('/api/data', (req, res) => {
  res.set({
    'Cache-Control': 'private, max-age=300',  // 5分钟
    'ETag': calculateETag(data)
  });
  res.json(data);
});

// 协商缓存
app.get('/api/data', (req, res) => {
  const etag = calculateETag(data);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.set('ETag', etag);
  res.json(data);
});
```

#### 缓存最佳实践

**1. 不同资源使用不同策略**
```javascript
// HTML：不缓存或短期缓存
Cache-Control: no-cache

// JS/CSS（带hash）：长期缓存
Cache-Control: public, max-age=31536000, immutable

// 图片：中期缓存
Cache-Control: public, max-age=2592000

// API：短期缓存 + 协商缓存
Cache-Control: private, max-age=300
ETag: "abc123"
```

**2. Service Worker缓存**
```javascript
// sw.js
const CACHE_NAME = 'v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // 缓存命中，返回缓存
        // 同时发起网络请求更新缓存
        fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        });
        return response;
      }

      // 缓存未命中，发起网络请求
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});
```

**3. 清除缓存**
```javascript
// 手动清除
caches.keys().then((names) => {
  names.forEach((name) => {
    caches.delete(name);
  });
});

// 版本管理
const CACHE_VERSION = 'v2';
const CACHE_NAME = `my-cache-${CACHE_VERSION}`;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```
