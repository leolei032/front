# Web端错误监控平台搭建方案

## 一、概述

### 1.1 目标

构建一套完整的Web端错误监控体系,实现:

- **全面捕获**: JavaScript错误、Promise异常、资源加载失败、接口异常等
- **实时上报**: 错误发生时立即上报,支持离线缓存
- **智能分析**: 错误聚合、影响面分析、根因定位
- **告警通知**: 关键错误实时告警,支持多渠道通知
- **可视化展示**: 错误趋势、分布、影响用户数等多维度展示

### 1.2 核心价值

- **快速发现问题**: 用户反馈前主动发现线上问题
- **精准定位**: 完整的错误上下文,快速还原问题现场
- **量化影响**: 了解错误影响的用户数和业务范围
- **持续优化**: 基于数据驱动的质量改进

---

## 二、架构设计

### 2.1 整体架构

#### 2.1.1 五层架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   数据采集层 (Client Side)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ JS错误  │ │ 资源错误│ │ 接口错误│ │ 自定义  │          │
│  │ 监控    │ │ 监控    │ │ 监控    │ │ 错误    │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Promise  │ │白屏检测 │ │性能异常 │ │用户行为 │          │
│  │异常监控 │ │        │ │监控     │ │追踪     │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据上报层 (Client Side)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 节流控制 │ 队列缓冲 │ 批量上报 │ 失败重试 │ 离线存储 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 数据压缩 │ 优先级队列 │ 采样策略 │ 数据脱敏          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/Beacon
┌─────────────────────────────────────────────────────────────┐
│                   数据处理层 (Server Side)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 数据接收网关 (Nginx + Node.js/Go)                     │   │
│  │ 负载均衡 │ 数据验证 │ 限流防刷 │ 请求签名验证        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 消息队列 (Kafka/RabbitMQ)                             │   │
│  │ 削峰填谷 │ 异步解耦 │ 数据分发                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │数据清洗 │ │聚合分析 │ │错误分组 │ │根源分析 │          │
│  │去重/过滤│ │指纹生成 │ │智能聚类 │ │相关性   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │SourceMap│ │影响分析 │ │告警判断 │ │实时计算 │          │
│  │解析还原 │ │用户/业务│ │规则引擎 │ │(Flink)  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据存储层 (Storage)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │实时缓存 │ │时序数据 │ │文档数据 │ │数据仓库 │          │
│  │(Redis)  │ │(Influx) │ │(ES/Mongo│ │(Hive/   │          │
│  │         │ │         │ │)        │ │ClickHou)│          │
│  │去重/限流│ │趋势分析 │ │详情查询 │ │离线分析 │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐                                                │
│  │对象存储 │  SourceMap文件、用户行为录屏                   │
│  │(OSS/S3) │                                                │
│  └─────────┘                                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   应用服务层 (Application)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │监控面板 │ │告警系统 │ │源映射   │ │数据API  │          │
│  │(Dash)   │ │(Alert)  │ │(Source  │ │(REST/   │          │
│  │         │ │         │ │Map)     │ │GraphQL) │          │
│  │实时大屏 │ │多渠道   │ │堆栈还原 │ │数据查询 │          │
│  │错误详情 │ │钉钉/邮件│ │代码定位 │ │统计分析 │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │用户管理 │ │权限控制 │ │配置中心 │ │工单系统 │          │
│  │团队协作 │ │RBAC     │ │规则管理 │ │问题跟踪 │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

#### 2.1.2 架构对比分析

**您的架构优势** ✅

1. **层次更清晰**: 五层架构职责分明,易于理解和维护
2. **数据上报层独立**: 强调了客户端上报策略的重要性(节流、缓冲、重试)
3. **数据仓库**: 引入Hive做离线分析,适合大数据场景
4. **应用服务层完整**: 明确了监控面板、告警、API等应用层服务

**原架构优势** ✅

1. **网关层细化**: 明确了负载均衡、限流防刷等网关职责
2. **消息队列**: 引入Kafka做异步解耦和削峰填谷
3. **实时计算**: 使用Flink做流式处理
4. **对象存储**: 专门存储SourceMap文件

**改进建议** 🚀

| 层级           | 当前设计      | 建议改进                                      | 理由                          |
| -------------- | ------------- | --------------------------------------------- | ----------------------------- |
| **数据采集层** | 基础错误类型  | ➕ 白屏检测<br>➕ 性能异常监控<br>➕ 卡顿监控 | 扩展监控维度,提升问题发现能力 |
| **数据上报层** | 批量上报+重试 | ➕ 优先级队列<br>➕ 数据压缩<br>➕ 智能采样   | 优化上报性能,降低带宽成本     |
| **数据处理层** | 实时+批处理   | ➕ 流批一体<br>➕ 数据血缘追踪<br>➕ 质量监控 | 提升数据处理效率和可靠性      |
| **数据存储层** | 多数据库      | ➕ 冷热分离<br>➕ 数据归档<br>➕ 成本优化     | 平衡性能和成本                |
| **应用服务层** | 基础功能      | ➕ 用户管理<br>➕ 工单系统<br>➕ 团队协作     | 完善产品化能力                |

### 2.2 架构设计要点详解

#### 2.2.1 数据采集层增强

**新增监控能力**

```typescript
// 1. 白屏检测
class WhiteScreenDetector {
  detect() {
    // 关键元素检测
    const checkPoints = [
      { selector: '#app', weight: 50 },
      { selector: '.main-content', weight: 30 },
      { selector: 'img', weight: 10 },
      { selector: 'canvas', weight: 10 }
    ];

    let score = 0;
    checkPoints.forEach((point) => {
      const element = document.querySelector(point.selector);
      if (element && this.isVisible(element)) {
        score += point.weight;
      }
    });

    if (score < 50) {
      this.reportWhiteScreen({
        score,
        timestamp: Date.now(),
        url: location.href,
        screenshot: this.captureScreenshot()
      });
    }
  }

  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
}

// 2. 性能异常监控
class PerformanceAnomalyDetector {
  private thresholds = {
    fcp: 2500, // First Contentful Paint
    lcp: 4000, // Largest Contentful Paint
    fid: 100, // First Input Delay
    cls: 0.1, // Cumulative Layout Shift
    tti: 5000, // Time to Interactive
    longTask: 50 // Long Task (ms)
  };

  monitor() {
    // 监控Core Web Vitals
    this.monitorWebVitals();
    // 监控长任务
    this.monitorLongTasks();
    // 监控内存泄漏
    this.monitorMemoryLeak();
  }

  private monitorWebVitals() {
    // 使用web-vitals库
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => this.checkThreshold('cls', metric.value));
      getFID((metric) => this.checkThreshold('fid', metric.value));
      getFCP((metric) => this.checkThreshold('fcp', metric.value));
      getLCP((metric) => this.checkThreshold('lcp', metric.value));
      getTTFB((metric) => this.checkThreshold('ttfb', metric.value));
    });
  }

  private monitorLongTasks() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.thresholds.longTask) {
            this.reportLongTask({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  private monitorMemoryLeak() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

        if (usageRatio > 0.9) {
          this.reportMemoryLeak({
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usageRatio
          });
        }
      }, 30000); // 每30秒检查一次
    }
  }
}

// 3. 卡顿监控
class JankMonitor {
  private lastFrameTime = Date.now();
  private frameCount = 0;

  start() {
    this.checkFrame();
  }

  private checkFrame() {
    const now = Date.now();
    const delta = now - this.lastFrameTime;

    // 超过100ms认为是卡顿
    if (delta > 100) {
      this.reportJank({
        duration: delta,
        timestamp: now,
        frameCount: this.frameCount
      });
    }

    this.lastFrameTime = now;
    this.frameCount++;
    requestAnimationFrame(() => this.checkFrame());
  }
}
```

#### 2.2.2 数据上报层优化

**智能上报策略**

```typescript
class SmartReporter {
  private queue: PriorityQueue<ErrorData>;
  private config: ReporterConfig;

  constructor(config: ReporterConfig) {
    this.queue = new PriorityQueue({
      comparator: (a, b) => b.priority - a.priority
    });
    this.config = config;
  }

  // 1. 优先级队列
  report(data: ErrorData) {
    // 计算优先级
    const priority = this.calculatePriority(data);

    this.queue.enqueue({
      ...data,
      priority,
      timestamp: Date.now()
    });

    // 高优先级立即上报
    if (priority >= 8) {
      this.flushImmediate();
    }
  }

  private calculatePriority(data: ErrorData): number {
    let priority = 5; // 基础优先级

    // 错误级别
    if (data.level === 'error') priority += 3;
    else if (data.level === 'warning') priority += 1;

    // 错误类型
    if (data.type === 'jsError') priority += 2;
    else if (data.type === 'apiError' && data.status >= 500) priority += 2;

    // 业务关键页面
    if (this.isCriticalPage(data.context.page.url)) priority += 2;

    // 影响用户操作
    if (data.blocksUserAction) priority += 3;

    return Math.min(priority, 10);
  }

  // 2. 数据压缩
  private async compress(data: any[]): Promise<Blob> {
    const jsonString = JSON.stringify(data);

    // 使用CompressionStream API (Chrome 80+)
    if ('CompressionStream' in window) {
      const stream = new Blob([jsonString]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      return new Response(compressedStream).blob();
    }

    // 降级: 使用pako库
    const pako = await import('pako');
    const compressed = pako.gzip(jsonString);
    return new Blob([compressed]);
  }

  // 3. 智能采样
  private shouldSample(data: ErrorData): boolean {
    // 基于错误指纹的采样
    const fingerprint = this.generateFingerprint(data);
    const hash = this.hashCode(fingerprint);

    // 同一错误在时间窗口内只采样一定比例
    const sampleRate = this.getSampleRate(data);
    return hash % 100 < sampleRate * 100;
  }

  private getSampleRate(data: ErrorData): number {
    // 动态采样率
    const rates = {
      error: 1.0, // 错误100%
      warning: 0.5, // 警告50%
      info: 0.1, // 信息10%
      debug: 0.01 // 调试1%
    };

    // 生产环境降低采样率
    if (this.config.environment === 'prod') {
      return rates[data.level] * 0.5;
    }

    return rates[data.level] || 1.0;
  }

  // 4. 网络状态自适应
  private async send(data: ErrorData[]) {
    // 检查网络状态
    const connection = (navigator as any).connection;
    if (connection) {
      // 弱网环境下减少上报
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // 只上报高优先级错误
        data = data.filter((item) => item.priority >= 8);
      }

      // 省流量模式
      if (connection.saveData) {
        data = data.filter((item) => item.priority >= 7);
      }
    }

    // 压缩后上报
    const compressed = await this.compress(data);

    return fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      },
      body: compressed,
      keepalive: true
    });
  }
}
```

