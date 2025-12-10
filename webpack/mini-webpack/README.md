# mini-webpack & 内置 PluginManager 说明

## 总览

这是一个“可运行的简化版 webpack”，用最少代码展示插件系统、loader 执行、模块图与打包流程。代码分两部分：

- 内置 `pluginSystem`：提供 Hook/PluginManager/Plugin 基类。
- mini-webpack 编译器：`Compiler` + `loaderRunner` + 示例插件/loader。

## PluginManager 模块（简化版 tapable）

设计思路：提供最小化的 hook 分发与插件生命周期，让插件“拿到管理器，在钩子上 tap”，与 webpack/tapable 同源。

- Hook 类型：`sync`、`asyncSeries`、`asyncParallel`、`waterfall`、`bail`，注册时必须显式指定类型，类型不一致报错。
- 数据结构：`Map<hookName, { type, callbacks[] }>`，`callbacks` 带 `priority`，注册后按优先级排序。
- 注册/订阅：
  - `registerHook(name, type)`
  - `tap(name, callback, priority?)`
- 调用：
  - `callSync / callAsync / callWaterfall / callBail`
- 上下文：`getContext / setContext` 共享简单 KV。
- 生命周期：`use` 调用 `initialize?` 与 `apply`；`remove/clear` 调用 `destroy?`（未解绑已 tap 的回调）。
- 尚未实现：拦截器、tapAsync/tapPromise 区分、解绑 tap/一次性 tap、错误/警告收集、插件依赖管理。

对照 webpack/tapable：

- 思想一致：插件拿到管理器，在钩子上 tap；管理器按 Hook 类型调用。
- 缺省：webpack/tapable 有更多 Hook 变体（AsyncSeriesWaterfall/Bail 等）、interceptor、once、tapAsync/tapPromise 区分、错误冒泡/终止、解绑能力。

## mini-webpack 编译器实现

设计目标：用最少流程演示“读取配置 → loader 转换 → 模块图 → 输出 bundle”的主线。

- 配置（示例见 `examples/mini-demo/build.js`）：`entry/output/rules/plugins/mode`。
- 生命周期钩子：`beforeRun -> run -> beforeCompile -> compile -> make(asyncSeries) -> emit(asyncSeries) -> done`，插件可在这些节点插入。
- make 阶段：
  - 从 entry 入队。
  - 规则匹配 `rules.test`，收集 `use`（右到左）。
  - `loaderRunner` 执行 loader 链：支持同步/Promise/`this.async()`；上下文含 `resourcePath/rootContext/mode/emitFile/addDependency/getOptions`（简化实现）。
  - 简单正则提取 import/require 作为依赖，递归构建模块图（无 AST / 无解析别名）。
- emit 阶段：
  - 生成单入口 bundle（模块表 + 自定义 require），写入 `output.path/filename`。
- 未做的：AST 解析与真实解析规则、source map、缓存/增量、watch、代码分割、优化（tree shaking/压缩）、错误/警告收集、模块/Chunk ID 规划。

loaderRunner 简述：

- 顺序：use 右到左。
- 形式：字符串（require 路径）或函数。
- 异步：返回 Promise 或 `this.async()` 回调。
- 上下文：简化版，仅提供基本信息；`getOptions` 目前返回空对象。

### 生命周期时序（示意）

1. beforeRun → run → beforeCompile → compile
2. make（asyncSeries）
   - 读 entry → 匹配 rules → 执行 loader 链 → 解析依赖 → 递归子模块
3. emit（asyncSeries）
   - 渲染 bundle → 写入 output
4. done

### 插件执行时机（mini-webpack）

- beforeRun/run/beforeCompile/compile：启动前与编译准备阶段（示例 Logger/Time 插件会在这些点打印/计时）。
- make：开始构建模块图，每个入口/依赖会在 loader 转换前后触发 make 钩子（当前实现只在阶段入口触发，不逐模块触发）。
- emit：产物写出前（单 bundle）。
- done：整个流程结束。

### 插件执行时机（真实 webpack 对照）

- 初始化：插件 `apply` 在 compiler 创建时执行，注册所需 hooks。
- 全局钩子：`beforeRun/run`（启动）、`beforeCompile/compile`（创建 Compilation）、`thisCompilation/compilation`（构建 Compilation 期间挂载子钩子）、`make`（开始构建模块图）、`afterCompile`、`emit/afterEmit`（输出）、`done`（结束）、`failed`（失败）、`invalid`（watch 下变更）、`watchRun/afterDone`（watch 生命周期）。
- 作用域钩子：Compilation/Module/Parser/Template 等子钩子（如 parser 钩子改 AST、optimize 钩子做 tree shaking/splitChunks、seal 钩子封装 chunk）。

