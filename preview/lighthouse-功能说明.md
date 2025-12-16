# Lighthouse 性能评测系统技术文档

## 概述

本系统实现了基于 Lighthouse 的 Web 页面性能自动化评测功能，包括性能评分、历史数据对比、报告生成与上传等完整流程。

## 架构设计

系统采用三层架构：
- **Controller 层**: 处理 HTTP 请求和响应
- **Service 层**: 实现业务逻辑和数据处理
- **Process 层**: 独立进程执行 Lighthouse 评测任务

---

## 文件功能说明

### 1. lighthouse_score.ts (进程层)

**文件路径**: `src/process/lighthouse_score.ts`

#### 主要功能
独立进程执行 Lighthouse 性能评测任务，使用 Playwright 启动浏览器并运行 Lighthouse 测试。

#### 核心实现

##### getLighthouseScore 函数
```typescript
async function getLighthouseScore(param) {
    const { pageUrl, throttlingOptions, device } = param;
    // 生成随机调试端口
    const randomFourDigitNumber = Math.floor(1000 + Math.random() * 9000);

    // 启动 Chromium 浏览器服务器
    const browserServer = await chromium.launchServer({
        headless: true,
        args: [
            `--remote-debugging-port=${randomFourDigitNumber}`,
            '--incognito',
            '--enable-back-forward-cache'
        ],
        ignoreDefaultArgs: ['--disable-back-forward-cache']
    });

    // 配置 Lighthouse 选项
    const options = {
        port: randomFourDigitNumber,
        output: 'html',
        logLevel: 'info',
        onlyCategories: ['performance'],
        onlyAudits: [
            'first-contentful-paint',      // FCP
            'largest-contentful-paint',     // LCP
            'total-blocking-time',          // TBT
            'cumulative-layout-shift',      // CLS
            'speed-index'                   // SI
        ],
        throttling: throttlingOptions,
        emulatedFormFactor: device,
        disableNetworkThrottling: true,
        disableCpuThrottling: true
    };

    // 运行 Lighthouse
    const runnerResult = await lighthouse(url, options);
    await browserServer.close();

    return {
        score: runnerResult.lhr.categories.performance.score,
        reportFile: runnerResult.report
    };
}
```

#### 进程通信
- 使用 Node.js 的 `process.on('message')` 接收父进程消息
- 使用 `process.send()` 返回评测结果或错误信息
- 支持状态码：OK (0)、ERROR (1)

---

### 2. lighthouse.service.ts (服务层)

**文件路径**: `src/service/lighthouse.service.ts`

#### 主要功能
- 性能评分计算与验证
- 历史数据管理
- 报告文件上传
- 基准分数获取
- 多维度评分对比

#### 核心数据结构

##### 请求参数 (LighthouseParams)
```typescript
{
    pageName: string;    // 页面名称（merchantApp/consumerClientH5/qponApp）
    pageUrl: string;     // 待测试页面 URL
    throttling: string;  // 网速模拟（mobileRegular3G/mobileSlow4G/desktopDense4G）
    device: string;      // 设备类型（mobile/desktop）
    env: string;         // 环境（dev/test01/test02/test03/pre/prod）
}
```

##### 评分阈值配置
```typescript
const Threshold = {
    mobileRegular3G: 0.05,    // 5分容差
    mobileSlow4G: 0.1,        // 10分容差
    desktopDense4G: 0.15      // 15分容差
};
```

#### 核心流程

##### 1. getLighthouseScore - 主入口
```typescript
async getLighthouseScore(param: LighthouseParams) {
    // 设置 55 秒超时
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('服务超时')), 55000);
    });

    return await Promise.race([
        this.calculateLighthouseScore(param),
        timeout
    ]);
}
```

##### 2. calculateLighthouseScore - 核心评分逻辑

**步骤 1**: 生成页面唯一标识
```typescript
const pageId = generatePageId({
    pageName, env, device, throttling
});
```

