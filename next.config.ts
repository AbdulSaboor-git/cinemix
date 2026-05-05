import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kinopoiskapiunofficial.tech" },
      { protocol: "https", hostname: "st.kp.yandex.net" },
      { protocol: "https", hostname: "*.kinopoisk.ru" },
    ],
  },
  env: {
    NEXT_PUBLIC_KINOPOISK_API_KEY: process.env.NEXT_PUBLIC_KINOPOISK_API_KEY,
    NEXT_PUBLIC_PLAYER_BASE_URL: process.env.NEXT_PUBLIC_PLAYER_BASE_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
};

export default nextConfig;
