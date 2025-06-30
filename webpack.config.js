/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const fs = require('fs');
const path = require('path');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const { merge } = require('webpack-merge');

const config = require('./config').configBuilder;
const { stringifyObjectValues } = require('./config/helpers');

const isProduction = process.env.NODE_ENV === 'production';

const definesCommon = {
  __VERSION__: require('./package.json').version,
  __SDK_PATH__: isProduction ? 'https://cdn.pushwoosh.com/webpush/v3/' : '',
};

const devServer = {
  host: 'localhost',
  port: 8003,
};

if (config.ssl && config.ssl.key && config.ssl.cert) {
  devServer.server = {
    type: 'https',
    options: {
      key: fs.readFileSync(config.ssl.key),
      cert: fs.readFileSync(config.ssl.cert),
    },
  };
}

class RemoveUnusedTypesPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('RemoveUnusedTypesPlugin', () => {
      const outputPath = compiler.options.output.path;
      console.log(`Cleaning up unused types in ${outputPath}`);

      // Get all .d.ts files in outputPath
      const files = fs.readdirSync(outputPath);
      files.forEach((file) => {
        if (file.endsWith('.d.ts')) {
          const base = file.slice(0, -5); // remove .d.ts
          const jsFile = base + '.js';
          if (!files.includes(jsFile)) {
            // Delete .d.ts if no .js with same name
            fs.unlinkSync(path.join(outputPath, file));
            console.log(`Deleted unused type: ${file}`);
          }
        }
      });
    });
  }
}

const commonConfig = {
  mode: isProduction ? 'production' : 'development',
  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.js', '.json', '.html'],
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              declaration: isProduction,
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules\/.*/,
      },
      {
        test: /\.css$/,
        type: 'asset/source',
      },
    ],
  },

  optimization: {
    minimize: isProduction,
    minimizer: [new TerserPlugin()],
  },
};

function createWebConfig(name) {
  return merge(commonConfig, {
    name: name,

    entry: {
      'pushwoosh-web-notifications': './src/pushwoosh-web-notifications.ts',
      'pushwoosh-service-worker': './src/service-worker.ts',

      'pushwoosh-widget-inbox': './src/pushwoosh-widget-inbox.ts',
      'pushwoosh-widget-subscribe-popup': './src/pushwoosh-widget-subscribe-popup.ts',
      'pushwoosh-widget-subscription-button': './src/pushwoosh-widget-subscription-button.ts',
      'pushwoosh-widget-subscription-prompt': './src/pushwoosh-widget-subscription-prompt.ts',
    },

    output: {
      path: path.join(__dirname, `output/${name}`),
      filename: `[name].${isProduction ? '' : 'uncompress.'}js`,
      globalObject: 'this',
    },

    plugins: [
      new CleanWebpackPlugin(),
      new webpack.DefinePlugin(stringifyObjectValues({
        ...definesCommon,
        __OUTPUT__: name,
      })),
      !isProduction && new HtmlWebpackPlugin({
        inject: true,
        template: 'develop/index.html',
        externals: {
          initParams: JSON.stringify(config.initParams),
        },
        chunks: ['pushwoosh-web-notifications'],
        minify: false,
      }),
    ].filter(Boolean),

    devServer,
  });
}

const npmConfig = merge(commonConfig, {
  name: 'npm',

  entry: {
    npm: './src/npm.ts',
    'service-worker': './src/service-worker.ts',

    'widget-inbox': './src/widget-inbox.ts',
    'widget-subscribe-popup': './src/widget-subscribe-popup.ts',
    'widget-subscription-button': './src/widget-subscription-button.ts',
    'widget-subscription-prompt': './src/widget-subscription-prompt.ts',
  },

  output: {
    path: path.join(__dirname, 'output/npm'),
    filename: '[name].js',
    libraryTarget: 'umd',
    globalObject: 'this', // service worker self
  },

  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DefinePlugin(stringifyObjectValues(definesCommon)),
    new RemoveUnusedTypesPlugin(),
  ],
});

module.exports = [
  createWebConfig('cdn'),
  createWebConfig('zip'),
  npmConfig,
];
