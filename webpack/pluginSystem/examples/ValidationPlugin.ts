/**
 * 验证插件 - 示例插件
 * 在数据处理前进行验证
 */

import { Plugin } from '../src/Plugin';
import type {
  IPluginManager,
  PluginOptions,
  ValidationRules,
  ValidationResult,
} from '../types';

interface ValidationPluginOptions extends PluginOptions {
  rules?: ValidationRules;
  strictMode?: boolean;
}

export class ValidationPlugin extends Plugin<ValidationPluginOptions> {
  private rules: ValidationRules;
  private strictMode: boolean;

  constructor(options: ValidationPluginOptions = {}) {
    super(options);
    this.rules = this.getOption('rules', {})!;
    this.strictMode = this.getOption('strictMode', false)!;
  }

  apply(manager: IPluginManager): void {
    // 使用 bail 钩子，验证失败时阻止后续执行
    manager.tap('validate', (data: Record<string, any>): ValidationResult => {
      const errors = this.validate(data);

      if (errors.length > 0) {
        const errorMessage = `验证失败: ${errors.join(', ')}`;
        console.error(`[ValidationPlugin] ${errorMessage}`);

        if (this.strictMode) {
          throw new Error(errorMessage);
        }

        // 返回错误信息，触发 bail 机制
        return { valid: false, errors };
      }

      console.log('[ValidationPlugin] 验证通过');
      return { valid: true, errors: [] };
    }, 1);
  }

  private validate(data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(this.rules)) {
      const value = data[field];

      // 必填验证
      if (
        rule.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`${field} 是必填项`);
        continue;
      }

      // 如果没有值且不是必填，跳过后续验证
      if (value === undefined || value === null) {
        continue;
      }

      // 类型验证
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} 必须是 ${rule.type} 类型`);
      }

      // 最小值验证
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${field} 不能小于 ${rule.min}`);
      }

      // 最大值验证
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${field} 不能大于 ${rule.max}`);
      }

      // 正则验证
      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors.push(`${field} 格式不正确`);
      }

      // 自定义验证函数
      if (rule.validator && typeof rule.validator === 'function') {
        const customResult = rule.validator(value, data);
        if (customResult !== true) {
          errors.push(
            typeof customResult === 'string'
              ? customResult
              : `${field} 验证失败`
          );
        }
      }
    }

    return errors;
  }
}
