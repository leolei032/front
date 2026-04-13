# AI 内容生产系统（Workflows） — 面试深度准备

> **项目时间**: 2026.03 - 至今
> **项目角色**: 独立架构设计 + 借助 AI 编程工具全栈交付
> **对应 JD**: 驱动前端领域 AI 应用落地；建设前端基础设施；微服务架构
>
> 这个项目的面试价值在于：**架构设计能力 + 踩坑解决问题的过程**，而非 Python 语言本身。
> 和 AI 内容平台是上下游关系——Workflows 生产内容，AI 平台消费内容。

---

## 项目定位：怎么讲"用 AI 工具写的项目"

**面试中如果被问到**（大概率会问）：

> "实现层面我大量借助了 AI 编程工具，但架构设计、技术选型、问题排查和调优都是我自主完成的。比如 POI 流式架构是我设计的，Pub/Sub 消息超时导致死循环是我排查定位的，Playwright 内存爆炸是我通过信号量+资源拦截解决的。AI 工具帮我写了代码，但'写什么、为什么这样写'是我决定的。"

**加分点**：这正好说明你有**快速学习和交付新技术栈的能力**——4 周从零交付一个 Python 微服务系统，说明技术视野广、架构思维可以跨语言迁移。

---

## 核心数据速记

| 指标 | 数值 | 说明 |
|-----|------|------|
| **架构模式** | 事件驱动 + POI 流式 | 3 阶段微服务流水线 |
| **微服务** | 4 个 Cloud Run 服务 | Radar / Enrichment / Article Gen / Admin |
| **并发模型** | concurrency=1 × max 5-10 实例 | 水平扩展 |
| **Playwright 并发** | 信号量 max 3 页面 | 防 OOM |
| **反爬指纹** | 18 组 UA + 视窗组合 | Win/Mac/Linux × Chrome/Edge |
| **代理管理** | Redis 分布式锁 + 健康评分 | Lua 脚本原子释放 |
| **开发周期** | ~4 周 / 164 commits | 独立交付 |

---

## 1 分钟项目介绍

> "这是 AI 内容平台的上游系统——平台负责内容消费（用户搜索），这个系统负责内容生产。
>
> 核心是一条**三阶段事件驱动流水线**：Radar 监控 Instagram KOL 发现新 POI；Enrichment 从 Google Maps 和 Instagram 采集完整数据做富化；Article Generation 用 Gemini 做信息原子化、多语言文章生成和 AI 质检。
>
> 架构上的核心设计是 **POI 流式处理**——每个 POI 发现后立即通过 Pub/Sub 流转到下一阶段，不等同批次其他 POI，实现 pipeline 级并行。部署在 GCP Cloud Run 上，4 个微服务独立扩缩容。
>
> 这个项目踩了不少坑：Playwright 内存爆炸打崩 Cloud Run、Pub/Sub 消息超时导致无限重试死循环、Instagram 反爬封 IP 等等。架构和问题排查是我做的，实现层面借助了 AI 编程工具快速交付。"

---

## 一、事件驱动架构与任务编排（核心架构设计）

### 面试官追问链路

```
"三阶段流水线怎么设计的？为什么用事件驱动？"
-> "POI 流式和批处理有什么区别？"
-> "消息格式是什么？怎么保证不丢不重？"
-> "某个 POI 失败了怎么办？"
-> "Cloud Run 被 kill 了，状态怎么恢复？"
```

### 为什么从批处理改为事件驱动（真实踩坑）

**最初是批处理设计**：Scheduler 触发 → 拉取所有账号 → 逐个爬 → 全部完成 → 逐个富化 → 全部完成 → 逐个生成。

**立刻撞墙**：20 个账号 × 每个爬取 30 秒 = 单 Stage 1 就需要 600 秒，直接撞上 Cloud Run 超时限制。更严重的是一个账号失败会阻塞整批。

