import type { Config } from 'tailwindcss';

// Cast to any to accommodate optional plugins like daisyui in this environment
const config: any = {
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
  plugins: [],
  daisyui: {
    themes: [
      {
        dark: {
          "primary": "#FF4500",
          "primary-content": "#ffffff",
          "secondary": "#7193FF",
          "secondary-content": "#ffffff",
          "accent": "#4FBCFF",
          "accent-content": "#ffffff",
          "neutral": "#343536",
          "neutral-content": "#D7DADC",
          "base-100": "#1B1A18",
          "base-200": "#11100F",
          "base-300": "#24221F",
          "base-content": "#D7DADC",
          "info": "#4FBCFF",
          "success": "#46D160",
          "warning": "#FFA500",
          "error": "#FF4444",
        },
      },
    ],
  },
};

export default config;
