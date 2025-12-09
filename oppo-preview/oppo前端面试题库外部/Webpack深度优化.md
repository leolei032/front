# Webpack深度优化

## 1. Webpack构建流程

### 核心概念

```javascript
// Webpack构建流程（5个阶段）
/*
1. 初始化（Initialization）
   - 读取配置文件
   - 合并配置参数
   - 创建Compiler对象

2. 编译（Compilation）
   - 从入口文件开始递归解析
   - 调用loader转换模块
   - 使用acorn解析AST
   - 收集依赖关系

3. 构建模块图（Module Graph）
   - 构建依赖图谱
   - 分析循环依赖
   - 确定chunk分组

4. 优化（Optimization）
   - Tree Shaking
   - Scope Hoisting
   - Code Splitting
   - 压缩代码

5. 输出（Emit）
   - 生成bundle文件
   - 输出资源文件
   - 生成manifest
*/

// 简化的Webpack工作流程
class Compiler {
  constructor(options) {
    this.options = options;
    this.hooks = {
      beforeRun: new SyncHook(),
      run: new SyncHook(),
      compile: new SyncHook(),
      emit: new AsyncSeriesHook(),
      done: new AsyncSeriesHook()
    };
  }

  run(callback) {
    // 1. 触发beforeRun钩子
    this.hooks.beforeRun.call(this);

    // 2. 开始编译
    this.compile((err, compilation) => {
      if (err) return callback(err);

      // 3. 输出资源
      this.emitAssets(compilation, (err) => {
        if (err) return callback(err);

        // 4. 完成
        this.hooks.done.callAsync(compilation.getStats(), callback);
      });
    });
  }

  compile(callback) {
    const compilation = this.newCompilation();

    // 从入口开始构建
    this.hooks.compile.call(compilation);

    // 构建模块
    compilation.buildModule(this.options.entry, (err) => {
      if (err) return callback(err);

      // 生成chunk
      compilation.seal((err) => {
        callback(err, compilation);
      });
    });
  }
}

// Compilation类
class Compilation {
  constructor(compiler) {
    this.compiler = compiler;
    this.modules = [];
    this.chunks = [];
    this.assets = {};
  }

  buildModule(entry, callback) {
    // 1. 解析入口文件
    const module = this.createModule(entry);

    // 2. 使用loader转换
    this.processModule(module);

    // 3. 解析依赖
    this.parseDependencies(module);

    // 4. 递归处理依赖
    module.dependencies.forEach(dep => {
      this.buildModule(dep, callback);
    });

    callback();
  }
}
```

## 2. Tree Shaking深度优化

### 原理和实现

```javascript
// Tree Shaking的本质：消除死代码（Dead Code Elimination）

// 1. 基于ES6 Module的静态分析
// math.js
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

// index.js
import { add } from './math.js';

console.log(add(1, 2));
// subtract和multiply没有被使用，会被Tree Shaking删除

// 2. Webpack配置
module.exports = {
  mode: 'production',  // 生产模式自动启用Tree Shaking

  optimization: {
    usedExports: true,        // 标记使用的导出
    sideEffects: false,       // 无副作用的模块可以被删除
    minimize: true,           // 压缩代码
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            dead_code: true,       // 删除死代码
            drop_debugger: true,   // 删除debugger
            drop_console: true,    // 删除console
            pure_funcs: ['console.log']  // 删除特定函数调用
          }
        }
      })
    ]
  }
};

// 3. package.json配置
{
  "name": "my-package",
  "sideEffects": false  // 表示所有文件都没有副作用
}

// 或指定有副作用的文件
{
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfill.js"
  ]
}

// 4. 副作用示例
// ❌ 有副作用（会被保留）
import './global.css';  // 导入CSS
window.myGlobal = 'value';  // 修改全局变量
console.log('side effect');  // 执行代码

// ✓ 无副作用（可以被删除）
export function pureFunction(x) {
  return x * 2;
}

// 5. 深度Tree Shaking技巧
// 避免默认导出
// ❌ 不利于Tree Shaking
export default {
  add,
  subtract,
  multiply
};

// ✓ 利于Tree Shaking
export { add, subtract, multiply };

// 避免通配符导入
// ❌ 不利于Tree Shaking
import * as math from './math.js';
console.log(math.add(1, 2));

// ✓ 利于Tree Shaking
import { add } from './math.js';
console.log(add(1, 2));

// 6. Webpack分析工具
// webpack-bundle-analyzer
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'server',
      analyzerPort: 8888,
      openAnalyzer: true
    })
  ]
};

// 7. Tree Shaking效果测试
// 未优化前
// bundle.js: 150KB

// 优化后
// bundle.js: 80KB (减少47%)

// 案例：lodash优化
// ❌ 全量导入 (70KB)
import _ from 'lodash';
console.log(_.add(1, 2));

// ✓ 按需导入 (3KB)
import add from 'lodash/add';
console.log(add(1, 2));

// 或使用lodash-es（支持Tree Shaking）
import { add } from 'lodash-es';
console.log(add(1, 2));
```

