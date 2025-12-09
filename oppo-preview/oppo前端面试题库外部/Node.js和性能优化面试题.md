# Node.js 和性能优化面试题

## Node.js相关

### 1. 使用过的koa2中间件

#### 解答

Koa2是一个基于Node.js的Web框架，使用中间件进行功能扩展。

**常用Koa2中间件**

#### 1. koa-router（路由）
```javascript
const Koa = require('koa');
const Router = require('@koa/router');

const app = new Koa();
const router = new Router();

// 定义路由
router.get('/', (ctx) => {
  ctx.body = 'Home';
});

router.get('/users', (ctx) => {
  ctx.body = ['user1', 'user2'];
});

router.post('/users', (ctx) => {
  const user = ctx.request.body;
  ctx.body = { id: 1, ...user };
});

// 路由参数
router.get('/users/:id', (ctx) => {
  ctx.body = { id: ctx.params.id };
});

// 路由前缀
const apiRouter = new Router({ prefix: '/api' });
apiRouter.get('/users', (ctx) => {
  ctx.body = 'API Users';
});

// 使用路由
app.use(router.routes());
app.use(router.allowedMethods());
app.use(apiRouter.routes());
```

#### 2. koa-bodyparser（请求体解析）
```javascript
const bodyParser = require('koa-bodyparser');

app.use(bodyParser({
  enableTypes: ['json', 'form', 'text'],
  formLimit: '56kb',
  jsonLimit: '1mb',
  textLimit: '1mb'
}));

// 使用
router.post('/users', (ctx) => {
  const { name, email } = ctx.request.body;
  ctx.body = { name, email };
});
```

#### 3. koa-static（静态文件服务）
```javascript
const serve = require('koa-static');
const path = require('path');

// 提供静态文件
app.use(serve(path.join(__dirname, 'public')));

// 多个静态目录
app.use(serve(path.join(__dirname, 'public')));
app.use(serve(path.join(__dirname, 'assets')));

// 配置选项
app.use(serve('public', {
  maxage: 1000 * 60 * 60 * 24 * 30,  // 缓存30天
  gzip: true,
  index: 'index.html'
}));
```

#### 4. koa-session（会话管理）
```javascript
const session = require('koa-session');

app.keys = ['secret-key-1', 'secret-key-2'];

app.use(session({
  key: 'koa:sess',
  maxAge: 86400000,  // 24小时
  httpOnly: true,
  signed: true,
  rolling: false,
  renew: false
}, app));

// 使用session
router.post('/login', (ctx) => {
  ctx.session.user = { id: 1, name: 'John' };
  ctx.body = { success: true };
});

router.get('/profile', (ctx) => {
  if (!ctx.session.user) {
    ctx.status = 401;
    return;
  }
  ctx.body = ctx.session.user;
});
```

#### 5. koa-jwt（JWT认证）
```javascript
const jwt = require('koa-jwt');

// JWT中间件
app.use(jwt({
  secret: 'your-secret-key',
  passthrough: true  // 允许未认证请求通过
}).unless({
  path: [/^\/login/, /^\/register/]  // 不需要认证的路径
}));

// 生成token
router.post('/login', (ctx) => {
  const token = jwt.sign(
    { userId: 1, username: 'john' },
    'your-secret-key',
    { expiresIn: '24h' }
  );

  ctx.body = { token };
});

// 使用token
router.get('/protected', (ctx) => {
  const user = ctx.state.user;  // 从token解析的用户信息
  ctx.body = { user };
});
```

#### 6. koa-cors（跨域处理）
```javascript
const cors = require('@koa/cors');

// 允许所有域
app.use(cors());

// 自定义配置
app.use(cors({
  origin: (ctx) => {
    const whitelist = ['http://localhost:3000', 'https://example.com'];
    const origin = ctx.request.header.origin;
    if (whitelist.includes(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}));
```

#### 7. koa-logger（日志）
```javascript
const logger = require('koa-logger');

app.use(logger());

// 自定义日志
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});
```

#### 8. koa-helmet（安全）
```javascript
const helmet = require('koa-helmet');

app.use(helmet());

// 自定义配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
}));
```

#### 9. koa-compress（压缩）
```javascript
const compress = require('koa-compress');

app.use(compress({
  filter: (contentType) => {
    return /text|javascript|json/i.test(contentType);
  },
  threshold: 2048,  // 只压缩大于2KB的响应
  gzip: {
    flush: require('zlib').constants.Z_SYNC_FLUSH
  },
  deflate: {
    flush: require('zlib').constants.Z_SYNC_FLUSH
  },
  br: false  // 禁用brotli
}));
```

