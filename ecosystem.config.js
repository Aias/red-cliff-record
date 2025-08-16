module.exports = {
	apps: [
		{
			// Main application
			name: 'red-cliff-record',
			script: 'bun',
			args: 'run start',
			cwd: './',
			env: {
				NODE_ENV: 'production',
				// Environment variables will be loaded from .env file
			},
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '1G',
			error_file: './logs/app-error.log',
			out_file: './logs/app-out.log',
			log_file: './logs/app-combined.log',
			time: true,
		},
		{
			// Auto-deployment monitor
			name: 'red-cliff-deploy',
			script: './scripts/deploy/auto-deploy.sh',
			cwd: './',
			interpreter: '/bin/bash',
			autorestart: true,
			watch: false,
			error_file: './logs/deploy-error.log',
			out_file: './logs/deploy-out.log',
			log_file: './logs/deploy-combined.log',
			time: true,
		},
	],
};
