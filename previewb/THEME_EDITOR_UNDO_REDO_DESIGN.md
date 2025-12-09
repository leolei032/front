import { DependencyList, useCallback, useEffect, useRef } from 'react';
import { useActivate, useUnactivate } from 'react-activation';
import { backSystem } from '@/utils/back-event-system';
import { isDev, isTest } from '@/utils/env';
import { generateUUID } from '@/utils/tools/others';
import { logTechnicalEvent } from './useReport/reportLogInfo';

interface IOptions {
  moduleName?: string; // 可选模块名称，用于日志记录
  deps?: DependencyList; // 依赖数组合并到配置对象
}
export function useBackHandler(
  handler: () => boolean | void | Promise<boolean | void>,
  options?: IOptions
): { triggerManualBack: () => Promise<boolean>; enableIOSGesture: () => void; disableIOSGesture: () => void } {
  const { moduleName, deps = [] } = options || {};
  const handlerRef = useRef(handler);
  const handlerId = useRef<string>(`back-handler-${moduleName || 'anonymous'}-${generateUUID()}`);

  // 包装处理器：统一错误处理
  const wrappedHandler = useCallback(async () => {
    try {
      return await handlerRef.current();
    } catch (err) {
      console.error(`[BackHandler] ${handlerId.current} 执行失败:`, err);
      logTechnicalEvent({
        module: moduleName || 'unknown',
        event: 'BACK_HANDLER_ERROR',
        message: (err as Error)?.message || String(err)
      });
      return true; // 失败时继续执行后续处理器
    }
  }, []);

  // 核心注册逻辑
  const registerHandler = useCallback(() => {
    backSystem.register(wrappedHandler, handlerId.current);

    if (isDev || isTest) {
      console.debug(`[BackHandler] 注册处理器: ${handlerId.current}`);
    }
  }, [wrappedHandler]);

  // 核心注销逻辑
  const unregisterHandler = useCallback(() => {
    if (handlerId.current) {
      backSystem.unregister(handlerId.current);

      if (isDev || isTest) {
        console.debug(`[BackHandler] 注销处理器: ${handlerId.current}`);
      }
    }
  }, []);

  // 主逻辑：组件挂载/卸载
  useEffect(() => {
    handlerRef.current = handler;
    registerHandler();
    return unregisterHandler;
  }, [handler, registerHandler, unregisterHandler, ...deps]);

  // KeepAlive 场景支持（无KeepAlive的组件不会执行此Hook）
  useActivate(registerHandler);
  useUnactivate(unregisterHandler);

  // 返回手动触发方法（可选）
  const triggerManualBack = () => backSystem.triggerManualBack();
  // 返回手势控制方法
  const enableIOSGesture = () => backSystem.enableIOSGesture();
  const disableIOSGesture = () => backSystem.disableIOSGesture();
  return { triggerManualBack, enableIOSGesture, disableIOSGesture };
}
