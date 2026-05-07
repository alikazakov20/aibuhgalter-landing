/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './*.html',
        './admin/**/*.html',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Montserrat', 'system-ui', 'sans-serif'],
            },
            colors: {
                mint: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d',
                    950: '#052e16',
                },
            },
            animation: {
                'fade-up': 'fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                'gradient': 'gradient 12s ease infinite',
                'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                gradient: {
                    '0%, 100%': { 'background-position': '0% 50%' },
                    '50%': { 'background-position': '100% 50%' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-12px)' },
                },
            },
        },
    },
    safelist: [
        // Динамически применяемые классы (через JS toggleClass / classList.add)
        'ann-info', 'ann-promo', 'ann-warning', 'ann-emergency',
        'ann-highlight', 'ann-sticky', 'ann-hidden', 'ann-has-cta',
        // Active calc tab
        { pattern: /calc-tab\[aria-selected/ },
        // Sticky-nav active states
        'text-emerald-700', 'bg-emerald-50',
    ],
    plugins: [],
};
