/**
 * 插件系统类型定义
 */
export type HookType = 'sync' | 'asyncSeries' | 'asyncParallel' | 'waterfall' | 'bail';
export type HookCallback<T = any, R = any> = (...args: T[]) => R;
export type AsyncHookCallback<T = any, R = any> = (...args: T[]) => Promise<R>;
export type WaterfallHookCallback<T = any> = (value: T) => T;
export type BailHookCallback<T = any, R = any> = (...args: T[]) => R | undefined;
export interface HookCallbackConfig<T = any, R = any> {
    callback: HookCallback<T, R>;
    priority: number;
}
export interface Hook<T = any, R = any> {
    type: HookType;
    callbacks: HookCallbackConfig<T, R>[];
}
export interface PluginContext {
    [key: string]: any;
}
export interface IPlugin {
    name: string;
    apply(manager: IPluginManager): void;
    initialize?(): void;
    destroy?(): void;
}
export interface IPluginManager {
    use(plugin: IPlugin): this;
    remove(plugin: IPlugin): this;
    clear(): this;
    getPlugins(): IPlugin[];
    registerHook(hookName: string, type: HookType): this;
    tap<T = any, R = any>(hookName: string, callback: HookCallback<T, R>, priority?: number): this;
    getHooks(): Map<string, Hook>;
    callSync<T = any>(hookName: string, ...args: T[]): void;
    callAsync<T = any>(hookName: string, ...args: T[]): Promise<void>;
    callWaterfall<T = any>(hookName: string, initialValue: T): T;
    callBail<T = any, R = any>(hookName: string, ...args: T[]): R | undefined;
    getContext(): PluginContext;
    setContext(key: string, value: any): this;
}
export interface PluginOptions {
    [key: string]: any;
}
export interface ValidationRule {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: any, data: any) => boolean | string;
}
export interface ValidationRules {
    [field: string]: ValidationRule;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type Transformer<T = any> = (data: T) => T;
