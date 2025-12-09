# HTTP状态码和HTTPS深度解析

## 1. HTTP状态码深度解析

### 状态码分类

```javascript
// HTTP状态码按类别分为5类

/*
1xx - 信息性状态码（Informational）
   表示请求已接收，继续处理

2xx - 成功状态码（Success）
   表示请求已被成功接收、理解、处理

3xx - 重定向状态码（Redirection）
   需要后续操作才能完成请求

4xx - 客户端错误状态码（Client Error）
   请求包含语法错误或无法完成

5xx - 服务器错误状态码（Server Error）
   服务器处理请求时发生错误
*/

// 状态码结构
class HTTPStatusCode {
  constructor(code, message, description) {
    this.code = code;
    this.message = message;
    this.description = description;
    this.category = this.getCategory(code);
  }

  getCategory(code) {
    const firstDigit = Math.floor(code / 100);
    const categories = {
      1: 'Informational',
      2: 'Success',
      3: 'Redirection',
      4: 'Client Error',
      5: 'Server Error'
    };
    return categories[firstDigit] || 'Unknown';
  }
}
```

## 2. 常见状态码详解

### 2xx 成功状态码

```javascript
// 200 OK - 请求成功
/*
最常见的成功状态码
表示请求已成功处理，响应返回请求的数据
*/

// GET请求示例
fetch('https://api.example.com/users')
  .then(response => {
    if (response.status === 200) {
      return response.json();
    }
  });

// 201 Created - 资源创建成功
/*
通常用于POST请求
表示请求已成功并创建了新资源
*/

// POST创建资源
fetch('https://api.example.com/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'John' })
})
  .then(response => {
    if (response.status === 201) {
      console.log('用户创建成功');
      // 响应头Location包含新资源的URL
      const location = response.headers.get('Location');
    }
  });

// 204 No Content - 无内容
/*
请求成功，但不返回任何内容
常用于DELETE请求
*/

fetch('https://api.example.com/users/123', {
  method: 'DELETE'
})
  .then(response => {
    if (response.status === 204) {
      console.log('删除成功');
      // 不需要解析响应体
    }
  });

// 206 Partial Content - 部分内容
/*
用于断点续传
服务器只返回部分请求的资源
*/

// 请求视频的一部分
fetch('https://example.com/video.mp4', {
  headers: {
    'Range': 'bytes=0-1023'  // 请求前1024字节
  }
})
  .then(response => {
    if (response.status === 206) {
      const contentRange = response.headers.get('Content-Range');
      // Content-Range: bytes 0-1023/2048000
      console.log('接收到部分内容');
    }
  });
```

### 3xx 重定向状态码

```javascript
// 301 Moved Permanently - 永久重定向
/*
请求的资源已永久移动到新位置
浏览器会自动跳转，且会缓存新地址
搜索引擎会更新索引
*/

// Node.js服务器实现301重定向
app.get('/old-page', (req, res) => {
  res.status(301);
  res.setHeader('Location', 'https://example.com/new-page');
  res.end();
});

// 客户端处理301
fetch('https://example.com/old-page')
  .then(response => {
    // 浏览器自动跟随重定向
    // response.url会是新地址
    console.log(response.url);  // 'https://example.com/new-page'
  });

// 302 Found - 临时重定向
/*
请求的资源临时移动到新位置
浏览器会自动跳转，但不会缓存
搜索引擎不会更新索引
*/

app.get('/temp-page', (req, res) => {
  res.status(302);
  res.setHeader('Location', 'https://example.com/new-location');
  res.end();
});

// 301 vs 302 对比
/*
301永久重定向：
- 浏览器和搜索引擎会缓存
- SEO权重会转移到新URL
- 适用场景：域名更换、URL规范化

302临时重定向：
- 不会被缓存
- SEO权重不转移
- 适用场景：临时维护、A/B测试、短链接服务
*/

// 304 Not Modified - 未修改（重要！）
/*
资源未修改，使用缓存版本
客户端发送带条件的请求（If-None-Match或If-Modified-Since）
服务器判断资源未修改，返回304
*/

// 第一次请求
fetch('https://example.com/style.css')
  .then(response => {
    // 200 OK
    // ETag: "abc123"
    // Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT
    const etag = response.headers.get('ETag');
    const lastModified = response.headers.get('Last-Modified');

    // 缓存ETag和Last-Modified
    localStorage.setItem('css-etag', etag);
    localStorage.setItem('css-modified', lastModified);
  });

// 第二次请求（带条件）
const etag = localStorage.getItem('css-etag');
const lastModified = localStorage.getItem('css-modified');

fetch('https://example.com/style.css', {
  headers: {
    'If-None-Match': etag,
    'If-Modified-Since': lastModified
  }
})
  .then(response => {
    if (response.status === 304) {
      // 使用缓存版本
      console.log('资源未修改，使用缓存');
    } else if (response.status === 200) {
      // 资源已更新，使用新版本
      console.log('资源已更新');
    }
  });

// 307 Temporary Redirect - 临时重定向（保留请求方法）
/*
与302类似，但保证请求方法不变
302可能将POST改为GET，307不会
*/

// 308 Permanent Redirect - 永久重定向（保留请求方法）
/*
与301类似，但保证请求方法不变
*/
```

