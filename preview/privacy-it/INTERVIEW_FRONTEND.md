# 前端基础知识 - 面试准备

> **适用场景**: 高级前端 / 全栈工程师面试
> **关联项目**: 性能优化、工程化建设
> **重要程度**: ⭐⭐⭐⭐ 基础知识必考

---

## 📋 快速索引

| 主题 | 重要度 | 你的项目关联 |
|------|--------|--------------|
| 浏览器渲染流程 | ⭐⭐⭐⭐⭐ | 首屏优化、重排重绘 |
| Web Vitals | ⭐⭐⭐⭐⭐ | 你简历有LCP/FCP数据 |
| HTTP缓存 | ⭐⭐⭐⭐ | ISR + CDN缓存策略 |
| 构建工具原理 | ⭐⭐⭐⭐ | 工程化建设 |
| 内存泄漏 | ⭐⭐⭐⭐ | Electron内存优化90% |
| 网络优化 | ⭐⭐⭐ | 预加载、CDN |

---

## 🎯 Q1: 浏览器渲染流程是怎样的？

### 完整流程

```
HTML → DOM Tree
              ↘
               → Render Tree → Layout → Paint → Composite
              ↗
CSS → CSSOM
```

### 标准回答

> "浏览器渲染分为**5个主要阶段**：
>
> **1. 解析（Parse）**
> - HTML → **DOM Tree**（文档对象模型）
> - CSS → **CSSOM**（CSS对象模型）
> - 两者可以并行解析
>
> **2. 样式计算（Style）**
> - 合并 DOM + CSSOM → **Render Tree**
> - 计算每个节点的最终样式（computed style）
> - `display: none` 的节点不进入 Render Tree
>
> **3. 布局（Layout / Reflow）**
> - 计算每个节点的**几何信息**（位置、大小）
> - 这一步很耗性能
>
> **4. 绘制（Paint）**
> - 把节点绘制成**像素**
> - 生成多个图层（Layer）
>
> **5. 合成（Composite）**
> - 将图层合并，显示到屏幕
> - GPU 加速的关键步骤
>
> **性能优化点**：
> - 避免**重排（Reflow）**：改变布局属性（width、height、margin）
> - 避免**重绘（Repaint）**：改变视觉属性（color、background）
> - 用 `transform` 和 `opacity` 做动画，只触发合成，跳过布局和绘制"

### 追问：什么操作会触发重排？

> "常见的有：
> - **几何属性变化**：width、height、padding、margin、border
> - **位置变化**：top、left、position
> - **DOM 结构变化**：添加/删除/移动节点
> - **读取布局信息**：offsetWidth、scrollTop、getBoundingClientRect()
>
> **优化技巧**：
> ```javascript
> // ❌ 读写交替，触发多次重排
> el.style.width = '100px';
> console.log(el.offsetWidth);  // 强制重排
> el.style.height = '100px';
> console.log(el.offsetHeight); // 再次重排
>
> // ✅ 批量读、批量写
> const width = el.offsetWidth;
> const height = el.offsetHeight;
> el.style.width = '100px';
> el.style.height = '100px';
> ```
>
> 我在 QPON 的首页优化中，把多次 DOM 操作合并，减少了 70% 的重排次数。"

---

## 🎯 Q2: Web Vitals 有哪些指标？你的项目数据是多少？

### 核心指标

| 指标 | 全称 | 含义 | 良好标准 | 你的项目 |
|------|------|------|----------|----------|
| **LCP** | Largest Contentful Paint | 最大内容绘制 | < 2.5s | **2.8s (P75)** |
| **FID** | First Input Delay | 首次输入延迟 | < 100ms | — |
| **CLS** | Cumulative Layout Shift | 累积布局偏移 | < 0.1 | **0.02** |
| **FCP** | First Contentful Paint | 首次内容绘制 | < 1.8s | **1.3s (P75)** |
| **TTFB** | Time to First Byte | 首字节时间 | < 800ms | **146ms (P95)** |

