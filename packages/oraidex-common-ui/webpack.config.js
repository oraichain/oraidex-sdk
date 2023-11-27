const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const webpack = require("webpack");
require("dotenv").config();

const isDevelopment = process.env.NODE_ENV === "development";
const plugins = [new webpack.DefinePlugin({}), new webpack.ProvidePlugin({})];
const entry = {};
const sassUsages = [];
plugins.push(
  new MiniCssExtractPlugin({
    filename: "css/index.css"
  })
);
sassUsages.push({
  loader: MiniCssExtractPlugin.loader,
  options: {
    publicPath: ""
  }
});
entry.main = "./src/index.ts";

module.exports = {
  entry,
  devtool: isDevelopment ? "eval-source-map" : "source-map",
  mode: isDevelopment ? "development" : "production",
  target: "web",
  output: {
    path: path.resolve(__dirname, "dist/umd/"),
    filename: "[name].js",
    libraryTarget: "umd",
    globalObject: `typeof self !== 'undefined' ? self : this`,
    publicPath: ""
  },
  externals: {
    react: {
      commonjs: "react",
      commonjs2: "react",
      amd: "react",
      root: "React",
      umd: "react"
    },
    "react-dom": {
      commonjs: "react-dom",
      commonjs2: "react-dom",
      amd: "react-dom",
      root: "ReactDOM",
      umd: "react-dom"
    }
  },
  optimization: !isDevelopment
    ? {
        minimize: true,
        minimizer: [new TerserPlugin({ extractComments: false }), new CssMinimizerPlugin()]
      }
    : {},
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    modules: [path.resolve(__dirname, "."), "node_modules"],
    fallback: {
      fs: false
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /(node_modules|bower_components|dist)/,
        use: {
          loader: "babel-loader",
          options: {
            cacheDirectory: true,
            presets: [
              [
                require.resolve("@babel/preset-react"),
                {
                  runtime: "automatic"
                }
              ],
              "@babel/preset-typescript",
              [
                "@babel/preset-env",
                {
                  targets: {
                    browsers: ["last 2 Chrome versions"]
                  }
                }
              ]
            ],

            plugins: ["@babel/plugin-proposal-class-properties"].filter(Boolean)
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: "file-loader",
            options: {
              esModule: false,
              publicPath: ""
            }
          }
        ]
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: "@svgr/webpack"
          }
        ]
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          ...sassUsages,
          // Creates `style` nodes from JS strings
          // 'style-loader',
          // Translates CSS into CommonJS
          {
            loader: "css-loader",
            options: {
              modules: {
                // mode: 'local',
                auto: true,
                localIdentName: "[name]__[local]--[hash:base64:5]"
              }
            }
          },
          // Compiles Sass to CSS
          "sass-loader"
        ]
      }
    ]
  },
  plugins
};
