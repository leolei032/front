# Webpack构建工具

## 1. Webpack是什么？loader和plugin有什么区别？
**问题：** Webpack是什么？loader和plugin有什么区别？

### 解答

#### Webpack是什么
Webpack是一个现代JavaScript应用程序的**静态模块打包工具**。它会递归地构建一个依赖关系图，将项目需要的每个模块打包成一个或多个bundle。

#### 核心概念
```javascript
module.exports = {
  // 入口
  entry: './src/index.js',

  // 输出
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js'
  },

  // 模块规则（loader）
  module: {
    rules: [
      { test: /\.js$/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] }
    ]
  },

  // 插件（plugin）
  plugins: [
    new HtmlWebpackPlugin(),
    new MiniCssExtractPlugin()
  ],

  // 模式
  mode: 'production'
};
```

#### Loader
**定义：** Loader用于转换某些类型的模块，它是一个转换器。

**特点：**
- 在module.rules中配置
- 作用于文件层面
- 链式调用，从右到左执行
- 只能做文件转换

**常用Loader：**
```javascript
module.exports = {
  module: {
    rules: [
      // JS/JSX转换
      {
        test: /\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },

      // CSS处理
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      },

      // SCSS处理
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },

      // 图片处理
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource'
      },

      // 字体处理
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource'
      },

      // TS处理
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      },

      // Vue处理
      {
        test: /\.vue$/,
        use: 'vue-loader'
      }
    ]
  }
};
```

#### Plugin
**定义：** Plugin用于扩展Webpack功能，它是一个扩展器。

**特点：**
- 在plugins数组中配置
- 作用于整个构建过程
- 可以监听Webpack生命周期事件
- 功能更强大，可以做任何事情

**常用Plugin：**
```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  plugins: [
    // 生成HTML文件
    new HtmlWebpackPlugin({
      template: './src/index.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true
      }
    }),

    // 提取CSS到单独文件
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    }),

    // 清理输出目录
    new CleanWebpackPlugin(),

    // 复制静态文件
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: 'public' }
      ]
    }),

    // 定义环境变量
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),

    // 热更新
    new webpack.HotModuleReplacementPlugin()
  ]
};
```

#### Loader vs Plugin

| 特性 | Loader | Plugin |
|-----|--------|--------|
| 作用 | 文件转换 | 功能扩展 |
| 配置位置 | module.rules | plugins数组 |
| 执行时机 | 加载模块时 | 整个构建过程 |
| 能力范围 | 有限 | 强大 |
| 示例 | babel-loader, css-loader | HtmlWebpackPlugin, CleanWebpackPlugin |

#### 自定义Loader
```javascript
// my-loader.js
module.exports = function(source) {
  // source是文件内容
  const result = source.replace(/console\.log/g, '');
  return result;
};

// 使用
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: './my-loader.js'
      }
    ]
  }
};
```

#### 自定义Plugin
```javascript
// my-plugin.js
class MyPlugin {
  apply(compiler) {
    // 监听emit事件（生成资源到output目录之前）
    compiler.hooks.emit.tap('MyPlugin', (compilation) => {
      console.log('Webpack构建过程开始！');

      // 遍历所有生成的资源
      for (const filename in compilation.assets) {
        console.log(filename);
      }
    });

    // 监听done事件（完成编译）
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('Webpack构建完成！');
    });
  }
}

module.exports = MyPlugin;

// 使用
const MyPlugin = require('./my-plugin');

module.exports = {
  plugins: [
    new MyPlugin()
  ]
};
```

## 2. Webpack HMR的原理是什么？
**问题：** Webpack HMR（热模块替换）的原理是什么？

### 解答

#### HMR（Hot Module Replacement）
**定义：** 在应用运行时，无需刷新页面即可替换、添加或删除模块。

#### HMR工作流程

```
1. Webpack Compiler（编译器）
   ↓ 编译
2. Bundle Server（本地服务器）
   ↓ 提供文件访问
3. HMR Server（HMR服务器）
   ↓ WebSocket连接
4. HMR Runtime（浏览器）
   ↓ 更新模块
5. App（应用程序）
```

#### 详细原理

**1. 初始化**
```javascript
// webpack.config.js
module.exports = {
  devServer: {
    hot: true,  // 开启HMR
    port: 3000
  }
};
```

**2. 建立WebSocket连接**
```javascript
// Webpack Dev Server启动后
// 浏览器与服务器建立WebSocket连接
const socket = new WebSocket('ws://localhost:3000');
```

**3. 文件变化监听**
```javascript
// Webpack监听文件变化
compiler.watch({}, (err, stats) => {
  // 文件变化时触发重新编译
});
```

**4. 编译生成更新清单**
```javascript
// 生成两个文件：
// 1. manifest.json - 包含本次更新的模块列表
{
  "h": "abc123",  // hash
  "c": {
    "main": true
  }
}

// 2. chunk.js - 更新的模块代码
webpackHotUpdate("main", {
  "./src/index.js": function(module, exports, __webpack_require__) {
    // 更新的代码
  }
});
```

**5. 推送更新通知**
```javascript
// 服务器通过WebSocket推送更新消息
socket.send(JSON.stringify({
  type: 'hash',
  data: 'abc123'
}));

socket.send(JSON.stringify({
  type: 'ok'
}));
```

**6. 浏览器拉取更新**
```javascript
// HMR Runtime接收到更新通知
// 通过JSONP方式拉取更新清单和模块代码
fetch('/abc123.hot-update.json')
  .then(res => res.json())
  .then(manifest => {
    // 加载更新的模块
    const script = document.createElement('script');
    script.src = `/main.abc123.hot-update.js`;
    document.head.appendChild(script);
  });
```

**7. 应用更新**
```javascript
// HMR Runtime比对差异，决定是否更新
if (module.hot) {
  module.hot.accept('./component.js', function() {
    // 模块更新回调
    render();
  });
}
```

#### HMR配置

**基础配置**
```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  devServer: {
    hot: true,
    hotOnly: true  // 构建失败时不刷新页面
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ]
};
```

**代码中使用**
```javascript
// React组件
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const render = () => {
  ReactDOM.render(<App />, document.getElementById('root'));
};

render();

// HMR
if (module.hot) {
  module.hot.accept('./App', () => {
    render();
  });
}
```

**Vue自动支持**
```javascript
// vue-loader已内置HMR支持
// 无需手动配置
import App from './App.vue';
```

#### HMR优点
- 保留应用状态
- 节省调试时间
- 即时更新样式
- 提升开发体验

#### HMR注意事项
- 仅在开发环境使用
- 需要框架/库支持
- CSS天然支持（通过style-loader）
- JS需要手动accept或使用框架loader

## 3. Webpack的loader和plugin有什么区别？
（此问题与第1题重复，已在上面回答）

## 4. 如何编写Webpack插件？
**问题：** 如何编写Webpack插件？

### 解答

#### Plugin基本结构
```javascript
class MyWebpackPlugin {
  // 构造函数接收options
  constructor(options) {
    this.options = options;
  }

  // 必须提供apply方法
  apply(compiler) {
    // compiler是webpack实例
    // 包含webpack环境的所有配置信息
  }
}

module.exports = MyWebpackPlugin;
```

#### 使用Webpack Hooks

```javascript
class MyPlugin {
  apply(compiler) {
    // 1. 同步Hook - tap
    compiler.hooks.compile.tap('MyPlugin', (params) => {
      console.log('开始编译');
    });

    // 2. 异步Hook - tapAsync
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
      console.log('生成文件');
      setTimeout(() => {
        callback();
      }, 1000);
    });

    // 3. 异步Hook - tapPromise
    compiler.hooks.emit.tapPromise('MyPlugin', (compilation) => {
      return new Promise((resolve) => {
        console.log('生成文件');
        setTimeout(resolve, 1000);
      });
    });
  }
}
```

#### 常用Hooks

**Compiler Hooks**
```javascript
class MyPlugin {
  apply(compiler) {
    // 开始编译
    compiler.hooks.compile.tap('MyPlugin', () => {});

    // 编译完成
    compiler.hooks.done.tap('MyPlugin', (stats) => {});

    // 生成资源到output目录之前
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
      callback();
    });

    // 生成资源到output目录之后
    compiler.hooks.afterEmit.tap('MyPlugin', (compilation) => {});

    // 失败
    compiler.hooks.failed.tap('MyPlugin', (error) => {});
  }
}
```

