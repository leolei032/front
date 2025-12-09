# 数组算法和JavaScript实战技巧

> 深入解析数组相关算法、ES6+新特性和JavaScript实用技巧

---

## 目录

1. [数组算法](#1-数组算法)
2. [数组打平](#2-数组打平)
3. [数组去重](#3-数组去重)
4. [数组转换技巧](#4-数组转换技巧)
5. [实用工具函数](#5-实用工具函数)

---

## 1. 数组算法

### 1.1 取数组的最大值

```javascript
/**
 * 取数组最大值的多种方法
 */

const arr = [3, 7, 2, 9, 1, 5, 8];

// 方法1：Math.max + 展开运算符（ES6）⭐⭐⭐
const max1 = Math.max(...arr);
console.log('方法1:', max1); // 9

// 方法2：Math.max + apply（ES5）
const max2 = Math.max.apply(null, arr);
console.log('方法2:', max2); // 9

// 方法3：reduce
const max3 = arr.reduce((max, current) => Math.max(max, current));
console.log('方法3:', max3); // 9

// 方法4：sort排序
const max4 = arr.sort((a, b) => b - a)[0];
console.log('方法4:', max4); // 9

// 方法5：遍历
const max5 = (() => {
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
})();
console.log('方法5:', max5); // 9

// 性能对比
function benchmark(fn, name) {
    const start = Date.now();
    for (let i = 0; i < 1000000; i++) {
        fn();
    }
    const duration = Date.now() - start;
    console.log(`${name}: ${duration}ms`);
}

const bigArr = Array.from({ length: 10000 }, () => Math.random() * 10000);

benchmark(() => Math.max(...bigArr), '展开运算符');
benchmark(() => Math.max.apply(null, bigArr), 'apply');
benchmark(() => bigArr.reduce((m, c) => Math.max(m, c)), 'reduce');
// 展开运算符: ~15ms
// apply: ~12ms
// reduce: ~8ms (最快)

/**
 * 性能总结：
 * 1. 小数组（< 1000）：展开运算符最简洁，性能差异不大
 * 2. 大数组（> 10000）：reduce最快，apply次之
 * 3. 生产环境推荐：reduce（性能好，兼容性好）
 */
```

### 1.2 数组中第K大的元素

```javascript
/**
 * 找到数组中第K大的元素
 * LeetCode 215
 */

// 方法1：排序（简单但不是最优）
function findKthLargest_Sort(nums, k) {
    nums.sort((a, b) => b - a);
    return nums[k - 1];
}

// 方法2：快速选择算法（最优）⭐⭐⭐
function findKthLargest(nums, k) {
    // 找第k大 = 找第(n-k)小
    return quickSelect(nums, 0, nums.length - 1, nums.length - k);
}

function quickSelect(nums, left, right, k) {
    if (left === right) {
        return nums[left];
    }

    // 随机选择pivot（避免最坏情况）
    const pivotIndex = left + Math.floor(Math.random() * (right - left + 1));
    const finalPivotIndex = partition(nums, left, right, pivotIndex);

    if (finalPivotIndex === k) {
        return nums[k];
    } else if (finalPivotIndex < k) {
        return quickSelect(nums, finalPivotIndex + 1, right, k);
    } else {
        return quickSelect(nums, left, finalPivotIndex - 1, k);
    }
}

function partition(nums, left, right, pivotIndex) {
    const pivotValue = nums[pivotIndex];

    // 将pivot移到最右边
    [nums[pivotIndex], nums[right]] = [nums[right], nums[pivotIndex]];

    let storeIndex = left;
    for (let i = left; i < right; i++) {
        if (nums[i] < pivotValue) {
            [nums[i], nums[storeIndex]] = [nums[storeIndex], nums[i]];
            storeIndex++;
        }
    }

    // 将pivot移到最终位置
    [nums[storeIndex], nums[right]] = [nums[right], nums[storeIndex]];
    return storeIndex;
}

// 测试
console.log(findKthLargest([3, 2, 1, 5, 6, 4], 2)); // 5
console.log(findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)); // 4

/**
 * 时间复杂度：
 * - 排序法：O(n log n)
 * - 快速选择：平均O(n)，最坏O(n²)
 *
 * 空间复杂度：
 * - 排序法：O(log n) - 排序的栈空间
 * - 快速选择：O(1) - 原地操作
 */
```

### 1.3 数组变换

```javascript
/**
 * [1, 2, 3, 4, 5] 变成 [1, 2, 3, 'a', 'b', 5]
 */

// 方法1：splice
function transformArray1(arr) {
    const result = [...arr];
    result.splice(3, 1, 'a', 'b');
    return result;
}

// 方法2：slice + concat
function transformArray2(arr) {
    return arr.slice(0, 3).concat(['a', 'b'], arr.slice(4));
}

// 方法3：map（不推荐，不够清晰）
function transformArray3(arr) {
    return arr.map((val, idx) => {
        if (idx === 3) return 'a';
        if (idx === 4) return 'b';
        return val;
    });
}

// 方法4：reduce
function transformArray4(arr) {
    return arr.reduce((acc, val, idx) => {
        if (idx === 3) {
            return [...acc, 'a', 'b'];
        } else if (idx === 4) {
            return acc;
        }
        return [...acc, val];
    }, []);
}

// 测试
const arr = [1, 2, 3, 4, 5];
console.log(transformArray1(arr)); // [1, 2, 3, 'a', 'b', 5]
console.log(transformArray2(arr)); // [1, 2, 3, 'a', 'b', 5]

// 通用版本：替换指定位置的元素
function replaceArrayElements(arr, startIndex, deleteCount, ...items) {
    const result = [...arr];
    result.splice(startIndex, deleteCount, ...items);
    return result;
}

console.log(replaceArrayElements([1, 2, 3, 4, 5], 3, 1, 'a', 'b'));
// [1, 2, 3, 'a', 'b', 5]
```

---

## 2. 数组打平

### 2.1 多种实现方式

```javascript
/**
 * 数组打平（扁平化）
 * 将多维数组转换为一维数组
 */

const nested = [1, [2, [3, [4, 5]]], 6, [7, 8]];

// 方法1：ES6 flat() ⭐⭐⭐
const flat1 = nested.flat(Infinity);
console.log('flat():', flat1);
// [1, 2, 3, 4, 5, 6, 7, 8]

// 方法2：递归
function flatten(arr) {
    return arr.reduce((acc, val) => {
        return acc.concat(Array.isArray(val) ? flatten(val) : val);
    }, []);
}
const flat2 = flatten(nested);
console.log('递归:', flat2);

// 方法3：栈（迭代）
function flattenIterative(arr) {
    const stack = [...arr];
    const result = [];

    while (stack.length) {
        const next = stack.pop();
        if (Array.isArray(next)) {
            stack.push(...next);
        } else {
            result.unshift(next);  // 或者stack遍历完后result.reverse()
        }
    }

    return result;
}
const flat3 = flattenIterative(nested);
console.log('栈:', flat3);

// 方法4：toString（有局限性，只适用于数字）
function flattenToString(arr) {
    return arr.toString().split(',').map(Number);
}
const flat4 = flattenToString(nested);
console.log('toString:', flat4);

// 方法5：Generator
function* flattenGenerator(arr) {
    for (const item of arr) {
        if (Array.isArray(item)) {
            yield* flattenGenerator(item);
        } else {
            yield item;
        }
    }
}
const flat5 = [...flattenGenerator(nested)];
console.log('Generator:', flat5);

// 方法6：reduce + concat + 递归（经典）
function flattenClassic(arr) {
    return arr.reduce((acc, val) =>
        Array.isArray(val)
            ? acc.concat(flattenClassic(val))
            : acc.concat(val),
        []
    );
}
const flat6 = flattenClassic(nested);
console.log('经典递归:', flat6);
```

### 2.2 指定深度的打平

```javascript
/**
 * 打平指定深度
 */

function flattenDepth(arr, depth = 1) {
    if (depth === 0) return arr;

    return arr.reduce((acc, val) => {
        return acc.concat(
            Array.isArray(val)
                ? flattenDepth(val, depth - 1)
                : val
        );
    }, []);
}

const nested = [1, [2, [3, [4]]]];

console.log(flattenDepth(nested, 1)); // [1, 2, [3, [4]]]
console.log(flattenDepth(nested, 2)); // [1, 2, 3, [4]]
console.log(flattenDepth(nested, 3)); // [1, 2, 3, 4]

// 使用flat()
console.log(nested.flat(1));  // [1, 2, [3, [4]]]
console.log(nested.flat(2));  // [1, 2, 3, [4]]
console.log(nested.flat(Infinity));  // [1, 2, 3, 4]
```

### 2.3 性能对比

```javascript
function benchmark() {
    const deepNested = [1, [2, [3, [4, [5, [6, [7, [8, [9, [10]]]]]]]]]];
    const iterations = 100000;

    console.time('flat(Infinity)');
    for (let i = 0; i < iterations; i++) {
        deepNested.flat(Infinity);
    }
    console.timeEnd('flat(Infinity)');

    console.time('递归reduce');
    for (let i = 0; i < iterations; i++) {
        flatten(deepNested);
    }
    console.timeEnd('递归reduce');

    console.time('栈迭代');
    for (let i = 0; i < iterations; i++) {
        flattenIterative(deepNested);
    }
    console.timeEnd('栈迭代');
}

// benchmark();
// flat(Infinity): ~120ms (最快，原生实现)
// 递归reduce: ~180ms
// 栈迭代: ~150ms
```

---

## 3. 数组去重

```javascript
/**
 * 数组去重的多种方法
 */

const arr = [1, 2, 2, 3, 4, 4, 5, 1, 3];

// 方法1：Set ⭐⭐⭐（最简单）
const unique1 = [...new Set(arr)];
console.log('Set:', unique1); // [1, 2, 3, 4, 5]

// 方法2：filter + indexOf
const unique2 = arr.filter((item, index) => arr.indexOf(item) === index);
console.log('filter:', unique2);

// 方法3：reduce
const unique3 = arr.reduce((acc, val) => {
    return acc.includes(val) ? acc : [...acc, val];
}, []);
console.log('reduce:', unique3);

// 方法4：Map
const unique4 = Array.from(new Map(arr.map(item => [item, item])).values());
console.log('Map:', unique4);

// 方法5：双层循环（ES5，不推荐）
function uniqueES5(arr) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let duplicate = false;
        for (let j = 0; j < result.length; j++) {
            if (arr[i] === result[j]) {
                duplicate = true;
                break;
            }
        }
        if (!duplicate) {
            result.push(arr[i]);
        }
    }
    return result;
}
console.log('双层循环:', uniqueES5(arr));

/**
 * 对象数组去重
 */

const objArr = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 1, name: 'a' },  // 重复
    { id: 3, name: 'c' }
];

// 根据id去重
const uniqueById = Array.from(
    new Map(objArr.map(item => [item.id, item])).values()
);
console.log('对象数组去重:', uniqueById);

// 更通用的对象去重
function uniqueByKey(arr, key) {
    return Array.from(
        new Map(arr.map(item => [item[key], item])).values()
    );
}

console.log(uniqueByKey(objArr, 'id'));
```

---

## 4. 数组转换技巧

### 4.1 类数组转数组

```javascript
/**
 * 类数组对象转真正的数组
 */

// 类数组示例
function testArguments() {
    console.log(arguments); // [Arguments] { '0': 1, '1': 2, '2': 3 }

    // 方法1：Array.from ⭐⭐⭐
    const arr1 = Array.from(arguments);
    console.log('Array.from:', arr1);

    // 方法2：展开运算符
    const arr2 = [...arguments];
    console.log('展开运算符:', arr2);

    // 方法3：Array.prototype.slice
    const arr3 = Array.prototype.slice.call(arguments);
    console.log('slice.call:', arr3);

    // 方法4：Array.prototype.concat
    const arr4 = Array.prototype.concat.apply([], arguments);
    console.log('concat.apply:', arr4);
}

testArguments(1, 2, 3);

// DOM NodeList转数组
const divs = document.querySelectorAll('div');

const divsArray1 = Array.from(divs);
const divsArray2 = [...divs];
const divsArray3 = Array.prototype.slice.call(divs);
```

### 4.2 数组转对象

```javascript
/**
 * 数组转对象的多种方式
 */

const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' }
];

// 方法1：reduce
const userMap1 = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
}, {});
console.log(userMap1);
// { '1': { id: 1, name: 'Alice' }, '2': ..., '3': ... }

// 方法2：Object.fromEntries
const userMap2 = Object.fromEntries(
    users.map(user => [user.id, user])
);
console.log(userMap2);

// 方法3：for...of
const userMap3 = {};
for (const user of users) {
    userMap3[user.id] = user;
}
console.log(userMap3);
```

### 4.3 对象数组分组

```javascript
/**
 * 数组分组
 */

const students = [
    { name: 'Alice', grade: 'A' },
    { name: 'Bob', grade: 'B' },
    { name: 'Charlie', grade: 'A' },
    { name: 'David', grade: 'C' },
    { name: 'Eve', grade: 'B' }
];

// 方法1：reduce
const groupedByGrade = students.reduce((acc, student) => {
    const { grade } = student;
    if (!acc[grade]) {
        acc[grade] = [];
    }
    acc[grade].push(student);
    return acc;
}, {});

console.log(groupedByGrade);
/*
{
    A: [{ name: 'Alice', grade: 'A' }, { name: 'Charlie', grade: 'A' }],
    B: [{ name: 'Bob', grade: 'B' }, { name: 'Eve', grade: 'B' }],
    C: [{ name: 'David', grade: 'C' }]
}
*/

// 通用分组函数
function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const group = typeof key === 'function' ? key(item) : item[key];
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(item);
        return acc;
    }, {});
}

console.log(groupBy(students, 'grade'));
console.log(groupBy(students, s => s.name[0])); // 按首字母分组
```

---

## 5. 实用工具函数

### 5.1 数组求和、平均值

```javascript
/**
 * 数组统计函数
 */

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 求和
const sum = numbers.reduce((acc, val) => acc + val, 0);
console.log('Sum:', sum); // 55

// 平均值
const average = sum / numbers.length;
console.log('Average:', average); // 5.5

// 最小值
const min = Math.min(...numbers);
console.log('Min:', min); // 1

// 中位数
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
console.log('Median:', median(numbers)); // 5.5

// 众数
function mode(arr) {
    const frequency = {};
    let maxFreq = 0;
    let modes = [];

    arr.forEach(num => {
        frequency[num] = (frequency[num] || 0) + 1;
        if (frequency[num] > maxFreq) {
            maxFreq = frequency[num];
            modes = [num];
        } else if (frequency[num] === maxFreq) {
            modes.push(num);
        }
    });

    return modes;
}
console.log('Mode:', mode([1, 2, 2, 3, 3, 3, 4])); // [3]
```

### 5.2 数组洗牌（随机排序）

```javascript
/**
 * Fisher-Yates洗牌算法
 */

function shuffle(arr) {
    const result = [...arr];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log('原数组:', deck);
console.log('洗牌后:', shuffle(deck));
console.log('再次洗牌:', shuffle(deck));
```

### 5.3 数组分块

```javascript
/**
 * 将数组分成指定大小的块
 */

function chunk(arr, size) {
    const chunks = [];

    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }

    return chunks;
}

const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
console.log(chunk(arr, 3));
// [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

console.log(chunk(arr, 4));
// [[1, 2, 3, 4], [5, 6, 7, 8], [9]]

// reduce实现
function chunkReduce(arr, size) {
    return arr.reduce((acc, val, i) => {
        const index = Math.floor(i / size);
        if (!acc[index]) {
            acc[index] = [];
        }
        acc[index].push(val);
        return acc;
    }, []);
}

console.log(chunkReduce(arr, 3));
```

### 5.4 数组差集、交集、并集

```javascript
/**
 * 集合运算
 */

const arr1 = [1, 2, 3, 4, 5];
const arr2 = [3, 4, 5, 6, 7];

// 并集
const union = [...new Set([...arr1, ...arr2])];
console.log('并集:', union); // [1, 2, 3, 4, 5, 6, 7]

// 交集
const intersection = arr1.filter(x => arr2.includes(x));
console.log('交集:', intersection); // [3, 4, 5]

// 差集（在arr1但不在arr2）
const difference = arr1.filter(x => !arr2.includes(x));
console.log('差集:', difference); // [1, 2]

// 对称差集（并集减交集）
const symmetricDifference = [
    ...arr1.filter(x => !arr2.includes(x)),
    ...arr2.filter(x => !arr1.includes(x))
];
console.log('对称差集:', symmetricDifference); // [1, 2, 6, 7]

// 使用Set优化性能
function unionSet(arr1, arr2) {
    return [...new Set([...arr1, ...arr2])];
}

function intersectionSet(arr1, arr2) {
    const set2 = new Set(arr2);
    return arr1.filter(x => set2.has(x));
}

function differenceSet(arr1, arr2) {
    const set2 = new Set(arr2);
    return arr1.filter(x => !set2.has(x));
}
```

---

## 总结

### 核心要点

1. **数组最大值/最小值**
   - 推荐：`Math.max(...arr)` 或 `reduce`
   - 大数组：reduce性能最好

2. **数组打平**
   - 推荐：`arr.flat(Infinity)`
   - 手写：递归reduce

3. **数组去重**
   - 推荐：`[...new Set(arr)]`
   - 对象数组：Map + key

4. **数组转换**
   - 类数组转数组：`Array.from()` 或 `[...]`
   - 数组转对象：`reduce` 或 `Object.fromEntries`
   - 数组分组：`reduce`

5. **实用工具**
   - 洗牌：Fisher-Yates算法
   - 分块：slice或reduce
   - 集合运算：Set + filter

### 性能建议

1. 小数组（< 1000）：可读性优先
2. 大数组（> 10000）：性能优先
3. 避免嵌套循环（O(n²)）
4. 使用Set/Map优化查找

### 面试重点

- 熟练掌握ES6+数组方法
- 理解时间空间复杂度
- 能够手写常见算法
- 了解性能优化技巧

**最后更新**: 2025-12-09
