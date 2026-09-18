/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				light: 'hsl(var(--primary-light))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))',
  				light: 'hsl(var(--success-light))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))',
  				light: 'hsl(var(--warning-light))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  				light: 'hsl(var(--destructive-light))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))',
  				light: 'hsl(var(--info-light))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			heading: ['var(--font-heading)'],
  			body: ['var(--font-body)'],
  			display: ['var(--font-display)'],
  			mono: ['var(--font-mono)']
  		},
  		boxShadow: {
  			'soft': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
  			'card': '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.04)',
  			'premium': '0 4px 24px -6px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)',
  			'premium-lg': '0 12px 48px -8px rgba(0,0,0,0.12), 0 4px 16px -4px rgba(0,0,0,0.06)',
  		},
  		keyframes: {
   			'accordion-down': {
   				from: { height: '0' },
   				to: { height: 'var(--radix-accordion-content-height)' }
   			},
   			'accordion-up': {
   				from: { height: 'var(--radix-accordion-content-height)' },
   				to: { height: '0' }
   			},
   			'fade-in': {
   				from: { opacity: '0' },
   				to: { opacity: '1' }
   			},
   			'fade-up': {
   				from: { opacity: '0', transform: 'translateY(8px)' },
   				to: { opacity: '1', transform: 'translateY(0)' }
   			},
   			'slide-in-right': {
   				from: { transform: 'translateX(100%)', opacity: '0' },
   				to: { transform: 'translateX(0)', opacity: '1' }
   			},
   			'scale-in': {
   				from: { transform: 'scale(0.96)', opacity: '0' },
   				to: { transform: 'scale(1)', opacity: '1' }
   			},
   			'shimmer': {
   				'0%': { backgroundPosition: '-200% 0' },
   				'100%': { backgroundPosition: '200% 0' }
   			},
   			'pulse-soft': {
   				'0%, 100%': { opacity: '1' },
   				'50%': { opacity: '0.6' }
   			}
   		},
   		animation: {
   			'accordion-down': 'accordion-down 0.2s ease-out',
   			'accordion-up': 'accordion-up 0.2s ease-out',
   			'fade-in': 'fade-in 0.3s ease-out',
   			'fade-up': 'fade-up 0.4s ease-out',
   			'slide-in-right': 'slide-in-right 0.3s ease-out',
   			'scale-in': 'scale-in 0.2s ease-out',
   			'shimmer': 'shimmer 1.5s ease-in-out infinite',
   			'pulse-soft': 'pulse-soft 2s ease-in-out infinite'
   		}
   	}
  },
  plugins: [require("tailwindcss-animate")],
}
