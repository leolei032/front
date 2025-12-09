# CSS核心知识深度解析

## 1. CSS盒模型

### 两种盒模型

```css
/* 盒模型的组成：content + padding + border + margin */

/* 标准盒模型（W3C盒模型）*/
.box {
  box-sizing: content-box;  /* 默认值 */
  width: 200px;
  height: 100px;
  padding: 20px;
  border: 10px solid #000;
  margin: 30px;
}

/*
标准盒模型计算：
实际占据宽度 = margin-left + border-left + padding-left + width + padding-right + border-right + margin-right
             = 30 + 10 + 20 + 200 + 20 + 10 + 30
             = 320px

可视宽度（不含margin）= border-left + padding-left + width + padding-right + border-right
                      = 10 + 20 + 200 + 20 + 10
                      = 260px
*/

/* IE盒模型（怪异盒模型）*/
.box {
  box-sizing: border-box;
  width: 200px;
  height: 100px;
  padding: 20px;
  border: 10px solid #000;
  margin: 30px;
}

/*
IE盒模型计算：
width已包含padding和border
content宽度 = width - padding-left - padding-right - border-left - border-right
            = 200 - 20 - 20 - 10 - 10
            = 140px

实际占据宽度 = margin-left + width + margin-right
             = 30 + 200 + 30
             = 260px
*/

/* 对比示例 */
/* 标准盒模型 */
.standard {
  box-sizing: content-box;
  width: 200px;
  padding: 20px;
  border: 10px solid;
  /* 总宽度 = 200 + 20*2 + 10*2 = 260px */
}

/* IE盒模型 */
.border-box {
  box-sizing: border-box;
  width: 200px;
  padding: 20px;
  border: 10px solid;
  /* 总宽度 = 200px
     内容宽度 = 200 - 20*2 - 10*2 = 140px */
}

/* 最佳实践：全局使用border-box */
* {
  box-sizing: border-box;
}

/* 或更优雅的继承方式 */
html {
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}
```

### margin重叠（collapse）

```css
/* margin重叠（外边距折叠）*/

/* 1. 相邻兄弟元素 */
.sibling1 {
  margin-bottom: 50px;
}

.sibling2 {
  margin-top: 30px;
}

/* 实际间距 = max(50px, 30px) = 50px（取较大值）*/

/* 2. 父子元素 */
.parent {
  margin-top: 50px;
}

.child {
  margin-top: 30px;
}

/* 父元素的margin-top = max(50px, 30px) = 50px */

/* 3. 空元素 */
.empty {
  margin-top: 50px;
  margin-bottom: 30px;
}

/* 元素的margin = max(50px, 30px) = 50px */

/* 如何防止margin重叠 */

/* 方法1: 使用padding替代margin */
.parent {
  padding-top: 50px;
}

/* 方法2: 创建BFC */
.parent {
  overflow: hidden;  /* 创建BFC */
}

.child {
  margin-top: 30px;  /* 不会与父元素重叠 */
}

/* 方法3: 使用border或padding */
.parent {
  border-top: 1px solid transparent;
  /* 或 */
  padding-top: 1px;
}

/* 方法4: 浮动或绝对定位 */
.child {
  float: left;
  /* 或 */
  position: absolute;
}

/* 方法5: display: inline-block */
.child {
  display: inline-block;
}

/* 方法6: Flexbox或Grid */
.parent {
  display: flex;
  /* 或 */
  display: grid;
}
```

## 2. BFC（块级格式化上下文）

### BFC原理

