# Next.js 核心知识 - 面试准备

> **适用场景**: 高级前端 / 全栈工程师面试
> **关联项目**: AI内容平台（Next.js 16 + App Router）
> **重要程度**: ⭐⭐⭐⭐⭐ 简历核心技术栈

---

## 📋 快速索引

| 主题 | 重要度 | 你的项目关联 |
|------|--------|--------------|
| App Router vs Pages Router | ⭐⭐⭐⭐⭐ | AI项目用App Router |
| ISR / SSR / SSG | ⭐⭐⭐⭐⭐ | ISR是你的核心优化点 |
| Server Components | ⭐⭐⭐⭐⭐ | 理解RSC才能讲清架构 |
| 缓存机制 | ⭐⭐⭐⭐ | revalidate策略 |
| generateStaticParams | ⭐⭐⭐⭐ | 程序化SEO的核心 |
| Streaming + Suspense | ⭐⭐⭐ | AI流式响应相关 |
| Middleware | ⭐⭐⭐ | 了解即可 |

---

## 🎯 Q1: App Router vs Pages Router 有什么区别？为什么选择 App Router？

### 核心区别

| 特性 | Pages Router | App Router |
|------|--------------|------------|
| 路由定义 | `pages/` 目录，文件即路由 | `app/` 目录，文件夹即路由 |
| 默认组件类型 | Client Components | **Server Components** |
| 数据获取 | `getServerSideProps` / `getStaticProps` | 直接 `async/await` fetch |
| 布局 | 需要 `_app.js` 包裹 | 原生 `layout.js` 嵌套布局 |
| Loading状态 | 手动实现 | 原生 `loading.js` |
| 错误处理 | 手动实现 | 原生 `error.js` |
| 流式渲染 | 不支持 | 原生支持 Streaming |

### 标准回答

> "我选择 App Router 主要有三个原因：
>
> **第一，Server Components 默认支持**。AI内容平台有大量静态内容（文章详情、分类列表），用 RSC 可以在服务端渲染，减少客户端 JS 体积，首屏更快。
>
> **第二，嵌套布局更优雅**。我的项目有多层布局（根布局 → 语言布局 → 页面布局），App Router 的 `layout.js` 天然支持，不需要像 Pages Router 那样手动在 `_app.js` 里判断。
>
> **第三，数据获取更直观**。直接在组件里 `async/await` 获取数据，配合 `revalidate` 实现 ISR，比 `getStaticProps` 返回 props 的方式更符合直觉。"

### 追问：迁移成本大吗？

> "App Router 和 Pages Router 可以共存，所以可以渐进式迁移。但有几个坑：
> 1. `useRouter` 要从 `next/navigation` 导入，不是 `next/router`
> 2. 很多第三方库还不支持 RSC，需要加 `'use client'`
> 3. 数据获取方式完全不同，需要重构"

---

## 🎯 Q2: ISR / SSR / SSG 分别是什么？你的项目怎么选型的？

### 概念对比

| 渲染方式 | 全称 | 渲染时机 | 适用场景 |
|----------|------|----------|----------|
| **SSG** | Static Site Generation | 构建时 | 纯静态内容，博客、文档 |
| **SSR** | Server-Side Rendering | 每次请求 | 实时数据，用户个性化内容 |
| **ISR** | Incremental Static Regeneration | 构建时 + 按需更新 | 内容较稳定但需要更新 |

### 标准回答

> "我的 AI 内容平台采用 **ISR 为主 + SSR 为辅** 的混合策略：
>
> **ISR 用于内容页面**（首页、分类页、文章详情页）：
> - 文章内容更新频率低（每天几篇），不需要实时
> - 设置 `revalidate: 3600`（1小时），平衡新鲜度和性能
> - 首次访问后缓存，后续访问直接返回静态页面，P95 延迟 146ms
>
> **SSR 用于 AI 搜索接口**：
> - 用户输入实时变化，无法预测
> - 需要调用 LLM，必须服务端处理
> - 用流式响应（Streaming）优化体验
>
> **为什么不用纯 SSG？**
> - 我有 1200+ 篇文章 × 3 种语言 = 3600+ 页面
> - 全量构建太慢，而且文章会更新
> - ISR 的按需生成更适合这种规模"

### 代码示例

