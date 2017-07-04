const path = require('path');
const webpack = require('webpack');

const argv = process.argv;
const apiUrlIndex = argv.indexOf('--api');
const apiUrlValue = ~apiUrlIndex ? argv[apiUrlIndex + 1] : '';

const isProduction = process.env.NODE_ENV === 'production';

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
    extensions: ['', '.ts'],
    modulesDirectories: ['src', 'node_modules']
  },
  module: {
    loaders: [{
      test: /\.ts$/, loaders: ['ts-loader']
    }]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin(defines),
    isProduction && new webpack.optimize.UglifyJsPlugin(uglifyOptions)
  ].filter(x => x)
};
