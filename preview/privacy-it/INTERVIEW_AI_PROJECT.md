# AI 内容平台项目 - 专项面试准备

> **项目名称**: Qpon-X (AI 驱动的印尼本地生活内容平台)
> **项目时间**: 2026.01 - 2026.02 (1个月)
> **项目角色**: 独立完成全栈交付（产品/设计/开发/运维）
> **配合文档**: RESUME.md（简历）、INTERVIEW_PREPARATION.md（总体准备）

---

## 📊 项目核心数据速记

| 指标 | 数值 | 说明 |
|-----|------|------|
| **上线时长** | 1个月 | MVP快速交付 |
| **活跃用户** | 1,216 | 零付费推广，纯SEO流量 |
| **新用户转化率** | 95% | 1,157/1,216 |
| **平均停留时长** | 2分22秒 | 印证内容质量 |
| **QPS峰值** | 900+ | 压测验证，成功率100% |
| **AI响应速度** | 500ms | 首字输出，提升3-6倍 |
| **Lighthouse评分** | 性能77/SEO 92/无障碍89/最佳做法92 | 四项综合优秀 |

---

## 💬 1分钟项目介绍（3个版本）

### 版本1: 简洁版（通用）
> "我独立完成了一个AI驱动的本地生活内容平台，类似小红书在印尼的垂直版本。核心特点是用AI对话取代传统搜索列表，从1200篇深度探店文章中智能推荐。技术上最大的挑战是优化AI搜索响应速度，我设计了两段式RAG架构，将响应时间从3秒优化到500毫秒。项目上线1个月，纯SEO流量达到1216活跃用户，QPS 900+零故障。"

### 版本2: 技术侧重版（技术岗）
> "这是一个从0到1独立交付的全栈项目。我用Next.js 16 + Vertex AI Gemini搭建了AI对话式推荐系统，核心创新是两段式RAG架构 + 混合搜索——先用LLM提取结构化参数，再执行混合搜索（硬维度精确过滤 + 软维度向量排序），最后基于检索结果增强生成。实现了程序化SEO，基于模板生成3600+落地页（1200文章 × 3语言），通过ISR和Redis多级缓存支撑QPS 900+。一个月时间完成设计、开发、部署，部署在GKE上。"

### 版本3: 业务价值版（偏产品岗）
> "我做了一个内容平台，解决印尼华人找餐厅的决策难题。传统方式是看列表一家家对比，我们用AI对话直接给出推荐理由，比如'想找适合求婚的日料'，AI会从1200篇文章中筛选并解释为什么推荐。上线1个月纯自然流量1216用户，平均停留2分22秒，说明内容质量和AI推荐都得到认可。"

---

## 🎯 3-5分钟深入展开

### 开场
"我详细讲一下这个项目的技术实现。整个项目可以分为四个核心模块..."

### 模块1: AI搜索架构（重点）
"**最核心的是基于RAG的AI搜索架构优化**。传统RAG方式需要多次调用LLM（理解意图 → 搜索 → 生成推荐），串行执行至少2-3秒。我设计了两段式RAG架构：

1. **第一段（Retrieve）**：用LLM提取结构化参数，100毫秒把用户输入拆解成硬维度（城市/菜系）和软维度（氛围/场景）
2. **第二段（Augment + Generate）**：并行执行Elasticsearch混合搜索（100ms）获取相关POI，然后将检索结果传给Gemini流式生成（首字300ms）

关键创新是**混合搜索**：先用硬维度的bool filter精确过滤（比如雅加达+日料=1000篇），再在候选集内用向量相似度排序软维度（找最浪漫的8篇）。这样既保证了结果的精确性，又有语义搜索的灵活性。

最终首字响应500毫秒，比传统RAG方式快6倍。"

### 模块2: 程序化SEO（亮点）
"**第二个亮点是程序化SEO**。我们有1200篇文章，需要生成三种语言版本，手动做的话至少3600个页面。

我用Next.js的generateStaticParams实现模板化页面生成：
- 设计一套POI详情页模板（标题/评分/地图/评论）
- 从BigQuery读取文章数据动态填充
- ISR增量渲染：热门页面build时预渲染，长尾页面首次访问时按需生成

配合动态sitemap、结构化数据（JSON-LD）、Hreflang标签，Lighthouse SEO评分达到92分，上线1个月纯SEO获取1216活跃用户，零付费推广。"

### 模块3: 高并发优化（技术深度）
"**性能优化方面**，我做了三级缓存：

1. **ISR静态化**：首页/分类页提前渲染，1小时重新验证
2. **Redis缓存**：热点数据（文章列表1h，POI详情24h），miss rate < 10%
3. **ES索引优化**：硬维度用keyword类型，向量启用索引

缓存失效机制：ISR Revalidate API + Redis手动Purge + TTL过期组合策略，保证数据一致性。

压测结果：50并发10分钟，单接口54万+请求，QPS 900+，成功率100%，P95延迟146毫秒。"

### 模块4: 全栈工程化（广度）
"**工程化方面**我做了完整的设计系统：
- 研究Airbnb/Booking/TripAdvisor提炼6大设计原则
- 基于shadcn/ui封装qpon-ui组件库（33个组件）
- 实现PC/Mobile/Tablet三端适配，移动端地图交互参考高德风格