**关键 insight**：POI 之间没有数据依赖——POI-A 的富化不需要等 POI-B 发现完成。没有数据依赖就不应该有执行依赖。

```
批处理（原方案）：
Account A → Account B → Account C → 全部完成 → Enrich 全部 → 全部完成 → Generate 全部
│────────── 串行等待，总耗时 = 各阶段之和 ──────────│

POI 流式（最终方案）：
Account A ──→ POI-1 ──→ Enrich(1) ──→ Article(1)    ← 立即流转
             POI-2 ──→ Enrich(2) ──→ Article(2)
Account B ──→ POI-3 ──→ Enrich(3) ──→ Article(3)    ← 和 Account A 并行
```

### 方案对比

| 方案 | 不选的原因 |
|------|-----------|
| 单体批处理 | Cloud Run 600s 超时，一个失败阻塞全部 |
| RabbitMQ / Kafka | 一个人维护不了自建消息队列 |
| 定时轮询 | 延迟高，发现 POI 后要等下次定时才能处理 |
| **Pub/Sub + Cloud Run** | 托管免运维，按需扩缩，天然集成 GCP |

### Pub/Sub 通信设计

**三个 Topic，消息粒度递减**：

```
Topic 1: qponx-workflows-radar-account-tasks
  粒度：账号级
  消息：{ task_id, account_handle, scrape_days, city_context, ig_account }

Topic 2: qponx-workflows-enrichment-poi-tasks
  粒度：POI 级（Radar 每发现一个 POI 就立即发一条）
  消息：{ task_id, place_id, venue_name, venue_ig_url }

Topic 3: qponx-workflows-article-gen-tasks
  粒度：POI 级（Enrichment 完成后发）
  消息：{ task_id, place_id, name }
```

**消息自包含设计**：每条消息携带所有必要上下文，Worker 不需要额外查库即可处理。好处是支持消息重放调试，也减少了 DB 压力。

**ACK 与重试**：Pub/Sub ack deadline 600 秒。处理成功才 ack，超时自动重试。代码层面用 UPSERT（INSERT...ON CONFLICT）保证幂等——同一个 POI 重复处理不会产生脏数据。

### 智能调度（避免重复执行）

初版每次 Scheduler 触发都处理所有账号，大量重复执行。后来加了两个优化：

**1. 时间窗口过滤**：

```python
# 如果账号在 scrape_days 窗口内已经检查过，跳过
effective_skip_hours = skip_hours or (account.scrape_days * 24)
if (account.last_checked_at
        and account.scrape_status == "idle"
        and (now - account.last_checked_at).total_seconds() < effective_skip_hours * 3600):
    continue  # 跳过，不发消息
```

**2. 容错状态重置**：Cloud Run 实例可能被系统 kill（内存不足、超时等），导致账号状态永远卡在 "running"。加了自动检测：

```python
# 超过 1 小时仍在 running 的，大概率是 Cloud Run 被 kill 了，重置为 idle
if (account.scrape_status == "running"
        and account.last_checked_at
        and (now - account.last_checked_at).total_seconds() > 3600):
    await update_account_scrape_status(pool, account.account_handle, "idle")
```

### 进度追踪设计（三级粒度 JSONB）

```sql
-- Stage 1: 账号级
stage_radar (task_id + account_handle)
  steps: { "scrape": {"status":"done","duration_ms":3200,"posts_total":15},
           "analyze": {"status":"done","pois_found":3},
           "resolve": {"status":"done"} }

-- Stage 2: POI级
stage_enrichment (task_id + place_id)
  steps: { "google_details": {"status":"done"},
           "google_reviews": {"status":"done","count":45},
           "instagram": {"status":"skipped","reason":"no_account"} }

-- Stage 3: POI×语言级
stage_article_generation (task_id + place_id + language)
  steps: { "atomize": {"status":"done"},
           "generate": {"status":"done"},
           "qa": {"status":"done","score":8.5,"passed":true} }
```

