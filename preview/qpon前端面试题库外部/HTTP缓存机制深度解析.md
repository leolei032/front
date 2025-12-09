# HTTP缓存机制深度解析

## 1. 缓存的本质和意义

### 为什么需要缓存

```javascript
// 没有缓存的问题
// 场景：一个网站的logo图片
// 用户每次访问都需要：
// 1. DNS解析 (~50ms)
// 2. TCP连接 (~100ms)
// 3. HTTP请求 (~50ms)
// 4. 服务器处理 (~50ms)
// 5. 数据传输 (~100ms)
// 总计：~350ms，且消耗带宽

// 有缓存的优势
// 1. 首次访问：350ms
// 2. 后续访问：0ms（直接从缓存读取）
// 性能提升：100%

// 缓存的层级
/*
1. 浏览器缓存 (Browser Cache)
   - Memory Cache (内存缓存) - 最快，容量小
   - Disk Cache (磁盘缓存) - 较快，容量大

2. 代理缓存 (Proxy Cache)
   - CDN缓存
   - 反向代理缓存

3. 网关缓存 (Gateway Cache)
   - 服务器端缓存
*/
```

### 缓存的存储位置

```javascript
// 1. Memory Cache（内存缓存）
// 特点：
// - 速度最快
// - 容量小
// - 页面关闭后清除
// - 主要缓存：页面中已经下载的样式、脚本、图片等

// 2. Disk Cache（磁盘缓存）
// 特点：
// - 速度较快
// - 容量大
// - 持久化存储
// - 根据HTTP头部字段判断哪些资源需要缓存

// 3. Service Worker Cache
// 特点：
// - 可编程的缓存
// - 完全由开发者控制
// - 支持离线应用

// 4. Push Cache（推送缓存）
// 特点：
// - HTTP/2的特性
// - 会话级别的缓存
// - 存在时间短

// 缓存查找顺序
/*
1. Service Worker Cache
   ↓ (未命中)
2. Memory Cache
   ↓ (未命中)
3. Disk Cache
   ↓ (未命中)
4. Push Cache
   ↓ (未命中)
5. 发起网络请求
*/

// 判断资源从哪里加载（Chrome DevTools）
// from memory cache - 从内存缓存加载
// from disk cache - 从磁盘缓存加载
// from ServiceWorker - 从Service Worker加载
// (size列) - 实际大小，说明是网络请求
```

## 2. 强缓存（Strong Cache）

### 强缓存原理

```javascript
// 强缓存：不需要向服务器发送请求，直接从缓存读取
// 特点：
// 1. 浏览器不会向服务器发送任何请求
// 2. 直接从本地缓存读取
// 3. 在Network面板显示状态码200（from cache）

// HTTP/1.0: Expires
// HTTP/1.1: Cache-Control (优先级更高)
```

### Expires（HTTP/1.0）

```javascript
// Expires: 响应头，指定资源的过期时间

// 服务器响应
// HTTP/1.0 200 OK
// Expires: Wed, 21 Oct 2024 07:28:00 GMT
// Content-Type: image/png

// 问题：
// 1. 依赖客户端时间，如果客户端时间错误，缓存失效
// 2. 服务器和客户端时间不一致
// 3. 时区问题

// Node.js示例
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
  if (req.url === '/logo.png') {
    const img = fs.readFileSync('./logo.png');

    // 设置过期时间为1小时后
    const expires = new Date(Date.now() + 3600000).toUTCString();

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Expires': expires
    });

    res.end(img);
  }
}).listen(3000);

// 浏览器行为：
// 首次请求：发送请求，接收响应，缓存资源
// 1小时内：直接从缓存读取，不发送请求
// 1小时后：缓存过期，重新发送请求
```

### Cache-Control（HTTP/1.1，推荐）