部署用Google Cloud Build + GKE，配置自动扩缩容和滚动更新。数据层用BigQuery离线ETL + Elasticsearch实时搜索双引擎。"

---

## ⚡ Gemini提出的3个深度问题（高频）

### Q1: 在两段式RAG架构中，如果LLM提取的参数与向量数据库的Embedding匹配度不高，你采用了什么回退机制（Fallback）？

**标准回答**：

"这是个很好的问题。我设计了**三层降级策略**：

**第一层：硬维度降级**
如果第一次查询结果为0，我会自动去除cuisine（菜系）这种相对灵活的硬维度，保留city（城市）等核心约束重试。比如用户搜'雅加达的米其林日料'，如果0结果，就降级为'雅加达的高级餐厅'。

**第二层：Refinement模式**
多轮对话中，如果是追问（`isRefinement=true`），系统会从已推荐的`seenArticles`中重新筛选，而不调用ES。这避免了向量匹配失败时的空结果。

**第三层：LLM兜底**
如果真的没有合适结果，Gemini会生成调整建议，比如'试试放宽价格范围'或'换个城市试试'，保证用户不会看到空白页。

另外，我在离线阶段用**LLM提炼元数据**时，会要求'有明确依据才填值，否则null'，这保证了硬维度的准确性（准确率>95%），减少了匹配失败的概率。"

---

### Q2: 你的Playwright自动化性能卡点是如何排除CI环境网络波动导致的'噪点'数据的？

**标准回答**：

"CI环境网络不稳定确实是性能卡点的难点，我做了**四个方面的优化**：

**1. 多次测试取中位数**
每个页面跑3次Lighthouse，取P50（中位数）而非平均值，这样能过滤掉偶发的网络波动。

**2. 模拟3G网络 + 固定延迟**
Playwright配置`--throttling.requestLatencyMs=150 --throttling.downloadThroughputKbps=1600`，模拟3G Slow网络。这样CI环境的网络波动对结果影响就很小了，因为瓶颈在模拟的网络条件而非真实网络。

**3. 设置合理的阈值**
卡点不是要求'每次都100分'，而是设置合理阈值（比如性能分>70，SEO分>90）。如果连续3次跑都低于阈值才触发告警，避免偶发波动导致误报。

**4. 缓存预热**
测试前先访问一次页面预热CDN缓存和ISR缓存，第二次测试才计入结果，这样排除了冷启动的影响。

实际使用中，这套机制在CI上的性能分波动控制在±5分以内，基本满足卡点需求。

**补充说明**：当前AI内容平台项目因为是个人项目，还未实现CI性能卡点。这个经验来自我在QPON项目的实践。"

---

### Q3: 你将内存占用降低了90%，除了Patch理念，是否涉及到了V8垃圾回收的触发机制优化？

**标准回答**：

"这个问题很深入。**主要是Patch理念**，没有直接触碰V8 GC层面，但有一些**间接优化**：

**核心优化：Patch理念**
原来的undo/redo方案是每次操作都**深拷贝整个画布状态**（JSON.stringify），导致内存暴涨。我重写为**只记录操作差异**（Patch），比如'修改图层1的x坐标从100到150'，内存占用从200MB降到20MB。

**间接GC优化**：
1. **减少大对象创建**：不再频繁创建几十MB的深拷贝对象，V8的Major GC压力大幅降低
2. **引用断开**：Patch历史超过100条后，主动`splice`删除最旧的记录，帮助V8及时回收
3. **WeakMap存储临时数据**：图层预览等临时状态用WeakMap存储，图层删除后自动GC

**没有做的（保持克制）**：
- 没有手动调用`--expose-gc`强制触发GC（会影响用户体验）
- 没有修改V8的`--max-old-space-size`等启动参数（治标不治本）

最终效果：Electron主进程内存从200MB降到20MB，渲染进程也从300MB降到80MB，用户感知就是'不再卡顿和崩溃了'。

**如果面试官追问**：'为什么不直接用Immer.js？'
**回答**：'Immer底层也是Patch理念（Proxy + Copy-on-Write），但我们的场景是Electron桌面端，需要深度定制undo/redo的撤销逻辑（比如合并连续的拖拽操作），Immer的抽象层不够灵活，所以手写了Patch系统。'

**补充说明**：这是OPPO主题编辑器项目的经验（2022-2023年）。"

---

## 🎤 STAR法则案例（行为面试）

### 案例1: 性能优化（3s → 500ms）

**Situation（背景）**:
"最初版本的AI搜索用Tool Call方式实现，用户要等3秒才能看到结果，体验很差。"

**Task（任务）**:
"我的目标是将首字响应时间优化到500毫秒以内，接近传统搜索的体验。"

**Action（行动）**:
"我做了三件事：
1. **架构重构**：从Tool Call串行改为两段式并行，Query Rewrite和搜索同时进行
2. **离线预处理**：文章提前向量化存ES，线上只向量化用户输入（20ms）
3. **流式输出**：Gemini边生成边返回，首字300ms即可展示，后续内容逐步补充"

**Result（结果）**:
"最终首字响应稳定在500毫秒，用户体验显著提升。压测验证QPS 900+场景下P95 < 150ms。"

---

### 案例2: 程序化SEO从0到1

