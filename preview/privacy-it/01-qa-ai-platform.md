# AI 内容平台 - 面试 QA 手册

> 基于简历项目「AI驱动的印尼本地生活内容平台」，按面试官考察维度组织。
> 每个 QA 包含：面试官问题 → 回答（PCTCR 结构） → 预判追问 → 追问回答。

---

## Part 1: 项目总览与全栈交付

### Q1: 介绍一下这个项目的背景和你的角色

**回答**：

这是一个面向印尼市场的三语（印尼语/英语/中文）本地生活内容平台，核心功能是基于 2400+ 篇美食探店文章和 Google POI 数据，通过 AI 对话式搜索帮用户发现餐厅。

我独立完成了从 0 到 1 的全流程：产品设计、架构设计、全栈开发、部署运维。技术栈是 Next.js 16 + shadcn/ui + Tailwind CSS + Vertex AI Gemini + Elasticsearch + BigQuery + Redis，部署在 GCP（Cloud Build + GKE + CDN）。

项目已上线，通过 ISR + Redis 多级缓存实现 P95 页面访问延迟 146ms，支撑 QPS 900+。

**预判追问**：

#### Q1-1: 为什么选择 Next.js 而不是纯 React SPA？

这个项目有两个关键需求决定了必须用 SSR 框架：

1. **SEO 需求**：我们要做 120w+ 多语言落地页的程序化 SEO，纯 SPA 的客户端渲染对搜索引擎爬虫不友好，需要服务端渲染来保证页面内容可被索引。

2. **首屏性能**：面向印尼市场，用户设备和网络条件参差不齐，SSR 能让首屏内容更快呈现，不依赖客户端 JS 加载完成。

在 SSR 框架里选 Next.js 而不是 Nuxt/Remix，主要考虑：团队（虽然是我独立开发，但后续会有人接手）React 技术栈更熟悉；Next.js 的 ISR（增量静态再生）能力非常适合我们"内容更新频率低但页面量巨大"的场景，不用每次全量构建；App Router 的 Server Components 能天然减少客户端 JS bundle。

#### Q1-2: 你说独立完成全流程，具体怎么理解"独立"？有没有和其他角色协作？

独立是指技术侧的端到端交付：我一个人完成了产品方案设计、技术架构、前后端开发、数据 pipeline、部署上线。

但不是完全没有协作。产品方向和业务目标是和团队 leader 对齐的；UI 设计没有专职设计师，我参考了 Airbnb、Booking、TripAdvisor 的设计语言自己做的设计系统；数据源（文章、POI）是已有的业务数据，我直接从 BigQuery 读取。

#### Q1-3: 技术选型上，为什么选 Elasticsearch 而不是 PostgreSQL 的全文搜索或者 Pinecone 这类向量数据库？

这个选型是数据特点和查询需求共同决定的：

我们的搜索场景是**混合检索**——既有精确过滤（城市、菜系、是否清真），又有语义匹配（"适合约会的浪漫餐厅"）。需要 BM25 关键词匹配 + kNN 向量搜索 + 结构化过滤三者协同。

- **PostgreSQL 全文搜索**：能做 BM25 和基本过滤，但不支持原生 kNN 向量搜索（pg_vector 扩展当时在我们的 GCP Cloud SQL 版本上还不够成熟），而且对中文分词支持弱。
- **Pinecone / Milvus 等纯向量库**：向量搜索能力强，但缺少 BM25 和复杂的结构化过滤，精确查店名、菜名时效果差。
- **Elasticsearch 8.x**：原生支持 dense_vector + kNN，BM25 全文搜索成熟，smartcn 中文分词插件开箱即用，function_score 可以加 googleRating 权重。一个引擎解决所有需求，架构最简单。

数据量只有 2400+ 条，ES 单分片就能搞定，运维成本也不高。

#### Q1-4: 为什么选 Next.js 16 的 App Router 而不是 Pages Router？遇到过什么坑？

选 App Router 的原因：

1. **Server Components 是默认模式**：大部分页面是内容展示型的，Server Components 天然减少客户端 JS bundle，对印尼低端机和弱网环境友好。
2. **布局嵌套（Nested Layouts）**：App Router 的 `layout.tsx` 支持布局复用和嵌套，在路由切换时不会重新渲染公共布局（导航栏、侧边栏），体验更流畅。Pages Router 每次路由切换都会重新渲染整个页面组件。
3. **流式渲染（Streaming SSR）**：配合 `loading.tsx` 和 Suspense，可以分块流式返回 HTML，用户不用等整个页面渲染完才看到内容。对我们这种数据获取较慢的页面（需要查 ES + BigQuery）很有价值。
4. **与 next-intl 配合更好**：next-intl v4 对 App Router 的支持更完善，`[locale]` 动态段 + Server Components 中的 `getTranslations()` 用起来很自然。

**遇到的坑**：

