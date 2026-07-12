/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Apple system stack — renders SF Pro on Apple platforms, graceful fallback elsewhere.
        sf: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Apple dark-mode system materials & colors (HIG).
        apple: {
          bg: '#1c1c1e',       // window / base background
          bg2: '#2c2c2e',      // grouped content cells (elevated)
          bg3: '#3a3a3c',      // controls / fills
          sep: 'rgba(255,255,255,0.10)',
          label: '#ffffff',
          label2: 'rgba(235,235,245,0.62)',
          label3: 'rgba(235,235,245,0.32)',
          blue: '#0a84ff',
          green: '#30d158',
          red: '#ff453a',
          orange: '#ff9f0a',
          yellow: '#ffd60a',
          purple: '#bf5af2',
          indigo: '#5e5ce6',
          teal: '#40c8e0',
          gray: '#8e8e93',
        },
      },
      borderRadius: {
        apple: '10px',
        'apple-lg': '14px',
        'apple-xl': '20px',
      },
    },
  },
  plugins: [],
}
