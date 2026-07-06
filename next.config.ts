import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      // glslify-loader resolves #pragma glslify directives before raw-loader exports the string.
      use: ["raw-loader", "glslify-loader"],
    });

    return config;
  },
};

export default nextConfig;