```javascript
// Cache-Control: 响应头和请求头，更精细的缓存控制

// 常用指令：
// max-age=<seconds> - 最大缓存时间
// s-maxage=<seconds> - 代理服务器缓存时间（覆盖max-age）
// no-cache - 可以缓存，但使用前必须验证
// no-store - 不缓存任何内容
// public - 可被任何缓存存储
// private - 只能被浏览器缓存
// must-revalidate - 缓存过期后必须验证
// immutable - 资源不会改变，无需验证

// 1. max-age
// HTTP/1.1 200 OK
// Cache-Control: max-age=3600
// Content-Type: text/css

// 表示：资源可以缓存3600秒（1小时）

// 2. no-cache vs no-store
// Cache-Control: no-cache
// 可以缓存，但每次使用前都要向服务器验证是否最新

// Cache-Control: no-store
// 完全不缓存，每次都从服务器获取

// 3. public vs private
// Cache-Control: public, max-age=3600
// 可以被浏览器和CDN等代理服务器缓存

// Cache-Control: private, max-age=3600
// 只能被浏览器缓存，不能被代理服务器缓存（敏感数据）

// 4. immutable（现代浏览器）
// Cache-Control: max-age=31536000, immutable
// 资源永不改变，即使用户刷新页面也不重新验证
// 适用场景：带hash的静态资源（如build.a1b2c3.js）

// Express示例
const express = require('express');
const app = express();

// 不同资源的缓存策略
app.get('/api/data', (req, res) => {
  // API数据：不缓存
  res.set('Cache-Control', 'no-store');
  res.json({ data: 'dynamic data' });
});

app.get('/static/logo.png', (req, res) => {
  // 静态资源：缓存1年
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile('./logo.png');
});

app.get('/user/profile.jpg', (req, res) => {
  // 用户私人数据：私有缓存1小时
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile('./profile.jpg');
});

// 组合使用
app.get('/index.html', (req, res) => {
  // HTML：可以缓存，但每次使用前验证
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile('./index.html');
});
```

### Pragma（HTTP/1.0，已废弃）

```javascript
// Pragma: no-cache
// 与Cache-Control: no-cache相同
// 仅为了向下兼容HTTP/1.0

// HTTP/1.0 200 OK
// Pragma: no-cache
// Cache-Control: no-cache

// 现代开发中，只需使用Cache-Control
```

### 强缓存的最佳实践

```javascript
// 1. 静态资源（带hash）
// 文件名：build.a1b2c3.js
// Cache-Control: public, max-age=31536000, immutable
// 优势：
// - 永久缓存
// - 文件内容变化时hash改变，自动更新

// 2. HTML文件
// Cache-Control: no-cache
// 或
// Cache-Control: max-age=0, must-revalidate
// 原因：HTML是入口，需要及时更新

// 3. API接口
// Cache-Control: no-store
// 原因：数据动态变化

// 4. 图片等媒体文件
// Cache-Control: public, max-age=2592000
// 缓存30天

// Webpack配置示例
module.exports = {
  output: {
    filename: '[name].[contenthash].js',  // 文件名包含hash
    chunkFilename: '[name].[contenthash].js'
  },

  plugins: [
    // 提取CSS
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    })
  ]
};

// Nginx配置示例
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    # 静态资源缓存1年
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
    # HTML不缓存
    expires -1;
    add_header Cache-Control "no-cache, must-revalidate";
}

location /api/ {
    # API不缓存
    add_header Cache-Control "no-store";
}
```

## 3. 协商缓存（Negotiation Cache）

### 协商缓存原理

```javascript
// 协商缓存：缓存过期后，向服务器验证资源是否更新
// 特点：
// 1. 需要向服务器发送请求
// 2. 如果资源未改变，返回304 Not Modified
// 3. 浏览器使用本地缓存
// 4. 如果资源已改变，返回200和新资源

// 验证方式：
// 1. Last-Modified / If-Modified-Since (HTTP/1.0)
// 2. ETag / If-None-Match (HTTP/1.1，优先级更高)
```

### Last-Modified / If-Modified-Since

```javascript
// Last-Modified: 响应头，资源的最后修改时间
// If-Modified-Since: 请求头，上次收到的Last-Modified值

// 流程：
// 1. 首次请求
// 客户端: GET /style.css
// 服务器: 200 OK
//         Last-Modified: Tue, 01 Dec 2024 10:00:00 GMT
//         Content: ...

// 2. 再次请求（缓存过期）
// 客户端: GET /style.css
//         If-Modified-Since: Tue, 01 Dec 2024 10:00:00 GMT
// 服务器: 304 Not Modified (资源未改变)
//    或: 200 OK (资源已改变，返回新内容)

// Node.js实现
const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
  const filePath = '.' + req.url;

  // 获取文件的最后修改时间
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const lastModified = stats.mtime.toUTCString();
    const ifModifiedSince = req.headers['if-modified-since'];

    // 比较时间
    if (ifModifiedSince && ifModifiedSince === lastModified) {
      // 资源未修改，返回304
      res.writeHead(304, {
        'Last-Modified': lastModified,
        'Cache-Control': 'max-age=3600'
      });
      res.end();
    } else {
      // 资源已修改或首次请求，返回200
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'text/css',
        'Last-Modified': lastModified,
        'Cache-Control': 'max-age=3600'
      });
      res.end(content);
    }
  });
}).listen(3000);

// 问题：
// 1. 精度只到秒，1秒内多次修改无法检测
// 2. 有些文件是定期生成的，内容没变但修改时间变了
// 3. 服务器时间可能不准确
```