### 副作用检测

```javascript
// 深入理解sideEffects

// 1. 模块级副作用
// polyfill.js（有副作用）
Array.prototype.myMethod = function() {
  // 修改原型链
};

// 2. 条件副作用
// utils.js
export function log(message) {
  if (process.env.NODE_ENV === 'development') {
    console.log(message);  // 副作用
  }
}

// 3. 类的副作用
// MyClass.js
export class MyClass {
  static {
    // 静态初始化块（副作用）
    console.log('Class initialized');
  }
}

// 4. 副作用分析工具
// 使用@babel/preset-env的useBuiltIns
module.exports = {
  presets: [
    ['@babel/preset-env', {
      useBuiltIns: 'usage',  // 按需引入polyfill
      corejs: 3
    }]
  ]
};

// 5. 手动标记纯函数
// 使用/*#__PURE__*/注释
const result = /*#__PURE__*/ computeExpensiveValue();

// Webpack会识别并在未使用时删除
```

## 3. Code Splitting（代码分割）

### 分割策略

```javascript
// Code Splitting的三种方式

// 1. 入口分割（Entry Points）
module.exports = {
  entry: {
    index: './src/index.js',
    admin: './src/admin.js',
    vendor: './src/vendor.js'
  },
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist')
  }
};

// 2. 动态导入（Dynamic Import）
// 使用import()函数
button.addEventListener('click', async () => {
  // 点击时才加载
  const module = await import('./heavy-module.js');
  module.doSomething();
});

// React中的使用
const LazyComponent = React.lazy(() => import('./LazyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyComponent />
    </Suspense>
  );
}

// Vue中的使用
const AsyncComponent = () => import('./AsyncComponent.vue');

// 3. SplitChunks插件
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',  // 'initial' | 'async' | 'all'

      // 缓存组配置
      cacheGroups: {
        // 第三方库
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true
        },

        // 公共代码
        common: {
          minChunks: 2,          // 最少被引用2次
          minSize: 20000,        // 最小20KB
          maxSize: 244000,       // 最大244KB
          name: 'common',
          priority: 5,
          reuseExistingChunk: true
        },

        // React相关
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
          name: 'react',
          priority: 20
        },

        // UI库
        antd: {
          test: /[\\/]node_modules[\\/]antd[\\/]/,
          name: 'antd',
          priority: 15
        },

        // 工具库
        utils: {
          test: /[\\/]node_modules[\\/](lodash|moment|axios)[\\/]/,
          name: 'utils',
          priority: 15
        },

        // 样式文件
        styles: {
          test: /\.(css|scss|sass)$/,
          name: 'styles',
          priority: 25,
          enforce: true
        }
      }
    },

    // 运行时代码单独打包
    runtimeChunk: {
      name: 'runtime'
    }
  }
};

// 4. 预获取和预加载
// Prefetch（预获取）：浏览器空闲时加载
import(/* webpackPrefetch: true */ './heavy-module.js');

// Preload（预加载）：父chunk加载时并行加载
import(/* webpackPreload: true */ './critical-module.js');

// 5. Magic Comments（魔法注释）
import(
  /* webpackChunkName: "my-chunk-name" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  './module.js'
);

// 6. 分析工具
// webpack-bundle-analyzer
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

plugins: [
  new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    reportFilename: 'bundle-report.html',
    openAnalyzer: false
  })
];

// 7. 最佳实践案例
// 路由级别分割
const routes = [
  {
    path: '/home',
    component: () => import('./views/Home.vue')
  },
  {
    path: '/about',
    component: () => import('./views/About.vue')
  },
  {
    path: '/admin',
    component: () => import(
      /* webpackChunkName: "admin" */
      './views/Admin.vue'
    )
  }
];

// 组件级别分割
// 重型组件按需加载
const HeavyChart = lazy(() => import('./HeavyChart'));
const ComplexTable = lazy(() => import('./ComplexTable'));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChart(true)}>
        Show Chart
      </button>

      {showChart && (
        <Suspense fallback={<Spinner />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

### 分割效果对比

```javascript
// 未分割前
// main.bundle.js: 800KB
// 首屏加载时间: 3.2s

