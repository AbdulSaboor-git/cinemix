import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Cinemix",
  description: "Your cinematic universe",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/icons/apple-touch-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/icons/apple-touch-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" },
      { url: "/icons/apple-touch-icon-114x114.png", sizes: "114x114", type: "image/png" },
      { url: "/icons/apple-touch-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/icons/apple-touch-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/apple-touch-icon-167x167.png", sizes: "167x167", type: "image/png" },
      { url: "/icons/apple-touch-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/safari-pinned-tab.svg", color: "#ff1a1a" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Cinemix",
    statusBarStyle: "black-translucent",
  },
};