**Compilation Hooks**
```javascript
class MyPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      // 优化资源
      compilation.hooks.optimizeAssets.tap('MyPlugin', (assets) => {
        // 处理assets
      });

      // 额外的资源处理
      compilation.hooks.additionalAssets.tap('MyPlugin', () => {
        // 添加额外资源
      });
    });
  }
}
```

#### 实战示例

**1. 生成文件列表插件**
```javascript
class FileListPlugin {
  constructor(options) {
    this.filename = options.filename || 'filelist.md';
  }

  apply(compiler) {
    compiler.hooks.emit.tap('FileListPlugin', (compilation) => {
      // 获取所有生成的文件
      const filelist = Object.keys(compilation.assets)
        .map(filename => `- ${filename}`)
        .join('\n');

      const content = `# 文件列表\n\n${filelist}`;

      // 添加新文件到输出
      compilation.assets[this.filename] = {
        source: () => content,
        size: () => content.length
      };
    });
  }
}

// 使用
module.exports = {
  plugins: [
    new FileListPlugin({ filename: 'assets.md' })
  ]
};
```

**2. 压缩图片插件**
```javascript
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

class ImageminPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('ImageminPlugin', (compilation, callback) => {
      const promises = [];

      // 遍历所有资源
      Object.keys(compilation.assets).forEach(filename => {
        if (/\.(png|jpe?g|gif)$/.test(filename)) {
          const asset = compilation.assets[filename];
          const source = asset.source();

          const promise = imagemin.buffer(source, {
            plugins: [imageminPngquant({ quality: [0.6, 0.8] })]
          }).then(buffer => {
            // 更新资源
            compilation.assets[filename] = {
              source: () => buffer,
              size: () => buffer.length
            };
          });

          promises.push(promise);
        }
      });

      Promise.all(promises).then(() => callback());
    });
  }
}
```

**3. 自动上传CDN插件**
```javascript
class UploadCDNPlugin {
  constructor(options) {
    this.cdn = options.cdn;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('UploadCDNPlugin', (compilation, callback) => {
      const assets = Object.keys(compilation.assets);

      const uploadPromises = assets.map(filename => {
        const filePath = path.join(compilation.outputOptions.path, filename);
        return this.upload(filePath, filename);
      });

      Promise.all(uploadPromises)
        .then(() => {
          console.log('上传完成');
          callback();
        })
        .catch(callback);
    });
  }

  upload(filePath, filename) {
    // 上传到CDN的逻辑
    return fetch(`${this.cdn}/upload`, {
      method: 'POST',
      body: fs.createReadStream(filePath)
    });
  }
}
```

**4. 打包进度插件**
```javascript
class ProgressPlugin {
  apply(compiler) {
    let lastPercent = 0;

    compiler.hooks.compilation.tap('ProgressPlugin', (compilation) => {
      compilation.hooks.buildModule.tap('ProgressPlugin', () => {
        const percent = Math.round(
          (compilation.modules.size / compilation.entries.length) * 100
        );

        if (percent > lastPercent) {
          lastPercent = percent;
          console.log(`构建进度: ${percent}%`);
        }
      });
    });

    compiler.hooks.done.tap('ProgressPlugin', () => {
      console.log('构建完成: 100%');
    });
  }
}
```

#### Plugin开发技巧

**1. 访问Compilation对象**
```javascript
compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
  // compilation包含当前构建的所有信息
  console.log(compilation.modules);  // 所有模块
  console.log(compilation.chunks);   // 所有chunk
  console.log(compilation.assets);   // 所有资源
});
```

**2. 修改输出资源**
```javascript
compilation.assets['new-file.txt'] = {
  source: () => 'content',
  size: () => 'content'.length
};
```

**3. 添加依赖**
```javascript
compilation.fileDependencies.add(filePath);
```

**4. 报告错误**
```javascript
compilation.errors.push(new Error('Something went wrong'));
compilation.warnings.push(new Error('Warning message'));
```

**5. 判断环境**
```javascript
const isProduction = compiler.options.mode === 'production';
```

## 5. Babel的原理是什么？
**问题：** Babel的原理是什么？深入解析其编译流程和核心机制。

### 解答

#### Babel编译三阶段

Babel是一个JavaScript编译器，将ES6+代码转换为向后兼容的JavaScript版本。编译过程分为三个核心阶段：

```
源代码 → Parse(解析) → Transform(转换) → Generate(生成) → 目标代码
```

**1. Parse（解析阶段）**
```javascript
// 词法分析（Lexical Analysis）
// 源代码: const add = (a, b) => a + b;
// Token流:
[
  { type: 'Keyword', value: 'const' },
  { type: 'Identifier', value: 'add' },
  { type: 'Punctuator', value: '=' },
  { type: 'Punctuator', value: '(' },
  { type: 'Identifier', value: 'a' },
  { type: 'Punctuator', value: ',' },
  { type: 'Identifier', value: 'b' },
  { type: 'Punctuator', value: ')' },
  { type: 'Punctuator', value: '=>' },
  // ...
]

// 语法分析（Syntactic Analysis）
// 生成AST（抽象语法树）
{
  "type": "Program",
  "body": [
    {
      "type": "VariableDeclaration",
      "kind": "const",
      "declarations": [
        {
          "type": "VariableDeclarator",
          "id": { "type": "Identifier", "name": "add" },
          "init": {
            "type": "ArrowFunctionExpression",
            "params": [
              { "type": "Identifier", "name": "a" },
              { "type": "Identifier", "name": "b" }
            ],
            "body": {
              "type": "BinaryExpression",
              "operator": "+",
              "left": { "type": "Identifier", "name": "a" },
              "right": { "type": "Identifier", "name": "b" }
            }
          }
        }
      ]
    }
  ]
}
```

**2. Transform（转换阶段）**
```javascript
// Babel使用访问者模式遍历和修改AST
const visitor = {
  // 访问箭头函数节点
  ArrowFunctionExpression(path) {
    // 获取箭头函数的参数和函数体
    const { params, body } = path.node;

    // 创建普通函数表达式节点
    const functionExpression = {
      type: 'FunctionExpression',
      params: params,
      body: body.type === 'BlockStatement'
        ? body
        : {
            type: 'BlockStatement',
            body: [{ type: 'ReturnStatement', argument: body }]
          }
    };

    // 替换节点
    path.replaceWith(functionExpression);
  },

  // 访问const/let声明
  VariableDeclaration(path) {
    if (path.node.kind === 'const' || path.node.kind === 'let') {
      path.node.kind = 'var';
    }
  }
};
```

**3. Generate（生成阶段）**
```javascript
// 将转换后的AST生成代码
// 转换后的AST → 目标代码
var add = function(a, b) {
  return a + b;
};
```

#### Babel核心包

**@babel/parser (Babylon)**
```javascript
const parser = require('@babel/parser');

const code = `const fn = () => console.log('hello');`;
const ast = parser.parse(code, {
  sourceType: 'module',  // 'script' | 'module' | 'unambiguous'
  plugins: ['jsx', 'typescript']  // 语法插件
});
```

**@babel/traverse**
```javascript
const traverse = require('@babel/traverse').default;

traverse(ast, {
  enter(path) {
    // 进入节点时调用
    console.log('Entering:', path.node.type);
  },
  exit(path) {
    // 离开节点时调用
    console.log('Exiting:', path.node.type);
  },

  // 针对特定节点类型
  ArrowFunctionExpression(path) {
    console.log('Found arrow function');
  }
});
```

**@babel/generator**
```javascript
const generate = require('@babel/generator').default;

const output = generate(ast, {
  comments: true,      // 保留注释
  compact: false,      // 紧凑模式
  minified: false,     // 压缩
  sourceMaps: true     // 生成source map
}, code);

console.log(output.code);
console.log(output.map);
```

**@babel/types**
```javascript
const t = require('@babel/types');

// 创建节点
const identifier = t.identifier('myVar');
const stringLiteral = t.stringLiteral('hello');
const functionDeclaration = t.functionDeclaration(
  t.identifier('myFunc'),
  [t.identifier('param')],
  t.blockStatement([
    t.returnStatement(t.identifier('param'))
  ])
);