### 4xx 客户端错误

```javascript
// 400 Bad Request - 错误的请求
/*
请求语法错误或参数无效
服务器无法理解请求
*/

// 服务器返回400
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Bad Request',
      message: '缺少必需参数：name和email'
    });
  }

  // 邮箱格式验证
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: '邮箱格式无效'
    });
  }
});

// 401 Unauthorized - 未授权
/*
需要身份认证
用户未登录或token无效
*/

// 服务器返回401
app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: '缺少认证token'
    });
  }

  try {
    const user = verifyToken(token);
    res.json(user);
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token无效或已过期'
    });
  }
});

// 客户端处理401
fetch('https://api.example.com/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(response => {
    if (response.status === 401) {
      // 跳转到登录页
      window.location.href = '/login';
    }
  });

// 403 Forbidden - 禁止访问
/*
服务器理解请求，但拒绝执行
用户已登录，但没有权限
*/

// 权限检查
app.delete('/api/users/:id', async (req, res) => {
  const currentUser = req.user;
  const targetUserId = req.params.id;

  // 只能删除自己的账户，或者是管理员
  if (currentUser.id !== targetUserId && !currentUser.isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: '您没有权限删除此用户'
    });
  }

  await deleteUser(targetUserId);
  res.status(204).end();
});

// 401 vs 403 对比
/*
401 Unauthorized：
- 用户未认证（未登录）
- 需要提供认证信息
- 提供正确认证后可能成功

403 Forbidden：
- 用户已认证（已登录）
- 但没有访问权限
- 即使提供认证也不会成功
*/

// 404 Not Found - 未找到资源
/*
请求的资源不存在
最常见的错误状态码
*/

app.get('/api/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: `用户ID ${req.params.id} 不存在`
    });
  }

  res.json(user);
});

// 前端处理404
fetch('https://api.example.com/users/999')
  .then(response => {
    if (response.status === 404) {
      console.log('用户不存在');
      // 显示404页面或错误提示
    }
  });

// 405 Method Not Allowed - 方法不允许
/*
请求方法不被允许
*/

app.get('/api/users', (req, res) => {
  // 只允许GET
  res.json(users);
});

app.all('/api/users', (req, res) => {
  if (req.method !== 'GET') {
    res.status(405);
    res.setHeader('Allow', 'GET');
    res.json({
      error: 'Method Not Allowed',
      message: `不支持${req.method}方法，仅支持GET`
    });
  }
});

// 409 Conflict - 冲突
/*
请求与当前资源状态冲突
常见于并发修改
*/

app.put('/api/users/:id', async (req, res) => {
  const { version } = req.body;
  const user = await findUser(req.params.id);

  // 乐观锁：版本号不匹配
  if (user.version !== version) {
    return res.status(409).json({
      error: 'Conflict',
      message: '资源已被其他用户修改，请刷新后重试',
      currentVersion: user.version
    });
  }

  await updateUser(req.params.id, req.body);
  res.json({ success: true });
});

// 413 Payload Too Large - 请求体过大
/*
请求体超过服务器限制
*/

app.use(express.json({ limit: '1mb' }));

app.post('/api/upload', (req, res) => {
  // 如果请求体超过1MB，自动返回413
});

// 429 Too Many Requests - 请求过多
/*
客户端请求频率超过限制
需要实现速率限制
*/

// 速率限制中间件
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 100,  // 最多100个请求
  message: {
    error: 'Too Many Requests',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,  // 返回RateLimit-*头
  legacyHeaders: false
});

app.use('/api/', limiter);

// 客户端处理429
fetch('https://api.example.com/data')
  .then(response => {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`请求过多，${retryAfter}秒后重试`);

      setTimeout(() => {
        // 重试请求
        fetch('https://api.example.com/data');
      }, retryAfter * 1000);
    }
  });
```

