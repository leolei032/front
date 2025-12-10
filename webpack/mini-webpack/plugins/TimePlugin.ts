import { Plugin } from "../src/pluginSystem/Plugin";
import type { IPluginManager } from "../src/pluginSystem/types";

export class TimePlugin extends Plugin {
  private start = 0;

  apply(manager: IPluginManager): void {
    manager.tap('run', () => {
      this.start = Date.now();
    }, 1);

    manager.tap('done', () => {
      const cost = Date.now() - this.start;
      console.log(`[TimePlugin] build finished in ${cost} ms`);
    }, 1);
  }
}

