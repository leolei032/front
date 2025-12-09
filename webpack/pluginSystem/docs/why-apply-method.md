# 为什么使用 apply 方法而不是 constructor？

## 设计对比

### 方案A：在 constructor 中注册（不推荐）

```typescript
class PluginWithConstructor {
  constructor(manager: IPluginManager, options: PluginOptions) {
    this.options = options;

    // ❌ 问题1: 构造函数职责不单一
    // 既要初始化配置，又要注册钩子

    // ❌ 问题2: 必须在创建时就提供 manager
    manager.tap('someHook', () => {
      // ...
    });

    // ❌ 问题3: 无法控制激活时机
    // 创建即激活
  }
}

// 使用方式
const manager = new PluginManager();
const plugin = new PluginWithConstructor(manager, options);
// 创建时就已经注册完成，无法延迟或条件激活
```

### 方案B：使用 apply 方法（推荐）✅

```typescript
class PluginWithApply extends Plugin {
  constructor(options: PluginOptions) {
    super(options);
    // ✅ 构造函数只负责初始化
    // 简单、清晰、职责单一
  }

  apply(manager: IPluginManager) {
    // ✅ apply 只负责注册钩子
    // 关注点分离
    manager.tap('someHook', () => {
      // ...
    });
  }
}

// 使用方式
const plugin = new PluginWithApply(options);
// 插件已创建，但未激活

const manager = new PluginManager();
manager.use(plugin);  // 控制激活时机
```

## 实际场景对比

### 场景1：条件激活插件

```typescript
// ❌ Constructor 方式：无法实现
class AnalyticsPlugin {
  constructor(manager: IPluginManager, options: Options) {
    // 这里已经注册了，无法根据环境条件控制
    manager.tap('trackEvent', this.track);
  }
}

// 即使在生产环境也会注册（假设我们只想在生产环境启用）
const plugin = new AnalyticsPlugin(manager, options);


// ✅ Apply 方式：灵活控制
class AnalyticsPlugin extends Plugin {
  apply(manager: IPluginManager) {
    manager.tap('trackEvent', this.track);
  }
}

const plugin = new AnalyticsPlugin(options);

// 根据环境条件决定是否激活
if (process.env.NODE_ENV === 'production') {
  manager.use(plugin);  // 只在生产环境激活
}
```

### 场景2：插件复用

```typescript
// ❌ Constructor 方式：无法复用
const manager1 = new PluginManager();
const manager2 = new PluginManager();

const plugin1 = new PluginWithConstructor(manager1, options);
const plugin2 = new PluginWithConstructor(manager2, options);
// 需要创建两个实例


// ✅ Apply 方式：同一实例可用于多个管理器
const plugin = new PluginWithApply(options);

const manager1 = new PluginManager();
const manager2 = new PluginManager();

plugin.apply(manager1);  // 用于第一个管理器
plugin.apply(manager2);  // 用于第二个管理器
```

### 场景3：测试友好

```typescript
// ❌ Constructor 方式：测试困难
describe('PluginWithConstructor', () => {
  it('should work', () => {
    // 必须创建完整的 manager 才能测试
    const manager = new PluginManager();
    const plugin = new PluginWithConstructor(manager, options);

    // 插件已经注册，难以隔离测试
  });
});


// ✅ Apply 方式：测试简单
describe('PluginWithApply', () => {
  it('should initialize correctly', () => {
    // 可以单独测试初始化逻辑
    const plugin = new PluginWithApply(options);
    expect(plugin.options).toEqual(options);
  });

  it('should register hooks', () => {
    const plugin = new PluginWithApply(options);
    const mockManager = {
      tap: jest.fn()
    };

    // 单独测试注册逻辑
    plugin.apply(mockManager as any);
    expect(mockManager.tap).toHaveBeenCalled();
  });
});
```

### 场景4：延迟加载

```typescript
// ✅ Apply 方式支持延迟加载
class Application {
  private pluginRegistry: IPlugin[] = [];

  // 注册阶段：只收集插件
  registerPlugin(plugin: IPlugin) {
    this.pluginRegistry.push(plugin);
  }

  // 启动阶段：批量激活
  async start() {
    const manager = new PluginManager();

    // 可以在这里做一些准备工作
    await this.loadConfig();
    await this.initDatabase();

    // 现在才激活所有插件
    this.pluginRegistry.forEach(plugin => {
      plugin.apply(manager);
    });
  }
}

// 使用
const app = new Application();

// 应用启动前注册插件
app.registerPlugin(new LoggerPlugin(options));
app.registerPlugin(new CachePlugin(options));
app.registerPlugin(new ValidationPlugin(options));

// 统一启动
await app.start();
```

### 场景5：插件热重载