#### 2.2.3 数据处理层架构

**流批一体处理**

```typescript
// 使用Flink实现流批一体
public class UnifiedErrorProcessing {
    public static void main(String[] args) throws Exception {
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // 1. 实时流处理
        DataStream<ErrorEvent> realtimeStream = env
            .addSource(new FlinkKafkaConsumer<>("errors", schema, props))
            .assignTimestampsAndWatermarks(watermarkStrategy);

        // 2. 批处理数据源
        DataStream<ErrorEvent> batchStream = env
            .fromSource(fileSource, WatermarkStrategy.noWatermarks(), "batch-source");

        // 3. 统一处理逻辑
        SingleOutputStreamOperator<ErrorAggregate> processed =
            realtimeStream.union(batchStream)
                .keyBy(ErrorEvent::getFingerprint)
                .window(TumblingEventTimeWindows.of(Time.minutes(5)))
                .aggregate(new ErrorAggregator())
                .process(new EnrichmentFunction());

        // 4. 多路输出
        processed.addSink(new ElasticsearchSink<>());  // 实时查询
        processed.addSink(new InfluxDBSink<>());        // 时序分析
        processed.addSink(new HiveSink<>());            // 离线分析

        env.execute("Unified Error Processing");
    }
}
```

#### 2.2.4 数据存储层设计

**冷热分离策略**

```typescript
interface StorageStrategy {
  // 热数据: 最近7天,高频访问
  hot: {
    storage: 'Redis + Elasticsearch';
    retention: '7 days';
    queryLatency: '< 100ms';
    cost: 'High';
  };

  // 温数据: 8-30天,中频访问
  warm: {
    storage: 'Elasticsearch';
    retention: '30 days';
    queryLatency: '< 500ms';
    cost: 'Medium';
  };

  // 冷数据: 31-90天,低频访问
  cold: {
    storage: 'MongoDB';
    retention: '90 days';
    queryLatency: '< 2s';
    cost: 'Low';
  };

  // 归档数据: 90天以上,极少访问
  archive: {
    storage: 'OSS + Hive';
    retention: '1 year';
    queryLatency: '< 10s';
    cost: 'Very Low';
  };
}

// 自动数据迁移
class DataLifecycleManager {
  async migrate() {
    // 热 -> 温
    await this.migrateHotToWarm();
    // 温 -> 冷
    await this.migrateWarmToCold();
    // 冷 -> 归档
    await this.migrateColdToArchive();
    // 删除过期归档
    await this.deleteExpiredArchive();
  }

  private async migrateHotToWarm() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // 从Redis删除,保留在ES
    const keys = await redis.keys(`error:*`);
    for (const key of keys) {
      const data = await redis.get(key);
      const timestamp = JSON.parse(data).timestamp;

      if (timestamp < sevenDaysAgo) {
        await redis.del(key);
      }
    }
  }
}
```

#### 2.2.5 应用服务层完善

**产品化能力**

```typescript
// 1. 用户管理与权限控制
interface UserManagement {
  // 用户角色
  roles: {
    admin: {
      permissions: ['*'];
      description: '系统管理员,拥有所有权限';
    };
    developer: {
      permissions: ['view_errors', 'resolve_errors', 'comment'];
      description: '开发人员,可查看和处理错误';
    };
    viewer: {
      permissions: ['view_errors'];
      description: '只读用户,仅可查看';
    };
  };

  // 团队管理
  teams: {
    id: string;
    name: string;
    members: User[];
    projects: Project[];
  }[];

  // 项目隔离
  projects: {
    id: string;
    name: string;
    appId: string;
    team: string;
    environments: string[];
  }[];
}

// 2. 工单系统集成
class IssueTracker {
  // 自动创建工单
  async createIssue(error: ErrorAggregate) {
    // 判断是否需要创建工单
    if (error.count > 100 || error.affectedUsers > 50) {
      const issue = {
        title: `[${error.level.toUpperCase()}] ${error.message}`,
        description: this.formatDescription(error),
        priority: this.calculateIssuePriority(error),
        assignee: this.findOwner(error),
        labels: ['bug', 'auto-created', error.environment],
        links: {
          errorDetail: `https://monitor.example.com/errors/${error.fingerprint}`,
          sourceCode: this.getSourceCodeLink(error)
        }
      };

      // 集成Jira/GitHub Issues/GitLab Issues
      await this.jiraClient.createIssue(issue);
    }
  }

  private findOwner(error: ErrorAggregate): string {
    // 基于代码归属自动分配
    const filePath = this.extractFilePath(error.stack);
    const owner = this.codeOwners.find(filePath);
    return owner || 'unassigned';
  }
}

// 3. 智能告警降噪
class AlertDeduplication {
  // 告警聚合
  async aggregateAlerts(alerts: Alert[]): Promise<Alert[]> {
    const groups = new Map<string, Alert[]>();

    // 按相似度分组
    for (const alert of alerts) {
      const groupKey = this.findSimilarGroup(alert, groups);
      if (groupKey) {
        groups.get(groupKey)!.push(alert);
      } else {
        groups.set(alert.id, [alert]);
      }
    }

    // 合并同类告警
    return Array.from(groups.values()).map((group) => {
      if (group.length === 1) return group[0];

      return {
        ...group[0],
        message: `${group.length}个相似错误`,
        count: group.reduce((sum, a) => sum + a.count, 0),
        relatedAlerts: group.map((a) => a.id)
      };
    });
  }

  // 告警抑制
  async suppressAlerts(alert: Alert): Promise<boolean> {
    // 1. 维护窗口抑制
    if (await this.isInMaintenanceWindow()) {
      return true;
    }

    // 2. 已知问题抑制
    if (await this.isKnownIssue(alert.fingerprint)) {
      return true;
    }

    // 3. 频率限制
    if (await this.exceedsRateLimit(alert)) {
      return true;
    }

    return false;
  }
}
```

### 2.3 技术选型

#### 前端SDK

- **语言**: TypeScript (类型安全)
- **打包**: Rollup (体积优化)
- **存储**: IndexedDB + LocalStorage (离线缓存)

#### 数据接收层

- **网关**: Nginx + Node.js/Go (高性能)
- **消息队列**: Kafka/RabbitMQ (削峰填谷)
- **缓存**: Redis (去重、限流)

#### 数据处理层

- **流处理**: Flink/Spark Streaming (实时计算)
- **批处理**: Spark/Hadoop (离线分析)
- **SourceMap解析**: Node.js服务

#### 数据存储层

- **时序数据**: InfluxDB/TimescaleDB (错误趋势)
- **文档数据**: MongoDB/Elasticsearch (错误详情)
- **对象存储**: OSS/S3 (SourceMap文件)
- **缓存**: Redis (热点数据)

#### 展示层

- **前端框架**: React/Vue
- **可视化**: ECharts/D3.js
- **实时通信**: WebSocket

---

## 三、前端SDK设计

### 3.1 核心功能模块

#### 3.1.1 错误捕获模块

**1. JavaScript运行时错误**

```typescript
class ErrorCapture {
  // 全局错误捕获
  captureGlobalError() {
    window.addEventListener(
      'error',
      (event) => {
        const error = {
          type: 'jsError',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now()
        };
        this.report(error);
      },
      true
    );
  }

  // Promise未捕获异常
  captureUnhandledRejection() {
    window.addEventListener('unhandledrejection', (event) => {
      const error = {
        type: 'promiseError',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now()
      };
      this.report(error);
    });
  }

  // 资源加载失败
  captureResourceError() {
    window.addEventListener(
      'error',
      (event) => {
        const target = event.target as HTMLElement;
        if (target !== window) {
          const error = {
            type: 'resourceError',
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            timestamp: Date.now()
          };
          this.report(error);
        }
      },
      true
    );
  }
}
```

**2. 框架错误捕获**

```typescript
// React错误边界
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    monitor.captureError({
      type: 'reactError',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now()
    });
  }
}

// Vue错误处理
app.config.errorHandler = (err, instance, info) => {
  monitor.captureError({
    type: 'vueError',
    message: err.message,
    stack: err.stack,
    componentName: instance?.$options.name,
    info,
    timestamp: Date.now()
  });
};
```

**3. 接口错误捕获**

```typescript
class ApiInterceptor {
  // Fetch拦截
  interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.reportApiError({
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            duration: Date.now() - startTime
          });
        }
        return response;
      } catch (error) {
        this.reportApiError({
          url: args[0],
          error: error.message,
          duration: Date.now() - startTime
        });
        throw error;
      }
    };
  }

  // XMLHttpRequest拦截
  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
      this._requestInfo = { method: args[0], url: args[1] };
      return originalOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const startTime = Date.now();
      this.addEventListener('loadend', () => {
        if (this.status >= 400) {
          monitor.reportApiError({
            ...this._requestInfo,
            status: this.status,
            duration: Date.now() - startTime
          });
        }
      });
      return originalSend.apply(this, args);
    };
  }
}
```

#### 3.1.2 上下文信息收集

```typescript
interface ErrorContext {
  // 用户信息
  user: {
    id: string;
    name?: string;
    email?: string;
  };

  // 设备信息
  device: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    viewportSize: string;
    devicePixelRatio: number;
  };

  // 浏览器信息
  browser: {
    name: string;
    version: string;
    engine: string;
  };

  // 页面信息
  page: {
    url: string;
    referrer: string;
    title: string;
    loadTime: number;
  };

  // 应用信息
  app: {
    name: string;
    version: string;
    environment: 'dev' | 'test' | 'prod';
    buildId: string;
  };

  // 网络信息
  network: {
    effectiveType: string; // 4g, 3g, 2g, slow-2g
    downlink: number;
    rtt: number;
    saveData: boolean;
  };

  // 性能信息
  performance: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing: PerformanceTiming;
  };

  // 用户行为轨迹
  breadcrumbs: Breadcrumb[];
}

interface Breadcrumb {
  type: 'click' | 'navigation' | 'console' | 'xhr' | 'fetch';
  category: string;
  message: string;
  data?: any;
  timestamp: number;
  level: 'info' | 'warning' | 'error';
}
```

#### 3.1.3 用户行为追踪

```typescript
class BreadcrumbTracker {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;