### 标准回答

> "Web Vitals 是 Google 定义的**用户体验核心指标**，影响 SEO 排名。
>
> **我的项目数据**（AI 内容平台）：
> - **LCP 2.8s**：还有优化空间，主要是首图加载
> - **FCP 1.3s**：比较好，ISR 静态化的效果
> - **CLS 0.02**：很好，用了 `next/image` 预留空间
> - **TTFB 146ms（P95）**：三级缓存的效果
>
> **QPON 应用数据**：
> - 首屏关键数据上屏：3s → **1.7s**（降低40%）
> - iOS 设备：平均 **1s 内**完成首屏
> - 低端安卓机：**1.5s**（iframe 快照方案）
>
> **优化手段**：
> - **LCP**：预加载关键图片、使用 CDN、图片懒加载
> - **FID**：减少 JS 执行时间、代码分割
> - **CLS**：预留图片/广告位尺寸、避免动态插入内容"

### 追问：怎么测量这些指标？

> "测量方式分**实验室数据**和**现场数据**：
>
> **实验室数据（Lab Data）**：
> - Lighthouse：Chrome DevTools 内置
> - WebPageTest：模拟不同网络/设备
> - 我的 CI 用 Playwright + Lighthouse 自动化测量
>
> **现场数据（Field Data）**：
> - Chrome UX Report（CrUX）：真实用户数据
> - Web Vitals JS 库：自己埋点上报
>
> ```javascript
> import { getLCP, getFID, getCLS } from 'web-vitals';
>
> getCLS(console.log);
> getFID(console.log);
> getLCP(console.log);
> ```
>
> 我在 QPON 用的是**现场数据**，更能反映真实用户体验，但需要注意采样和噪点过滤。"

---

## 🎯 Q3: HTTP 缓存机制有哪些？

### 两种缓存策略

| 类型 | 控制头 | 特点 | 适用场景 |
|------|--------|------|----------|
| **强缓存** | `Cache-Control`、`Expires` | 不发请求，直接用本地 | 静态资源（JS/CSS/图片） |
| **协商缓存** | `ETag`、`Last-Modified` | 发请求验证，可能返回304 | 可能变化的资源 |

### 标准回答

> "HTTP 缓存分**强缓存**和**协商缓存**：
>
> **强缓存**（不问服务器）：
> ```
> Cache-Control: max-age=31536000  // 1年
> ```
> - 在有效期内，浏览器直接用本地缓存
> - 适合**带 hash 的静态资源**（main.a1b2c3.js）
> - 更新时改文件名，强制刷新
>
> **协商缓存**（问服务器）：
> ```
> ETag: "abc123"
> Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT
> ```
> - 浏览器带 `If-None-Match` / `If-Modified-Since` 请求
> - 服务器返回 304（未修改）或 200（新内容）
> - 适合**HTML 入口文件**
>
> **我的项目缓存策略**：
> - **HTML**：`no-cache`（每次验证，保证更新及时）
> - **JS/CSS**：`max-age=31536000`（1年，文件名带 hash）
> - **API 数据**：Redis 缓存 + `stale-while-revalidate`
> - **ISR 页面**：`s-maxage=3600, stale-while-revalidate`"

### 追问：CDN 缓存和浏览器缓存什么关系？

> "是两层不同的缓存：
>
> ```
> 用户 → [浏览器缓存] → [CDN缓存] → [源服务器]
> ```
>
> **区别**：
> - `max-age`：控制浏览器缓存
> - `s-maxage`：控制 CDN（共享）缓存，优先级更高
>
> **我的配置**：
> ```
> Cache-Control: s-maxage=3600, stale-while-revalidate=86400
> ```
> - CDN 缓存 1 小时
> - 过期后，CDN 先返回旧内容，后台异步更新
> - 用户几乎感知不到延迟
>
> 这也是 ISR 的核心原理——`stale-while-revalidate` 策略。"

