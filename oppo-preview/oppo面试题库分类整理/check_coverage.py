import re
import os

# 从清单中提取所有问题
checklist_file = '图片问题完整清单.md'
with open(checklist_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有问题编号和标题
checklist_questions = {}
for match in re.finditer(r'^(\d+)\.\s+(.+)$', content, re.MULTILINE):
    num = int(match.group(1))
    title = match.group(2).strip()
    checklist_questions[num] = title

print(f"📋 清单中的问题总数: {len(checklist_questions)}")
print(f"📊 问题编号范围: {min(checklist_questions.keys())} - {max(checklist_questions.keys())}")

# 检查已整理文件中包含的问题关键词
md_files = [f for f in os.listdir('.') if f.endswith('.md')
            and f not in ['README.md', '图片问题完整清单.md', '质量检查报告.md', 'check_coverage.py']]

# 读取所有整理文件的内容
all_content = ""
file_contents = {}
for f in md_files:
    with open(f, 'r', encoding='utf-8') as file:
        file_content = file.read()
        all_content += file_content + "\n"
        file_contents[f] = file_content

# 检查每个问题是否被覆盖
print("\n" + "="*80)
print("🔍 问题覆盖情况检查")
print("="*80)

covered = []
not_covered = []
partially_covered = []

for num in sorted(checklist_questions.keys()):
    title = checklist_questions[num]

    # 提取关键词
    keywords = []

    # 根据题目内容提取关键词
    if 'async' in title.lower() or 'await' in title.lower():
        keywords = ['async', 'await']
    elif 'promise' in title.lower():
        keywords = ['Promise', 'promise']
    elif 'webpack' in title.lower():
        keywords = ['Webpack', 'webpack']
    elif 'vue' in title.lower():
        keywords = ['Vue', 'vue']
    elif 'react' in title.lower():
        keywords = ['React', 'react']
    elif 'bfc' in title.lower():
        keywords = ['BFC', 'bfc']
    elif 'for' in title.lower() and 'foreach' in title.lower():
        keywords = ['forEach', 'for循环']
    elif 'import' in title.lower() and 'require' in title.lower():
        keywords = ['import', 'require']
    elif '快速排序' in title:
        keywords = ['快速排序', 'quickSort']
    elif '数组打平' in title:
        keywords = ['数组打平', 'flat', '扁平化']
    elif '链表' in title:
        keywords = ['链表', 'linked']
    elif 'http' in title.lower() or 'https' in title.lower():
        keywords = ['HTTP', 'HTTPS']
    elif '性能优化' in title:
        keywords = ['性能优化', '性能']
    elif '监控' in title:
        keywords = ['监控']
    elif 'node' in title.lower():
        keywords = ['Node', 'node']
    elif 'xss' in title.lower():
        keywords = ['XSS', 'xss']
    elif 'csrf' in title.lower():
        keywords = ['CSRF', 'csrf']
    elif '跨域' in title:
        keywords = ['跨域', 'CORS']
    elif 'babel' in title.lower():
        keywords = ['Babel', 'babel']
    elif 'loader' in title.lower():
        keywords = ['loader', 'Loader']
    elif 'plugin' in title.lower():
        keywords = ['plugin', 'Plugin']
    elif 'hmr' in title.lower():
        keywords = ['HMR', 'hmr', '热更新']
    elif '响应式' in title:
        keywords = ['响应式', 'reactive']
    elif 'mixin' in title.lower():
        keywords = ['mixin', 'Mixin']
    elif 'computed' in title.lower():
        keywords = ['computed']
    elif 'watch' in title.lower():
        keywords = ['watch']
    elif 'v-model' in title.lower():
        keywords = ['v-model']
    elif 'v-if' in title.lower() or 'v-show' in title.lower():
        keywords = ['v-if', 'v-show']
    elif 'keep-alive' in title.lower():
        keywords = ['keep-alive', 'keepAlive']
    elif 'router' in title.lower():
        keywords = ['router', 'Router', '路由']
    elif 'vuex' in title.lower():
        keywords = ['Vuex', 'vuex']
    elif 'ssr' in title.lower():
        keywords = ['SSR', 'ssr', '服务端渲染']
    elif 'vdom' in title.lower() or '虚拟dom' in title.lower():
        keywords = ['虚拟DOM', 'VDom', 'VDOM', 'Virtual DOM']
    elif 'diff' in title.lower():
        keywords = ['diff', 'Diff']
    elif 'fiber' in title.lower():
        keywords = ['Fiber', 'fiber']
    elif 'hooks' in title.lower():
        keywords = ['Hooks', 'hooks', 'useState', 'useEffect']
    elif 'context' in title.lower():
        keywords = ['Context', 'context']
    elif 'refs' in title.lower() or 'ref' in title.lower():
        keywords = ['ref', 'refs', 'useRef']
    elif '高阶组件' in title:
        keywords = ['高阶组件', 'HOC']
    elif '受控组件' in title:
        keywords = ['受控组件', '非受控组件']
    elif 'pure component' in title.lower():
        keywords = ['PureComponent', 'Pure Component']
    elif '生命周期' in title:
        keywords = ['生命周期', 'lifecycle']
    elif 'immutable' in title.lower():
        keywords = ['Immutable', 'immutable']
    elif '防抖' in title or '节流' in title:
        keywords = ['防抖', '节流', 'debounce', 'throttle']
    elif 'devtools' in title.lower():
        keywords = ['devtools', 'DevTools', '开发者工具']
    elif 'coredump' in title.lower():
        keywords = ['coredump', 'core dump']
    elif 'pm2' in title.lower():
        keywords = ['PM2', 'pm2']
    elif 'rn' in title.lower() or 'react native' in title.lower():
        keywords = ['React Native', 'RN']
    elif '小程序' in title:
        keywords = ['小程序']
    elif 'taro' in title.lower():
        keywords = ['Taro', 'taro']
    elif 'flutter' in title.lower():
        keywords = ['Flutter', 'flutter']
    elif 'position' in title.lower():
        keywords = ['position']
    elif 'sticky' in title.lower():
        keywords = ['sticky']
    elif 'bind' in title.lower() or 'call' in title.lower() or 'apply' in title.lower():
        keywords = ['bind', 'call', 'apply']
    elif 'localstorage' in title.lower() or 'cookie' in title.lower():
        keywords = ['localStorage', 'cookie']
    elif 'viewport' in title.lower():
        keywords = ['viewport']
    elif 'rem' in title.lower() or 'em' in title.lower():
        keywords = ['rem', 'em', 'vw']
    elif '选择器' in title:
        keywords = ['选择器', 'selector']
    elif '浮动' in title:
        keywords = ['浮动', 'float', '清除浮动']
    elif '事件代理' in title or '事件委托' in title:
        keywords = ['事件代理', '事件委托', 'delegation']
    elif '1px' in title:
        keywords = ['1px', 'retina']
    elif 'sass' in title.lower() or 'less' in title.lower():
        keywords = ['sass', 'less', 'scss']
    else:
        # 默认使用标题中的关键词
        keywords = [word for word in re.findall(r'\w+', title) if len(word) > 2]

    # 检查关键词是否在内容中
    found_in_files = []
    if keywords:
        for keyword in keywords:
            for filename, file_content in file_contents.items():
                if keyword in file_content:
                    found_in_files.append(filename)
                    break

    if found_in_files:
        covered.append((num, title, list(set(found_in_files))))
    else:
        not_covered.append((num, title))

print(f"\n✅ 已覆盖: {len(covered)} 个问题 ({len(covered)/len(checklist_questions)*100:.1f}%)")
print(f"❌ 未覆盖: {len(not_covered)} 个问题 ({len(not_covered)/len(checklist_questions)*100:.1f}%)")

print("\n" + "="*80)
print("❌ 未覆盖的问题列表")
print("="*80)
for num, title in sorted(not_covered):
    print(f"{num}. {title}")

print("\n" + "="*80)
print("📝 建议")
print("="*80)

# 按类别分组未覆盖的问题
categories = {
    'devtools和调试': [],
    '跨端开发': [],
    '监控相关': [],
    '工程化': [],
    '其他': []
}

for num, title in not_covered:
    if any(k in title.lower() for k in ['devtools', 'debug', '调试', 'coredump']):
        categories['devtools和调试'].append((num, title))
    elif any(k in title.lower() for k in ['rn', 'react native', '小程序', 'taro', 'flutter', '跨端']):
        categories['跨端开发'].append((num, title))
    elif any(k in title.lower() for k in ['监控', 'monitor', 'pm2']):
        categories['监控相关'].append((num, title))
    elif any(k in title.lower() for k in ['webpack', 'babel', '工程', '构建']):
        categories['工程化'].append((num, title))
    else:
        categories['其他'].append((num, title))

for category, questions in categories.items():
    if questions:
        print(f"\n【{category}】 {len(questions)}个问题")
        for num, title in questions[:5]:  # 只显示前5个
            print(f"  {num}. {title}")
        if len(questions) > 5:
            print(f"  ... 还有 {len(questions)-5} 个问题")

print("\n" + "="*80)
print("💡 总结")
print("="*80)
print(f"总问题数: {len(checklist_questions)}")
print(f"已覆盖: {len(covered)} ({len(covered)/len(checklist_questions)*100:.1f}%)")
print(f"未覆盖: {len(not_covered)} ({len(not_covered)/len(checklist_questions)*100:.1f}%)")
print(f"\n需要补充的主要领域: {', '.join([k for k, v in categories.items() if v])}")