### 5xx 服务器错误

```javascript
// 500 Internal Server Error - 服务器内部错误
/*
服务器遇到意外情况
无法完成请求
*/

app.get('/api/data', async (req, res) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (error) {
    console.error('服务器错误:', error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: '服务器内部错误，请稍后重试'
    });
  }
});

// 502 Bad Gateway - 网关错误
/*
作为网关或代理的服务器
从上游服务器收到无效响应
*/

// Nginx配置
/*
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
}

server {
    location /api {
        proxy_pass http://backend;
        # 如果backend服务器无响应，返回502
    }
}
*/

// 503 Service Unavailable - 服务不可用
/*
服务器暂时无法处理请求
通常是临时状态（维护、过载）
*/

app.use((req, res, next) => {
  if (isMaintenanceMode()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: '系统维护中，预计1小时后恢复',
      retryAfter: 3600
    });
  }
  next();
});

// 504 Gateway Timeout - 网关超时
/*
作为网关的服务器
未能及时从上游服务器获得响应
*/

// Nginx超时配置
/*
server {
    location /api {
        proxy_pass http://backend;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
        # 超时后返回504
    }
}
*/
```

## 3. HTTPS深度解析

### HTTPS基本原理

```javascript
// HTTPS = HTTP + SSL/TLS

/*
HTTP的问题：
1. 明文传输，容易被窃听
2. 无法验证服务器身份，容易被冒充
3. 无法验证数据完整性，容易被篡改

HTTPS的解决：
1. 加密：使用SSL/TLS加密通信内容
2. 认证：使用数字证书验证服务器身份
3. 完整性：使用消息摘要验证数据未被篡改
*/

// HTTPS通信过程
class HTTPSConnection {
  constructor() {
    this.clientRandom = null;
    this.serverRandom = null;
    this.preMasterSecret = null;
    this.masterSecret = null;
    this.sessionKeys = null;
  }

  // 1. TCP三次握手
  tcpHandshake() {
    console.log('1. TCP三次握手');
    /*
    Client -> Server: SYN
    Server -> Client: SYN + ACK
    Client -> Server: ACK
    */
  }

  // 2. TLS握手
  async tlsHandshake() {
    console.log('2. TLS握手开始');

    // 2.1 Client Hello
    this.clientHello();

    // 2.2 Server Hello
    await this.serverHello();

    // 2.3 证书验证
    await this.verifyCertificate();

    // 2.4 密钥交换
    await this.keyExchange();

    // 2.5 完成握手
    this.finishHandshake();
  }

  clientHello() {
    // 客户端发送：
    this.clientRandom = this.generateRandom();

    const clientHello = {
      version: 'TLS 1.3',
      random: this.clientRandom,
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ],
      compressionMethods: ['null'],
      extensions: [
        'server_name',  // SNI
        'supported_groups',
        'signature_algorithms'
      ]
    };

    console.log('Client Hello:', clientHello);
  }

  async serverHello() {
    // 服务器返回：
    this.serverRandom = this.generateRandom();

    const serverHello = {
      version: 'TLS 1.3',
      random: this.serverRandom,
      selectedCipherSuite: 'TLS_AES_256_GCM_SHA384',
      certificate: await this.getCertificate(),
      serverKeyExchange: this.getServerPublicKey()
    };

    console.log('Server Hello:', serverHello);
  }

  async verifyCertificate() {
    // 验证服务器证书
    const certificate = await this.getCertificate();

    // 1. 验证证书有效期
    if (Date.now() < certificate.notBefore ||
        Date.now() > certificate.notAfter) {
      throw new Error('证书已过期');
    }

    // 2. 验证域名
    if (certificate.commonName !== this.serverName) {
      throw new Error('证书域名不匹配');
    }

    // 3. 验证证书链
    await this.verifyCertificateChain(certificate);

    // 4. 验证证书签名
    await this.verifyCertificateSignature(certificate);

    console.log('证书验证成功');
  }

  async keyExchange() {
    // 密钥交换（RSA或ECDHE）

    // ECDHE密钥交换（推荐，支持前向保密）
    const clientPrivateKey = this.generateECDHEPrivateKey();
    const clientPublicKey = this.generateECDHEPublicKey(clientPrivateKey);

    // 发送客户端公钥
    this.sendClientKeyExchange(clientPublicKey);

    // 计算共享密钥
    const serverPublicKey = this.getServerPublicKey();
    this.preMasterSecret = this.computeSharedSecret(
      clientPrivateKey,
      serverPublicKey
    );

    // 派生会话密钥
    this.masterSecret = this.deriveMasterSecret(
      this.preMasterSecret,
      this.clientRandom,
      this.serverRandom
    );

    // 生成对称加密密钥
    this.sessionKeys = this.deriveSessionKeys(this.masterSecret);

    console.log('密钥交换完成');
  }

  finishHandshake() {
    // 发送ChangeCipherSpec
    // 发送Finished消息（使用会话密钥加密）
    console.log('TLS握手完成');
  }

  generateRandom() {
    // 生成32字节随机数
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    return random;
  }

  async getCertificate() {
    // 获取服务器证书
    return {
      version: 3,
      serialNumber: '01:23:45:67:89:ab:cd:ef',
      issuer: 'CN=Example CA',
      subject: 'CN=example.com',
      notBefore: new Date('2024-01-01'),
      notAfter: new Date('2025-01-01'),
      publicKey: '...',
      signature: '...',
      commonName: 'example.com',
      subjectAltNames: ['example.com', 'www.example.com']
    };
  }
}
```