1. **Hydration Mismatch**：Server Components 和 Client Components 的边界如果划分不清，容易出现服务端和客户端渲染结果不一致的问题。比如用了 `Date.now()` 或 `window.innerWidth` 这种在两端结果不同的值。我的做法是严格控制 `'use client'` 的范围，只在需要交互的最小组件上标记，数据获取和格式化全部留在 Server Components。
2. **缓存行为不透明**：App Router 的 fetch 缓存策略（Data Cache）在早期版本比较混乱，默认行为改过几次。我最终选择显式控制——所有服务端 fetch 都明确设置 `cache` 和 `revalidate` 参数，不依赖框架默认值。
3. **Client Components 的"传染性"**：一个组件标了 `'use client'`，它 import 的所有模块都会被打包到客户端 bundle，即使被 import 的组件本身没有标 `'use client'`。换句话说，`'use client'` 是一条边界线，边界以下的所有 import 都会"降级"为客户端代码。

   **如何在 Client Component 内嵌入 Server Component**：不能用 import，要用 children/slot 模式——在父级的 Server Component（比如 page.tsx）中同时渲染 ClientWrapper 和 ServerChild，把 ServerChild 作为 `children` props 传入 ClientWrapper。这样 ServerChild 的渲染仍然在服务端完成，只是渲染结果作为 React 节点传递，它的 JS 代码不会进客户端 bundle。

   ```tsx
   // page.tsx (Server Component)
   <ClientWrapper>
     <ServerChild />   {/* 仍然在服务端渲染，JS 不进 bundle */}
   </ClientWrapper>
   ```

   我在项目中把组件做了严格分层——`components/common`（大部分是 Server 兼容的）和需要交互的 Client Components 分开，避免不必要的 bundle 膨胀。

#### Q1-5: 为什么选 Tailwind CSS？有没有遇到它不好解决的场景？

**选 Tailwind 的原因**：

1. **开发效率**：一个人全栈开发，Tailwind 的 utility-first 模式让我不用在 CSS 文件和组件之间来回切换。写样式和写 JSX 在同一个地方，速度快。
2. **设计令牌集成**：Tailwind 的 `theme` 配置天然就是一个 Design Token 系统。我在 `tailwind.config.ts` 中定义了语义化的颜色（`text-label-secondary`）、间距、字号等 42 个 token，团队用的时候不需要记硬编码值。
3. **Bundle 体积**：Tailwind 通过 PurgeCSS 只打包用到的 class，最终 CSS 体积很小。相比 CSS-in-JS 方案（styled-components / Emotion），没有运行时开销。
4. **与 shadcn/ui 兼容**：shadcn/ui 本身就是基于 Tailwind 的，搭配使用零摩擦。

**不好解决的场景**：

1. **复杂动态样式**：比如根据运行时数据动态计算颜色或位置，Tailwind 的静态 class 模式就不方便。这种场景我用 `style` 属性内联，或者用 `cn()` 工具函数条件拼接 class。
2. **超长的 className**：响应式 + 状态变体叠加后，className 字符串会很长（比如 `"flex items-center gap-2 px-4 md:px-6 lg:px-8 hover:bg-primary/10 active:scale-95 disabled:opacity-50"`）。这个通过 CVA（Class Variance Authority）来管理组件变体，把复杂的 class 组合封装成语义化的 variant。
3. **第三方组件样式覆盖**：偶尔需要覆盖第三方库（比如 react-markdown 渲染的 HTML）的样式，Tailwind 的 utility class 不太方便选择器嵌套。这种情况我用 `@apply` 在全局 CSS 中处理，或者用 Tailwind 的 `prose` 插件。

#### Q1-6: shadcn/ui 的工作原理是什么？和传统组件库有什么本质区别？

**本质区别**：传统组件库（Ant Design / MUI）是 npm 包，你 `import` 用它的组件，源码在 node_modules 里，你改不了。shadcn/ui 是**代码生成器**——你运行 `npx shadcn@latest add button`，它把 Button 组件的源码直接复制到你的项目里（比如 `components/ui/button.tsx`）。

**这意味着**：

1. **完全可控**：组件源码在你的仓库里，你可以随便改。不存在"覆盖内部样式"的问题，因为样式就是你的代码。
2. **没有版本依赖**：不会出现"升级组件库导致样式变了"的问题。代码一旦复制进来，就和 shadcn 解耦了。
3. **按需引入**：只添加你用到的组件，不会引入整个库。每个组件都是独立文件。
4. **底层依赖**：shadcn/ui 的组件底层用的是 Radix UI（无样式的可访问性原语），所以键盘导航、ARIA 属性、焦点管理等无障碍特性是开箱即用的。Tailwind 只负责视觉样式。

在我的项目中，shadcn/ui 的组件被放在 `components/ui/`（禁止业务代码直接导入），我在它上面封装了一层 `components/common/qpon-ui/`，统一 API 和设计令牌后暴露给业务使用。这样业务层不需要关心底层是 shadcn 还是其他实现。

---

## Part 2: RAG 搜索架构设计

### Q2: 详细讲讲你的 AI 对话式搜索是怎么设计的

**回答（PCTCR）**：

**P - 问题**：用户想通过自然语言对话找到合适的餐厅，比如"雅加达有什么适合约会的日料"，传统的关键词搜索无法理解这种复合意图。

**C - 约束**：2400+ 篇文章数据量不大但维度复杂（城市、菜系、价位、氛围、场景等）；需要支持多轮对话（换城市、加条件、追问某家店）；面向 C 端用户，首字节延迟要控制在 600ms 以内。

**T - 思考**：设计了四阶段 RAG 架构，核心思路是"LLM 做意图理解和内容生成，检索和上下文管理交给确定性代码"：

- **Stage 1 - 意图理解**：用 Gemini Flash 的 `generateObject` 把用户自然语言转为结构化意图（城市、菜系、语义关键词），同时做意图路由分类（新搜索 / 追加筛选 / 针对某家店追问 / 闲聊）。
- **Stage 2 - Session 合并**：用代码逻辑（非 LLM）做上下文继承——硬筛选字段有新值覆盖、无则继承；语义查询根据话题是否切换决定追加还是重置。
- **Stage 3 - 混合检索**：将语义查询向量化后，在 ES 上做 kNN + BM25 + 结构化过滤的混合检索，googleRating 做 function_score 加权。
- **Stage 4 - 流式生成**：把 Top-8 文章的摘要喂给 Gemini，用 `streamText` 流式输出 Markdown + POI 标记，前端实时解析渲染为图文混排。