// 判断节点类型
if (t.isIdentifier(node)) {
  console.log('This is an identifier');
}

// 断言节点类型（不匹配会抛错）
t.assertIdentifier(node);
```

#### 编写Babel插件

**基础插件结构**
```javascript
// babel-plugin-transform-arrow-function.js
module.exports = function(babel) {
  const { types: t } = babel;

  return {
    name: 'transform-arrow-function',
    visitor: {
      ArrowFunctionExpression(path) {
        // 如果箭头函数使用了this，需要绑定this
        const hasThis = hasThisExpression(path);

        // 获取函数参数和函数体
        let body = path.node.body;

        // 如果函数体不是块语句，需要包装
        if (!t.isBlockStatement(body)) {
          body = t.blockStatement([
            t.returnStatement(body)
          ]);
        }

        // 创建函数表达式
        const functionExpression = t.functionExpression(
          null,
          path.node.params,
          body,
          path.node.generator,
          path.node.async
        );

        // 如果使用了this，需要调用bind
        if (hasThis) {
          const callExpression = t.callExpression(
            t.memberExpression(functionExpression, t.identifier('bind')),
            [t.thisExpression()]
          );
          path.replaceWith(callExpression);
        } else {
          path.replaceWith(functionExpression);
        }
      }
    }
  };
};

function hasThisExpression(path) {
  let hasThis = false;
  path.traverse({
    ThisExpression() {
      hasThis = true;
    }
  });
  return hasThis;
}
```

**实战插件：自动埋点**
```javascript
// babel-plugin-auto-tracking.js
module.exports = function({ types: t }) {
  return {
    name: 'auto-tracking',
    visitor: {
      // 为所有函数自动添加追踪代码
      FunctionDeclaration(path) {
        const functionName = path.node.id.name;

        // 创建追踪调用
        const trackingCall = t.expressionStatement(
          t.callExpression(
            t.identifier('__track__'),
            [t.stringLiteral(functionName)]
          )
        );

        // 插入到函数体开头
        path.node.body.body.unshift(trackingCall);
      },

      // 为点击事件自动添加埋点
      JSXAttribute(path) {
        if (path.node.name.name === 'onClick') {
          const originalHandler = path.node.value.expression;

          // 包装原始处理函数
          const wrappedHandler = t.arrowFunctionExpression(
            [t.identifier('e')],
            t.blockStatement([
              // 调用埋点
              t.expressionStatement(
                t.callExpression(
                  t.identifier('trackClick'),
                  [t.stringLiteral('button_click')]
                )
              ),
              // 调用原始处理函数
              t.expressionStatement(
                t.callExpression(originalHandler, [t.identifier('e')])
              )
            ])
          );

          path.node.value = t.jsxExpressionContainer(wrappedHandler);
        }
      }
    }
  };
};

// 转换前:
// function fetchData() { ... }
// <button onClick={handleClick}>Click</button>

// 转换后:
// function fetchData() {
//   __track__('fetchData');
//   ...
// }
// <button onClick={(e) => {
//   trackClick('button_click');
//   handleClick(e);
// }}>Click</button>
```

**按需加载插件**
```javascript
// babel-plugin-import.js
// 实现类似 import { Button } from 'antd' → import Button from 'antd/lib/button'
module.exports = function({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(path, state) {
        const { node } = path;
        const { value } = node.source;
        const { libraryName, libraryDirectory = 'lib' } = state.opts;

        // 只处理目标库的导入
        if (value !== libraryName) return;

        // 只处理命名导入
        const specifiers = node.specifiers.filter(spec =>
          t.isImportSpecifier(spec)
        );

        if (!specifiers.length) return;

        // 为每个导入创建单独的import语句
        const newImports = specifiers.map(spec => {
          const importName = spec.imported.name;
          const localName = spec.local.name;

          return t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier(localName))],
            t.stringLiteral(
              `${libraryName}/${libraryDirectory}/${importName.toLowerCase()}`
            )
          );
        });

        // 替换原导入语句
        path.replaceWithMultiple(newImports);
      }
    }
  };
};

// .babelrc配置
{
  "plugins": [
    ["import", {
      "libraryName": "antd",
      "libraryDirectory": "lib"
    }]
  ]
}
```

#### Babel配置深度解析

**预设（Presets）**
```javascript
// .babelrc
{
  "presets": [
    ["@babel/preset-env", {
      // 目标环境
      "targets": {
        "browsers": ["> 1%", "last 2 versions", "not ie <= 8"],
        "node": "current"
      },

      // 模块转换方式
      "modules": false,  // 保留ES6模块语法，交给webpack处理

      // 按需引入polyfill
      "useBuiltIns": "usage",  // 'usage' | 'entry' | false
      "corejs": 3,

      // 启用所有处于stage 3的特性
      "shippedProposals": true,

      // 调试信息
      "debug": true
    }],

    "@babel/preset-react",
    "@babel/preset-typescript"
  ],

  "plugins": [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread"
  ]
}
```

**Polyfill策略**
```javascript
// 1. 全量引入（不推荐）
import '@babel/polyfill';

// 2. 按需引入 - useBuiltIns: 'entry'
import 'core-js/stable';
import 'regenerator-runtime/runtime';

// 3. 自动按需引入 - useBuiltIns: 'usage'
// Babel自动根据代码使用情况注入polyfill
// 源码
const promise = Promise.resolve();
[1, 2, 3].includes(2);

// 编译后自动添加
import "core-js/modules/es.promise";
import "core-js/modules/es.array.includes";
const promise = Promise.resolve();
[1, 2, 3].includes(2);

// 4. 使用@babel/plugin-transform-runtime（库开发推荐）
{
  "plugins": [
    ["@babel/plugin-transform-runtime", {
      "corejs": 3,
      "helpers": true,
      "regenerator": true
    }]
  ]
}
```

#### 性能优化

**缓存策略**
```javascript
// webpack配置
module.exports = {
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            // 开启缓存
            cacheDirectory: true,
            cacheCompression: false,  // 不压缩缓存

            // 自定义缓存目录
            cacheDirectory: './node_modules/.cache/babel-loader'
          }
        }
      }
    ]
  }
};

// 缓存效果对比
// 首次编译：15s
// 二次编译（有缓存）：2s
// 性能提升：7.5倍
```

**并行编译**
```javascript
// 使用thread-loader
module.exports = {
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: [
          {
            loader: 'thread-loader',
            options: {
              workers: require('os').cpus().length - 1
            }
          },
          'babel-loader'
        ]
      }
    ]
  }
};
```

## 6. Webpack 5有哪些新特性？
**问题：** Webpack 5相比4.x版本有哪些重要新特性和改进？

### 解答

#### 1. 持久化缓存（Persistent Caching）

Webpack 5最重要的特性之一，极大提升构建性能。

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',  // 'memory' | 'filesystem'

    // 缓存配置
    cacheDirectory: path.resolve(__dirname, '.temp_cache'),

    // 缓存版本
    version: '1.0',

    // 缓存存储
    store: 'pack',  // 'pack' | 'idle'

    // 额外的缓存依赖
    buildDependencies: {
      config: [__filename],
      tsconfig: [path.resolve(__dirname, 'tsconfig.json')]
    },

    // 缓存失效时间
    idleTimeout: 60000,
    idleTimeoutForInitialStore: 0,

    // 缓存压缩
    compression: 'gzip'  // false | 'gzip' | 'brotli'
  }
};

// 性能对比数据
// 首次构建: 45s
// 二次构建（有缓存）: 3s
// 性能提升: 15倍
```

**缓存原理**
```javascript
// Webpack内部实现（简化版）
class FileSystemCache {
  constructor(options) {
    this.cacheLocation = options.cacheDirectory;
    this.version = options.version;
  }

  async store(identifier, data) {
    const cacheFile = this.getCacheFile(identifier);
    const content = {
      version: this.version,
      buildDependencies: this.getBuildDeps(),
      data: data
    };
    await fs.writeFile(cacheFile, serialize(content));
  }

  async load(identifier) {
    const cacheFile = this.getCacheFile(identifier);
    if (!fs.existsSync(cacheFile)) return null;

    const content = deserialize(await fs.readFile(cacheFile));

    // 验证缓存有效性
    if (content.version !== this.version) return null;
    if (this.buildDepsChanged(content.buildDependencies)) return null;

    return content.data;
  }
}
```

