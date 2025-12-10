import type { IPlugin } from "./pluginSystem/types";

export type HookName =
  | 'beforeRun'
  | 'run'
  | 'beforeCompile'
  | 'compile'
  | 'make'
  | 'emit'
  | 'done';

export type Mode = 'development' | 'production';

export interface LoaderContext {
  resourcePath: string;
  rootContext: string;
  mode: Mode;
  addDependency(file: string): void;
  emitFile(name: string, content: string): void;
  getOptions<T = any>(): T;
  async(): (err: any, result?: string) => void;
}

export type Loader = (
  this: LoaderContext,
  source: string
) => string | Promise<string> | void;

export type LoaderItem = Loader | string;

export interface Rule {
  test: RegExp;
  use: LoaderItem[];
}

export interface OutputOptions {
  path: string;
  filename: string;
}

export interface MiniWebpackConfig {
  entry: string;
  output: OutputOptions;
  rules?: Rule[];
  plugins?: IPlugin[];
  mode?: Mode;
}

export interface DependencyEdge {
  request: string;
  resolved: string;
  id: string;
}

export interface ModuleInfo {
  id: string;
  resource: string;
  source: string;
  transformed: string;
  dependencies: DependencyEdge[];
  mapping: Record<string, string>;
  loaders: string[];
}

export type Assets = Record<string, string>;