// 分割后
// runtime.js: 5KB
// vendors.js: 300KB (React, ReactDOM, React Router)
// antd.js: 250KB
// utils.js: 50KB (lodash, axios)
// main.js: 150KB
// home.chunk.js: 30KB (懒加载)
// admin.chunk.js: 45KB (懒加载)

// 首屏加载时间: 1.8s (提升44%)
// 缓存命中率: 85% (vendor不变时可复用)
```

## 4. 持久化缓存

### 缓存策略

```javascript
// Webpack持久化缓存配置

module.exports = {
  // 1. 文件系统缓存（Webpack 5）
  cache: {
    type: 'filesystem',

    // 缓存目录
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),

    // 缓存名称
    name: 'production-cache',

    // 构建依赖
    buildDependencies: {
      config: [__filename],  // 配置文件变化时失效
      tsconfig: [path.resolve(__dirname, 'tsconfig.json')]
    },

    // 缓存版本
    version: '1.0.0'
  },

  // 2. 输出文件名（contenthash）
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]'
  },

  // 3. CSS文件名
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].chunk.css'
    })
  ],

  // 4. Module IDs优化
  optimization: {
    moduleIds: 'deterministic',  // 确定性的module id
    chunkIds: 'deterministic'    // 确定性的chunk id
  }
};

// 5. 分离manifest
// runtime代码单独打包，避免vendor hash变化
optimization: {
  runtimeChunk: {
    name: entrypoint => `runtime-${entrypoint.name}`
  }
}

// 6. 第三方库单独打包
optimization: {
  splitChunks: {
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all'
      }
    }
  }
}

// 7. 缓存效果测试
// 首次构建
// Time: 45s
// Cache: 0 hits, 2500 misses

// 二次构建（无变化）
// Time: 3s (提升93%)
// Cache: 2500 hits, 0 misses

// 三次构建（修改业务代码）
// Time: 8s (提升82%)
// Cache: 2450 hits, 50 misses
// vendors.js hash不变，可复用缓存

// 8. HTTP缓存策略
// nginx配置
location ~* \.(js|css|png|jpg|jpeg|gif|svg)$ {
  # 静态资源缓存1年
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~* \.html$ {
  # HTML不缓存
  expires -1;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}

// 9. Service Worker缓存
// webpack配置
const WorkboxPlugin = require('workbox-webpack-plugin');

plugins: [
  new WorkboxPlugin.GenerateSW({
    clientsClaim: true,
    skipWaiting: true,

    // 缓存策略
    runtimeCaching: [
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60  // 30天
          }
        }
      },
      {
        urlPattern: /^https:\/\/api\./,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api',
          networkTimeoutSeconds: 10
        }
      }
    ]
  })
];
```

### Hash策略对比

```javascript
// 三种hash对比

