结论：

1. 关注指标

   1. fcp -- loading time - 实际上都在1.4s内
   2. lcp - 平均 2.5s
   3. view_time = core_api_response_time - navigate_start_time; 分段堆叠（5个阶段，无缝衔接）：
      1. html_phase = responseEnd - navigateStart
      2. resource_phase = domContentLoadedEventEnd - responseEnd
      3. react_phase = api_request_time - domContentLoadedEventEnd // ⚠️ 你遗漏的
      4. api_phase = api_response_time - api_request_time
      5. data_render_phase = data_render_complete_time - api_response_time // ⚠️ 你遗漏的

# 性能指标统计表

| 指标    | 样本数    | 平均值 (ms) | P25 (ms) | P50 (ms) | P75 (ms) | P90 (ms) |
| ------- | --------- | ----------- | -------- | -------- | -------- | -------- |
| **FCP** | 4,436,314 | 1,677.9     | 364      | 692      | 1,304    | 2,244    |
| **LCP** | 2,567,742 | 2,814.9     | 1,120    | 1,764    | 3,172    | 5,424    |

一句话记住四个指标：

domInteractive：DOM 树建好（React还没跑）

domContentLoadedEventEnd：同步脚本跑完（React刚开始）

domComplete：资源下载完（用户已开玩）

loadEventEnd：官方说完成（实际已太晚）

对于现代 CSR 项目：

关注 FCP（何时有内容）

关注 LCP（何时主要内容出现）

关注 TTI（何时真正可用）

关注 业务指标（何时数据就绪）1、指标指定2、提测监控3、线上监控和分析4、时候分析总结