**C - 实现**：每篇文章在离线阶段就用 Gemini 从 Google 评论和 Instagram 帖子中提取了结构化数据（定位、招牌菜、口味、氛围、场景等），代码拼接成 200-300 字的 summary 并向量化存入 ES。这样 LLM 生成推荐时是基于真实内容，而不是"编故事"。

**R - 结果**：首字节延迟约 550ms（意图理解 150ms + ES 检索 200ms + LLM 首 token 300ms 是并行的部分），完整推荐 8 家餐厅约 3-5s。支持多轮对话，换城市、加条件、追问具体餐厅都能正确处理。

**预判追问**：

#### Q2-1: 为什么把意图理解和推荐生成分成两次 LLM 调用？合成一次不行吗？

分开是为了**可控性和可调试性**。

合成一次的话，LLM 需要同时理解意图、决定检索参数、生成推荐内容，prompt 会非常复杂，输出也难以约束。实际测试中，单次调用经常出现：提取的城市 ID 格式不对、忘记上一轮的条件、检索参数和生成内容不一致等问题。

分成两步后：

1. Stage 1 用 `generateObject` 强制输出结构化 JSON（Zod Schema 约束），确保城市 ID、菜系名都在白名单内，提取质量稳定。
2. 检索和上下文合并是确定性代码，不依赖 LLM 记忆，行为可预测、可测试。
3. Stage 4 的 LLM 只需要做一件事——基于给定的文章摘要写推荐文案，prompt 简单，输出质量高。

代价是多了一次 LLM 调用（约 150ms），但换来的可控性是值得的。

#### Q2-2: 多轮对话的上下文是怎么管理的？为什么不直接把历史对话都传给 LLM？

我用的是**客户端 Session + 服务端代码合并**的方案，而不是把历史传给 LLM。

具体来说，客户端维护一个 `SessionContext` 对象：

```typescript
interface SessionContext {
  city: string | null;          // 当前城市
  cuisine: string | null;       // 当前菜系
  isHalal: boolean | null;
  lastSemanticQuery: string;    // 上一轮语义查询
  seenArticleIds: string[];     // 已推荐过的文章ID
  seenArticlesData: ArticleSummary[]; // 已推荐文章的完整数据
}
```

每轮对话，客户端把 SessionContext 随请求发送，服务端用代码逻辑合并：

- 硬筛选（城市/菜系）：LLM 提取了新值就覆盖，没提就继承上一轮的。
- 语义查询：如果菜系变了（话题切换），重置查询和已推荐列表；否则追加新关键词。

举个例子：
```
Turn 1: "雅加达日料" → city=雅加达, cuisine=日料, query="日料 sushi"
Turn 2: "有包厢的"   → city=雅加达(继承), cuisine=日料(继承), query="日料 sushi 包厢 private room"(追加)
Turn 3: "换巴厘岛"   → city=巴厘岛(覆盖), cuisine=日料(继承), query继承
Turn 4: "推荐咖啡馆" → city=巴厘岛(继承), cuisine=咖啡馆(覆盖, 话题切换), query重置, seen清空
```

**为什么不传历史给 LLM**：
1. 历史对话会消耗大量 token，增加延迟和成本。
2. LLM 的"记忆"是概率性的，偶尔会忘记之前的城市或错误重置条件。用代码合并是确定性的，行为可预测。
3. Session 结构清晰，方便调试——出了问题直接看 Session 状态就知道哪里不对。

#### Q2-3: 意图路由分了四种类型（new_search / refinement / follow_up / chitchat），为什么要这么分？

因为不同意图的处理链路完全不同，混在一起会增加复杂度和延迟。

- **new_search**（"雅加达日料推荐"）：需要走完整的 Stage 2→3→4，做 ES 检索 + LLM 生成。
- **refinement**（"有没有更便宜的？""帮我对比前两家"）：不需要重新检索，直接用 Session 中已推荐的文章数据让 LLM 回答。省了 ES 检索的 200ms。
- **follow_up**（"这家在哪？""第二家评分多少？"）：只需要从 Session 中定位目标 POI，用已有数据回答，甚至不一定需要 LLM。
- **chitchat**（"你好""谢谢"）：直接返回预设回复，不走任何检索。

这样做的好处：refinement 和 follow_up 的响应速度明显快于 new_search（省掉了检索环节），用户体验更流畅；每条链路的 prompt 也更简单，LLM 输出质量更高。

#### Q2-4: 混合检索具体是怎么实现的？kNN 和 BM25 怎么融合打分？

在 ES 8.x 中，kNN 和 BM25 的融合是引擎自动完成的。我在一次查询中同时指定 `knn` 和 `query` 两个部分：

```
kNN: embedding 字段做 cosine 相似度 top-K 召回
BM25: summary、signatureDishes、ambience、三语标题做多字段匹配
function_score: googleRating 用 log1p 加权
```

ES 会自动把 kNN 分数和 BM25 分数归一化后合并。我给 BM25 设了 `boost: 0.3`，让向量相似度占主导（因为语义匹配更重要），BM25 作为补充处理精确关键词（比如店名"寿司政"、菜名"omakase"）。

