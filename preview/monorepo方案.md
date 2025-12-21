# Monorepo 多包管理方案详解

## 一、什么是 Monorepo

Monorepo（单体仓库）是一种将多个项目或包存放在同一个代码仓库中的软件开发策略。与之相对的是 Polyrepo（多仓库），即每个项目独立一个仓库。

## 二、适用场景

### 2.1 适合使用 Monorepo 的场景

1. **多个关联项目**
   - 需要共享代码的多个前端应用（如：管理后台、用户端、移动端）
   - 组件库及其文档站点、示例项目
   - 微前端架构中的多个子应用

2. **代码复用需求高**
   - 多个项目共享工具函数、组件、类型定义
   - 需要统一的 UI 组件库和业务组件
   - 共享配置文件（ESLint、TypeScript、Webpack 等）

3. **版本管理诉求**
   - 需要保证多个包之间的版本一致性
   - 希望原子化提交（一次 commit 更新多个包）
   - 需要统一的依赖版本管理

4. **团队协作优势**
   - 跨项目重构更容易（一次 PR 搞定）
   - 代码审查更全面（能看到改动的影响范围）
   - 新人上手成本低（只需 clone 一个仓库）

5. **工程化需求**
   - 统一的构建流程和 CI/CD 配置
   - 统一的代码规范和测试标准
   - 集中式的依赖管理和安全审计

### 2.2 不适合使用 Monorepo 的场景

1. **完全独立的项目**：项目间没有代码共享需求
2. **访问权限隔离**：不同项目需要严格的权限控制
3. **技术栈差异大**：项目间使用完全不同的技术栈
4. **仓库体积过大**：Git 操作性能受到严重影响

## 三、主流 Monorepo 方案对比

### 3.1 基于包管理器的 Workspace 方案

#### pnpm Workspace（推荐）

**特点：**
- 基于硬链接和符号链接，节省磁盘空间
- 严格的依赖管理，避免幽灵依赖
- 性能最优，安装速度快
- 内置 Workspace 支持

**配置示例：**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
```

```json
// package.json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r --filter './packages/*' build",
    "dev": "pnpm --parallel -r dev"
  }
}
```

**适用场景：**
- 现代前端项目的首选方案
- 对依赖管理有严格要求的项目
- 需要高性能包管理的大型项目

#### Yarn Workspace

**特点：**
- Yarn Classic 和 Yarn Berry（v2+）都支持
- 扁平化依赖结构
- 良好的生态支持

**配置示例：**

```json
// package.json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**适用场景：**
- 已使用 Yarn 的项目迁移
- 需要成熟生态支持的项目

#### npm Workspace

**特点：**
- npm v7+ 原生支持
- 配置简单
- 性能和功能相对较弱

**适用场景：**
- 不想引入额外工具的小型项目
- 对 npm 有强依赖的项目

### 3.2 Lerna

**特点：**
- 老牌 Monorepo 工具
- 提供版本管理和发布能力
- 可与 pnpm/yarn workspace 结合使用

**配置示例：**

```json
// lerna.json
{
  "version": "independent",
  "npmClient": "pnpm",
  "useWorkspaces": true,
  "packages": ["packages/*"],
  "command": {
    "publish": {
      "conventionalCommits": true,
      "message": "chore(release): publish"
    }
  }
}
```

**适用场景：**
- 需要发布多个 npm 包的场景
- 需要复杂版本管理的项目
- 需要自动化发布流程

### 3.3 Turborepo

**特点：**
- 专注于构建性能优化
- 智能任务调度和缓存
- 增量构建和远程缓存
- 并行任务执行

**配置示例：**

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    }
  }
}
```

**适用场景：**
- 大型项目，构建时间长
- 需要 CI/CD 优化的项目
- 团队规模大，需要远程缓存

### 3.4 Nx

**特点：**
- 功能最全面的 Monorepo 解决方案
- 强大的依赖图分析
- 智能的增量构建
- 丰富的代码生成器
- 支持多种框架（React、Vue、Angular、Node 等）

**配置示例：**

```json
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "cacheableOperations": ["build", "test", "lint"],
        "accessToken": "your-token"
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

**适用场景：**
- 企业级大型项目
- 需要完整工程化方案的项目
- 多框架混合的项目

### 3.5 Changesets

