#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os

# 定义分类关键词（这些行是分类标题）
CATEGORY_KEYWORDS = [
    '数据结构和算法',
    '开发语言',
    '前端框架',
    '性能优化',
    'debug能力',
    '前端监控',
    '跨端经验',
    '工程化/架构设计',
    '网络协议',
    'web安全'
]

# 读取分类文档
def parse_classification_doc():
    with open('分类整理文档', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    categories = {}
    current_category = None

    for line in lines:
        line = line.strip()

        if not line:
            continue

        # 检查是否是分类标题
        is_category = any(keyword in line for keyword in CATEGORY_KEYWORDS)

        if is_category:
            # 提取分类名称（去掉可能的括号说明）
            category_name = line.split('(')[0].split('（')[0].strip()
            current_category = category_name
            categories[current_category] = []
        elif current_category:
            # 这是一个问题
            categories[current_category].append(line)

    return categories

# 读取所有MD文件
def read_md_files():
    md_files = {}
    exclude = ['README.md', '图片问题完整清单.md', '质量检查报告.md']
    files = [f for f in os.listdir('.') if f.endswith('.md') and f not in exclude]

    for filename in files:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            md_files[filename] = content

    return md_files

# 智能匹配问题
def check_question_in_content(question, content):
    # 清理问题文本
    q = question.strip()

    # 移除问号
    q_no_mark = q.replace('?', '').replace('？', '')

    # 移除括号说明
    import re
    q_clean = re.sub(r'[（(].*?[)）]', '', q_no_mark).strip()

    # 1. 完整匹配
    if q in content or q_no_mark in content or q_clean in content:
        return True

    # 2. 关键词匹配（取前15-20个字符）
    if len(q_clean) > 15:
        key = q_clean[:20]
        if key in content:
            return True

        key = q_clean[:15]
        if key in content:
            return True

    # 3. 提取核心关键词（逗号或顿号前的部分）
    core_parts = re.split(r'[，,、]', q_clean)
    if core_parts:
        core = core_parts[0].strip()
        if len(core) > 5 and core in content:
            return True

    return False

# 主函数
def main():
    print("=" * 100)
    print(" " * 35 + "📋 QPON面试题库覆盖检查")
    print("=" * 100)
    print()

    # 解析分类文档
    categories = parse_classification_doc()

    # 读取MD文件
    md_files = read_md_files()
    all_content = '\n'.join(md_files.values())

    # 统计
    total_questions = sum(len(qs) for qs in categories.values())
    covered_count = 0
    uncovered_by_category = {}

    # 按分类检查
    print("📊 各分类覆盖情况:")
    print("-" * 100)
    print(f"{'分类':<25} {'问题数':>8} {'已覆盖':>8} {'未覆盖':>8} {'覆盖率':>10} {'状态':>8}")
    print("-" * 100)

    for category, questions in categories.items():
        covered = 0
        uncovered = []

        for q in questions:
            if check_question_in_content(q, all_content):
                covered += 1
            else:
                uncovered.append(q)

        total = len(questions)
        rate = (covered / total * 100) if total > 0 else 0
        covered_count += covered

        # 状态图标
        if rate == 100:
            status = "✅ 完美"
        elif rate >= 80:
            status = "🟢 优秀"
        elif rate >= 60:
            status = "🟡 良好"
        elif rate >= 40:
            status = "🟠 一般"
        else:
            status = "🔴 较差"

        print(f"{category:<25} {total:>8} {covered:>8} {len(uncovered):>8} {rate:>9.1f}% {status:>8}")

        if uncovered:
            uncovered_by_category[category] = uncovered

    # 总计
    print("-" * 100)
    total_rate = (covered_count / total_questions * 100) if total_questions > 0 else 0
    print(f"{'总计':<25} {total_questions:>8} {covered_count:>8} {total_questions-covered_count:>8} {total_rate:>9.1f}%")
    print()

    # 未覆盖问题详情
    if uncovered_by_category:
        print("=" * 100)
        print("❌ 未覆盖问题详细列表")
        print("=" * 100)

        for category, questions in uncovered_by_category.items():
            print(f"\n【{category}】 共{len(questions)}个未覆盖:")
            print("-" * 100)
            for i, q in enumerate(questions, 1):
                # 限制显示长度
                display = q if len(q) <= 85 else q[:85] + "..."
                print(f"  {i:2d}. {display}")

    # MD文件列表
    print()
    print("=" * 100)
    print("📁 已生成的MD文件:")
    print("=" * 100)
    for fname in sorted(md_files.keys()):
        size = len(md_files[fname])
        lines = md_files[fname].count('\n')
        h2_count = md_files[fname].count('## ')
        print(f"  ✓ {fname:<45} {size:>7}字符  {lines:>5}行  {h2_count:>3}题")

    # 总结
    print()
    print("=" * 100)
    print("📈 总结:")
    print("=" * 100)
    print(f"  分类数量: {len(categories)}")
    print(f"  问题总数: {total_questions}")
    print(f"  已覆盖数: {covered_count} ({total_rate:.1f}%)")
    print(f"  未覆盖数: {total_questions - covered_count} ({100-total_rate:.1f}%)")
    print(f"  MD文件数: {len(md_files)}")
    print()

    if total_rate >= 95:
        print("  🎉 覆盖率极高！几乎所有问题都已生成标准答案。")
    elif total_rate >= 80:
        print("  👍 覆盖率优秀！大部分问题已生成标准答案。")
    elif total_rate >= 60:
        print("  😊 覆盖率良好！还有少部分问题需要补充。")
    elif total_rate >= 40:
        print("  😐 覆盖率一般，建议继续补充问题答案。")
    else:
        print("  😟 覆盖率较低，需要大量补充问题答案。")

    print("=" * 100)

if __name__ == "__main__":
    main()
