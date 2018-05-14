const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');


const apiUrlValue = process.env.API_URL || '';

const defines = {
  __VERSION__: JSON.stringify(require('./package.json').version),
  __API_URL__: JSON.stringify(apiUrlValue)
};

const uglifyOptions = {
  beautify: true,
  mangle: false
};

function copyPublicTypes() {
  this.plugin('done', function() {
    console.log('copy types public/index.d.ts to lib/index.d.ts');
    fs.createReadStream(path.join(__dirname, 'public/index.d.ts')).pipe(fs.createWriteStream(path.join(__dirname, 'lib/index.d.ts')));
  });
}

module.exports = {
  devtool: 'source-map',
  entry: {
    index: './src/index.ts',
    'service-worker': './src/service-worker.ts',
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
    new webpack.optimize.UglifyJsPlugin(uglifyOptions),
    copyPublicTypes
  ]
};
