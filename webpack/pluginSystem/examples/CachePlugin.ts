/**
 * 缓存插件 - 示例插件
 * 提供缓存功能，避免重复处理相同的数据
 */

import { Plugin } from '../src/Plugin';
import type { IPluginManager, PluginOptions } from '../types';

interface CachePluginOptions extends PluginOptions {
  maxSize?: number;
  ttl?: number;
}

interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
}

export class CachePlugin extends Plugin<CachePluginOptions> {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(options: CachePluginOptions = {}) {
    super(options);
    this.maxSize = this.getOption('maxSize', 100)!;
    this.ttl = this.getOption('ttl', 60000)!; // 默认缓存 60 秒
  }

  apply(manager: IPluginManager): void {
    // 在处理前检查缓存
    manager.tap('beforeProcess', (data: any) => {
      const cacheKey = this.getCacheKey(data);
      const cached = this.get(cacheKey);

      if (cached !== null) {
        console.log(`[CachePlugin] 命中缓存: ${cacheKey}`);
        // 将缓存结果存入上下文
        manager.setContext('cachedResult', cached);
      }
    }, 5);

    // 在处理后存储缓存
    manager.tap('afterProcess', (result: any) => {
      const context = manager.getContext();
      const data = context.originalData;

      if (data && !context.cachedResult) {
        const cacheKey = this.getCacheKey(data);
        this.set(cacheKey, result);
        console.log(`[CachePlugin] 缓存结果: ${cacheKey}`);
      }

      // 清理上下文
      delete context.cachedResult;
      delete context.originalData;
    }, 5);
  }

  private getCacheKey(data: any): string {
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }

  private set<T>(key: string, value: T): void {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  private get<T = any>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  public clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.clear();
  }
}