#### 10. 自定义中间件
```javascript
// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };
    ctx.app.emit('error', err, ctx);
  }
});

// 认证中间件
const authenticate = async (ctx, next) => {
  const token = ctx.headers.authorization?.split(' ')[1];

  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'No token provided' };
    return;
  }

  try {
    const decoded = jwt.verify(token, 'secret-key');
    ctx.state.user = decoded;
    await next();
  } catch (error) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid token' };
  }
};

// 使用
router.get('/profile', authenticate, (ctx) => {
  ctx.body = ctx.state.user;
});

// 请求限流中间件
const rateLimit = require('koa-ratelimit');

app.use(rateLimit({
  driver: 'memory',
  db: new Map(),
  duration: 60000,  // 1分钟
  max: 100,         // 最多100次请求
  errorMessage: 'Too many requests',
  id: (ctx) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  }
}));
```

### 2. koa-bodyparser怎么解析request

#### 解答

koa-bodyparser通过流处理解析HTTP请求体。

**工作原理**
```javascript
// 简化的bodyparser实现
function bodyParser(options = {}) {
  return async function (ctx, next) {
    // 只处理POST/PUT/PATCH请求
    if (!['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
      return await next();
    }

    // 获取Content-Type
    const contentType = ctx.request.type;

    // 解析JSON
    if (contentType === 'application/json') {
      const body = await parseJSON(ctx.req);
      ctx.request.body = body;
    }

    // 解析表单
    else if (contentType === 'application/x-www-form-urlencoded') {
      const body = await parseForm(ctx.req);
      ctx.request.body = body;
    }

    await next();
  };
}

// 解析JSON
function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', chunk => {
      data += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

// 解析表单
function parseForm(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', chunk => {
      data += chunk.toString();
    });

    req.on('end', () => {
      const params = new URLSearchParams(data);
      const body = {};

      for (const [key, value] of params) {
        body[key] = value;
      }

      resolve(body);
    });

    req.on('error', reject);
  });
}
```

**实际使用**
```javascript
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');

const app = new Koa();

app.use(bodyParser({
  enableTypes: ['json', 'form', 'text'],
  formLimit: '56kb',
  jsonLimit: '1mb',
  textLimit: '1mb',
  strict: true,  // 严格模式，JSON必须是对象或数组
  detectJSON: (ctx) => /\.json$/i.test(ctx.path),
  extendTypes: {
    json: ['application/x-javascript'],
    form: ['application/x-www-form-urlencoded']
  },
  onerror: (err, ctx) => {
    ctx.throw(422, 'body parse error');
  }
}));

// 使用解析后的body
app.use(async (ctx) => {
  const { name, age } = ctx.request.body;
  ctx.body = { name, age };
});
```

**处理不同Content-Type**
```javascript
// JSON
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John', age: 25 })
});

// 表单
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'name=John&age=25'
});

// 文本
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: 'Some text data'
});
```

**处理文件上传（需要其他中间件）**
```javascript
const multer = require('@koa/multer');

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024  // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

router.post('/upload', upload.single('file'), (ctx) => {
  ctx.body = {
    filename: ctx.file.filename,
    size: ctx.file.size
  };
});
```

## 性能优化相关

### 1. 前端性能优化（JS原生和React）

#### 解答

前端性能优化涉及多个方面。

#### JavaScript原生优化

**1. 防抖和节流**
```javascript
// 防抖：延迟执行
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 使用
const search = debounce((keyword) => {
  fetch(`/api/search?q=${keyword}`);
}, 300);

input.addEventListener('input', (e) => {
  search(e.target.value);
});

// 节流：限制频率
function throttle(fn, delay) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= delay) {
      fn.apply(this, args);
      last = now;
    }
  };
}

// 使用
const handleScroll = throttle(() => {
  console.log('Scrolling...');
}, 200);

window.addEventListener('scroll', handleScroll);
```