#### 2. 模块联邦（Module Federation）

革命性的特性，允许多个独立构建的应用共享模块。

```javascript
// 应用A（提供者）- webpack.config.js
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_a',
      filename: 'remoteEntry.js',

      // 暴露的模块
      exposes: {
        './Button': './src/components/Button',
        './Header': './src/components/Header',
        './utils': './src/utils'
      },

      // 共享依赖
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' }
      }
    })
  ]
};

// 应用B（消费者）- webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_b',

      // 远程模块配置
      remotes: {
        app_a: 'app_a@http://localhost:3001/remoteEntry.js'
      },

      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    })
  ]
};

// 应用B中使用应用A的组件
import React, { lazy, Suspense } from 'react';

// 动态导入远程组件
const RemoteButton = lazy(() => import('app_a/Button'));
const RemoteHeader = lazy(() => import('app_a/Header'));

function App() {
  return (
    <div>
      <Suspense fallback="Loading...">
        <RemoteHeader />
        <RemoteButton />
      </Suspense>
    </div>
  );
}
```

**实际应用场景**
```javascript
// 微前端架构
// 主应用（Shell）
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // 用户中心微应用
        user: 'user@http://localhost:3001/remoteEntry.js',
        // 订单微应用
        order: 'order@http://localhost:3002/remoteEntry.js',
        // 商品微应用
        product: 'product@http://localhost:3003/remoteEntry.js'
      },
      shared: {
        react: { singleton: true, eager: true },
        'react-dom': { singleton: true, eager: true },
        'react-router-dom': { singleton: true }
      }
    })
  ]
};

// 路由配置
import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const UserApp = lazy(() => import('user/App'));
const OrderApp = lazy(() => import('order/App'));
const ProductApp = lazy(() => import('product/App'));

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/user/*" element={<UserApp />} />
        <Route path="/order/*" element={<OrderApp />} />
        <Route path="/product/*" element={<ProductApp />} />
      </Routes>
    </BrowserRouter>
  );
}
```

#### 3. 资源模块（Asset Modules）

不再需要file-loader、url-loader、raw-loader。

```javascript
// Webpack 4 (旧方式)
module.exports = {
  module: {
    rules: [
      { test: /\.png$/, use: 'file-loader' },
      { test: /\.svg$/, use: 'url-loader' },
      { test: /\.txt$/, use: 'raw-loader' }
    ]
  }
};

// Webpack 5 (新方式)
module.exports = {
  module: {
    rules: [
      {
        test: /\.png$/,
        type: 'asset/resource',  // 相当于file-loader
        generator: {
          filename: 'images/[hash][ext][query]'
        }
      },
      {
        test: /\.svg$/,
        type: 'asset/inline'  // 相当于url-loader（总是内联）
      },
      {
        test: /\.txt$/,
        type: 'asset/source'  // 相当于raw-loader
      },
      {
        test: /\.jpg$/,
        type: 'asset',  // 自动选择（根据大小）
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024  // 8KB以下内联，以上使用资源文件
          }
        }
      }
    ]
  },

  output: {
    assetModuleFilename: 'assets/[hash][ext][query]'
  }
};
```

**资源处理优化**
```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024
          }
        },
        generator: {
          filename: (pathData) => {
            // 根据目录结构生成文件名
            const dir = path.dirname(pathData.filename).split('/').pop();
            return `images/${dir}/[name].[hash:8][ext]`;
          }
        }
      }
    ]
  },

  // 实验性特性：CSS资源
  experiments: {
    css: true
  }
};
```

#### 4. Tree Shaking改进

更强大的无用代码消除能力。

```javascript
// package.json
{
  "name": "my-library",
  "sideEffects": false,  // 标记为无副作用
  // 或者指定有副作用的文件
  "sideEffects": [
    "*.css",
    "*.scss",
    "src/polyfills.js"
  ]
}

// Webpack 5支持更精细的tree shaking
// 源码
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export const PI = 3.14159;

// 使用
import { add } from './math';
console.log(add(1, 2));

// Webpack 5会完全移除未使用的subtract和PI

// 嵌套的tree shaking
import { lodash } from 'lodash-es';
const result = lodash.chunk([1, 2, 3, 4], 2);
// Webpack 5只打包lodash.chunk，不打包整个lodash
```

**开发配置优化**
```javascript
module.exports = {
  optimization: {
    usedExports: true,  // 标记使用的导出
    minimize: true,     // 生产环境压缩

    // 新增：内部模块拼接
    concatenateModules: true,

    // 新增：更好的tree shaking
    innerGraph: true,

    // 副作用标记
    sideEffects: true,

    // 代码分割优化
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      minRemainingSize: 0,
      maxSize: 244000,

      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  }
};
```

#### 5. 更好的性能

**构建性能提升**
```javascript
// 1. 更快的构建速度
// Webpack 4: 45s
// Webpack 5: 28s (首次)，3s (缓存后)

// 2. 更小的bundle体积
module.exports = {
  optimization: {
    // 新的chunk id算法
    chunkIds: 'deterministic',  // 确定性的chunk id
    moduleIds: 'deterministic',  // 确定性的module id

    // 真正的内容hash
    realContentHash: true
  },

  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js'
  }
};

// 3. 更好的长期缓存
// Webpack 5的contenthash只在内容变化时才变化
// Webpack 4可能因为module id变化导致hash变化
```

**运行时性能**
```javascript
// 更小的运行时代码
// Webpack 4运行时: ~2KB
// Webpack 5运行时: ~1KB (50%减少)

// 支持top-level await
// webpack.config.js
module.exports = {
  experiments: {
    topLevelAwait: true
  }
};

// 代码中可以直接使用
const data = await fetch('/api/data');
export default data;
```

#### 6. 其他重要特性

**移除Node.js Polyfills**
```javascript
// Webpack 4自动注入Node.js polyfills
// Webpack 5需要手动配置

module.exports = {
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "path": require.resolve("path-browserify"),
      "buffer": require.resolve("buffer/")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
};
```

**更好的开发体验**
```javascript
module.exports = {
  // 更快的增量编译
  snapshot: {
    managedPaths: [path.resolve(__dirname, 'node_modules')],
    immutablePaths: [],
    buildDependencies: {
      hash: true,
      timestamp: true
    }
  },

  // 开发服务器配置
  devServer: {
    // Webpack 5使用webpack-dev-server 4.x
    static: {
      directory: path.join(__dirname, 'public')
    },
    compress: true,
    hot: true,
    // 新增：热更新覆盖率
    client: {
      overlay: {
        errors: true,
        warnings: false
      },
      progress: true
    }
  }
};
```

**JSON模块改进**
```javascript
// 支持命名导出
// data.json
{
  "name": "John",
  "age": 30
}

// 使用
import { name, age } from './data.json';
console.log(name, age);

// Tree shaking JSON
// Webpack 5会移除未使用的JSON属性
```

#### 迁移指南

```javascript
// 1. 升级依赖
{
  "devDependencies": {
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0",
    "webpack-dev-server": "^4.0.0"
  }
}

// 2. 更新配置
module.exports = {
  // target不再需要指定默认值
  // Webpack 5会根据browserslist自动推断

  // 启用缓存
  cache: {
    type: 'filesystem'
  },

  // 更新output
  output: {
    // Webpack 4: path.join(__dirname, 'dist')
    // Webpack 5: path.resolve(__dirname, 'dist')
    path: path.resolve(__dirname, 'dist'),

    // 清理输出目录
    clean: true  // 替代CleanWebpackPlugin
  },

  // 移除过时的loader
  module: {
    rules: [
      {
        test: /\.(png|jpg)$/,
        type: 'asset/resource'  // 不再使用file-loader
      }
    ]
  }
};
```

## 7. Webpack中Loader的实现原理
**问题：** Webpack中loader的实现原理和开发方法是什么？

### 解答

#### Loader本质

Loader本质上是一个函数，接收源代码字符串，返回转换后的代码字符串。

```javascript
// 最简单的loader
module.exports = function(source) {
  // source是文件内容字符串
  return source;
};
```

#### Loader执行流程

