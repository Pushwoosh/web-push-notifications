var path = require('path');
module.exports = {
  module: {
    noParse: /node_modules\/localforage\/dist\/localforage.js/,
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
    path: path.join(__dirname, 'lib'),
    filename: 'pushwoosh-[name].js'
  }
};
