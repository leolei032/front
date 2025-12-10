import type {
  HookType,
  Hook,
  HookCallback,
  PluginContext,
  IPlugin,
  IPluginManager,
} from "./types";

export class PluginManager implements IPluginManager {
  private plugins: IPlugin[] = [];
  private hooks: Map<string, Hook> = new Map();
  private context: PluginContext = {};

  registerHook(hookName: string, type: HookType): this {
    const existing = this.hooks.get(hookName);
    if (existing) {
      if (existing.type !== type) {
        throw new Error(
          `Hook "${hookName}" already registered as "${existing.type}", cannot re-register as "${type}"`
        );
      }
      return this;
    }

    this.hooks.set(hookName, {
      type,
      callbacks: [],
    });
    return this;
  }

  use(plugin: IPlugin): this {
    if (typeof plugin.apply !== "function") {
      throw new Error('Plugin must have an "apply" method');
    }

    if (this.plugins.includes(plugin)) {
      console.warn("Plugin already registered:", plugin.name || "Anonymous");
      return this;
    }

    this.plugins.push(plugin);

    if (plugin.initialize) {
      plugin.initialize();
    }

    plugin.apply(this);

    return this;
  }

  tap<T = any, R = any>(
    hookName: string,
    callback: HookCallback<T, R>,
    priority: number = 10
  ): this {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      throw new Error(`Hook "${hookName}" is not registered`);
    }
    hook.callbacks.push({ callback, priority });

    hook.callbacks.sort((a, b) => a.priority - b.priority);

    return this;
  }

  callSync<T = any>(hookName: string, ...args: T[]): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    if (hook.type !== "sync") {
      throw new Error(`Hook "${hookName}" is not a sync hook`);
    }

    for (const { callback } of hook.callbacks) {
      callback(...args);
    }
  }

  async callAsync<T = any>(hookName: string, ...args: T[]): Promise<void> {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    if (hook.type === "asyncParallel") {
      await Promise.all(
        hook.callbacks.map(({ callback }) => callback(...args))
      );
      return;
    }

    if (hook.type === "asyncSeries") {
      for (const { callback } of hook.callbacks) {
        await callback(...args);
      }
      return;
    }

    throw new Error(`Hook "${hookName}" is not an async hook`);
  }

  callWaterfall<T = any>(hookName: string, initialValue: T): T {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return initialValue;
    }

    if (hook.type !== "waterfall") {
      throw new Error(`Hook "${hookName}" is not a waterfall hook`);
    }

    let result = initialValue;
    for (const { callback } of hook.callbacks) {
      result = callback(result);
    }

    return result;
  }

  callBail<T = any, R = any>(hookName: string, ...args: T[]): R | undefined {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return undefined;
    }

    if (hook.type !== "bail") {
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

  getContext(): PluginContext {
    return this.context;
  }

  setContext(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  getPlugins(): IPlugin[] {
    return [...this.plugins];
  }

  getHooks(): Map<string, Hook> {
    return new Map(this.hooks);
  }

  remove(plugin: IPlugin): this {
    const index = this.plugins.indexOf(plugin);
    if (index > -1) {
      if (plugin.destroy) {
        plugin.destroy();
      }
      this.plugins.splice(index, 1);
    }
    return this;
  }

  clear(): this {
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

