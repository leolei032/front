# Webpack 面试题库

## 1. webpack介绍

### 解答

Webpack是一个现代JavaScript应用程序的静态模块打包工具。

#### 核心概念

**1. Entry（入口）**
```javascript
module.exports = {
  entry: './src/index.js'
};

// 多入口
module.exports = {
  entry: {
    app: './src/app.js',
    vendor: './src/vendor.js'
  }
};
```

**2. Output（输出）**
```javascript
const path = require('path');

module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  }
};

// 多出口
module.exports = {
  entry: {
    app: './src/app.js',
    vendor: './src/vendor.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js'
  }
};
```

**3. Loader（加载器）**
```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource'
      }
    ]
  }
};
```

**4. Plugin（插件）**
```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    })
  ]
};
```

#### 完整配置示例
```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production', // 'development' | 'production'

  entry: './src/index.js',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true // 清理输出目录
  },

  module: {
    rules: [
      // JavaScript
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      // CSS
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      // 图片
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[hash][ext][query]'
        }
      },
      // 字体
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource'
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    })
  ],

  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },

  devServer: {
    static: './dist',
    hot: true,
    port: 3000
  }
};
```

## 2. 常用的plugins

### 解答

Webpack插件扩展了webpack的功能。

#### 常用插件清单

**1. HtmlWebpackPlugin - 生成HTML文件**
```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true
      },
      inject: 'body' // script标签注入位置
    })
  ]
};
```

**2. MiniCssExtractPlugin - 提取CSS到单独文件**
```javascript
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css'
    })
  ]
};
```

**3. CleanWebpackPlugin - 清理构建目录**
```javascript
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  plugins: [
    new CleanWebpackPlugin()
  ]
};

// Webpack 5可以使用内置的clean选项
module.exports = {
  output: {
    clean: true
  }
};
```

**4. DefinePlugin - 定义环境变量**
```javascript
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'API_URL': JSON.stringify('https://api.example.com'),
      'FEATURE_FLAG': true
    })
  ]
};

// 代码中使用
console.log(process.env.NODE_ENV); // 'production'
console.log(API_URL); // 'https://api.example.com'
```

**5. CopyWebpackPlugin - 复制文件**
```javascript
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public', to: 'dist' },
        { from: 'src/assets', to: 'assets' }
      ]
    })
  ]
};
```

**6. CompressionWebpackPlugin - Gzip压缩**
```javascript
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = {
  plugins: [
    new CompressionPlugin({
      test: /\.(js|css|html)$/,
      threshold: 10240, // 只压缩超过10KB的文件
      minRatio: 0.8
    })
  ]
};
```

**7. BundleAnalyzerPlugin - 包分析**
```javascript
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ]
};
```

**8. HotModuleReplacementPlugin - 热更新**
```javascript
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  devServer: {
    hot: true
  }
};
```

**9. TerserPlugin - JS压缩**
```javascript
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true // 移除console
          }
        }
      })
    ]
  }
};
```

**10. CssMinimizerPlugin - CSS压缩**
```javascript
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      `...`, // 保留默认minimizer
      new CssMinimizerPlugin()
    ]
  }
};
```

**11. ProvidePlugin - 自动加载模块**
```javascript
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      React: 'react'
    })
  ]
};

// 现在可以直接使用$和jQuery，无需import
$('#app').html('Hello');
```

**12. ESLintWebpackPlugin - ESLint检查**
```javascript
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = {
  plugins: [
    new ESLintPlugin({
      extensions: ['js', 'jsx'],
      fix: true
    })
  ]
};
```

## 3. pm2怎么做进程管理，进程挂掉怎么处理

### 解答

PM2是Node.js的进程管理工具，用于保持应用持续运行。

#### PM2基础使用

**启动应用**
```bash
# 启动应用
pm2 start app.js

# 指定应用名称
pm2 start app.js --name "my-app"

# 启动多个实例（cluster模式）
pm2 start app.js -i 4  # 4个实例
pm2 start app.js -i max  # CPU核心数个实例

# 监听文件变化，自动重启
pm2 start app.js --watch
```

