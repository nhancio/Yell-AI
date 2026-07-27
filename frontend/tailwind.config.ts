import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      colors: {
        claw: {
          dark: "#0f172a",
          accent: "#38bdf8",
          surface: "#1e293b",
          muted: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