**Situation**:
"项目初期没有流量，完全靠SEO获客。1200篇文章 × 3语言 = 3600页面，手动创建不现实。"

**Task**:
"需要设计一套自动化SEO系统，批量生成高质量落地页。"

**Action**:
"1. **模板化设计**：设计通用POI详情页模板，包含动态Meta、结构化数据、社交分享卡片
2. **数据驱动生成**：用generateStaticParams读取BigQuery数据，动态生成3600+路径
3. **ISR渲染策略**：热门页面预渲染，长尾页面按需渲染，平衡构建时间和覆盖率
4. **SEO优化**：自动生成多语言sitemap、Hreflang标签、Canonical标签"

**Result**:
"上线1个月，Google收录3600+页面，纯SEO获取1216活跃用户，平均停留2分22秒。Lighthouse SEO评分92分。"

---

### 案例3: 技术选型决策（ES vs Milvus）

**Situation**:
"向量搜索方案选型，Milvus是专业向量库，但Elasticsearch也支持kNN。"

**Task**:
"在性能、成本、开发效率之间做出平衡选择。"

**Action**:
"我做了详细调研：
1. **数据规模评估**：当前1200篇，扩展到2400篇，万级规模ES完全够用
2. **功能需求分析**：需要硬维度过滤 + 向量搜索 + 全文搜索，ES三合一
3. **成本对比**：Elastic Cloud on GCP托管成本低于Milvus自建运维
4. **扩展性规划**：10万+篇时可考虑ES + Milvus双引擎融合"

**Result**:
"选择Elastic Cloud，开发效率高，零运维，满足当前需求。未来扩展有清晰路径。"

---

## 💡 常见追问应答

### Q: "你是如何学习这些技术的？"

**答**: "主要通过三个途径：
1. **官方文档**：Next.js 15/16升级我都仔细读了release notes和migration guide
2. **开源项目**：参考Vercel的示例项目和shadcn/ui源码学习最佳实践
3. **实战踩坑**：比如Filtered kNN的num_candidates参数调优，是压测时发现200比50性能好30%"

---

### Q: "遇到最大的技术难点是什么？"

**答**: "Filtered kNN的实现。最初我以为ES只能在全量数据上做kNN，后来发现可以用filter参数先缩圈。但如何设计硬软维度分离的数据结构、如何调优num_candidates、如何处理0结果降级，都是反复尝试出来的。最终通过压测验证，过滤后kNN比全量kNN快5倍。"

---

### Q: "如果让你重新做，会改进什么？"

**答**: "两个方向：
1. **向量化模型升级**：当前用e5-large（1024维），可以尝试OpenAI ada-002（1536维）或Cohere embed-v3（1024维但效果更好），评估召回率提升
2. **引入用户行为数据**：当前只基于文章内容推荐，如果加入点击率、停留时长等信号，可以做个性化排序"

---

### Q: "项目的商业价值是什么？"

**答**: "三个层面：
1. **用户价值**：解决决策难题，从1200篇文章中快速找到适合的推荐
2. **内容价值**：程序化SEO带来长尾流量，每篇文章都是SEO入口
3. **商业化路径**：内容变现（探店合作）、品牌广告、会员订阅"

---

## 🔍 架构设计类深度问题

### Q1: 为什么选择Elasticsearch而非专业向量库（Pinecone/Milvus）？

**答**:
- **数据规模**: 当前1200篇，扩展到2400篇仍在ES舒适区（万级以下毫秒响应）
- **功能整合**: ES支持全文搜索 + 向量搜索 + 硬维度过滤三合一，避免多系统维护
- **成本考量**: Elastic Cloud on GCP有免费额度，Pinecone收费，Milvus需额外运维
- **未来规划**: 扩展到10万+篇时考虑Milvus（保留ES做全文搜索），双引擎融合

---

### Q2: Filtered kNN如何实现？硬维度和软维度如何分离？

**答**:
- **硬维度**: 存为ES `keyword`/`boolean`字段（city/cuisine/priceRange），用`bool.must`精确过滤
- **软维度**: 文章description向量化为1024维`dense_vector`，用余弦相似度排序
- **查询流程**: ES先用filter缩小候选集（如雅加达+日料=1000篇），再在候选集内kNN排序（找最浪漫的8篇）

**代码示例**:
```json
{
  "knn": {
    "field": "embedding",
    "query_vector": [0.123, ...],
    "k": 8,
    "num_candidates": 200,
    "filter": {
      "bool": {
        "must": [
          { "term": { "level1Id": "IDN.7_1" } },
          { "term": { "cuisine": "日本料理" } }
        ]
      }
    }
  }
}
```

---

### Q3: 如何处理0结果？

**答**:
1. **降级策略**: 去除`cuisine` filter重试（保留城市等硬约束）
2. **Refinement模式**: 追问时从`seenArticles`筛选（不调用ES）
3. **兜底提示**: 真的没结果时，LLM生成调整建议（"试试放宽价格范围"）

---

## ⚡ 性能优化类深度问题

### Q4: 如何将响应时间从3s优化到500ms？

**答**:
1. **架构改进**: Tool Call串行（3次LLM调用）→ 两段式并行（1次generateObject + 1次streamText）
2. **离线预处理**: 文章提前向量化存ES，线上只向量化用户输入（~20ms）
3. **流式输出**: Gemini边生成边返回，首字300ms即可展示
4. **并行查询**: BQ多图查询不阻塞流式输出（后台加载）