```typescript
// app/[lang]/[city]/[slug]/page.tsx
export const revalidate = 3600; // ISR: 1小时重新验证

export async function generateStaticParams() {
  // 构建时预生成热门页面
  const hotArticles = await getHotArticles(100);
  return hotArticles.map(article => ({
    lang: article.lang,
    city: article.city,
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);
  return <ArticleDetail article={article} />;
}
```

### 追问：ISR 的缓存失效机制？

> "Next.js ISR 有两种失效方式：
>
> **1. 时间失效（revalidate）**
> - 设置 `revalidate: 3600`，1小时后下一次请求触发后台重新生成
> - 用户看到的还是旧页面（stale-while-revalidate）
>
> **2. 按需失效（On-Demand Revalidation）**
> - 调用 `revalidatePath('/article/xxx')` 或 `revalidateTag('articles')`
> - 我在后台管理系统编辑文章后，会调用这个 API 立即刷新
>
> 我的项目用的是**组合策略**：时间失效兜底 + 手动失效保证关键更新及时生效。"

---

## 🎯 Q3: Server Components vs Client Components 怎么理解？

### 核心区别

| 特性 | Server Components | Client Components |
|------|-------------------|-------------------|
| 渲染位置 | 服务端 | 客户端（浏览器） |
| JS Bundle | **不包含** | 包含在 bundle 中 |
| 可以使用 | 数据库、文件系统、敏感API | useState、useEffect、浏览器API |
| 不能使用 | Hooks、浏览器事件 | 直接访问服务端资源 |
| 标记方式 | 默认（App Router） | `'use client'` |

### 标准回答

> "Server Components 是 React 18 的重大更新，核心价值是**减少客户端 JS 体积**。
>
> 在我的项目里：
> - **文章详情页是 Server Component**：直接查数据库渲染 HTML，0 KB JS
> - **AI 搜索输入框是 Client Component**：需要 useState 管理输入状态
> - **地图组件是 Client Component**：Mapbox GL 必须在浏览器运行
>
> 我的原则是：**能用 Server Component 就用 Server Component**，只有需要交互的组件才标记 `'use client'`。
>
> 这样做的效果：首页 JS bundle 从 180KB 降到 90KB，FCP 提升明显。"

### 追问：Server Component 怎么和 Client Component 配合？

> "有个重要概念叫 **Composition Pattern**：
>
> ```tsx
> // ❌ 错误：Server Component 不能直接用在 Client Component 内部
> 'use client'
> function ClientWrapper() {
>   return <ServerComponent />  // 报错！
> }
>
> // ✅ 正确：通过 children 传递
> 'use client'
> function ClientWrapper({ children }) {
>   const [open, setOpen] = useState(false);
>   return <div onClick={() => setOpen(!open)}>{children}</div>
> }
>
> // 在 Server Component 中组合
> function Page() {
>   return (
>     <ClientWrapper>
>       <ServerComponent />  {/* 作为 children 传入 */}
>     </ClientWrapper>
>   )
> }
> ```
>
> 这样 ServerComponent 仍然在服务端渲染，只有 ClientWrapper 的交互逻辑在客户端。"

---

## 🎯 Q4: Next.js 的缓存机制有哪些？

### 四层缓存

| 缓存层 | 位置 | 作用 | 失效方式 |
|--------|------|------|----------|
| **Request Memoization** | 服务端（单次渲染） | 同一渲染周期内去重 fetch | 渲染结束自动清除 |
| **Data Cache** | 服务端（跨请求） | 缓存 fetch 结果 | `revalidate` / `revalidateTag` |
| **Full Route Cache** | 服务端 | 缓存整个 HTML + RSC Payload | `revalidatePath` |
| **Router Cache** | 客户端 | 缓存访问过的路由 | 刷新 / 30秒（动态）/ 5分钟（静态） |

### 标准回答

> "Next.js 13+ 的缓存机制比较复杂，我在项目中主要用到三层：
>
> **1. Data Cache（数据缓存）**
> ```typescript
> // 缓存1小时
> const data = await fetch(url, { next: { revalidate: 3600 } });
>
> // 永不缓存（实时数据）
> const data = await fetch(url, { cache: 'no-store' });
> ```
>
> **2. Full Route Cache（页面缓存）**
> - 就是 ISR，`export const revalidate = 3600`
> - 整个页面 HTML 缓存在服务端
>
> **3. 我额外加了 Redis 缓存**
> - Next.js 自带缓存是单机的，多实例部署会不一致
> - 我在 fetch 层加了 Redis，TTL 7天，保证 GKE 多 Pod 一致
>
> **缓存失效策略**：
> - 时间失效：`revalidate` 兜底
> - 手动失效：后台编辑后调用 `revalidatePath`
> - Redis 失效：TTL + 手动 Purge API"

