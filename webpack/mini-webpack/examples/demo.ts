import path from 'path';
import { Compiler } from '../src/Compiler';
import type { MiniWebpackConfig } from '../src/types';
import { LoggerPlugin } from '../plugins/LoggerPlugin';
import { TimePlugin } from '../plugins/TimePlugin';

const root = __dirname;

const config: MiniWebpackConfig = {
  mode: 'development',
  entry: path.join(root, 'src/index.js'),
  output: {
    path: path.join(root, 'dist'),
    filename: 'bundle.js',
  },
  rules: [
    {
      test: /\.js$/,
      use: [
        path.join(root, 'loaders', 'uppercaseLoader.ts'),
        path.join(root, 'loaders', 'bannerLoader.ts'),
      ],
    },
  ],
  plugins: [
    new LoggerPlugin({ name: 'MiniWebpack' }),
    new TimePlugin(),
  ],
};

async function run() {
  const compiler = new Compiler(config);
  const assets = await compiler.run();
  console.log('[demo] build assets:', Object.keys(assets));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