  // 点击事件追踪
  trackClick() {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement;
        this.addBreadcrumb({
          type: 'click',
          category: 'user',
          message: `Clicked ${target.tagName}`,
          data: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            innerText: target.innerText?.slice(0, 50),
            xpath: this.getXPath(target)
          },
          timestamp: Date.now(),
          level: 'info'
        });
      },
      true
    );
  }

  // 路由变化追踪
  trackNavigation() {
    // History API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      this.addBreadcrumb({
        type: 'navigation',
        category: 'navigation',
        message: `Navigate to ${args[2]}`,
        data: { url: args[2] },
        timestamp: Date.now(),
        level: 'info'
      });
      return originalPushState.apply(history, args);
    };

    // Popstate
    window.addEventListener('popstate', () => {
      this.addBreadcrumb({
        type: 'navigation',
        category: 'navigation',
        message: `Navigate to ${location.href}`,
        data: { url: location.href },
        timestamp: Date.now(),
        level: 'info'
      });
    });
  }

  // Console追踪
  trackConsole() {
    ['log', 'info', 'warn', 'error'].forEach((level) => {
      const original = console[level];
      console[level] = (...args) => {
        this.addBreadcrumb({
          type: 'console',
          category: 'console',
          message: args.join(' '),
          data: { args },
          timestamp: Date.now(),
          level: level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info'
        });
        original.apply(console, args);
      };
    });
  }

  // XHR/Fetch追踪
  trackRequest() {
    // 在拦截器中添加breadcrumb
    this.addBreadcrumb({
      type: 'xhr',
      category: 'http',
      message: `${method} ${url}`,
      data: { method, url, status, duration },
      timestamp: Date.now(),
      level: status >= 400 ? 'error' : 'info'
    });
  }

  private addBreadcrumb(breadcrumb: Breadcrumb) {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getBreadcrumbs(): Breadcrumb[] {
    return this.breadcrumbs;
  }

  private getXPath(element: HTMLElement): string {
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';

    let path = '';
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) index++;
        sibling = sibling.previousElementSibling;
      }
      path = `/${current.tagName.toLowerCase()}[${index}]${path}`;
      current = current.parentElement;
    }

    return `/html/body${path}`;
  }
}
```

#### 3.1.4 数据上报模块

```typescript
class Reporter {
  private queue: ErrorData[] = [];
  private timer: number | null = null;
  private config: ReporterConfig;

  constructor(config: ReporterConfig) {
    this.config = {
      url: config.url,
      batchSize: config.batchSize || 10,
      batchInterval: config.batchInterval || 5000,
      maxRetry: config.maxRetry || 3,
      useBeacon: config.useBeacon !== false
    };
  }

  // 添加到队列
  report(data: ErrorData) {
    // 数据采样
    if (!this.shouldSample(data)) return;

    // 数据脱敏
    data = this.sanitize(data);

    // 添加到队列
    this.queue.push(data);

    // 立即上报的情况
    if (this.shouldReportImmediately(data)) {
      this.flush();
    } else if (this.queue.length >= this.config.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  // 批量上报
  private async flush() {
    if (this.queue.length === 0) return;

    const data = this.queue.splice(0, this.config.batchSize);

    try {
      await this.send(data);
    } catch (error) {
      // 上报失败,存入IndexedDB
      await this.saveToCache(data);
    }
  }

  // 发送数据
  private async send(data: ErrorData[], retry = 0): Promise<void> {
    const payload = {
      data,
      meta: {
        sdkVersion: SDK_VERSION,
        timestamp: Date.now()
      }
    };

    try {
      // 优先使用sendBeacon (页面卸载时可靠)
      if (this.config.useBeacon && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        const success = navigator.sendBeacon(this.config.url, blob);
        if (!success) throw new Error('sendBeacon failed');
      } else {
        // 使用fetch
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          keepalive: true // 页面卸载时保持连接
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }
    } catch (error) {
      if (retry < this.config.maxRetry) {
        // 指数退避重试
        await this.delay(Math.pow(2, retry) * 1000);
        return this.send(data, retry + 1);
      }
      throw error;
    }
  }

  // 采样策略
  private shouldSample(data: ErrorData): boolean {
    const { type, level } = data;

    // 错误级别采样率
    const sampleRates = {
      error: 1.0, // 错误100%采样
      warning: 0.5, // 警告50%采样
      info: 0.1 // 信息10%采样
    };

    return Math.random() < (sampleRates[level] || 1.0);
  }

  // 数据脱敏
  private sanitize(data: ErrorData): ErrorData {
    // 移除敏感信息
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
          result[key] = '[FILTERED]';
        } else {
          result[key] = sanitizeObject(obj[key]);
        }
      }
      return result;
    };

    return sanitizeObject(data);
  }

  // 离线缓存
  private async saveToCache(data: ErrorData[]) {
    try {
      const db = await this.openDB();
      const tx = db.transaction('errors', 'readwrite');
      const store = tx.objectStore('errors');

      for (const item of data) {
        await store.add(item);
      }

      await tx.done;
    } catch (error) {
      console.error('Failed to save to cache:', error);
    }
  }

  // 恢复离线数据
  async recoverCache() {
    try {
      const db = await this.openDB();
      const tx = db.transaction('errors', 'readonly');
      const store = tx.objectStore('errors');
      const cached = await store.getAll();

      if (cached.length > 0) {
        await this.send(cached);
        // 清除已上报的数据
        const clearTx = db.transaction('errors', 'readwrite');
        await clearTx.objectStore('errors').clear();
      }
    } catch (error) {
      console.error('Failed to recover cache:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ErrorMonitor', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('errors')) {
          db.createObjectStore('errors', { autoIncrement: true });
        }
      };
    });
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.config.batchInterval);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3.2 SDK初始化与配置

```typescript
interface MonitorConfig {
  // 基础配置
  appId: string;
  appName: string;
  appVersion: string;
  environment: 'dev' | 'test' | 'prod';

  // 上报配置
  reportUrl: string;
  batchSize?: number;
  batchInterval?: number;
  maxRetry?: number;

  // 采样配置
  sampleRate?: number;
  errorSampleRate?: number;

  // 用户信息
  user?: {
    id: string;
    name?: string;
    email?: string;
  };

  // 功能开关
  captureError?: boolean;
  captureUnhandledRejection?: boolean;
  captureResourceError?: boolean;
  captureApiError?: boolean;
  captureBreadcrumb?: boolean;

  // 过滤配置
  ignoreErrors?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];
  allowUrls?: (string | RegExp)[];

  // 钩子函数
  beforeSend?: (data: ErrorData) => ErrorData | null;
  afterSend?: (data: ErrorData) => void;

  // SourceMap配置
  enableSourceMap?: boolean;
  sourceMapUrl?: string;

  // 性能配置
  maxBreadcrumbs?: number;
  maxStackDepth?: number;
}

class ErrorMonitor {
  private config: MonitorConfig;
  private errorCapture: ErrorCapture;
  private breadcrumbTracker: BreadcrumbTracker;
  private reporter: Reporter;

  constructor(config: MonitorConfig) {
    this.config = this.normalizeConfig(config);
    this.init();
  }

  private init() {
    // 初始化各模块
    this.errorCapture = new ErrorCapture(this);
    this.breadcrumbTracker = new BreadcrumbTracker(this);
    this.reporter = new Reporter(this.config);

    // 启动错误捕获
    if (this.config.captureError) {
      this.errorCapture.captureGlobalError();
    }
    if (this.config.captureUnhandledRejection) {
      this.errorCapture.captureUnhandledRejection();
    }
    if (this.config.captureResourceError) {
      this.errorCapture.captureResourceError();
    }
    if (this.config.captureApiError) {
      this.errorCapture.captureApiError();
    }

    // 启动行为追踪
    if (this.config.captureBreadcrumb) {
      this.breadcrumbTracker.trackClick();
      this.breadcrumbTracker.trackNavigation();
      this.breadcrumbTracker.trackConsole();
      this.breadcrumbTracker.trackRequest();
    }

    // 恢复离线数据
    this.reporter.recoverCache();

    // 页面卸载时上报
    window.addEventListener('beforeunload', () => {
      this.reporter.flush();
    });
  }

  // 手动上报错误
  captureError(error: Error, extra?: any) {
    const errorData = this.buildErrorData(error, extra);
    this.reporter.report(errorData);
  }

  // 手动上报消息
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    const errorData = {
      type: 'message',
      message,
      level,
      timestamp: Date.now(),
      context: this.getContext()
    };
    this.reporter.report(errorData);
  }

  // 设置用户信息
  setUser(user: { id: string; name?: string; email?: string }) {
    this.config.user = user;
  }

  // 设置自定义标签
  setTag(key: string, value: string) {
    // 实现标签设置
  }

  // 设置自定义上下文
  setContext(key: string, value: any) {
    // 实现上下文设置
  }

  private buildErrorData(error: Error, extra?: any): ErrorData {
    return {
      type: 'jsError',
      message: error.message,
      stack: error.stack,
      level: 'error',
      timestamp: Date.now(),
      context: this.getContext(),
      breadcrumbs: this.breadcrumbTracker.getBreadcrumbs(),
      extra
    };
  }

  private getContext(): ErrorContext {
    return {
      user: this.config.user,
      device: this.getDeviceInfo(),
      browser: this.getBrowserInfo(),
      page: this.getPageInfo(),
      app: {
        name: this.config.appName,
        version: this.config.appVersion,
        environment: this.config.environment,
        buildId: BUILD_ID
      },
      network: this.getNetworkInfo(),
      performance: this.getPerformanceInfo()
    };
  }

  // ... 其他辅助方法
}

// 使用示例
const monitor = new ErrorMonitor({
  appId: 'your-app-id',
  appName: 'Your App',
  appVersion: '1.0.0',
  environment: 'prod',
  reportUrl: 'https://monitor.example.com/api/errors',
  sampleRate: 1.0,
  user: {
    id: '12345',
    name: 'John Doe'
  },
  ignoreErrors: [/Script error/i, /ResizeObserver loop limit exceeded/i],
  beforeSend: (data) => {
    // 自定义处理
    return data;
  }
});

// 导出全局实例
export default monitor;
```

---

## 四、数据接收与处理

### 4.1 接收网关设计

#### 4.1.1 Nginx配置

