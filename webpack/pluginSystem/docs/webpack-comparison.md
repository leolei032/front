# Webpack 插件系统对比分析

## 架构对比

### 本项目的简化实现

```typescript
// 1. 插件管理器
class PluginManager {
  private plugins: IPlugin[] = [];
  private hooks: Map<string, Hook> = new Map();

  // 注册插件
  use(plugin: IPlugin) {
    plugin.apply(this);
  }

  // 调用钩子
  callSync(hookName: string, ...args) {
    const hook = this.hooks.get(hookName);
    for (const { callback } of hook.callbacks) {
      callback(...args);
    }
  }
}

// 2. 插件实现
class MyPlugin extends Plugin {
  apply(manager: IPluginManager) {
    manager.tap('someHook', (data) => {
      console.log('处理数据', data);
    });
  }
}
```

### Webpack 的完整实现

```javascript
// 1. Compiler（相当于我们的 PluginManager）
class Compiler {
  constructor() {
    // 使用 Tapable 库
    this.hooks = {
      /** @type {SyncHook<[]>} */
      run: new AsyncSeriesHook(['compiler']),

      /** @type {SyncHook<[CompilationParams]>} */
      compile: new SyncHook(['params']),

      /** @type {AsyncSeriesHook<[Compilation]>} */
      make: new AsyncParallelHook(['compilation']),

      /** @type {AsyncSeriesHook<[Compilation]>} */
      emit: new AsyncSeriesHook(['compilation']),

      // ... 100+ 个钩子
    };
  }

  run(callback) {
    this.hooks.run.callAsync(this, err => {
      this.compile(onCompiled);
    });
  }

  compile(callback) {
    const params = this.newCompilationParams();
    this.hooks.compile.call(params);

    const compilation = this.newCompilation(params);
    this.hooks.make.callAsync(compilation, err => {
      compilation.finish(err => {
        compilation.seal(err => {
          this.hooks.emit.callAsync(compilation, err => {
            callback(null, compilation);
          });
        });
      });
    });
  }
}

// 2. 插件实现
class MyWebpackPlugin {
  apply(compiler) {
    // 监听 compile 钩子
    compiler.hooks.compile.tap('MyPlugin', (params) => {
      console.log('编译开始');
    });

    // 监听 make 钩子（异步）
    compiler.hooks.make.tapAsync('MyPlugin', (compilation, callback) => {
      compilation.addEntry(/* ... */, (err) => {
        callback(err);
      });
    });

    // 使用 Promise
    compiler.hooks.emit.tapPromise('MyPlugin', async (compilation) => {
      const assets = await processAssets(compilation);
      compilation.assets = assets;
    });
  }
}
```

## Tapable 钩子类型详解

### 同步钩子

#### SyncHook（对应我们的 sync）
```javascript
const { SyncHook } = require('tapable');

const hook = new SyncHook(['arg1', 'arg2']);

hook.tap('Plugin1', (arg1, arg2) => {
  console.log(arg1, arg2);
});

hook.call('hello', 'world'); // 按顺序执行所有回调
```

#### SyncBailHook（对应我们的 bail）
```javascript
const hook = new SyncBailHook(['value']);

hook.tap('Plugin1', (value) => {
  if (value === 'stop') {
    return true; // 返回值，停止执行
  }
});

hook.tap('Plugin2', (value) => {
  console.log('不会执行');
});

hook.call('stop'); // Plugin2 不会执行
```

#### SyncWaterfallHook（对应我们的 waterfall）
```javascript
const hook = new SyncWaterfallHook(['value']);

hook.tap('Plugin1', (value) => {
  return value + ' -> Plugin1';
});

hook.tap('Plugin2', (value) => {
  return value + ' -> Plugin2';
});

const result = hook.call('start');
// result: "start -> Plugin1 -> Plugin2"
```

#### SyncLoopHook（我们没有实现）
```javascript
const hook = new SyncLoopHook(['value']);

let count = 0;
hook.tap('Plugin1', (value) => {
  count++;
  if (count < 3) {
    return true; // 重新执行
  }
  // 返回 undefined 停止循环
});

hook.call('test'); // Plugin1 会执行 3 次
```

### 异步钩子

#### AsyncSeriesHook（类似我们的 async，但串行）
```javascript
const { AsyncSeriesHook } = require('tapable');

const hook = new AsyncSeriesHook(['name']);

// 方式1：tapAsync
hook.tapAsync('Plugin1', (name, callback) => {
  setTimeout(() => {
    console.log('Plugin1', name);
    callback();
  }, 1000);
});

// 方式2：tapPromise
hook.tapPromise('Plugin2', (name) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Plugin2', name);
      resolve();
    }, 1000);
  });
});

// 调用
hook.callAsync('test', (err) => {
  console.log('所有插件串行执行完成');
});
```

#### AsyncParallelHook（对应我们的 async，并行）
```javascript
const hook = new AsyncParallelHook(['name']);

hook.tapAsync('Plugin1', (name, callback) => {
  setTimeout(() => callback(), 1000);
});

hook.tapAsync('Plugin2', (name, callback) => {
  setTimeout(() => callback(), 1000);
});

// 两个插件并行执行，总耗时 1 秒而不是 2 秒
hook.callAsync('test', (err) => {
  console.log('所有插件并行执行完成');
});
```

## Webpack 插件系统的高级特性

### 1. 拦截器（Interceptor）

