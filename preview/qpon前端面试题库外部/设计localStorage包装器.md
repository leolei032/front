# 设计localStorage包装器

## 1. 基础localStorage API回顾

```javascript
// 原生localStorage API
// 1. 设置值
localStorage.setItem('key', 'value');

// 2. 获取值
const value = localStorage.getItem('key');

// 3. 删除值
localStorage.removeItem('key');

// 4. 清空所有
localStorage.clear();

// 5. 获取key
const key = localStorage.key(0);

// 6. 长度
const length = localStorage.length;

// 原生API的局限性：
// 1. 只能存储字符串
// 2. 没有过期时间
// 3. 没有容量限制控制
// 4. 没有命名空间
// 5. 没有事件通知
// 6. 没有加密
// 7. 可能抛出异常（满容量、隐私模式）
```

## 2. 基础包装器实现

### 支持对象存储

```javascript
// 基础版本：支持对象存储和自动序列化/反序列化
class StorageWrapper {
  constructor(storage = localStorage) {
    this.storage = storage;
  }

  // 设置值
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Failed to set item:', error);
      return false;
    }
  }

  // 获取值
  get(key, defaultValue = null) {
    try {
      const item = this.storage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error('Failed to get item:', error);
      return defaultValue;
    }
  }

  // 删除值
  remove(key) {
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove item:', error);
      return false;
    }
  }

  // 清空所有
  clear() {
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  // 检查key是否存在
  has(key) {
    return this.storage.getItem(key) !== null;
  }

  // 获取所有keys
  keys() {
    return Object.keys(this.storage);
  }

  // 获取存储大小（估算）
  size() {
    let size = 0;
    for (let key in this.storage) {
      if (this.storage.hasOwnProperty(key)) {
        size += this.storage[key].length + key.length;
      }
    }
    return size;
  }
}

// 使用
const storage = new StorageWrapper();

// 存储对象
storage.set('user', { name: 'John', age: 30 });

// 获取对象
const user = storage.get('user');
console.log(user);  // { name: 'John', age: 30 }

// 存储数组
storage.set('items', [1, 2, 3, 4, 5]);

// 获取数组
const items = storage.get('items');
console.log(items);  // [1, 2, 3, 4, 5]

// 获取不存在的key
const data = storage.get('nonexistent', { default: 'value' });
console.log(data);  // { default: 'value' }
```

## 3. 添加过期时间功能

### 时间戳方案

```javascript
class StorageWithExpiry extends StorageWrapper {
  // 设置值（带过期时间）
  set(key, value, expiryInSeconds = null) {
    try {
      const item = {
        value,
        expiry: expiryInSeconds
          ? Date.now() + expiryInSeconds * 1000
          : null
      };

      const serialized = JSON.stringify(item);
      this.storage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Failed to set item:', error);
      return false;
    }
  }

  // 获取值（检查过期）
  get(key, defaultValue = null) {
    try {
      const item = this.storage.getItem(key);
      if (item === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);

      // 检查是否过期
      if (parsed.expiry && Date.now() > parsed.expiry) {
        this.remove(key);
        return defaultValue;
      }

      return parsed.value;
    } catch (error) {
      console.error('Failed to get item:', error);
      return defaultValue;
    }
  }

  // 清理过期项
  clearExpired() {
    const keys = this.keys();
    let cleared = 0;

    keys.forEach(key => {
      try {
        const item = this.storage.getItem(key);
        const parsed = JSON.parse(item);

        if (parsed.expiry && Date.now() > parsed.expiry) {
          this.remove(key);
          cleared++;
        }
      } catch (error) {
        // 忽略解析错误
      }
    });

    return cleared;
  }

  // 获取剩余时间（秒）
  getTTL(key) {
    try {
      const item = this.storage.getItem(key);
      if (item === null) {
        return -1;
      }

      const parsed = JSON.parse(item);

      if (!parsed.expiry) {
        return Infinity;  // 永不过期
      }

      const remaining = parsed.expiry - Date.now();
      return remaining > 0 ? Math.floor(remaining / 1000) : 0;
    } catch (error) {
      return -1;
    }
  }

  // 更新过期时间
  touch(key, expiryInSeconds) {
    const value = this.get(key);
    if (value === null) {
      return false;
    }
    return this.set(key, value, expiryInSeconds);
  }
}

// 使用
const storage = new StorageWithExpiry();

// 设置10秒后过期
storage.set('session', { token: 'abc123' }, 10);

// 立即获取
console.log(storage.get('session'));  // { token: 'abc123' }

// 11秒后获取
setTimeout(() => {
  console.log(storage.get('session'));  // null (已过期)
}, 11000);

// 获取剩余时间
console.log(storage.getTTL('session'));  // 约10秒

// 清理所有过期项
storage.clearExpired();
```

