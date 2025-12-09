import re
import os

# 从清单中提取所有问题编号
checklist_file = '图片问题完整清单.md'
with open(checklist_file, 'r', encoding='utf-8') as f:
    content = f.read()
    
# 提取所有问题编号
checklist_questions = set()
for match in re.finditer(r'^(\d+)\.\s+(.+)$', content, re.MULTILINE):
    num = int(match.group(1))
    checklist_questions.add(num)

print(f"清单中的问题总数: {len(checklist_questions)}")
print(f"问题编号范围: {min(checklist_questions)} - {max(checklist_questions)}")
print(f"问题编号列表: {sorted(checklist_questions)[:20]}...")

# 检查已整理文件中的问题
md_files = [f for f in os.listdir('.') if f.endswith('.md') 
            and f not in ['README.md', '图片问题完整清单.md', '质量检查报告.md']]

print(f"\n已整理的文件数: {len(md_files)}")
print("文件列表:")
for f in sorted(md_files):
    print(f"  - {f}")