// 1. hash（所有文件hash相同）
output: {
  filename: '[name].[hash:8].js'
}
// 问题：任何文件变化，所有文件hash都变
// 适用：小项目

// 2. chunkhash（chunk级别）
output: {
  filename: '[name].[chunkhash:8].js'
}
// 特点：同一chunk内文件hash相同
// 问题：CSS和JS在同一chunk，CSS变化导致JS hash变
// 适用：中型项目

// 3. contenthash（内容级别）
output: {
  filename: '[name].[contenthash:8].js'
}
plugins: [
  new MiniCssExtractPlugin({
    filename: '[name].[contenthash:8].css'
  })
]
// 特点：只有内容变化才变hash
// 优点：最佳缓存策略
// 适用：大型项目（推荐）

// 示例对比
// 修改index.js中的代码

// 使用hash
// index.abc123.js → index.xyz789.js ✗
// vendor.abc123.js → vendor.xyz789.js ✗（不必要）
// style.abc123.css → style.xyz789.css ✗（不必要）

// 使用chunkhash
// index.abc123.js → index.xyz789.js ✓
// vendor.def456.js → vendor.def456.js ✓（未变化）
// style.abc123.css → style.xyz789.css ✗（不必要）

// 使用contenthash
// index.abc123.js → index.xyz789.js ✓
// vendor.def456.js → vendor.def456.js ✓（未变化）
// style.ghi789.css → style.ghi789.css ✓（未变化）
```

## 5. 构建速度优化

### 优化策略

```javascript
// Webpack构建速度优化

// 1. 缩小搜索范围
module.exports = {
  resolve: {
    // 指定扩展名
    extensions: ['.js', '.jsx', '.json'],

    // 别名
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'components': path.resolve(__dirname, 'src/components')
    },

    // 限制模块搜索路径
    modules: [
      path.resolve(__dirname, 'node_modules')
    ],

    // 跳过符号链接解析
    symlinks: false
  },

  // 2. 缩小Loader范围
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: path.resolve(__dirname, 'src'),  // 只处理src目录
        exclude: /node_modules/,  // 排除node_modules
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true  // 开启缓存
          }
        }
      }
    ]
  }
};

// 3. 使用DllPlugin
// webpack.dll.config.js（预编译第三方库）
module.exports = {
  entry: {
    vendor: ['react', 'react-dom', 'react-router-dom', 'redux', 'react-redux']
  },
  output: {
    filename: '[name].dll.js',
    path: path.resolve(__dirname, 'dll'),
    library: '[name]_library'
  },
  plugins: [
    new webpack.DllPlugin({
      name: '[name]_library',
      path: path.resolve(__dirname, 'dll/[name]-manifest.json')
    })
  ]
};

// webpack.config.js（引用dll）
module.exports = {
  plugins: [
    new webpack.DllReferencePlugin({
      manifest: require('./dll/vendor-manifest.json')
    })
  ]
};

// 4. 使用HardSourceWebpackPlugin（Webpack 4）
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

plugins: [
  new HardSourceWebpackPlugin()
];

// 5. 使用thread-loader（多线程）
module: {
  rules: [
    {
      test: /\.jsx?$/,
      use: [
        'thread-loader',  // 放在其他loader之前
        'babel-loader'
      ]
    }
  ]
}

// 6. 使用cache-loader
module: {
  rules: [
    {
      test: /\.jsx?$/,
      use: [
        'cache-loader',  // 缓存loader结果
        'babel-loader'
      ]
    }
  ]
}

// 7. 并行压缩
const TerserPlugin = require('terser-webpack-plugin');

optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      parallel: true,  // 开启并行压缩
      terserOptions: {
        compress: {
          drop_console: true
        }
      }
    })
  ]
}

// 8. 优化Source Map
// 开发环境
devtool: 'eval-cheap-module-source-map'  // 快速

// 生产环境
devtool: 'hidden-source-map'  // 不在bundle中引用

// 9. 排除不必要的插件
// 开发环境不需要压缩
if (process.env.NODE_ENV === 'production') {
  plugins.push(
    new TerserPlugin(),
    new CompressionWebpackPlugin()
  );
}

// 10. noParse（跳过解析）
module: {
  noParse: /jquery|lodash/  // 已知没有依赖的库
}

// 11. 使用esbuild-loader（更快的编译）
module: {
  rules: [
    {
      test: /\.jsx?$/,
      loader: 'esbuild-loader',
      options: {
        target: 'es2015'
      }
    }
  ]
}

optimization: {
  minimizer: [
    new ESBuildMinifyPlugin({
      target: 'es2015'
    })
  ]
}
```

### 构建速度对比

```javascript
// 优化前
// 开发环境首次构建: 45s
// 开发环境热更新: 8s
// 生产环境构建: 120s

// 优化后（使用所有优化策略）
// 开发环境首次构建: 12s (提升73%)
// 开发环境热更新: 2s (提升75%)
// 生产环境构建: 35s (提升71%)

// 各优化策略贡献度
/*
缓存机制（cache）: -15s (33%)
并行处理（thread-loader + parallel）: -12s (27%)
缩小范围（include/exclude）: -8s (18%)
DLL预编译: -6s (13%)
其他优化: -4s (9%)
*/
```

## 6. 打包体积优化

### 优化技巧

```javascript
// 打包体积优化策略

// 1. 分析打包体积
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

plugins: [
  new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    openAnalyzer: false,
    reportFilename: 'bundle-report.html'
  })
];

// 2. 压缩JS
const TerserPlugin = require('terser-webpack-plugin');

optimization: {
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true,      // 删除console
          drop_debugger: true,     // 删除debugger
          pure_funcs: ['console.log'],  // 删除特定函数
          dead_code: true          // 删除死代码
        },
        mangle: {
          safari10: true  // 解决Safari 10/11的bug
        }
      },
      extractComments: false  // 不提取注释到单独文件
    })
  ]
}

// 3. 压缩CSS
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

optimization: {
  minimizer: [
    new CssMinimizerPlugin({
      minimizerOptions: {
        preset: [
          'default',
          {
            discardComments: { removeAll: true }
          }
        ]
      }
    })
  ]
}

// 4. 压缩HTML
const HtmlWebpackPlugin = require('html-webpack-plugin');

plugins: [
  new HtmlWebpackPlugin({
    minify: {
      removeComments: true,
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true
    }
  })
];

// 5. Gzip压缩
const CompressionWebpackPlugin = require('compression-webpack-plugin');

plugins: [
  new CompressionWebpackPlugin({
    test: /\.(js|css|html)$/,
    threshold: 10240,  // 只压缩大于10KB的文件
    algorithm: 'gzip',
    deleteOriginalAssets: false  // 保留原文件
  })
];

// 6. 图片压缩
module: {
  rules: [
    {
      test: /\.(png|jpg|jpeg|gif)$/,
      type: 'asset',
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024  // 小于8KB转base64
        }
      },
      generator: {
        filename: 'images/[name].[contenthash:8][ext]'
      },
      use: [
        {
          loader: 'image-webpack-loader',
          options: {
            mozjpeg: {
              progressive: true,
              quality: 65
            },
            optipng: {
              enabled: false
            },
            pngquant: {
              quality: [0.65, 0.90],
              speed: 4
            },
            gifsicle: {
              interlaced: false
            },
            webp: {
              quality: 75
            }
          }
        }
      ]
    }
  ]
}

