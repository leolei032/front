# OPPO 前端面试题库分类整理

本仓库包含从面试题文档中整理的前端面试题及详细答案，按照技术领域分类。

## 目录结构

### [01-数据结构和算法](./01-数据结构和算法.md)
- 快速排序和数组打平
- 判断链表是否有环
- 链表反转
- 常见排序算法的时间复杂度

### [02-JS事件循环和异步](./02-JS事件循环和异步.md)
- JS的事件循环机制
- setTimeout和Promise的执行顺序
- async/await的实现原理
- 理解宏任务和微任务的区别
- Promise、async和await的区别
- 介绍Promise及常用方法

### [03-开发语言](./03-开发语言.md)
- 基础HTML5/CSS3/JS常见语法
- 编码风格和性能优化
- 浏览器兼容性处理
- 跨域问题解决方案
- ES6/ES7新特性
- BFC及应用场景
- for循环和forEach性能差异
- import和require的区别

### [04-Vue框架](./04-Vue框架.md)
- Vue2响应式原理
- 如何利用saas/less做多主题配色
- retina屏幕的1px边框问题
- $nextTick的使用
- 模块化和iconset改造
- CSS样式管理（rem、em、vw）
- Vue组件通信方式

### [05-React框架](./05-React框架.md)
- React diff原理
- React生命周期
- React Hooks使用和原理
- React性能优化
- React Context

### [06-前端框架架构](./06-前端框架架构.md)
- 前端框架概念
- 前端工程化/架构设计
- bind、call、apply的区别
- === 和 == 的区别

### [07-Webpack构建工具](./07-Webpack构建工具.md)
- Webpack是什么
- loader和plugin的区别
- Webpack HMR原理
- 如何编写Webpack插件

### [08-性能优化](./08-性能优化.md)
- 性能优化体系
  - 加载性能优化（资源压缩、代码分割、Tree Shaking）
  - 渲染性能优化（虚拟滚动、防抖节流）
  - 缓存优化（HTTP缓存、Service Worker）
  - 网络优化
  - 监控和分析
- 无限滚动加载实现

### [09-HTTP和网络](./09-HTTP和网络.md)
- 为什么HTTPS安全
- HTTPS握手过程
- 网络请求超时处理
- 浏览器缓存策略
  - 强缓存（Expires、Cache-Control）
  - 协商缓存（Last-Modified、ETag）

### [10-Node.js和工程化](./10-Node.js和工程化.md)
- Node.js如何保证程序健壮性
  - 错误处理
  - 进程管理（PM2、Cluster）
  - 健康检查
  - 日志系统
  - 限流和熔断
  - 监控告警
- PM2 Master进程职责
- Node.js服务稳定性保障

### [11-前端安全](./11-前端安全.md)
- 跨域问题及解决方案
  - CORS
  - JSONP
  - 代理服务器
  - postMessage
  - WebSocket
- XSS攻击防御
- CSRF攻击防御
- SQL注入防御
- 其他安全问题（点击劫持、中间人攻击、信息泄露）

### [12-前端框架细节](./12-前端框架细节.md)
- Virtual DOM原理
- 为什么不直接用DOM
- Keep-alive作用和工作流程
- Vue Router的hash和history模式区别

### [13-浏览器原理](./13-浏览器原理.md)
- 浏览器渲染流程（DOM树、CSSOM树、渲染树）
- 重排（Reflow）和重绘（Repaint）
- 浏览器事件机制（捕获、冒泡、事件委托）

### [14-补充问题](./14-补充问题.md)
- Vue的$watch和computed的区别
- 如何保证前端安全性
- 前端监控体系（性能监控、错误监控、用户行为）
- 骨架屏实现
- 性能监控和优化效果对比
- 监控上报系统设计
- 并发控制方案

### [15-Vue深入问题](./15-Vue深入问题.md)
- Vue的v-model原理
- Vue的$set和$delete
- Vue的diff算法
- Vue的nextTick原理

### [16-实战问题集锦](./16-实战问题集锦.md)
- 技术栈应用和项目经验
- 项目难点和解决方案
- 移动端适配方案
- 大文件上传方案
- 前端权限控制方案

### [17-前端监控深度解析](./17-前端监控深度解析.md)
- **监控系统架构设计**
  - SDK采集层（性能、错误、行为、资源）
  - 数据处理层（格式化、压缩、采样、队列）
  - 上报层（Image、Beacon、Fetch、重试）
  - 存储分析层（日志存储、数据聚合、可视化）

- **性能监控**
  - Web Vitals监控（LCP、FID、CLS、FCP、TTFB）
  - Navigation Timing API
  - 资源加载监控
  - 长任务监控
  - FPS监控

- **错误监控**
  - JavaScript错误捕获
  - Promise错误捕获
  - 资源加载错误
  - 接口错误监控
  - 框架错误处理（Vue/React）

- **Vue/React框架错误监控**
  - Vue 2/3错误处理
  - React错误边界
  - 第三方库错误捕获
  - Axios拦截器

- **错误分析**
  - SourceMap解析
  - 错误聚合和去重
  - 错误分类和指纹

- **Node.js进程监控**
  - 进程健壮性保证
  - PM2集群管理
  - 进程间通信
  - 内存和CPU监控
  - 优雅退出

- **并发控制**
  - 并发控制类实现
  - Promise池
  - 请求并发控制
  - 域名分片
  - 队列调度器
  - 实际应用（文件上传、爬虫）

- **监控数据可视化**
  - 实时监控仪表盘
  - Socket.IO实时推送
  - 前端图表展示

- **告警系统**
  - 告警规则引擎
  - 多渠道告警（邮件、短信、Webhook）
  - 告警去重和冷却

## 使用说明

1. 每个文件对应一个技术领域
2. 每个问题都包含详细的解答和代码示例
3. 代码示例经过验证，可以直接运行
4. 适合面试前复习和技术学习

## 技术栈涵盖

- **基础**：HTML5、CSS3、JavaScript、ES6+
- **框架**：Vue.js、React.js
- **构建工具**：Webpack
- **运行环境**：Node.js
- **网络**：HTTP/HTTPS、缓存、跨域
- **安全**：XSS、CSRF、SQL注入
- **性能优化**：加载优化、渲染优化、缓存策略
- **数据结构与算法**：排序、链表、时间复杂度

## 适用人群

- 准备前端面试的开发者
- 希望系统学习前端知识的学习者
- 需要查阅前端技术细节的开发者

## 贡献

如发现错误或需要补充内容，欢迎提交PR或Issue。

## License

MIT