```css
/* BFC (Block Formatting Context) 是什么？
   - 块级格式化上下文
   - 页面中的一个独立渲染区域
   - 内部元素的布局不受外部影响
*/

/* 如何创建BFC？*/

/* 1. 根元素（html）*/
html { /* 自动创建BFC */ }

/* 2. 浮动元素 */
.bfc {
  float: left;  /* 或 float: right */
}

/* 3. 绝对定位元素 */
.bfc {
  position: absolute;  /* 或 position: fixed */
}

/* 4. overflow不为visible */
.bfc {
  overflow: hidden;  /* 或 auto, scroll */
}

/* 5. display为inline-block、table-cell、table-caption */
.bfc {
  display: inline-block;
  /* 或 table-cell, table-caption */
}

/* 6. display为flex、inline-flex、grid、inline-grid */
.bfc {
  display: flex;
  /* 或 inline-flex, grid, inline-grid */
}

/* 7. display: flow-root (专门创建BFC) */
.bfc {
  display: flow-root;  /* 最佳方式，无副作用 */
}

/* BFC的特性和应用 */

/* 1. 阻止margin重叠 */
.wrapper {
  overflow: hidden;  /* 创建BFC */
}

.box1 {
  margin-bottom: 50px;
}

.box2 {
  margin-top: 30px;
}

/* 如果box1和box2在不同BFC中，margin不会重叠 */

/* 2. 包含浮动元素（清除浮动）*/
.container {
  overflow: hidden;  /* 创建BFC，包含浮动子元素 */
}

.float-child {
  float: left;
  width: 100px;
  height: 100px;
}

/* container的高度会包含float-child */

/* 3. 阻止文字环绕 */
.float {
  float: left;
  width: 100px;
  height: 100px;
}

.text {
  overflow: hidden;  /* 创建BFC，不会环绕float元素 */
}

/* 4. 自适应两栏布局 */
.sidebar {
  float: left;
  width: 200px;
  height: 400px;
  background: #f0f0f0;
}

.content {
  overflow: hidden;  /* 创建BFC，自动适应剩余宽度 */
  background: #fff;
}

/* 实战案例：清除浮动 */

/* 方法1: BFC (推荐) */
.clearfix {
  overflow: hidden;
  /* 或 display: flow-root; */
}

/* 方法2: 伪元素 */
.clearfix::after {
  content: "";
  display: block;
  clear: both;
}

/* 方法3: 双伪元素 (最佳) */
.clearfix::before,
.clearfix::after {
  content: "";
  display: table;
}

.clearfix::after {
  clear: both;
}
```

## 3. Flex布局

### Flex容器属性

```css
/* Flex容器（父元素）属性 */

.container {
  display: flex;  /* 或 inline-flex */

  /* 1. flex-direction: 主轴方向 */
  flex-direction: row;  /* 默认，水平从左到右 */
  /* row-reverse: 水平从右到左 */
  /* column: 垂直从上到下 */
  /* column-reverse: 垂直从下到上 */

  /* 2. flex-wrap: 是否换行 */
  flex-wrap: nowrap;  /* 默认，不换行 */
  /* wrap: 换行，第一行在上方 */
  /* wrap-reverse: 换行，第一行在下方 */

  /* 3. flex-flow: flex-direction和flex-wrap的简写 */
  flex-flow: row nowrap;  /* 默认值 */

  /* 4. justify-content: 主轴对齐方式 */
  justify-content: flex-start;  /* 默认，左对齐 */
  /* flex-end: 右对齐 */
  /* center: 居中 */
  /* space-between: 两端对齐，项目之间间隔相等 */
  /* space-around: 每个项目两侧间隔相等 */
  /* space-evenly: 项目间隔和边缘间隔相等 */

  /* 5. align-items: 交叉轴对齐方式 */
  align-items: stretch;  /* 默认，拉伸填满容器 */
  /* flex-start: 顶部对齐 */
  /* flex-end: 底部对齐 */
  /* center: 居中对齐 */
  /* baseline: 第一行文字基线对齐 */

  /* 6. align-content: 多行交叉轴对齐方式 */
  align-content: stretch;  /* 默认，拉伸填满 */
  /* flex-start: 顶部对齐 */
  /* flex-end: 底部对齐 */
  /* center: 居中对齐 */
  /* space-between: 两端对齐 */
  /* space-around: 等间距 */
  /* space-evenly: 等间距（含边缘）*/
}

/* 常用Flex布局场景 */

/* 1. 水平居中 */
.container {
  display: flex;
  justify-content: center;
}

/* 2. 垂直居中 */
.container {
  display: flex;
  align-items: center;
}

/* 3. 水平垂直居中 */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 4. 两端对齐 */
.container {
  display: flex;
  justify-content: space-between;
}

/* 5. 等分空间 */
.container {
  display: flex;
  justify-content: space-evenly;
}

/* 6. 底部对齐 */
.container {
  display: flex;
  align-items: flex-end;
}
```

### Flex项目属性