更新采用 best-effort 策略——步骤状态更新失败不阻断主流程，避免"日志写挂了导致业务中断"。

---

## 二、爬虫内存优化（重点踩坑）

### 面试官追问链路

```
"Playwright 在 Cloud Run 上遇到什么问题？"
-> "OOM 是怎么发现的？怎么定位到 Playwright？"
-> "信号量控制并发具体怎么做的？"
-> "资源拦截拦了哪些东西？效果怎么量化？"
-> "Google 评论爬取为什么要两阶段？"
```

### 问题：Playwright 打崩 Cloud Run

**现象**：Enrichment 服务频繁被 Cloud Run 强制终止，日志显示 OOM（Out of Memory）。实例内存 4Gi，理论上够用。

**排查过程**：
- Cloud Run 日志看到 `Memory limit exceeded` → 内存问题
- 分析代码发现：每处理一个 POI 都启动 Playwright 爬 Google 评论，多个 Pub/Sub 消息并发到达时同时打开多个浏览器页面
- 单个 Playwright 页面加载 Google Maps 评论页，包含地图瓦片、街景图、广告等大量资源，内存消耗 500MB-1GB

**解决方案（三层优化）**：

**第一层：信号量控制并发页面数**

```python
MAX_CONCURRENT_PAGES = int(os.environ.get("MAX_CONCURRENT_PAGES", 3))
_concurrency_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PAGES)

# 用 async context manager 保证释放
async def __aexit__(self, exc_type, exc_val, exc_tb):
    try:
        if self.page and not self.page.is_closed():
            await self.page.close()    # 立即释放页面资源
    finally:
        _concurrency_semaphore.release()  # 无论如何都释放信号量
```

即使 Cloud Run concurrency=1（一次只处理一条 Pub/Sub 消息），单个 POI 处理过程中也可能打开多个页面（详情页、评论页等），必须控制。

**第二层：全局浏览器上下文复用**

```python
# 不为每个请求新建浏览器，复用一个全局 BrowserContext
_browser_instance = await _playwright_instance.chromium.launch(...)
_browser_context = await _browser_instance.new_context(
    user_agent=profile["user_agent"],
    viewport=profile["viewport"],
    proxy=proxy_config,
)
```

新建浏览器进程约 200MB 开销，复用则接近 0。同时更像真实用户行为（持续会话而非频繁新建）。

**第三层：Route 拦截无关资源**

```python
async def _resource_route_handler(route):
    resource_type = route.request.resource_type
    url = route.request.url

    # 拦截：非 Google 自有的图片
    if resource_type == "image" and "googleusercontent.com" not in url:
        await route.abort()

    # 拦截：媒体、字体、WebSocket 等
    if resource_type in ("media", "font", "texttrack", "manifest", "websocket"):
        await route.abort()

    # 拦截：广告、统计、reCAPTCHA、地图瓦片等 20+ URL 模式
    blocked_patterns = ["pagead", "doubleclick", "analytics", "recaptcha",
                        "maps/vt", "gen_204", ...]
    if any(p in url for p in blocked_patterns):
        await route.abort()

    await route.continue_()
```

Google Maps 页面默认加载大量地图瓦片、街景缩略图、广告脚本，拦截后单页面内存从 ~800MB 降到 ~200MB。

### Google 评论两阶段提取

**问题**：Google Maps 评论是动态加载的，需要不断滚动触发加载。如果边滚动边提取 DOM，内存中同时存在大量 DOM 引用。

**解决方案**：分两阶段

```
Phase 1 —— 纯滚动（只加载，不提取）
  for _ in range(400):  # 最多滚动 400 次
      scroll to bottom
      wait 1.5-2.5s（随机延迟模拟真人）
      count = 当前评论数量
      if count >= 200 or 连续 3 次无新增:
          break

Phase 2 —— 统一提取（滚动完毕后一次性提取）
  for review_block in all_review_blocks:
      extract text, rating, date, photos, author
      if len(processed) >= 200:
          break
```

