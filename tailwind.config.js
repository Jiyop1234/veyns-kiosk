/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        veyns: {
          bg: "#071F19",       // Dark Emerald / Obsidian
          surface: "#0B0D0C",  // Charcoal / Deep Forest Surface
          gold: "#D4AF37",     // Antique Gold Accent
          brat: "#8ACE00",     // Vivid / Brat Green CTA Button
          text: "#F5F5F0"      // Ivory / Champagne Text
        }
      }
    }
  },
  plugins: []
}