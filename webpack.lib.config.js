const path = require('path');
const webpack = require('webpack');

const {argv} = process;
const apiUrlIndex = argv.indexOf('--api');
const apiUrlValue = ~apiUrlIndex ? argv[apiUrlIndex + 1] : '';

const defines = {
  __VERSION__: JSON.stringify(require('./package.json').version),
  __API_URL__: JSON.stringify(apiUrlValue)
};

const uglifyOptions = {
  beautify: true,
  mangle: false
};

module.exports = {
  devtool: 'source-map',
  entry: {
    index: './src/index.ts'
  },
  output: {
    path: path.join(__dirname, 'lib'),
    filename: '[name].js',
    libraryTarget: 'umd'
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
    new webpack.optimize.UglifyJsPlugin(uglifyOptions)
  ]
};