```typescript
class PluginManager {
  private plugins: Map<string, IPlugin> = new Map();

  use(plugin: IPlugin) {
    plugin.apply(this);
    this.plugins.set(plugin.name, plugin);
  }

  // ✅ 可以实现热重载
  async reload(pluginName: string) {
    const oldPlugin = this.plugins.get(pluginName);

    if (oldPlugin?.destroy) {
      oldPlugin.destroy();
    }

    // 动态加载新版本
    const newPlugin = await import(`./plugins/${pluginName}`);
    const instance = new newPlugin.default();

    // 重新激活
    instance.apply(this);
    this.plugins.set(pluginName, instance);
  }
}
```

## 设计模式角度

### 1. 依赖注入（Dependency Injection）

```typescript
// apply 是依赖注入的体现
class Plugin {
  // 创建时不依赖外部服务
  constructor(config: Config) {
    this.config = config;
  }

  // 运行时注入依赖
  apply(manager: IPluginManager) {
    // manager 作为依赖被注入
  }
}
```

### 2. 策略模式（Strategy Pattern）

```typescript
// 插件是策略，manager 是上下文
class Context {
  private strategy: IPlugin;

  setStrategy(plugin: IPlugin) {
    this.strategy = plugin;
    plugin.apply(this.manager);
  }
}
```

### 3. 访问者模式（Visitor Pattern）

```typescript
// Plugin 是访问者，PluginManager 是被访问的对象
interface Visitable {
  accept(visitor: IPlugin): void;
}

class PluginManager implements Visitable {
  accept(visitor: IPlugin) {
    visitor.apply(this);  // 让访问者访问自己
  }
}
```

## 生命周期对比

### Constructor 方式的生命周期

```
new Plugin(manager, options)
  ├─ 初始化配置
  └─ 立即注册钩子 ❌ 无法控制
```

### Apply 方式的生命周期

```
new Plugin(options)
  └─ 只初始化配置

manager.use(plugin)
  ├─ plugin.initialize()     (可选的初始化钩子)
  ├─ plugin.apply(manager)   (注册钩子)
  └─ 记录插件

manager.remove(plugin)
  └─ plugin.destroy()        (可选的清理钩子)
```

## Webpack 的实际实现

让我们看看 Webpack 源码中的实际例子：

```javascript
// webpack/lib/Compiler.js
class Compiler {
  constructor(context) {
    // 只初始化，不激活任何插件
    this.hooks = {
      run: new AsyncSeriesHook(['compiler']),
      compile: new SyncHook(['params']),
      // ...
    };
  }

  // 在配置阶段批量激活插件
  apply(...plugins) {
    for (const plugin of plugins) {
      plugin.apply(this);
    }
  }
}

// 使用
const compiler = new Compiler(context);

// 从配置中读取插件列表
const plugins = config.plugins || [];

// 统一激活所有插件
compiler.apply(...plugins);
```

## 其他框架的类似设计

### Babel 插件

```javascript
// Babel 也使用 visitor 模式，类似 apply
module.exports = function(babel) {
  return {
    visitor: {  // 相当于 apply
      Identifier(path) {
        // 访问 AST 节点
      }
    }
  };
};
```

### Express 中间件

```javascript
// Express 虽然不叫 apply，但思想一致
class Application {
  use(middleware) {  // 相当于插件的 apply
    this.middlewares.push(middleware);
  }
}

// 创建和激活是分离的
const myMiddleware = (req, res, next) => { /* ... */ };
app.use(myMiddleware);  // 激活时机可控
```

### Vue 插件

```javascript
// Vue 插件也使用 install 方法（类似 apply）
const MyPlugin = {
  install(app, options) {  // 相当于 apply
    app.config.globalProperties.$myMethod = () => {}
  }
};

// 使用
const plugin = MyPlugin;
app.use(plugin, options);  // 控制激活时机
```

## 总结

使用 `apply` 方法而不是 constructor 的核心原因：

| 方面 | Constructor | Apply |
|------|-------------|-------|
| **职责分离** | ❌ 混合初始化和注册 | ✅ 清晰分离 |
| **激活控制** | ❌ 创建即激活 | ✅ 可控制时机 |
| **插件复用** | ❌ 难以复用 | ✅ 可重复使用 |
| **测试友好** | ❌ 必须完整环境 | ✅ 可独立测试 |
| **延迟加载** | ❌ 不支持 | ✅ 完全支持 |
| **生命周期** | ❌ 不清晰 | ✅ 清晰明确 |
| **依赖注入** | ❌ 耦合严重 | ✅ 松耦合 |

**最佳实践**：
- Constructor：初始化配置和状态
- Apply：注册钩子和订阅事件
- Initialize：可选的初始化钩子
- Destroy：可选的清理钩子