**2. 虚拟滚动**
```javascript
class VirtualList {
  constructor(container, items, itemHeight) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.viewportHeight = container.clientHeight;
    this.visibleCount = Math.ceil(this.viewportHeight / itemHeight) + 1;

    this.render();
    container.addEventListener('scroll', () => this.render());
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = startIndex + this.visibleCount;

    // 只渲染可见区域的元素
    const visibleItems = this.items.slice(startIndex, endIndex);

    this.container.innerHTML = `
      <div style="height: ${this.items.length * this.itemHeight}px; position: relative;">
        ${visibleItems.map((item, index) => `
          <div style="
            position: absolute;
            top: ${(startIndex + index) * this.itemHeight}px;
            height: ${this.itemHeight}px;
          ">
            ${item}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// 使用
const items = Array.from({ length: 10000 }, (_, i) => `Item ${i}`);
new VirtualList(document.getElementById('list'), items, 50);
```

**3. 懒加载**
```javascript
// 图片懒加载
const lazyImages = document.querySelectorAll('img[data-src]');

const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      imageObserver.unobserve(img);
    }
  });
});

lazyImages.forEach(img => imageObserver.observe(img));

// 模块懒加载
button.addEventListener('click', async () => {
  const { default: module } = await import('./heavy-module.js');
  module.init();
});
```

**4. Web Worker**
```javascript
// 主线程
const worker = new Worker('worker.js');

worker.postMessage({ numbers: largeArray });

worker.onmessage = (e) => {
  console.log('Result:', e.data);
};

// worker.js
self.onmessage = (e) => {
  const { numbers } = e.data;
  const sum = numbers.reduce((a, b) => a + b, 0);
  self.postMessage(sum);
};
```

**5. RequestAnimationFrame**
```javascript
// ❌ 不好：直接操作DOM
function animate() {
  element.style.left = element.offsetLeft + 1 + 'px';
  setTimeout(animate, 16);
}

// ✅ 好：使用RAF
function animate() {
  element.style.left = element.offsetLeft + 1 + 'px';
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

#### React性能优化

**1. React.memo（避免重渲染）**
```javascript
// ❌ 每次父组件更新都会重渲染
function Child({ name }) {
  console.log('Rendering Child');
  return <div>{name}</div>;
}

// ✅ 只有props变化才重渲染
const Child = React.memo(({ name }) => {
  console.log('Rendering Child');
  return <div>{name}</div>;
});

// 自定义比较
const Child = React.memo(
  ({ user }) => <div>{user.name}</div>,
  (prevProps, nextProps) => {
    return prevProps.user.id === nextProps.user.id;
  }
);
```

**2. useMemo（缓存计算结果）**
```javascript
function Component({ items }) {
  // ❌ 每次渲染都重新计算
  const expensiveResult = items.reduce((sum, item) => sum + item.price, 0);

  // ✅ 只有items变化时才重新计算
  const expensiveResult = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price, 0);
  }, [items]);

  return <div>{expensiveResult}</div>;
}
```

**3. useCallback（缓存函数）**
```javascript
function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 每次渲染都创建新函数，导致Child重渲染
  const handleClick = () => {
    console.log('Clicked');
  };

  // ✅ 缓存函数引用
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []);

  return <Child onClick={handleClick} />;
}
```

**4. 代码分割**
```javascript
// 路由级别分割
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Suspense>
  );
}

// 组件级别分割
function App() {
  const [showChart, setShowChart] = useState(false);
  const Chart = lazy(() => import('./Chart'));

  return (
    <div>
      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <Chart />
        </Suspense>
      )}
    </div>
  );
}
```

**5. 虚拟化长列表**
```javascript
import { FixedSizeList } from 'react-window';

function VirtualList({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          {items[index]}
        </div>
      )}
    </FixedSizeList>
  );
}
```

**6. shouldComponentUpdate**
```javascript
class MyComponent extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    // 只有userId变化才更新
    return nextProps.userId !== this.props.userId;
  }

  render() {
    return <div>{this.props.userId}</div>;
  }
}

// 或使用PureComponent
class MyComponent extends React.PureComponent {
  // 自动浅比较props和state
  render() {
    return <div>{this.props.userId}</div>;
  }
}
```

**7. 避免内联对象和函数**
```javascript
// ❌ 每次渲染都创建新对象
function Bad() {
  return <Child style={{ color: 'red' }} onClick={() => {}} />;
}

// ✅ 使用常量或useMemo
const style = { color: 'red' };

function Good() {
  const handleClick = useCallback(() => {}, []);

  return <Child style={style} onClick={handleClick} />;
}
```

**8. 使用生产环境构建**
```bash
# 开发环境（包含警告和调试信息）
npm start

# 生产环境（优化和压缩）
npm run build

# React生产构建优化
# - 移除propTypes检查
# - 移除开发警告
# - 代码压缩
# - Tree shaking
```

### 2. 如何做单元测试

#### 解答

单元测试是测试代码最小单元的方法。

**JavaScript单元测试（Jest）**

```bash
# 安装Jest
npm install --save-dev jest
```

**基础测试**
```javascript
// sum.js
function sum(a, b) {
  return a + b;
}

module.exports = sum;

// sum.test.js
const sum = require('./sum');

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});

test('adds 0 + 0 to equal 0', () => {
  expect(sum(0, 0)).toBe(0);
});

test('adds -1 + 1 to equal 0', () => {
  expect(sum(-1, 1)).toBe(0);
});
```

**异步测试**
```javascript
// fetchUser.js
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// fetchUser.test.js
test('fetches user data', async () => {
  const user = await fetchUser(1);
  expect(user).toEqual({
    id: 1,
    name: 'John'
  });
});

