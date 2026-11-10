import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1B1F4B", dark: "#0E1130", 50: "#EBECF6", 100: "#C9CBE6" },
        amber: { DEFAULT: "#FFB703", 50: "#FFF3D1" },
        ai: { DEFAULT: "#E63973", 50: "#FDE7EF" },
        ink: { DEFAULT: "#14152B", 2: "#475467", 3: "#98A2B3" },
        line: "#EFE4D2",
        bg: "#FFF8EC",
        danger: { DEFAULT: "#E5484D", 50: "#FDECEC" },
        info: { DEFAULT: "#2F6FED", 50: "#EAF1FE" },
        busy: { DEFAULT: "#F97316", 50: "#FFF0E5" },
        teal: "#12A39A",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        urdu: ["var(--font-nastaliq)", "serif"],
      },
      boxShadow: {
        card: "0 6px 20px -4px rgba(16,24,40,.07)",
        modal: "0 24px 60px -8px rgba(16,24,40,.2)",
      },
      borderRadius: { "4xl": "28px" },
    },
  },
  plugins: [],
};
export default config;