## 4. 添加容量限制和LRU淘汰

### LRU（Least Recently Used）实现

```javascript
class StorageWithLRU extends StorageWithExpiry {
  constructor(storage = localStorage, maxSize = 5 * 1024 * 1024) {  // 默认5MB
    super(storage);
    this.maxSize = maxSize;
    this.accessMap = this.loadAccessMap();
  }

  // 加载访问记录
  loadAccessMap() {
    try {
      const map = this.storage.getItem('__access_map__');
      return map ? JSON.parse(map) : {};
    } catch (error) {
      return {};
    }
  }

  // 保存访问记录
  saveAccessMap() {
    try {
      this.storage.setItem('__access_map__', JSON.stringify(this.accessMap));
    } catch (error) {
      console.error('Failed to save access map:', error);
    }
  }

  // 记录访问
  recordAccess(key) {
    this.accessMap[key] = Date.now();
    this.saveAccessMap();
  }

  // 设置值（检查容量）
  set(key, value, expiryInSeconds = null) {
    const item = {
      value,
      expiry: expiryInSeconds ? Date.now() + expiryInSeconds * 1000 : null
    };

    const serialized = JSON.stringify(item);
    const size = new Blob([serialized]).size;

    // 检查单个项是否超过最大容量
    if (size > this.maxSize) {
      console.error('Item size exceeds maximum storage size');
      return false;
    }

    // 检查总容量
    while (this.size() + size > this.maxSize) {
      // 淘汰最少使用的项
      const lruKey = this.findLRU();
      if (lruKey) {
        this.remove(lruKey);
      } else {
        break;
      }
    }

    try {
      this.storage.setItem(key, serialized);
      this.recordAccess(key);
      return true;
    } catch (error) {
      // 存储失败，尝试清理过期项
      this.clearExpired();

      try {
        this.storage.setItem(key, serialized);
        this.recordAccess(key);
        return true;
      } catch (retryError) {
        console.error('Failed to set item after cleanup:', retryError);
        return false;
      }
    }
  }

  // 获取值（更新访问时间）
  get(key, defaultValue = null) {
    const value = super.get(key, defaultValue);

    if (value !== defaultValue) {
      this.recordAccess(key);
    }

    return value;
  }

  // 找出最少使用的key
  findLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, time] of Object.entries(this.accessMap)) {
      if (key === '__access_map__') continue;

      if (time < lruTime) {
        lruTime = time;
        lruKey = key;
      }
    }

    return lruKey;
  }

  // 删除值（清理访问记录）
  remove(key) {
    const result = super.remove(key);
    delete this.accessMap[key];
    this.saveAccessMap();
    return result;
  }

  // 获取存储使用率
  getUsage() {
    return {
      used: this.size(),
      max: this.maxSize,
      percentage: (this.size() / this.maxSize * 100).toFixed(2) + '%'
    };
  }
}

// 使用
const storage = new StorageWithLRU(localStorage, 1024 * 100);  // 100KB限制

// 存储多个项
for (let i = 0; i < 100; i++) {
  storage.set(`item${i}`, { data: 'x'.repeat(1000) });
}

// 检查使用率
console.log(storage.getUsage());

// 访问某些项（更新访问时间）
storage.get('item0');
storage.get('item1');
storage.get('item2');

// 继续存储，会淘汰最少使用的项
storage.set('newItem', { data: 'new data' });
```