两个搜索分支共享同一个 filter 条件（城市、菜系、是否清真），确保结果一致性。

另外还有**降级策略**：如果菜系过滤后结果不足，自动去掉菜系约束重搜补充；如果整体库存耗尽（用户已经看过大部分推荐），去掉排除限制，允许重复推荐。

#### Q2-5: 离线数据处理是怎么做的？为什么不在线实时提取？

离线处理分两步：

**Step 1 - 搜索数据提取**（Python 脚本）：对每个 POI，从 BigQuery 抓取 Google 评论（>250字，最多50条）和 Instagram 帖子（近6个月，最多20条），然后用 Gemini Flash 提取 8 个结构化字段：定位、菜系、价格、场景、招牌菜、口味、氛围、贴士。支持断点续跑和 5 并发。

**Step 2 - ES 写入**（GCP Workbench Notebook）：代码加工（菜系标准化映射、价格区间映射、设施信息提取），拼接 200-300 字的 summary，调用 multilingual-e5-large 模型生成 1024 维向量，bulk 写入 ES。

**为什么不在线提取**：
1. 一个 POI 有 50 条评论 + 20 条帖子，LLM 提取需要 3-5 秒，在线等不起。
2. 评论和帖子不会频繁变化，离线提取一次可以用很久。
3. 离线可以做质量检查和人工抽样验证，在线就没这个机会了。

#### Q2-6: 前端的流式渲染是怎么做的？Markdown 和 POI 卡片怎么混排？

整体数据流是这样的：

1. 用户发送消息后，服务端先通过 SSE 的 data-part 发送 POI 元数据（文章信息、封面图、评分等），前端收到后建立 `articleId → POI数据` 的映射表。这一步不经过 LLM，几乎即时到达（~400ms）。

2. 然后 LLM 的 streamText 开始流式输出 Markdown 文本。当 LLM 提到某家店时，会插入 `[POI:articleId]` 标记，独占一行。

3. 前端用正则实时解析文本流，拆分成三种 ContentBlock：
   - 普通文本 → 用 react-markdown 渲染
   - `[POI:123]` → 从映射表取数据，渲染为 PoiCard 组件（图片轮播、评分、场景标签、跳转详情）
   - `[SUGGEST:xxx]` → 渲染为追问建议按钮

这样用户看到的效果类似 Perplexity 或小红书 AI 搜索：文字描述和餐厅卡片自然穿插，有打字机效果，卡片可以滑动图片、点击跳转。

**为什么用 streamText + 标记而不是 streamObject**：streamObject 输出结构化 JSON，无法做图文混排；用户期望的是像朋友推荐一样的自然阅读体验，不是一个个 JSON 字段弹出来。

---

## Part 3: 高并发与缓存架构

### Q3: P95 延迟 146ms、QPS 900+ 是怎么做到的？

**回答（PCTCR）**：

**P - 问题**：平台有 120w+ 落地页面，需要支撑搜索引擎爬虫和用户的高并发访问，同时保证页面加载速度。

**C - 约束**：内容更新频率低（文章不会每天变），但页面量巨大（120w+），不可能全部预渲染；GCP 基础设施，需要控制成本。

**T - 思考**：设计了 PWA + CDN + ISR + Redis 四级缓存架构，从客户端到数据源逐层拦截请求，按照数据的更新频率和访问模式分层处理。

**C - 实现**：

1. **PWA Service Worker（客户端缓存）**：通过 Service Worker 拦截请求，对静态资源（JS/CSS/字体/图片）采用 Cache First 策略，对页面 HTML 采用 Stale-While-Revalidate 策略。用户二次访问时，大部分资源直接从本地缓存读取，不产生网络请求。在弱网或离线场景下也能展示已缓存的页面，对印尼市场的网络环境尤为重要。

2. **CDN（边缘节点缓存）**：未命中 SW 缓存的请求到达 GCP CDN 边缘节点。静态资源和 ISR 生成的 HTML 都通过 CDN 分发，就近响应。

3. **ISR（增量静态再生）**：Next.js 的 ISR 机制让页面在首次访问时生成静态 HTML 并缓存在源站，后续请求直接返回缓存，后台异步重新生成。设置合理的 revalidate 时间（文章页 24h，列表页 1h），平衡新鲜度和性能。

4. **Redis 缓存（7 天 TTL）**：服务端 API 层用 Redis 缓存 ES 查询结果和 BigQuery 数据。Redis 作为中间层，即使 ISR 缓存失效需要重新生成页面，API 查询也能命中 Redis 而不是穿透到 ES/BQ。

四级缓存的命中路径：`SW (客户端) → CDN (边缘) → ISR (源站) → Redis (API层) → ES/BQ (数据源)`。绝大多数请求在前两层就被拦截了，穿透到数据源的请求极少。

**R - 结果**：GCP 内网压测 P95 页面访问延迟 146ms，支撑 QPS 900+。实际线上因为 CDN + SW 双层缓存命中率高，大部分请求延迟更低。特别是 PWA 的 SW 缓存让回访用户几乎零延迟加载。

**预判追问**：

#### Q3-1: 146ms 是怎么测的？压测方案是什么？

在 GCP 内网用压测工具（k6）模拟并发请求，目标是文章详情页和列表页。测试场景：

- 冷启动（清空所有缓存）→ 首次访问延迟
- 热启动（缓存已就绪）→ 正常访问延迟
- 持续压力（QPS 逐步提升到 1000+）→ 观察 P50/P95/P99

