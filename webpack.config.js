const path = require('path');
const fs = require('fs');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const GenerateJsonPlugin = require('generate-json-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');


let config = {};

if (fs.existsSync('./develop/config.js')) {
  config = require('./develop/config');
}
else {
    console.log('\x1b[31m%s\x1b[0m\n', 'develop/config.js is undefined');
}

if (process.env.MANIFEST_DATA) {
  config.manifest = JSON.parse(process.env.MANIFEST_DATA);
}

if (process.env.INIT_PARAMS) {
  config.initParams = JSON.parse(process.env.INIT_PARAMS);
}

const isProduction = process.env.NODE_ENV === 'production';
const initParams = Object.assign({}, config.initParams);
if (isProduction) {
  delete initParams.driversSettings;
}

const apiUrlValue = process.env.API_URL || '';
const defines = {
  __VERSION__: JSON.stringify(require('./package.json').version),
  __API_URL__: JSON.stringify(apiUrlValue)
};

const uglifyOptions = {
  compress: {
    pure_getters: true,
    unsafe: true,
    unsafe_comps: true,
    warnings: false
  },
  mangle: true,
  output: {
    comments: false
  }
};

const devServer = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.port || '8003',
  hot: true,
  open: false,
  disableHostCheck: true,
  watchOptions: {ignored: /node_modules/}
};

if (config.ssl && config.ssl.key && config.ssl.cert) {
  devServer.https = {
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  };
}

module.exports = {
  devtool: 'source-map',
  entry: {
    'web-notifications': './src/web-notifications.ts',
    'service-worker': './src/service-worker.ts',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: `pushwoosh-[name].${isProduction ? '' : 'uncompress.'}js`
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['ts-loader']
      },
      {
        test: /\.css$/,
        use: ['to-string-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin([path.resolve(__dirname, 'dist')]),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin(defines),
    new HtmlWebpackPlugin({
      inject: true,
      template: 'develop/index.html',
      externals: {
        initParams: JSON.stringify(initParams)
      },
      excludeChunks: ['service-worker'],
      minify: false
    }),
    new ScriptExtHtmlWebpackPlugin({defaultAttribute: 'async'}),
    new GenerateJsonPlugin('manifest.json', config.manifest),

    isProduction && new webpack.optimize.UglifyJsPlugin(uglifyOptions),
    !isProduction && new webpack.HotModuleReplacementPlugin()
  ].filter(x => x),

  devServer
};