**步骤 2**: 获取历史评分数据
```typescript
const { preData, medianScore, averageScore } =
    await this.getHistoricalScores(pageId);
```

**步骤 3**: 执行 Lighthouse 评测
```typescript
const auditResult = await pool.submit(
    path.resolve('./src/process', './lighthouse_score'),
    { pageUrl, throttlingOptions, device }
);
```

**步骤 4**: 上传报告文件到 OCS
```typescript
const reportFileUrl = await this.uploadReportFile(reportFile, pageId);
```

**步骤 5**: 保存新评分到数据库
```typescript
const newData = new PageScoreInfo();
Object.assign(newData, { pageId, score, reportFileUrl });
await this.pageScoreInfo.save(newData);
```

**步骤 6**: 获取基准分数并验证
```typescript
const baseLineScore = await this.getBaselineScore(pageName, env, throttling);
const validation = this.validateScore(
    newScore,
    preScore,
    medianScore,
    averageScore,
    baseLineScore,
    throttling
);
```

**步骤 7**: 返回评测结果
```typescript
return {
    code: validation.result[0],
    message: validation.result[1],
    reportInfo: {
        pageId,
        new: { score, reportFileUrl },
        previous: { score: preScore, reportFileUrl: preReportUrl }
    },
    scores: {
        medianScore,    // 前5次中位数
        averageScore,   // 前5次平均数
        baseLineScore   // 基准分数
    }
};
```

#### 关键方法详解

##### getHistoricalScores - 获取历史评分
```typescript
private async getHistoricalScores(pageId: string) {
    // 获取最近一次评分
    const preData = await this.pageScoreInfo.findOne({
        where: { pageId },
        order: { createTime: 'DESC' }
    });

    // 获取最近5次评分
    const records = await this.pageScoreInfo.find({
        where: { pageId },
        order: { createTime: 'DESC' },
        take: 5
    });

    const scoresArray = records
        .map(record => Number(record.score))
        .filter(score => score && !isNaN(score));

    return {
        preData,
        medianScore: getMedianValue(scoresArray) || 0,
        averageScore: getAverageValue(scoresArray) || 0
    };
}
```

##### uploadReportFile - 上传报告文件
```typescript
private async uploadReportFile(reportFile: string, pageId: string) {
    const form = new FormData();
    form.append('file', Buffer.from(reportFile), {
        filename: `file_${generateUniqueValue(pageId)}.html`,
        contentType: 'text/html'
    });
    form.append('targetPath', 'autoTest/lighthouse/reportFile/');

    const requestUrl =
        `${this.serverHost.nodeHost[this.env]}/nodePublic/public/upload`;
    const res = await fetch(requestUrl, {
        method: 'POST',
        body: form
    });

    const data = await res.json();
    return data?.[0]?.Location;
}
```

##### getBaselineScore - 获取基准分数
```typescript
private async getBaselineScore(pageName: string, env: string, throttling: string) {
    const requestUrl =
        `${this.serverHost.nodeHost[this.env]}/nodePublic/config/info`;
    const res = await makeHttpRequest(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { key: ['performance_config'] }
    });

    const parsedResult = JSON.parse(res.data.toString());
    return parsedResult?.data?.performance_config?.baselineScores
        ?.[pageName]?.config?.[env]?.[throttling] || 0;
}
```

##### validateScore - 评分验证逻辑
```typescript
private validateScore(
    newScore: number,
    preScore: number,
    medianScore: number,
    averageScore: number,
    baseLineScore: number,
    throttling: string
) {
    const threshold = Threshold[throttling] || Threshold.mobileRegular3G;

    // 四项验证规则
    const isPassOne = newScore > (preScore - threshold);      // 对比上次
    const isPassTwo = newScore > (medianScore - threshold);   // 对比中位数
    const isPassThree = newScore > (averageScore - threshold);// 对比平均数
    const isPassFour = newScore >= baseLineScore;             // 对比基准值

    // 验证逻辑：
    // 1. 必须满足基准分数要求 (isPassFour)
    // 2. 至少满足一项历史对比要求 (isPassOne || isPassTwo || isPassThree)
    let result;
    if (isPassFour) {
        result = (isPassOne || isPassTwo || isPassThree)
            ? EventCode.SUCCESS
            : ErrorCode.BELOW_HISTORY_SCORE;
    } else {
        result = ErrorCode.BELOW_BASE_SCORE;
    }

    return { result, isPassOne, isPassTwo, isPassThree, isPassFour };
}
```

