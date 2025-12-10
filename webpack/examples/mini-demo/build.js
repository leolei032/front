// 直接使用源码运行，依赖 ts-node 做即时编译
require("ts-node/register/transpile-only");

const path = require("path");
const { Compiler } = require("../../mini-webpack/src/Compiler");
const { LoggerPlugin } = require("../../mini-webpack/plugins/LoggerPlugin");
const { TimePlugin } = require("../../mini-webpack/plugins/TimePlugin");

const root = __dirname;

const config = {
  mode: "development",
  entry: path.join(root, "src/index.js"),
  output: {
    path: path.join(root, "dist"),
    filename: "bundle.js",
  },
  rules: [
    {
      test: /\.js$/,
      use: [
        path.join(
          root,
          "../../mini-webpack/examples/loaders/uppercaseLoader.ts"
        ),
        path.join(root, "../../mini-webpack/examples/loaders/bannerLoader.ts"),
      ],
    },
  ],
  plugins: [new LoggerPlugin({ name: "MiniWebpack" }), new TimePlugin()],
};

async function run() {
  const compiler = new Compiler(config);
  const assets = await compiler.run();
  console.log("[mini-demo] build assets:", Object.keys(assets));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