### 追问：缓存导致数据不一致怎么办？

> "这是个好问题。我遇到过文章更新后用户看到旧内容的情况。
>
> 解决方案是**多层失效联动**：
> 1. 编辑文章后，先更新数据库
> 2. 调用 `revalidatePath('/article/xxx')` 失效 Next.js 缓存
> 3. 调用 Redis DEL 失效 Redis 缓存
> 4. 可选：调用 CDN Purge API 失效边缘缓存
>
> 我封装了一个 `invalidateArticle(slug)` 函数，一次调用搞定所有层级。"

---

## 🎯 Q5: generateStaticParams 怎么用？程序化 SEO 怎么做的？

### 标准回答

> "我的项目有 1200 篇文章 × 3 种语言 = 3600+ 页面，手动创建不现实。
>
> **generateStaticParams** 可以在构建时批量生成静态路由：
>
> ```typescript
> // app/[lang]/[city]/[slug]/page.tsx
>
> export async function generateStaticParams() {
>   const articles = await getAllArticles();
>
>   return articles.flatMap(article => [
>     { lang: 'zh-id', city: article.city, slug: article.slug },
>     { lang: 'en', city: article.city, slug: article.slug },
>     { lang: 'id', city: article.city, slug: article.slug },
>   ]);
> }
> ```
>
> **但我没有全量预生成**，因为：
> - 3600 个页面构建太慢（预估 30 分钟）
> - 长尾页面访问量低，预生成浪费资源
>
> 我的策略是：
> - `generateStaticParams` 只返回 Top 100 热门文章
> - 其他页面靠 ISR 首次访问时按需生成
> - `dynamicParams = true`（默认），允许未预生成的路由"

### SEO 相关配置

