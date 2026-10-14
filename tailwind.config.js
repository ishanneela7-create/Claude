/** Blue + green color scheme. Colors come from CSS variables so dark mode is one switch. */
const withAlpha = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./app/index.html', './app/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: withAlpha('page'),
        surface: withAlpha('surface'),
        raised: withAlpha('raised'),
        line: withAlpha('line'),
        ink: withAlpha('ink'),
        muted: withAlpha('muted'),
        brand: withAlpha('brand'),
        'brand-ink': withAlpha('brand-ink'),
        accent: withAlpha('accent'),
        'accent-ink': withAlpha('accent-ink'),
        danger: withAlpha('danger'),
      },
    },
  },
  plugins: [],
};