## 5. 添加命名空间支持

### 多租户隔离

```javascript
class NamespacedStorage extends StorageWithLRU {
  constructor(namespace = 'default', storage = localStorage, maxSize = 5 * 1024 * 1024) {
    super(storage, maxSize);
    this.namespace = namespace;
  }

  // 生成带命名空间的key
  getNamespacedKey(key) {
    return `${this.namespace}:${key}`;
  }

  // 设置值
  set(key, value, expiryInSeconds = null) {
    return super.set(this.getNamespacedKey(key), value, expiryInSeconds);
  }

  // 获取值
  get(key, defaultValue = null) {
    return super.get(this.getNamespacedKey(key), defaultValue);
  }

  // 删除值
  remove(key) {
    return super.remove(this.getNamespacedKey(key));
  }

  // 检查key是否存在
  has(key) {
    return super.has(this.getNamespacedKey(key));
  }

  // 获取命名空间下的所有keys
  keys() {
    const prefix = `${this.namespace}:`;
    return super.keys()
      .filter(key => key.startsWith(prefix))
      .map(key => key.substring(prefix.length));
  }

  // 清空命名空间
  clear() {
    const keys = this.keys();
    keys.forEach(key => this.remove(key));
    return true;
  }

  // 获取命名空间大小
  size() {
    const keys = this.keys();
    let size = 0;

    keys.forEach(key => {
      const namespacedKey = this.getNamespacedKey(key);
      const item = this.storage.getItem(namespacedKey);
      if (item) {
        size += item.length + namespacedKey.length;
      }
    });

    return size;
  }

  // 创建子命名空间
  createNamespace(subNamespace) {
    return new NamespacedStorage(
      `${this.namespace}:${subNamespace}`,
      this.storage,
      this.maxSize
    );
  }
}

// 使用
// 用户A的存储
const userAStorage = new NamespacedStorage('userA');
userAStorage.set('preferences', { theme: 'dark' });
userAStorage.set('cart', [1, 2, 3]);

// 用户B的存储
const userBStorage = new NamespacedStorage('userB');
userBStorage.set('preferences', { theme: 'light' });
userBStorage.set('cart', [4, 5, 6]);

// 互不干扰
console.log(userAStorage.get('preferences'));  // { theme: 'dark' }
console.log(userBStorage.get('preferences'));  // { theme: 'light' }

// 子命名空间
const userACache = userAStorage.createNamespace('cache');
userACache.set('data', { cached: true });
```

## 6. 添加事件通知

### 观察者模式