**特点：**
- 专注于版本管理和 Changelog 生成
- 支持独立版本和固定版本
- 优秀的 PR 工作流集成
- 可与任何 Workspace 方案结合

**配置示例：**

```json
// .changeset/config.json
{
  "changelog": "@changesets/changelog-github",
  "commit": false,
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

**适用场景：**
- 需要精细化版本管理的开源项目
- 需要自动生成 Changelog
- 团队协作发布流程

## 四、多包构建策略

### 4.1 构建工具选择

#### Rollup
- **适用于：** 组件库、工具库
- **优势：** Tree-shaking 效果好，输出代码干净
- **配置：** 支持多入口、多输出格式（ESM、CJS、UMD）

#### Webpack
- **适用于：** 完整应用构建
- **优势：** 生态丰富，插件多
- **配置：** Module Federation 支持微前端

#### Vite
- **适用于：** 现代前端应用
- **优势：** 开发体验好，构建速度快
- **配置：** 原生 ESM，按需编译

#### Turbopack
- **适用于：** Next.js 项目
- **优势：** 极致性能，Rust 编写
- **配置：** 与 Next.js 深度集成

#### Tsup
- **适用于：** TypeScript 库
- **优势：** 零配置，基于 esbuild
- **配置：** 简单快速，支持 DTS 生成

### 4.2 构建策略

#### 1. 拓扑排序构建

```bash
# 按依赖顺序构建
pnpm -r --filter './packages/*' build
```

**原理：**
- 根据包之间的依赖关系排序
- 先构建被依赖的包，再构建依赖方
- 确保构建顺序正确

#### 2. 增量构建

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    }
  }
}
```

**原理：**
- 检测文件变化
- 只重新构建变化的包及其依赖方
- 利用缓存提升速度

#### 3. 并行构建

```bash
# pnpm 并行构建
pnpm --parallel -r build

# Turborepo 自动并行
turbo run build
```

**原理：**
- 无依赖关系的包可以并行构建
- 充分利用多核 CPU
- 大幅缩短总构建时间

#### 4. 远程缓存

```json
// turbo.json
{
  "remoteCache": {
    "signature": true
  }
}
```

**原理：**
- 将构建产物上传到云端
- 团队成员共享构建缓存
- CI/CD 可复用本地构建结果

### 4.3 依赖管理策略

#### 1. 提升公共依赖

```json
// 根目录 package.json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

**优势：**
- 确保工具版本统一
- 减少重复安装
- 简化配置管理

#### 2. 严格依赖声明

```json
// packages/shared/package.json
{
  "dependencies": {
    "lodash-es": "^4.17.21"
  },
  "peerDependencies": {
    "react": ">=17.0.0"
  }
}
```

**优势：**
- 避免隐式依赖
- 明确版本要求
- 防止运行时错误

#### 3. 依赖版本锁定

```yaml
# .npmrc 或 .yarnrc.yml
save-exact=true
```

**优势：**
- 避免意外更新
- 确保构建可重现
- 减少线上问题

### 4.4 构建优化技巧

#### 1. 使用 SWC/esbuild 替代 Babel/TSC

```javascript
// vite.config.ts
export default {
  esbuild: {
    target: 'es2020'
  }
}
```

**提升：** 10-100 倍编译速度

#### 2. 配置合理的 outputs

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**", "!dist/**/*.map"]
    }
  }
}
```

**提升：** 减少不必要的缓存存储

#### 3. 拆分构建任务

```json
{
  "scripts": {
    "build:tsc": "tsc --build",
    "build:bundle": "rollup -c",
    "build": "pnpm run build:tsc && pnpm run build:bundle"
  }
}
```

**提升：** 更精细的缓存控制

#### 4. 配置 CI 缓存