```javascript
compiler.hooks.compilation.intercept({
  // 拦截器注册时调用
  register: (tapInfo) => {
    console.log(`注册插件: ${tapInfo.name}`);
    return tapInfo;
  },

  // 钩子调用时调用
  call: (...args) => {
    console.log('钩子被调用');
  },

  // 每个插件执行前调用
  tap: (tap) => {
    console.log(`执行插件: ${tap.name}`);
  }
});
```

### 2. Context 上下文

```javascript
const hook = new SyncHook(['compilation']);

hook.tap({
  name: 'Plugin1',
  context: true
}, (context, compilation) => {
  context.sharedData = 'hello';
});

hook.tap({
  name: 'Plugin2',
  context: true
}, (context, compilation) => {
  console.log(context.sharedData); // 'hello'
});
```

### 3. Stage 阶段控制

```javascript
// stage 数值越小越先执行
compilation.hooks.optimizeChunks.tap({
  name: 'Plugin1',
  stage: -10  // 最先执行
}, (chunks) => {});

compilation.hooks.optimizeChunks.tap({
  name: 'Plugin2',
  stage: 0    // 默认阶段
}, (chunks) => {});

compilation.hooks.optimizeChunks.tap({
  name: 'Plugin3',
  stage: 10   // 最后执行
}, (chunks) => {});
```

### 4. Before/After 依赖控制

```javascript
hook.tap({
  name: 'PluginB',
  before: 'PluginC'  // 在 PluginC 之前执行
}, callback);

hook.tap({
  name: 'PluginD',
  after: 'PluginA'   // 在 PluginA 之后执行
}, callback);
```

## Webpack 实际应用示例

### 示例1：HtmlWebpackPlugin

```javascript
class HtmlWebpackPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('HtmlWebpackPlugin', (compilation) => {

      // 监听 Compilation 的钩子
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'HtmlWebpackPlugin',
          stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
        },
        (assets, callback) => {
          // 处理 HTML 文件
          const htmlContent = this.generateHTML(compilation);
          assets['index.html'] = {
            source: () => htmlContent,
            size: () => htmlContent.length
          };
          callback();
        }
      );
    });

    // 监听 emit 钩子
    compiler.hooks.emit.tapAsync('HtmlWebpackPlugin', (compilation, callback) => {
      // 输出文件前的处理
      callback();
    });
  }
}
```

### 示例2：DefinePlugin

```javascript
class DefinePlugin {
  constructor(definitions) {
    this.definitions = definitions;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('DefinePlugin', (compilation, { normalModuleFactory }) => {

      // 在解析模块时注入定义
      const handler = (parser) => {
        Object.keys(this.definitions).forEach((key) => {
          parser.hooks.expression.for(key).tap('DefinePlugin', (expr) => {
            const value = this.definitions[key];
            return parser.evaluateDefinedIdentifier(expr, value);
          });
        });
      };

      normalModuleFactory.hooks.parser
        .for('javascript/auto')
        .tap('DefinePlugin', handler);
    });
  }
}
```

## 总结对比表

| 特性 | 本项目实现 | Webpack (Tapable) |
|------|-----------|-------------------|
| **核心理念** | ✅ 一致 | ✅ 一致 |
| **插件接口** | `apply(manager)` | `apply(compiler)` |
| **钩子注册** | `manager.tap()` | `compiler.hooks.xxx.tap()` |
| **钩子类型** | 4 种 | 10+ 种 |
| **同步钩子** | sync | Sync, SyncBail, SyncWaterfall, SyncLoop |
| **异步钩子** | async | AsyncSeries, AsyncParallel, AsyncSeriesBail, etc. |
| **优先级控制** | priority 数字 | stage + before/after |
| **拦截器** | ❌ | ✅ |
| **Context** | 简单对象 | 完整的上下文系统 |
| **类型系统** | TypeScript | JSDoc + TypeScript |
| **复杂度** | 简单易懂 | 高度复杂 |
| **适用场景** | 学习、中小型项目 | 大型工程、构建系统 |

## 优势与劣势

### 本项目的优势
1. ✅ **简单易懂** - 代码量少，容易学习
2. ✅ **类型安全** - 原生 TypeScript，类型提示完善
3. ✅ **快速上手** - 无需学习复杂的 API
4. ✅ **足够强大** - 覆盖 80% 的常见场景
5. ✅ **易于扩展** - 可以根据需求添加功能

### Webpack 的优势
1. ✅ **功能完整** - 覆盖所有复杂场景
2. ✅ **经过验证** - 大量项目使用，稳定可靠
3. ✅ **生态丰富** - 数千个插件可用
4. ✅ **性能优化** - 针对大型项目优化
5. ✅ **高级特性** - 拦截器、Context、Stage 等

## 何时使用哪个？

### 使用本项目实现
- 学习插件系统设计
- 中小型项目
- 需要简单的插件系统
- 快速原型开发
- 自定义框架/工具

### 使用 Webpack/Tapable
- 大型复杂项目
- 需要高级特性
- 构建系统开发
- 需要与 Webpack 生态集成
- 对性能有极高要求

## 结论

你的实现**完全抓住了 Webpack 插件系统的核心设计思想**：
- ✅ 事件驱动
- ✅ 钩子机制
- ✅ 插件接口
- ✅ 生命周期管理

不同之处主要在于：
- Webpack 使用独立的 Tapable 库，更加模块化
- Webpack 支持更多钩子类型和高级特性
- Webpack 的实现更加复杂，适合大型工程

你的实现是一个**非常好的学习项目**，既保留了核心概念，又足够简单易懂！