146ms 的 P95 是在热启动场景下测得的——ISR 缓存已生成，Redis 已预热。冷启动首次访问会高一些（约 800ms-1.2s），因为需要走完 ES 查询 + 页面渲染。

#### Q3-2: 缓存一致性怎么保证？文章内容更新了怎么办？

内容更新频率很低（编辑修改文章），所以用的是**最终一致性**策略：

1. **SW 层**：采用 Stale-While-Revalidate 策略，用户先看到缓存版本，后台自动请求新版本更新本地缓存。下次访问就是新内容。
2. **CDN 层**：通过 Cache-Control 的 s-maxage + stale-while-revalidate 控制边缘缓存时效。
3. **ISR 层**：revalidate 保证页面最终会更新（最长 24h）。如果需要即时更新，可以调用 Next.js 的 `revalidatePath` / `revalidateTag` API 手动触发重新生成。
4. **Redis 层**：7 天 TTL，正常情况下 ISR 重新生成时会拿到新数据写入 Redis。

整体是一个"逐层过期、逐层刷新"的最终一致性模型。对于这个业务场景，分钟级别的延迟完全可接受——用户不会因为一篇文章的小修改而有感知。

#### Q3-3: 某一层缓存挂了会怎样？

每层都设计了降级策略，任何一层失效不影响服务可用性：

- **SW 挂了 / 用户首次访问**：请求直接到 CDN，正常响应。
- **CDN 未命中**：回源到 ISR 静态缓存或触发页面生成。
- **Redis 挂了**：请求穿透到 ES/BQ，延迟从 ~50ms 上升到 ~200-500ms。数据量只有 2400+ 条，ES 和 BQ 能承受。

我在代码中用 try-catch 包裹了所有 Redis 操作，读取失败时自动降级到直接查询，不会抛异常影响用户。四级缓存的设计本身就是为了**纵深防御**——不依赖任何单一层的可用性。

#### Q3-4: 缓存穿透、击穿、雪崩怎么防？

这三个是多级缓存的经典问题，我分别有对应的策略：

**缓存穿透**（查询不存在的数据，每次都穿透到数据源）：

- **场景**：用户或爬虫请求一个不存在的文章 ID，Redis 没有、ISR 没有，每次都打到 ES/BQ。
- **防护**：空值缓存——查询不到的 key 缓存一个空结果，设短 TTL（5 分钟），避免反复穿透。

```typescript
const data = await redis.get(key);
if (data === 'NULL') return null; // 命中空值缓存，直接返回
if (data) return JSON.parse(data);

const result = await queryES(id);
if (!result) {
  await redis.set(key, 'NULL', 'EX', 300); // 缓存空值 5 分钟
  return null;
}
await redis.set(key, JSON.stringify(result), 'EX', ttl);
return result;
```

- **进阶**：数据量大时可以加布隆过滤器（Bloom Filter）前置判断 ID 是否存在，当前 2400 条数据量不需要。

**缓存击穿**（热点 key 过期瞬间，大量并发请求同时穿透）：

- **场景**：首页缓存过期的瞬间，大量请求同时打到 ES/BQ 重建缓存。
- **防护**：互斥锁（Mutex Lock）——只允许一个请求回源，其他请求等待。

```typescript
const data = await redis.get(key);
if (data) return JSON.parse(data);

// 尝试获取锁
const lock = await redis.set(`lock:${key}`, '1', 'NX', 'EX', 10);
if (lock) {
  // 拿到锁，回源查询并写入缓存
  const result = await queryES(id);
  await redis.set(key, JSON.stringify(result), 'EX', ttl);
  await redis.del(`lock:${key}`);
  return result;
} else {
  // 没拿到锁，短暂等待后重试
  await sleep(100);
  return redis.get(key).then(d => JSON.parse(d));
}
```

**缓存雪崩**（大量 key 同时过期，请求集中穿透）：

- **场景**：如果所有文章缓存的 TTL 都是 3600 秒，部署后同一时间写入的缓存会同时过期。
- **防护**：TTL 加随机抖动，打散过期时间。

```typescript
const ttl = 3600 + Math.floor(Math.random() * 300); // 3600-3900s 随机
await redis.set(key, data, 'EX', ttl);
```

**当前项目的实际情况**：

- 空值缓存：已实现，防止无效 ID 穿透
- TTL 抖动：已实现，防雪崩
- 互斥锁：未实现——因为 ISR 本身就是 stale-while-revalidate 策略（过期后仍返回旧缓存，后台异步刷新），天然避免了击穿问题
- 布隆过滤器：未实现——数据量 2400 条，穿透风险低

面试时要诚实说哪些做了哪些没做，以及**为什么不需要做**（数据规模、业务场景决定的）。

#### Q3-5: 多 Pod 多实例部署下，缓存怎么保证一致？

项目部署架构是 **GKE 多 Pod 水平扩展 + 每个 Pod 内 PM2 管理多 Node.js 实例**。这意味着同一时刻可能有十几个进程同时处理请求。

**为什么这不会导致缓存问题**：

1. **Redis 是共享的中心化缓存**：所有 Pod、所有实例连的是同一个 Redis 实例。不存在"Pod A 写了缓存，Pod B 读不到"的问题。互斥锁（`SET NX`）也天然跨进程生效。

2. **ISR 缓存是文件级的**：Next.js 的 ISR 缓存存在 Pod 本地文件系统。多 Pod 之间的 ISR 缓存是**各自独立**的——Pod A 生成了某个页面的缓存，Pod B 可能还没有。这会导致冷启动时少量请求稍慢（需要各自生成一次），但不会出错。