**查看进程**
```bash
# 查看所有进程
pm2 list
pm2 ls

# 查看详细信息
pm2 show <app_name|id>

# 查看日志
pm2 logs
pm2 logs <app_name>
```

**管理进程**
```bash
# 停止
pm2 stop <app_name|id>
pm2 stop all

# 重启
pm2 restart <app_name|id>
pm2 restart all

# 删除
pm2 delete <app_name|id>
pm2 delete all

# 重载（0秒停机时间）
pm2 reload <app_name>
```

#### 进程挂掉的处理

**1. 自动重启**
```bash
# PM2默认会自动重启挂掉的进程

# 配置文件 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 4,
    exec_mode: 'cluster',

    // 自动重启配置
    autorestart: true,  // 自动重启
    max_restarts: 10,   // 最大重启次数
    min_uptime: '10s',  // 最小运行时间
    max_memory_restart: '500M',  // 内存超限重启

    // 异常重启延迟
    restart_delay: 4000,  // 延迟4秒重启

    // 定时重启
    cron_restart: '0 0 * * *',  // 每天0点重启

    // 错误日志
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};

// 使用配置文件启动
pm2 start ecosystem.config.js
```

**2. 错误监控**
```javascript
// app.js
const pm2 = require('pm2');

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 通知PM2
  pm2.connect((err) => {
    if (err) return;
    pm2.list((err, apps) => {
      console.log('Apps:', apps);
    });
  });
});

// 捕获Promise reject
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
```

**3. 健康检查**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',

    // 健康检查
    wait_ready: true,  // 等待应用ready信号
    listen_timeout: 3000,

    // 杀死超时
    kill_timeout: 5000,

    // 启动前钩子
    pre_start: 'npm run check-env',

    // 启动后钩子
    post_start: 'echo "App started"'
  }]
};

// app.js中发送ready信号
const express = require('express');
const app = express();

app.listen(3000, () => {
  console.log('Server is running');

  // 通知PM2应用已准备好
  if (process.send) {
    process.send('ready');
  }
});
```

**4. 集群模式容错**
```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 4,  // 4个实例
    exec_mode: 'cluster',

    // 即使一个实例挂掉，其他实例继续服务
    // PM2会自动重启挂掉的实例

    // 负载均衡
    instance_var: 'INSTANCE_ID',

    // 优雅重启（一个接一个重启，保持服务可用）
    wait_ready: true,
    kill_timeout: 5000
  }]
};
```

**5. 监控和告警**
```bash
# 监控CPU和内存
pm2 monit

# 安装PM2 Plus（可视化监控）
pm2 plus

# 邮件告警
pm2 install pm2-auto-pull
pm2 set pm2-auto-pull:apps "my-app"
```

**6. 日志管理**
```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',

    // 日志文件
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // 日志轮转
    log_type: 'json',
    merge_logs: true,  // 合并cluster日志

    // 自定义日志格式
    time: true
  }]
};

// 查看日志
pm2 logs --lines 100
pm2 logs --json
pm2 logs --raw

// 清空日志
pm2 flush
```

**7. 保存和恢复**
```bash
# 保存当前进程列表
pm2 save

# 开机自启
pm2 startup
pm2 save

# 恢复进程
pm2 resurrect

# 更新PM2
pm2 update
```

## 4. 不用pm2怎么做进程管理

### 解答

不使用PM2也有多种进程管理方案。

#### 1. Node.js Cluster模块
```javascript
// server.js
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Worker挂掉后重启
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    console.log('Starting a new worker');
    cluster.fork();
  });

  // 监听worker消息
  cluster.on('message', (worker, message) => {
    console.log(`Message from worker ${worker.id}:`, message);
  });

} else {
  // Workers分享TCP连接
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello World\n');
  }).listen(8000);

  console.log(`Worker ${process.pid} started`);

  // 发送消息给master
  process.send({ cmd: 'notifyRequest' });
}
```

#### 2. Forever
```bash
# 安装
npm install -g forever

# 启动
forever start app.js

# 停止
forever stop app.js
forever stopall

# 查看列表
forever list