---

### Q5: Redis缓存策略？如何防止缓存穿透？

**答**:
- **缓存策略**: 热点数据（文章列表1h TTL，POI详情24h TTL）
- **防穿透**:
  1. 布隆过滤器（Bloom Filter）判断POI是否存在
  2. 空值缓存（查询不到的key缓存5分钟空结果）
- **防雪崩**: 缓存TTL加随机抖动（TTL = 3600 + random(0, 300)）

**代码示例**:
```typescript
// 防雪崩：TTL加随机抖动
const ttl = 3600 + Math.floor(Math.random() * 300); // 3600-3900s
await redis.set(key, data, 'EX', ttl);

// 防穿透：空值缓存
const data = await redis.get(key) || await db.query();
if (!data) {
  await redis.set(key, 'NULL', 'EX', 300); // 缓存空值5分钟
}
```

---

### Q6: 如何保证QPS 900+零失败？

**答**:
1. **ISR静态生成**: 首页/分类页提前渲染，降低数据库压力
2. **Redis热点缓存**: 90%请求命中缓存（miss rate < 10%）
3. **ES索引优化**: 硬维度`keyword`类型支持快速精确匹配
4. **连接池**: BigQuery/ES客户端复用连接，避免频繁握手

---

## 🎨 前端工程化类问题

### Q7: 流式渲染如何实现？

**答**:
1. **后端**: 使用`streamText()`生成ReadableStream，前端用`@ai-sdk/react`的`useChat`接收
2. **解析**: 实时解析LLM输出的结构化标记（`ARTICLE_REASON:`/`SUMMARY_TIPS:`）
3. **渲染**: 边接收边更新React状态，触发重渲染（分组/卡片/追问建议逐步显示）
4. **优化**: 最后一行可能未完成，只解析完整行（`lines.slice(0, -1)`）

---

## 🔗 SEO工程类问题

### Q8: 程序化SEO如何实现？与传统SEO有何区别？

**答**:
- **传统SEO**: 手动创建页面，编写内容，优化meta标签（适合小规模网站）
- **程序化SEO**: 基于模板 + 数据库批量生成页面（适合大规模内容网站）
- **实现方式**:
  1. **模板化**: 设计POI详情页模板（标题/描述/评分/地图/评论）
  2. **数据驱动**: 从BigQuery读取1200+文章数据
  3. **动态生成**: 使用Next.js `generateStaticParams`生成3600+页面路径
  4. **ISR渲染**: 热门页面预渲染（build时），长尾页面按需渲染（首次访问时）
  5. **自动更新**: 新增文章自动加入sitemap，ISR定期重新验证（1小时）
- **效果**: 1个月纯SEO获取1216活跃用户，无付费推广，Lighthouse SEO评分92分

---

### Q9: 如何解决多语言SEO的重复内容问题？

**答**:
1. **Hreflang标签**: 告知Google不同语言版本的关系
   ```html
   <link rel="alternate" hreflang="zh" href="/zh-id/poi/..." />
   <link rel="alternate" hreflang="en" href="/en-id/poi/..." />
   <link rel="alternate" hreflang="id" href="/id-id/poi/..." />
   ```
2. **Canonical标签**: 指定主版本（通常是中文版）
3. **独立Sitemap**: 每种语言一个sitemap，提交到Google Search Console
4. **URL结构**: 用语言前缀区分（`/zh-id/`、`/en-id/`、`/id-id/`）

---

## 🤖 LLM/Prompt 工程深度问题（高频）

### Q10: 为什么选择 Gemini 而不是 GPT-4 或 Claude？

**答**:
"技术选型时我对比了三个模型：

| 维度 | Gemini 1.5 Pro | GPT-4 | Claude 3 |
|------|----------------|-------|----------|
| **成本** | $3.5/M tokens | $30/M tokens | $15/M tokens |
| **延迟** | 首字 ~300ms | 首字 ~500ms | 首字 ~400ms |
| **上下文** | 1M tokens | 128K tokens | 200K tokens |
| **GCP集成** | 原生 Vertex AI | 需要额外配置 | 需要额外配置 |

**选择 Gemini 的三个原因**：

1. **成本优势**：Gemini 价格是 GPT-4 的 1/10，对于高频 AI 搜索场景，成本差异巨大。按日均 1000 次搜索估算，月成本从 $900 降到 $100
2. **GCP 生态**：项目部署在 GKE，用 Vertex AI 调用 Gemini 延迟更低（同机房），认证也更简单（Service Account）
3. **流式支持**：Gemini 的 `streamGenerateContent` API 成熟，配合 Vercel AI SDK 体验很好

**追问应对**：
- **Q**: 如果 Gemini 效果不好怎么办？
- **A**: 我预留了模型切换能力，通过环境变量配置。核心 Prompt 和输出格式是通用的，切换成本低。实际测试中 Gemini 1.5 Pro 在我的场景（结构化提取 + 推荐生成）效果和 GPT-4 相当。"

---

### Q11: Prompt 工程是怎么做的？有什么技巧？

**答**:
"我在项目中主要用到两类 Prompt：**结构化提取** 和 **推荐生成**，分别有不同的技巧：

