# TypeScript 插件系统

一个功能完整、易于扩展、类型安全的 TypeScript 插件系统实现，参考了 Webpack 的插件机制设计。

## ✨ 特性

- ✅ **完整的 TypeScript 支持** - 类型安全、智能提示
- ✅ **多种钩子类型** - sync、asyncSeries、asyncParallel、waterfall、bail
- ✅ **优先级机制** - 精确控制插件执行顺序
- ✅ **上下文共享** - 插件间数据传递
- ✅ **生命周期管理** - 初始化和销毁钩子
- ✅ **完善的示例** - 开箱即用的示例插件

## 📦 核心概念

### 1. PluginManager（插件管理器）

插件管理器是整个系统的核心，负责：
- 插件的注册和管理
- 钩子（Hook）的注册和调用
- 插件间的上下文共享

### 2. Plugin（插件基类）

所有插件都继承自 Plugin 基类，必须实现 `apply` 方法。

### 3. Hook（钩子）

钩子是插件系统的事件机制，支持五种类型：

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| **sync** | 同步钩子，按顺序执行所有回调 | 简单的同步操作、日志记录 |
| **asyncSeries** | 异步串行钩子，按顺序 await | 有顺序依赖的异步任务 |
| **asyncParallel** | 异步并行钩子，Promise.all 执行 | 并行的异步操作、网络请求 |
| **waterfall** | 瀑布流钩子，结果链式传递 | 数据转换管道、中间件 |
| **bail** | 熔断钩子，有返回值则停止 | 数据验证、短路判断 |

## 📁 文件结构

```
pluginSystem/
├── src/
│   ├── PluginManager.ts      # 插件管理器核心类
│   ├── Plugin.ts              # 插件基类
│   └── index.ts               # 入口文件
├── types/
│   └── index.ts               # 类型定义
├── examples/
│   ├── LoggerPlugin.ts        # 日志插件
│   ├── CachePlugin.ts         # 缓存插件
│   ├── ValidationPlugin.ts    # 验证插件
│   ├── TransformPlugin.ts     # 转换插件
│   └── index.ts               # 示例插件导出
├── demo.ts                    # 使用示例
├── tsconfig.json              # TypeScript 配置
├── package.json               # 项目配置
└── README.md                  # 说明文档
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行示例

```bash
npm run demo
```

### 开发模式

```bash
npm run dev
```

## 💡 基本用法

### 1. 创建插件管理器

```typescript
import { PluginManager } from './src/PluginManager';

const manager = new PluginManager();
```

### 2. 注册钩子

```typescript
manager.registerHook('beforeStart', 'sync');
manager.registerHook('start', 'asyncSeries');
manager.registerHook('transform', 'waterfall');
manager.registerHook('validate', 'bail');
```

### 3. 创建自定义插件

```typescript
import { Plugin } from './src/Plugin';
import type { IPluginManager, PluginOptions } from './types';

interface MyPluginOptions extends PluginOptions {
  prefix?: string;
}

class MyPlugin extends Plugin<MyPluginOptions> {
  constructor(options: MyPluginOptions = {}) {
    super(options);
  }

  apply(manager: IPluginManager): void {
    const prefix = this.getOption('prefix', '[MyPlugin]');

    // 订阅同步钩子
    manager.tap('beforeStart', (data: any) => {
      console.log(prefix, '应用启动前', data);
    });

    // 订阅异步串行钩子
    manager.tap('start', async (data: any) => {
      console.log(prefix, '应用启动中', data);
      await someAsyncOperation();
    });
  }
}
```

### 4. 注册并使用插件

```typescript
// 注册插件
manager.use(new MyPlugin({ prefix: '[App]' }));

