import { Plugin } from "../src/pluginSystem/Plugin";
import type { IPluginManager, PluginOptions } from "../src/pluginSystem/types";

interface LoggerPluginOptions extends PluginOptions {
  name?: string;
}

const coreHooks: Array<keyof IPluginManager | string> = [
  'beforeRun',
  'run',
  'beforeCompile',
  'compile',
  'make',
  'emit',
  'done',
];

export class LoggerPlugin extends Plugin<LoggerPluginOptions> {
  apply(manager: IPluginManager): void {
    const prefix = this.getOption('name', 'MiniWebpack')!;

    coreHooks.forEach((hookName) => {
      manager.tap(hookName, () => {
        console.log(`[${prefix}] -> ${String(hookName)}`);
      }, 1);
    });
  }
}

