var path = require('path');
var webpack = require('webpack');

var production = process.env.NODE_ENV === 'production';

var config = {
  module: {
    preLoaders: [{
      test: /\.js$/,
      loader: 'eslint',
      exclude: /node_modules/
    }],
    loaders: [{
      test: /\.js$/,
      loader: 'babel',
      exclude: /node_modules/
    }]
  },
  entry: {
    'web-notifications': './src/web-notifications.js',
    'service-worker': './src/service-worker.js'
  },
  // devtool: 'source-map',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'pushwoosh-[name].' + (production ? 'min.' : '') + 'js'
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    production && new webpack.optimize.UglifyJsPlugin({
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
    })
  ].filter(function (x) { return x; })
};

module.exports = config;