### TLS 1.3改进

```javascript
// TLS 1.3 vs TLS 1.2

/*
TLS 1.3的改进：

1. 握手更快
   - TLS 1.2: 2-RTT
   - TLS 1.3: 1-RTT
   - TLS 1.3 0-RTT: 0-RTT（会话恢复）

2. 更安全的加密套件
   - 移除不安全的算法（RC4、MD5、SHA-1）
   - 强制使用前向保密（PFS）
   - 只支持AEAD加密（GCM、ChaCha20-Poly1305）

3. 加密更多握手数据
   - 证书、服务器参数等都被加密
   - 更好的隐私保护
*/

// TLS 1.3握手流程（1-RTT）
async function tls13Handshake() {
  // 第一次往返（1-RTT）

  // 客户端发送：
  // - Client Hello（包含密钥共享）
  const clientHello = {
    random: generateRandom(),
    cipherSuites: ['TLS_AES_256_GCM_SHA384'],
    keyShare: generateKeyShare(),  // 提前发送密钥共享
    supportedVersions: ['TLS 1.3']
  };

  // 服务器返回（立即可以加密）：
  // - Server Hello
  // - {加密的扩展}
  // - {加密的证书}
  // - {加密的证书验证}
  // - {Finished}
  const serverResponse = {
    random: generateRandom(),
    selectedCipherSuite: 'TLS_AES_256_GCM_SHA384',
    keyShare: generateKeyShare(),
    // 以下内容已加密
    encrypted: {
      certificate: getCertificate(),
      certificateVerify: signData(),
      finished: generateFinished()
    }
  };

  // 客户端验证并发送：
  // - {Finished}
  // - 应用数据

  console.log('TLS 1.3握手完成（1-RTT）');
}

// TLS 1.3 0-RTT（会话恢复）
async function tls13ZeroRTT() {
  // 使用之前会话的PSK（Pre-Shared Key）

  // 客户端直接发送加密的应用数据
  const earlyData = {
    psk: previousSessionPSK,
    encryptedData: encryptWithPSK(applicationData)
  };

  // 注意：0-RTT有重放攻击风险
  // 只应用于幂等请求（GET）
  console.log('TLS 1.3 0-RTT完成');
}
```

### HTTPS性能优化

