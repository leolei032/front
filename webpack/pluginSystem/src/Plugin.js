"use strict";
/**
 * 插件基类
 * 提供插件的基本结构和通用方法
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugin = void 0;
class Plugin {
    constructor(options = {}) {
        this.options = options;
        this.name = this.constructor.name;
    }
    /**
     * 获取插件配置
     */
    getOption(key, defaultValue) {
        return this.options[key] !== undefined
            ? this.options[key]
            : defaultValue;
    }
}
exports.Plugin = Plugin;
//# sourceMappingURL=Plugin.js.map