```nginx
upstream error_api {
    server 127.0.0.1:3000 weight=1;
    server 127.0.0.1:3001 weight=1;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name monitor.example.com;

    # SSL配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 限流配置
    limit_req_zone $binary_remote_addr zone=error_limit:10m rate=100r/s;
    limit_req zone=error_limit burst=200 nodelay;

    # 错误上报接口
    location /api/errors {
        limit_req zone=error_limit;

        # CORS配置
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }

        # 请求体大小限制
        client_max_body_size 1m;

        # 超时配置
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;

        # 代理到后端
        proxy_pass http://error_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 4.1.2 Node.js接收服务

```typescript
import express from 'express';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { z } from 'zod';

// 数据验证Schema
const ErrorDataSchema = z.object({
  type: z.enum(['jsError', 'promiseError', 'resourceError', 'apiError']),
  message: z.string(),
  stack: z.string().optional(),
  level: z.enum(['info', 'warning', 'error']),
  timestamp: z.number(),
  context: z.object({
    user: z
      .object({
        id: z.string()
      })
      .optional(),
    app: z.object({
      name: z.string(),
      version: z.string(),
      environment: z.string()
    }),
    page: z.object({
      url: z.string()
    })
  }),
  breadcrumbs: z.array(z.any()).optional()
});

class ErrorReceiver {
  private app: express.Application;
  private kafka: Kafka;
  private redis: Redis;
  private producer: any;

  constructor() {
    this.app = express();
    this.kafka = new Kafka({
      clientId: 'error-receiver',
      brokers: ['kafka:9092']
    });
    this.redis = new Redis({
      host: 'redis',
      port: 6379
    });
    this.init();
  }

  private async init() {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.setupMiddlewares();
    this.setupRoutes();
  }

  private setupMiddlewares() {
    this.app.use(express.json({ limit: '1mb' }));

    // 请求日志
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
  }

  private setupRoutes() {
    // 错误上报接口
    this.app.post('/api/errors', async (req, res) => {
      try {
        const { data, meta } = req.body;

        // 数据验证
        const validatedData = await this.validateData(data);
        if (!validatedData) {
          return res.status(400).json({ error: 'Invalid data' });
        }

        // 去重检查
        const isDuplicate = await this.checkDuplicate(validatedData);
        if (isDuplicate) {
          return res.status(200).json({ success: true, message: 'Duplicate' });
        }

        // 发送到Kafka
        await this.sendToKafka(validatedData);

        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  private async validateData(data: any[]): Promise<any[] | null> {
    try {
      return data.map((item) => ErrorDataSchema.parse(item));
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    }
  }

  private async checkDuplicate(data: any[]): Promise<boolean> {
    // 基于错误指纹去重
    for (const item of data) {
      const fingerprint = this.generateFingerprint(item);
      const key = `error:${fingerprint}`;

      const exists = await this.redis.exists(key);
      if (exists) {
        // 增加计数
        await this.redis.hincrby(key, 'count', 1);
        return true;
      } else {
        // 设置去重key,5分钟过期
        await this.redis.setex(key, 300, '1');
      }
    }
    return false;
  }

  private generateFingerprint(error: any): string {
    // 基于错误类型、消息、堆栈生成指纹
    const { type, message, stack, context } = error;
    const stackLines = stack?.split('\n').slice(0, 3).join('') || '';
    const fingerprint = `${type}:${message}:${stackLines}:${context.app.version}`;
    return require('crypto').createHash('md5').update(fingerprint).digest('hex');
  }

  private async sendToKafka(data: any[]) {
    await this.producer.send({
      topic: 'errors',
      messages: data.map((item) => ({
        key: item.context.user?.id || 'anonymous',
        value: JSON.stringify(item),
        timestamp: String(item.timestamp)
      }))
    });
  }

  start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`Error receiver listening on port ${port}`);
    });
  }
}

const receiver = new ErrorReceiver();
receiver.start();
```

### 4.2 数据处理流程

#### 4.2.1 实时处理 (Flink)

```java
public class ErrorProcessingJob {
    public static void main(String[] args) throws Exception {
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Kafka Source
        FlinkKafkaConsumer<String> consumer = new FlinkKafkaConsumer<>(
            "errors",
            new SimpleStringSchema(),
            kafkaProps
        );

        DataStream<ErrorEvent> errors = env
            .addSource(consumer)
            .map(json -> parseError(json))
            .assignTimestampsAndWatermarks(
                WatermarkStrategy
                    .<ErrorEvent>forBoundedOutOfOrderness(Duration.ofSeconds(5))
                    .withTimestampAssigner((event, timestamp) -> event.getTimestamp())
            );

        // 1. 错误聚合 (按指纹分组,5分钟窗口)
        DataStream<ErrorAggregate> aggregated = errors
            .keyBy(ErrorEvent::getFingerprint)
            .window(TumblingEventTimeWindows.of(Time.minutes(5)))
            .aggregate(new ErrorAggregateFunction());

        // 2. 影响用户数统计
        DataStream<ErrorImpact> impact = errors
            .keyBy(ErrorEvent::getFingerprint)
            .window(SlidingEventTimeWindows.of(Time.hours(1), Time.minutes(5)))
            .process(new ImpactCalculator());

        // 3. 告警判断
        DataStream<Alert> alerts = aggregated
            .filter(agg -> shouldAlert(agg))
            .map(agg -> createAlert(agg));

        // 4. SourceMap解析
        DataStream<ErrorEvent> resolved = errors
            .map(new SourceMapResolver());

        // 输出到不同的Sink
        aggregated.addSink(new MongoDBSink());
        impact.addSink(new InfluxDBSink());
        alerts.addSink(new AlertSink());
        resolved.addSink(new ElasticsearchSink());

        env.execute("Error Processing Job");
    }

    // 错误聚合函数
    public static class ErrorAggregateFunction
        implements AggregateFunction<ErrorEvent, ErrorAggregate, ErrorAggregate> {

        @Override
        public ErrorAggregate createAccumulator() {
            return new ErrorAggregate();
        }

        @Override
        public ErrorAggregate add(ErrorEvent error, ErrorAggregate acc) {
            acc.incrementCount();
            acc.addUser(error.getUserId());
            acc.updateFirstSeen(error.getTimestamp());
            acc.updateLastSeen(error.getTimestamp());
            if (acc.getSample() == null) {
                acc.setSample(error);
            }
            return acc;
        }

        @Override
        public ErrorAggregate getResult(ErrorAggregate acc) {
            return acc;
        }

        @Override
        public ErrorAggregate merge(ErrorAggregate a, ErrorAggregate b) {
            a.mergeWith(b);
            return a;
        }
    }

    // 影响计算
    public static class ImpactCalculator
        extends ProcessWindowFunction<ErrorEvent, ErrorImpact, String, TimeWindow> {

        @Override
        public void process(
            String fingerprint,
            Context context,
            Iterable<ErrorEvent> elements,
            Collector<ErrorImpact> out
        ) {
            Set<String> affectedUsers = new HashSet<>();
            long count = 0;

            for (ErrorEvent error : elements) {
                count++;
                if (error.getUserId() != null) {
                    affectedUsers.add(error.getUserId());
                }
            }

            ErrorImpact impact = new ErrorImpact();
            impact.setFingerprint(fingerprint);
            impact.setCount(count);
            impact.setAffectedUsers(affectedUsers.size());
            impact.setWindowStart(context.window().getStart());
            impact.setWindowEnd(context.window().getEnd());

            out.collect(impact);
        }
    }
}
```

#### 4.2.2 SourceMap解析服务

```typescript
import { SourceMapConsumer } from 'source-map';
import LRU from 'lru-cache';
import axios from 'axios';

class SourceMapResolver {
  private cache: LRU<string, SourceMapConsumer>;
  private ossClient: any; // OSS客户端

  constructor() {
    this.cache = new LRU({
      max: 100,
      ttl: 1000 * 60 * 60 // 1小时
    });
  }

  async resolveError(error: ErrorData): Promise<ErrorData> {
    if (!error.stack) return error;

    try {
      const resolvedStack = await this.resolveStack(error.stack, error.context.app.version);
      return {
        ...error,
        stack: resolvedStack,
        originalStack: error.stack
      };
    } catch (err) {
      console.error('Failed to resolve source map:', err);
      return error;
    }
  }

  private async resolveStack(stack: string, version: string): Promise<string> {
    const lines = stack.split('\n');
    const resolvedLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (!match) {
        resolvedLines.push(line);
        continue;
      }

      const [, func, file, lineStr, colStr] = match;
      const lineNo = parseInt(lineStr);
      const colNo = parseInt(colStr);

      try {
        const consumer = await this.getSourceMapConsumer(file, version);
        const original = consumer.originalPositionFor({
          line: lineNo,
          column: colNo
        });

        if (original.source) {
          const resolvedLine = `at ${original.name || func} (${original.source}:${original.line}:${original.column})`;
          resolvedLines.push(resolvedLine);
        } else {
          resolvedLines.push(line);
        }
      } catch (err) {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join('\n');
  }

  private async getSourceMapConsumer(file: string, version: string): Promise<SourceMapConsumer> {
    const cacheKey = `${version}:${file}`;

    // 检查缓存
    let consumer = this.cache.get(cacheKey);
    if (consumer) return consumer;

    // 从OSS下载SourceMap
    const sourceMapUrl = this.getSourceMapUrl(file, version);
    const response = await axios.get(sourceMapUrl);
    const sourceMap = response.data;

    // 创建Consumer
    consumer = await new SourceMapConsumer(sourceMap);
    this.cache.set(cacheKey, consumer);

    return consumer;
  }

  private getSourceMapUrl(file: string, version: string): string {
    // 构建SourceMap URL
    const filename = file.split('/').pop();
    return `https://sourcemaps.example.com/${version}/${filename}.map`;
  }
}

export default SourceMapResolver;
```

### 4.3 告警系统

```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  channels: AlertChannel[];
  enabled: boolean;
}

interface AlertCondition {
  // 错误数量阈值
  errorCount?: {
    threshold: number;
    window: number; // 时间窗口(秒)
  };

  // 影响用户数阈值
  affectedUsers?: {
    threshold: number;
    window: number;
  };

  // 错误率阈值
  errorRate?: {
    threshold: number; // 百分比
    window: number;
  };

  // 新错误
  isNewError?: boolean;

  // 错误级别
  level?: 'error' | 'warning' | 'info';

  // 环境
  environment?: string[];

  // 自定义条件
  custom?: (error: ErrorAggregate) => boolean;
}

interface AlertChannel {
  type: 'email' | 'sms' | 'webhook' | 'dingtalk' | 'slack';
  config: any;
}

class AlertManager {
  private rules: AlertRule[] = [];
  private alertHistory: Map<string, number> = new Map();