// 使用done回调
test('fetches user data with callback', (done) => {
  fetchUser(1).then(user => {
    expect(user.name).toBe('John');
    done();
  });
});
```

**Mock和Spy**
```javascript
// userService.js
const userService = {
  getUser: (id) => fetch(`/api/users/${id}`).then(r => r.json()),
  createUser: (data) => fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })
};

// userService.test.js
// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ id: 1, name: 'John' })
  })
);

test('getUser calls fetch with correct URL', async () => {
  await userService.getUser(1);

  expect(fetch).toHaveBeenCalledWith('/api/users/1');
  expect(fetch).toHaveBeenCalledTimes(1);
});

// Spy on methods
test('createUser is called', () => {
  const spy = jest.spyOn(userService, 'createUser');

  userService.createUser({ name: 'Jane' });

  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
```

**React组件测试**
```bash
# 安装React测试库
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

```javascript
// Counter.jsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p data-testid="count">Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
    </div>
  );
}

// Counter.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Counter } from './Counter';

test('renders counter', () => {
  render(<Counter />);

  const countElement = screen.getByTestId('count');
  expect(countElement).toHaveTextContent('Count: 0');
});

test('increments counter', () => {
  render(<Counter />);

  const incrementButton = screen.getByText('Increment');
  fireEvent.click(incrementButton);

  const countElement = screen.getByTestId('count');
  expect(countElement).toHaveTextContent('Count: 1');
});

test('decrements counter', () => {
  render(<Counter />);

  const decrementButton = screen.getByText('Decrement');
  fireEvent.click(decrementButton);

  const countElement = screen.getByTestId('count');
  expect(countElement).toHaveTextContent('Count: -1');
});
```

**测试Hooks**
```javascript
// useCounter.js
import { useState } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}

// useCounter.test.js
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

test('should use counter', () => {
  const { result } = renderHook(() => useCounter());

  expect(result.current.count).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);

  act(() => {
    result.current.decrement();
  });

  expect(result.current.count).toBe(0);

  act(() => {
    result.current.reset();
  });

  expect(result.current.count).toBe(0);
});

test('should use counter with initial value', () => {
  const { result } = renderHook(() => useCounter(10));

  expect(result.current.count).toBe(10);

  act(() => {
    result.current.reset();
  });

  expect(result.current.count).toBe(10);
});
```

**快照测试**
```javascript
import renderer from 'react-test-renderer';
import { Button } from './Button';

test('button renders correctly', () => {
  const tree = renderer
    .create(<Button label="Click me" />)
    .toJSON();

  expect(tree).toMatchSnapshot();
});
```

**覆盖率报告**
```bash
# 运行测试并生成覆盖率报告
npm test -- --coverage

# 查看覆盖率
open coverage/lcov-report/index.html
```

**最佳实践**
```javascript
// 1. 测试行为，不是实现
// ❌ 不好
test('increments state', () => {
  const wrapper = shallow(<Counter />);
  wrapper.instance().increment();
  expect(wrapper.state('count')).toBe(1);
});

// ✅ 好
test('shows incremented count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByText('Increment'));
  expect(screen.getByTestId('count')).toHaveTextContent('Count: 1');
});

// 2. 使用有意义的测试描述
// ❌ 不好
test('test 1', () => {});

// ✅ 好
test('displays error message when email is invalid', () => {});

// 3. 测试边界情况
test('handles empty array', () => {
  expect(sum([])).toBe(0);
});

test('handles negative numbers', () => {
  expect(sum([-1, -2])).toBe(-3);
});

test('handles large numbers', () => {
  expect(sum([1e10, 1e10])).toBe(2e10);
});

// 4. 使用describe分组
describe('UserService', () => {
  describe('getUser', () => {
    test('returns user when found', () => {});
    test('returns null when not found', () => {});
  });

  describe('createUser', () => {
    test('creates user successfully', () => {});
    test('throws error when data is invalid', () => {});
  });
});
```

## 总结

本面试题库涵盖了：

1. **React** - 生命周期、Hooks、性能优化
2. **Redux** - 状态管理、中间件、数据流
3. **Webpack** - 配置、插件、优化
4. **JavaScript** - 基础语法、异步编程、数据结构
5. **Promise/Async** - 异步处理、事件循环
6. **HTTP/网络** - 请求头、状态码、HTTPS、跨域
7. **CSS** - 布局、定位、居中
8. **Node.js** - Koa2中间件、服务器开发
9. **性能优化** - 前端优化、React优化
10. **测试** - 单元测试、组件测试

建议根据实际面试情况重点复习相关内容，并动手实践代码示例以加深理解。