---

## 🎯 Q4: 构建工具（Webpack/Vite）的原理？

### Webpack 核心流程

```
Entry → Loaders → Plugins → Bundle
```

### 标准回答

> "以 Webpack 为例，核心流程是：
>
> **1. 初始化**
> - 读取配置，创建 Compiler 对象
>
> **2. 构建依赖图**
> - 从 entry 开始，递归解析 `import/require`
> - 形成模块依赖图（Module Graph）
>
> **3. Loader 转换**
> - 对每个模块应用对应的 Loader
> - 比如：`.ts` → `ts-loader` → `.js`
>
> **4. Plugin 处理**
> - 在构建生命周期的各个钩子执行插件
> - 比如：代码压缩、生成 HTML
>
> **5. 输出 Bundle**
> - 合并模块，生成最终文件
> - 代码分割、Tree Shaking
>
> **Vite 为什么更快？**
> - **开发模式**：不打包，用浏览器原生 ESM，按需编译
> - **生产模式**：用 Rollup 打包
> - 冷启动从几十秒变成几百毫秒"

### 追问：Tree Shaking 是怎么实现的？

> "Tree Shaking 是**移除未使用代码**的技术。
>
> **原理**：
> - 依赖 ES Module 的**静态分析**
> - `import/export` 在编译时就能确定依赖关系
> - 标记未使用的导出，打包时删除
>
> **前提条件**：
> - 必须用 ESM（`import/export`），CommonJS 不行
> - 代码不能有**副作用**
>
> ```javascript
> // package.json
> {
>   \"sideEffects\": false  // 声明整个包无副作用
> }
>
> // 或者指定有副作用的文件
> {
>   \"sideEffects\": [\"*.css\", \"*.scss\"]
> }
> ```
>
> **我的实践**：
> - 使用 `lodash-es` 而不是 `lodash`
> - 组件库按需导入：`import { Button } from 'antd'`
> - 检查 Bundle Analyzer，确认无用代码被移除"

---

## 🎯 Q5: 内存泄漏怎么排查和解决？

### 常见泄漏场景

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| 定时器未清除 | `setInterval` 回调引用组件 | 组件卸载时 `clearInterval` |
| 事件监听未移除 | `addEventListener` 后忘记移除 | `removeEventListener` |
| 闭包引用 | 闭包持有大对象 | 及时置空引用 |
| DOM 引用 | JS 变量引用已删除的 DOM | 删除 DOM 时置空变量 |
| 全局变量 | 意外挂在 window 上 | 使用模块化、严格模式 |

### 标准回答

> "内存泄漏是指**不再使用的内存没有被回收**。
>
> **排查方法**：
>
> **1. Chrome DevTools Memory 面板**
> - 拍摄 Heap Snapshot，对比两次快照
> - 看 Retained Size 大的对象
>
> **2. Performance Monitor**
> - 观察 JS Heap Size 是否持续增长
> - 正常情况：波动但不持续上涨
>
> **3. Memory 时间线**
> - 录制操作，看内存变化
> - 每次操作后是否回落
>
> **我在 OPPO 主题编辑器的实践**：
>
> 问题：undo/redo 功能导致内存从 50MB 涨到 200MB，最后崩溃。
>
> 原因：每次操作都**深拷贝整个画布状态**保存历史。
>
> 解决：
> 1. 改用 **Patch 理念**，只记录变化（`{ path: 'layer.1.x', old: 100, new: 150 }`）
> 2. 历史记录超过 100 条时，**splice 删除旧记录**
> 3. 图层预览用 **WeakMap**，图层删除后自动 GC
>
> 效果：内存占用从 200MB 降到 20MB（**降低 90%**）。"

### 追问：WeakMap 和 Map 有什么区别？

