/**
 * 日志插件 - 示例插件
 * 在各个生命周期钩子中打印日志
 */

import { Plugin } from '../src/Plugin';
import type { IPluginManager, LogLevel, PluginOptions } from '../types';

interface LoggerPluginOptions extends PluginOptions {
  logLevel?: LogLevel;
  prefix?: string;
}

export class LoggerPlugin extends Plugin<LoggerPluginOptions> {
  private logLevel: LogLevel;
  private prefix: string;
  private readonly logLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  constructor(options: LoggerPluginOptions = {}) {
    super(options);
    this.logLevel = this.getOption('logLevel', 'info')!;
    this.prefix = this.getOption('prefix', '[LoggerPlugin]')!;
  }

  apply(manager: IPluginManager): void {
    // 订阅各种钩子
    manager.tap('beforeStart', (data: any) => {
      this.log('info', '应用即将启动', data);
    }, 1);

    manager.tap('start', (data: any) => {
      this.log('info', '应用已启动', data);
    }, 1);

    manager.tap('beforeProcess', (data: any) => {
      this.log('debug', '开始处理数据', data);
    }, 1);

    manager.tap('afterProcess', (result: any) => {
      this.log('debug', '数据处理完成', result);
    }, 1);

    manager.tap('error', (error: Error) => {
      this.log('error', '发生错误', error);
    }, 1);

    manager.tap('beforeStop', () => {
      this.log('info', '应用即将停止');
    }, 1);

    manager.tap('stop', () => {
      this.log('info', '应用已停止');
    }, 1);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const currentLevelIndex = this.logLevels.indexOf(this.logLevel);
    const messageLevelIndex = this.logLevels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const logMessage = `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}`;

      const consoleMethod = console[level] || console.log;

      if (data !== undefined) {
        consoleMethod(logMessage, data);
      } else {
        consoleMethod(logMessage);
      }
    }
  }
}
