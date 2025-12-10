import type { IPlugin, IPluginManager, PluginOptions } from "./types";

export abstract class Plugin<T extends PluginOptions = PluginOptions>
  implements IPlugin
{
  public readonly name: string;
  protected options: T;

  constructor(options: T = {} as T) {
    this.options = options;
    this.name = this.constructor.name;
  }

  /**
   * 插件入口，子类实现
   */
  abstract apply(manager: IPluginManager): void;

  /**
   * 获取插件配置
   */
  protected getOption<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
    return this.options[key] !== undefined
      ? this.options[key]
      : (defaultValue as T[K]);
  }

  /**
   * 插件初始化（可选）
   */
  initialize?(): void;

  /**
   * 插件销毁（可选）
   */
  destroy?(): void;
}