```javascript
// HTTPS性能优化策略

// 1. 会话复用（Session Resumption）

// Session ID复用
class SessionCache {
  constructor() {
    this.sessions = new Map();
  }

  saveSession(sessionId, sessionData) {
    this.sessions.set(sessionId, {
      data: sessionData,
      timestamp: Date.now()
    });
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);

    // 检查会话是否过期（24小时）
    if (session && Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
      return session.data;
    }

    this.sessions.delete(sessionId);
    return null;
  }
}

// Session Ticket复用（更好）
// 服务器将会话状态加密后发给客户端
// 客户端下次连接时带上ticket
// 无需服务器存储会话状态

// 2. OCSP Stapling（证书状态缓存）

// Nginx配置
/*
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;

# OCSP响应缓存
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
*/

// 作用：
// - 服务器定期查询证书状态
// - 将OCSP响应缓存并发送给客户端
// - 客户端无需单独查询OCSP服务器
// - 减少握手延迟

// 3. HTTP/2 + HTTPS

// 启用HTTP/2（需要HTTPS）
/*
server {
    listen 443 ssl http2;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HTTP/2优化
    http2_push_preload on;
    http2_max_concurrent_streams 128;
}
*/

// HTTP/2的优势：
// - 多路复用（解决队头阻塞）
// - 服务器推送
// - 头部压缩（HPACK）
// - 二进制帧

// 4. 证书链优化

// 精简证书链
/*
完整链：Root CA -> Intermediate CA -> Server Cert
优化：只发送 Intermediate CA + Server Cert
（客户端通常已有Root CA）

减少TLS握手数据大小
*/

// 5. 密码套件优化

// 选择性能更好的套件
/*
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;

性能对比：
- ECDHE比RSA快（支持前向保密）
- AES-GCM比AES-CBC快
- ChaCha20-Poly1305在移动设备上更快
*/

// 6. TLS 1.3升级

// 启用TLS 1.3
/*
ssl_protocols TLSv1.2 TLSv1.3;

优势：
- 1-RTT握手（vs TLS 1.2的2-RTT）
- 0-RTT会话恢复
- 更安全的加密套件
*/

// 性能对比
/*
TLS 1.2握手:
- 延迟: 2个RTT（~200ms）
- 数据传输开始: 200ms后

TLS 1.3握手:
- 延迟: 1个RTT（~100ms）
- 数据传输开始: 100ms后
- 性能提升: 50%

TLS 1.3 0-RTT:
- 延迟: 0个RTT
- 数据传输开始: 立即
- 性能提升: 100%（需注意安全风险）
*/
```

### HTTPS安全最佳实践

```javascript
// HTTPS安全配置

// 1. 强制HTTPS（HSTS）

// 服务器发送HSTS头
app.use((req, res, next) => {
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  next();
});

// HTTP重定向到HTTPS
app.use((req, res, next) => {
  if (req.protocol !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});

// 2. 安全的Cookie

app.use(session({
  secret: 'your-secret-key',
  cookie: {
    secure: true,  // 只在HTTPS下发送
    httpOnly: true,  // 防止XSS
    sameSite: 'strict',  // 防止CSRF
    maxAge: 24 * 60 * 60 * 1000  // 24小时
  }
}));

// 3. 内容安全策略（CSP）

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' https:; " +
    "upgrade-insecure-requests"  // 自动升级HTTP到HTTPS
  );
  next();
});

// 4. 证书固定（Certificate Pinning）

// 移动应用中使用
class CertificatePinner {
  constructor() {
    this.pins = new Set([
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
    ]);
  }

  async verifyPin(certificate) {
    const publicKey = certificate.publicKey;
    const hash = await this.sha256(publicKey);
    const pin = `sha256/${btoa(hash)}`;

    if (!this.pins.has(pin)) {
      throw new Error('证书固定验证失败');
    }
  }

  async sha256(data) {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(buffer);
  }
}

// 5. 混合内容检查

// 确保HTTPS页面不加载HTTP资源
/*
<script src="https://example.com/script.js"></script>  ✓
<script src="http://example.com/script.js"></script>   ✗ 会被阻止
*/

// 自动升级混合内容
// Content-Security-Policy: upgrade-insecure-requests

// 6. 完整的Nginx HTTPS配置

/*
server {
    listen 443 ssl http2;
    server_name example.com;

    # 证书配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # SSL协议和加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # 会话复用
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets on;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /path/to/chain.pem;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # DH参数
    ssl_dhparam /path/to/dhparam.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
*/
```

HTTP状态码和HTTPS是Web开发的基础，理解它们的原理对于构建安全高效的Web应用至关重要！