好处：Phase 1 DOM 引用不需要保持，浏览器可以 GC；Phase 2 集中处理，内存峰值更低。最多提取 200 条评论，有上限保护。

---

## 三、反爬对抗体系（重点踩坑）

### 面试官追问链路

```
"Instagram 和 Google 的反爬策略有什么不同？"
-> "怎么检测到被限流了？"
-> "代理池怎么管理？代理质量参差不齐怎么办？"
-> "热切换代理不重启浏览器？怎么做到的？"
-> "UA 轮换有 18 组，怎么选的？"
```

### Google Maps 反爬对抗

**问题演进**：
- 第一次遇到：页面返回 "limited view"（信息不完整），实际是 Google 识别到自动化访问
- 第二次遇到：直接 403 或空白页面
- 持续优化反爬策略后趋于稳定

**1. UA + 视窗指纹轮换（18 组配置）**

```python
# 18 组真实浏览器指纹：Windows/macOS/Linux × Chrome/Edge × 不同视窗尺寸
PROFILES = [
    {"os": "windows", "browser": "chrome_130", "viewport": {"width": 1920, "height": 1080},
     "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...Chrome/130..."},
    {"os": "windows", "browser": "edge_131", "viewport": {"width": 1366, "height": 768},
     "user_agent": "Mozilla/5.0 ...Edg/131..."},
    {"os": "macos", "browser": "chrome_131", "viewport": {"width": 2560, "height": 1440}, ...},
    {"os": "linux", "browser": "chrome_130", "viewport": {"width": 1280, "height": 720}, ...},
    # ... 共 18 组
]
# 按真实市场份额分布：Windows/Chrome 占多数，Linux 占少数
```

**2. WebDriver 特征隐藏**

```javascript
// 注入到每个页面的 stealth 脚本
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
window.chrome = {runtime: {}};
```

Playwright Headless 浏览器默认 `navigator.webdriver = true`，这是最容易被检测的特征。

**3. 代理池管理（Redis 分布式锁）**

```python
class ProxyPool:
    def acquire(self, ttl=600):
        proxies = self.client.smembers(self.pool_key)
        random.shuffle(proxy_list)
        for proxy in proxy_list:
            lock_key = f"{self.platform}:{host}:{port}"  # 按平台隔离
            if self.lock_manager.acquire(lock_key, ttl):
                return proxy
        return None  # 所有代理都在使用中

    def mark_invalid(self, proxy):
        self.client.srem(self.pool_key, proxy)      # 从活跃池移除
        self.client.sadd(self.invalid_key, proxy)    # 加入失效列表
```

**分布式锁用 Lua 脚本保证原子释放**：

```lua
-- 只有持有锁的人才能释放（防止 A 释放了 B 的锁）
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

**为什么需要按平台隔离？** Google 和 Instagram 的封禁策略独立——一个代理被 Google 封了，在 Instagram 上可能还能用。`platform` 字段让两个平台不互相锁定对方的代理。

**4. 代理健康评分**

```python
def _get_best_proxy_url(exclude=None):
    # Redis Sorted Set：proxy_scores，score = 健康分
    top = redis.zrevrange("proxy_scores", 0, 9, withscores=True)
    for proxy_url, score in top:
        if proxy_url in live_set and proxy_url != exclude and score >= 10:
            return proxy_url  # 用分数最高的代理
    # 兜底：随机选一个
    return redis.srandmember(PROXY_SET_KEY)
