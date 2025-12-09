/**
 * 插件系统使用示例
 */

import { PluginManager } from './src/PluginManager';
import { LoggerPlugin } from './examples/LoggerPlugin';
import { CachePlugin } from './examples/CachePlugin';
import { ValidationPlugin } from './examples/ValidationPlugin';
import { TransformPlugin } from './examples/TransformPlugin';

// 创建插件管理器实例
const manager = new PluginManager();

// 注册钩子
manager.registerHook('beforeStart', 'sync');
manager.registerHook('start', 'sync');
manager.registerHook('validate', 'bail'); // 熔断钩子
manager.registerHook('beforeProcess', 'sync');
manager.registerHook('transform', 'waterfall'); // 瀑布流钩子
manager.registerHook('afterProcess', 'sync');
manager.registerHook('error', 'sync');
manager.registerHook('beforeStop', 'sync');
manager.registerHook('stop', 'sync');

// 注册插件
manager.use(
  new LoggerPlugin({
    logLevel: 'debug',
    prefix: '[App]',
  })
);

manager.use(
  new CachePlugin({
    maxSize: 50,
    ttl: 30000,
  })
);

manager.use(
  new ValidationPlugin({
    rules: {
      name: {
        required: true,
        type: 'string',
      },
      age: {
        required: true,
        type: 'number',
        min: 0,
        max: 150,
      },
      email: {
        required: false,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
    },
    strictMode: false,
  })
);

manager.use(
  new TransformPlugin({
    transformers: [
      // 第一个转换器：添加时间戳
      (data: any) => {
        return {
          ...data,
          timestamp: Date.now(),
        };
      },
      // 第二个转换器：转换名字为大写
      (data: any) => {
        return {
          ...data,
          name: data.name ? data.name.toUpperCase() : data.name,
        };
      },
    ],
  })
);

// 模拟应用生命周期
async function run() {
  try {
    console.log('\n========== 应用启动 ==========\n');

    // 启动前
    manager.callSync('beforeStart', { mode: 'development' });

    // 启动
    manager.callSync('start', { port: 3000 });

    console.log('\n========== 处理有效数据 ==========\n');

    // 处理数据
    const validData = {
      name: 'Alice',
      age: 25,
      email: 'alice@example.com',
    };

    // 存储原始数据到上下文
    manager.setContext('originalData', validData);

    // 验证
    const validationResult = manager.callBail('validate', validData);

    if (validationResult && !validationResult.valid) {
      console.error('数据验证失败:', validationResult.errors);
    } else {
      // 处理前
      manager.callSync('beforeProcess', validData);

      // 检查是否有缓存
      const cachedResult = manager.getContext().cachedResult;
      let result: any;

      if (cachedResult) {
        result = cachedResult;
        console.log('使用缓存结果:', result);
      } else {
        // 转换数据（瀑布流）
        result = manager.callWaterfall('transform', validData);
        console.log('转换后的数据:', result);

        // 模拟数据处理
        result.processed = true;
      }

      // 处理后
      manager.callSync('afterProcess', result);
    }

    console.log('\n========== 再次处理相同数据（测试缓存） ==========\n');

    // 再次处理相同数据，应该命中缓存
    manager.setContext('originalData', validData);
    manager.callSync('beforeProcess', validData);
    const cachedResult2 = manager.getContext().cachedResult;
    if (cachedResult2) {
      console.log('第二次使用缓存:', cachedResult2);
      manager.callSync('afterProcess', cachedResult2);
    }

    console.log('\n========== 处理无效数据 ==========\n');

    // 处理无效数据
    const invalidData = {
      name: 'Bob',
      age: 200, // 超出范围
      email: 'invalid-email',
    };

    const validationResult2 = manager.callBail('validate', invalidData);

    if (validationResult2 && !validationResult2.valid) {
      console.error('数据验证失败:', validationResult2.errors);
    }

    console.log('\n========== 应用停止 ==========\n');

    // 停止前
    manager.callSync('beforeStop');

    // 停止
    manager.callSync('stop');
  } catch (error) {
    manager.callSync('error', error);
  }
}

// 运行示例
run();

console.log('\n========== 插件信息 ==========\n');
console.log(
  '已注册的插件:',
  manager.getPlugins().map((p) => p.name)
);
console.log('已注册的钩子:', Array.from(manager.getHooks().keys()));
