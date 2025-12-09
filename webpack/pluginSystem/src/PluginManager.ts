/**
 * 插件管理器 - 核心类
 * 负责插件的注册、生命周期管理和钩子调用
 */

import type {
  HookType,
  Hook,
  HookCallback,
  PluginContext,
  IPlugin,
  IPluginManager,
} from '../types';

export class PluginManager implements IPluginManager {
  private plugins: IPlugin[] = [];
  private hooks: Map<string, Hook> = new Map();
  private context: PluginContext = {};

  /**
   * 注册钩子
   * @param hookName - 钩子名称
   * @param type - 钩子类型: 'sync' | 'async' | 'waterfall' | 'bail'
   */
  registerHook(hookName: string, type: HookType = 'sync'): this {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, {
        type,
        callbacks: [],
      });
    }
    return this;
  }

  /**
   * 注册插件
   * @param plugin - 插件实例
   */
  use(plugin: IPlugin): this {
    if (typeof plugin.apply !== 'function') {
      throw new Error('Plugin must have an "apply" method');
    }

    // 检查是否已注册
    if (this.plugins.includes(plugin)) {
      console.warn('Plugin already registered:', plugin.name || 'Anonymous');
      return this;
    }

    this.plugins.push(plugin);

    // 调用插件的初始化方法
    if (plugin.initialize) {
      plugin.initialize();
    }

    // 调用插件的 apply 方法，传入当前管理器实例
    plugin.apply(this);

    return this;
  }

  /**
   * 订阅钩子
   * @param hookName - 钩子名称
   * @param callback - 回调函数
   * @param priority - 优先级（数字越小越先执行）
   */
  tap<T = any, R = any>(
    hookName: string,
    callback: HookCallback<T, R>,
    priority: number = 10
  ): this {
    if (!this.hooks.has(hookName)) {
      this.registerHook(hookName);
    }

    const hook = this.hooks.get(hookName)!;
    hook.callbacks.push({ callback, priority });

    // 按优先级排序
    hook.callbacks.sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * 调用同步钩子
   * @param hookName - 钩子名称
   * @param args - 传递给钩子的参数
   */
  callSync<T = any>(hookName: string, ...args: T[]): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    if (hook.type !== 'sync') {
      throw new Error(`Hook "${hookName}" is not a sync hook`);
    }

    for (const { callback } of hook.callbacks) {
      callback(...args);
    }
  }

  /**
   * 调用异步钩子（并行）
   * @param hookName - 钩子名称
   * @param args - 传递给钩子的参数
   */
  async callAsync<T = any>(hookName: string, ...args: T[]): Promise<void> {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    if (hook.type !== 'async') {
      throw new Error(`Hook "${hookName}" is not an async hook`);
    }

    await Promise.all(
      hook.callbacks.map(({ callback }) => callback(...args))
    );
  }

  /**
   * 调用瀑布流钩子（结果会传递给下一个）
   * @param hookName - 钩子名称
   * @param initialValue - 初始值
   * @returns 最终处理后的值
   */
  callWaterfall<T = any>(hookName: string, initialValue: T): T {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return initialValue;
    }

    if (hook.type !== 'waterfall') {
      throw new Error(`Hook "${hookName}" is not a waterfall hook`);
    }

    let result = initialValue;
    for (const { callback } of hook.callbacks) {
      result = callback(result);
    }

    return result;
  }

  /**
   * 调用熔断钩子（有返回值则停止执行）
   * @param hookName - 钩子名称
   * @param args - 传递给钩子的参数
   * @returns 第一个非 undefined 的返回值
   */
  callBail<T = any, R = any>(hookName: string, ...args: T[]): R | undefined {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return undefined;
    }

    if (hook.type !== 'bail') {
      throw new Error(`Hook "${hookName}" is not a bail hook`);
    }

    for (const { callback } of hook.callbacks) {
      const result = callback(...args);
      if (result !== undefined) {
        return result as R;
      }
    }

    return undefined;
  }

  /**
   * 获取上下文
   */
  getContext(): PluginContext {
    return this.context;
  }

  /**
   * 设置上下文
   */
  setContext(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  /**
   * 获取所有已注册的插件
   */
  getPlugins(): IPlugin[] {
    return [...this.plugins];
  }

  /**
   * 获取所有钩子
   */
  getHooks(): Map<string, Hook> {
    return new Map(this.hooks);
  }

  /**
   * 移除插件
   */
  remove(plugin: IPlugin): this {
    const index = this.plugins.indexOf(plugin);
    if (index > -1) {
      // 调用插件的销毁方法
      if (plugin.destroy) {
        plugin.destroy();
      }
      this.plugins.splice(index, 1);
    }
    return this;
  }

  /**
   * 清空所有插件
   */
  clear(): this {
    // 调用所有插件的销毁方法
    for (const plugin of this.plugins) {
      if (plugin.destroy) {
        plugin.destroy();
      }
    }
    this.plugins = [];
    this.hooks.clear();
    this.context = {};
    return this;
  }
}
