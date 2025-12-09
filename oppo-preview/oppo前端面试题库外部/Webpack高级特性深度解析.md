# Webpack高级特性深度解析

> 深入解析Webpack的Hash生成机制、AST抽象语法树和Babel原理

---

## 目录

1. [Webpack Hash生成机制](#1-webpack-hash生成机制)
2. [AST抽象语法树](#2-ast抽象语法树)
3. [Babel原理详解](#3-babel原理详解)
4. [实战应用](#4-实战应用)

---

## 1. Webpack Hash生成机制

### 1.1 为什么需要Hash

**核心目的**：
- 浏览器缓存控制
- 文件变更检测
- 版本管理

```javascript
// 没有Hash
main.js         // 浏览器会缓存，更新后用户可能看不到新版本

// 有Hash
main.a3f7b2c.js // 内容变化后Hash变化，浏览器重新加载
main.d8e9f1a.js // 新版本
```

### 1.2 Webpack中的三种Hash

#### 1.2.1 hash - 项目级Hash

**特点**：
- 整个项目只有一个hash
- 任何文件变化，所有文件的hash都会改变
- 不推荐使用（缓存效果差）

```javascript
// webpack.config.js
module.exports = {
    output: {
        filename: '[name].[hash].js',
        path: path.resolve(__dirname, 'dist')
    }
}

// 构建结果
// 第一次构建
main.a3f7b2c8d9e1.js
vendor.a3f7b2c8d9e1.js

// 修改main.js后再次构建
main.f4e8d3c2b1a0.js     // hash变了
vendor.f4e8d3c2b1a0.js   // hash也变了（即使内容没变）❌
```

**生成原理**：

```javascript
// Webpack内部实现（简化版）
class Compilation {
    constructor() {
        this.hash = null;
    }

    // 生成项目级hash
    createHash() {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');

        // 将所有模块内容加入hash计算
        this.modules.forEach(module => {
            hash.update(module.source());
        });

        // 将所有chunk内容加入hash计算
        this.chunks.forEach(chunk => {
            hash.update(chunk.files.join(','));
        });

        this.hash = hash.digest('hex').substring(0, 20);
        return this.hash;
    }
}
```

#### 1.2.2 chunkhash - Chunk级Hash ⭐⭐⭐

**特点**：
- 每个chunk有自己的hash
- 只有chunk内容变化，hash才变化
- 推荐用于JS文件

```javascript
// webpack.config.js
module.exports = {
    entry: {
        main: './src/index.js',
        vendor: './src/vendor.js'
    },
    output: {
        filename: '[name].[chunkhash].js'
    }
}

// 构建结果
// 第一次构建
main.a3f7b2c.js
vendor.d8e9f1a.js

// 修改main.js后再次构建
main.f4e8d3c.js       // hash变了 ✅
vendor.d8e9f1a.js     // hash没变 ✅（缓存有效）
```

**生成原理**：

```javascript
// Chunk Hash生成
class Chunk {
    constructor(name) {
        this.name = name;
        this.modules = [];
        this.hash = null;
    }

    // 生成chunk级hash
    createChunkHash() {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');

        // 1. 添加chunk的modules内容
        this.modules.forEach(module => {
            hash.update(module.source());
        });

        // 2. 添加chunk的依赖关系
        this.modules.forEach(module => {
            module.dependencies.forEach(dep => {
                hash.update(dep.request);
            });
        });

        // 3. 添加chunk的id（保证唯一性）
        hash.update(this.id || this.name);

        this.hash = hash.digest('hex').substring(0, 20);
        return this.hash;
    }
}

// 实际使用示例
const chunk = new Chunk('main');
chunk.modules = [
    { source: () => 'console.log("hello")' },
    { source: () => 'export default {}' }
];
console.log(chunk.createChunkHash()); // "a3f7b2c8d9e1f4e8d3c2"
```

**问题：CSS和JS使用相同的chunkhash**

```javascript
// 问题场景
entry: {
    main: './src/index.js'  // 内部import './style.css'
}

// 构建结果
main.a3f7b2c.js
main.a3f7b2c.css  // 和JS用同一个chunkhash

// 问题：修改CSS后，JS的hash也会变化
// 因为它们在同一个chunk中
```

#### 1.2.3 contenthash - 内容级Hash ⭐⭐⭐

**特点**：
- 根据文件内容生成hash
- 只有文件内容变化，hash才变化
- 推荐用于CSS文件

```javascript
// webpack.config.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    output: {
        filename: '[name].[chunkhash].js'
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css'  // 使用contenthash
        })
    ]
}

// 构建结果
main.a3f7b2c.js
main.d8e9f1a.css

// 修改CSS后
main.a3f7b2c.js       // JS的hash没变 ✅
main.f4e8d3c.css      // CSS的hash变了 ✅
```

**生成原理**：

```javascript
// Content Hash生成
class Asset {
    constructor(source) {
        this.source = source;
    }

    // 生成内容hash
    getContentHash() {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');

        // 只根据文件内容生成hash
        hash.update(this.source);

        return hash.digest('hex').substring(0, 20);
    }
}

// MiniCssExtractPlugin内部实现（简化版）
class MiniCssExtractPlugin {
    apply(compiler) {
        compiler.hooks.emit.tap('MiniCssExtractPlugin', compilation => {
            compilation.chunks.forEach(chunk => {
                // 提取CSS内容
                const cssSource = this.extractCss(chunk);

                // 生成contenthash
                const asset = new Asset(cssSource);
                const contentHash = asset.getContentHash();

                // 替换占位符
                const filename = this.options.filename
                    .replace('[name]', chunk.name)
                    .replace('[contenthash]', contentHash);

                // 输出文件
                compilation.assets[filename] = {
                    source: () => cssSource,
                    size: () => cssSource.length
                };
            });
        });
    }
}
```

### 1.3 Hash长度控制

```javascript
// webpack.config.js
module.exports = {
    output: {
        // 默认20位，可以指定长度
        filename: '[name].[chunkhash:8].js',  // 8位hash
        // 或者
        filename: '[name].[chunkhash:16].js'  // 16位hash
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash:10].css'  // 10位hash
        })
    ]
}
```

### 1.4 Hash冲突问题

**问题**：不同内容可能生成相同的Hash（虽然概率极低）

```javascript
// 模拟Hash冲突检测
class HashManager {
    constructor() {
        this.hashMap = new Map();
    }

    // 生成hash并检测冲突
    generateHash(content, filename) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5')
            .update(content)
            .digest('hex')
            .substring(0, 20);

        // 检测冲突
        if (this.hashMap.has(hash)) {
            const existingFile = this.hashMap.get(hash);

            // 如果不是同一个文件，说明发生冲突
            if (existingFile !== filename) {
                console.warn(`Hash collision detected!`);
                console.warn(`  File 1: ${existingFile}`);
                console.warn(`  File 2: ${filename}`);
                console.warn(`  Hash: ${hash}`);

                // 解决方案1：增加hash长度
                // 解决方案2：添加文件名到hash计算
                // 解决方案3：添加时间戳
                const extendedHash = crypto.createHash('md5')
                    .update(content + filename + Date.now())
                    .digest('hex')
                    .substring(0, 20);

                this.hashMap.set(extendedHash, filename);
                return extendedHash;
            }
        }

        this.hashMap.set(hash, filename);
        return hash;
    }
}

// Webpack内部的处理
class Compilation {
    getHashDigest(content, hashType, hashDigestType, maxLength) {
        const crypto = require('crypto');
        const hash = crypto.createHash(hashType);

        // 添加内容
        hash.update(content);

        // 可以添加额外信息减少冲突
        if (this.fullHash) {
            hash.update(this.fullHash);
        }

        // 生成最终hash
        return hash
            .digest(hashDigestType)
            .substring(0, maxLength);
    }
}
```

### 1.5 最佳实践

```javascript
// webpack.config.js - 生产环境配置
module.exports = {
    mode: 'production',
    entry: {
        app: './src/index.js'
    },
    output: {
        // JS使用chunkhash
        filename: 'js/[name].[chunkhash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].chunk.js',
        path: path.resolve(__dirname, 'dist')
    },
    optimization: {
        // 提取runtime到单独文件
        runtimeChunk: {
            name: 'runtime'
        },
        // 代码分割
        splitChunks: {
            cacheGroups: {
                // 提取第三方库
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 10
                },
                // 提取公共代码
                common: {
                    minChunks: 2,
                    name: 'common',
                    chunks: 'all',
                    priority: 5
                }
            }
        },
        // 模块ID使用hash而不是数字
        moduleIds: 'deterministic'
    },
    plugins: [
        // CSS使用contenthash
        new MiniCssExtractPlugin({
            filename: 'css/[name].[contenthash:8].css',
            chunkFilename: 'css/[name].[contenthash:8].chunk.css'
        }),
        // HTML自动注入hash后的文件
        new HtmlWebpackPlugin({
            template: './public/index.html',
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        })
    ]
}

// 构建结果
dist/
  ├── js/
  │   ├── app.a3f7b2c8.js           // 应用代码（会变）
  │   ├── vendors.d8e9f1a2.js       // 第三方库（很少变）
  │   ├── common.f4e8d3c2.js        // 公共代码（偶尔变）
  │   └── runtime.b1a0e7d6.js       // 运行时（经常变）
  ├── css/
  │   └── app.c2b1a0e7.css          // 样式文件
  └── index.html                     // 自动注入带hash的文件
```

---

## 2. AST抽象语法树

### 2.1 什么是AST

**AST (Abstract Syntax Tree)** - 抽象语法树：
- 源代码的树状表示
- 每个节点代表代码中的一个结构
- 编译器和构建工具的核心数据结构

```javascript
// 源代码
const answer = 40 + 2;

// AST结构（简化版）
{
    type: "Program",
    body: [{
        type: "VariableDeclaration",
        kind: "const",
        declarations: [{
            type: "VariableDeclarator",
            id: {
                type: "Identifier",
                name: "answer"
            },
            init: {
                type: "BinaryExpression",
                operator: "+",
                left: {
                    type: "Literal",
                    value: 40
                },
                right: {
                    type: "Literal",
                    value: 2
                }
            }
        }]
    }]
}
```

### 2.2 AST的生成过程

```javascript
// 1. 词法分析（Lexical Analysis）- 分词
function tokenize(code) {
    const tokens = [];
    let current = 0;

    while (current < code.length) {
        let char = code[current];

        // 跳过空白字符
        if (/\s/.test(char)) {
            current++;
            continue;
        }

        // 识别数字
        if (/[0-9]/.test(char)) {
            let value = '';
            while (/[0-9]/.test(char)) {
                value += char;
                char = code[++current];
            }
            tokens.push({ type: 'number', value });
            continue;
        }

        // 识别标识符和关键字
        if (/[a-zA-Z]/.test(char)) {
            let value = '';
            while (/[a-zA-Z0-9_]/.test(char)) {
                value += char;
                char = code[++current];
            }

            // 判断是关键字还是标识符
            const keywords = ['const', 'let', 'var', 'function', 'if', 'else'];
            const type = keywords.includes(value) ? 'keyword' : 'identifier';

            tokens.push({ type, value });
            continue;
        }

        // 识别运算符
        if (/[+\-*\/=]/.test(char)) {
            tokens.push({ type: 'operator', value: char });
            current++;
            continue;
        }

        // 识别分隔符
        if (/[;,\(\)\{\}]/.test(char)) {
            tokens.push({ type: 'separator', value: char });
            current++;
            continue;
        }

        throw new Error(`Unknown character: ${char}`);
    }

    return tokens;
}

// 测试
const code = 'const answer = 40 + 2;';
const tokens = tokenize(code);
console.log(tokens);
// [
//   { type: 'keyword', value: 'const' },
//   { type: 'identifier', value: 'answer' },
//   { type: 'operator', value: '=' },
//   { type: 'number', value: '40' },
//   { type: 'operator', value: '+' },
//   { type: 'number', value: '2' },
//   { type: 'separator', value: ';' }
// ]
```

```javascript
// 2. 语法分析（Syntax Analysis）- 生成AST
function parse(tokens) {
    let current = 0;

    function walk() {
        let token = tokens[current];

        // 解析数字字面量
        if (token.type === 'number') {
            current++;
            return {
                type: 'NumberLiteral',
                value: token.value
            };
        }

        // 解析变量声明
        if (token.type === 'keyword' &&
            ['const', 'let', 'var'].includes(token.value)) {
            const kind = token.value;
            current++; // 跳过关键字

            const id = tokens[current]; // 变量名
            current++;

            current++; // 跳过 =

            const init = parseExpression(); // 解析初始值

            current++; // 跳过 ;

            return {
                type: 'VariableDeclaration',
                kind,
                declarations: [{
                    type: 'VariableDeclarator',
                    id: {
                        type: 'Identifier',
                        name: id.value
                    },
                    init
                }]
            };
        }

        throw new Error(`Unknown token: ${token.type}`);
    }

    function parseExpression() {
        let left = walk();

        // 解析二元表达式
        if (current < tokens.length &&
            tokens[current].type === 'operator') {
            const operator = tokens[current].value;
            current++;

            const right = walk();

            return {
                type: 'BinaryExpression',
                operator,
                left,
                right
            };
        }

        return left;
    }

    const ast = {
        type: 'Program',
        body: []
    };

    while (current < tokens.length) {
        ast.body.push(walk());
    }

    return ast;
}

// 测试
const ast = parse(tokens);
console.log(JSON.stringify(ast, null, 2));
```

### 2.3 AST的遍历和转换

```javascript
// 访问者模式遍历AST
class ASTVisitor {
    constructor() {
        this.visitors = {};
    }

    // 注册访问者
    register(nodeType, visitor) {
        this.visitors[nodeType] = visitor;
    }

    // 遍历AST
    traverse(node, parent = null) {
        // 调用对应的访问者
        if (this.visitors[node.type]) {
            this.visitors[node.type](node, parent);
        }

        // 递归遍历子节点
        const keys = Object.keys(node);
        for (const key of keys) {
            const child = node[key];

            if (Array.isArray(child)) {
                child.forEach(c => {
                    if (typeof c === 'object' && c.type) {
                        this.traverse(c, node);
                    }
                });
            } else if (typeof child === 'object' && child && child.type) {
                this.traverse(child, node);
            }
        }
    }
}

// 使用示例：将所有const转换为var
const visitor = new ASTVisitor();

visitor.register('VariableDeclaration', (node, parent) => {
    if (node.kind === 'const') {
        console.log(`Found const declaration: ${node.declarations[0].id.name}`);
        // 转换为var
        node.kind = 'var';
    }
});

visitor.register('NumberLiteral', (node, parent) => {
    console.log(`Found number: ${node.value}`);
});

visitor.traverse(ast);
```

### 2.4 实际工具中的AST

```javascript
// 使用 @babel/parser 解析代码
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const code = `
    const add = (a, b) => a + b;
    const result = add(1, 2);
`;

// 1. 解析成AST
const ast = parser.parse(code, {
    sourceType: 'module'
});

// 2. 遍历和转换AST
traverse(ast, {
    // 转换箭头函数为普通函数
    ArrowFunctionExpression(path) {
        console.log('Found arrow function');

        // 这里可以进行转换
        // path.replaceWith(...) 替换节点
        // path.remove() 删除节点
        // path.insertBefore(...) 插入节点
    },

    // 查找所有const声明
    VariableDeclaration(path) {
        if (path.node.kind === 'const') {
            console.log(`Const variable: ${path.node.declarations[0].id.name}`);
        }
    }
});

// 3. 生成代码
const output = generate(ast, {}, code);
console.log(output.code);
```

---

## 3. Babel原理详解

### 3.1 Babel是什么

**Babel** - JavaScript编译器：
- 将ES6+代码转换为ES5
- 支持JSX、TypeScript等
- 插件化架构

**核心流程**：
```
源代码 → 解析(Parse) → 转换(Transform) → 生成(Generate) → 目标代码
```

### 3.2 Babel工作流程

```javascript
// Babel完整流程实现（简化版）
class SimpleBabel {
    constructor(plugins = []) {
        this.plugins = plugins;
    }

    // 1. 解析 - Parse
    parse(code) {
        // 使用@babel/parser
        const parser = require('@babel/parser');

        return parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });
    }

    // 2. 转换 - Transform
    transform(ast) {
        const traverse = require('@babel/traverse').default;

        // 应用所有插件
        this.plugins.forEach(plugin => {
            traverse(ast, plugin.visitor);
        });

        return ast;
    }

    // 3. 生成 - Generate
    generate(ast) {
        const generate = require('@babel/generator').default;

        return generate(ast, {
            comments: true,
            compact: false
        });
    }

    // 完整编译流程
    compile(code) {
        // 1. 解析
        const ast = this.parse(code);

        // 2. 转换
        const transformedAST = this.transform(ast);

        // 3. 生成
        const output = this.generate(transformedAST);

        return output.code;
    }
}
```

### 3.3 实现Babel插件

```javascript
// 插件1：箭头函数转换
const arrowFunctionPlugin = {
    name: 'transform-arrow-functions',
    visitor: {
        ArrowFunctionExpression(path) {
            const { node } = path;
            const { params, body } = node;

            // 转换为普通函数
            const functionExpression = {
                type: 'FunctionExpression',
                params,
                body: body.type === 'BlockStatement'
                    ? body
                    : {
                        type: 'BlockStatement',
                        body: [{
                            type: 'ReturnStatement',
                            argument: body
                        }]
                    },
                async: node.async,
                generator: false
            };

            path.replaceWith(functionExpression);
        }
    }
};

// 插件2：const转换为var
const constToVarPlugin = {
    name: 'transform-const-to-var',
    visitor: {
        VariableDeclaration(path) {
            if (path.node.kind === 'const') {
                path.node.kind = 'var';
            }
        }
    }
};

// 插件3：模板字符串转换
const templateLiteralPlugin = {
    name: 'transform-template-literals',
    visitor: {
        TemplateLiteral(path) {
            const { quasis, expressions } = path.node;

            // 将模板字符串转换为字符串拼接
            let result = null;

            for (let i = 0; i < quasis.length; i++) {
                const quasi = quasis[i];
                const expr = expressions[i];

                // 添加字符串部分
                const str = {
                    type: 'StringLiteral',
                    value: quasi.value.cooked
                };

                if (!result) {
                    result = str;
                } else {
                    result = {
                        type: 'BinaryExpression',
                        operator: '+',
                        left: result,
                        right: str
                    };
                }

                // 添加表达式部分
                if (expr) {
                    result = {
                        type: 'BinaryExpression',
                        operator: '+',
                        left: result,
                        right: expr
                    };
                }
            }

            path.replaceWith(result);
        }
    }
};

// 使用示例
const babel = new SimpleBabel([
    arrowFunctionPlugin,
    constToVarPlugin,
    templateLiteralPlugin
]);

const code = `
    const add = (a, b) => a + b;
    const name = 'World';
    const greeting = \`Hello, \${name}!\`;
`;

const output = babel.compile(code);
console.log(output);

// 输出：
// var add = function(a, b) {
//     return a + b;
// };
// var name = 'World';
// var greeting = 'Hello, ' + name + '!';
```

### 3.4 Babel配置文件

```javascript
// .babelrc.js
module.exports = {
    // 预设 - 一组插件的集合
    presets: [
        [
            '@babel/preset-env',
            {
                // 目标环境
                targets: {
                    browsers: ['> 1%', 'last 2 versions', 'not dead'],
                    node: 'current'
                },
                // 只转换需要的特性
                useBuiltIns: 'usage',
                // core-js版本
                corejs: 3,
                // 不转换模块语法（交给webpack处理）
                modules: false
            }
        ],
        '@babel/preset-react',      // React JSX
        '@babel/preset-typescript'  // TypeScript
    ],

    // 插件 - 单个转换规则
    plugins: [
        // 装饰器
        ['@babel/plugin-proposal-decorators', { legacy: true }],

        // 类属性
        ['@babel/plugin-proposal-class-properties', { loose: true }],

        // 动态导入
        '@babel/plugin-syntax-dynamic-import',

        // 可选链
        '@babel/plugin-proposal-optional-chaining',

        // 空值合并
        '@babel/plugin-proposal-nullish-coalescing-operator',

        // 生产环境移除console
        process.env.NODE_ENV === 'production' && 'transform-remove-console'
    ].filter(Boolean),

    // 环境配置
    env: {
        development: {
            plugins: ['react-refresh/babel']
        },
        production: {
            plugins: [
                'transform-remove-console',
                'transform-remove-debugger'
            ]
        },
        test: {
            presets: [
                ['@babel/preset-env', { targets: { node: 'current' } }]
            ]
        }
    }
}
```

### 3.5 Babel在Webpack中的应用

```javascript
// webpack.config.js
module.exports = {
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        // 缓存编译结果
                        cacheDirectory: true,

                        // 生产环境压缩
                        cacheCompression: process.env.NODE_ENV === 'production',

                        // Babel配置
                        presets: [
                            '@babel/preset-env',
                            '@babel/preset-react'
                        ],

                        plugins: [
                            // 按需导入
                            [
                                'import',
                                {
                                    libraryName: 'antd',
                                    libraryDirectory: 'es',
                                    style: 'css'
                                }
                            ]
                        ]
                    }
                }
            }
        ]
    }
}
```

---

## 4. 实战应用

### 4.1 实现代码压缩插件

```javascript
// 基于AST的代码压缩
class MinifyPlugin {
    apply(compiler) {
        compiler.hooks.emit.tap('MinifyPlugin', compilation => {
            Object.keys(compilation.assets).forEach(filename => {
                if (!filename.endsWith('.js')) return;

                const asset = compilation.assets[filename];
                const source = asset.source();

                // 压缩代码
                const minified = this.minify(source);

                compilation.assets[filename] = {
                    source: () => minified,
                    size: () => minified.length
                };
            });
        });
    }