# 查看日志
forever logs
```

**Forever配置**
```bash
# 指定日志文件
forever start -l forever.log -o out.log -e err.log app.js

# 监听文件变化
forever start -w app.js

# 最大重启次数
forever start --minUptime 1000 --spinSleepTime 1000 app.js
```

#### 3. Systemd（Linux系统服务）
```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Node.js App
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/node /var/www/myapp/app.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=myapp
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
```

**Systemd命令**
```bash
# 启动服务
sudo systemctl start myapp

# 停止服务
sudo systemctl stop myapp

# 重启服务
sudo systemctl restart myapp

# 开机自启
sudo systemctl enable myapp

# 查看状态
sudo systemctl status myapp

# 查看日志
sudo journalctl -u myapp -f
```

#### 4. Docker + Docker Compose
```yaml
# docker-compose.yml
version: '3'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always  # 自动重启
    deploy:
      replicas: 4  # 4个实例
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
```

**Docker命令**
```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f

# 扩展实例
docker-compose up -d --scale app=4
```

#### 5. Supervisor
```ini
# /etc/supervisor/conf.d/myapp.conf
[program:myapp]
command=node /var/www/myapp/app.js
directory=/var/www/myapp
autostart=true
autorestart=true
startretries=3
stderr_logfile=/var/log/myapp.err.log
stdout_logfile=/var/log/myapp.out.log
user=nodejs
environment=NODE_ENV="production"
```

**Supervisor命令**
```bash
# 更新配置
sudo supervisorctl reread
sudo supervisorctl update

# 启动
sudo supervisorctl start myapp

# 停止
sudo supervisorctl stop myapp

# 重启
sudo supervisorctl restart myapp

# 查看状态
sudo supervisorctl status
```

#### 6. 自定义守护进程
```javascript
// daemon.js
const { spawn } = require('child_process');
const path = require('path');