```yaml
# GitHub Actions
- uses: actions/cache@v3
  with:
    path: |
      ~/.pnpm-store
      node_modules
      .turbo
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**提升：** CI 构建时间减少 50-80%

## 五、实践建议

### 5.1 推荐技术栈组合

**轻量级方案：**
- pnpm workspace + Tsup + Changesets

**全功能方案：**
- pnpm workspace + Turborepo + Changesets

**企业级方案：**
- pnpm workspace + Nx + Changesets

### 5.2 目录结构示例

```
my-monorepo/
├── apps/                    # 应用层
│   ├── web/                # 主应用
│   ├── admin/              # 管理后台
│   └── mobile/             # 移动端
├── packages/               # 包层
│   ├── ui/                 # UI 组件库
│   ├── utils/              # 工具函数
│   ├── types/              # 类型定义
│   ├── config/             # 共享配置
│   └── hooks/              # 共享 Hooks
├── .changeset/             # Changesets 配置
├── turbo.json              # Turborepo 配置
├── pnpm-workspace.yaml     # pnpm workspace 配置
└── package.json            # 根 package.json
```

### 5.3 最佳实践

1. **统一的代码规范**：使用 ESLint、Prettier、Husky
2. **统一的提交规范**：使用 Commitlint、Commitizen
3. **统一的测试标准**：单元测试覆盖率要求
4. **合理的包划分**：按功能和复用程度划分
5. **文档先行**：每个包都应有清晰的 README
6. **自动化发布**：配置 CI/CD 自动发布流程

## 六、常见问题

### 6.1 如何处理循环依赖？

**方案：**
1. 提取公共依赖到新包
2. 使用依赖注入
3. 重新设计包的职责划分

### 6.2 如何处理版本不一致？

**方案：**
1. 使用 `pnpm dedupe` 去重
2. 配置 `overrides` 强制版本
3. 使用 `syncpack` 工具检查版本

### 6.3 构建速度慢怎么办？

**方案：**
1. 启用增量构建和缓存
2. 使用更快的构建工具（esbuild、SWC）
3. 配置远程缓存
4. 优化依赖图，减少不必要的依赖

---

## 七、实战案例分析

### 7.1 案例：大型电商平台 Monorepo 架构

**背景：**
- 10+ 个前端应用（用户端、商家端、管理后台、小程序等）
- 100+ 个共享组件和工具包
- 50+ 人的前端团队

**技术选型：**
- pnpm workspace（依赖管理）
- Turborepo（构建优化）
- Changesets（版本管理）
- Nx（可视化和分析）

**架构设计：**

```
ecommerce-monorepo/
├── apps/
│   ├── customer-web/          # 用户端 Web（Next.js）
│   ├── merchant-web/          # 商家端 Web（React + Vite）
│   ├── admin-web/             # 管理后台（React + Vite）
│   ├── customer-h5/           # 用户端 H5（React + Vite）
│   └── mini-program/          # 小程序（Taro）
├── packages/
│   ├── ui/                    # UI 组件库
│   │   ├── button/
│   │   ├── form/
│   │   └── table/
│   ├── business-components/   # 业务组件
│   │   ├── product-card/
│   │   ├── order-list/
│   │   └── user-profile/
│   ├── utils/                 # 工具函数
│   │   ├── format/
│   │   ├── validate/
│   │   └── request/
│   ├── hooks/                 # 共享 Hooks
│   ├── types/                 # TypeScript 类型
│   ├── constants/             # 常量定义
│   ├── config/                # 配置文件
│   │   ├── eslint-config/
│   │   ├── tsconfig/
│   │   └── vite-config/
│   └── apis/                  # API 封装
│       ├── user/
│       ├── product/
│       └── order/
├── tools/                     # 工程化工具
│   ├── cli/                   # 脚手架
│   ├── scripts/               # 构建脚本
│   └── generators/            # 代码生成器
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**核心配置：**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "type-check": {
      "outputs": []
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

**效果：**
- 构建时间从 45 分钟降至 8 分钟（使用缓存后 2 分钟）
- 代码复用率提升 60%
- 发布效率提升 80%
- 减少 40% 的重复代码

### 7.2 案例：开源组件库 Monorepo

**背景：**
- 需要维护 React、Vue、Angular 三个版本
- 50+ 个组件
- 需要提供完整的文档站点和示例

**技术选型：**
- pnpm workspace
- Vite（组件构建）
- VitePress（文档站点）
- Changesets（版本发布）

**架构设计：**

```
ui-library/
├── packages/
│   ├── react/                 # React 版本
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── vue/                   # Vue 版本
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── angular/               # Angular 版本
│   ├── core/                  # 核心逻辑（框架无关）
│   ├── theme/                 # 主题样式
│   └── icons/                 # 图标库
├── apps/
│   ├── docs/                  # 文档站点（VitePress）
│   └── playground/            # 在线演示
├── examples/                  # 示例项目
│   ├── react-example/
│   ├── vue-example/
│   └── angular-example/
└── scripts/
    ├── build.ts
    ├── release.ts
    └── gen-types.ts
```

**发布流程：**

```bash
# 1. 添加 changeset
pnpm changeset

# 2. 版本更新
pnpm changeset version

# 3. 构建所有包
pnpm build

# 4. 发布到 npm
pnpm changeset publish

# 5. 推送 tag
git push --follow-tags
```

**CI/CD 配置：**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 八、迁移指南

### 8.1 从 Polyrepo 迁移到 Monorepo

**步骤 1：规划仓库结构**

```bash
# 1. 创建新的 monorepo 仓库
mkdir my-monorepo && cd my-monorepo
pnpm init

# 2. 创建目录结构
mkdir -p apps packages
```

**步骤 2：迁移现有项目**

```bash
# 使用 git subtree 保留历史记录
git subtree add --prefix=apps/web \
  https://github.com/org/web-app.git main

git subtree add --prefix=apps/admin \
  https://github.com/org/admin-app.git main
```

**步骤 3：配置 workspace**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**步骤 4：提取公共代码**

```bash
# 创建共享包
mkdir -p packages/shared
cd packages/shared
pnpm init

# 将公共代码移动到 shared 包
# 更新其他包的依赖引用
```

**步骤 5：统一配置**

```bash
# 根目录安装公共依赖
pnpm add -Dw typescript eslint prettier

# 创建共享配置包
mkdir -p packages/config
```

### 8.2 常见迁移问题

**问题 1：路径引用错误**

```typescript
// 迁移前
import { utils } from '../../../shared/utils'

// 迁移后
import { utils } from '@myapp/shared'
```

**解决方案：** 配置 TypeScript paths 和包别名

**问题 2：构建顺序问题**

```json
// 配置构建依赖
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]  // 先构建依赖包
    }
  }
}
```

**问题 3：版本冲突**

```bash
# 使用 pnpm 检查版本
pnpm list --depth=0

# 使用 syncpack 统一版本
npx syncpack fix-mismatches
```

## 九、性能优化实战

### 9.1 构建性能优化

**优化前：** 全量构建耗时 15 分钟

```json
// 基础配置
{
  "scripts": {
    "build": "pnpm -r build"
  }
}
```

**优化后：** 增量构建耗时 2 分钟

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    }
  }
}
```

**关键优化点：**
1. 启用 Turborepo 缓存
2. 配置正确的 outputs
3. 使用 esbuild/SWC 替代传统编译器
4. 配置远程缓存

### 9.2 开发体验优化

**热更新优化：**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    fs: {
      // 允许访问 workspace 中的文件
      allow: ['..']
    }
  },
  optimizeDeps: {
    // 预构建 workspace 依赖
    include: ['@myapp/ui', '@myapp/utils']
  }
})
```