```css
/* Flex项目（子元素）属性 */

.item {
  /* 1. order: 排列顺序 */
  order: 0;  /* 默认，数值越小越靠前，可以为负数 */

  /* 2. flex-grow: 放大比例 */
  flex-grow: 0;  /* 默认，不放大 */
  /* 1: 如果有剩余空间，项目会放大 */
  /* 2: 放大比例是其他项目的2倍 */

  /* 3. flex-shrink: 缩小比例 */
  flex-shrink: 1;  /* 默认，空间不足时缩小 */
  /* 0: 不缩小 */
  /* 2: 缩小比例是其他项目的2倍 */

  /* 4. flex-basis: 初始大小 */
  flex-basis: auto;  /* 默认，项目本来的大小 */
  /* 200px: 固定大小 */
  /* 50%: 相对父元素的百分比 */

  /* 5. flex: flex-grow flex-shrink flex-basis的简写 */
  flex: 0 1 auto;  /* 默认值 */
  flex: 1;  /* 相当于 flex: 1 1 0% */
  flex: auto;  /* 相当于 flex: 1 1 auto */
  flex: none;  /* 相当于 flex: 0 0 auto */

  /* 6. align-self: 单个项目的对齐方式 */
  align-self: auto;  /* 默认，继承父元素的align-items */
  /* flex-start, flex-end, center, baseline, stretch */
}

/* 实战案例 */

/* 1. 圣杯布局 */
.container {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.header {
  flex: 0 0 60px;  /* 固定高度 */
}

.content {
  display: flex;
  flex: 1;  /* 占据剩余空间 */
}

.sidebar {
  flex: 0 0 200px;  /* 固定宽度 */
}

.main {
  flex: 1;  /* 占据剩余空间 */
}

.footer {
  flex: 0 0 80px;  /* 固定高度 */
}

/* 2. 等高列 */
.container {
  display: flex;
}

.column {
  flex: 1;  /* 等宽 */
  /* align-items默认为stretch，自动等高 */
}

/* 3. 响应式导航 */
.nav {
  display: flex;
  justify-content: space-between;
}

.nav-item {
  flex: 0 0 auto;  /* 内容宽度 */
}

@media (max-width: 768px) {
  .nav {
    flex-direction: column;
  }

  .nav-item {
    flex: 0 0 auto;
  }
}

/* 4. 卡片布局 */
.card-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.card {
  flex: 0 0 calc(33.333% - 20px);  /* 三列布局 */
  min-width: 300px;  /* 最小宽度 */
}

@media (max-width: 768px) {
  .card {
    flex: 0 0 100%;  /* 单列 */
  }
}
```

## 4. Grid布局

### Grid容器属性

```css
/* Grid容器（父元素）属性 */

.container {
  display: grid;  /* 或 inline-grid */

  /* 1. grid-template-columns: 列的宽度 */
  grid-template-columns: 100px 200px 100px;  /* 3列 */
  grid-template-columns: 1fr 2fr 1fr;  /* 比例分配 */
  grid-template-columns: repeat(3, 1fr);  /* 重复3次 */
  grid-template-columns: repeat(auto-fill, 200px);  /* 自动填充 */
  grid-template-columns: 200px auto 200px;  /* 混合 */
  grid-template-columns: minmax(200px, 1fr);  /* 最小200px */

  /* 2. grid-template-rows: 行的高度 */
  grid-template-rows: 100px 200px;  /* 2行 */
  grid-template-rows: repeat(3, 100px);  /* 重复 */

  /* 3. gap: 间距 */
  gap: 20px;  /* 行列间距都是20px */
  gap: 20px 10px;  /* 行间距20px，列间距10px */
  row-gap: 20px;  /* 行间距 */
  column-gap: 10px;  /* 列间距 */

  /* 4. justify-items: 单元格内容水平对齐 */
  justify-items: stretch;  /* 默认，拉伸 */
  /* start, end, center */

  /* 5. align-items: 单元格内容垂直对齐 */
  align-items: stretch;  /* 默认，拉伸 */
  /* start, end, center */

  /* 6. place-items: justify-items和align-items的简写 */
  place-items: center;  /* 水平垂直居中 */

  /* 7. justify-content: 整个内容区域水平对齐 */
  justify-content: start;  /* 默认 */
  /* end, center, space-between, space-around, space-evenly */

  /* 8. align-content: 整个内容区域垂直对齐 */
  align-content: start;  /* 默认 */
  /* end, center, space-between, space-around, space-evenly */

  /* 9. place-content: justify-content和align-content的简写 */
  place-content: center;  /* 整体居中 */

  /* 10. grid-auto-flow: 排列顺序 */
  grid-auto-flow: row;  /* 默认，先行后列 */
  /* column: 先列后行 */
  /* row dense: 紧密填充（尽量不留空格）*/

  /* 11. grid-template-areas: 命名区域 */
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";

  /* 12. grid-auto-rows: 隐式行的高度 */
  grid-auto-rows: 100px;

  /* 13. grid-auto-columns: 隐式列的宽度 */
  grid-auto-columns: 100px;
}

/* 实战案例 */

/* 1. 响应式网格 */
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

/* 2. 圣杯布局 */
.container {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: 60px 1fr 80px;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  min-height: 100vh;
}

.header {
  grid-area: header;
}

.sidebar {
  grid-area: sidebar;
}

.main {
  grid-area: main;
}

.footer {
  grid-area: footer;
}

/* 3. 瀑布流 */
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: 10px;  /* 小行高 */
  gap: 10px;
}

.item {
  /* 动态设置跨越的行数 */
  grid-row-end: span 20;  /* 跨越20个小行 */
}

/* 4. 卡片布局 */
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}
```