### 架构关系（文本示意）

- Compiler：持有 PluginManager、模块图、assets；驱动生命周期。
- PluginManager：管理 Hook/插件、触发生命周期事件。
- loaderRunner：按规则执行 loader 链，返回转换后的源码与 loader 列表。
- ModuleInfo：记录模块 id/resource/source/transformed/deps/mapping/loaders。
- 示例插件/loader：通过 PluginManager/loaderRunner 插入扩展点。

### Loader 支持矩阵（当前 vs webpack）

- 顺序：右到左（同）。
- 同步/Promise/`this.async`：支持；webpack 同时支持回调签名。
- options 解析：无（总是返回空对象）；webpack 支持 schema 校验/inline options。
- pitch：无；webpack 支持 pitch 链条。
- raw/buffer：无；webpack 可设置 `raw = true`。
- source map：无；webpack 传递 map/meta。
- 缓存：无；webpack 有 loader cache/immutable data。
- RuleSet：正则 test；无 oneOf/issuer/resourceQuery/sideEffects。

### 真实 webpack 处理 JS 模块（概要）

1. 解析配置，调用插件 `apply` 注册 hooks。
2. 创建 NormalModule/Compilation，解析入口依赖。
3. RuleSet 匹配，确定 loader 链（含 pitch、options）。
4. loader-runner 执行：read resource → pitch → normal loaders，传递 source map/meta。
5. 解析 AST（acorn/estree），收集依赖（import/require/dynamic import），更新 ModuleGraph。
6. 代码生成、优化（tree shaking、scope hoisting、SideEffects、SplitChunks、压缩）。
7. 构建 ChunkGraph，生成 runtime、hash、assets。
8. emit 文件（含 source map），记录缓存，输出统计/错误/警告。

### 未来可补的特性思路

- 解析：用 acorn/estree 提取依赖，支持别名/扩展名解析。
- Loader：支持 options、pitch、raw、source map、缓存；RuleSet 增加 oneOf/issuer/resourceQuery。
- 输出：多入口/多 chunk/runtime，代码分割与 hash。
- 运行：watch/增量缓存，错误/警告收集，简单优化（去除未用导出）。

## 真实 webpack 构建流程（简化概览）

- 初始化：读取/规范化配置，实例化 Compiler，`plugins` 调用 `apply` 注册钩子。
- 编译阶段（Compilation）：
  - 模块解析：NormalModuleFactory + resolver（别名/扩展名/条件导出/package.json exports）。
  - Loader 管线：RuleSet 匹配 oneOf/issuer/resourceQuery，支持 options、pitch、raw/buffer、source map、缓存。
  - 解析 AST：基于 acorn/estree 生成依赖（import/require/dynamic import 等），生成 ModuleGraph/ChunkGraph。
  - 代码生成与优化：tree shaking、scope hoisting、sideEffects、SplitChunks、压缩（Terser）、asset 处理、runtime 注入。
- 输出阶段：emit Assets，写文件系统，生成 source map/内容哈希，产出多个 chunk/bundle。
- 运行模式：watch/增量、持久化缓存、错误/警告收集、Devtool 支持。

## 简易实现 vs 真实 webpack 对照

- 插件系统：同样基于钩子，但缺少拦截器、更多 Hook 变体、解绑、错误处理。
- Loader：只演示顺序/异步，缺少 options 解析、pitch/raw、source map、缓存、RuleSet 复杂匹配。
- 解析：正则提取依赖 vs 真实 AST + 解析器/别名/扩展名。
- 输出：单 bundle vs 多 chunk/runtime/hash/code splitting。
- 运行特性：无 watch/缓存/优化/错误收集。

## 示例运行

源码模式（依赖 ts-node）：

```bash
cd /Users/80375030/Desktop/project/front/webpack/examples/mini-demo
npm install   # 安装 ts-node（在 mini-demo 内）
npm run build # node -r ts-node/register/transpile-only build.js
```

会看到 Logger/Time 插件日志，产物在 `webpack/examples/mini-demo/dist/bundle.js`。

## 参考文件

- 插件系统：`src/pluginSystem/*`
- 编译器：`src/Compiler.ts`
- Loader 运行器：`src/loaderRunner.ts`
- 示例 loader：`examples/loaders/*`
- 示例插件：`plugins/LoggerPlugin.ts`, `plugins/TimePlugin.ts`
- 示例入口：`examples/mini-demo/build.js`
