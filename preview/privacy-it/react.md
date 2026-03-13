1、react 16 -- fiber架构 - 异步可中断
diff递归可能会阻塞主线程，老架构：协调层 + 渲染层

架构修改：三层：调度层 + 协调层 + 渲染层
数据结构修改：链表
优先级：lane模型 不同任务不同到期时间
两大wookloop:task work loop/ rendere阶段beginwork loop
react react-dom react-reconciler scheduler