    minify(code) {
        const parser = require('@babel/parser');
        const traverse = require('@babel/traverse').default;
        const generate = require('@babel/generator').default;

        // 解析
        const ast = parser.parse(code);

        // 转换 - 移除注释、console等
        traverse(ast, {
            // 移除console.log
            CallExpression(path) {
                if (
                    path.node.callee.type === 'MemberExpression' &&
                    path.node.callee.object.name === 'console'
                ) {
                    path.remove();
                }
            },

            // 移除debugger
            DebuggerStatement(path) {
                path.remove();
            }
        });

        // 生成 - 压缩格式
        const output = generate(ast, {
            comments: false,
            compact: true,
            minified: true
        });

        return output.code;
    }
}
```

### 4.2 实现代码分析工具

```javascript
// 代码复杂度分析
class CodeComplexityAnalyzer {
    analyze(code) {
        const parser = require('@babel/parser');
        const traverse = require('@babel/traverse').default;

        const ast = parser.parse(code);

        const stats = {
            functions: 0,
            classes: 0,
            ifStatements: 0,
            loops: 0,
            complexity: 0
        };

        traverse(ast, {
            FunctionDeclaration() {
                stats.functions++;
                stats.complexity++;
            },

            ClassDeclaration() {
                stats.classes++;
            },

            IfStatement() {
                stats.ifStatements++;
                stats.complexity++;
            },

            ForStatement() {
                stats.loops++;
                stats.complexity += 2;
            },

            WhileStatement() {
                stats.loops++;
                stats.complexity += 2;
            }
        });

        return stats;
    }
}