### Grid项目属性

```css
/* Grid项目（子元素）属性 */

.item {
  /* 1. grid-column-start: 列起始线 */
  grid-column-start: 1;

  /* 2. grid-column-end: 列结束线 */
  grid-column-end: 3;  /* 跨越2列 */

  /* 3. grid-column: 简写 */
  grid-column: 1 / 3;  /* 从第1列到第3列 */
  grid-column: 1 / span 2;  /* 从第1列开始，跨越2列 */

  /* 4. grid-row: 行的简写 */
  grid-row: 1 / 3;  /* 从第1行到第3行 */
  grid-row: 1 / span 2;  /* 从第1行开始，跨越2行 */

  /* 5. grid-area: 指定项目的区域 */
  grid-area: header;  /* 放在header区域 */
  grid-area: 1 / 1 / 3 / 3;  /* row-start / col-start / row-end / col-end */

  /* 6. justify-self: 单个项目水平对齐 */
  justify-self: center;  /* start, end, center, stretch */

  /* 7. align-self: 单个项目垂直对齐 */
  align-self: center;  /* start, end, center, stretch */

  /* 8. place-self: 简写 */
  place-self: center;  /* 水平垂直居中 */
}

/* 实战案例 */

/* 1. 不规则布局 */
.container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 100px);
  gap: 10px;
}

.item1 {
  grid-column: 1 / 3;  /* 跨越2列 */
  grid-row: 1 / 3;     /* 跨越2行 */
}

.item2 {
  grid-column: 3 / 5;  /* 跨越2列 */
}

.item3 {
  grid-column: 3 / 5;
  grid-row: 2 / 4;     /* 跨越2行 */
}

/* 2. 复杂布局 */
.container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.item-full {
  grid-column: 1 / -1;  /* 跨越所有列 */
}

.item-half {
  grid-column: span 6;  /* 跨越6列（一半）*/
}

.item-third {
  grid-column: span 4;  /* 跨越4列（三分之一）*/
}

.item-quarter {
  grid-column: span 3;  /* 跨越3列（四分之一）*/
}
```

## 5. 定位（Position）

### 五种定位方式

```css
/* 1. static（静态定位，默认值）*/
.static {
  position: static;
  /* top, right, bottom, left不起作用 */
}

/* 2. relative（相对定位）*/
.relative {
  position: relative;
  top: 10px;    /* 相对于原位置向下10px */
  left: 20px;   /* 相对于原位置向右20px */
  /* 不脱离文档流，原位置保留 */
}

/* 3. absolute（绝对定位）*/
.absolute {
  position: absolute;
  top: 0;
  left: 0;
  /* 相对于最近的非static定位祖先元素 */
  /* 脱离文档流，原位置不保留 */
}

/* 常见用法：父relative子absolute */
.parent {
  position: relative;
}

.child {
  position: absolute;
  top: 10px;
  right: 10px;
  /* 相对于parent定位 */
}

/* 4. fixed（固定定位）*/
.fixed {
  position: fixed;
  bottom: 20px;
  right: 20px;
  /* 相对于视口定位 */
  /* 脱离文档流，不随滚动移动 */
}

/* 5. sticky（粘性定位）*/
.sticky {
  position: sticky;
  top: 0;
  /* 在阈值范围内表现为relative */
  /* 超出阈值后表现为fixed */
}

/* 实战案例 */

/* 1. 居中定位 */
.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 2. 全屏覆盖 */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

/* 3. 粘性导航 */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
}

/* 4. 返回顶部按钮 */
.back-to-top {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
}

/* 5. 角标 */
.badge {
  position: absolute;
  top: -10px;
  right: -10px;
  border-radius: 50%;
}
```

