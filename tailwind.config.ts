import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0066FF', strong: '#005EEB', heavy: '#0054D1' },
        label: {
          normal: '#171719',
          neutral: '#2E2F33E0',
          alt: '#37383C9C',
          assistive: '#37383C47',
          disable: '#37383C29',
        },
        bg: { normal: '#FFFFFF', alt: '#F7F7F8' },
        line: { normal: '#E1E2E4', neutral: '#EAEBEC', strong: '#AEB0B6' },
        fill: { normal: '#70737C14', strong: '#70737C29' },
        status: { positive: '#00BF40', cautionary: '#FF9200', negative: '#FF4242' },
        accent: {
          redorange: '#FF5E00',
          lime: '#58CF04',
          cyan: '#00BDDE',
          lightblue: '#00AEFF',
          violet: '#6541F2',
          purple: '#CB59FF',
          pink: '#F553DA',
        },
      },
      borderRadius: { frame: '14px' },
      boxShadow: {
        xs: '0 1px 2px #1717171A',
        sm: '0 4px 6px #1717170F, 0 2px 4px #1717170F',
        md: '0 10px 15px #17171712, 0 4px 6px #17171712',
        lg: '0 16px 24px #17171714, 0 6px 10px #17171714',
      },
      fontFamily: {
        sans: ['"Pretendard JP"', '"Pretendard"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
