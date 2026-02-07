import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif']
      },
      colors: {
        canvas: '#030303',
        surface: '#1A1A1B',
        'surface-hover': '#2A2A2B',
        highlight: '#272729',
        'border-default': '#343536',
        'border-hover': '#818384',
        'text-primary': '#D7DADC',
        'text-secondary': '#818384',
        'text-muted': '#6B6C6D',
        upvote: '#FF4500',
        downvote: '#7193FF',
        'accent-link': '#4FBCFF',
        'accent-online': '#46D160',
        'ai-badge-bg': '#1A3A4A',
        'ai-badge-text': '#4FBCFF',
      }
    }
  },
  plugins: []
};

export default config;