3. **CDN 在最前面兜底**：大部分请求在 CDN 层就被拦截了，实际穿透到 Pod 的请求比例很低。

**PM2 的角色**：

```
GKE Pod (容器)
└── PM2 cluster mode
    ├── Node.js worker 0
    ├── Node.js worker 1
    └── Node.js worker 2  (根据 CPU 核数自动分配)
```

PM2 的 cluster 模式利用 Node.js 的 `cluster` 模块 fork 多个 worker 进程，充分利用多核 CPU。每个 worker 是独立进程，但共享同一个端口（PM2 内部做负载均衡）。因为缓存都在 Redis（进程外），不存在进程间缓存不一致的问题。

**如果流量涨 10 倍怎么扩展**：

- **水平扩展**：GKE HPA（Horizontal Pod Autoscaler）根据 CPU/内存自动增加 Pod 数量
- **Redis 不是瓶颈**：2400 条数据的读写量，单个 Redis 实例能轻松承受
- **ES 不是瓶颈**：单分片 2400 条文档，查询延迟 < 50ms
- **真正的瓶颈在 LLM 调用**：Gemini API 有 QPM 限制，需要做请求排队或模型降级

---

## Part 4: 程序化 SEO

### Q4: 120w+ 多语言落地页是怎么实现的？

**回答（PCTCR）**：

**P - 问题**：需要让搜索引擎收录平台内容，获取自然流量。2400+ 篇文章 × 3 种语言 × 多种维度组合（城市、菜系、场景等），产生大量可索引的页面。

**C - 约束**：页面量巨大（120w+），不可能在构建时全部预渲染；需要三种语言各自独立的 URL；Google 对多语言站点有 hreflang 规范要求。

**T - 思考**：基于 Next.js 的动态路由 + ISR 按需生成，配合自动化的 SEO 标签生成。

**C - 实现**：

1. **动态路由模板**：用 `[locale]/[category]/[city]/[slug]` 等路由模板覆盖所有维度组合。页面首次被访问或爬虫抓取时触发 ISR 生成，后续缓存。

2. **Sitemap 自动生成**：脚本从 BigQuery 读取所有文章和维度组合，批量生成 sitemap XML，包含所有三种语言的 URL。按类别分片避免单个 sitemap 过大。

3. **结构化数据**：每个页面自动注入 JSON-LD 结构化数据（Restaurant、Article 等 Schema），帮助搜索引擎理解页面内容。

4. **Hreflang 标签**：每个页面自动生成 `<link rel="alternate" hreflang="..." />` 标签，指向同一内容的其他两种语言版本，告诉 Google 这三个 URL 是同一内容的不同语言。

5. **Canonical URL**：避免重复内容问题，每个页面指定规范链接。

**R - 结果**：120w+ 页面可被搜索引擎索引，三种语言各自有独立的搜索结果展示。ISR 保证了不需要一次性构建所有页面，按需生成控制了构建时间和资源消耗。

**预判追问**：

#### Q4-1: 120w 这个数字是怎么算出来的？

文章 2400+ × 语言 3 + 维度组合页面（城市×菜系、城市×场景、热门排行等聚合页）。主要量在维度组合页。比如 4 个城市 × 20 个菜系 × 10 个场景 × 3 语言，再加上各种排列组合和分页，加起来就到了百万级。

#### Q4-2: ISR 按需生成不会导致首次访问很慢吗？

会。首次访问（冷启动）需要走完整的数据查询 + 页面渲染，约 800ms-1.2s。但：

1. 搜索引擎爬虫首次抓取后，页面就被缓存了，后续用户访问直接命中缓存。
2. 高频页面（热门城市 + 热门菜系）可以在部署后用脚本预热，主动触发生成。
3. 长尾页面（冷门组合）即使首次慢一点也可以接受，因为访问量本身就低。

#### Q4-3: 多语言路由是怎么组织的？Next.js 怎么处理国际化？

用 next-intl 库 + Next.js App Router 的 `[locale]` 动态段：

- URL 结构：`/id-id/articles/xxx`（印尼语）、`/en-id/articles/xxx`（英语）、`/zh-id/articles/xxx`（中文）
- Locale 格式是 `语言-地区`：`id-id`、`en-id`、`zh-id`
- 翻译文件维护在 `messages/id.json`、`messages/en.json`、`messages/zh.json`
- Server Components 用 `getTranslations()`，Client Components 用 `useTranslations()`
- 导航组件（Link、useRouter）从 `@/i18n/routing` 导入，自动处理 locale 前缀

---

## Part 5: 设计系统与组件库

### Q5: 你提到参考了 Airbnb 等平台建了设计系统，具体做了什么？

**回答（PCTCR）**：

**P - 问题**：项目没有专职设计师，但需要保证三端（PC/Mobile/Tablet）的 UI 一致性和开发效率。

**C - 约束**：一个人开发，不可能从零造轮子；需要快速产出页面，同时保证设计质量不粗糙。

**T - 思考**：基于 shadcn/ui 做二次封装，建立企业级组件库 + Design Tokens 体系，在保证开发速度的同时统一视觉语言。

**C - 实现**：

1. **组件库（qpon-ui）**：基于 shadcn/ui 封装了 30+ 组件，统一导出入口。业务代码只能从 `@/components/common` 导入，禁止直接使用 shadcn 原始组件。覆盖排版（Heading/Text）、表单（Input/Select/SearchBar）、反馈（Dialog/Toast/BottomSheet）、展示（Badge/Carousel/ImagePreview）等类别。

