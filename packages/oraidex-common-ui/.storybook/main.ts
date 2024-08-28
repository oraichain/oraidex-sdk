import type { StorybookConfig } from "@storybook/react-webpack5";

const fallback = {
  fs: false,
  tls: false,
  net: false,
  os: false,
  url: false,
  path: false,
  assert: false,
  querystring: false,
  http: require.resolve("stream-http"),
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  https: require.resolve("https-browserify"),
  vm: require.resolve("vm-browserify")
};

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-links", "@storybook/addon-essentials", "@storybook/addon-interactions"],
  framework: {
    name: "@storybook/react-webpack5",
    options: {}
  },
  docs: {
    autodocs: "tag"
  },
  webpackFinal: (config) => {
    if (config?.resolve) {
      // @ts-ignore
      config.resolve.fallback = { ...fallback };
    }

    return config;
  },
  staticDirs: ["../public"]
};
export default config;
