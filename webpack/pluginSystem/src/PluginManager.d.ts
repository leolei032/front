/**
 * 插件管理器 - 核心类
 * 负责插件的注册、生命周期管理和钩子调用
 */
import type { HookType, Hook, HookCallback, PluginContext, IPlugin, IPluginManager } from "../types";
export declare class PluginManager implements IPluginManager {
    private plugins;
    private hooks;
    private context;
    /**
     * 注册钩子
     * @param hookName - 钩子名称
     * @param type - 钩子类型: 'sync' | 'asyncSeries' | 'asyncParallel' | 'waterfall' | 'bail'
     */
    registerHook(hookName: string, type: HookType): this;
    /**
     * 注册插件
     * @param plugin - 插件实例
     */
    use(plugin: IPlugin): this;
    /**
     * 订阅钩子
     * @param hookName - 钩子名称
     * @param callback - 回调函数
     * @param priority - 优先级（数字越小越先执行）
     */
    tap<T = any, R = any>(hookName: string, callback: HookCallback<T, R>, priority?: number): this;
    /**
     * 调用同步钩子
     * @param hookName - 钩子名称
     * @param args - 传递给钩子的参数
     */
    callSync<T = any>(hookName: string, ...args: T[]): void;
    /**
     * 调用异步钩子（串行或并行取决于类型）
     * @param hookName - 钩子名称
     * @param args - 传递给钩子的参数
     */
    callAsync<T = any>(hookName: string, ...args: T[]): Promise<void>;
    /**
     * 调用瀑布流钩子（结果会传递给下一个）
     * @param hookName - 钩子名称
     * @param initialValue - 初始值
     * @returns 最终处理后的值
     */
    callWaterfall<T = any>(hookName: string, initialValue: T): T;
    /**
     * 调用熔断钩子（有返回值则停止执行）
     * @param hookName - 钩子名称
     * @param args - 传递给钩子的参数
     * @returns 第一个非 undefined 的返回值
     */
    callBail<T = any, R = any>(hookName: string, ...args: T[]): R | undefined;
    /**
     * 获取上下文
     */
    getContext(): PluginContext;
    /**
     * 设置上下文
     */
    setContext(key: string, value: any): this;
    /**
     * 获取所有已注册的插件
     */
    getPlugins(): IPlugin[];
    /**
     * 获取所有钩子
     */
    getHooks(): Map<string, Hook>;
    /**
     * 移除插件
     */
    remove(plugin: IPlugin): this;
    /**
     * 清空所有插件
     */
    clear(): this;
}