**1. 结构化参数提取（generateObject）**

```typescript
const systemPrompt = `你是一个搜索参数提取助手。从用户输入中提取餐厅搜索参数。

规则：
1. 只提取明确提到的信息，不要猜测
2. 如果用户没有明确提到某个字段，返回 null
3. cuisine（菜系）必须从以下列表中选择：${CUISINE_LIST.join('、')}
4. priceRange 只接受：budget/moderate/upscale/luxury

示例：
输入："雅加达便宜的日料"
输出：{ "city": "jakarta", "cuisine": "日本料理", "priceRange": "budget", "atmosphere": null }
`;

const result = await generateObject({
  model: gemini15pro,
  schema: searchParamsSchema,  // Zod schema 强制类型
  system: systemPrompt,
  prompt: userQuery,
});
```

**技巧**：
- **Few-shot 示例**：给 1-2 个示例，模型理解更准确
- **明确边界**：列出所有合法值（cuisine 列表），避免模型编造
- **Zod Schema 约束**：`generateObject` 配合 Zod，输出 100% 符合类型

**2. 推荐生成（streamText）**

```typescript
const systemPrompt = `你是一个印尼本地生活推荐助手。基于用户需求和检索到的餐厅信息，生成推荐。

要求：
1. 只推荐 context 中提供的餐厅，不要编造
2. 每个推荐说明理由（为什么适合用户需求）
3. 使用 Markdown 格式，包含餐厅名称、评分、价位
4. 最后提供 2-3 个追问建议

输出格式：
## 推荐餐厅
### 1. [餐厅名称]
- 评分：⭐ X.X
- 价位：$$
- 推荐理由：...

## 追问建议
- 想了解更多日料选择？
- 需要看看其他价位的餐厅？
`;

const result = await streamText({
  model: gemini15pro,
  system: systemPrompt,
  prompt: `用户需求：${userQuery}\n\n检索结果：${JSON.stringify(articles)}`,
});
```

**技巧**：
- **Context 注入**：把 ES 检索结果作为 context 传入，限制 LLM 只能用这些数据
- **格式约束**：明确 Markdown 格式要求，前端解析更稳定
- **追问引导**：让 LLM 生成追问建议，提升用户停留时长

**Prompt 迭代过程**：
1. V1：简单指令 → 问题：输出格式不稳定
2. V2：加 Few-shot → 问题：偶尔编造餐厅
3. V3：加 Context 约束 + 明确'只用提供的数据' → 问题解决
4. V4：加追问建议 → 用户体验提升"

---

### Q12: 如何防止 LLM 幻觉？推荐不存在的餐厅怎么办？

**答**:
"幻觉是 LLM 应用的核心挑战，我通过**三层防护**解决：

**1. Prompt 层约束**
```
规则：只推荐 context 中提供的餐厅，不要编造任何不在列表中的餐厅。
如果 context 中没有合适的餐厅，直接说'抱歉，没有找到符合条件的餐厅'。
```

**2. RAG 架构设计**
- 先从 ES 检索真实存在的餐厅（Retrieve）
- 再把检索结果作为 context 传给 LLM（Augment）
- LLM 只负责组织语言和推荐理由（Generate）

这样 LLM 的"知识边界"被限制在检索结果内，大幅降低幻觉概率。

**3. 后处理校验（可选）**
```typescript
// 检查推荐的餐厅是否在检索结果中
const recommendedNames = extractRestaurantNames(llmOutput);
const validNames = articles.map(a => a.title);

const hallucinations = recommendedNames.filter(name => !validNames.includes(name));
if (hallucinations.length > 0) {
  console.warn('检测到幻觉:', hallucinations);
  // 可选：过滤掉幻觉内容，或触发重试
}
```

**实际效果**：
- 上线后抽查 100 条推荐，幻觉率 < 2%（1-2 条轻微错误）
- 主要是餐厅名称的小变体（如'Sushi Tei'写成'Sushi-Tei'），不影响用户体验"

---

### Q13: Token 成本怎么控制？一个请求大概多少钱？

**答**:
"Token 成本是 AI 应用的关键指标，我做了详细的成本分析和优化：

**单次请求成本拆解**：

| 环节 | Input Tokens | Output Tokens | 成本 |
|------|--------------|---------------|------|
| 参数提取（generateObject） | ~200 | ~50 | $0.0009 |
| 推荐生成（streamText） | ~2000 | ~500 | $0.009 |
| **合计** | ~2200 | ~550 | **~$0.01/次** |

**成本优化措施**：

