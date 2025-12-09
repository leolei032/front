# Node.js和工程化

## 1. Node.js如何保证程序健壮性？
**问题：** Node.js如何保证程序健壮性？

### 解答

#### 1. 错误处理

**同步错误处理**
```javascript
// try-catch
try {
  const data = JSON.parse(jsonString);
} catch (error) {
  console.error('解析失败:', error);
  // 错误处理
}
```

**异步错误处理**
```javascript
// Promise
fetch('/api/data')
  .then(res => res.json())
  .catch(error => {
    console.error('请求失败:', error);
  });

// async/await
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}
```

**全局错误处理**
```javascript
// 未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 记录日志
  logger.error(error);
  // 优雅退出
  process.exit(1);
});

// 未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  logger.error(reason);
});

// 进程警告
process.on('warning', (warning) => {
  console.warn('警告:', warning);
});
```

#### 2. 进程管理

**PM2**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'app',
    script: './app.js',
    instances: 4,  // 进程数量
    exec_mode: 'cluster',  // 集群模式
    watch: true,  // 监听文件变化
    max_memory_restart: '1G',  // 内存超限重启
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production'
    }
  }]
};

// 启动
pm2 start ecosystem.config.js

// 监控
pm2 monit

// 自动重启
pm2 restart app
```

**Cluster模式**
```javascript
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`主进程 ${process.pid} 正在运行`);

  // 衍生工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // 工作进程退出时重启
  cluster.on('exit', (worker, code, signal) => {
    console.log(`工作进程 ${worker.process.pid} 已退出`);
    console.log('启动新的工作进程...');
    cluster.fork();
  });
} else {
  // 工作进程可以共享TCP连接
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello World\n');
  }).listen(8000);

  console.log(`工作进程 ${process.pid} 已启动`);
}
```

#### 3. 健康检查

**Graceful Shutdown（优雅退出）**
```javascript
const server = http.createServer(app);

// 优雅退出
function gracefulShutdown(signal) {
  console.log(`收到 ${signal} 信号，开始优雅退出...`);

  // 停止接收新请求
  server.close(() => {
    console.log('服务器已关闭');

    // 关闭数据库连接
    mongoose.connection.close(false, () => {
      console.log('数据库连接已关闭');
      process.exit(0);
    });
  });

  // 强制退出（30秒后）
  setTimeout(() => {
    console.error('强制退出');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

**健康检查端点**
```javascript
// Express
app.get('/health', (req, res) => {
  // 检查数据库连接
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  // 检查内存使用
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      percent: `${memUsagePercent.toFixed(2)}%`
    }
  };

  if (dbStatus === 'disconnected' || memUsagePercent > 90) {
    health.status = 'error';
    return res.status(503).json(health);
  }

  res.json(health);
});
```

#### 4. 日志系统

**Winston**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    }),
    // 所有日志
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// 开发环境输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 使用
logger.info('服务器启动');
logger.error('错误信息', { error: err });
```

#### 5. 限流和熔断

**限流**
```javascript
const rateLimit = require('express-rate-limit');

// 全局限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 100,  // 最多100个请求
  message: '请求过于频繁，请稍后再试'
});

app.use(limiter);

// API限流
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1分钟
  max: 10
});

app.use('/api/', apiLimiter);
```

**熔断器**
```javascript
const CircuitBreaker = require('opossum');

async function asyncFunctionThatCouldFail() {
  // 可能失败的异步操作
  return fetch('/api/data');
}

const options = {
  timeout: 3000,  // 超时时间
  errorThresholdPercentage: 50,  // 错误率阈值
  resetTimeout: 30000  // 熔断器重置时间
};

const breaker = new CircuitBreaker(asyncFunctionThatCouldFail, options);

// 监听事件
breaker.on('open', () => console.log('熔断器打开'));
breaker.on('halfOpen', () => console.log('熔断器半开'));
breaker.on('close', () => console.log('熔断器关闭'));

// 使用
breaker.fire()
  .then(result => console.log(result))
  .catch(err => console.error(err));