### ETag / If-None-Match

```javascript
// ETag: 响应头，资源的唯一标识符（通常是内容的hash）
// If-None-Match: 请求头，上次收到的ETag值

// 流程：
// 1. 首次请求
// 客户端: GET /style.css
// 服务器: 200 OK
//         ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
//         Content: ...

// 2. 再次请求（缓存过期）
// 客户端: GET /style.css
//         If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
// 服务器: 304 Not Modified (ETag匹配)
//    或: 200 OK (ETag不匹配，返回新内容)

// Node.js实现
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

function generateETag(content) {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
}

http.createServer((req, res) => {
  const filePath = '.' + req.url;
  const content = fs.readFileSync(filePath);

  // 生成ETag
  const etag = generateETag(content);
  const ifNoneMatch = req.headers['if-none-match'];

  // 比较ETag
  if (ifNoneMatch && ifNoneMatch === etag) {
    // 资源未修改，返回304
    res.writeHead(304, {
      'ETag': etag,
      'Cache-Control': 'max-age=3600'
    });
    res.end();
  } else {
    // 资源已修改或首次请求，返回200
    res.writeHead(200, {
      'Content-Type': 'text/css',
      'ETag': etag,
      'Cache-Control': 'max-age=3600'
    });
    res.end(content);
  }
}).listen(3000);

// ETag的生成方式：
// 1. 内容hash（推荐）- 最准确
// 2. 文件大小 + 修改时间 - 性能更好
// 3. inode + 大小 + 修改时间（Nginx默认）

// 强ETag vs 弱ETag
// 强ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
// 内容完全相同才匹配

// 弱ETag: W/"33a64df551425fcc55e4d42a148795d9f25f89d4"
// 内容在语义上相等即可匹配（如gzip前后）
```

### Last-Modified vs ETag

```javascript
// 精度对比
// Last-Modified: 秒级精度
const lastModified1 = new Date('2024-01-01T10:00:00').toUTCString();
const lastModified2 = new Date('2024-01-01T10:00:00.999').toUTCString();
console.log(lastModified1 === lastModified2);  // true（无法区分）

// ETag: 内容级精度
const etag1 = generateETag('content v1');
const etag2 = generateETag('content v2');
console.log(etag1 === etag2);  // false（可以区分）

// 优先级
// 同时存在时，ETag优先级更高
// 请求头：
// If-None-Match: "abc123"
// If-Modified-Since: Tue, 01 Dec 2024 10:00:00 GMT

// 服务器只需要比较ETag

// 选择建议：
// 1. 优先使用ETag（更准确）
// 2. 文件很大时，可以只用Last-Modified（性能更好）
// 3. 两者结合使用（最保险）

// Express中间件示例
function etag(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    // 生成ETag
    const etag = generateETag(data);
    res.set('ETag', etag);

    // 检查If-None-Match
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }

    originalSend.call(this, data);
  };

  next();
}

app.use(etag);
```

## 4. 缓存策略和决策树

### 缓存决策流程

