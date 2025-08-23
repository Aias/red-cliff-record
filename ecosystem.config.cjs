module.exports = {
	apps: [
		{
			// Main application
			name: 'red-cliff-record',
			script: 'bun',
			args: 'run .output/server/index.mjs',
			cwd: './',
			env: {
				NODE_ENV: 'production',
				// Environment variables will be loaded from .env file
			},
			instances: 1,
			autorestart: true,
			watch: ['.output'],
			ignore_watch: ['node_modules', 'logs', '.git'],
			watch_delay: 1000,
			max_memory_restart: '1G',
			error_file: './logs/errors.log',
			out_file: './logs/output.log',
			log_file: './logs/combined.log',
			merge_logs: true,
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