```

成功请求加分，失败请求减分，自然淘汰质量差的代理。

**5. 限流检测 + 热切换代理**

```python
async def _rotate_proxy():
    # 检测到 "limited view" 或异常响应时触发
    new_proxy = _get_best_proxy_url(exclude=current_proxy)

    # 关键：不重启浏览器进程，只换 BrowserContext
    # 关闭旧 context → 用新代理 + 新 UA 创建新 context → 继续处理
    await _browser_context.close()
    _browser_context = await _browser_instance.new_context(
        user_agent=new_profile["user_agent"],
        viewport=new_profile["viewport"],
        proxy={"server": new_proxy}
    )
```

重启浏览器进程约 5 秒 + 200MB 内存，热切换 Context 约 0.5 秒 + 几乎无额外内存。

### Instagram 反爬对抗

Instagram 反爬更严格，策略不同：

**1. 账号池轮换**（而不是仅靠代理）

```python
ig_accounts = await _load_ig_accounts(pool=pool)
# 将 N 个监控目标分配到 M 个爬虫账号，轮换使用
for idx, account in enumerate(eligible_accounts):
    ig_account = ig_accounts[idx % len(ig_accounts)]
```

Instagram 更依赖账号级限流（一个账号短时间内请求太多），纯 IP 轮换不够。

**2. 完整 Session 模拟**

```python
# 从 HTML 中提取 6 个安全 token
tokens = {
    "fb_dtsg": "",         # Facebook DTSG token
    "lsd": "",             # Login Security Data
    "csrf_token": "",      # CSRF token
    "x_bloks_version_id": "",
    "x_ig_app_id": "936619743392459",  # 固定值
    ...
}

# GraphQL 请求必须携带完整 headers
headers = {
    "cookie": cookie_str,
    "x-csrftoken": tokens["csrf_token"],
    "x-fb-lsd": tokens["lsd"],
    "x-bloks-version-id": tokens["x_bloks_version_id"],
    "x-ig-app-id": tokens["x_ig_app_id"],
}
```

缺少任何一个 token，Instagram 直接返回 403。

**3. 游标分页 + 早停**

```python
cursor = None
while True:
    variables = {..., "after": cursor} if cursor else {...}
    resp = await client.post(GRAPHQL_URL, data=data)

    for post in posts:
        if post.date < cutoff_date:
            should_stop = True  # 到达时间窗口边界
            break

    cursor = _extract_end_cursor(resp.json())
    if not cursor or should_stop:
        break
    await asyncio.sleep(0.5)  # 请求间隔
```

---

## 四、微服务并发优化（重点踩坑）

### 面试官追问链路

```
"Cloud Run concurrency=1 是什么意思？怎么并行？"
-> "服务内部有哪些异步并行的地方？"
-> "图片转存死循环是怎么回事？怎么发现的？怎么解决的？"
-> "连接池为什么关闭 statement cache？"
```

### Cloud Run 并发模型

```
Cloud Run 实例 A ←── Pub/Sub 消息 1
Cloud Run 实例 B ←── Pub/Sub 消息 2     ← 水平扩展
Cloud Run 实例 C ←── Pub/Sub 消息 3
```

| 服务 | 内存 | concurrency | max-instances | 原因 |
|------|------|------------|--------------|------|
| Radar | 512Mi | 1 | 5 | 串行避免 Instagram 封号 |
| Enrichment | 4Gi | 1 | 10 | Playwright 吃内存 |
| Article Gen | 1Gi | 1 | 10 | LLM 调用多 |
| Admin | 512Mi | 10 | 2 | 轻量 API |

**为什么 concurrency=1？**
- Radar：同一实例同时处理多个账号会触发 Instagram 频率限制
- Enrichment：Playwright 内存消耗大，并发 OOM
- Article Gen：LLM 调用本身是等待 I/O，单实例并发不提升吞吐

并行靠 **max-instances 水平扩展**——Pub/Sub 自动负载均衡到多个实例。

### 服务内部细粒度并行

虽然每个实例一次只处理一条消息（一个 POI），但处理过程中有大量可并行的子任务：

```python
# 1. 数据查询并行
posts_data, poi_info_map = await asyncio.gather(
    _fetch_posts_data(),
    _fetch_poi_info(),
)