```

#### 6. 监控告警

**性能监控**
```javascript
const prometheus = require('prom-client');

// 创建指标
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP请求持续时间',
  labelNames: ['method', 'route', 'status']
});

// 中间件
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
});

// 暴露指标
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

#### 7. 依赖管理

**package-lock.json**
```bash
# 锁定依赖版本
npm ci  # 使用package-lock.json安装

# 定期更新依赖
npm audit  # 检查安全漏洞
npm audit fix  # 自动修复
npm outdated  # 查看过期依赖
```

**依赖安全检查**
```javascript
// .npmrc
audit=true
audit-level=moderate

// CI/CD中检查
npm audit --audit-level=high
```

## 2. PM2在如何master往往有无侧重点
**问题：** PM2在如何master往往有无侧重点

### 解答

#### PM2 Master进程职责

**1. 进程管理**
```javascript
// PM2启动多个实例
pm2 start app.js -i max  // 根据CPU核心数

// 指定实例数
pm2 start app.js -i 4

// 集群模式
pm2 start app.js --name "app" -i 4 --exec-mode cluster
```

**2. 负载均衡**
```javascript
// PM2自动负载均衡
// Master进程使用Round-Robin算法分发请求到Worker进程

// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'app',
    script: './app.js',
    instances: 4,
    exec_mode: 'cluster',
    // PM2会自动在Worker间分发请求
  }]
};
```

**3. 进程守护**
```javascript
// 自动重启
pm2 start app.js --watch

// 内存超限重启
pm2 start app.js --max-memory-restart 1G

// 监控
pm2 monit

// 日志
pm2 logs

// 进程信息
pm2 show app
```

**4. 零停机重启**
```javascript
// 优雅重启
pm2 reload app

// 重启流程：
// 1. 启动新Worker
// 2. 新Worker准备就绪
// 3. 停止旧Worker接收新请求
// 4. 等待旧Worker处理完现有请求
// 5. 关闭旧Worker
```

#### Master vs Worker

**Master进程**
- 管理Worker进程
- 负载均衡
- 进程监控和重启
- 不处理业务逻辑

**Worker进程**
- 处理实际请求
- 执行业务逻辑
- 独立的事件循环
- 可能崩溃（由Master重启）

```javascript
// 在代码中区分Master和Worker
if (cluster.isMaster) {
  // Master进程逻辑
  console.log(`Master进程 ${process.pid} 启动`);

  // 定时任务只在Master执行
  setInterval(() => {
    console.log('定时清理缓存');
  }, 3600000);

  // 衍生Worker
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Worker进程逻辑
  console.log(`Worker进程 ${process.pid} 启动`);

  // 启动服务器
  app.listen(3000);
}
```

#### PM2高级特性

**1. 进程间通信**
```javascript
// Worker进程发送消息
process.send({
  type: 'custom',
  data: 'some data'
});

// Master进程接收消息
cluster.on('message', (worker, message) => {
  if (message.type === 'custom') {
    console.log(`收到Worker ${worker.id}消息:`, message.data);
  }
});
```

**2. 优雅重载**
```javascript
// app.js
process.on('SIGINT', () => {
  console.log('收到SIGINT信号');

  // 停止接收新请求
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });

  // 超时强制退出
  setTimeout(() => {
    process.exit(1);
  }, 10000);
});
```