function startApp() {
  const appPath = path.join(__dirname, 'app.js');
  const child = spawn('node', [appPath], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref(); // 允许父进程退出

  console.log(`Started app with PID: ${child.pid}`);

  // 监控进程
  child.on('exit', (code) => {
    console.log(`App exited with code ${code}`);
    // 重启
    setTimeout(() => {
      console.log('Restarting app...');
      startApp();
    }, 1000);
  });

  return child;
}

startApp();
```

#### 7. Kubernetes（生产环境）
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 4  # 4个实例
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        ports:
        - containerPort: 3000
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:  # 健康检查
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### 各方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|-----|------|------|---------|
| PM2 | 功能全面，易用 | 额外依赖 | 开发、生产 |
| Cluster | 原生支持 | 功能有限 | 简单应用 |
| Forever | 简单轻量 | 功能少 | 简单场景 |
| Systemd | 系统级，稳定 | Linux only | Linux生产 |
| Docker | 隔离性好 | 学习成本 | 容器化部署 |
| Supervisor | 稳定可靠 | 配置复杂 | 传统部署 |
| K8s | 强大，可扩展 | 复杂 | 大规模生产 |

## 5. master挂了pm2怎么处理

### 解答

PM2的master进程（守护进程）挂掉的处理方式。

#### PM2架构
```
┌─────────────────┐
│  PM2 Daemon     │  <- Master进程
│  (守护进程)      │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼──┐ ┌───▼──┐ ┌───▼──┐ ┌───▼──┐
│App-1 │ │App-2 │ │App-3 │ │App-4 │  <- Worker进程
└──────┘ └──────┘ └──────┘ └──────┘
```

#### Master挂掉的情况

**1. PM2 Daemon自动重启**
```bash
# PM2的守护进程会自动重启
# 如果PM2进程意外退出，systemd/init会重启它

# 设置PM2开机自启（推荐）
pm2 startup
# 这会创建系统服务来管理PM2

# 保存当前进程列表
pm2 save

# 现在即使PM2 daemon挂掉，系统也会自动重启它
```

**2. 检查PM2运行状态**
```bash
# 检查PM2是否运行
pm2 status

# 如果PM2没运行，手动启动
pm2 resurrect  # 恢复之前保存的进程列表

# 或者重新启动应用
pm2 start ecosystem.config.js
```

**3. PM2 Daemon监控**
```javascript
// monitor-pm2.js
const { exec } = require('child_process');

function checkPM2() {
  exec('pm2 status', (error, stdout, stderr) => {
    if (error) {
      console.error('PM2 is not running!');
      console.log('Restarting PM2...');

      // 尝试恢复PM2
      exec('pm2 resurrect', (err) => {
        if (err) {
          console.error('Failed to restart PM2:', err);
          // 发送告警通知
          sendAlert('PM2 daemon is down!');
        } else {
          console.log('PM2 restarted successfully');
        }
      });
    }
  });
}

// 每30秒检查一次
setInterval(checkPM2, 30000);

function sendAlert(message) {
  // 发送邮件/短信/Slack通知
  console.log('ALERT:', message);
}
```

**4. 使用Systemd管理PM2**
```ini
# /etc/systemd/system/pm2.service
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=nodejs
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/nodejs/.pm2
PIDFile=/home/nodejs/.pm2/pm2.pid

ExecStart=/usr/local/bin/pm2 resurrect
ExecReload=/usr/local/bin/pm2 reload all
ExecStop=/usr/local/bin/pm2 kill

Restart=always

[Install]
WantedBy=multi-user.target
```

**启用systemd服务**
```bash
# 重新加载systemd
sudo systemctl daemon-reload

# 启动PM2服务
sudo systemctl start pm2

# 开机自启
sudo systemctl enable pm2

# 查看状态
sudo systemctl status pm2

# 现在即使PM2 daemon挂掉，systemd会自动重启
```

**5. 双重保障方案**
```bash
# 方案1: PM2管理应用，Systemd管理PM2
pm2 startup systemd
pm2 save

# 方案2: PM2 + Monit双重监控
# 安装Monit
sudo apt-get install monit

# 配置Monit监控PM2
# /etc/monit/conf.d/pm2
check process pm2 with pidfile /home/nodejs/.pm2/pm2.pid
  start program = "/usr/local/bin/pm2 resurrect" as uid nodejs
  stop program = "/usr/local/bin/pm2 kill" as uid nodejs
  if 5 restarts within 5 cycles then timeout
  if failed port 80 protocol http then restart
```

#### Worker进程保护

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 4,
    exec_mode: 'cluster',

    // Worker保护
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',

    // 即使PM2 daemon短暂挂掉
    // Worker进程也会继续运行（不会立即退出）

    // 优雅关闭
    kill_timeout: 5000,
    wait_ready: true,

    // 健康检查
    listen_timeout: 3000
  }]
};
```

#### 最佳实践

**1. 多层防护**
```
┌─────────────────────┐
│   Systemd/Init      │  <- 第1层：操作系统级别
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   PM2 Daemon        │  <- 第2层：进程管理器
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Application       │  <- 第3层：应用进程
│   (Cluster Mode)    │
└─────────────────────┘
```

**2. 监控告警**
```javascript
// health-check.js
const http = require('http');
const { exec } = require('child_process');

// 检查应用健康
function checkAppHealth() {
  http.get('http://localhost:3000/health', (res) => {
    if (res.statusCode !== 200) {
      console.error('App unhealthy!');
      // 重启应用
      exec('pm2 restart my-app');
    }
  }).on('error', (err) => {
    console.error('App not responding!', err);
    // 检查PM2状态
    checkPM2Status();
  });
}

function checkPM2Status() {
  exec('pm2 list', (error) => {
    if (error) {
      console.error('PM2 is down!');
      // 发送告警
      sendAlert('CRITICAL: PM2 daemon is down!');
      // 尝试重启
      exec('pm2 resurrect');
    }
  });
}

// 每分钟检查
setInterval(checkAppHealth, 60000);
```

**3. 日志和备份**
```bash
# 定期保存PM2状态
*/5 * * * * pm2 save

# 备份PM2配置
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.backup

# 保存日志
pm2 logs --json > pm2-logs-$(date +%Y%m%d).json
```

## 6. 如何解决跨域问题

### 解答

Webpack开发环境中解决跨域的方法。

#### 1. Webpack Dev Server代理
```javascript
// webpack.config.js
module.exports = {
  devServer: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        pathRewrite: {
          '^/api': ''  // 重写路径
        }
      }
    }
  }
};

// 前端请求
fetch('/api/users')  // 实际请求: http://localhost:8080/users
  .then(res => res.json());
```

**多个代理配置**
```javascript
module.exports = {
  devServer: {
    proxy: {
      // API代理
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        secure: false,  // 支持https
        pathRewrite: { '^/api': '' }
      },

      // WebSocket代理
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      },

      // 多个路径代理到同一目标
      context: ['/auth', '/user'],
      target: 'http://localhost:3001'
    }
  }
};
```

**高级代理配置**
```javascript
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,

        // 自定义请求头
        onProxyReq: (proxyReq, req, res) => {
          proxyReq.setHeader('X-Custom-Header', 'value');
          console.log('Proxying:', req.method, req.url);
        },

        // 自定义响应
        onProxyRes: (proxyRes, req, res) => {
          console.log('Response:', proxyRes.statusCode);
        },

        // 条件代理
        bypass: (req, res, proxyOptions) => {
          if (req.headers.accept.indexOf('html') !== -1) {
            return '/index.html';  // 返回HTML而不代理
          }
        }
      }
    }
  }
};
```

#### 2. CORS头设置（服务器端）
```javascript
// Express服务器
const express = require('express');
const app = express();

// 方法1: 手动设置CORS头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// 方法2: 使用cors中间件
const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:3000',  // 允许的源
  credentials: true,  // 允许cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 动态origin
app.use(cors({
  origin: (origin, callback) => {
    const whitelist = ['http://localhost:3000', 'https://example.com'];
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
```

#### 3. JSONP（仅限GET请求）
```javascript
// 客户端
function jsonp(url, callback) {
  const script = document.createElement('script');
  const callbackName = 'jsonp_' + Date.now();

  window[callbackName] = (data) => {
    callback(data);
    document.body.removeChild(script);
    delete window[callbackName];
  };

  script.src = `${url}?callback=${callbackName}`;
  document.body.appendChild(script);
}

// 使用
jsonp('http://api.example.com/data', (data) => {
  console.log(data);
});

// 服务器端
app.get('/data', (req, res) => {
  const callback = req.query.callback;
  const data = { name: 'John', age: 25 };

  res.send(`${callback}(${JSON.stringify(data)})`);
});
```

#### 4. Nginx反向代理
```nginx
server {
  listen 80;
  server_name example.com;

  # 前端资源
  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }

  # API代理
  location /api/ {
    proxy_pass http://backend:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # CORS头
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE';
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization';

    # 预检请求
    if ($request_method = 'OPTIONS') {
      return 204;
    }
  }
}
```

#### 5. PostMessage（跨域iframe通信）
```javascript
// 父页面
const iframe = document.getElementById('myIframe');

// 发送消息
iframe.contentWindow.postMessage({
  type: 'getData',
  payload: { id: 123 }
}, 'http://other-domain.com');

// 接收消息
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://other-domain.com') {
    return;  // 验证来源
  }

  console.log('Received:', event.data);
});

// iframe页面
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://parent-domain.com') {
    return;
  }

  const { type, payload } = event.data;

  if (type === 'getData') {
    // 发送响应
    event.source.postMessage({
      type: 'dataResponse',
      payload: { data: 'Some data' }
    }, event.origin);
  }
});
```

#### 6. webpack配置环境变量
```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify(
        process.env.NODE_ENV === 'production'
          ? 'https://api.example.com'
          : 'http://localhost:8080'
      )
    })
  ],

  devServer: {
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
};

// 代码中使用
fetch(`${process.env.API_URL}/api/users`);
```

#### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|-----|------|------|---------|
| Webpack代理 | 开发简单 | 仅开发环境 | 开发阶段 |
| CORS | 标准方案 | 需服务器配置 | 生产环境 |
| JSONP | 兼容性好 | 仅GET请求 | 老浏览器 |
| Nginx代理 | 性能好 | 需配置服务器 | 生产环境 |
| PostMessage | 安全 | 仅iframe | iframe通信 |