```javascript
class ObservableStorage extends NamespacedStorage {
  constructor(namespace = 'default', storage = localStorage, maxSize = 5 * 1024 * 1024) {
    super(namespace, storage, maxSize);
    this.listeners = {};
  }

  // 设置值（触发事件）
  set(key, value, expiryInSeconds = null) {
    const oldValue = this.get(key);
    const result = super.set(key, value, expiryInSeconds);

    if (result) {
      this.emit('change', { key, oldValue, newValue: value, type: 'set' });
      this.emit(`change:${key}`, { oldValue, newValue: value });
    }

    return result;
  }

  // 删除值（触发事件）
  remove(key) {
    const oldValue = this.get(key);
    const result = super.remove(key);

    if (result) {
      this.emit('change', { key, oldValue, newValue: null, type: 'remove' });
      this.emit(`change:${key}`, { oldValue, newValue: null });
    }

    return result;
  }

  // 清空（触发事件）
  clear() {
    const keys = this.keys();
    const result = super.clear();

    if (result) {
      this.emit('clear', { keys });
    }

    return result;
  }

  // 订阅事件
  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(listener);

    // 返回取消订阅函数
    return () => {
      this.off(event, listener);
    };
  }

  // 取消订阅
  off(event, listener) {
    if (!this.listeners[event]) return;

    const index = this.listeners[event].indexOf(listener);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  // 触发事件
  emit(event, data) {
    if (!this.listeners[event]) return;

    this.listeners[event].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  // 监听跨标签页变化
  enableCrossTabSync() {
    window.addEventListener('storage', (e) => {
      // 只处理当前命名空间的变化
      if (e.key && e.key.startsWith(`${this.namespace}:`)) {
        const key = e.key.substring(this.namespace.length + 1);

        try {
          const oldValue = e.oldValue ? JSON.parse(e.oldValue).value : null;
          const newValue = e.newValue ? JSON.parse(e.newValue).value : null;

          this.emit('crossTab', { key, oldValue, newValue });
          this.emit(`crossTab:${key}`, { oldValue, newValue });
        } catch (error) {
          console.error('Failed to parse storage event:', error);
        }
      }
    });
  }
}

// 使用
const storage = new ObservableStorage('app');

// 订阅所有变化
storage.on('change', ({ key, oldValue, newValue, type }) => {
  console.log(`Storage changed: ${key} from ${oldValue} to ${newValue} (${type})`);
});

// 订阅特定key的变化
const unsubscribe = storage.on('change:user', ({ oldValue, newValue }) => {
  console.log('User changed:', oldValue, '->', newValue);
});

// 修改值
storage.set('user', { name: 'John' });
// 输出: "Storage changed: user from null to [object Object] (set)"
// 输出: "User changed: null -> { name: 'John' }"

// 取消订阅
unsubscribe();

// 启用跨标签页同步
storage.enableCrossTabSync();

storage.on('crossTab:user', ({ oldValue, newValue }) => {
  console.log('User changed in another tab:', oldValue, '->', newValue);
});
```

## 7. 添加加密支持

### 简单加密实现

```javascript
class EncryptedStorage extends ObservableStorage {
  constructor(
    namespace = 'default',
    encryptionKey = null,
    storage = localStorage,
    maxSize = 5 * 1024 * 1024
  ) {
    super(namespace, storage, maxSize);
    this.encryptionKey = encryptionKey;
  }

  // 简单的XOR加密（示例，实际应该使用AES等强加密）
  encrypt(text) {
    if (!this.encryptionKey) return text;

    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode);
    }

    return btoa(result);  // Base64编码
  }

  // 解密
  decrypt(encrypted) {
    if (!this.encryptionKey) return encrypted;

    try {
      const decoded = atob(encrypted);  // Base64解码
      let result = '';

      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }

      return result;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  // 设置值（加密）
  set(key, value, expiryInSeconds = null) {
    const item = {
      value,
      expiry: expiryInSeconds ? Date.now() + expiryInSeconds * 1000 : null
    };

    try {
      const serialized = JSON.stringify(item);
      const encrypted = this.encrypt(serialized);
      this.storage.setItem(this.getNamespacedKey(key), encrypted);
      this.recordAccess(key);
      this.emit('change', { key, oldValue: this.get(key), newValue: value, type: 'set' });
      return true;
    } catch (error) {
      console.error('Failed to set item:', error);
      return false;
    }
  }

  // 获取值（解密）
  get(key, defaultValue = null) {
    try {
      const encrypted = this.storage.getItem(this.getNamespacedKey(key));
      if (encrypted === null) {
        return defaultValue;
      }

      const decrypted = this.decrypt(encrypted);
      if (decrypted === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(decrypted);

      // 检查过期
      if (parsed.expiry && Date.now() > parsed.expiry) {
        this.remove(key);
        return defaultValue;
      }

      this.recordAccess(key);
      return parsed.value;
    } catch (error) {
      console.error('Failed to get item:', error);
      return defaultValue;
    }
  }
}

// 使用
const storage = new EncryptedStorage('app', 'my-secret-key');

// 存储敏感数据
storage.set('creditCard', {
  number: '1234-5678-9012-3456',
  cvv: '123'
});

// 在localStorage中是加密的
console.log(localStorage.getItem('app:creditCard'));
// 输出类似: "aGVsbG8gd29ybGQ="

// 但通过storage.get()可以正常获取
console.log(storage.get('creditCard'));
// 输出: { number: '1234-5678-9012-3456', cvv: '123' }
```