**3. 自定义启动脚本**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'app',
    script: './app.js',
    instances: 4,
    exec_mode: 'cluster',

    // 环境变量
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // 日志
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,

    // 监控
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,

    // 自动重启策略
    autorestart: true,
    watch: false,

    // cron重启
    cron_restart: '0 0 * * *'
  }]
};
```

## 3. Node.js如何保证服务稳定性？
**问题：** Node.js如何保证服务稳定性？平缓重复，重复关键度

### 解答

#### 1. 多进程架构

**Cluster模式**
```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // 创建Worker进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Worker退出时重启
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // 延迟重启，避免频繁重启
    setTimeout(() => {
      cluster.fork();
    }, 1000);
  });

  // 限制重启次数
  let restartCount = 0;
  const maxRestarts = 10;
  const resetInterval = 60000;

  setInterval(() => {
    restartCount = 0;
  }, resetInterval);

  cluster.on('exit', () => {
    restartCount++;
    if (restartCount >= maxRestarts) {
      console.error('重启次数过多，停止服务');
      process.exit(1);
    }
  });
} else {
  require('./app');
}
```

#### 2. 内存管理

**内存监控**
```javascript
// 定时检查内存
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);

  console.log(`内存使用: ${heapUsed}MB / ${heapTotal}MB`);

  // 内存超限警告
  if (heapUsed / heapTotal > 0.9) {
    console.warn('内存使用率过高');
    // 触发告警
  }
}, 60000);

// 内存泄漏检测
const heapdump = require('heapdump');

// 生成堆快照
heapdump.writeSnapshot(`./heapdump-${Date.now()}.heapsnapshot`);
```

**防止内存泄漏**
```javascript
// 1. 清理事件监听器
const emitter = new EventEmitter();
emitter.on('event', handler);
// 使用后清理
emitter.removeListener('event', handler);

// 2. 清理定时器
const timer = setInterval(() => {}, 1000);
// 组件销毁时清理
clearInterval(timer);

// 3. 避免全局变量积累
// ❌
global.cache = {};
global.cache[key] = value;  // 不断增长

// ✅
const LRU = require('lru-cache');
const cache = new LRU({
  max: 500,
  maxAge: 1000 * 60 * 60
});

// 4. WeakMap用于缓存
const cache = new WeakMap();
cache.set(obj, value);  // obj被垃圾回收时，value也会被清理
```

#### 3. 错误恢复机制

**自动重试**
```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      console.log(`重试 ${i + 1}/${maxRetries}`);
    }
  }
}

// 使用
await retryOperation(async () => {
  return await fetch('/api/data');
}, 3);
```

**降级策略**
```javascript
class ServiceWithFallback {
  async getData() {
    try {
      // 主服务
      return await this.primaryService.getData();
    } catch (error) {
      console.log('主服务失败，使用备用服务');

      try {
        // 备用服务
        return await this.fallbackService.getData();
      } catch (fallbackError) {
        // 使用缓存
        return this.getCachedData();
      }
    }
  }

  getCachedData() {
    return cache.get('data') || [];
  }
}
```

#### 4. 数据库连接池

**MongoDB连接池**
```javascript
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/mydb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  poolSize: 10,  // 连接池大小
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000
});

// 连接错误处理
mongoose.connection.on('error', (err) => {
  console.error('MongoDB连接错误:', err);
});

// 断线重连
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB断开连接，尝试重连...');
  setTimeout(() => {
    mongoose.connect('mongodb://localhost/mydb');
  }, 5000);
});
```

**Redis连接池**
```javascript
const Redis = require('ioredis');

const redis = new Redis({
  port: 6379,
  host: '127.0.0.1',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false  // 断线时不缓存命令
});

redis.on('error', (err) => {
  console.error('Redis错误:', err);
});

redis.on('reconnecting', () => {
  console.log('Redis重连中...');
});
```

#### 5. 请求超时控制

```javascript
// Express超时中间件
const timeout = require('connect-timeout');

app.use(timeout('30s'));

app.use((req, res, next) => {
  if (req.timedout) {
    return res.status(503).json({ error: '请求超时' });
  }
  next();
});

// 手动实现
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(503).json({ error: '请求超时' });
  });
  next();
});
```

#### 6. 监控和告警

**性能监控**
```javascript
const StatsD = require('node-statsd');
const client = new StatsD();

// 记录指标
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // 记录响应时间
    client.timing('http.response_time', duration);

    // 记录请求数
    client.increment('http.request_count');

    // 记录状态码
    client.increment(`http.status.${res.statusCode}`);
  });

  next();
});
```