// 调用钩子
manager.callSync('beforeStart', { mode: 'dev' });
await manager.callAsync('start', { port: 3000 });
```

## 📚 API 文档

### PluginManager

#### 方法

##### `registerHook(hookName: string, type: HookType): this`

注册一个钩子。

```typescript
manager.registerHook('myHook', 'sync');
```

##### `use(plugin: IPlugin): this`

注册一个插件。

```typescript
manager.use(new MyPlugin());
```

##### `tap<T, R>(hookName: string, callback: HookCallback<T, R>, priority?: number): this`

订阅一个钩子。

```typescript
manager.tap('myHook', (data) => {
  console.log(data);
}, 5); // 优先级 5
```

##### `callSync<T>(hookName: string, ...args: T[]): void`

调用同步钩子。

```typescript
manager.callSync('myHook', data1, data2);
```

##### `callAsync<T>(hookName: string, ...args: T[]): Promise<void>`

调用异步钩子（并行执行）。

```typescript
await manager.callAsync('myHook', data);
```

##### `callWaterfall<T>(hookName: string, initialValue: T): T`

调用瀑布流钩子（链式传递结果）。

```typescript
const result = manager.callWaterfall('transform', initialData);
```

##### `callBail<T, R>(hookName: string, ...args: T[]): R | undefined`

调用熔断钩子（有返回值则停止）。

```typescript
const result = manager.callBail('validate', data);
```

##### `setContext(key: string, value: any): this`

设置上下文数据。

```typescript
manager.setContext('userId', 123);
```

##### `getContext(): PluginContext`

获取上下文数据。

```typescript
const context = manager.getContext(); // { userId: 123 }
```

### Plugin

#### 抽象方法

##### `apply(manager: IPluginManager): void`

插件的入口方法，必须实现。

```typescript
class MyPlugin extends Plugin {
  apply(manager: IPluginManager): void {
    // 订阅钩子
  }
}
```

#### 受保护方法

##### `getOption<K extends keyof T>(key: K, defaultValue?: T[K]): T[K]`

获取插件配置。

```typescript
const value = this.getOption('maxSize', 100);
```

#### 可选方法

##### `initialize?(): void`

插件初始化钩子。

##### `destroy?(): void`

插件销毁钩子。

## 🔌 示例插件

### LoggerPlugin（日志插件）

在各个生命周期打印日志，支持日志级别配置。

```typescript
import { LoggerPlugin } from './examples/LoggerPlugin';

manager.use(new LoggerPlugin({
  logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error'
  prefix: '[App]'
}));
```

### CachePlugin（缓存插件）

提供智能缓存功能，支持 TTL 和容量限制。

```typescript
import { CachePlugin } from './examples/CachePlugin';

manager.use(new CachePlugin({
  maxSize: 100,    // 最大缓存数量
  ttl: 60000       // 缓存过期时间（毫秒）
}));
```

### ValidationPlugin（验证插件）

强大的数据验证功能，支持多种验证规则。

```typescript
import { ValidationPlugin } from './examples/ValidationPlugin';

manager.use(new ValidationPlugin({
  rules: {
    name: {
      required: true,
      type: 'string'
    },
    age: {
      required: true,
      type: 'number',
      min: 0,
      max: 150
    },
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      validator: (value) => {
        // 自定义验证逻辑
        return value.endsWith('.com') || 'Email 必须是 .com 结尾';
      }
    }
  },
  strictMode: false  // 严格模式：验证失败时抛出错误
}));
```

### TransformPlugin（转换插件）

使用 waterfall 钩子对数据进行链式转换。

```typescript
import { TransformPlugin } from './examples/TransformPlugin';

manager.use(new TransformPlugin({
  transformers: [
    (data) => ({ ...data, timestamp: Date.now() }),
    (data) => ({ ...data, processed: true })
  ],
  upperCase: true,  // 内置转换器：转大写
  trim: true        // 内置转换器：去空格
}));
```

## 🎯 完整示例

```typescript
import { PluginManager } from './src/PluginManager';
import {
  LoggerPlugin,
  CachePlugin,
  ValidationPlugin,
  TransformPlugin
} from './examples';

// 创建管理器
const manager = new PluginManager();

// 注册钩子
manager.registerHook('beforeStart', 'sync');
manager.registerHook('validate', 'bail');
manager.registerHook('transform', 'waterfall');

