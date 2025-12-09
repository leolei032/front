/**
 * 转换插件 - 示例插件
 * 使用 waterfall 钩子对数据进行链式转换
 */

import { Plugin } from '../src/Plugin';
import type { IPluginManager, PluginOptions, Transformer } from '../types';

interface TransformPluginOptions extends PluginOptions {
  transformers?: Transformer[];
  upperCase?: boolean;
  trim?: boolean;
}

export class TransformPlugin extends Plugin<TransformPluginOptions> {
  private transformers: Transformer[];

  constructor(options: TransformPluginOptions = {}) {
    super(options);
    this.transformers = this.getOption('transformers', [])!;
  }

  apply(manager: IPluginManager): void {
    // 注册转换钩子
    this.transformers.forEach((transformer, index) => {
      manager.tap(
        'transform',
        (data: any) => {
          console.log(`[TransformPlugin] 执行转换器 ${index + 1}`);
          return transformer(data);
        },
        index
      );
    });

    // 也可以注册一些内置的转换器
    if (this.getOption('upperCase', false)) {
      manager.tap(
        'transform',
        (data: any) => {
          if (typeof data === 'string') {
            return data.toUpperCase();
          }
          return data;
        },
        100
      );
    }

    if (this.getOption('trim', false)) {
      manager.tap(
        'transform',
        (data: any) => {
          if (typeof data === 'string') {
            return data.trim();
          }
          return data;
        },
        99
      );
    }
  }
}