2. **Design Tokens**：定义了 42 个设计令牌，涵盖颜色、间距、字号、圆角、阴影、z-index 等。用 Tailwind CSS 的语义化 class（如 `text-label-secondary`、`bg-container-8`）替代硬编码值。

3. **响应式策略**：移动优先三段式断点（mobile → md:tablet → lg:desktop），组件内置响应式行为（比如 Dialog 在移动端自动变为 BottomSheet）。

4. **文档**：输出了 13 篇设计规范文档（设计哲学、排版、颜色、间距、交互、动画等），确保后续接手的人能理解设计决策。

**R - 结果**：一个人开发的情况下，保持了全站 UI 的一致性；新页面开发效率高，大部分页面用现有组件拼装即可；后续有人接手时，有完整的文档和约束（ESLint 规则禁止直接导入 shadcn）。

**预判追问**：

#### Q5-1: 为什么选 shadcn/ui 做底层而不是 Ant Design 或 Material UI？

三个原因：

1. **可定制性**：shadcn/ui 是"复制代码到项目"的模式，不是 npm 包。我可以完全控制组件源码，做深度定制。Ant Design 和 MUI 是黑盒 npm 包，改样式要覆盖大量内部 class，痛苦。

2. **Bundle 体积**：Ant Design 的 tree-shaking 做得不够好，而且自带 CSS-in-JS 运行时。我的项目用 Tailwind CSS，shadcn/ui 天然兼容，不引入额外运行时。

3. **设计风格**：项目面向印尼 C 端用户，需要偏 Airbnb 那种简约现代风，而不是 Ant Design 的企业后台风格。shadcn/ui 的默认风格更接近我要的方向，定制成本最低。

#### Q5-2: 42 个 Design Token 是怎么确定的？

参考了几个来源然后根据项目实际需要裁剪：

1. 颜色系统：参考了 Airbnb 的语义化颜色命名（primary/secondary/error/warning），加上印尼市场的品牌色。
2. 间距系统：用 4px 基础单位的倍数系统（4/8/12/16/24/32/48），覆盖所有常见间距场景。
3. 字号系统：根据三种语言的排版特性（中文需要更大的行高）调整。

确定的原则是"够用就好"——不追求 token 数量多，而是确保每个 token 都有明确的语义和使用场景。如果发现有两个 token 的使用场景总是模糊，就合并。

---

## Part 6: 技术深度追问

> 这部分是面试官可能从项目细节延伸出去的底层原理问题。

### Q6-1: ISR 的底层机制是什么？和 SSG、SSR 的区别是什么？

- **SSG（Static Site Generation）**：构建时生成所有页面的静态 HTML。优点是响应快（直接返回文件），缺点是构建时间随页面数增长，内容更新需要重新构建。
- **SSR（Server Side Rendering）**：每次请求时在服务端渲染 HTML。优点是内容实时，缺点是每个请求都要消耗服务端资源。
- **ISR（Incremental Static Regeneration）**：结合两者。首次请求时 SSR 生成页面并缓存为静态文件，后续请求直接返回缓存。当缓存超过 `revalidate` 时间后，下一个请求仍返回旧缓存（不让用户等），但后台触发异步重新生成，生成完成后替换旧缓存。

这就是所谓的 **stale-while-revalidate** 策略。用户永远不会等待页面生成，最差情况也只是看到稍旧的内容。

### Q6-2: Embedding 向量搜索的原理？cosine 相似度和 L2 距离的区别？

Embedding 是将文本映射到高维向量空间，语义相似的文本在向量空间中距离更近。

- **Cosine 相似度**：计算两个向量夹角的余弦值，范围 [-1, 1]。只关心方向不关心长度。适合文本搜索——一段长文本和一段短文本只要语义相似，cosine 就会高。
- **L2（欧氏距离）**：计算两点间的直线距离。受向量长度影响——如果一个向量的模比较大，即使方向相似，L2 距离也可能很大。

我选 cosine 是因为搜索场景下，用户输入（短查询）和文档（长 summary）的向量模长差异大，cosine 对这种长度差异不敏感。

### Q6-3: React Server Components 和传统 SSR 的区别？

传统 SSR（getServerSideProps 时代）：服务端渲染完整的组件树为 HTML 字符串 → 发送到客户端 → 客户端重新执行所有 JS 做 hydration（事件绑定等）。所有组件的 JS 代码都要下发到客户端。

Server Components：组件在服务端渲染后，**不会下发 JS 代码到客户端**。只有标记了 `'use client'` 的组件才会被打包到客户端 bundle。好处：

1. 减少客户端 JS 体积——数据获取、格式化等逻辑留在服务端。
2. 可以直接在组件内访问数据库、文件系统等服务端资源。
3. 客户端 hydration 只需要处理 Client Components，更快。

在我的项目中，大部分页面是 Server Components（数据获取 + 纯展示），只有需要交互的部分（搜索输入框、对话面板、图片轮播）用 Client Components。

### Q6-4: streamText 流式响应的底层是什么协议？

基于 **Server-Sent Events（SSE）**。HTTP 响应头设置 `Content-Type: text/event-stream`，服务端保持连接不关闭，持续推送 `data: xxx\n\n` 格式的事件。