> "**WeakMap 的 key 是弱引用**，不阻止垃圾回收。
>
> ```javascript
> const map = new Map();
> const weakMap = new WeakMap();
>
> let obj = { data: 'large' };
>
> map.set(obj, 'value');
> weakMap.set(obj, 'value');
>
> obj = null;  // 解除引用
>
> // Map 中的 obj 仍然存在（强引用）
> // WeakMap 中的 obj 会被 GC（弱引用）
> ```
>
> **适用场景**：
> - 存储 DOM 节点相关数据（节点删除后自动清理）
> - 存储对象的私有数据
> - 缓存计算结果（对象销毁后缓存自动失效）"

---

## 🎯 Q6: 预加载和预连接有哪些方式？

### 资源提示（Resource Hints）

| 标签 | 作用 | 场景 |
|------|------|------|
| `preload` | 提前加载**当前页面**必需资源 | 字体、关键 CSS |
| `prefetch` | 空闲时加载**下一页**可能用到的资源 | 下一页的 JS |
| `preconnect` | 提前建立连接（DNS + TCP + TLS） | 第三方 API 域名 |
| `dns-prefetch` | 只做 DNS 解析 | 更多第三方域名 |

### 标准回答

> "资源提示可以优化**关键路径**和**后续导航**：
>
> **preload（预加载当前页）**：
> ```html
> <link rel=\"preload\" href=\"/fonts/Inter.woff2\" as=\"font\" crossorigin>
> <link rel=\"preload\" href=\"/hero.jpg\" as=\"image\">
> ```
> - 告诉浏览器这个资源很重要，尽快加载
> - 我用在关键字体和首屏图片
>
> **prefetch（预取下一页）**：
> ```html
> <link rel=\"prefetch\" href=\"/article/123.js\">
> ```
> - 浏览器**空闲时**加载
> - Next.js 的 `<Link prefetch>` 就是这个原理
>
> **preconnect（预连接）**：
> ```html
> <link rel=\"preconnect\" href=\"https://api.qpon.com\">
> <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
> ```
> - 省去 DNS + TCP + TLS 握手时间（约 100-300ms）
> - 我用在 API 域名和字体 CDN
>
> **我的项目配置**：
> ```javascript
> // next.config.js
> async headers() {
>   return [{
>     source: '/:path*',
>     headers: [
>       { key: 'Link', value: '<https://fonts.gstatic.com>; rel=preconnect' },
>     ],
>   }];
> }
> ```"

---

## 🎯 Q7: 跨域是什么？怎么解决？

### 同源策略

**同源**：协议 + 域名 + 端口 都相同

```
https://qpon.com/api      ✅ 同源
https://api.qpon.com/v1   ❌ 跨域（子域名不同）
http://qpon.com/api       ❌ 跨域（协议不同）
https://qpon.com:8080/api ❌ 跨域（端口不同）
```

### 标准回答

> "**同源策略**是浏览器的安全机制，限制跨域请求。
>
> **解决方案**：
>
> **1. CORS（推荐）**
> 服务端设置响应头：
> ```
> Access-Control-Allow-Origin: https://qpon.com
> Access-Control-Allow-Methods: GET, POST, PUT
> Access-Control-Allow-Credentials: true
> ```
>
> **2. 代理服务器**
> 开发环境用 webpack/vite 代理：
> ```javascript
> // vite.config.js
> proxy: {
>   '/api': {
>     target: 'https://api.qpon.com',
>     changeOrigin: true,
>   }
> }
> ```
>
> **3. JSONP（已淘汰）**
> 利用 `<script>` 标签不受同源限制的特性，只支持 GET。
>
> **我的项目**：
> - 前端（qpon.com）和 API（api.qpon.com）跨域
> - 服务端配置 CORS 白名单
> - Credentials 设为 true，支持携带 Cookie"

### 追问：简单请求和预检请求的区别？