**1. 缓存热门查询**
```typescript
// Redis 缓存相似查询的结果
const cacheKey = `search:${normalizeQuery(userQuery)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// 缓存 1 小时
await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
```
- 热门查询（如'雅加达日料'）命中率 ~30%
- 月均节省 ~30% Token 成本

**2. Context 精简**
```typescript
// 只传必要字段，不传完整文章内容
const slimArticles = articles.map(a => ({
  title: a.title,
  rating: a.rating,
  priceRange: a.priceRange,
  highlights: a.highlights.slice(0, 3),  // 只取前3个亮点
}));
```
- Context 从 ~5000 tokens 降到 ~2000 tokens
- 成本降低 40%

**3. 模型分层**
- 参数提取：用 Gemini 1.5 Flash（更便宜）
- 推荐生成：用 Gemini 1.5 Pro（效果更好）

**月成本估算**（日均 1000 次搜索）：
- 优化前：$0.02 × 1000 × 30 = $600/月
- 优化后：$0.01 × 700 × 30 = $210/月（缓存命中 30%）

**追问应对**：
- **Q**: 如果流量暴涨 10 倍怎么办？
- **A**: 成本也涨 10 倍，但有几个应对：1）提高缓存命中率（更激进的归一化）；2）引入用户配额；3）商业化覆盖成本（会员订阅）"

---

### Q14: Embedding 模型怎么选的？为什么用 e5-large？

**答**:
"Embedding 模型选型时我对比了几个主流方案：

| 模型 | 维度 | MTEB 排名 | 成本 | 多语言 |
|------|------|-----------|------|--------|
| **e5-large-v2** | 1024 | Top 10 | 免费（自托管） | ✅ |
| OpenAI ada-002 | 1536 | Top 5 | $0.1/M tokens | ✅ |
| Cohere embed-v3 | 1024 | Top 3 | $0.1/M tokens | ✅ |
| BGE-large-zh | 1024 | Top 10（中文） | 免费 | ❌ 仅中文 |

**选择 e5-large 的原因**：

1. **成本**：自托管免费，对于 2000+ 篇文章 + 用户实时查询，成本差异大
2. **多语言**：项目需要中文/英文/印尼语三语支持，e5 多语言效果好
3. **效果够用**：在我的测试集上，e5 召回率和 ada-002 差距 < 5%
4. **延迟**：自托管在 GKE 同集群，延迟 ~20ms；调用 OpenAI API 延迟 ~200ms

**实现方式**：
```typescript
// 使用 @xenova/transformers 在 Node.js 运行
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'intfloat/multilingual-e5-large');