```
文件内容 → Loader1 → Loader2 → Loader3 → 处理后内容
```

**链式调用**
```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader']
        // 执行顺序：sass-loader → postcss-loader → css-loader → style-loader
        // 从右到左，从下到上
      }
    ]
  }
};

// 为什么从右到左？
// 函数式编程的compose: compose(f, g, h)(x) = f(g(h(x)))
```

#### Loader开发指南

**1. 基础Loader**
```javascript
// replace-loader.js
module.exports = function(source) {
  // this是loader上下文对象
  const options = this.getOptions();  // 获取loader配置

  // 替换内容
  const result = source.replace(/console\.log/g, options.replacement || '');

  return result;
};

// 使用
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: path.resolve(__dirname, 'loaders/replace-loader.js'),
          options: {
            replacement: 'logger.log'
          }
        }
      }
    ]
  }
};
```

**2. 异步Loader**
```javascript
// async-loader.js
module.exports = function(source) {
  // 告诉webpack这是异步loader
  const callback = this.async();

  setTimeout(() => {
    const result = source.toUpperCase();

    // callback(err, content, sourceMap, meta)
    callback(null, result, null, null);
  }, 1000);
};
```

**3. Pitch Loader**
```javascript
// 正常loader从右到左执行
// pitch方法从左到右执行

// loader1.js
module.exports = function(source) {
  console.log('loader1 normal');
  return source;
};

module.exports.pitch = function(remainingRequest, precedingRequest, data) {
  console.log('loader1 pitch');
  data.value = 'shared data';  // 共享数据
};

// loader2.js
module.exports = function(source) {
  console.log('loader2 normal');
  console.log('Shared data:', this.data.value);
  return source;
};

module.exports.pitch = function() {
  console.log('loader2 pitch');
};

// 执行顺序：
// loader1 pitch → loader2 pitch → loader2 normal → loader1 normal
```

**4. Raw Loader（处理二进制文件）**
```javascript
// image-loader.js
module.exports = function(source) {
  // source是Buffer对象
  console.log(source instanceof Buffer);  // true

  // 处理图片...
  return source;
};

// 标记为raw loader
module.exports.raw = true;
```

#### 实战案例

**1. Markdown Loader**
```javascript
// markdown-loader.js
const marked = require('marked');
const loaderUtils = require('loader-utils');

module.exports = function(source) {
  // 启用缓存
  this.cacheable && this.cacheable();

  // 获取配置
  const options = this.getOptions();

  // 添加依赖
  this.addDependency(this.resourcePath);

  // 转换markdown
  const html = marked(source, options);

  // 返回ES模块格式
  return `export default ${JSON.stringify(html)}`;
};

// 使用
import html from './README.md';
document.getElementById('content').innerHTML = html;
```

**2. 图片压缩Loader**
```javascript
// image-compress-loader.js
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const imageminMozjpeg = require('imagemin-mozjpeg');

module.exports = function(source) {
  const callback = this.async();
  const options = this.getOptions();

  imagemin.buffer(source, {
    plugins: [
      imageminPngquant({ quality: [0.6, 0.8] }),
      imageminMozjpeg({ quality: 80 })
    ]
  })
  .then(buffer => {
    // 计算压缩率
    const ratio = ((1 - buffer.length / source.length) * 100).toFixed(2);
    console.log(`Compressed ${this.resourcePath}: -${ratio}%`);

    callback(null, buffer);
  })
  .catch(callback);
};

module.exports.raw = true;  // 处理二进制
```

**3. SVG Sprite Loader**
```javascript
// svg-sprite-loader.js
module.exports = function(source) {
  const id = this.resourcePath.match(/([^/]+)\.svg$/)[1];

  // 提取SVG内容
  const content = source
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');

  // 生成symbol
  const symbol = `
    <symbol id="${id}" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </symbol>
  `;

  // 注入到sprite
  const code = `
    (function() {
      const sprite = document.getElementById('svg-sprite') ||
        document.body.insertAdjacentHTML('afterbegin', '<svg id="svg-sprite" style="display:none"></svg>') &&
        document.getElementById('svg-sprite');

      sprite.insertAdjacentHTML('beforeend', ${JSON.stringify(symbol)});
    })();

    export default "${id}";
  `;

  return code;
};

// 使用
import iconId from './icons/home.svg';
// <svg><use xlink:href="#home" /></svg>
```

**4. 国际化Loader**
```javascript
// i18n-loader.js
module.exports = function(source) {
  const options = this.getOptions();
  const locale = options.locale || 'en';

  // 解析JSON
  const messages = JSON.parse(source);

  // 只返回当前语言的翻译
  const localeMessages = messages[locale] || {};

  return `export default ${JSON.stringify(localeMessages)}`;
};

// messages.json
{
  "en": { "hello": "Hello" },
  "zh": { "hello": "你好" }
}

// webpack.config.js
{
  test: /messages\.json$/,
  use: {
    loader: 'i18n-loader',
    options: { locale: 'zh' }
  }
}

// 使用
import messages from './messages.json';
console.log(messages.hello);  // "你好"
```

#### Loader API

```javascript
module.exports = function(source, sourceMap, meta) {
  // 1. 获取配置
  const options = this.getOptions();

  // 2. 获取资源路径
  const resourcePath = this.resourcePath;  // 完整路径
  const resourceQuery = this.resourceQuery;  // 查询字符串

  // 3. 缓存控制
  this.cacheable(true);  // 启用缓存

  // 4. 添加依赖
  this.addDependency(filePath);  // 添加文件依赖
  this.addContextDependency(dirPath);  // 添加目录依赖

  // 5. 生成文件
  this.emitFile(name, content, sourceMap);

  // 6. 异步处理
  const callback = this.async();

  // 7. 获取webpack实例
  const webpack = this._compiler;

  // 8. 访问compilation
  const compilation = this._compilation;

  // 9. 加载其他文件
  this.loadModule(request, (err, source, sourceMap, module) => {
    // 处理加载的模块
  });

  // 10. 解析路径
  this.resolve(context, request, (err, result) => {
    // 获取解析后的路径
  });

  // 11. 报告错误/警告
  this.emitError(new Error('Error message'));
  this.emitWarning(new Error('Warning message'));

  // 12. 获取剩余请求
  const remainingRequest = this.remainingRequest;
  const previousRequest = this.previousRequest;

  return source;
};
```

#### Loader最佳实践

**1. 职责单一**
```javascript
// 不好：一个loader做太多事
module.exports = function(source) {
  const compiled = compile(source);
  const optimized = optimize(compiled);
  const minified = minify(optimized);
  return minified;
};

// 好：每个loader只做一件事
// compile-loader.js
module.exports = function(source) {
  return compile(source);
};

// optimize-loader.js
module.exports = function(source) {
  return optimize(source);
};

// webpack.config.js
use: ['minify-loader', 'optimize-loader', 'compile-loader']
```

**2. 开启缓存**
```javascript
module.exports = function(source) {
  // 如果loader输出确定性的结果，应该启用缓存
  this.cacheable && this.cacheable();

  return transform(source);
};
```

**3. 错误处理**
```javascript
module.exports = function(source) {
  try {
    const result = dangerousTransform(source);
    return result;
  } catch (error) {
    // 使用emitError而不是throw
    this.emitError(error);
    return source;  // 返回原内容
  }
};
```

**4. Schema验证**
```javascript
const { validate } = require('schema-utils');

const schema = {
  type: 'object',
  properties: {
    test: {
      type: 'boolean'
    },
    include: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  },
  additionalProperties: false
};

module.exports = function(source) {
  const options = this.getOptions();

  // 验证配置
  validate(schema, options, {
    name: 'My Loader',
    baseDataPath: 'options'
  });

  // ...
};
```

## 8. Webpack中Plugin的实现原理
**问题：** Webpack中plugin的实现原理和开发方法是什么？

### 解答

#### Plugin本质

Plugin是一个带有apply方法的类或对象，通过监听webpack生命周期钩子来扩展功能。

```javascript
class MyPlugin {
  apply(compiler) {
    // compiler是webpack实例
    // 通过hooks监听编译过程中的事件
  }
}
```

#### Webpack编译流程与Hooks