# 2. 原子化 + 图片选择并行
_, article_images = await asyncio.gather(
    _do_atoms(),
    _do_images(),
)

# 3. 图片下载并行（8 并发信号量）
sem = asyncio.Semaphore(8)
async def _fetch_one(candidate):
    async with sem:
        async with httpx.AsyncClient() as client:
            return await client.get(candidate["url"], timeout=30)

await asyncio.gather(*[_fetch_one(c) for c in candidates])
```

### 死循环事件：图片转存阻塞导致 Pub/Sub 无限重试

**这是实际遇到的最棘手的 bug，面试时重点讲。**

**现象**：Radar 服务的某些任务反复执行，日志里看到同一个账号被处理了十几次。

**排查过程**：

```
① 看 Cloud Run 日志：大量相同 message_id 的重复投递
② Pub/Sub 控制台：unacked message 堆积
③ 定位：消息处理没有在 ack deadline（600s）内完成
④ 根因：处理流程的最后一步——图片转存到 S3——是同步阻塞的
```

**根因分析**：

```
主流程：爬帖子 → LLM 提取 POI → 解析 place_id → [图片转存] → 发 Pub/Sub → ACK
                                                    ↑
                                                每张图下载 + 上传 S3 约 2-5 秒
                                                一个帖子 5-10 张图 = 10-50 秒
                                                20 个帖子 = 200-1000 秒
                                                ↓
                                            超过 600s ack deadline
                                                ↓
                                            Pub/Sub 认为处理失败，重新投递
                                                ↓
                                            又执行一遍，又超时 → 死循环
```

**解决方案**：将图片转存移到关键路径之外，采用 best-effort 策略

```python
# 所有核心步骤完成后，再做图片转存（失败不影响主流程）
if all_posts_for_transfer:
    for post in all_posts_for_transfer:
        try:
            await transfer_post_images(pool, exec_logger, post)
        except Exception:
            pass  # best-effort，不中断任务状态更新
