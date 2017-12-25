const path = require('path');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');


const apiUrlValue = process.env.API_URL || '';

const defines = {
  __VERSION__: JSON.stringify(require('./package.json').version),
  __API_URL__: JSON.stringify(apiUrlValue)
};

const uglifyOptions = {
  beautify: false,
  mangle: true
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
    extensions: ['.ts'],
    modules: ['src', 'node_modules']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['ts-loader']
      },
      {
        test: /\.css$/,
        use: [ 'to-string-loader', 'css-loader', 'postcss-loader' ]
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(['lib']),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin(defines),
    new webpack.optimize.UglifyJsPlugin(uglifyOptions)
  ]
};
