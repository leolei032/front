import fs from 'fs';
import path from 'path';
import { PluginManager } from "./pluginSystem/PluginManager";
import type { IPlugin } from "./pluginSystem/types";
import type {
  Assets,
  DependencyEdge,
  LoaderItem,
  MiniWebpackConfig,
  ModuleInfo,
  Rule,
} from './types';
import { runLoaders } from './loaderRunner';

export class Compiler {
  private config: MiniWebpackConfig;
  private pluginManager: PluginManager;
  private modules: Map<string, ModuleInfo> = new Map();
  private assets: Assets = {};
  private rootContext: string;
  private entryId: string = '';

  constructor(config: MiniWebpackConfig) {
    this.config = config;
    this.rootContext = path.dirname(config.entry);
    this.pluginManager = new PluginManager();
    this.registerCoreHooks();
    (config.plugins || []).forEach((p) => this.usePlugin(p));
  }

  private registerCoreHooks() {
    this.pluginManager
      .registerHook('beforeRun', 'sync')
      .registerHook('run', 'sync')
      .registerHook('beforeCompile', 'sync')
      .registerHook('compile', 'sync')
      .registerHook('make', 'asyncSeries')
      .registerHook('emit', 'asyncSeries')
      .registerHook('done', 'sync');
  }

  private usePlugin(plugin: IPlugin) {
    this.pluginManager.use(plugin);
  }

  async run(): Promise<Assets> {
    this.pluginManager.callSync('beforeRun', this);
    this.pluginManager.callSync('run', this);
    this.pluginManager.callSync('beforeCompile', this);
    this.pluginManager.callSync('compile', this);
    await this.pluginManager.callAsync('make', this);
    const modules = await this.make();
    await this.emit(modules);
    this.pluginManager.callSync('done', { assets: this.assets, modules });
    return this.assets;
  }

  private async make(): Promise<ModuleInfo[]> {
    const entry = path.resolve(this.config.entry);
    this.entryId = this.createModuleId(entry);
    await this.buildModule(entry);
    return Array.from(this.modules.values());
  }

  private async buildModule(resource: string): Promise<void> {
    if (this.modules.has(resource)) {
      return;
    }

    const rawSource = fs.readFileSync(resource, 'utf-8');
    const { loaders, loaderNames } = this.collectLoaders(resource);

    const { code, applied } = await runLoaders({
      resourcePath: resource,
      source: rawSource,
      loaders,
      rootContext: this.rootContext,
      mode: this.config.mode ?? 'development',
      emitFile: (name, content) => {
        this.assets[name] = content;
      },
    });

    const deps = this.parseDependencies(code, resource);
    const mapping: Record<string, string> = {};
    deps.forEach((dep) => {
      mapping[dep.request] = dep.id;
    });

    const mod: ModuleInfo = {
      id: this.createModuleId(resource),
      resource,
      source: rawSource,
      transformed: code,
      dependencies: deps,
      mapping,
      loaders: applied,
    };

    this.modules.set(resource, mod);

    for (const dep of deps) {
      await this.buildModule(dep.resolved);
    }
  }

  private collectLoaders(resource: string): {
    loaders: LoaderItem[];
    loaderNames: string[];
  } {
    const rules = this.config.rules ?? [];
    const matched: LoaderItem[] = [];
    for (const rule of rules) {
      if (rule.test.test(resource)) {
        matched.push(...rule.use);
      }
    }
    return { loaders: matched, loaderNames: matched.map((l) => String(l)) };
  }

  private parseDependencies(code: string, resource: string): DependencyEdge[] {
    const deps: DependencyEdge[] = [];
    const dir = path.dirname(resource);
    const importRegex = /import\s+[^'"]*['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

    const addDep = (request: string) => {
      if (!request.startsWith('./') && !request.startsWith('../')) {
        return;
      }
      const resolved = this.resolveModule(dir, request);
      const id = this.createModuleId(resolved);
      deps.push({ request, resolved, id });
    };

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(code))) {
      addDep(match[1]);
    }
    while ((match = requireRegex.exec(code))) {
      addDep(match[1]);
    }

    return deps;
  }

  private resolveModule(context: string, request: string): string {
    const withoutExt = path.resolve(context, request);
    const withJs = `${withoutExt}.js`;
    if (fs.existsSync(withoutExt) && fs.statSync(withoutExt).isFile()) {
      return withoutExt;
    }
    if (fs.existsSync(withJs)) {
      return withJs;
    }
    return withoutExt;
  }

  private createModuleId(resource: string): string {
    const rel = path.relative(this.rootContext, resource);
    return rel.startsWith('.') ? rel : `./${rel.replace(/\\/g, '/')}`;
  }

  private async emit(modules: ModuleInfo[]): Promise<void> {
    const bundle = this.renderBundle(modules);
    const outFile = path.join(
      this.config.output.path,
      this.config.output.filename
    );
    this.assets[this.config.output.filename] = bundle;
    // 确保目录存在
    fs.mkdirSync(this.config.output.path, { recursive: true });
    fs.writeFileSync(outFile, bundle, 'utf-8');
    await this.pluginManager.callAsync('emit', {
      assets: this.assets,
      output: outFile,
    });
  }

  private renderBundle(modules: ModuleInfo[]): string {
    const modulesCode = modules
      .map((m) => {
        const fnBody = m.transformed;
        return `'${m.id}': [
  function(require, module, exports) {
${fnBody}
  },
  ${JSON.stringify(m.mapping, null, 2)}
]`;
      })
      .join(',\n');

    return `(function(modules) {
  const cache = {};
  function localRequire(id) {
    if (cache[id]) return cache[id].exports;
    const [fn, mapping] = modules[id];
    function resolve(request) {
      return mapping[request];
    }
    const module = { exports: {} };
    cache[id] = module;
    fn((req) => localRequire(resolve(req)), module, module.exports);
    return module.exports;
  }
  localRequire('${this.entryId}');
})({
${modulesCode}
});`;
  }
}

