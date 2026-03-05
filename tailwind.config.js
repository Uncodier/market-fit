/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-museo-moderno)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.675rem', { lineHeight: '0.9rem' }], // 0.75rem * 0.9
        sm: ['0.7875rem', { lineHeight: '1.125rem' }], // 0.875rem * 0.9
        base: ['0.9rem', { lineHeight: '1.35rem' }], // 1rem * 0.9
        lg: ['1.0125rem', { lineHeight: '1.575rem' }], // 1.125rem * 0.9
        xl: ['1.125rem', { lineHeight: '1.8rem' }], // 1.25rem * 0.9
        '2xl': ['1.35rem', { lineHeight: '2.025rem' }], // 1.5rem * 0.9
        '3xl': ['1.6875rem', { lineHeight: '2.475rem' }], // 1.875rem * 0.9
        '4xl': ['2.025rem', { lineHeight: '2.925rem' }], // 2.25rem * 0.9
        '5xl': ['2.7rem', { lineHeight: '1' }], // 3rem * 0.9
        '6xl': ['3.375rem', { lineHeight: '1' }], // 3.75rem * 0.9
        '7xl': ['4.05rem', { lineHeight: '1' }], // 4.5rem * 0.9
        '8xl': ['4.725rem', { lineHeight: '1' }], // 5.25rem * 0.9
        '9xl': ['5.625rem', { lineHeight: '1' }], // 6.25rem * 0.9
      },
      colors: {
        'primary-button': '#90ff17',
        'primary-button-hover': '#ffdc24',
        'primary-button-border': '#57921799',
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: 0, transform: "translateY(15px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: 1 },
          "50%": { transform: "scale(1.1)", opacity: 0.5 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "scroll-x": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(calc(-100% / 4), 0, 0)" },
        },
        "spin-super-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: 1, transform: "translateY(0)" },
          "50%": { opacity: 0.8, transform: "translateY(2%)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-medium": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "wave-outward": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        "pan-diagonal-fast": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "32px 32px" },
        },
        "pan-lines": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 0" },
        },
        "expand-waves": {
          "0%": { transform: "scale(1)", opacity: 0.8 },
          "100%": { transform: "scale(1.5)", opacity: 0 },
        },
        "radar-ping": {
          "0%": { transform: "translate(-50%, -50%) scale(0.1)", opacity: 0, borderWidth: "4px" },
          "50%": { opacity: 1, borderWidth: "1px" },
          "100%": { transform: "translate(-50%, -50%) scale(2)", opacity: 0, borderWidth: "0px" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-in-up-1": "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        "fade-in-up-2": "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
        "fade-in-up-3": "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
        "ping-slow": "ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "scroll-x": "scroll-x 40s linear infinite",
        "scroll-x-right": "scroll-x 40s linear infinite reverse",
        "spin-super-slow": "spin-super-slow 40s linear infinite",
        "pulse-slow": "pulse-slow 6s ease-in-out infinite",
        "float-slow": "float-slow 4s ease-in-out infinite",
        "float-medium": "float-medium 3s ease-in-out infinite",
        "wave-outward": "wave-outward 15s ease-in-out infinite",
        "pan-diagonal-fast": "pan-diagonal-fast 40s linear infinite",
        "pan-lines": "pan-lines 40s linear infinite",
        "expand-waves": "expand-waves 20s ease-out infinite",
        "radar-ping": "radar-ping 4s cubic-bezier(0, 0.2, 0.8, 1) infinite",
      },
      transitionDelay: {
        '300': '300ms',
        '600': '600ms',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 