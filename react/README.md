# React 原理精简总结

本文档是基于 React v17.0.2 源码的精简版原理总结，内容提炼自 [react-illustration-series](https://github.com/7kms/react-illustration-series) 仓库。

## 目录结构

- [basics/](./basics/) - React 基础概念
  - [01-宏观架构.md](./basics/01-宏观架构.md) - React 包结构和架构分层
  - [02-工作循环.md](./basics/02-工作循环.md) - 任务调度循环和 Fiber 构造循环
  - [03-核心对象.md](./basics/03-核心对象.md) - ReactElement、Fiber、Update 等核心对象

- [core/](./core/) - React 运行核心
  - [01-启动流程.md](./core/01-启动流程.md) - React 应用启动过程
  - [02-reconciler工作流程.md](./core/02-reconciler工作流程.md) - Reconciler 的四个阶段
  - [03-调度原理.md](./core/03-调度原理.md) - Scheduler 调度机制
  - [04-优先级管理.md](./core/04-优先级管理.md) - Lane 模型和优先级体系
  - [05-fiber树构造.md](./core/05-fiber树构造.md) - Fiber 树的构建过程

- [hooks/](./hooks/) - Hooks 原理
  - [01-Hook概览.md](./hooks/01-Hook概览.md) - Hook 机制总览
  - [02-状态Hook.md](./hooks/02-状态Hook.md) - useState 和 useReducer 原理

## 进阶专题

- [setState完整流程.md](./setState完整流程.md) - 从 setState 到页面更新的完整过程
- [React事件机制.md](./React事件机制.md) - React 合成事件系统原理

## 学习路径

建议按以下顺序阅读：

### 入门路径
1. **基础概念** - 理解 React 的整体架构和核心对象
2. **运行核心** - 深入了解 React 的运作机制
3. **Hooks 原理** - 掌握 Hook 的实现原理

### 进阶路径
4. **setState 完整流程** - 串联所有知识点，理解完整的更新流程
5. **React 事件机制** - 理解 React 如何与浏览器交互

## 核心要点速览

### React 架构分层

```
┌─────────────────────────────────────┐
│         接口层 (react 包)            │
│    提供 setState、Hook 等 API        │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│            内核层                    │
│  ┌─────────────────────────────┐   │
│  │  Scheduler (调度器)          │   │
│  │  - 执行回调                  │   │
│  │  - 任务队列管理              │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Reconciler (构造器)         │   │
│  │  - 接收更新请求              │   │
│  │  - 构造 Fiber 树             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Renderer (渲染器)           │   │
│  │  - 启动应用                  │   │
│  │  - 渲染 DOM                  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 两大工作循环

1. **任务调度循环** (Scheduler)
   - 基于二叉堆数据结构
   - 控制所有任务的调度执行
   - 实现时间切片和可中断渲染

2. **Fiber 构造循环** (Reconciler)
   - 基于树形结构的深度优先遍历
   - 构造完整的 Fiber 树
   - 是任务调度循环中 task 的一部分

### 核心流程

```
输入 (setState/Hook)
  ↓
注册调度任务
  ↓
执行任务回调
  ├─ Fiber 树构造
  └─ 异常处理
  ↓
输出 (commitRoot)
  ├─ Before Mutation
  ├─ Mutation (DOM 变更)
  └─ Layout
```

## 版本说明

本文档基于 React v17.0.2 版本，React 18 及以后版本可能会有所变化。

## 参考资料

- [React 官方文档](https://react.dev/)
- [React 源码](https://github.com/facebook/react)
- [React Illustration Series](https://github.com/7kms/react-illustration-series)