// 使用
const analyzer = new CodeComplexityAnalyzer();
const code = `
    function test() {
        if (true) {
            for (let i = 0; i < 10; i++) {
                console.log(i);
            }
        }
    }
`;

console.log(analyzer.analyze(code));
// { functions: 1, classes: 0, ifStatements: 1, loops: 1, complexity: 4 }
```

---

## 总结

### 核心要点

1. **Webpack Hash**
   - hash: 项目级（不推荐）
   - chunkhash: chunk级（JS推荐）
   - contenthash: 内容级（CSS推荐）

2. **AST抽象语法树**
   - 源代码的树状表示
   - 编译器的核心数据结构
   - 解析 → 遍历 → 转换 → 生成

3. **Babel原理**
   - Parse（解析）→ Transform（转换）→ Generate（生成）
   - 插件化架构
   - 访问者模式遍历AST

### 最佳实践

1. **Hash使用**
   - JS文件用 [chunkhash]
   - CSS文件用 [contenthash]
   - 图片等静态资源用 [contenthash]

2. **Babel配置**
   - 使用 @babel/preset-env
   - 按需加载polyfill
   - 开启缓存提升性能

3. **性能优化**
   - 使用 babel-loader 的 cacheDirectory
   - 合理拆分chunk
   - 提取runtime和vendor

**最后更新**: 2025-12-09