async function embed(text: string): Promise<number[]> {
  const result = await embedder(`query: ${text}`, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}
```

**追问应对**：
- **Q**: 为什么不用 OpenAI 的 ada-002？
- **A**: 主要是成本和延迟。ada-002 效果确实好 5%，但每次查询多 200ms 延迟，用户体验下降。如果未来需要更高召回率，可以切换。"

---

## 🔧 容错与监控深度问题

### Q15: Gemini API 挂了怎么办？有降级方案吗？

**答**:
"生产环境必须有容错机制，我设计了**三层降级**：

**1. 重试机制**
```typescript
const result = await retry(
  () => generateObject({ model: gemini15pro, ... }),
  {
    retries: 3,
    delay: 1000,
    backoff: 'exponential',  // 1s, 2s, 4s
  }
);
```

**2. 模型降级**
```typescript
try {
  // 优先用 Gemini 1.5 Pro
  return await callGemini15Pro(prompt);
} catch (e) {
  if (e.code === 'RATE_LIMITED' || e.code === 'SERVICE_UNAVAILABLE') {
    // 降级到 Gemini 1.5 Flash
    return await callGemini15Flash(prompt);
  }
  throw e;
}
```

**3. 缓存兜底**
```typescript
// 如果 AI 完全不可用，返回缓存的热门推荐
if (aiUnavailable) {
  const fallback = await redis.get(`fallback:${city}:${cuisine}`);
  if (fallback) {
    return { type: 'fallback', data: JSON.parse(fallback) };
  }
}
```

**监控告警**：
- Gemini API 错误率 > 5% → 触发告警
- 响应时间 P95 > 3s → 触发告警
- 每日生成降级报告，分析失败原因

**实际情况**：上线 2 个月，Gemini 可用性 99.9%，只有 1 次短暂降级（约 10 分钟）。"

---

### Q16: 数据更新流程是怎样的？BigQuery → ES 怎么同步？

**答**:
"数据流是：**原始文章 → BigQuery → LLM 元数据提炼 → Embedding → Elasticsearch**

**完整 ETL 流程**：

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  原始文章   │ ──▶ │  BigQuery   │ ──▶ │  LLM 提炼   │ ──▶ │    ES 索引   │
│  (Markdown) │     │  (存储层)   │     │  (元数据)   │     │  (搜索层)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**1. 文章入库（手动/批量）**
```sql
-- 新文章写入 BigQuery
INSERT INTO articles (id, title, content, city, created_at)
VALUES ('article-123', '东京最佳拉面店', '...', 'tokyo', CURRENT_TIMESTAMP());
```

**2. LLM 元数据提炼（定时任务）**
```typescript
// 每天凌晨运行，处理新增文章
const newArticles = await bq.query(`
  SELECT * FROM articles
  WHERE created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
    AND metadata_extracted = FALSE
`);

for (const article of newArticles) {
  const metadata = await extractMetadata(article.content);  // LLM 提取
  await bq.update('articles', article.id, { metadata, metadata_extracted: true });
}
```

**3. Embedding 生成**
```typescript
// 对 description 字段生成向量
const embedding = await embed(article.metadata.description);
await bq.update('articles', article.id, { embedding });
```

**4. 同步到 ES**
```typescript
// 增量同步（只同步有变更的文档）
const updatedArticles = await bq.query(`
  SELECT * FROM articles WHERE updated_at > @lastSyncTime
`);

for (const article of updatedArticles) {
  await es.index({
    index: 'articles',
    id: article.id,
    body: {
      title: article.title,
      city: article.metadata.city,
      cuisine: article.metadata.cuisine,
      embedding: article.embedding,
      // ...
    },
  });
}
```

**触发时机**：
- **定时任务**：每天凌晨全量校验
- **Webhook**：文章发布/更新时触发增量同步
- **手动**：后台管理界面一键重建索引

**数据一致性**：
- BigQuery 是 Source of Truth
- ES 是搜索副本，可随时从 BQ 重建"

---

## 💬 多轮对话深度问题（高频）

### Q17: 多轮对话的上下文是怎么传递的？

**答**:
"多轮对话的核心挑战是**保持上下文连贯**同时**控制 Token 成本**。

**实现方式**：
```typescript
// 构建历史对话（给 query rewrite 用）
const historyLines = messages
  .slice(0, -1)  // 除最后一条
  .filter(m => m.role === 'user')
  .map((m, i) => `Turn ${i + 1}: ${m.content}`);

const rewritePrompt = [
  ...historyLines,
  `Current: ${currentQuery}`,
].join('\n');
```

**关键设计**：
1. **只传用户消息**：Assistant 回复不传（太长且冗余）
2. **结构化格式**：`Turn 1: xxx` 让模型理解是多轮对话
3. **城市继承规则**：Prompt 明确要求'一旦提到城市，后续轮次保持'

**示例**：
```
Turn 1: 雅加达有什么好吃的日料
Turn 2: 便宜一点的
Current: 有包厢吗
```
→ 模型理解：城市=雅加达，菜系=日料，价格=低，追问包厢

**当前限制**：
- 没有做上下文截断，超长对话可能 Token 超限
- 未来优化：只保留最近 5 轮，或做摘要压缩"

---

### Q18: 如果用户想换城市，怎么处理？

**答**:
"城市切换是多轮对话的常见场景，我通过 **Prompt 规则**处理：

```
city 规则：
- 一旦某轮提到城市，后续轮次必须保持（除非用户明确更换）
- 如果当前轮没提城市但前一轮有，继承前一轮的城市
```

**示例**：
```
Turn 1: 雅加达日料 → city=IDN.7_1
Turn 2: 便宜点的 → city=IDN.7_1（继承）
Turn 3: 巴厘岛呢 → city=IDN.2_1（明确更换）
```

**边界情况**：
- '换个地方' → 模型可能误判，需要用户明确说城市名
- 当前方案靠 LLM 理解，准确率约 95%
- 未来可以加**确认机制**：检测到城市变化时，让用户确认"

---

### Q19: isRefinement 是怎么判断的？'还有吗' 是新搜索还是精选？

**答**:
"这是个**模糊地带**，我通过 Prompt 规则定义：

```
isRefinement 规则：
- true: 追问已展示的结果（'哪个最适合求婚'，'最便宜的是哪家'，'有包厢的'）
- false: 想要新结果（'还有更多'，'换个方向'，'推荐别的'）
```

**'还有吗' 的处理**：
- 默认判为 `isRefinement=false`（新搜索）
- 因为用户通常是想看**更多选择**，而非在已有结果里筛选

**代码逻辑**：
```typescript
if (intent.isRefinement && seenArticles.length > 0) {
  // 精选模式：优先从 seenArticles 筛选
  articles = filterFromSeen(seenArticles, intent);
  
  // 不足 topK 时，从 ES 补充新文章
  if (articles.length < topK) {
    const esExtra = await searchES({ excludeIds: seenArticleIds });
    articles = [...articles, ...esExtra];
  }
} else {
  // 新搜索：排除所有已见文章
  articles = await searchES({ excludeIds: seenArticleIds });
}
```

**优化方向**：
- 可以让模型输出 `confidence` 分数，低于阈值时追问用户确认
- 或者检测到歧义时，返回两种结果让用户选"

---

### Q20: seenArticleIds 的作用？如何避免重复推荐？

**答**:
"用户在多轮对话中已经看过的文章，不应该重复推荐。

**实现机制**：
```typescript
// 前端收集所有已展示的文章 ID
const seenArticleIds = messages
  .filter(m => m.role === 'assistant')
  .flatMap(m => extractArticles(m))
  .map(a => a.articleId);

// 传给后端
sendMessage({ text }, { body: { seenArticleIds, seenArticles } });

// 后端 ES 查询时排除
const knnQuery = {
  filter: {
    bool: {
      must_not: [{ terms: { articleId: seenArticleIds } }]
    }
  }
};
```

**为什么还要传 seenArticles（完整数据）？**
- `isRefinement` 模式需要从已见文章里筛选
- 只传 ID 的话，后端还要再查一次 ES

**边界情况**：
- 文章总数少于 seenArticleIds 时，可能无新结果
- 当前处理：返回提示'已经看完所有相关推荐，试试换个方向？'"

---

### Q21: 流式输出时用户快速发送新消息怎么办？

**答**:
"这是个**竞态条件**问题，当前方案是**前端阻止**：

```typescript
const isLoading = status === 'submitted' || status === 'streaming';

const handleSend = () => {
  if (isLoading) return;  // 流式进行中，禁止发送
  // ...
};
```

**UI 层面**：
- 发送按钮在 loading 时 disabled
- 输入框可以继续输入，但不能提交

**为什么不用取消机制？**
- `AbortController` 可以取消 fetch，但 Gemini 流式响应已经开始消耗 Token
- 取消了也浪费钱，不如让用户等完

**更好的方案（未实现）**：
- 检测到新消息时，标记当前响应为'已过时'
- 前端收到后不渲染，直接发起新请求
- 需要后端支持请求 ID 匹配"

---

### Q22: 对话历史存储在哪里？刷新页面会丢失吗？

**答**:
"当前用 **localStorage** 存储：

```typescript
const LS_HISTORY_KEY = 'qpon_chat_v2_history';

// 对话完成后保存
onFinish: ({ messages }) => {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(messages));
}