```javascript
// 缓存决策树
/*
                    发起请求
                       ↓
        +-------------+-------------+
        |                           |
    有缓存?                        无缓存
        |                           |
        ↓                           ↓
    强缓存有效?                  发送请求
        |                    获取资源并缓存
   是   |   否
        |   |
        ↓   ↓
    使用  发送验证请求
    缓存  (If-None-Match / If-Modified-Since)
        |
        ↓
    +-----------+-----------+
    |                       |
  304                      200
资源未改变              资源已改变
    |                       |
    ↓                       ↓
 使用缓存              使用新资源
                      更新缓存
*/

// 实现缓存策略
class CacheStrategy {
  constructor() {
    this.cache = new Map();
  }

  // 强缓存判断
  isStrongCacheValid(cacheEntry) {
    if (!cacheEntry) return false;

    const { cacheControl, expires, cachedAt } = cacheEntry;

    // 检查Cache-Control
    if (cacheControl) {
      const maxAge = this.parseMaxAge(cacheControl);
      if (maxAge) {
        const age = (Date.now() - cachedAt) / 1000;
        return age < maxAge;
      }
    }

    // 检查Expires
    if (expires) {
      return new Date(expires) > new Date();
    }

    return false;
  }

  // 解析max-age
  parseMaxAge(cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // 获取资源
  async fetch(url, options = {}) {
    const cacheKey = url;
    const cacheEntry = this.cache.get(cacheKey);

    // 1. 检查强缓存
    if (this.isStrongCacheValid(cacheEntry)) {
      console.log('Using strong cache');
      return cacheEntry.response;
    }

    // 2. 准备协商缓存请求头
    const headers = { ...options.headers };

    if (cacheEntry) {
      if (cacheEntry.etag) {
        headers['If-None-Match'] = cacheEntry.etag;
      }
      if (cacheEntry.lastModified) {
        headers['If-Modified-Since'] = cacheEntry.lastModified;
      }
    }

    // 3. 发送请求
    const response = await fetch(url, { ...options, headers });

    // 4. 处理304
    if (response.status === 304) {
      console.log('Using negotiation cache');
      // 更新缓存时间
      cacheEntry.cachedAt = Date.now();
      return cacheEntry.response;
    }

    // 5. 处理200，缓存新资源
    if (response.status === 200) {
      const newEntry = {
        response: response.clone(),
        cachedAt: Date.now(),
        cacheControl: response.headers.get('Cache-Control'),
        expires: response.headers.get('Expires'),
        etag: response.headers.get('ETag'),
        lastModified: response.headers.get('Last-Modified')
      };

      this.cache.set(cacheKey, newEntry);
      console.log('Fetched new resource');
      return response;
    }

    return response;
  }
}

// 使用
const cacheStrategy = new CacheStrategy();
cacheStrategy.fetch('/api/data');
```

### 不同资源的缓存策略

```javascript
// 1. HTML文件
// 策略：no-cache或短时间缓存
// 原因：入口文件，需要及时更新
res.set({
  'Cache-Control': 'no-cache, must-revalidate',
  'ETag': generateETag(htmlContent)
});

// 2. CSS/JS（带hash）
// 策略：长时间缓存 + immutable
// 原因：文件名包含hash，内容变化时URL变化
res.set({
  'Cache-Control': 'public, max-age=31536000, immutable'
});

// 3. CSS/JS（不带hash）
// 策略：协商缓存
// 原因：内容可能变化，但URL不变
res.set({
  'Cache-Control': 'no-cache',
  'ETag': generateETag(cssContent)
});

// 4. 图片
// 策略：长时间缓存
// 原因：通常不经常变化
res.set({
  'Cache-Control': 'public, max-age=2592000'  // 30天
});

// 5. API数据
// 策略：不缓存或短时间缓存
// 原因：数据动态变化
// 不缓存
res.set({ 'Cache-Control': 'no-store' });
// 或短时间缓存
res.set({ 'Cache-Control': 'max-age=60' });  // 1分钟

// 6. 字体文件
// 策略：长时间缓存
// 原因：很少变化
res.set({
  'Cache-Control': 'public, max-age=31536000',
  'Access-Control-Allow-Origin': '*'  // 允许跨域
});

// 完整的缓存策略配置
const cacheConfig = {
  // HTML: 协商缓存
  '.html': {
    'Cache-Control': 'no-cache',
    etag: true
  },

  // JavaScript/CSS（带hash）: 永久缓存
  '.js': {
    'Cache-Control': 'public, max-age=31536000, immutable'
  },
  '.css': {
    'Cache-Control': 'public, max-age=31536000, immutable'
  },

  // 图片: 30天缓存
  '.jpg': {
    'Cache-Control': 'public, max-age=2592000'
  },
  '.png': {
    'Cache-Control': 'public, max-age=2592000'
  },

  // 字体: 1年缓存
  '.woff2': {
    'Cache-Control': 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*'
  }
};
```