```
初始化阶段
├── environment (准备编译环境)
├── afterEnvironment
├── entryOption (处理entry配置)
└── afterPlugins (插件加载完成)

编译阶段
├── beforeRun (编译前)
├── run (开始编译)
├── beforeCompile
├── compile (创建compilation对象)
├── make (从entry开始递归分析依赖)
├── afterCompile (编译完成)
└── emit (输出资源到output目录前)

输出阶段
├── emit (输出资源)
├── afterEmit (输出资源后)
└── done (完成编译)
```

**Compiler Hooks详解**
```javascript
class MyPlugin {
  apply(compiler) {
    // 1. environment - 准备编译环境
    compiler.hooks.environment.tap('MyPlugin', () => {
      console.log('环境准备完成');
    });

    // 2. entryOption - 处理入口配置
    compiler.hooks.entryOption.tap('MyPlugin', (context, entry) => {
      console.log('Entry:', entry);
    });

    // 3. beforeRun - 编译前（异步）
    compiler.hooks.beforeRun.tapAsync('MyPlugin', (compiler, callback) => {
      console.log('准备编译');
      callback();
    });

    // 4. run - 开始编译
    compiler.hooks.run.tapAsync('MyPlugin', (compiler, callback) => {
      console.log('开始编译');
      callback();
    });

    // 5. beforeCompile - 编译参数创建后
    compiler.hooks.beforeCompile.tapAsync('MyPlugin', (params, callback) => {
      console.log('编译参数:', params);
      callback();
    });

    // 6. compile - 创建compilation前
    compiler.hooks.compile.tap('MyPlugin', (params) => {
      console.log('创建compilation');
    });

    // 7. make - 从entry开始递归编译
    compiler.hooks.make.tapAsync('MyPlugin', (compilation, callback) => {
      console.log('开始递归编译模块');
      callback();
    });

    // 8. afterCompile - 编译完成
    compiler.hooks.afterCompile.tapAsync('MyPlugin', (compilation, callback) => {
      console.log('编译完成');
      console.log('模块数:', compilation.modules.size);
      console.log('Chunk数:', compilation.chunks.size);
      callback();
    });

    // 9. emit - 输出资源到目录前
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
      console.log('准备输出文件');
      // 可以修改输出资源
      callback();
    });

    // 10. afterEmit - 输出资源后
    compiler.hooks.afterEmit.tapAsync('MyPlugin', (compilation, callback) => {
      console.log('文件已输出');
      callback();
    });

    // 11. done - 编译完成
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('构建完成');
      console.log('耗时:', stats.endTime - stats.startTime, 'ms');
    });

    // 12. failed - 编译失败
    compiler.hooks.failed.tap('MyPlugin', (error) => {
      console.error('构建失败:', error);
    });
  }
}
```

**Compilation Hooks详解**
```javascript
class MyPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      // 1. buildModule - 构建模块前
      compilation.hooks.buildModule.tap('MyPlugin', (module) => {
        console.log('构建模块:', module.resource);
      });

      // 2. succeedModule - 模块构建成功
      compilation.hooks.succeedModule.tap('MyPlugin', (module) => {
        console.log('模块构建成功:', module.resource);
      });

      // 3. finishModules - 所有模块构建完成
      compilation.hooks.finishModules.tapAsync('MyPlugin', (modules, callback) => {
        console.log('所有模块构建完成:', modules.size);
        callback();
      });

      // 4. seal - 封装阶段开始
      compilation.hooks.seal.tap('MyPlugin', () => {
        console.log('开始封装');
      });

      // 5. optimizeDependencies - 优化依赖
      compilation.hooks.optimizeDependencies.tap('MyPlugin', (modules) => {
        console.log('优化依赖');
      });

      // 6. optimize - 优化阶段开始
      compilation.hooks.optimize.tap('MyPlugin', () => {
        console.log('开始优化');
      });

      // 7. optimizeModules - 优化模块
      compilation.hooks.optimizeModules.tap('MyPlugin', (modules) => {
        console.log('优化模块');
      });

      // 8. optimizeChunks - 优化chunk
      compilation.hooks.optimizeChunks.tap('MyPlugin', (chunks) => {
        console.log('优化chunk');
      });

      // 9. optimizeAssets - 优化资源
      compilation.hooks.optimizeAssets.tapAsync('MyPlugin', (assets, callback) => {
        console.log('优化资源');
        callback();
      });

      // 10. processAssets - 处理资源（Webpack 5新增）
      compilation.hooks.processAssets.tap(
        {
          name: 'MyPlugin',
          stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
        },
        (assets) => {
          console.log('处理资源');
        }
      );
    });
  }
}
```

#### 实战案例

**1. 文件列表插件**
```javascript
// FileListPlugin.js
class FileListPlugin {
  constructor(options = {}) {
    this.filename = options.filename || 'filelist.md';
  }

  apply(compiler) {
    // 在emit阶段添加文件
    compiler.hooks.emit.tapAsync('FileListPlugin', (compilation, callback) => {
      // 获取所有资源
      const assets = compilation.assets;

      // 生成文件列表
      let content = '# 文件列表\n\n';
      content += '## 资源文件\n\n';

      // 统计信息
      const stats = {
        total: 0,
        js: 0,
        css: 0,
        images: 0,
        other: 0
      };

      Object.keys(assets).forEach(filename => {
        const size = assets[filename].size();
        const sizeKB = (size / 1024).toFixed(2);

        content += `- ${filename} (${sizeKB} KB)\n`;

        stats.total++;
        if (/\.js$/.test(filename)) stats.js++;
        else if (/\.css$/.test(filename)) stats.css++;
        else if (/\.(png|jpg|gif|svg)$/.test(filename)) stats.images++;
        else stats.other++;
      });

      content += `\n## 统计\n\n`;
      content += `- 总文件数: ${stats.total}\n`;
      content += `- JS文件: ${stats.js}\n`;
      content += `- CSS文件: ${stats.css}\n`;
      content += `- 图片文件: ${stats.images}\n`;
      content += `- 其他文件: ${stats.other}\n`;

      // 添加到输出
      compilation.assets[this.filename] = {
        source: () => content,
        size: () => content.length
      };

      callback();
    });
  }
}

module.exports = FileListPlugin;
```

**2. 代码注入插件**
```javascript
// InjectCodePlugin.js
class InjectCodePlugin {
  constructor(options = {}) {
    this.code = options.code || '';
    this.position = options.position || 'head';  // 'head' | 'body'
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('InjectCodePlugin', (compilation) => {
      // Hook into HTML webpack plugin
      const hooks = compilation.hooks;

      if (hooks.htmlWebpackPluginAfterHtmlProcessing) {
        hooks.htmlWebpackPluginAfterHtmlProcessing.tapAsync(
          'InjectCodePlugin',
          (data, callback) => {
            const code = this.code;

            if (this.position === 'head') {
              data.html = data.html.replace('</head>', `${code}</head>`);
            } else {
              data.html = data.html.replace('</body>', `${code}</body>`);
            }

            callback(null, data);
          }
        );
      }
    });
  }
}

// 使用
new InjectCodePlugin({
  code: '<script>console.log("Injected!")</script>',
  position: 'head'
})
```

**3. 构建速度分析插件**
```javascript
// SpeedMeasurePlugin.js
class SpeedMeasurePlugin {
  apply(compiler) {
    const startTimes = new Map();
    const durations = new Map();

    // 记录开始时间
    compiler.hooks.compile.tap('SpeedMeasurePlugin', () => {
      startTimes.set('compile', Date.now());
    });

    // 记录各阶段耗时
    compiler.hooks.compilation.tap('SpeedMeasurePlugin', (compilation) => {
      // 模块构建
      compilation.hooks.buildModule.tap('SpeedMeasurePlugin', (module) => {
        startTimes.set(module, Date.now());
      });

      compilation.hooks.succeedModule.tap('SpeedMeasurePlugin', (module) => {
        const duration = Date.now() - startTimes.get(module);
        durations.set(module.resource, duration);
      });

      // Seal阶段
      compilation.hooks.seal.tap('SpeedMeasurePlugin', () => {
        startTimes.set('seal', Date.now());
      });

      compilation.hooks.afterSeal.tapAsync('SpeedMeasurePlugin', (callback) => {
        const duration = Date.now() - startTimes.get('seal');
        durations.set('seal', duration);
        callback();
      });
    });

    // 输出报告
    compiler.hooks.done.tap('SpeedMeasurePlugin', (stats) => {
      const totalTime = Date.now() - startTimes.get('compile');

      console.log('\n构建速度分析报告\n');
      console.log(`总耗时: ${totalTime}ms\n`);

      // 最慢的模块
      const sortedModules = Array.from(durations.entries())
        .filter(([key]) => typeof key === 'string')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log('最慢的10个模块:');
      sortedModules.forEach(([module, duration]) => {
        console.log(`  ${duration}ms - ${module}`);
      });

      console.log(`\nSeal阶段耗时: ${durations.get('seal')}ms`);
    });
  }
}
```

**4. 资源压缩插件**
```javascript
// CompressAssetsPlugin.js
const { gzip } = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(gzip);