##### convertScore - 分数格式转换
```typescript
private convertScore(score: string | number | undefined): number | undefined {
    const num = Number(score);
    // 将 0-1 范围的分数转换为 0-100
    if (!isNaN(num) && num >= 0 && num <= 1) {
        return parseFloat((num * 100).toFixed(2));
    }
    return num;
}
```

---

### 3. lighthouse.controller.ts (控制器层)

**文件路径**: `src/controller/lighthouse.controller.ts`

#### 主要功能
提供 RESTful API 接口，处理 HTTP 请求和响应。

#### API 接口

##### 1. POST /lighthouse/getScore - 获取性能评分

**请求示例**:
```json
{
    "pageName": "merchantApp",
    "pageUrl": "https://example.com/page",
    "throttling": "mobileRegular3G",
    "device": "mobile",
    "env": "test01"
}
```

**响应示例**:
```json
{
    "code": 0,
    "message": "成功",
    "reportInfo": {
        "pageId": "merchantApp_test01_mobile_mobileRegular3G",
        "new": {
            "description": "本次评分的分数和报告文件",
            "score": 85.5,
            "reportFileUrl": "https://oss.example.com/report.html"
        },
        "previous": {
            "description": "前一次评分的分数和报告文件",
            "score": 83.2,
            "reportFileUrl": "https://oss.example.com/old-report.html"
        }
    },
    "scores": {
        "medianScore": {
            "description": "前五次评分的中位数",
            "value": 84.0
        },
        "averageScore": {
            "description": "前五次评分的平均数",
            "value": 83.8
        },
        "baseLineScore": {
            "description": "基准分数（最新一次评分需要大于等于基准分数才能通过校验）",
            "value": 80.0
        }
    }
}
```

**实现代码**:
```typescript
@Post('/getScore')
async getLighthouseScore(@Body() param: LighthouseParams) {
    return await this.lighthouseService.getLighthouseScore(param);
}
```

##### 2. GET /lighthouse/getReportFile - 获取报告文件

**请求示例**:
```
GET /lighthouse/getReportFile?filePath=%2Fpublic%2Faudit%2FreportFile%2Ffile_xxx.html
```

**实现代码**:
```typescript
@Get('/getReportFile')
async getLighthouseReportFile(@Query('filePath') filePath: string) {
    // URL 解码
    const decodedPath = decodeURIComponent(filePath);
    // 拼接完整路径
    const curPath = path.resolve('.' + decodedPath);
    // 创建文件流
    const fileStream = fs.createReadStream(curPath);

    // 设置响应头
    this.ctx.response.type = path.extname(filePath);
    this.ctx.response.body = fileStream;
    this.ctx.body = fileStream;
}
```

---

## 技术特性

### 1. 性能优化
- **进程池管理**: 使用进程池执行 Lighthouse 任务，避免重复启动浏览器
- **超时控制**: 55 秒超时机制，防止任务长时间挂起
- **随机端口**: 使用随机调试端口，支持并发执行

### 2. 数据可靠性
- **多维度对比**: 对比上次、中位数、平均数、基准分数
- **历史数据**: 存储所有历史评分，支持趋势分析
- **容差机制**: 根据网络条件设置不同的评分容差

### 3. 评测指标
系统评测以下 5 个核心 Web Vitals 指标：
- **FCP** (First Contentful Paint): 首次内容绘制
- **LCP** (Largest Contentful Paint): 最大内容绘制
- **TBT** (Total Blocking Time): 总阻塞时间
- **CLS** (Cumulative Layout Shift): 累积布局偏移
- **SI** (Speed Index): 速度指数

