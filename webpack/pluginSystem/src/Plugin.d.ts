/**
 * 插件基类
 * 提供插件的基本结构和通用方法
 */
import type { IPlugin, IPluginManager, PluginOptions } from '../types';
export declare abstract class Plugin<T extends PluginOptions = PluginOptions> implements IPlugin {
    readonly name: string;
    protected options: T;
    constructor(options?: T);
    /**
     * 插件的入口方法
     * 必须由子类实现
     * @param manager - 插件管理器实例
     */
    abstract apply(manager: IPluginManager): void;
    /**
     * 获取插件配置
     */
    protected getOption<K extends keyof T>(key: K, defaultValue?: T[K]): T[K];
    /**
     * 插件初始化钩子（可选）
     */
    initialize?(): void;
    /**
     * 插件销毁钩子（可选）
     */
    destroy?(): void;
}