## 6. 层叠上下文（Stacking Context）

### z-index和层叠顺序

```css
/* 层叠顺序（从低到高）*/
/*
1. 根元素的背景和边框
2. 常规流中的块级非定位后代元素（按HTML顺序）
3. 浮动元素
4. 常规流中的行内非定位后代元素
5. z-index: 0 或 auto 的定位元素
6. z-index > 0 的定位元素
*/

/* 创建层叠上下文的条件 */
.stacking-context {
  /* 1. 根元素 (html) */

  /* 2. position不为static，且z-index不为auto */
  position: relative;
  z-index: 1;

  /* 3. position: fixed 或 sticky */
  position: fixed;

  /* 4. flex或grid子元素，z-index不为auto */
  /* 父元素 */
  display: flex;
  /* 子元素 */
  z-index: 1;

  /* 5. opacity < 1 */
  opacity: 0.99;

  /* 6. transform不为none */
  transform: translateZ(0);

  /* 7. filter不为none */
  filter: blur(5px);

  /* 8. isolation: isolate */
  isolation: isolate;

  /* 9. will-change */
  will-change: transform;
}

/* z-index只在同一层叠上下文中比较 */

/* 示例1：z-index陷阱 */
.parent1 {
  position: relative;
  z-index: 1;
}

.child1 {
  position: relative;
  z-index: 9999;  /* 只在parent1内有效 */
}

.parent2 {
  position: relative;
  z-index: 2;  /* 比parent1高 */
}

.child2 {
  position: relative;
  z-index: 1;  /* 比child1低，但因为parent2更高，所以child2在上面 */
}

/* 示例2：正确的层级管理 */
.modal-backdrop {
  position: fixed;
  z-index: 1000;
}

.modal {
  position: fixed;
  z-index: 1001;
}

.tooltip {
  position: absolute;
  z-index: 1100;
}

.dropdown {
  position: absolute;
  z-index: 1200;
}

/* 最佳实践：使用CSS变量管理z-index */
:root {
  --z-base: 1;
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
}

.dropdown {
  z-index: var(--z-dropdown);
}

.modal {
  z-index: var(--z-modal);
}
```

## 7. 常见布局实现

### 水平垂直居中

```css
/* 方法1: Flex */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 方法2: Grid */
.container {
  display: grid;
  place-items: center;
}

/* 方法3: Position + Transform */
.container {
  position: relative;
}

.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 方法4: Position + Margin (固定宽高) */
.child {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  width: 200px;
  height: 100px;
}

/* 方法5: Table-cell (不推荐) */
.container {
  display: table-cell;
  vertical-align: middle;
  text-align: center;
}
```

### 两列布局

```css
/* 方法1: Float */
.left {
  float: left;
  width: 200px;
}

.right {
  margin-left: 200px;
}

/* 方法2: Flex */
.container {
  display: flex;
}

.left {
  flex: 0 0 200px;
}

.right {
  flex: 1;
}

/* 方法3: Grid */
.container {
  display: grid;
  grid-template-columns: 200px 1fr;
}

/* 方法4: Position */
.left {
  position: absolute;
  width: 200px;
}

.right {
  margin-left: 200px;
}
```

### 三列布局（圣杯/双飞翼）

```css
/* 圣杯布局 (Flex) */
.container {
  display: flex;
  min-height: 100vh;
}

.left {
  flex: 0 0 200px;
  order: -1;
}

.center {
  flex: 1;
}

.right {
  flex: 0 0 200px;
}

/* 双飞翼布局 (Float) */
.center {
  float: left;
  width: 100%;
}

.center-inner {
  margin: 0 200px;
}

.left {
  float: left;
  width: 200px;
  margin-left: -100%;
}

.right {
  float: left;
  width: 200px;
  margin-left: -200px;
}

/* Grid布局 */
.container {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
}
```

CSS布局是前端开发的核心技能，掌握盒模型、BFC、Flex、Grid等概念对于实现复杂布局至关重要！