class CompressAssetsPlugin {
  constructor(options = {}) {
    this.test = options.test || /\.(js|css)$/;
    this.threshold = options.threshold || 10 * 1024;  // 10KB
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('CompressAssetsPlugin', async (compilation, callback) => {
      const { assets } = compilation;

      const compressionPromises = Object.keys(assets)
        .filter(filename => this.test.test(filename))
        .filter(filename => assets[filename].size() > this.threshold)
        .map(async (filename) => {
          const source = assets[filename].source();
          const compressed = await gzipAsync(source);

          // 添加.gz文件
          compilation.assets[`${filename}.gz`] = {
            source: () => compressed,
            size: () => compressed.length
          };

          const ratio = ((1 - compressed.length / source.length) * 100).toFixed(2);
          console.log(`Compressed ${filename}: -${ratio}%`);
        });

      try {
        await Promise.all(compressionPromises);
        callback();
      } catch (error) {
        callback(error);
      }
    });
  }
}
```

**5. 打包分析插件**
```javascript
// BundleAnalyzerPlugin.js
class BundleAnalyzerPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('BundleAnalyzerPlugin', (compilation, callback) => {
      const stats = compilation.getStats().toJson({
        all: false,
        modules: true,
        chunks: true,
        assets: true
      });

      // 分析数据
      const analysis = {
        assets: [],
        chunks: [],
        modules: []
      };

      // 分析资源
      stats.assets.forEach(asset => {
        analysis.assets.push({
          name: asset.name,
          size: asset.size,
          chunks: asset.chunks
        });
      });

      // 分析chunks
      stats.chunks.forEach(chunk => {
        analysis.chunks.push({
          id: chunk.id,
          names: chunk.names,
          files: chunk.files,
          size: chunk.size,
          modules: chunk.modules ? chunk.modules.length : 0
        });
      });

      // 分析模块
      const modulesBySize = stats.modules
        .map(module => ({
          name: module.name,
          size: module.size,
          chunks: module.chunks
        }))
        .sort((a, b) => b.size - a.size);

      analysis.modules = modulesBySize.slice(0, 20);  // 最大的20个模块

      // 生成HTML报告
      const html = this.generateHTML(analysis);

      compilation.assets['bundle-analysis.html'] = {
        source: () => html,
        size: () => html.length
      };

      callback();
    });
  }

  generateHTML(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bundle Analysis</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Bundle Analysis Report</h1>

        <h2>Assets</h2>
        <table>
          <tr><th>Name</th><th>Size (KB)</th></tr>
          ${data.assets.map(asset => `
            <tr>
              <td>${asset.name}</td>
              <td>${(asset.size / 1024).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>

        <h2>Top 20 Largest Modules</h2>
        <table>
          <tr><th>Module</th><th>Size (KB)</th></tr>
          ${data.modules.map(module => `
            <tr>
              <td>${module.name}</td>
              <td>${(module.size / 1024).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>

        <script>
          const data = ${JSON.stringify(data, null, 2)};
          console.log('Bundle Analysis Data:', data);
        </script>
      </body>
      </html>
    `;
  }
}
```

#### Tapable原理

Webpack的插件系统基于Tapable库，提供了多种Hook类型。

```javascript
const {
  SyncHook,
  SyncBailHook,
  SyncWaterfallHook,
  AsyncSeriesHook,
  AsyncParallelHook
} = require('tapable');

// 1. SyncHook - 同步串行
const syncHook = new SyncHook(['arg1', 'arg2']);

syncHook.tap('Plugin1', (arg1, arg2) => {
  console.log('Plugin1:', arg1, arg2);
});

syncHook.tap('Plugin2', (arg1, arg2) => {
  console.log('Plugin2:', arg1, arg2);
});

syncHook.call('value1', 'value2');

// 2. SyncBailHook - 同步熔断（返回非undefined会停止）
const bailHook = new SyncBailHook(['value']);

bailHook.tap('Plugin1', (value) => {
  console.log('Plugin1');
  if (value === 'stop') return 'stopped';
});

bailHook.tap('Plugin2', (value) => {
  console.log('Plugin2');  // 如果Plugin1返回值，这里不会执行
});

// 3. SyncWaterfallHook - 同步瀑布（上一个返回值传给下一个）
const waterfallHook = new SyncWaterfallHook(['value']);

waterfallHook.tap('Plugin1', (value) => {
  console.log('Plugin1:', value);
  return value + '1';
});

waterfallHook.tap('Plugin2', (value) => {
  console.log('Plugin2:', value);  // 接收Plugin1的返回值
  return value + '2';
});

const result = waterfallHook.call('init');
console.log('Final:', result);  // init12

// 4. AsyncSeriesHook - 异步串行
const asyncSeriesHook = new AsyncSeriesHook(['value']);

asyncSeriesHook.tapAsync('Plugin1', (value, callback) => {
  setTimeout(() => {
    console.log('Plugin1:', value);
    callback();
  }, 1000);
});

asyncSeriesHook.tapPromise('Plugin2', (value) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Plugin2:', value);
      resolve();
    }, 1000);
  });
});

asyncSeriesHook.callAsync('value', () => {
  console.log('Done');
});

// 5. AsyncParallelHook - 异步并行
const asyncParallelHook = new AsyncParallelHook(['value']);

asyncParallelHook.tapAsync('Plugin1', (value, callback) => {
  setTimeout(() => {
    console.log('Plugin1:', value);
    callback();
  }, 1000);
});

asyncParallelHook.tapAsync('Plugin2', (value, callback) => {
  setTimeout(() => {
    console.log('Plugin2:', value);
    callback();
  }, 500);
});

asyncParallelHook.callAsync('value', () => {
  console.log('All done');  // 等待所有插件完成
});
```

## 9. Webpack Dev Server的原理
**问题：** Webpack Dev Server的实现原理和核心机制是什么？

### 解答

#### Dev Server架构

```
┌─────────────────────────────────────┐
│      Webpack Dev Server             │
├─────────────────────────────────────┤
│  ┌───────────┐      ┌────────────┐ │
│  │  Express  │◄────►│  Webpack   │ │
│  │  Server   │      │  Compiler  │ │
│  └─────┬─────┘      └──────┬─────┘ │
│        │                   │        │
│  ┌─────▼─────┐      ┌──────▼─────┐ │
│  │WebSocket  │      │  Memory    │ │
│  │  Server   │      │FileSystem  │ │
│  └───────────┘      └────────────┘ │
└─────────────────────────────────────┘
         │
    WebSocket连接
         │
┌────────▼────────────┐
│     Browser         │
│  HMR Runtime Client │
└─────────────────────┘
```

#### 核心实现原理

**1. 基于Express的开发服务器**
```javascript
// webpack-dev-server简化实现
const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');

class DevServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.compiler = webpack(config);
  }

  setupMiddlewares() {
    // 1. webpack-dev-middleware
    // 将编译后的文件存在内存中，通过Express提供访问
    const devMiddleware = webpackDevMiddleware(this.compiler, {
      publicPath: this.config.output.publicPath,
      stats: { colors: true }
    });

    this.app.use(devMiddleware);

    // 2. webpack-hot-middleware
    // 处理HMR
    const hotMiddleware = webpackHotMiddleware(this.compiler);
    this.app.use(hotMiddleware);

    // 3. 静态文件服务
    this.app.use(express.static('public'));

    // 4. historyApiFallback支持
    this.app.use(require('connect-history-api-fallback')());
  }

  listen(port) {
    this.setupMiddlewares();
    this.app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  }
}

// 使用
const config = require('./webpack.config');
const server = new DevServer(config);
server.listen(3000);
```

**2. 内存文件系统（Memory-FS）**
```javascript
// webpack-dev-middleware使用memory-fs
const MemoryFileSystem = require('memory-fs');
const webpack = require('webpack');

function setupDevMiddleware(compiler) {
  // 使用内存文件系统
  const mfs = new MemoryFileSystem();
  compiler.outputFileSystem = mfs;

  // 监听文件变化
  compiler.watch({
    aggregateTimeout: 300,
    poll: undefined
  }, (err, stats) => {
    if (err) {
      console.error(err);
      return;
    }

    // 从内存中读取文件
    const content = mfs.readFileSync('/dist/bundle.js');
    console.log('File compiled in memory');
  });

  return function middleware(req, res, next) {
    const filename = req.url.slice(1) || 'index.html';
    const filePath = path.join('/dist', filename);

    try {
      // 从内存读取文件
      const content = mfs.readFileSync(filePath);
      res.send(content);
    } catch (e) {
      next();
    }
  };
}
```

**3. WebSocket通信**
```javascript
// 服务器端
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// 存储所有连接的客户端
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

// 监听webpack编译
compiler.hooks.done.tap('webpack-dev-server', (stats) => {
  const statsJson = stats.toJson();

  // 向所有客户端发送更新消息
  const message = {
    type: 'hash',
    data: statsJson.hash
  };

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });

  // 发送ok消息
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'ok' }));
    }
  });
});

// 客户端
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  console.log('Connected to dev server');
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'hash':
      currentHash = message.data;
      break;
    case 'ok':
      reloadApp();
      break;
  }
};
```

**4. HMR完整流程**
```javascript
// 服务器端 - webpack配置
module.exports = {
  entry: [
    'webpack-hot-middleware/client?reload=true',  // HMR客户端
    './src/index.js'
  ],

  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],

  devServer: {
    hot: true,
    hotOnly: true  // 构建失败时不刷新页面
  }
};

// 服务器端 - 监听编译
compiler.hooks.done.tap('webpack-dev-server', (stats) => {
  const { hash, errors, warnings } = stats.toJson();

  // 1. 发送hash
  sendMessage(clients, { type: 'hash', data: hash });

  // 2. 发送状态
  if (errors.length > 0) {
    sendMessage(clients, { type: 'errors', data: errors });
  } else if (warnings.length > 0) {
    sendMessage(clients, { type: 'warnings', data: warnings });
  } else {
    sendMessage(clients, { type: 'ok' });
  }
});

// 客户端 - HMR Runtime
let currentHash;
let hotCurrentHash;

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'hash':
      currentHash = message.data;
      break;

    case 'ok':
      hotCheck();
      break;

    case 'errors':
      console.error('Compilation errors:', message.data);
      break;
  }
};

function hotCheck() {
  if (!currentHash || currentHash === hotCurrentHash) {
    return;
  }

  hotCurrentHash = currentHash;

  // 1. 下载更新清单
  fetch(`/[hash].hot-update.json`)
    .then(res => res.json())
    .then(update => {
      const chunkIds = Object.keys(update.c);

      // 2. 下载更新的模块
      const promises = chunkIds.map(chunkId => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `/[chunkId].[hash].hot-update.js`;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      });

      return Promise.all(promises);
    })
    .then(() => {
      // 3. 应用更新
      hotApply();
    });
}

function hotApply() {
  // 应用更新的模块
  __webpack_require__.hmrM.forEach((moduleId) => {
    const module = __webpack_require__.c[moduleId];

    if (module.hot) {
      module.hot.accept();
    }
  });
}

// 业务代码中使用
if (module.hot) {
  module.hot.accept('./module.js', () => {
    console.log('Module updated!');
    // 更新逻辑
  });
}
```

#### 代理配置原理

```javascript
// http-proxy-middleware实现
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        pathRewrite: { '^/api': '' },

        // 请求拦截
        onProxyReq: (proxyReq, req, res) => {
          console.log('Proxying:', req.method, req.url);

          // 修改请求头
          proxyReq.setHeader('X-Custom-Header', 'value');

          // 修改请求体
          if (req.body) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
        },

        // 响应拦截
        onProxyRes: (proxyRes, req, res) => {
          console.log('Response:', proxyRes.statusCode);

          // 修改响应头
          proxyRes.headers['X-Proxy'] = 'webpack-dev-server';
        },

        // 错误处理
        onError: (err, req, res) => {
          console.error('Proxy error:', err);
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end('Proxy error');
        }
      }
    }
  }
};

// 简化实现
function createProxy(options) {
  return function proxyMiddleware(req, res, next) {
    if (!req.url.startsWith(options.context)) {
      return next();
    }

    // 重写路径
    let targetPath = req.url;
    Object.keys(options.pathRewrite || {}).forEach(pattern => {
      targetPath = targetPath.replace(new RegExp(pattern), options.pathRewrite[pattern]);
    });

    // 构建目标URL
    const targetUrl = `${options.target}${targetPath}`;

    // 转发请求
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(options.target).host
      }
    }, (proxyRes) => {
      // 转发响应
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    req.pipe(proxyReq);
  };
}
```

#### 性能优化

```javascript
module.exports = {
  devServer: {
    // 1. 懒编译（Webpack 5）
    lazy: false,  // 关闭懒编译，访问时才编译

    // 2. 监听配置
    watchOptions: {
      // 忽略node_modules
      ignored: /node_modules/,

      // 聚合多个更改到单次重构建
      aggregateTimeout: 300,

      // 轮询间隔
      poll: false
    },

    // 3. 缓存
    cache: {
      type: 'filesystem'
    },

    // 4. 并行编译
    parallel: true,

    // 5. 开发模式优化
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',  // 最快的source map

    // 6. 模块热替换优化
    hot: true,
    liveReload: false,  // 关闭自动刷新，只用HMR

    // 7. 压缩
    compress: true,

    // 8. 客户端日志级别
    client: {
      logging: 'warn'  // 只显示警告和错误
    }
  },

  // 开发环境不需要的优化
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false
  }
};
```

#### 完整实现示例

```javascript
// my-dev-server.js
const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const WebSocket = require('ws');
const http = require('http');

class MyDevServer {
  constructor(webpackConfig, options = {}) {
    this.options = {
      port: 3000,
      hot: true,
      historyApiFallback: true,
      ...options
    };

    this.app = express();
    this.server = http.createServer(this.app);
    this.compiler = webpack(webpackConfig);
    this.clients = new Set();

    this.setupWebSocket();
    this.setupMiddlewares();
    this.setupHooks();
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('Client connected');

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('Client disconnected');
      });
    });
  }

  setupMiddlewares() {
    // Webpack dev middleware
    const devMiddleware = webpackDevMiddleware(this.compiler, {
      publicPath: this.compiler.options.output.publicPath || '/',
      stats: 'minimal'
    });

    this.app.use(devMiddleware);

    // History API fallback
    if (this.options.historyApiFallback) {
      const history = require('connect-history-api-fallback');
      this.app.use(history());
    }

    // 静态文件
    if (this.options.static) {
      this.app.use(express.static(this.options.static));
    }
  }

  setupHooks() {
    this.compiler.hooks.done.tap('MyDevServer', (stats) => {
      const statsJson = stats.toJson({
        all: false,
        hash: true,
        errors: true,
        warnings: true
      });

      this.sendMessage({
        type: 'hash',
        data: statsJson.hash
      });

      if (statsJson.errors.length > 0) {
        this.sendMessage({
          type: 'errors',
          data: statsJson.errors
        });
      } else if (statsJson.warnings.length > 0) {
        this.sendMessage({
          type: 'warnings',
          data: statsJson.warnings
        });
      } else {
        this.sendMessage({ type: 'ok' });
      }
    });
  }

  sendMessage(message) {
    const json = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    });
  }

  listen() {
    this.server.listen(this.options.port, () => {
      console.log(`Server running at http://localhost:${this.options.port}`);
    });
  }
}

// 使用
const config = require('./webpack.config');
const server = new MyDevServer(config, {
  port: 3000,
  hot: true,
  static: 'public'
});

server.listen();
```