和 WebSocket 的区别：
- SSE 是单向的（服务端 → 客户端），WebSocket 是双向的。
- SSE 基于 HTTP，不需要额外的协议升级，兼容性更好，CDN/代理不容易出问题。
- 对于 AI 生成这种场景（服务端持续推送文本，客户端只需要接收），SSE 完全够用，没必要用 WebSocket。

在 AI SDK 中，`streamText` 返回的流会自动编码为 SSE 格式，前端的 `useChat` hook 自动解析。

### Q6-5: 你用 Zustand 做状态管理，和 Redux / Context API 相比优劣是什么？

在这个项目中选 Zustand 的理由：

- **vs Redux**：这个项目的客户端状态很简单（文章推荐缓存、地理位置信息），Redux 的 action/reducer/middleware 套路太重了。Zustand 一个 `create()` 函数就搞定，没有 boilerplate。
- **vs Context API**：Context 的问题是任何 state 变化会导致所有 consumer 重新渲染。Zustand 支持 selector，组件只订阅自己关心的字段，粒度更细。

Zustand 的局限：没有 Redux DevTools 那么强大的调试工具（虽然有中间件支持），在复杂业务逻辑（大量异步流、中间件链）的场景下不如 Redux Toolkit 规范。但对这个项目来说完全够用。

### Q6-6: 为什么选 Gemini 而不是 GPT-4 或 Claude？

选型时做了对比：

| 维度 | Gemini 2.0 Flash | GPT-4 | Claude 3 |
|------|-------------------|-------|----------|
| 成本 | ~$3.5/M tokens | ~$30/M tokens | ~$15/M tokens |
| 延迟 | 首字 ~150ms | 首字 ~500ms | 首字 ~400ms |
| 上下文 | 1M tokens | 128K tokens | 200K tokens |
| GCP 集成 | 原生 Vertex AI | 需额外配置 | 需额外配置 |

选 Gemini 三个原因：1）成本是 GPT-4 的 1/10，高频搜索场景成本差异巨大；2）部署在 GKE，Vertex AI 同机房调用延迟更低；3）预留了模型切换能力（环境变量配置），核心 Prompt 通用，切换成本低。

单次搜索成本约 $0.01（参数提取 $0.0009 + 推荐生成 $0.009）。日均 1000 次搜索，月成本约 $210（含 30% 缓存命中优化）。

### Q6-7: Embedding 模型为什么选 e5-large？

| 模型 | 维度 | MTEB 排名 | 成本 | 多语言 |
|------|------|-----------|------|--------|
| e5-large-v2 | 1024 | Top 10 | 免费（自托管） | 支持 |
| OpenAI ada-002 | 1536 | Top 5 | $0.1/M tokens | 支持 |
| Cohere embed-v3 | 1024 | Top 3 | $0.1/M tokens | 支持 |

选 e5-large 因为：1）自托管免费，2400+ 篇文章 + 实时查询成本差异大；2）三语支持好；3）测试集上召回率和 ada-002 差距 < 5%；4）自托管在 GKE 同集群延迟 ~20ms，API 调用 ~200ms。

### Q6-8: 如何防止 LLM 幻觉？

三层防护：

1. **Prompt 约束**：明确要求"只推荐 context 中提供的文章，不要编造"
2. **RAG 架构**：先从 ES 检索真实存在的餐厅，再把检索结果作为 context 传给 LLM。LLM 的"知识边界"被限制在检索结果内
3. **后处理校验**（可选）：检查推荐的 articleId 是否在检索结果中，检测到幻觉可过滤或重试

实际效果：抽查 100 条推荐，幻觉率 < 2%，主要是店名小变体。

### Q6-9: LLM 参数提取失败怎么办？

三层降级策略：

1. **硬维度降级**：结果为 0 时，自动去除 cuisine（菜系）等灵活维度，保留 city 核心约束重试
2. **Refinement 模式**：多轮对话追问时，从已推荐的 seenArticlesData 中筛选，不调用 ES
3. **LLM 兜底**：真的没有合适结果，Gemini 生成调整建议（"试试放宽价格范围"），保证不出现空白页

### Q6-10: 多轮对话 Token 会超限吗？

当前没有做截断，这是已知的技术债务。风险分析：Query rewrite prompt ~500 tokens + 每轮用户消息 ~50 tokens，20 轮约 1500 tokens，仍在安全范围。

缓解措施：只传用户消息不传 assistant 回复；Generation prompt 只传搜索结果不传历史。

未来优化三个方案：
1. 滑动窗口：只保留最近 5 轮
2. 摘要压缩：超过 10 轮时用 LLM 压缩旧历史
3. Token 计数截断：逆序遍历，累计 token 超阈值时截断

---

## Part 7: 反思与改进

### Q7: 如果让你重新做这个项目，有什么会改变？

1. **数据层**：目前 summary 是中文拼接的，对印尼语和英语用户的语义搜索效果会打折扣。如果重来，我会考虑三语各生成一份 summary 和对应的 embedding，按用户语言选择检索。代价是存储量 ×3 和离线处理时间 ×3，但搜索质量会更好。

2. **前端架构**：对话式搜索的文本流解析（正则切割 Markdown + POI 标记）实现上比较脆弱，LLM 如果输出格式偶尔不规范（比如标记没独占一行），就会渲染异常。如果重来，我会考虑更鲁棒的 parser，或者用 streamObject 输出结构化数据 + 单独的 Markdown 文本字段。

3. **测试覆盖**：MVP 阶段为了速度牺牲了测试。核心链路（意图理解 → 检索 → 生成）应该有集成测试，至少用 mock 数据验证各种意图类型的处理是否正确。
