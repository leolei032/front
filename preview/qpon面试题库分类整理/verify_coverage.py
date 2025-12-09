#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re

# 读取分类整理文档
def read_classification_doc():
    categories = {}
    current_category = None

    with open('分类整理文档', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 提取行号和内容
        match = re.match(r'^\d+→(.+)', line)
        if match:
            content = match.group(1)

            # 判断是否是分类标题（没有问号，内容较短，可能包含括号说明）
            is_category = (
                '?' not in content and
                '？' not in content and
                (len(content) < 30 or '(' in content or '（' in content)
            )

            if is_category:
                current_category = content.split('(')[0].split('（')[0].strip()
                categories[current_category] = []
            elif current_category:
                categories[current_category].append(content)

    return categories

# 读取所有MD文件内容
def read_md_files():
    md_files = {}
    files = [f for f in os.listdir('.') if f.endswith('.md') and f not in ['README.md', '图片问题完整清单.md', '质量检查报告.md']]

    for filename in files:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            md_files[filename] = content

    return md_files

# 检查问题是否在MD文件中
def check_question_coverage(question, md_content):
    # 清理问题文本，移除特殊字符
    clean_q = question.replace('?', '').replace('？', '').strip()

    # 检查完整匹配
    if clean_q in md_content or question in md_content:
        return True

    # 检查关键词匹配（如果问题较长）
    if len(clean_q) > 15:
        keywords = clean_q[:15]
        if keywords in md_content:
            return True

    return False

# 主函数
def main():
    print("=" * 80)
    print("📋 QPON面试题库分类覆盖情况检查")
    print("=" * 80)
    print()

    # 读取分类文档
    categories = read_classification_doc()

    # 读取所有MD文件
    md_files = read_md_files()
    all_md_content = '\n'.join(md_files.values())

    # 统计数据
    total_questions = sum(len(questions) for questions in categories.values())
    covered_count = 0
    uncovered_questions = {}

    # 检查每个分类
    print("📊 分类统计:")
    print("-" * 80)

    for category, questions in categories.items():
        if not questions:
            continue

        category_covered = 0
        category_uncovered = []

        for question in questions:
            if check_question_coverage(question, all_md_content):
                category_covered += 1
                covered_count += 1
            else:
                category_uncovered.append(question)

        total = len(questions)
        coverage_rate = (category_covered / total * 100) if total > 0 else 0

        status = "✅" if coverage_rate == 100 else "⚠️" if coverage_rate >= 70 else "❌"

        print(f"{status} {category}")
        print(f"   问题数: {total} | 已覆盖: {category_covered} | 未覆盖: {len(category_uncovered)} | 覆盖率: {coverage_rate:.1f}%")

        if category_uncovered:
            uncovered_questions[category] = category_uncovered

        print()

    # 总体统计
    print("=" * 80)
    print("📈 总体覆盖情况:")
    print("-" * 80)
    print(f"总分类数: {len(categories)}")
    print(f"总问题数: {total_questions}")
    print(f"已覆盖: {covered_count} ({covered_count/total_questions*100:.1f}%)")
    print(f"未覆盖: {total_questions - covered_count} ({(total_questions-covered_count)/total_questions*100:.1f}%)")
    print()

    # 详细未覆盖问题列表
    if uncovered_questions:
        print("=" * 80)
        print("❌ 未覆盖问题详情:")
        print("-" * 80)
        for category, questions in uncovered_questions.items():
            print(f"\n【{category}】 - {len(questions)}个问题")
            for i, question in enumerate(questions, 1):
                print(f"  {i}. {question}")

    # 文件对应关系
    print()
    print("=" * 80)
    print("📁 已生成的MD文件:")
    print("-" * 80)
    for filename in sorted(md_files.keys()):
        size = len(md_files[filename])
        print(f"  ✓ {filename} ({size} 字符)")

    print()
    print("=" * 80)

if __name__ == "__main__":
    main()