```

**更深层的教训**：在事件驱动架构中，**必须保证消息处理时间 < ack deadline**。所有"可选的、耗时的"操作都不应该在关键路径上。

### 连接池：关闭 statement cache

```python
pool = await asyncpg.create_pool(
    ...
    statement_cache_size=0,  # 禁用预编译语句缓存
)
```

Cloud Run 实例可能随时被回收和重建，预编译语句缓存在实例重建后失效但连接可能被复用（通过 Cloud SQL 连接池），导致 `prepared statement does not exist` 错误。关闭缓存牺牲少量性能换稳定性。

---

## 五、LLM 集成与文章质量控制

### 面试官追问链路

```
"LLM 在三个阶段分别做什么？"
-> "信息原子化是什么？为什么需要？"
-> "质检评分标准是什么？不合格怎么办？"
-> "Prompt 模板怎么管理？运营能自己改吗？"
```

### 三阶段 LLM 使用

| 阶段 | LLM 用途 | 输入 | 输出 |
|------|---------|------|------|
| Radar | 帖子分析 + POI 提取 | Instagram 帖子文案 | 结构化 JSON（店名、位置、菜系） |
| Article Gen - 原子化 | 从评论/帖子提取关键事实 | 50 条评论 + 20 条帖子 | 原子列表（事实/观点/特色） |
| Article Gen - 生成 | 基于原子生成文章 | 原子 + 图片 + Prompt | 三语 Markdown 文章 |
| Article Gen - 质检 | 评分 + 通过/不通过 | 文章内容 | JSON（score, passed, evaluation） |

**信息原子化的价值**：
- 直接扔 50 条评论给 LLM 生成文章→上下文窗口浪费、输出不可控
- 先提取"原子"（去重去噪的关键信息点）→LLM 基于高质量输入生成更好的文章
- 原子跨语言共享，避免重复处理

**数据库驱动的 Prompt 管理**：

所有 Prompt 存在 PostgreSQL 表中，Admin Dashboard 提供编辑 UI。每种语言（zh/en/id）× 每种风格（formal/casual/youthful）有独立 Prompt。运营可以直接在后台调整文风，不需要开发介入，不需要重新部署。

**性能优化**：关闭 Gemini thinking 模式（2.5 版本默认开启），减少推理延迟。

---

## 六、Admin Dashboard

**技术栈**：React 19 + TypeScript + Vite + Ant Design + React Router

**6 大模块**：

| 模块 | 功能 |
|------|------|
| 任务监控 | 三阶段进度实时展示（账号级→POI 级→POI×语言级） |
| LLM 配置 | 模型、温度、Token 参数热更新 |
| Prompt 库 | 多语言×多风格 Prompt 编辑 + 预览测试 |
| 账号管理 | Instagram 监控账号列表 CRUD |
| 执行日志 | 三维分类过滤（服务/操作/子操作） |
| 文章预览 | Markdown 渲染 + 图片画廊 + QA 评分 |

架构上是 FastAPI 托管 Vite 构建的 SPA，API 层封装 PostgreSQL 查询。

---

## 七、最难解决的问题

### 难点 1：Pub/Sub 死循环（图片转存阻塞）

（详见第四节，这是面试时最值得讲的 debug 故事）

**为什么值得讲**：
- 完整的排查链路：现象（重复执行）→ 日志分析（unacked 消息）→ 定位（ack timeout）→ 根因（图片转存阻塞关键路径）→ 解法（移出关键路径）
- 体现了对事件驱动架构的理解：ack deadline 的含义、消息重投递机制
- 给出了通用原则："可选的耗时操作不放关键路径"

### 难点 2：Playwright OOM 打崩 Cloud Run

（详见第二节）

**为什么值得讲**：
- 不是一次性解决，而是三层逐步优化（信号量 → 上下文复用 → 资源拦截）
- 每一层都有明确的量化效果
- 体现了在 Serverless 环境下做资源管理的经验

### 难点 3：从批处理到 POI 流式架构的重构

**为什么值得讲**：
- 不是修 bug，而是**推翻架构重新设计**
- 体现了识别问题本质的能力（不是代码优化能解决的，是架构模式的问题）
- 连锁影响大：数据库 schema、消息格式、进度追踪、错误处理全部需要重设计

---

## 八、反思与改进

1. **测试覆盖**：核心链路（消息解析、数据清洗、LLM 输出处理）缺少自动化测试，快速迭代期跳过了，稳定后必须补
2. **可观测性**：自建 execution_logs 够用但不专业，应接入 OpenTelemetry 做分布式链路追踪（一个 POI 在 3 个服务间的完整链路）
3. **LLM 成本**：原子化结果可跨语言共享（只做一次），质检可用更轻量的模型做初筛
4. **Instagram 抓取瓶颈**：长期应接入官方 API 或第三方数据服务，替代 Playwright 爬取

---

## 九、与 AI 内容平台的关系

```
Workflows（本项目）                    AI 内容平台（02 文档）
─────────────────                    ──────────────────
Instagram + Google                   用户搜索 "雅加达日料"
      │                                     │
   三阶段流水线                         RAG 搜索架构
      │                                     │
   生成文章 + 图片                      ES 混合检索
      │                                     │
   写入 PostgreSQL ──── ETL ────→ 写入 Elasticsearch
                                            │
                                    Gemini 流式生成
                                            │
                                       用户看到结果
```

**面试话术**："我不仅建了面向用户的搜索平台，还设计了背后的内容生产系统。从内容生产到内容消费，整条链路的架构都是我设计的。实现层面，前端项目我自己写，后端项目借助 AI 工具交付——但架构设计、问题排查、性能调优这些核心决策都是我做的。"