> "除了页面生成，SEO 还需要：
>
> **1. 动态 Sitemap**
> ```typescript
> // app/sitemap.ts
> export default async function sitemap() {
>   const articles = await getAllArticles();
>   return articles.map(article => ({
>     url: `https://qpon.com/${article.lang}/${article.slug}`,
>     lastModified: article.updatedAt,
>     changeFrequency: 'weekly',
>     priority: 0.8,
>   }));
> }
> ```
>
> **2. 结构化数据（JSON-LD）**
> ```typescript
> <script type="application/ld+json">
>   {JSON.stringify({
>     '@context': 'https://schema.org',
>     '@type': 'Restaurant',
>     name: article.title,
>     // ...
>   })}
> </script>
> ```
>
> **3. Hreflang 标签**（多语言）
> ```typescript
> export function generateMetadata({ params }) {
>   return {
>     alternates: {
>       languages: {
>         'zh-ID': `/zh-id/${params.slug}`,
>         'en': `/en/${params.slug}`,
>         'id': `/id/${params.slug}`,
>       },
>     },
>   };
> }
> ```
>
> 效果：Lighthouse SEO 评分 92 分，上线 1 个月纯 SEO 流量 1200+ 用户。"

---

## 🎯 Q6: Streaming 和 Suspense 在 Next.js 中怎么用？

### 标准回答

> "Streaming 是 Next.js 13+ 的重要特性，核心是**分块传输 HTML**，让用户更快看到内容。
>
> 在我的 AI 搜索场景特别有用：
>
> ```typescript
> // app/search/page.tsx
> export default function SearchPage() {
>   return (
>     <div>
>       <SearchInput />  {/* 立即显示 */}
>
>       <Suspense fallback={<Skeleton />}>
>         <SearchResults />  {/* 数据ready后显示 */}
>       </Suspense>
>     </div>
>   );
> }
>
> // SearchResults 是 async Server Component
> async function SearchResults() {
>   const results = await searchArticles();  // 可能需要 2-3 秒
>   return <ResultList results={results} />;
> }
> ```
>
> **效果**：
> - 用户立即看到搜索框和 Skeleton
> - 2-3 秒后搜索结果 streaming 进来
> - 比传统 SSR「白屏等待」体验好很多
>
> **我的 AI 流式响应也是类似原理**：
> - 用 `ReadableStream` 把 LLM 输出实时推送给前端
> - 前端边接收边渲染，首字 500ms 就能看到"

### 追问：loading.js 和 Suspense 什么区别？

> "功能类似，但粒度不同：
>
> - `loading.js`：**页面级别**，整个路由切换时显示
> - `Suspense`：**组件级别**，更细粒度的 loading 状态
>
> 我通常两个都用：`loading.js` 处理路由切换，`Suspense` 处理页面内的异步组件。"

---

## 🎯 Q7: Middleware 有什么用？你用过吗？

### 标准回答

> "Middleware 在请求到达页面之前执行，适合做：
> - 认证检查
> - 重定向/重写
> - A/B 测试
> - 国际化路由
>
> 我的项目用 Middleware 做**语言检测和重定向**：
>
> ```typescript
> // middleware.ts
> import { NextResponse } from 'next/server';
>
> export function middleware(request) {
>   const { pathname } = request.nextUrl;
>
>   // 已经有语言前缀，跳过
>   if (pathname.startsWith('/zh-id') || pathname.startsWith('/en')) {
>     return NextResponse.next();
>   }
>
>   // 根据 Accept-Language 检测语言
>   const lang = detectLanguage(request.headers.get('accept-language'));
>
>   // 重定向到对应语言版本
>   return NextResponse.redirect(new URL(`/${lang}${pathname}`, request.url));
> }
>
> export const config = {
>   matcher: ['/((?!api|_next/static|favicon.ico).*)'],
> };
> ```
>
> **注意事项**：
> - Middleware 运行在 Edge Runtime，不能用 Node.js API
> - 要小心性能，每个请求都会执行"

---

## 🎯 Q8: Next.js 性能优化你做了哪些？

### 标准回答

> "结合我的项目，主要做了这几块：
>
> **1. 渲染策略优化**
> - ISR + Redis 多级缓存，P95 延迟 146ms
> - Server Components 减少 JS bundle（180KB → 90KB）
>
> **2. 图片优化**
> - 使用 `next/image` 自动 WebP 转换 + 响应式尺寸
> - 配置 `placeholder='blur'` 避免布局抖动
>
> **3. 字体优化**
> - 使用 `next/font` 自托管字体，避免 Google Fonts 的 FOUT
> - `display: swap` 保证文字先显示
>
> **4. 代码分割**
> - `dynamic()` 懒加载大组件（地图、富文本编辑器）
> - `ssr: false` 跳过服务端不需要的组件
>
> **5. 预加载**
> - `<Link prefetch>` 预加载可能访问的页面
> - `preconnect` 提前建立第三方域名连接
>
> **量化结果**：
> - Lighthouse 性能分 77（移动端 3G 模拟）
> - LCP 1.8s，FCP 0.9s，CLS 0.02"

---

## 💡 常见追问

### Q: Next.js 和 Remix/Nuxt 对比？

> "都是全栈框架，核心差异：
> - **Next.js**：React 官方推荐，生态最成熟，Vercel 支持
> - **Remix**：更激进的 Web 标准路线，嵌套路由更强
> - **Nuxt**：Vue 生态，和 Next 定位类似
>
> 我选 Next.js 因为 React 生态更熟悉，而且 Vercel 的部署体验很好（虽然我最后用的 GKE）。"

### Q: Next.js 有什么坑？

> "踩过几个：
> 1. **缓存太激进**：Data Cache 默认永久缓存，开发时经常以为没更新
> 2. **RSC 生态不成熟**：很多库要加 `'use client'`，比如状态管理库
> 3. **App Router 文档不全**：很多高级用法要看源码
> 4. **构建慢**：页面多了 `generateStaticParams` 很慢，需要用 `dynamicParams` 优化"

---

## 📝 面试模拟题

1. "你的项目为什么选 Next.js 而不是 Vite + React？"
2. "解释一下 ISR 的工作原理"
3. "Server Components 和传统 SSR 有什么区别？"
4. "如果让你设计一个多语言网站，怎么处理路由？"
5. "Next.js 的缓存有哪些层级？怎么调试缓存问题？"

---

**文档生成时间**: 2026-03-06