// 注册插件
manager
  .use(new LoggerPlugin({ logLevel: 'debug' }))
  .use(new CachePlugin({ maxSize: 50, ttl: 30000 }))
  .use(new ValidationPlugin({
    rules: {
      name: { required: true, type: 'string' },
      age: { required: true, type: 'number', min: 0, max: 150 }
    }
  }))
  .use(new TransformPlugin({
    transformers: [
      (data) => ({ ...data, timestamp: Date.now() })
    ]
  }));

// 使用
const data = { name: 'Alice', age: 25 };

// 验证数据
const validation = manager.callBail('validate', data);
if (validation?.valid) {
  // 转换数据
  const result = manager.callWaterfall('transform', data);
  console.log(result);
}
```

## 🏗️ 设计原理

### 1. 事件驱动架构

插件系统采用事件驱动架构，通过钩子（Hook）机制实现松耦合：
- 主程序定义钩子并在适当时机触发
- 插件订阅感兴趣的钩子
- 插件间通过上下文共享数据

### 2. 优先级机制

每个钩子回调都有优先级，确保插件的执行顺序：
- 优先级数字越小越先执行
- 同优先级按注册顺序执行

### 3. 类型安全

使用 TypeScript 泛型和接口：
- 编译时类型检查
- 完整的 IDE 智能提示
- 减少运行时错误

### 4. 插件隔离

每个插件都是独立的类：
- 有自己的配置和状态
- 通过 apply 方法与管理器交互
- 可以访问共享上下文

## 🔄 与 Webpack 插件系统的对比

| 特性 | 本实现 | Webpack |
|------|--------|---------|
| 核心类 | PluginManager | Compiler |
| 钩子库 | 内置实现 | Tapable |
| 插件接口 | apply(manager) | apply(compiler) |
| 钩子类型 | 4种 | 10+ 种 |
| 类型支持 | TypeScript 原生 | @types/webpack |
| 复杂度 | 简单易懂 | 功能更强大 |

## 📖 适用场景

1. **应用框架** - 为自己的框架添加插件能力
2. **构建工具** - 实现可扩展的构建流程
3. **中间件系统** - Express/Koa 风格的中间件
4. **数据处理管道** - ETL 数据转换流程
5. **测试框架** - 可扩展的测试插件
6. **CLI 工具** - 命令行工具的插件系统

## 🚀 扩展建议

### 1. 添加插件依赖管理

```typescript
class Plugin {
  static dependencies = ['PluginA', 'PluginB'];
}
```

### 2. 支持插件热重载

```typescript
manager.reload(pluginName);
```

### 3. 添加插件配置验证

```typescript
class Plugin {
  static schema = {
    maxSize: { type: 'number', required: true }
  };
}
```

### 4. 支持异步插件加载

```typescript
await manager.useAsync(async () => {
  const plugin = await import('./MyPlugin');
  return new plugin.MyPlugin();
});
```

### 5. 添加插件通信机制

```typescript
manager.emit('message', { from: 'PluginA', to: 'PluginB', data: {} });
```

## 📝 开发指南

### 创建新插件

1. 继承 Plugin 基类
2. 定义插件选项接口
3. 实现 apply 方法
4. （可选）实现 initialize 和 destroy 方法

```typescript
import { Plugin } from './src/Plugin';
import type { IPluginManager, PluginOptions } from './types';

interface MyPluginOptions extends PluginOptions {
  // 定义选项
}

export class MyPlugin extends Plugin<MyPluginOptions> {
  apply(manager: IPluginManager): void {
    // 实现插件逻辑
  }

  initialize(): void {
    // 初始化逻辑
  }

  destroy(): void {
    // 清理逻辑
  }
}
```

## 📄 License

MIT

## 🙏 总结

这个 TypeScript 插件系统提供了：
- ✅ 完整的类型安全
- ✅ 清晰的架构设计
- ✅ 灵活的钩子机制
- ✅ 完善的示例代码
- ✅ 易于理解和扩展
- ✅ 生产级别的代码质量

可以作为学习插件系统的起点，也可以直接用于实际项目中。
