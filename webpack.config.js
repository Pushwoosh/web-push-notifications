var path = require('path');
var webpack = require('webpack');

var production = process.env.NODE_ENV === 'production';

var defines = {
  __VERSION__: JSON.stringify(require("./package.json").version)
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
