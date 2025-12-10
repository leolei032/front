import path from 'path';
import type { Loader, LoaderContext, LoaderItem } from './types';

const isPromise = (value: any): value is Promise<unknown> =>
  !!value && typeof value.then === 'function';

function resolveLoader(loader: LoaderItem, contextDir: string): Loader {
  if (typeof loader === 'function') {
    return loader;
  }
  const abs = path.isAbsolute(loader)
    ? loader
    : path.join(contextDir, loader);
  // Node 会根据 ts-node 注册按需编译 .ts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(abs);
  return mod.default || mod;
}

export async function runLoaders(options: {
  resourcePath: string;
  source: string;
  loaders: LoaderItem[];
  rootContext: string;
  mode: 'development' | 'production';
  emitFile: (name: string, content: string) => void;
}): Promise<{ code: string; applied: string[] }> {
  const { resourcePath, source, loaders, rootContext, mode, emitFile } =
    options;
  let code = source;
  const applied: string[] = [];
  const contextDir = rootContext;

  for (let i = loaders.length - 1; i >= 0; i--) {
    const loader = resolveLoader(loaders[i], contextDir);
    applied.push(typeof loaders[i] === 'string' ? String(loaders[i]) : loader.name || 'anonymousLoader');

    code = await runSingleLoader(loader, code, {
      resourcePath,
      rootContext,
      mode,
      emitFile,
      addDependency: () => {
        /* no-op in mini version */
      },
      getOptions: <T = any>() => ({} as T),
      async() {
        let done: (err: any, result?: string) => void;
        const promise = new Promise<string>((resolve, reject) => {
          done = (err: any, result?: string) => {
            if (err) {
              reject(err);
            } else {
              resolve(result ?? code);
            }
          };
        });
        return done!;
      },
    });
  }

  return { code, applied };
}

async function runSingleLoader(
  loader: Loader,
  input: string,
  context: LoaderContext
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let sync = true;
    let doneCalled = false;

    const done = (err: any, result?: string) => {
      if (doneCalled) return;
      doneCalled = true;
      if (err) return reject(err);
      resolve(result ?? input);
    };

    const asyncCallback = () => {
      sync = false;
      return done;
    };

    const enrichedContext: LoaderContext = {
      ...context,
      async: asyncCallback,
    };

    try {
      const result = loader.call(enrichedContext, input);
      if (!sync) {
        return;
      }
      if (isPromise(result)) {
        result
          .then((res) => done(null, res as string))
          .catch((err) => done(err));
      } else {
        done(null, (result as string) ?? input);
      }
    } catch (error) {
      reject(error);
    }
  });
}

