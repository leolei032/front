#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
对比分类整理文档和质量检查报告，找出缺失的问题
"""

import re

# 解析分类整理文档
def parse_classification_doc():
    """解析分类整理文档，提取所有分类和问题"""
    with open('分类整理文档.md', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 定义分类关键词
    category_keywords = [
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

    categories = {}
    current_category = None
    question_count = 0

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 检查是否是分类标题
        is_category = False
        for keyword in category_keywords:
            if keyword in line and len(line) < 100:
                is_category = True
                # 提取分类名（去掉括号说明）
                category_name = line.split('(')[0].split('（')[0].strip()
                current_category = category_name
                categories[current_category] = []
                break

        if not is_category and current_category:
            # 这是一个问题
            question_count += 1
            categories[current_category].append({
                'id': question_count,
                'question': line
            })

    return categories, question_count

# 解析质量检查报告
def parse_quality_report():
    """解析质量检查报告，提取已完成的问题"""
    with open('质量检查报告.md', 'r', encoding='utf-8') as f:
        content = f.read()

    # 提取已完成的核心问题部分
    completed_questions = []

    # 按分类提取
    category_pattern = r'####\s+\d+\.\s+(.+?)\s+\((\d+)\)'
    question_pattern = r'- ✅ (.+?)(?:\n|（|$)'

    for match in re.finditer(category_pattern, content):
        category = match.group(1)
        file_num = match.group(2)

        # 找到这个分类后面的内容
        start_pos = match.end()
        # 找到下一个分类或分隔线的位置
        next_match = re.search(r'####|\n---\n', content[start_pos:])
        if next_match:
            section_content = content[start_pos:start_pos + next_match.start()]
        else:
            section_content = content[start_pos:]

        # 提取这个分类下的所有问题
        questions = re.findall(question_pattern, section_content)
        for q in questions:
            completed_questions.append({
                'category': category,
                'file_num': file_num,
                'question': q.strip()
            })

    return completed_questions

# 智能匹配问题
def match_question(target_q, completed_questions):
    """智能匹配问题是否已完成"""
    # 清理目标问题
    target_clean = target_q.strip()
    # 移除问号
    target_clean = target_clean.replace('?', '').replace('？', '')
    # 移除括号说明
    target_clean = re.sub(r'[（(].*?[)）]', '', target_clean).strip()

    # 尝试匹配
    for completed in completed_questions:
        completed_q = completed['question']
        # 移除问号
        completed_clean = completed_q.replace('?', '').replace('？', '')
        # 移除括号说明
        completed_clean = re.sub(r'[（(].*?[)）]', '', completed_clean).strip()

        # 1. 完整匹配
        if target_clean == completed_clean:
            return True, completed

        # 2. 目标问题包含在已完成问题中
        if target_clean in completed_clean:
            return True, completed

        # 3. 已完成问题包含在目标问题中
        if completed_clean in target_clean:
            return True, completed

        # 4. 提取核心关键词（前15个字符）
        if len(target_clean) > 10 and len(completed_clean) > 10:
            target_key = target_clean[:15]
            completed_key = completed_clean[:15]
            if target_key == completed_key or target_key in completed_clean or completed_key in target_clean:
                return True, completed

    return False, None

# 主函数
def main():
    print("=" * 100)
    print(" " * 35 + "📋 问题覆盖度对比分析")
    print("=" * 100)
    print()

    # 1. 解析分类整理文档
    print("📖 正在解析分类整理文档...")
    all_categories, total_questions = parse_classification_doc()
    print(f"   ✓ 找到 {len(all_categories)} 个分类")
    print(f"   ✓ 找到 {total_questions} 个问题")
    print()

    # 2. 解析质量检查报告
    print("📊 正在解析质量检查报告...")
    completed_questions = parse_quality_report()
    print(f"   ✓ 找到 {len(completed_questions)} 个已完成问题")
    print()

    # 3. 对比分析
    print("=" * 100)
    print("🔍 分类问题对比分析")
    print("=" * 100)
    print()

    all_missing = []
    all_covered = []

    for category, questions in all_categories.items():
        print(f"\n【{category}】")
        print("-" * 100)

        covered = []
        missing = []

        for q_info in questions:
            q_id = q_info['id']
            q_text = q_info['question']

            matched, match_info = match_question(q_text, completed_questions)

            if matched:
                covered.append({
                    'id': q_id,
                    'question': q_text,
                    'matched_in': match_info
                })
                all_covered.append({
                    'category': category,
                    'id': q_id,
                    'question': q_text,
                    'matched_in': match_info
                })
            else:
                missing.append({
                    'id': q_id,
                    'question': q_text
                })
                all_missing.append({
                    'category': category,
                    'id': q_id,
                    'question': q_text
                })

        total = len(questions)
        covered_count = len(covered)
        missing_count = len(missing)
        rate = (covered_count / total * 100) if total > 0 else 0

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

        print(f"问题总数: {total} | 已覆盖: {covered_count} | 未覆盖: {missing_count} | 覆盖率: {rate:.1f}% {status}")

        if missing:
            print(f"\n❌ 缺失的问题 ({missing_count}个):")
            for m in missing:
                # 截断过长的问题
                q_display = m['question'] if len(m['question']) <= 80 else m['question'][:80] + "..."
                print(f"  {m['id']:3d}. {q_display}")

    # 4. 总结
    print()
    print("=" * 100)
    print("📈 总体统计")
    print("=" * 100)
    print(f"问题总数: {total_questions}")
    print(f"已覆盖: {len(all_covered)} ({len(all_covered)/total_questions*100:.1f}%)")
    print(f"未覆盖: {len(all_missing)} ({len(all_missing)/total_questions*100:.1f}%)")
    print()

    # 5. 详细缺失问题列表
    if all_missing:
        print("=" * 100)
        print("❌ 所有缺失问题详细列表")
        print("=" * 100)

        # 按分类分组
        missing_by_category = {}
        for m in all_missing:
            cat = m['category']
            if cat not in missing_by_category:
                missing_by_category[cat] = []
            missing_by_category[cat].append(m)

        for category, items in missing_by_category.items():
            print(f"\n【{category}】 共{len(items)}个缺失:")
            print("-" * 100)
            for item in items:
                print(f"  {item['id']:3d}. {item['question']}")

    # 6. 生成Markdown格式的报告
    print()
    print("=" * 100)
    print("📝 生成缺失问题报告...")

    with open('缺失问题报告.md', 'w', encoding='utf-8') as f:
        f.write("# QPON面试题库缺失问题报告\n\n")
        f.write(f"生成时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("## 统计概览\n\n")
        f.write(f"- **问题总数**: {total_questions}\n")
        f.write(f"- **已覆盖**: {len(all_covered)} ({len(all_covered)/total_questions*100:.1f}%)\n")
        f.write(f"- **未覆盖**: {len(all_missing)} ({len(all_missing)/total_questions*100:.1f}%)\n\n")

        f.write("## 分类覆盖情况\n\n")
        f.write("| 分类 | 总数 | 已覆盖 | 未覆盖 | 覆盖率 |\n")
        f.write("|------|------|--------|--------|--------|\n")

        for category, questions in all_categories.items():
            total = len(questions)
            covered_count = sum(1 for q in questions if match_question(q['question'], completed_questions)[0])
            missing_count = total - covered_count
            rate = (covered_count / total * 100) if total > 0 else 0
            f.write(f"| {category} | {total} | {covered_count} | {missing_count} | {rate:.1f}% |\n")

        f.write("\n## 缺失问题详细列表\n\n")

        for category, items in missing_by_category.items():
            f.write(f"### {category} ({len(items)}个)\n\n")
            for item in items:
                f.write(f"{item['id']}. {item['question']}\n")
            f.write("\n")

    print("   ✓ 报告已保存到: 缺失问题报告.md")
    print("=" * 100)

if __name__ == "__main__":
    main()