  constructor() {
    this.loadRules();
  }

  async checkAndAlert(aggregate: ErrorAggregate) {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (this.shouldAlert(aggregate, rule)) {
        await this.sendAlert(aggregate, rule);
      }
    }
  }

  private shouldAlert(aggregate: ErrorAggregate, rule: AlertRule): boolean {
    const { condition } = rule;

    // 检查错误数量
    if (condition.errorCount) {
      if (aggregate.count < condition.errorCount.threshold) {
        return false;
      }
    }

    // 检查影响用户数
    if (condition.affectedUsers) {
      if (aggregate.affectedUsers < condition.affectedUsers.threshold) {
        return false;
      }
    }

    // 检查错误率
    if (condition.errorRate) {
      const rate = this.calculateErrorRate(aggregate);
      if (rate < condition.errorRate.threshold) {
        return false;
      }
    }

    // 检查是否新错误
    if (condition.isNewError) {
      if (!aggregate.isNew) {
        return false;
      }
    }

    // 检查错误级别
    if (condition.level) {
      if (aggregate.level !== condition.level) {
        return false;
      }
    }

    // 检查环境
    if (condition.environment) {
      if (!condition.environment.includes(aggregate.environment)) {
        return false;
      }
    }

    // 自定义条件
    if (condition.custom) {
      if (!condition.custom(aggregate)) {
        return false;
      }
    }

    // 检查告警频率限制
    if (this.isAlertSuppressed(aggregate.fingerprint, rule.id)) {
      return false;
    }

    return true;
  }

  private async sendAlert(aggregate: ErrorAggregate, rule: AlertRule) {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      ruleName: rule.name,
      fingerprint: aggregate.fingerprint,
      message: aggregate.message,
      count: aggregate.count,
      affectedUsers: aggregate.affectedUsers,
      firstSeen: aggregate.firstSeen,
      lastSeen: aggregate.lastSeen,
      environment: aggregate.environment,
      level: aggregate.level,
      timestamp: Date.now()
    };

    // 发送到各个渠道
    for (const channel of rule.channels) {
      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    }

    // 记录告警历史
    this.recordAlert(aggregate.fingerprint, rule.id);
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel) {
    switch (channel.type) {
      case 'email':
        await this.sendEmail(alert, channel.config);
        break;
      case 'sms':
        await this.sendSMS(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhook(alert, channel.config);
        break;
      case 'dingtalk':
        await this.sendDingTalk(alert, channel.config);
        break;
      case 'slack':
        await this.sendSlack(alert, channel.config);
        break;
    }
  }

  private async sendDingTalk(alert: Alert, config: any) {
    const message = {
      msgtype: 'markdown',
      markdown: {
        title: `【${alert.level.toUpperCase()}】${alert.ruleName}`,
        text: `
### 错误告警

**错误信息**: ${alert.message}

**发生次数**: ${alert.count}

**影响用户**: ${alert.affectedUsers}

**环境**: ${alert.environment}

**首次出现**: ${new Date(alert.firstSeen).toLocaleString()}

**最近出现**: ${new Date(alert.lastSeen).toLocaleString()}

[查看详情](https://monitor.example.com/errors/${alert.fingerprint})
        `
      }
    };

    await axios.post(config.webhook, message);
  }

  private isAlertSuppressed(fingerprint: string, ruleId: string): boolean {
    const key = `${fingerprint}:${ruleId}`;
    const lastAlert = this.alertHistory.get(key);

    if (!lastAlert) return false;

    // 1小时内不重复告警
    const suppressWindow = 60 * 60 * 1000;
    return Date.now() - lastAlert < suppressWindow;
  }

  private recordAlert(fingerprint: string, ruleId: string) {
    const key = `${fingerprint}:${ruleId}`;
    this.alertHistory.set(key, Date.now());
  }

  private calculateErrorRate(aggregate: ErrorAggregate): number {
    // 从时序数据库查询总请求数,计算错误率
    // 简化实现
    return (aggregate.count / 10000) * 100;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadRules() {
    // 从数据库加载告警规则
    this.rules = [
      {
        id: 'rule_1',
        name: '生产环境高频错误',
        condition: {
          errorCount: { threshold: 100, window: 300 },
          environment: ['prod']
        },
        channels: [
          { type: 'dingtalk', config: { webhook: 'xxx' } },
          { type: 'email', config: { to: ['dev@example.com'] } }
        ],
        enabled: true
      },
      {
        id: 'rule_2',
        name: '新错误告警',
        condition: {
          isNewError: true,
          environment: ['prod']
        },
        channels: [{ type: 'dingtalk', config: { webhook: 'xxx' } }],
        enabled: true
      }
    ];
  }
}
```

---

## 五、数据存储设计

### 5.1 存储架构

```
错误原始数据 (Elasticsearch)
├── 索引: errors-YYYY-MM-DD
├── 保留: 30天
└── 用途: 错误详情查询、全文搜索

错误聚合数据 (MongoDB)
├── 集合: error_aggregates
├── 保留: 90天
└── 用途: 错误列表、统计分析

时序数据 (InfluxDB)
├── 测量: error_metrics
├── 保留: 1年
└── 用途: 趋势图、监控大盘

SourceMap文件 (OSS)
├── 路径: /sourcemaps/{version}/{file}.map
├── 保留: 永久
└── 用途: 错误堆栈还原
```

### 5.2 Elasticsearch索引设计

```json
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "index": {
      "lifecycle": {
        "name": "errors_policy",
        "rollover_alias": "errors"
      }
    }
  },
  "mappings": {
    "properties": {
      "fingerprint": {
        "type": "keyword"
      },
      "type": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "stack": {
        "type": "text"
      },
      "level": {
        "type": "keyword"
      },
      "timestamp": {
        "type": "date"
      },
      "context": {
        "properties": {
          "user": {
            "properties": {
              "id": { "type": "keyword" },
              "name": { "type": "keyword" }
            }
          },
          "app": {
            "properties": {
              "name": { "type": "keyword" },
              "version": { "type": "keyword" },
              "environment": { "type": "keyword" }
            }
          },
          "device": {
            "properties": {
              "platform": { "type": "keyword" },
              "userAgent": { "type": "text" }
            }
          },
          "browser": {
            "properties": {
              "name": { "type": "keyword" },
              "version": { "type": "keyword" }
            }
          },
          "page": {
            "properties": {
              "url": { "type": "keyword" },
              "title": { "type": "text" }
            }
          }
        }
      },
      "breadcrumbs": {
        "type": "nested",
        "properties": {
          "type": { "type": "keyword" },
          "category": { "type": "keyword" },
          "message": { "type": "text" },
          "timestamp": { "type": "date" },
          "level": { "type": "keyword" }
        }
      }
    }
  }
}
```

### 5.3 MongoDB集合设计

```typescript
// error_aggregates集合
interface ErrorAggregateDocument {
  _id: ObjectId;
  fingerprint: string;
  type: string;
  message: string;
  stack: string;
  level: string;

  // 统计信息
  count: number;
  affectedUsers: string[];
  affectedUsersCount: number;
  firstSeen: Date;
  lastSeen: Date;

  // 应用信息
  appName: string;
  appVersion: string;
  environment: string;

  // 样本数据
  sample: any;

  // 状态
  status: 'open' | 'resolved' | 'ignored';
  resolvedAt?: Date;
  resolvedBy?: string;

  // 标签
  tags: string[];

  // 索引
  createdAt: Date;
  updatedAt: Date;
}

// 索引
db.error_aggregates.createIndex({ fingerprint: 1 }, { unique: true });
db.error_aggregates.createIndex({ lastSeen: -1 });
db.error_aggregates.createIndex({ count: -1 });
db.error_aggregates.createIndex({ affectedUsersCount: -1 });
db.error_aggregates.createIndex({ environment: 1, status: 1 });
db.error_aggregates.createIndex({ appName: 1, appVersion: 1 });
```

### 5.4 InfluxDB数据点设计

```
measurement: error_metrics

tags:
  - fingerprint
  - type
  - level
  - environment
  - app_name
  - app_version
  - browser_name
  - platform

fields:
  - count (integer)
  - affected_users (integer)
  - response_time (float)