**TypeScript 性能优化：**

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "composite": true,
    "skipLibCheck": true
  },
  "references": [
    { "path": "./packages/ui" },
    { "path": "./packages/utils" }
  ]
}
```

### 9.3 CI/CD 优化

**并行任务：**

```yaml
# GitHub Actions
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - run: pnpm build
```

**缓存策略：**

```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.pnpm-store
      **/node_modules
      **/.turbo
    key: ${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-
```

## 十、总结

### 10.1 何时选择 Monorepo

**建议使用：**
- 多个关联项目需要协同开发
- 团队规模 5 人以上
- 需要统一的工程化标准
- 代码复用需求强烈

**建议观望：**
- 项目完全独立
- 团队规模小于 3 人
- 技术栈差异巨大
- Git 性能存在瓶颈

### 10.2 技术选型建议

| 项目规模 | 推荐方案 | 理由 |
|---------|---------|------|
| 小型（<5 包） | pnpm workspace | 简单够用 |
| 中型（5-20 包） | pnpm + Turborepo | 性能和功能平衡 |
| 大型（>20 包） | pnpm + Nx | 完整工程化方案 |

### 10.3 关键成功因素

1. **团队共识**：确保团队理解 Monorepo 的价值
2. **合理规划**：提前设计好目录结构和依赖关系
3. **工具支持**：选择合适的工具链
4. **文档完善**：维护清晰的开发文档
5. **持续优化**：根据实际情况调整方案

---

希望这篇文章能帮助你全面理解 Monorepo 的理论与实践！