// 7. 使用CDN
output: {
  publicPath: 'https://cdn.example.com/'
}

externals: {
  'react': 'React',
  'react-dom': 'ReactDOM',
  'lodash': '_'
}

// HTML中引入
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>

// 8. 按需加载第三方库
// Ant Design按需加载
module: {
  rules: [
    {
      test: /\.jsx?$/,
      use: {
        loader: 'babel-loader',
        options: {
          plugins: [
            ['import', {
              libraryName: 'antd',
              style: true
            }]
          ]
        }
      }
    }
  ]
}

// 使用
import { Button, Table } from 'antd';  // 只打包Button和Table

// 9. Polyfill按需加载
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', {
      useBuiltIns: 'usage',  // 按需引入polyfill
      corejs: 3
    }]
  ]
};

// 10. Scope Hoisting
plugins: [
  new webpack.optimize.ModuleConcatenationPlugin()
];
```

### 体积优化效果

```javascript
// 优化前
// main.js: 800KB
// vendor.js: 500KB
// styles.css: 150KB
// 总计: 1.45MB

// 优化后
// main.js: 250KB (压缩 + Tree Shaking)
// vendor.js: 180KB (CDN + 按需加载)
// styles.css: 45KB (压缩 + PurgeCSS)
// main.js.gz: 80KB (Gzip)
// vendor.js.gz: 60KB (Gzip)
// styles.css.gz: 12KB (Gzip)
// 总计: 152KB (减少89.5%)

// 各优化策略贡献度
/*
代码压缩: -400KB (28%)
Tree Shaking: -300KB (21%)
CDN外部化: -250KB (17%)
按需加载: -200KB (14%)
Gzip压缩: -150KB (10%)
其他优化: -140KB (10%)
*/
```

## 7. 实战案例

### 大型React项目优化

```javascript
// 完整的Webpack配置（生产环境）

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',

  entry: {
    main: './src/index.js'
  },

  output: {
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'components': path.resolve(__dirname, 'src/components'),
      'utils': path.resolve(__dirname, 'src/utils')
    },
    modules: [path.resolve(__dirname, 'node_modules')]
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: path.resolve(__dirname, 'src'),
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                ['@babel/preset-env', {
                  useBuiltIns: 'usage',
                  corejs: 3
                }],
                '@babel/preset-react'
              ],
              plugins: [
                ['import', {
                  libraryName: 'antd',
                  style: true
                }]
              ]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024
          }
        },
        generator: {
          filename: 'images/[name].[contenthash:8][ext]'
        }
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true
      }
    }),

    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].chunk.css'
    }),

    new CompressionWebpackPlugin({
      test: /\.(js|css)$/,
      threshold: 10240,
      algorithm: 'gzip'
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    }),

    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ],

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log']
          }
        }
      }),
      new CssMinimizerPlugin()
    ],

    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
          name: 'react',
          priority: 20
        },
        antd: {
          test: /[\\/]node_modules[\\/]antd[\\/]/,
          name: 'antd',
          priority: 15
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        },
        common: {
          minChunks: 2,
          name: 'common',
          priority: 5
        }
      }
    },

    runtimeChunk: {
      name: 'runtime'
    },

    moduleIds: 'deterministic',
    chunkIds: 'deterministic'
  },

  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack_cache')
  },

  performance: {
    maxAssetSize: 250000,
    maxEntrypointSize: 250000,
    hints: 'warning'
  }
};

// 优化效果
/*
优化前:
- 首次构建: 120s
- 二次构建: 95s
- bundle大小: 1.8MB
- 首屏加载: 4.5s

优化后:
- 首次构建: 35s (提升71%)
- 二次构建: 8s (提升92%)
- bundle大小: 380KB (减少79%)
- 首屏加载: 1.2s (提升73%)
*/
```

Webpack优化是一个系统工程，需要从构建速度、打包体积、缓存策略等多个维度综合考虑！
