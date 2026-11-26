/** @type {import('tailwindcss').Config} */

// Todos los colores leen canales HSL desde variables CSS (src/index.css).
// `<alpha-value>` habilita modificadores de opacidad: bg-brand/15, border-primary/50.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,jsx}',
		'./components/**/*.{js,jsx}',
		'./app/**/*.{js,jsx}',
		'./src/**/*.{js,jsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				/* ── Tokens shadcn (alias de la paleta VINDGROUP; no se tocan los componentes ui/*) ── */
				border: token('border'),
				input: token('input'),
				ring: token('ring'),
				background: token('background'),
				foreground: token('foreground'),
				primary: {
					DEFAULT: token('primary'),
					foreground: token('primary-foreground'),
				},
				secondary: {
					DEFAULT: token('secondary'),
					foreground: token('secondary-foreground'),
				},
				destructive: {
					DEFAULT: token('destructive'),
					foreground: token('destructive-foreground'),
				},
				muted: {
					DEFAULT: token('muted'),
					foreground: token('muted-foreground'),
				},
				accent: {
					DEFAULT: token('accent'),
					foreground: token('accent-foreground'),
				},
				popover: {
					DEFAULT: token('popover'),
					foreground: token('popover-foreground'),
				},
				card: {
					DEFAULT: token('card'),
					foreground: token('card-foreground'),
				},

				/* ── Tokens semánticos VINDGROUP (fuente: primitivos de :root) ── */
				surface: {
					base: token('surface-base'),   // #070B11
					panel: token('surface-panel'), // #0D1420
					card: token('surface-card'),   // #121C2C
				},
				line: {
					subtle: token('line-subtle'), // #19263A
					medium: token('line-medium'), // #243550
				},
				brand: token('brand'), // #DEAB47 oro mostaza
				info: token('info'),   // #38BDF8 azul celeste técnico
				ink: {
					DEFAULT: token('ink'),       // #F8FAFC
					muted: token('ink-muted'),   // #8FA2BF
				},
				status: {
					done: token('status-done'),         // #34D399 salvia
					progress: token('status-progress'), // #3B82F6
					alert: token('status-alert'),       // #C99355
				},
				role: {
					dev: token('role-dev'),             // #A78BFA violeta
				},
				sev: {
					1: token('sev-1'),
					2: token('sev-2'),
					3: token('sev-3'),
					4: token('sev-4'),
					5: token('sev-5'),
				},
				error: {
					bg: token('error-bg'),         // #1E1215
					border: token('error-border'), // #4C1D24
					text: token('error-text'),     // #E06C75
				},
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			transitionTimingFunction: {
				elastic: 'cubic-bezier(0.16, 1, 0.3, 1)',
			},
			transitionDuration: {
				bento: '350ms',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
				'gauge-fill': {
					from: { strokeDashoffset: 'var(--gauge-circ)' },
					to: { strokeDashoffset: 'var(--gauge-offset)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'gauge-fill': 'gauge-fill 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
};
