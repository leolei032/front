/**
 * 插件系统类型定义
 */

// 钩子类型（精简版 tapable）
export type HookType =
  | 'sync'
  | 'asyncSeries'
  | 'asyncParallel'
  | 'waterfall'
  | 'bail';

// 钩子回调函数类型
export type HookCallback<T = any, R = any> = (...args: T[]) => R;

// 异步钩子回调
export type AsyncHookCallback<T = any, R = any> = (...args: T[]) => Promise<R>;

// 瀑布流钩子回调
export type WaterfallHookCallback<T = any> = (value: T) => T;

// 熔断钩子回调
export type BailHookCallback<T = any, R = any> = (...args: T[]) => R | undefined;

// 钩子回调配置
export interface HookCallbackConfig<T = any, R = any> {
  callback: HookCallback<T, R>;
  priority: number;
}

// 钩子配置
export interface Hook<T = any, R = any> {
  type: HookType;
  callbacks: HookCallbackConfig<T, R>[];
}

// 插件上下文
export interface PluginContext {
  [key: string]: any;
}

// 插件接口
export interface IPlugin {
  name: string;
  apply(manager: IPluginManager): void;
  initialize?(): void;
  destroy?(): void;
}

// 插件管理器接口
export interface IPluginManager {
  // 插件管理
  use(plugin: IPlugin): this;
  remove(plugin: IPlugin): this;
  clear(): this;
  getPlugins(): IPlugin[];

  // 钩子管理
  registerHook(hookName: string, type: HookType): this;
  tap<T = any, R = any>(
    hookName: string,
    callback: HookCallback<T, R>,
    priority?: number
  ): this;
  getHooks(): Map<string, Hook>;

  // 钩子调用
  callSync<T = any>(hookName: string, ...args: T[]): void;
  callAsync<T = any>(hookName: string, ...args: T[]): Promise<void>;
  callWaterfall<T = any>(hookName: string, initialValue: T): T;
  callBail<T = any, R = any>(hookName: string, ...args: T[]): R | undefined;

  // 上下文管理
  getContext(): PluginContext;
  setContext(key: string, value: any): this;
}

// 插件选项基类
export interface PluginOptions {
  [key: string]: any;
}

// 验证规则
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any, data: any) => boolean | string;
}

// 验证规则集
export interface ValidationRules {
  [field: string]: ValidationRule;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 转换函数
export type Transformer<T = any> = (data: T) => T;
