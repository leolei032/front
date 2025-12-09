# HTTP高级网络协议详解

> 深入解析HTTP/2、HTTP/3、OPTIONS请求、RESTful API和网络优化

---

## 目录

1. [HTTP/2深度解析](#1-http2深度解析)
2. [OPTIONS预检请求](#2-options预检请求)
3. [RESTful API设计](#3-restful-api设计)
4. [网络并发限制](#4-网络并发限制)
5. [HTTP/3和QUIC协议](#5-http3和quic协议)

---

## 1. HTTP/2深度解析

### 1.1 HTTP/1.1的问题

```javascript
// HTTP/1.1的主要问题

// 1. 队头阻塞 (Head-of-Line Blocking)
// 一个连接同时只能处理一个请求
请求1: GET /api/user  → 响应需要2秒
请求2: GET /api/posts → 等待请求1完成才能发送 ❌

// 2. 无法多路复用
// 需要建立多个TCP连接
Connection 1: GET /api/user
Connection 2: GET /api/posts
Connection 3: GET /style.css
// 浏览器限制: 同一域名最多6个并发连接

// 3. 头部冗余
// 每个请求都要发送完整的HTTP头
Request 1:
GET /api/user
Host: example.com
User-Agent: Mozilla/5.0...
Cookie: session_id=abc123; user_pref=xyz;
Accept: application/json
// ... 大量重复的头部信息

Request 2:
GET /api/posts
Host: example.com                    // 重复
User-Agent: Mozilla/5.0...          // 重复
Cookie: session_id=abc123...        // 重复
Accept: application/json            // 重复

// 4. 无优先级控制
// 无法指定哪个资源更重要
```

### 1.2 HTTP/2的核心特性

#### 1.2.1 二进制分帧 (Binary Framing)

```javascript
// HTTP/1.1 - 文本协议
GET /api/user HTTP/1.1\r\n
Host: example.com\r\n
\r\n

// HTTP/2 - 二进制协议
// 将消息分割成更小的帧 (Frame)
[HEADERS Frame]
[DATA Frame]
[DATA Frame]
...

// 帧的结构
class HTTP2Frame {
    constructor() {
        this.length = 0;      // 3字节 - 帧长度
        this.type = 0;        // 1字节 - 帧类型
        this.flags = 0;       // 1字节 - 标志位
        this.streamId = 0;    // 4字节 - 流标识
        this.payload = null;  // 负载数据
    }
}

// 帧类型
const FrameTypes = {
    DATA: 0x0,          // 数据帧
    HEADERS: 0x1,       // 头部帧
    PRIORITY: 0x2,      // 优先级帧
    RST_STREAM: 0x3,    // 流重置帧
    SETTINGS: 0x4,      // 设置帧
    PUSH_PROMISE: 0x5,  // 推送承诺帧
    PING: 0x6,          // PING帧
    GOAWAY: 0x7,        // GOAWAY帧
    WINDOW_UPDATE: 0x8, // 窗口更新帧
    CONTINUATION: 0x9   // 延续帧
};
```

#### 1.2.2 多路复用 (Multiplexing) ⭐⭐⭐

```javascript
/**
 * HTTP/2多路复用原理
 *
 * 一个TCP连接上可以同时传输多个流(Stream)
 * 每个流由多个帧组成，帧可以交错发送
 */

// 模拟HTTP/2多路复用
class HTTP2Connection {
    constructor() {
        this.streams = new Map();  // 存储所有流
        this.nextStreamId = 1;     // 流ID（客户端为奇数）
    }

    // 创建新流
    createStream() {
        const streamId = this.nextStreamId;
        this.nextStreamId += 2;  // 客户端流ID为奇数

        const stream = new HTTP2Stream(streamId);
        this.streams.set(streamId, stream);

        return stream;
    }

    // 发送多个请求（并行）
    async sendRequests(urls) {
        const promises = urls.map(url => {
            const stream = this.createStream();
            return stream.sendRequest(url);
        });

        // 所有请求并行发送，不需要等待
        return Promise.all(promises);
    }
}

class HTTP2Stream {
    constructor(id) {
        this.id = id;
        this.state = 'IDLE';
    }

    async sendRequest(url) {
        console.log(`Stream ${this.id}: Sending request to ${url}`);

        // 发送HEADERS帧
        this.sendFrame({
            type: 'HEADERS',
            streamId: this.id,
            payload: {
                ':method': 'GET',
                ':path': url,
                ':scheme': 'https',
                ':authority': 'example.com'
            }
        });

        this.state = 'OPEN';

        // 等待响应（模拟）
        return this.waitForResponse();
    }

    sendFrame(frame) {
        // 模拟发送帧
        console.log(`Sending frame: Type=${frame.type}, StreamId=${frame.streamId}`);
    }

    async waitForResponse() {
        // 模拟接收响应帧
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`Stream ${this.id}: Received response`);
                resolve({ streamId: this.id, data: 'response data' });
            }, Math.random() * 1000);
        });
    }
}

// 使用示例
async function demo_multiplexing() {
    const conn = new HTTP2Connection();

    console.log('=== HTTP/2 多路复用示例 ===\n');

    const urls = [
        '/api/user',
        '/api/posts',
        '/api/comments',
        '/style.css',
        '/script.js'
    ];

    console.log('同时发送5个请求...\n');
    const start = Date.now();

    const responses = await conn.sendRequests(urls);

    const duration = Date.now() - start;
    console.log(`\n所有请求完成，耗时: ${duration}ms`);

    // HTTP/1.1对比
    console.log('\n=== HTTP/1.1对比 ===');
    console.log('需要建立5个TCP连接（或排队等待）');
    console.log('总耗时会更长');
}

// demo_multiplexing();
```

**多路复用的优势**：

```
HTTP/1.1:
时间轴 ────────────────────────────────→
Conn1: [========请求1========]
Conn2:     [====请求2====]
Conn3:         [===请求3===]
总耗时: 最长请求的时间

HTTP/2:
时间轴 ────────────────────────────────→
Conn1: [请求1][请求2][请求3][请求4][请求5]
       │  └─┐  └─┐  └─┐  └─┐
       │    │    │    │    └─ 响应5
       │    │    │    └────── 响应4
       │    │    └─────────── 响应3
       │    └──────────────── 响应2
       └───────────────────── 响应1
所有请求并行，总耗时大幅减少
```

#### 1.2.3 头部压缩 (HPACK) ⭐⭐⭐

```javascript
/**
 * HPACK头部压缩算法
 *
 * 核心思想：
 * 1. 维护一个静态表（常用头部）
 * 2. 维护一个动态表（本连接中出现过的头部）
 * 3. 使用哈夫曼编码压缩值
 */

// HPACK静态表（部分）
const STATIC_TABLE = [
    { index: 1, name: ':authority', value: '' },
    { index: 2, name: ':method', value: 'GET' },
    { index: 3, name: ':method', value: 'POST' },
    { index: 4, name: ':path', value: '/' },
    { index: 5, name: ':path', value: '/index.html' },
    { index: 6, name: ':scheme', value: 'http' },
    { index: 7, name: ':scheme', value: 'https' },
    { index: 8, name: ':status', value: '200' },
    { index: 14, name: 'accept-encoding', value: 'gzip, deflate' },
    { index: 16, name: 'accept-language', value: '' },
    { index: 31, name: 'cookie', value: '' },
    // ... 更多预定义头部
];

class HPACKEncoder {
    constructor() {
        this.dynamicTable = [];
        this.maxDynamicTableSize = 4096;
    }

    // 编码头部
    encode(headers) {
        const encoded = [];

        for (const [name, value] of Object.entries(headers)) {
            // 1. 查找静态表
            const staticEntry = this.findInStaticTable(name, value);
            if (staticEntry) {
                // 完全匹配 - 使用索引
                encoded.push({ type: 'indexed', index: staticEntry.index });
                continue;
            }

            // 2. 查找动态表
            const dynamicEntry = this.findInDynamicTable(name, value);
            if (dynamicEntry) {
                encoded.push({ type: 'indexed', index: dynamicEntry.index });
                continue;
            }

            // 3. 只找到名字，值需要编码
            const nameOnlyEntry = this.findInStaticTable(name);
            if (nameOnlyEntry) {
                encoded.push({
                    type: 'literal-with-index',
                    nameIndex: nameOnlyEntry.index,
                    value: this.encodeString(value)
                });
            } else {
                // 4. 完全新的头部
                encoded.push({
                    type: 'literal-new',
                    name: this.encodeString(name),
                    value: this.encodeString(value)
                });
            }

            // 添加到动态表
            this.addToDynamicTable(name, value);
        }

        return encoded;
    }

    findInStaticTable(name, value) {
        return STATIC_TABLE.find(entry =>
            entry.name === name && (value === undefined || entry.value === value)
        );
    }

    findInDynamicTable(name, value) {
        return this.dynamicTable.find(entry =>
            entry.name === name && (value === undefined || entry.value === value)
        );
    }

    addToDynamicTable(name, value) {
        // 添加到动态表头部
        this.dynamicTable.unshift({ name, value });

        // 检查大小限制
        let size = 0;
        for (let i = 0; i < this.dynamicTable.length; i++) {
            const entry = this.dynamicTable[i];
            size += entry.name.length + entry.value.length + 32;

            if (size > this.maxDynamicTableSize) {
                // 移除超出的条目
                this.dynamicTable = this.dynamicTable.slice(0, i);
                break;
            }
        }
    }

    // 哈夫曼编码字符串
    encodeString(str) {
        // 简化实现，实际使用哈夫曼树
        return {
            huffman: true,
            data: Buffer.from(str).toString('base64')
        };
    }
}

// 压缩效果对比
function demo_hpack() {
    const encoder = new HPACKEncoder();

    // 第一个请求
    const headers1 = {
        ':method': 'GET',
        ':scheme': 'https',
        ':path': '/api/user',
        ':authority': 'example.com',
        'user-agent': 'Mozilla/5.0...',
        'accept': 'application/json',
        'cookie': 'session_id=abc123'
    };

    console.log('=== 第一个请求 ===');
    console.log('原始大小:', JSON.stringify(headers1).length, 'bytes');

    const encoded1 = encoder.encode(headers1);
    console.log('压缩后:', JSON.stringify(encoded1).length, 'bytes');
    console.log('压缩比:', ((1 - JSON.stringify(encoded1).length / JSON.stringify(headers1).length) * 100).toFixed(1) + '%\n');

    // 第二个请求（很多头部相同）
    const headers2 = {
        ':method': 'GET',              // 索引2 (静态表)
        ':scheme': 'https',            // 索引7 (静态表)
        ':path': '/api/posts',         // 新值
        ':authority': 'example.com',   // 已在动态表
        'user-agent': 'Mozilla/5.0...', // 已在动态表
        'accept': 'application/json',  // 已在动态表
        'cookie': 'session_id=abc123'  // 已在动态表
    };

    console.log('=== 第二个请求 ===');
    console.log('原始大小:', JSON.stringify(headers2).length, 'bytes');

    const encoded2 = encoder.encode(headers2);
    console.log('压缩后:', JSON.stringify(encoded2).length, 'bytes');
    console.log('压缩比:', ((1 - JSON.stringify(encoded2).length / JSON.stringify(headers2).length) * 100).toFixed(1) + '%');
    console.log('\n大部分头部使用索引引用，大幅减少数据量！');
}

demo_hpack();
```

#### 1.2.4 服务器推送 (Server Push)

```javascript
/**
 * HTTP/2服务器推送
 * 服务器可以主动推送资源给客户端
 */

// Node.js HTTP/2服务器示例
const http2 = require('http2');
const fs = require('fs');

function createHTTP2Server() {
    const server = http2.createSecureServer({
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.crt')
    });

    server.on('stream', (stream, headers) => {
        const path = headers[':path'];

        console.log(`收到请求: ${path}`);

        if (path === '/index.html') {
            // 主动推送CSS和JS
            console.log('推送 style.css 和 script.js');

            // 推送CSS
            stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
                if (err) throw err;

                pushStream.respond({
                    ':status': 200,
                    'content-type': 'text/css'
                });

                pushStream.end(fs.readFileSync('./style.css'));
            });

            // 推送JS
            stream.pushStream({ ':path': '/script.js' }, (err, pushStream) => {
                if (err) throw err;

                pushStream.respond({
                    ':status': 200,
                    'content-type': 'application/javascript'
                });

                pushStream.end(fs.readFileSync('./script.js'));
            });

            // 响应HTML
            stream.respond({
                ':status': 200,
                'content-type': 'text/html'
            });

            stream.end(fs.readFileSync('./index.html'));
        }
    });

    server.listen(3000);
    console.log('HTTP/2 server listening on https://localhost:3000');
}

// createHTTP2Server();
```

**服务器推送的优势**：

```
传统方式 (HTTP/1.1):
客户端                                服务器
  │                                    │
  ├──── GET /index.html ────────────→ │
  │ ←────── HTML ──────────────────── │
  │ (解析HTML，发现需要style.css)      │
  ├──── GET /style.css ─────────────→ │
  │ ←────── CSS ───────────────────── │
  │ (解析HTML，发现需要script.js)     │
  ├──── GET /script.js ─────────────→ │
  │ ←────── JS ────────────────────── │
总共3次往返 (RTT)

HTTP/2服务器推送:
客户端                                服务器
  │                                    │
  ├──── GET /index.html ────────────→ │
  │ ←────── HTML ──────────────────── │
  │ ←────── PUSH: style.css ────────── │ (主动推送)
  │ ←────── PUSH: script.js ─────────── │ (主动推送)
只需1次往返 (RTT)
```

#### 1.2.5 流优先级 (Stream Priority)

```javascript
/**
 * HTTP/2流优先级
 * 可以指定哪些资源更重要
 */

class StreamPriority {
    constructor() {
        // 优先级树
        this.tree = {
            0: {  // 根节点（虚拟流）
                children: [],
                weight: 1
            }
        };
    }

    // 设置流的优先级
    setPriority(streamId, dependency, weight, exclusive) {
        const node = {
            streamId,
            dependency,      // 依赖的流ID
            weight,          // 权重 (1-256)
            exclusive,       // 是否独占依赖流
            children: []
        };

        if (exclusive) {
            // 独占模式：插入到依赖流和其子流之间
            const parent = this.tree[dependency];
            node.children = parent.children;
            parent.children = [node];
        } else {
            // 非独占：作为依赖流的兄弟节点
            const parent = this.tree[dependency];
            parent.children.push(node);
        }

        this.tree[streamId] = node;
    }

    // 计算流的权重
    calculateWeight(streamId) {
        const node = this.tree[streamId];
        if (!node) return 0;

        const parent = this.tree[node.dependency];
        const siblings = parent.children;

        const totalWeight = siblings.reduce((sum, s) => sum + s.weight, 0);
        return node.weight / totalWeight;
    }
}

// 使用示例
const priority = new StreamPriority();

// 设置优先级
// 1. HTML文件 - 最高优先级
priority.setPriority(1, 0, 256, false);

// 2. CSS文件 - 依赖HTML，高优先级
priority.setPriority(3, 1, 200, false);

// 3. JS文件 - 依赖HTML，中优先级
priority.setPriority(5, 1, 150, false);

// 4. 图片 - 依赖HTML，低优先级
priority.setPriority(7, 1, 50, false);

console.log('HTML权重:', priority.calculateWeight(1));
console.log('CSS权重:', priority.calculateWeight(3));
console.log('JS权重:', priority.calculateWeight(5));
console.log('图片权重:', priority.calculateWeight(7));
```

### 1.3 HTTP/2 vs HTTP/1.1对比

| 特性 | HTTP/1.1 | HTTP/2 |
|------|----------|--------|
| 协议格式 | 文本 | 二进制 |
| 多路复用 | ❌ 否（需要多个连接） | ✅ 是（一个连接） |
| 头部压缩 | ❌ 否 | ✅ HPACK |
| 服务器推送 | ❌ 否 | ✅ 是 |
| 流优先级 | ❌ 否 | ✅ 是 |
| 队头阻塞 | ✅ 应用层阻塞 | ⚠️ TCP层可能阻塞 |
| 连接复用 | Keep-Alive（有限） | 完全复用 |

### 1.4 HTTP/2实战配置

```javascript
// Nginx配置HTTP/2
/*
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 开启服务器推送
    location / {
        http2_push /style.css;
        http2_push /script.js;
        root /var/www/html;
    }

    # 优化配置
    http2_max_concurrent_streams 128;
    http2_recv_timeout 30s;
}
*/

// Webpack开发服务器配置
module.exports = {
    devServer: {
        http2: true,
        https: true,
        port: 3000
    }
};

// Express服务器使用HTTP/2
const express = require('express');
const spdy = require('spdy');  // HTTP/2库
const fs = require('fs');

const app = express();

app.get('/', (req, res) => {
    // 推送资源
    if (res.push) {
        const pushStyle = res.push('/style.css', {
            request: { accept: '*/*' },
            response: { 'content-type': 'text/css' }
        });
        pushStyle.end(fs.readFileSync('./style.css'));
    }

    res.send('<html>...</html>');
});

spdy.createServer({
    key: fs.readFileSync('./server.key'),
    cert: fs.readFileSync('./server.crt')
}, app).listen(3000);
```

---

## 2. OPTIONS预检请求

### 2.1 什么是OPTIONS请求

**OPTIONS请求**：
- 跨域请求前的"预检" (Preflight)
- 检查服务器是否允许实际请求
- 浏览器自动发送，开发者无需手动处理

### 2.2 什么时候会发送OPTIONS请求

```javascript
/**
 * 简单请求 - 不会发送OPTIONS
 *
 * 满足以下所有条件：
 * 1. 请求方法：GET、HEAD、POST
 * 2. 头部字段只包含：
 *    - Accept
 *    - Accept-Language
 *    - Content-Language
 *    - Content-Type (仅限以下值)
 *      - text/plain
 *      - multipart/form-data
 *      - application/x-www-form-urlencoded
 */

// 简单请求示例
fetch('https://api.example.com/data', {
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
});
// ✅ 直接发送，不会预检

/**
 * 复杂请求 - 会发送OPTIONS预检
 *
 * 不满足简单请求条件的都是复杂请求
 */

// 复杂请求示例1：使用PUT方法
fetch('https://api.example.com/data', {
    method: 'PUT',  // ❌ 不是简单方法
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'test' })
});
// 先发送OPTIONS，再发送PUT

// 复杂请求示例2：自定义头部
fetch('https://api.example.com/data', {
    method: 'GET',
    headers: {
        'X-Custom-Header': 'value'  // ❌ 自定义头部
    }
});
// 先发送OPTIONS，再发送GET

// 复杂请求示例3：Content-Type不在允许列表
fetch('https://api.example.com/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'  // ❌ 不在简单列表中
    },
    body: JSON.stringify({ name: 'test' })
});
// 先发送OPTIONS，再发送POST
```

### 2.3 OPTIONS请求流程

```javascript
/**
 * OPTIONS预检请求完整流程
 */

// 1. 浏览器自动发送OPTIONS请求
/*
OPTIONS /api/users HTTP/1.1
Host: api.example.com
Origin: https://myapp.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, X-Custom-Header
*/

// 2. 服务器响应OPTIONS请求
/*
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://myapp.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, X-Custom-Header
Access-Control-Max-Age: 86400
Content-Length: 0
*/

// 3. 预检通过，发送实际请求
/*
PUT /api/users HTTP/1.1
Host: api.example.com
Origin: https://myapp.com
Content-Type: application/json
X-Custom-Header: value

{"name": "John"}
*/

// 4. 服务器响应实际请求
/*
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://myapp.com
Content-Type: application/json

{"id": 1, "name": "John"}
*/
```

### 2.4 服务器端处理OPTIONS

```javascript
// Express服务器处理OPTIONS
const express = require('express');
const app = express();

// 方法1：手动处理OPTIONS
app.options('/api/*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Custom-Header');
    res.header('Access-Control-Max-Age', '86400'); // 24小时缓存
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204); // No Content
});

// 方法2：使用cors中间件（推荐）
const cors = require('cors');

app.use(cors({
    origin: function(origin, callback) {
        // 允许的域名列表
        const whitelist = [
            'https://myapp.com',
            'https://app.example.com'
        ];

        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
    credentials: true,
    maxAge: 86400  // 预检请求缓存时间
}));

// 实际的API路由
app.put('/api/users', (req, res) => {
    // 处理PUT请求
    res.json({ success: true });
});

// 方法3：Nginx配置
/*
server {
    location /api/ {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Custom-Header';
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Access-Control-Allow-Credentials' 'true';
            add_header 'Content-Length' 0;
            add_header 'Content-Type' 'text/plain';
            return 204;
        }

        # 实际请求的CORS头
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        proxy_pass http://backend;
    }
}
*/
```

### 2.5 OPTIONS请求优化

```javascript
/**
 * 优化策略：减少OPTIONS请求
 */

// 1. 使用简单请求（如果可能）
// 避免：
fetch('/api/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'  // 触发预检
    },
    body: JSON.stringify(data)
});

// 改为：
fetch('/api/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'  // 不触发预检
    },
    body: new URLSearchParams(data)
});

// 2. 增加Access-Control-Max-Age
// 服务器端设置更长的缓存时间
res.header('Access-Control-Max-Age', '86400');  // 24小时
// 在缓存期内，相同的请求不会再次预检

// 3. 服务器端代理
// 同域请求不需要CORS
// 前端 → 同域API → 后端第三方API
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/api/proxy/*', async (req, res) => {
    const targetUrl = req.params[0];
    try {
        const response = await axios.get(`https://thirdparty.com/${targetUrl}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. 使用JSONP（仅GET请求）
function jsonp(url, callback) {
    const script = document.createElement('script');
    const callbackName = 'jsonp_' + Date.now();

    window[callbackName] = function(data) {
        callback(data);
        document.head.removeChild(script);
        delete window[callbackName];
    };

    script.src = `${url}?callback=${callbackName}`;
    document.head.appendChild(script);
}

jsonp('https://api.example.com/data', data => {
    console.log(data);
});
```

---

## 3. RESTful API设计

### 3.1 HTTP方法 (Methods)

```javascript
/**
 * RESTful API的HTTP方法使用规范
 */

// GET - 获取资源（幂等、安全）
GET /api/users           // 获取用户列表
GET /api/users/123       // 获取ID为123的用户
GET /api/users?page=1&limit=10  // 分页查询

// POST - 创建资源（非幂等）
POST /api/users
Body: { "name": "John", "email": "john@example.com" }
// 创建新用户，返回201 Created和资源URI

// PUT - 更新整个资源（幂等）
PUT /api/users/123
Body: { "name": "John Smith", "email": "john.smith@example.com" }
// 完整更新用户信息

// PATCH - 部分更新资源（幂等）
PATCH /api/users/123
Body: { "email": "newemail@example.com" }
// 只更新邮箱字段

// DELETE - 删除资源（幂等）
DELETE /api/users/123
// 删除ID为123的用户

// HEAD - 获取资源元信息
HEAD /api/users/123
// 只返回响应头，不返回body

// OPTIONS - 获取资源支持的方法
OPTIONS /api/users
Response: Allow: GET, POST, PUT, DELETE
```

### 3.2 RESTful API设计最佳实践

```javascript
// Express实现RESTful API
const express = require('express');
const app = express();

// 用户资源API
class UserAPI {
    // GET /api/users - 获取用户列表
    static getUsers(req, res) {
        const { page = 1, limit = 10, search } = req.query;

        // 分页和搜索
        const users = this.findUsers({ page, limit, search });

        res.json({
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: this.getTotalUsers()
            },
            links: {
                self: `/api/users?page=${page}&limit=${limit}`,
                next: `/api/users?page=${parseInt(page) + 1}&limit=${limit}`,
                prev: page > 1 ? `/api/users?page=${parseInt(page) - 1}&limit=${limit}` : null
            }
        });
    }

    // GET /api/users/:id - 获取单个用户
    static getUser(req, res) {
        const { id } = req.params;
        const user = this.findUserById(id);

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: `User with id ${id} does not exist`
            });
        }

        res.json({ data: user });
    }

    // POST /api/users - 创建用户
    static createUser(req, res) {
        const { name, email } = req.body;

        // 验证
        if (!name || !email) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Name and email are required'
            });
        }

        const user = this.saveUser({ name, email });

        res.status(201)
            .location(`/api/users/${user.id}`)
            .json({
                data: user,
                message: 'User created successfully'
            });
    }

    // PUT /api/users/:id - 完整更新用户
    static updateUser(req, res) {
        const { id } = req.params;
        const { name, email } = req.body;

        const user = this.findUserById(id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // PUT需要提供完整数据
        if (!name || !email) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Name and email are required for full update'
            });
        }

        const updated = this.updateUserById(id, { name, email });
        res.json({ data: updated });
    }

    // PATCH /api/users/:id - 部分更新用户
    static patchUser(req, res) {
        const { id } = req.params;
        const updates = req.body;

        const user = this.findUserById(id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // PATCH只更新提供的字段
        const updated = this.updateUserById(id, updates);
        res.json({ data: updated });
    }

    // DELETE /api/users/:id - 删除用户
    static deleteUser(req, res) {
        const { id } = req.params;

        const user = this.findUserById(id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        this.deleteUserById(id);
        res.status(204).send();  // No Content
    }
}

// 路由配置
app.get('/api/users', UserAPI.getUsers);
app.get('/api/users/:id', UserAPI.getUser);
app.post('/api/users', UserAPI.createUser);
app.put('/api/users/:id', UserAPI.updateUser);
app.patch('/api/users/:id', UserAPI.patchUser);
app.delete('/api/users/:id', UserAPI.deleteUser);
```

---

## 4. 网络并发限制

### 4.1 浏览器并发连接限制

```javascript
/**
 * 浏览器对同一域名的并发连接数限制
 *
 * HTTP/1.1: 通常为6个
 * HTTP/2: 不受限制（使用多路复用）
 */

// 测试并发限制
async function testConcurrency() {
    console.log('开始测试并发请求...');

    const urls = Array.from({ length: 20 }, (_, i) =>
        `https://example.com/api/data${i}`
    );

    const startTime = Date.now();

    // 同时发起20个请求
    const promises = urls.map((url, index) =>
        fetch(url).then(res => {
            const elapsed = Date.now() - startTime;
            console.log(`请求${index} 完成，耗时: ${elapsed}ms`);
            return res;
        })
    );

    await Promise.all(promises);

    console.log(`总耗时: ${Date.now() - startTime}ms`);
}

// HTTP/1.1结果（6个并发）:
// 请求0-5: 立即发送
// 请求6-11: 等待前6个完成
// 请求12-17: 等待前12个完成
// 请求18-19: 等待前18个完成

// HTTP/2结果:
// 所有请求同时发送，不需要等待
```

### 4.2 解决方案

```javascript
// 方案1：使用多个子域名
const domains = [
    'cdn1.example.com',
    'cdn2.example.com',
    'cdn3.example.com',
    'cdn4.example.com'
];

function getResourceUrl(path, index) {
    const domain = domains[index % domains.length];
    return `https://${domain}${path}`;
}

// 图片分散到不同域名
images.forEach((img, index) => {
    img.src = getResourceUrl('/images/photo.jpg', index);
});

// 方案2：升级到HTTP/2
// Nginx配置
/*
server {
    listen 443 ssl http2;  // 开启HTTP/2
    server_name example.com;
    ...
}
*/

// 方案3：请求队列控制
class RequestQueue {
    constructor(maxConcurrent = 6) {
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.queue = [];
    }

    async request(url) {
        // 如果达到并发上限，加入队列等待
        if (this.running >= this.maxConcurrent) {
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.running++;

        try {
            const response = await fetch(url);
            return response;
        } finally {
            this.running--;
            // 处理下一个请求
            if (this.queue.length > 0) {
                const resolve = this.queue.shift();
                resolve();
            }
        }
    }
}

// 使用
const queue = new RequestQueue(6);
const urls = [...]; // 大量URL

const promises = urls.map(url => queue.request(url));
await Promise.all(promises);
```

---

## 5. HTTP/3和QUIC协议

### 5.1 HTTP/3简介

**HTTP/3的特点**：
- 基于QUIC协议（UDP）
- 解决TCP队头阻塞
- 0-RTT连接建立
- 更好的移动网络支持

```
协议栈对比:

HTTP/1.1:
Application: HTTP/1.1
Transport: TCP
Network: IP

HTTP/2:
Application: HTTP/2
Transport: TCP
Network: IP

HTTP/3:
Application: HTTP/3
Transport: QUIC (over UDP)
Network: IP
```

### 5.2 QUIC协议优势

```javascript
/**
 * QUIC vs TCP
 */

// TCP的问题：队头阻塞
/*
Stream 1: [丢包] ──X──→ 阻塞
Stream 2: [正常] ────→ 等待Stream 1 ❌
Stream 3: [正常] ────→ 等待Stream 1 ❌

整个TCP连接都被阻塞
*/

// QUIC的解决方案：独立流
/*
Stream 1: [丢包] ──X──→ 只阻塞Stream 1
Stream 2: [正常] ────→ 继续传输 ✅
Stream 3: [正常] ────→ 继续传输 ✅

每个流独立，不相互影响
*/

// QUIC的0-RTT连接
/*
传统TLS 1.2 + TCP (1-RTT):
客户端                                服务器
  │───── TCP SYN ──────────────────→│
  │←──── TCP SYN-ACK ───────────────│
  │───── TCP ACK ────────────────────→│
  │───── TLS ClientHello ────────────→│
  │←──── TLS ServerHello ─────────────│
  │───── 应用数据 ─────────────────────→│
需要2-3个RTT

QUIC (0-RTT):
客户端                                服务器
  │───── QUIC Initial + 应用数据 ────→│
  │←──── QUIC Response + 应用数据 ────│
只需0-1个RTT
*/
```

---

## 总结

### 核心要点

1. **HTTP/2**
   - 二进制分帧、多路复用、头部压缩(HPACK)
   - 服务器推送、流优先级
   - 一个TCP连接处理所有请求

2. **OPTIONS请求**
   - 跨域预检请求
   - 复杂请求才会触发
   - 可以通过Access-Control-Max-Age缓存

3. **RESTful API**
   - GET/POST/PUT/PATCH/DELETE
   - 资源导向、统一接口、无状态

4. **网络优化**
   - HTTP/1.1: 域名分片(6个并发)
   - HTTP/2: 多路复用(无限制)
   - HTTP/3: QUIC协议(0-RTT)

**最后更新**: 2025-12-09
