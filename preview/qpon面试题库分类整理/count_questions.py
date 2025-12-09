#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# 读取分类整理文档并准确统计问题数
def count_questions_accurately():
    with open('分类整理文档', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    total_lines = len(lines)
    question_lines = []
    category_lines = []
    empty_lines = []

    print("=" * 90)
    print("📋 逐行分析分类整理文档")
    print("=" * 90)
    print()

    for i, line in enumerate(lines, 1):
        line = line.strip()

        if not line:
            empty_lines.append(i)
            continue

        # 提取行号和内容
        match = re.match(r'^(\d+)→(.+)', line)
        if match:
            line_num = match.group(1)
            content = match.group(2)

            # 判断是分类标题还是问题
            # 分类标题的特征：
            # 1. 不包含问号
            # 2. 相对较短或包含说明性括号
            # 3. 通常是名词性短语

            has_question_mark = '?' in content or '？' in content
            has_parenthesis = '(' in content or '（' in content
            is_short = len(content) < 20

            # 如果有问号，肯定是问题
            if has_question_mark:
                question_lines.append((i, line_num, content))
                print(f"问题 {len(question_lines):3d} | 行{i:3d} | {content[:60]}")
            # 如果很短且没问号，可能是分类
            elif is_short and not has_parenthesis:
                category_lines.append((i, line_num, content))
                print(f"\n{'='*90}")
                print(f"🏷️  分类 | 行{i:3d} | {content}")
                print(f"{'='*90}")
            # 如果有括号说明，也可能是分类
            elif has_parenthesis and not has_question_mark:
                # 需要判断是问题中的解释还是分类说明
                if len(content) > 50:  # 较长的带括号内容，可能是问题
                    question_lines.append((i, line_num, content))
                    print(f"问题 {len(question_lines):3d} | 行{i:3d} | {content[:60]}")
                else:  # 较短的带括号内容，是分类
                    category_lines.append((i, line_num, content))
                    print(f"\n{'='*90}")
                    print(f"🏷️  分类 | 行{i:3d} | {content}")
                    print(f"{'='*90}")
            # 其他情况，判断为问题
            else:
                question_lines.append((i, line_num, content))
                print(f"问题 {len(question_lines):3d} | 行{i:3d} | {content[:60]}")

    print()
    print("=" * 90)
    print("📊 统计结果")
    print("=" * 90)
    print(f"总行数: {total_lines}")
    print(f"空行数: {len(empty_lines)}")
    print(f"分类数: {len(category_lines)}")
    print(f"问题数: {len(question_lines)}")
    print(f"有效内容行: {len(category_lines) + len(question_lines)}")
    print()

    # 显示所有分类
    print("=" * 90)
    print("🏷️  所有分类")
    print("=" * 90)
    for i, (line_no, num, content) in enumerate(category_lines, 1):
        print(f"{i:2d}. {content}")
    print()

    return {
        'total_lines': total_lines,
        'categories': category_lines,
        'questions': question_lines,
        'empty_lines': empty_lines
    }

if __name__ == "__main__":
    result = count_questions_accurately()