> "浏览器把跨域请求分为**简单请求**和**需预检请求**：
>
> **简单请求**（直接发送）：
> - 方法：GET、HEAD、POST
> - 头部：只有简单头（Accept、Content-Type 等）
> - Content-Type：仅限 text/plain、form-data、form-urlencoded
>
> **预检请求**（先发 OPTIONS）：
> - 使用 PUT、DELETE 等方法
> - 有自定义头部（Authorization）
> - Content-Type 是 application/json
>
> ```
> OPTIONS /api/user HTTP/1.1
> Origin: https://qpon.com
> Access-Control-Request-Method: PUT
> Access-Control-Request-Headers: Content-Type, Authorization
>
> → 服务器返回允许的方法和头部
> → 然后才发真正的 PUT 请求
> ```
>
> 预检请求会**增加一次往返**，可以用 `Access-Control-Max-Age` 缓存。"

---

## 🎯 Q8: 事件循环（Event Loop）是什么？

### 标准回答

> "JavaScript 是**单线程**的，通过事件循环实现异步。
>
> **执行顺序**：
> 1. 执行**同步代码**（调用栈）
> 2. 调用栈空了，检查**微任务队列**，全部执行
> 3. 微任务执行完，从**宏任务队列**取一个执行
> 4. 重复 2-3
>
> **微任务（Microtask）**：
> - Promise.then/catch/finally
> - MutationObserver
> - queueMicrotask()
>
> **宏任务（Macrotask）**：
> - setTimeout / setInterval
> - I/O、UI 渲染
> - requestAnimationFrame
>
> **经典面试题**：
> ```javascript
> console.log('1');
>
> setTimeout(() => console.log('2'), 0);
>
> Promise.resolve().then(() => console.log('3'));
>
> console.log('4');
>
> // 输出：1 4 3 2
> // 同步(1,4) → 微任务(3) → 宏任务(2)
> ```"

### 追问：requestAnimationFrame 是宏任务还是微任务？

> "**都不是**，它有独立的调度时机。
>
> `requestAnimationFrame` 在**浏览器下一次重绘之前**执行，通常是每秒 60 次（16.6ms 一次）。
>
> 执行顺序大致是：
> ```
> 宏任务 → 微任务 → requestAnimationFrame → 渲染 → 下一个宏任务
> ```
>
> 用它做动画比 setTimeout 更流畅，因为和浏览器渲染节奏同步。"

---

## 💡 常见追问

### Q: 首屏优化的完整思路？

> "我的优化框架是**关键渲染路径 + 资源优化 + 运行时优化**：
>
> **1. 关键渲染路径**
> - 减少关键资源数量（内联关键 CSS）
> - 减少关键资源大小（压缩、Tree Shaking）
> - 减少关键路径长度（预加载、HTTP/2）
>
> **2. 资源优化**
> - 图片：WebP、响应式、懒加载
> - 字体：子集化、font-display: swap
> - JS：代码分割、动态导入
>
> **3. 运行时优化**
> - 虚拟列表、懒渲染
> - 缓存策略（HTTP、Service Worker）
> - 减少重排重绘
>
> **量化目标**：FCP < 1.8s，LCP < 2.5s，CLS < 0.1"

### Q: 前端安全有哪些？

> "主要是 **XSS** 和 **CSRF**：
>
> **XSS（跨站脚本）**：
> - 攻击者注入恶意脚本
> - 防御：转义输出、CSP、HttpOnly Cookie
>
> **CSRF（跨站请求伪造）**：
> - 利用用户已登录的身份发请求
> - 防御：CSRF Token、SameSite Cookie、Referer 检查
>
> 我的项目用 `SameSite=Strict` + CSRF Token 双重防护。"

---

## 📝 面试模拟题

1. "浏览器输入 URL 到页面展示的完整过程"
2. "如何优化首屏加载速度？"
3. "强缓存和协商缓存的区别？"
4. "什么是重排和重绘？如何避免？"
5. "解释一下 Web Vitals 的各项指标"
6. "setTimeout 和 requestAnimationFrame 的区别？"

---

**文档生成时间**: 2026-03-06
