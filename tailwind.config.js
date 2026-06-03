/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        primary: '#111111', // Target primary text/action dark
        secondary: '#888888', // Muted secondary text
        accent: '#4CAF72', // Target Sage Green
        highlight: '#EAF4EC', // Right panel / mint light green
        surface: '#FFFFFF',
        page: '#F5F5F5', // Light page background
        border: '#E0E0E0', // Explicit thin gray border
        cta: '#111111', // Re-aligning old CTA alias to dark action
        background: '#F5F5F5', // Align standard BG token
        text: '#111111',
        success: '#4CAF72', // Re-mapping success states to sage
      },
      boxShadow: {
        // Explicitly suppress all shadow utilities per no-shadow mandate
        'sm': 'none',
        'md': 'none',
        'lg': 'none',
        'xl': 'none',
      },
      backgroundImage: {
        // Suppress dynamic gradient overrides
        'metallic-dark': 'none',
        'metallic-blue': 'none',
        'glass': 'none',
      }
    }
  },
  plugins: [],
}