## 8. 完整的Storage类

```javascript
// 集成所有功能的完整Storage类
class AdvancedStorage extends EncryptedStorage {
  constructor(options = {}) {
    const {
      namespace = 'default',
      encryptionKey = null,
      storage = localStorage,
      maxSize = 5 * 1024 * 1024,
      enableCrossTab = false
    } = options;

    super(namespace, encryptionKey, storage, maxSize);

    if (enableCrossTab) {
      this.enableCrossTabSync();
    }

    // 定期清理过期项
    this.startAutoCleanup();
  }

  // 自动清理过期项
  startAutoCleanup(intervalMinutes = 5) {
    this.cleanupInterval = setInterval(() => {
      const cleared = this.clearExpired();
      if (cleared > 0) {
        console.log(`Cleared ${cleared} expired items`);
      }
    }, intervalMinutes * 60 * 1000);
  }

  // 停止自动清理
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // 批量操作
  setMultiple(items) {
    const results = {};
    for (const [key, value] of Object.entries(items)) {
      results[key] = this.set(key, value);
    }
    return results;
  }

  getMultiple(keys) {
    const results = {};
    keys.forEach(key => {
      results[key] = this.get(key);
    });
    return results;
  }

  removeMultiple(keys) {
    const results = {};
    keys.forEach(key => {
      results[key] = this.remove(key);
    });
    return results;
  }

  // 导出数据
  export() {
    const data = {};
    this.keys().forEach(key => {
      data[key] = this.get(key);
    });
    return data;
  }

  // 导入数据
  import(data, overwrite = false) {
    for (const [key, value] of Object.entries(data)) {
      if (overwrite || !this.has(key)) {
        this.set(key, value);
      }
    }
  }

  // 销毁
  destroy() {
    this.stopAutoCleanup();
    this.clear();
    this.listeners = {};
  }
}

// 使用示例
const storage = new AdvancedStorage({
  namespace: 'myApp',
  encryptionKey: 'my-secret-key',
  maxSize: 10 * 1024 * 1024,  // 10MB
  enableCrossTab: true
});

// 存储数据
storage.set('user', { name: 'John', age: 30 }, 3600);  // 1小时后过期
storage.set('settings', { theme: 'dark', language: 'en' });

// 批量操作
storage.setMultiple({
  'item1': { data: 'value1' },
  'item2': { data: 'value2' },
  'item3': { data: 'value3' }
});

// 监听变化
storage.on('change', ({ key, oldValue, newValue }) => {
  console.log(`${key} changed:`, oldValue, '->', newValue);
});

// 导出数据
const exported = storage.export();
console.log('Exported data:', exported);

// 导入数据
storage.import(exported);

// 获取使用情况
console.log('Storage usage:', storage.getUsage());

// 销毁
storage.destroy();
```

## 9. React Hook封装

```javascript
import { useState, useEffect, useCallback } from 'react';

function useStorage(key, initialValue, storage) {
  // 初始化state
  const [value, setValue] = useState(() => {
    return storage.get(key, initialValue);
  });

  // 更新localStorage
  const setStoredValue = useCallback((newValue) => {
    setValue(newValue);
    storage.set(key, newValue);
  }, [key, storage]);

  // 监听变化
  useEffect(() => {
    const unsubscribe = storage.on(`change:${key}`, ({ newValue }) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [key, storage]);

  // 监听跨标签页变化
  useEffect(() => {
    const unsubscribe = storage.on(`crossTab:${key}`, ({ newValue }) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [key, storage]);

  return [value, setStoredValue];
}

// 使用
function MyComponent() {
  const storage = new AdvancedStorage({ namespace: 'app' });
  const [user, setUser] = useStorage('user', null, storage);

  return (
    <div>
      <p>User: {user?.name}</p>
      <button onClick={() => setUser({ name: 'John', age: 30 })}>
        Set User
      </button>
    </div>
  );
}
```

这个完整的localStorage包装器提供了过期时间、容量限制、命名空间、事件通知、加密等功能，可以满足大部分实际项目需求！