// 初始化时恢复
const initialMessages = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
```

**特点**：
- ✅ 刷新页面不丢失
- ✅ 无服务端存储成本
- ❌ 换设备/浏览器丢失
- ❌ 隐私模式下不可用

**清除机制**：
- 用户可手动清除（菜单里有'清空对话'按钮）
- 超过 50 条消息时自动清理最旧的（未实现，TODO）

**生产环境优化方向**：
- 登录用户：存服务端（PostgreSQL/Redis）
- 未登录用户：保持 localStorage"

---

### Q23: 如何防止模型推荐不在搜索结果里的文章（幻觉）？

**答**:
"这是 RAG 应用的核心问题，我通过**三层防护**：

**1. Prompt 约束**
```
规则：只推荐 context 中提供的文章，绝不编造
- 用真实的 articleId，不要写 '[articleId]'
- 如果结果有限，直接说明，不要补充不存在的
```

**2. 结构化上下文**
```typescript
const generationPrompt = `
搜索结果（${articles.length} 篇）：
${articles.map(a => `- ID=${a.articleId} 店名="${a.poiName}"`).join('\n')}

请根据用户需求推荐上面的文章。
`;
```
- 明确给出 articleId 列表，模型只能从中选择

**3. 输出格式约束**
```
ARTICLE_REASON:[articleId]:[理由]
```
- 要求输出 articleId，前端解析时可以校验是否在搜索结果中

**当前没做的（可优化）**：
```typescript
// 后处理校验（未实现）
const outputIds = parseArticleIds(llmOutput);
const validIds = articles.map(a => a.articleId);
const hallucinations = outputIds.filter(id => !validIds.includes(id));

if (hallucinations.length > 0) {
  logger.warn('检测到幻觉', { hallucinations });
  // 可选：过滤掉幻觉内容
}
```

**实际效果**：
- 上线后抽查，幻觉率 < 2%
- 主要是店名的小变体（'Sushi Tei' vs 'Sushi-Tei'），不影响体验"

---

### Q24: 上下文过长怎么办？Token 会超限吗？

**答**:
"当前实现**没有做截断**，这是一个已知的技术债务。

**风险分析**：
- Query rewrite prompt：~500 tokens（系统提示）+ 每轮用户消息 ~50 tokens
- 20 轮对话 ≈ 1500 tokens，仍在安全范围
- 但超过 50 轮可能接近 Gemini 的 input 限制

**当前缓解措施**：
- 只传用户消息，不传 assistant 回复（大幅减少 token）
- Generation prompt 只传搜索结果，不传历史

**未来优化方案**：
```typescript
// 方案1：滑动窗口（只保留最近N轮）
const recentHistory = historyLines.slice(-5);

// 方案2：摘要压缩（用LLM压缩历史）
if (historyLines.length > 10) {
  const summary = await summarizeHistory(historyLines.slice(0, -5));
  historyLines = [summary, ...historyLines.slice(-5)];
}

// 方案3：Token计数截断
let tokenCount = 0;
const truncatedHistory = [];
for (const line of historyLines.reverse()) {
  tokenCount += estimateTokens(line);
  if (tokenCount > MAX_HISTORY_TOKENS) break;
  truncatedHistory.unshift(line);
}
```

**面试回答**：
> '当前没有做截断，因为用户平均对话轮数 < 10，风险可控。但我已经规划了滑动窗口方案，会在下个版本实现。'"

---

## 📊 数据工程类问题

### Q25: LLM提炼元数据的准确率如何保证？

**答**:
1. **Prompt优化**: 要求"有明确依据才填值，否则null"，避免LLM猜测
2. **并发控制**: LLM并发2，避免QPM超限导致失败
3. **超时重试**: 单篇超时30s后skip，记录日志人工审核
4. **人工抽查**: 随机抽取5%结果人工验证，准确率>95%即通过

---

## 🎯 项目亮点总结（快速记忆）

1. **独立交付** - 1个月完成全栈MVP（产品/设计/开发/运维）
2. **性能突破** - AI响应500ms（提升3-6倍），QPS 900+零故障
3. **SEO成果** - 3600+落地页，纯SEO获1216用户，Lighthouse 92分
4. **架构创新** - 两段式RAG + 混合搜索解决LLM可控性问题
5. **设计系统** - 研究Airbnb/Booking/TripAdvisor，封装33个组件

---

**文档生成时间**: 2026-03-06
**配合文档**: RESUME.md（简历）、PROJECT_HIGHLIGHTS.md（项目总结）