### 4. 网络模拟
支持三种网络环境模拟：
- **mobileRegular3G**: 常规 3G 移动网络（容差 5%）
- **mobileSlow4G**: 慢速 4G 移动网络（容差 10%）
- **desktopDense4G**: 桌面密集 4G 网络（容差 15%）

### 5. 设备模拟
- **mobile**: 移动端设备
- **desktop**: 桌面端设备

---

## 数据流图

```
用户请求
    ↓
Controller (lighthouse.controller.ts)
    ↓
Service (lighthouse.service.ts)
    ├─→ 1. 生成 pageId
    ├─→ 2. 查询历史数据（数据库）
    ├─→ 3. 执行 Lighthouse 评测
    │       ↓
    │   Process (lighthouse_score.ts)
    │       ├─→ 启动 Chromium
    │       ├─→ 运行 Lighthouse
    │       └─→ 返回评分和报告
    ├─→ 4. 上传报告文件（OCS）
    ├─→ 5. 保存新评分（数据库）
    ├─→ 6. 获取基准分数（配置服务）
    ├─→ 7. 执行评分验证
    └─→ 8. 返回结果
        ↓
用户收到响应
```

---

## 评分验证规则

评测结果需要同时满足以下条件才能通过：

1. **基准分数验证** (必须满足)
   ```
   新评分 >= 基准分数
   ```

2. **历史对比验证** (至少满足一项)
   - 对比上次评分: `新评分 > (上次评分 - 阈值)`
   - 对比中位数: `新评分 > (前5次中位数 - 阈值)`
   - 对比平均数: `新评分 > (前5次平均数 - 阈值)`

### 返回状态码
- **SUCCESS**: 所有验证通过
- **BELOW_HISTORY_SCORE**: 基准分数通过，但历史对比未通过
- **BELOW_BASE_SCORE**: 基准分数未通过

---

## 配置说明

### 环境变量
- `serverHost.nodeHost[env]`: 各环境的服务器地址
- `env`: 当前运行环境

### 数据库表
- **PageScoreInfo**: 存储评分历史记录
  - `pageId`: 页面唯一标识
  - `score`: 评分（0-1 或 0-100）
  - `reportFileUrl`: 报告文件 URL
  - `createTime`: 创建时间

---

## 使用示例

### 1. 基本用法
```bash
curl -X POST http://localhost:7001/lighthouse/getScore \
  -H "Content-Type: application/json" \
  -d '{
    "pageName": "merchantApp",
    "pageUrl": "https://merchant.example.com",
    "throttling": "mobileRegular3G",
    "device": "mobile",
    "env": "test01"
  }'
```

### 2. 查看报告
```bash
curl http://localhost:7001/lighthouse/getReportFile?filePath=%2Fpublic%2Faudit%2FreportFile%2Ffile_xxx.html
```

---

## 注意事项

1. **浏览器资源**: Lighthouse 评测会启动 Chromium 浏览器，需要确保服务器有足够的内存和 CPU 资源
2. **评测时间**: 单次评测通常需要 10-30 秒，最大超时时间为 55 秒
3. **网络依赖**: 需要能够访问目标页面和 OCS 文件上传服务
4. **并发限制**: 建议通过进程池限制并发数，避免资源耗尽
5. **报告存储**: HTML 报告文件会上传到 OCS，确保存储空间充足

---

## 扩展建议

1. **监控告警**: 集成评分异常告警机制
2. **趋势分析**: 可视化历史评分趋势
3. **性能优化**: 缓存 Lighthouse 运行时依赖
4. **报告分析**: 提供详细的性能瓶颈分析
5. **批量测试**: 支持多页面批量评测

---

## 相关文件

- [lighthouse_score.ts](../src/process/lighthouse_score.ts)
- [lighthouse.service.ts](../src/service/lighthouse.service.ts)
- [lighthouse.controller.ts](../src/controller/lighthouse.controller.ts)