## 5. 用户行为对缓存的影响

```javascript
// 用户操作和缓存行为

// 1. 地址栏输入URL，回车
// 行为：查找Disk Cache，如果有且未过期，使用缓存
// Cache-Control: max-age=3600 → 使用缓存

// 2. F5刷新
// 行为：忽略强缓存，使用协商缓存
// 请求头会带上：Cache-Control: max-age=0
// 即使资源未过期，也会发送协商缓存请求

// 3. Ctrl+F5强制刷新
// 行为：忽略所有缓存，重新请求
// 请求头：Cache-Control: no-cache
//        Pragma: no-cache

// 4. 前进/后退按钮
// 行为：优先使用Memory Cache

// 5. 新窗口打开
// 行为：查找Disk Cache

// 6. 右键 → "在新标签页中打开链接"
// 行为：查找Memory Cache和Disk Cache

// 模拟不同用户行为
function simulateUserActions() {
  // 正常访问
  fetch('/api/data');  // 使用缓存（如果有效）

  // F5刷新
  fetch('/api/data', {
    cache: 'reload'  // 忽略强缓存
  });

  // Ctrl+F5强刷
  fetch('/api/data', {
    cache: 'no-cache'  // 忽略所有缓存
  });

  // 只使用缓存，不请求网络
  fetch('/api/data', {
    cache: 'only-if-cached'
  });
}
```

## 6. Service Worker缓存

```javascript
// Service Worker提供了可编程的缓存策略

// sw.js
const CACHE_NAME = 'my-cache-v1';
const urlsToCache = [
  '/',
  '/styles/main.css',
  '/scripts/main.js'
];

// 安装Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 拦截请求
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 缓存命中，返回缓存
        if (response) {
          return response;
        }

        // 缓存未命中，发起网络请求
        return fetch(event.request).then(response => {
          // 检查是否是有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应，一份给浏览器，一份存入缓存
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// 缓存策略

// 1. Cache First (缓存优先)
// 适用：静态资源
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// 2. Network First (网络优先)
// 适用：API数据
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// 3. Stale While Revalidate (返回缓存，同时更新)
// 适用：需要快速响应但也要保持更新的资源
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });

        return response || fetchPromise;
      });
    })
  );
});

// 4. Network Only (仅网络)
// 适用：实时数据
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});

// 5. Cache Only (仅缓存)
// 适用：预缓存的静态资源
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request));
});
```

## 7. 缓存最佳实践

```javascript
// 1. 使用版本化的URL
// ✓ 好
<script src="/js/app.v1.2.3.js"></script>
<script src="/js/app.a1b2c3d4.js"></script>  // 内容hash

// ❌ 不好
<script src="/js/app.js"></script>

// 2. 设置合适的缓存时间
// 频繁变化的资源：短时间或协商缓存
// 很少变化的资源：长时间缓存

// 3. 使用CDN
// CDN可以:
// - 地理位置更近，延迟更低
// - 分担源站压力
// - 提供额外的缓存层

// 4. 预加载关键资源
<link rel="preload" href="/styles/critical.css" as="style">
<link rel="prefetch" href="/images/next-page.jpg">

// 5. 监控缓存命中率
performance.getEntriesByType('resource').forEach(entry => {
  if (entry.transferSize === 0) {
    console.log(`Cached: ${entry.name}`);
  } else {
    console.log(`Network: ${entry.name} (${entry.transferSize} bytes)`);
  }
});

// 6. 清理过期缓存
// Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = ['my-cache-v2'];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 7. A/B测试缓存策略
// 记录性能指标
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  loadTime: []
};

function recordMetric(url, cached, loadTime) {
  if (cached) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }
  metrics.loadTime.push(loadTime);
}

// 定期上报
setInterval(() => {
  const avgLoadTime = metrics.loadTime.reduce((a, b) => a + b) / metrics.loadTime.length;
  const hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);

  console.log(`Cache Hit Rate: ${(hitRate * 100).toFixed(2)}%`);
  console.log(`Avg Load Time: ${avgLoadTime.toFixed(2)}ms`);

  // 上报到分析服务
  sendToAnalytics(metrics);
}, 60000);
```

深入理解HTTP缓存机制可以显著提升Web应用的性能和用户体验，是前端工程师必备的核心技能！