time: timestamp
```

---

## 六、可视化展示

### 6.1 监控大盘

```typescript
// 监控大盘组件
const MonitorDashboard: React.FC = () => {
  return (
    <div className="dashboard">
      {/* 关键指标 */}
      <div className="metrics-row">
        <MetricCard
          title="今日错误数"
          value={stats.todayErrors}
          trend={stats.errorTrend}
          icon={<ErrorIcon />}
        />
        <MetricCard
          title="影响用户数"
          value={stats.affectedUsers}
          trend={stats.userTrend}
          icon={<UserIcon />}
        />
        <MetricCard
          title="错误率"
          value={`${stats.errorRate}%`}
          trend={stats.rateTrend}
          icon={<PercentIcon />}
        />
        <MetricCard
          title="平均响应时间"
          value={`${stats.avgResponseTime}ms`}
          trend={stats.timeTrend}
          icon={<ClockIcon />}
        />
      </div>

      {/* 错误趋势图 */}
      <Card title="错误趋势">
        <LineChart
          data={trendData}
          xField="time"
          yField="count"
          seriesField="type"
        />
      </Card>

      {/* 错误分布 */}
      <div className="charts-row">
        <Card title="错误类型分布">
          <PieChart data={typeDistribution} />
        </Card>
        <Card title="浏览器分布">
          <BarChart data={browserDistribution} />
        </Card>
        <Card title="页面分布">
          <BarChart data={pageDistribution} />
        </Card>
      </div>

      {/* Top错误列表 */}
      <Card title="Top 10 错误">
        <ErrorTable
          data={topErrors}
          columns={[
            { title: '错误信息', dataIndex: 'message' },
            { title: '次数', dataIndex: 'count' },
            { title: '影响用户', dataIndex: 'affectedUsers' },
            { title: '最近发生', dataIndex: 'lastSeen' },
            { title: '状态', dataIndex: 'status' }
          ]}
        />
      </Card>
    </div>
  );
};
```

### 6.2 错误详情页

```typescript
const ErrorDetail: React.FC<{ fingerprint: string }> = ({ fingerprint }) => {
  const { error, loading } = useErrorDetail(fingerprint);

  if (loading) return <Loading />;

  return (
    <div className="error-detail">
      {/* 错误概览 */}
      <Card title="错误概览">
        <Descriptions>
          <Descriptions.Item label="错误信息">
            {error.message}
          </Descriptions.Item>
          <Descriptions.Item label="错误类型">
            {error.type}
          </Descriptions.Item>
          <Descriptions.Item label="错误级别">
            <Tag color={getLevelColor(error.level)}>{error.level}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="发生次数">
            {error.count}
          </Descriptions.Item>
          <Descriptions.Item label="影响用户">
            {error.affectedUsersCount}
          </Descriptions.Item>
          <Descriptions.Item label="首次出现">
            {formatDate(error.firstSeen)}
          </Descriptions.Item>
          <Descriptions.Item label="最近出现">
            {formatDate(error.lastSeen)}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Select value={error.status} onChange={handleStatusChange}>
              <Option value="open">未解决</Option>
              <Option value="resolved">已解决</Option>
              <Option value="ignored">已忽略</Option>
            </Select>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 错误堆栈 */}
      <Card title="错误堆栈">
        <CodeBlock language="javascript" code={error.stack} />
      </Card>

      {/* 用户行为轨迹 */}
      <Card title="用户行为轨迹">
        <Timeline>
          {error.breadcrumbs.map((breadcrumb, index) => (
            <Timeline.Item
              key={index}
              color={getBreadcrumbColor(breadcrumb.level)}
            >
              <div className="breadcrumb-item">
                <span className="time">
                  {formatTime(breadcrumb.timestamp)}
                </span>
                <span className="type">{breadcrumb.type}</span>
                <span className="message">{breadcrumb.message}</span>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* 上下文信息 */}
      <Card title="上下文信息">
        <Tabs>
          <TabPane tab="用户信息" key="user">
            <JsonView data={error.context.user} />
          </TabPane>
          <TabPane tab="设备信息" key="device">
            <JsonView data={error.context.device} />
          </TabPane>
          <TabPane tab="浏览器信息" key="browser">
            <JsonView data={error.context.browser} />
          </TabPane>
          <TabPane tab="页面信息" key="page">
            <JsonView data={error.context.page} />
          </TabPane>
          <TabPane tab="性能信息" key="performance">
            <JsonView data={error.context.performance} />
          </TabPane>
        </Tabs>
      </Card>

      {/* 趋势图 */}
      <Card title="错误趋势">
        <LineChart
          data={error.trendData}
          xField="time"
          yField="count"
        />
      </Card>

      {/* 影响用户列表 */}
      <Card title="影响用户">
        <Table
          dataSource={error.affectedUsersList}
          columns={[
            { title: '用户ID', dataIndex: 'userId' },
            { title: '用户名', dataIndex: 'userName' },
            { title: '发生次数', dataIndex: 'count' },
            { title: '最近发生', dataIndex: 'lastSeen' }
          ]}
        />
      </Card>

      {/* 相似错误 */}
      <Card title="相似错误">
        <List
          dataSource={error.similarErrors}
          renderItem={item => (
            <List.Item>
              <Link to={`/errors/${item.fingerprint}`}>
                {item.message}
              </Link>
              <span>{item.count} 次</span>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
```

---

## 七、高级功能

### 7.1 智能分组

```typescript
class ErrorGrouping {
  // 基于相似度的错误分组
  groupErrors(errors: ErrorData[]): ErrorGroup[] {
    const groups: Map<string, ErrorData[]> = new Map();

    for (const error of errors) {
      const groupKey = this.findSimilarGroup(error, groups);
      if (groupKey) {
        groups.get(groupKey)!.push(error);
      } else {
        const newKey = this.generateGroupKey(error);
        groups.set(newKey, [error]);
      }
    }

    return Array.from(groups.entries()).map(([key, errors]) => ({
      id: key,
      errors,
      count: errors.length,
      representative: this.selectRepresentative(errors)
    }));
  }

  private findSimilarGroup(error: ErrorData, groups: Map<string, ErrorData[]>): string | null {
    for (const [key, groupErrors] of groups.entries()) {
      const representative = groupErrors[0];
      if (this.isSimilar(error, representative)) {
        return key;
      }
    }
    return null;
  }

  private isSimilar(error1: ErrorData, error2: ErrorData): boolean {
    // 1. 错误类型相同
    if (error1.type !== error2.type) return false;

    // 2. 错误消息相似度
    const messageSimilarity = this.calculateSimilarity(error1.message, error2.message);
    if (messageSimilarity < 0.8) return false;

    // 3. 堆栈相似度
    const stackSimilarity = this.calculateStackSimilarity(error1.stack, error2.stack);
    if (stackSimilarity < 0.7) return false;

    return true;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // 使用Levenshtein距离计算相似度
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }

  private calculateStackSimilarity(stack1: string, stack2: string): number {
    const lines1 = stack1.split('\n').slice(0, 5);
    const lines2 = stack2.split('\n').slice(0, 5);

    let matches = 0;
    const minLength = Math.min(lines1.length, lines2.length);

    for (let i = 0; i < minLength; i++) {
      if (this.calculateSimilarity(lines1[i], lines2[i]) > 0.8) {
        matches++;
      }
    }

    return matches / minLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
```

### 7.2 根因分析

```typescript
class RootCauseAnalyzer {
  // 分析错误根因
  async analyzeRootCause(error: ErrorData): Promise<RootCauseAnalysis> {
    const analysis: RootCauseAnalysis = {
      possibleCauses: [],
      relatedErrors: [],
      recommendations: []
    };

    // 1. 分析错误模式
    const pattern = this.analyzePattern(error);
    analysis.possibleCauses.push(...pattern.causes);

    // 2. 查找相关错误
    const related = await this.findRelatedErrors(error);
    analysis.relatedErrors = related;

    // 3. 分析时间相关性
    const temporal = await this.analyzeTemporalCorrelation(error);
    analysis.possibleCauses.push(...temporal.causes);

    // 4. 分析部署相关性
    const deployment = await this.analyzeDeploymentCorrelation(error);
    if (deployment.isRelated) {
      analysis.possibleCauses.push({
        type: 'deployment',
        description: `可能与 ${deployment.version} 版本部署相关`,
        confidence: deployment.confidence
      });
    }

    // 5. 生成建议
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  private analyzePattern(error: ErrorData): { causes: Cause[] } {
    const causes: Cause[] = [];

    // 网络错误
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      causes.push({
        type: 'network',
        description: '网络请求失败,可能是接口异常或网络不稳定',
        confidence: 0.8
      });
    }

    // 资源加载错误
    if (error.type === 'resourceError') {
      causes.push({
        type: 'resource',
        description: '资源加载失败,可能是CDN问题或资源不存在',
        confidence: 0.9
      });
    }

    // 语法错误
    if (error.message.includes('Syntax')) {
      causes.push({
        type: 'syntax',
        description: '代码语法错误,可能是构建问题或代码错误',
        confidence: 0.95
      });
    }

    // 内存错误
    if (error.message.includes('memory') || error.message.includes('heap')) {
      causes.push({
        type: 'memory',
        description: '内存溢出,可能是内存泄漏或数据量过大',
        confidence: 0.85
      });
    }

    return { causes };
  }

  private async findRelatedErrors(error: ErrorData): Promise<ErrorData[]> {
    // 查找同一用户、同一时间段的其他错误
    const query = {
      'context.user.id': error.context.user?.id,
      timestamp: {
        $gte: error.timestamp - 60000, // 前1分钟
        $lte: error.timestamp + 60000 // 后1分钟
      },
      fingerprint: { $ne: error.fingerprint }
    };

    return await db.collection('errors').find(query).limit(10).toArray();
  }

  private async analyzeTemporalCorrelation(error: ErrorData): Promise<{ causes: Cause[] }> {
    const causes: Cause[] = [];

    // 查询同一时间段的错误激增
    const timeWindow = 5 * 60 * 1000; // 5分钟
    const count = await db.collection('errors').countDocuments({
      timestamp: {
        $gte: error.timestamp - timeWindow,
        $lte: error.timestamp + timeWindow
      }
    });

    const baseline = await this.getBaselineCount(timeWindow);

    if (count > baseline * 3) {
      causes.push({
        type: 'spike',
        description: '错误数量突然激增,可能是系统性问题',
        confidence: 0.9
      });
    }

    return { causes };
  }

  private async analyzeDeploymentCorrelation(error: ErrorData): Promise<{ isRelated: boolean; version: string; confidence: number }> {
    // 查询最近的部署记录
    const recentDeployment = await db.collection('deployments').findOne(
      {
        environment: error.context.app.environment,
        timestamp: { $lte: error.timestamp }
      },
      {
        sort: { timestamp: -1 }
      }
    );

    if (!recentDeployment) {
      return { isRelated: false, version: '', confidence: 0 };
    }

    // 计算部署后的错误增长率
    const deployTime = recentDeployment.timestamp;
    const timeSinceDeploy = error.timestamp - deployTime;

    // 24小时内的部署
    if (timeSinceDeploy < 24 * 60 * 60 * 1000) {
      const errorCountAfter = await this.getErrorCount(deployTime, error.timestamp);
      const errorCountBefore = await this.getErrorCount(deployTime - timeSinceDeploy, deployTime);

      if (errorCountAfter > errorCountBefore * 2) {
        return {
          isRelated: true,
          version: recentDeployment.version,
          confidence: 0.85
        };
      }
    }

    return { isRelated: false, version: '', confidence: 0 };
  }

  private generateRecommendations(analysis: RootCauseAnalysis): string[] {
    const recommendations: string[] = [];

    for (const cause of analysis.possibleCauses) {
      switch (cause.type) {
        case 'network':
          recommendations.push('检查API接口状态');
          recommendations.push('检查网络连接质量');
          recommendations.push('添加请求重试机制');
          break;
        case 'resource':
          recommendations.push('检查CDN配置');
          recommendations.push('验证资源文件是否存在');
          recommendations.push('检查资源路径配置');
          break;
        case 'syntax':
          recommendations.push('检查最近的代码变更');
          recommendations.push('验证构建流程');
          recommendations.push('回滚到上一个稳定版本');
          break;
        case 'memory':
          recommendations.push('检查内存泄漏');
          recommendations.push('优化数据处理逻辑');
          recommendations.push('增加内存限制');
          break;
        case 'deployment':
          recommendations.push('对比新旧版本差异');
          recommendations.push('考虑回滚部署');
          recommendations.push('进行灰度验证');
          break;
      }
    }

    return [...new Set(recommendations)];
  }
}
```

### 7.3 性能影响分析

```typescript
class PerformanceImpactAnalyzer {
  // 分析错误对性能的影响
  async analyzeImpact(fingerprint: string): Promise<PerformanceImpact> {
    // 1. 获取有错误和无错误的用户会话
    const sessionsWithError = await this.getSessionsWithError(fingerprint);
    const sessionsWithoutError = await this.getSessionsWithoutError();

    // 2. 对比性能指标
    const impact: PerformanceImpact = {
      pageLoadTime: this.compareMetric(sessionsWithError, sessionsWithoutError, 'pageLoadTime'),
      firstContentfulPaint: this.compareMetric(sessionsWithError, sessionsWithoutError, 'firstContentfulPaint'),
      timeToInteractive: this.compareMetric(sessionsWithError, sessionsWithoutError, 'timeToInteractive'),
      bounceRate: this.compareBounceRate(sessionsWithError, sessionsWithoutError),
      conversionRate: this.compareConversionRate(sessionsWithError, sessionsWithoutError)
    };

    return impact;
  }

  private compareMetric(sessions1: Session[], sessions2: Session[], metric: string): MetricComparison {
    const avg1 = this.average(sessions1.map((s) => s[metric]));
    const avg2 = this.average(sessions2.map((s) => s[metric]));

    return {
      withError: avg1,
      withoutError: avg2,
      difference: avg1 - avg2,
      percentChange: ((avg1 - avg2) / avg2) * 100
    };
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}
```

---

## 八、最佳实践

### 8.1 SDK接入最佳实践

1. **尽早初始化**: 在应用入口处立即初始化SDK
2. **合理采样**: 根据流量大小设置合适的采样率
3. **敏感信息过滤**: 配置敏感字段过滤规则
4. **自定义上下文**: 添加业务相关的上下文信息
5. **错误边界**: 在关键组件添加错误边界

### 8.2 告警配置最佳实践

1. **分级告警**: 根据严重程度配置不同的告警渠道
2. **避免告警疲劳**: 设置合理的告警阈值和频率限制
3. **可操作性**: 告警信息应包含足够的上下文,便于快速定位
4. **告警收敛**: 相似错误合并告警,避免重复通知

### 8.3 数据治理最佳实践

1. **数据保留策略**: 根据业务需求设置合理的数据保留期
2. **数据归档**: 定期归档历史数据,降低存储成本
3. **隐私合规**: 遵守数据隐私法规,做好数据脱敏
4. **访问控制**: 实施细粒度的权限控制

### 8.4 性能优化最佳实践

1. **批量上报**: 使用批量上报减少网络请求
2. **离线缓存**: 实现离线缓存机制,避免数据丢失
3. **异步处理**: 错误捕获和上报不应阻塞主流程
4. **资源优化**: 控制SDK体积,减少对应用性能的影响

---

## 九、监控指标体系

### 9.1 核心指标

| 指标               | 说明                      | 目标值  |
| ------------------ | ------------------------- | ------- |
| 错误率             | 错误数/总请求数           | < 0.1%  |
| 影响用户率         | 遇到错误的用户数/总用户数 | < 1%    |
| 平均修复时间(MTTR) | 从发现到修复的平均时间    | < 2小时 |
| 错误发现时间       | 从发生到发现的平均时间    | < 5分钟 |
| 告警准确率         | 有效告警数/总告警数       | > 90%   |

### 9.2 质量指标

| 指标           | 说明                     | 计算方式                |
| -------------- | ------------------------ | ----------------------- |
| 错误密度       | 单位代码的错误数         | 错误数/代码行数         |
| 错误重现率     | 已修复错误的重现比例     | 重现错误数/已修复错误数 |
| 首次解决率     | 一次性解决的错误比例     | 首次解决数/总错误数     |
| 平均影响用户数 | 每个错误平均影响的用户数 | 总影响用户数/错误数     |

---

## 十、总结

### 10.1 核心价值

1. **提升用户体验**: 快速发现和修复问题,减少用户受影响时间
2. **降低运维成本**: 自动化监控和告警,减少人工巡检
3. **数据驱动决策**: 基于真实数据进行产品优化和技术决策
4. **持续质量改进**: 建立质量反馈闭环,持续提升代码质量

### 10.2 实施路线图

**第一阶段 (1-2周)**: 基础监控

- 部署前端SDK
- 搭建数据接收服务
- 实现基础错误展示

**第二阶段 (2-3周)**: 完善功能

- 实现SourceMap解析
- 添加用户行为追踪
- 搭建告警系统

**第三阶段 (3-4周)**: 高级功能

- 实现智能分组
- 添加根因分析
- 优化数据存储

**第四阶段 (持续)**: 优化迭代

- 性能优化
- 功能完善
- 用户反馈收集

### 10.3 成功要素

1. **团队支持**: 获得开发、测试、运维团队的支持
2. **流程整合**: 将监控融入开发和发布流程
3. **持续优化**: 根据实际使用情况不断优化
4. **文化建设**: 建立重视质量的团队文化

---

## 附录

### A. 相关技术文档

- [Sentry官方文档](https://docs.sentry.io/)
- [SourceMap规范](https://sourcemaps.info/spec.html)
- [Web Vitals](https://web.dev/vitals/)
- [Error Handling Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)

### B. 开源方案参考

- **Sentry**: 成熟的错误监控平台
- **Bugsnag**: 商业错误监控服务
- **LogRocket**: 会话回放 + 错误监控
- **Rollbar**: 实时错误追踪
- **Fundebug**: 国内错误监控服务

### C. 技术选型对比

| 方案     | 优点               | 缺点                 | 适用场景           |
| -------- | ------------------ | -------------------- | ------------------ |
| 自研     | 完全可控、定制化强 | 开发成本高、维护复杂 | 大型企业、特殊需求 |
| Sentry   | 功能完善、社区活跃 | 私有化部署复杂       | 中小型团队         |
| 商业服务 | 开箱即用、稳定可靠 | 成本较高、数据外流   | 快速上线、预算充足 |

---

## 十一、架构设计对比与最佳实践

### 11.1 两种架构方案对比

#### 方案A: 原始架构 (垂直分层)

```
前端SDK → 接收网关 → 数据处理 → 数据存储 → 展示层
```

**优势**:

- ✅ 强调网关层的重要性(负载均衡、限流)
- ✅ 引入消息队列做异步解耦
- ✅ 明确实时计算框架(Flink)
- ✅ 对象存储独立管理SourceMap

**不足**:

- ⚠️ 客户端上报策略不够细化
- ⚠️ 缺少数据仓库做离线分析
- ⚠️ 应用层功能不够完整

#### 方案B: 优化架构 (五层架构)

```
数据采集层 → 数据上报层 → 数据处理层 → 数据存储层 → 应用服务层
```

**优势**:

- ✅ 层次更清晰,职责分明
- ✅ 强调客户端上报策略(节流、缓冲、重试)
- ✅ 引入数据仓库(Hive)做离线分析
- ✅ 应用服务层更完整(用户管理、工单系统)

**不足**:

- ⚠️ 网关层细节不够明确
- ⚠️ 实时计算框架未明确

#### 方案C: 融合架构 (推荐) ⭐

**结合两者优势,形成最佳实践架构**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: 数据采集层 (Client Side - Enhanced)                 │
│ • JS错误 • 资源错误 • 接口错误 • Promise异常                  │
│ • 白屏检测 • 性能异常 • 卡顿监控 • 用户行为追踪               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: 数据上报层 (Client Side - Optimized)                │
│ • 优先级队列 • 批量上报 • 智能采样 • 数据压缩                │
│ • 失败重试 • 离线存储 • 网络自适应 • 数据脱敏                │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/Beacon
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 数据接收与处理层 (Server Side - Integrated)         │
│                                                               │
│ [接收网关]                                                    │
│ Nginx + Node.js/Go                                           │
│ • 负载均衡 • 数据验证 • 限流防刷 • 签名验证                   │
│                                                               │
│         ↓                                                     │
│                                                               │
│ [消息队列]                                                    │
│ Kafka/RabbitMQ                                               │
│ • 削峰填谷 • 异步解耦 • 数据分发                              │
│                                                               │
│         ↓                                                     │
│                                                               │
│ [实时处理] Flink/Spark Streaming                              │
│ • 数据清洗 • 错误聚合 • 智能分组 • 根因分析                   │
│ • SourceMap解析 • 影响分析 • 告警判断                         │
│                                                               │
│         ↓                                                     │
│                                                               │
│ [批处理] Spark/Hive                                           │
│ • 离线分析 • 趋势预测 • 数据挖掘                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: 数据存储层 (Storage - Multi-tier)                   │
│                                                               │
│ [热数据] Redis + ES (7天)                                     │
│ • 实时查询 • 去重限流 • 缓存加速                              │
│                                                               │
│ [温数据] Elasticsearch (30天)                                 │
│ • 全文搜索 • 聚合分析 • 详情查询                              │
│                                                               │
│ [冷数据] MongoDB (90天)                                       │
│ • 历史数据 • 归档查询                                         │
│                                                               │
│ [归档] OSS + Hive (1年+)                                      │
│ • 长期存储 • 离线分析 • 成本优化                              │
│                                                               │
│ [时序] InfluxDB/TimescaleDB                                   │
│ • 趋势分析 • 监控大盘                                         │
│                                                               │
│ [对象] OSS/S3                                                 │
│ • SourceMap • 录屏文件 • 大文件存储                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: 应用服务层 (Application - Productized)              │
│                                                               │
│ [核心功能]                                                    │
│ • 监控大屏 • 错误详情 • 趋势分析 • 告警管理                   │
│ • SourceMap解析 • 代码定位 • 用户行为回放                     │
│                                                               │
│ [产品化能力]                                                  │
│ • 用户管理 • 团队协作 • 权限控制(RBAC)                        │
│ • 工单集成 • 配置中心 • 规则引擎                              │
│                                                               │
│ [数据服务]                                                    │
│ • REST API • GraphQL • WebSocket                             │
│ • 数据导出 • 报表生成 • 数据订阅                              │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 关键设计决策

#### 决策1: 客户端上报策略

**问题**: 如何平衡数据完整性和性能影响?

**方案对比**:

| 策略     | 优点              | 缺点                  | 适用场景    |
| -------- | ----------------- | --------------------- | ----------- |
| 实时上报 | 数据及时,不丢失   | 性能影响大,网络开销高 | 关键错误    |
| 批量上报 | 性能好,网络开销低 | 可能丢失数据          | 一般错误    |
| 智能上报 | 平衡性能和完整性  | 实现复杂              | 推荐方案 ⭐ |

**最佳实践**:

```typescript
// 智能上报策略
class SmartReportStrategy {
  report(error: ErrorData) {
    // 1. 高优先级立即上报
    if (error.priority >= 8) {
      return this.reportImmediately(error);
    }

    // 2. 中优先级批量上报
    if (error.priority >= 5) {
      return this.reportBatch(error, { maxSize: 10, maxWait: 5000 });
    }

    // 3. 低优先级采样上报
    if (Math.random() < 0.1) {
      return this.reportBatch(error, { maxSize: 50, maxWait: 30000 });
    }
  }
}
```

#### 决策2: 数据存储选型

**问题**: 如何选择合适的存储方案?

**存储对比**:

| 存储类型       | 技术选型        | 优势                    | 劣势            | 使用场景             |
| -------------- | --------------- | ----------------------- | --------------- | -------------------- |
| **实时缓存**   | Redis           | 极快,支持复杂数据结构   | 成本高,容量有限 | 去重、限流、热点数据 |
| **文档数据库** | Elasticsearch   | 全文搜索强大,聚合能力好 | 写入性能一般    | 错误详情、全文搜索   |
| **文档数据库** | MongoDB         | 写入快,schema灵活       | 搜索能力弱      | 错误聚合、历史数据   |
| **时序数据库** | InfluxDB        | 时序查询优化            | 功能单一        | 趋势分析、监控大盘   |
| **数据仓库**   | Hive/ClickHouse | 离线分析强大,成本低     | 实时性差        | 离线分析、数据挖掘   |
| **对象存储**   | OSS/S3          | 成本极低,容量无限       | 查询不便        | SourceMap、录屏文件  |

**推荐组合** ⭐:

```
Redis (热数据缓存)
  ↓
Elasticsearch (实时查询 + 全文搜索)
  ↓
MongoDB (温冷数据存储)
  ↓
Hive (离线分析 + 长期归档)

InfluxDB (时序数据)
OSS (大文件存储)
```

#### 决策3: 实时计算框架

**问题**: Flink vs Spark Streaming vs Storm?

| 框架                | 延迟   | 吞吐量 | 容错 | 生态 | 学习曲线 | 推荐度     |
| ------------------- | ------ | ------ | ---- | ---- | -------- | ---------- |
| **Flink**           | 毫秒级 | 高     | 强   | 完善 | 中等     | ⭐⭐⭐⭐⭐ |
| **Spark Streaming** | 秒级   | 高     | 强   | 完善 | 低       | ⭐⭐⭐⭐   |
| **Storm**           | 毫秒级 | 中     | 中   | 一般 | 高       | ⭐⭐⭐     |

**推荐**: Flink (流批一体,状态管理强大)

#### 决策4: 告警降噪策略

**问题**: 如何避免告警疲劳?

**降噪策略**:

```typescript
class AlertNoiseReduction {
  // 1. 智能聚合
  async aggregateSimilarAlerts(alerts: Alert[]): Promise<Alert[]> {
    // 基于错误指纹、时间窗口聚合
    return this.groupBy(alerts, ['fingerprint', 'timeWindow']);
  }

  // 2. 动态阈值
  async calculateDynamicThreshold(metric: string): Promise<number> {
    // 基于历史数据计算动态阈值
    const history = await this.getHistoricalData(metric, 7); // 7天
    const mean = this.calculateMean(history);
    const stdDev = this.calculateStdDev(history);
    return mean + 3 * stdDev; // 3-sigma规则
  }

  // 3. 告警抑制
  async suppressAlert(alert: Alert): Promise<boolean> {
    // 维护窗口
    if (await this.isMaintenanceWindow()) return true;

    // 已知问题
    if (await this.isKnownIssue(alert.fingerprint)) return true;

    // 频率限制
    const count = await this.getAlertCount(alert.fingerprint, 3600);
    if (count > 10) return true; // 1小时内超过10次

    return false;
  }

  // 4. 智能路由
  async routeAlert(alert: Alert): Promise<string[]> {
    // 基于代码归属自动路由
    const owner = await this.findCodeOwner(alert);

    // 基于值班表路由
    const onCall = await this.getOnCallPerson();

    // 基于严重程度路由
    const channels = alert.severity === 'critical' ? ['phone', 'sms', 'email', 'dingtalk'] : ['email', 'dingtalk'];

    return { recipients: [owner, onCall], channels };
  }
}
```

### 11.3 性能优化最佳实践

#### 11.3.1 客户端性能优化

```typescript
// 1. SDK体积优化
// 使用Tree Shaking和代码分割
// 目标: SDK < 20KB (gzip)

// 2. 异步加载
const monitor = {
  init: async () => {
    const { ErrorMonitor } = await import('./monitor');
    return new ErrorMonitor(config);
  }
};

// 3. 防抖节流
class ThrottledReporter {
  private throttle = throttle((data) => {
    this.send(data);
  }, 1000); // 1秒内最多上报一次

  report(data: ErrorData) {
    this.throttle(data);
  }
}

// 4. 资源提示
<link rel="dns-prefetch" href="//monitor.example.com">
<link rel="preconnect" href="//monitor.example.com">
```

#### 11.3.2 服务端性能优化

```typescript
// 1. 接口性能目标
const performanceTargets = {
  errorReport: {
    p50: '< 50ms',
    p95: '< 200ms',
    p99: '< 500ms'
  },
  errorQuery: {
    p50: '< 100ms',
    p95: '< 500ms',
    p99: '< 1s'
  }
};

// 2. 缓存策略
class CacheStrategy {
  // L1: 本地缓存 (LRU)
  private l1Cache = new LRU({ max: 1000, ttl: 60000 });

  // L2: Redis缓存
  private l2Cache = redis;

  async get(key: string) {
    // 先查L1
    let value = this.l1Cache.get(key);
    if (value) return value;

    // 再查L2
    value = await this.l2Cache.get(key);
    if (value) {
      this.l1Cache.set(key, value);
      return value;
    }

    // 查数据库
    value = await this.db.query(key);
    this.l2Cache.setex(key, 300, value);
    this.l1Cache.set(key, value);
    return value;
  }
}

// 3. 数据库优化
// 索引设计
db.errors.createIndex({ fingerprint: 1, timestamp: -1 });
db.errors.createIndex({ 'context.app.version': 1, status: 1 });
db.errors.createIndex({ lastSeen: -1 });

// 分区表
CREATE TABLE errors (
  id BIGINT,
  fingerprint VARCHAR(64),
  timestamp TIMESTAMP,
  ...
) PARTITION BY RANGE (timestamp) (
  PARTITION p_2024_01 VALUES LESS THAN ('2024-02-01'),
  PARTITION p_2024_02 VALUES LESS THAN ('2024-03-01'),
  ...
);

// 4. 查询优化
// 使用ES的聚合而不是应用层聚合
const agg = await es.search({
  index: 'errors',
  body: {
    size: 0,
    aggs: {
      by_fingerprint: {
        terms: { field: 'fingerprint', size: 100 },
        aggs: {
          affected_users: { cardinality: { field: 'context.user.id' } },
          latest: { top_hits: { size: 1, sort: [{ timestamp: 'desc' }] } }
        }
      }
    }
  }
});
```

### 11.4 成本优化策略

#### 成本分析

```typescript
interface CostBreakdown {
  // 月度成本预估 (1000万PV)
  compute: {
    gateway: '$200'; // 4核8G * 2台
    processing: '$500'; // Flink集群
    api: '$300'; // API服务器
  };

  storage: {
    redis: '$150'; // 8GB
    elasticsearch: '$600'; // 100GB
    mongodb: '$300'; // 500GB
    influxdb: '$200'; // 50GB
    oss: '$50'; // 1TB
    hive: '$100'; // 5TB
  };

  network: {
    bandwidth: '$200'; // 1TB出流量
    cdn: '$100'; // CDN加速
  };

  total: '$2,700/month';
}
```

#### 优化措施

```typescript
// 1. 数据采样
// 根据流量动态调整采样率
const sampleRate = traffic > 10000000 ? 0.1 : 1.0;

// 2. 数据压缩
// 使用gzip压缩,节省70%存储和带宽
const compressed = gzip(data);

// 3. 冷热分离
// 热数据7天,温数据30天,冷数据90天,归档1年
// 节省60%存储成本

// 4. 按需计算
// 使用Serverless架构,按实际使用付费
// 节省40%计算成本

// 5. 资源复用
// 与其他监控系统共享基础设施
// 节省30%成本
```

### 11.5 实施建议

#### 阶段1: MVP (2周)

- ✅ 基础错误捕获(JS错误、Promise异常)
- ✅ 简单上报(批量+重试)
- ✅ 基础存储(ES)
- ✅ 简单展示(错误列表)

#### 阶段2: 完善功能 (4周)

- ✅ 完整错误捕获(资源、接口、自定义)
- ✅ 智能上报(优先级、压缩、采样)
- ✅ SourceMap解析
- ✅ 用户行为追踪
- ✅ 告警系统

#### 阶段3: 高级功能 (6周)

- ✅ 智能分组
- ✅ 根因分析
- ✅ 性能监控
- ✅ 白屏检测
- ✅ 数据仓库

#### 阶段4: 产品化 (8周)

- ✅ 用户管理
- ✅ 权限控制
- ✅ 工单集成
- ✅ 团队协作
- ✅ 成本优化

### 11.6 总结

**核心改进点** 🚀:

1. **数据采集层**: 新增白屏检测、性能异常监控、卡顿监控
2. **数据上报层**: 优先级队列、数据压缩、智能采样、网络自适应
3. **数据处理层**: 流批一体、消息队列解耦、实时计算框架
4. **数据存储层**: 冷热分离、成本优化、多存储组合
5. **应用服务层**: 用户管理、工单集成、智能告警、团队协作

**关键成功因素** ✨:

1. ✅ **完整的数据链路**: 从采集到展示的完整闭环
2. ✅ **智能化能力**: 智能分组、根因分析、告警降噪
3. ✅ **性能优化**: 客户端和服务端的全面优化
4. ✅ **成本控制**: 冷热分离、采样策略、资源复用
5. ✅ **产品化能力**: 用户管理、权限控制、工单集成

**最终目标** 🎯:

打造一个**高性能、低成本、智能化、产品化**的企业级错误监控平台,助力团队快速发现和解决问题,持续提升产品质量。

---

**文档版本**: v2.0 **最后更新**: 2025-12-15 **作者**: 技术团队 **审核**: 架构组
**变更说明**: 融合两种架构方案,新增架构对比、最佳实践、性能优化、成本优化等章节
