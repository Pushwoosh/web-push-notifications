const path = require('path');
const webpack = require('webpack');

const production = process.env.NODE_ENV === 'production';

const argv = process.argv;
const api_url_index = argv.indexOf('--api');
const api_url_value = ~api_url_index ? argv[api_url_index + 1] : '';

const defines = {
  __DEV_MODE__: JSON.stringify(!production),
  __VERSION__: JSON.stringify(require("./package.json").version),
  __API_URL__: JSON.stringify(api_url_value)
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

module.exports = {
  devtool: 'source-map',
  entry: {
    'web-notifications': './src/web-notifications.ts',
    'service-worker': './src/service-worker.ts',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'pushwoosh-[name].' + (production ? '' : 'uncompress.') + 'js'
  },
  resolve: {
    extensions: ['', '.ts'],
    modulesDirectories: ['src', 'node_modules']
  },
  module: {
    /*
    preLoaders: [
      {
        test: /\.tsx?$/,
        loader: 'tslint'
      }
    ],
    */
    loaders: [{
      test: /\.ts$/, loaders: ['ts-loader']
    }]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin(defines),
    production && new webpack.optimize.UglifyJsPlugin(uglifyOptions)
  ].filter(x => x)
};
