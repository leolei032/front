#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 读取文件并简单统计
with open('分类整理文档', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"总行数: {len(lines)}")
print()

# 逐行显示，看看实际内容
print("前50行内容:")
print("=" * 90)
for i, line in enumerate(lines[:50], 1):
    line = line.strip()
    if line:
        print(f"{i:3d}. {line}")
    else:
        print(f"{i:3d}. [空行]")

print()
print("=" * 90)
print(f"总行数: {len(lines)}")
non_empty = [l for l in lines if l.strip()]
print(f"非空行数: {len(non_empty)}")
