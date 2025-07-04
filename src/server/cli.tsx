import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import React, { useState } from 'react';
import { Box, render, Text } from 'ink';
import SelectInput from 'ink-select-input';

const INTEGRATIONS_DIR = path.resolve(__dirname, 'integrations');

function getSyncOptions(): { label: string; value: string }[] {
	const dirs = readdirSync(INTEGRATIONS_DIR, { withFileTypes: true });
	const integrations = dirs
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.filter((name) => existsSync(path.join(INTEGRATIONS_DIR, name, 'sync.ts')))
		.sort();

	const items = integrations.map((name) => ({ label: name, value: name }));
	items.unshift({ label: 'daily', value: 'daily' });
	return items;
}

const runScript = (value: string) => {
	const script = value === 'daily' ? `sync:daily` : `sync:${value}`;
	const child = spawn('pnpm', ['run', script], { stdio: 'inherit' });
	child.on('exit', (code) => {
		process.exit(code ?? 0);
	});
};

const App = () => {
	const [running, setRunning] = useState<string | null>(null);
	const items = getSyncOptions();

	const handleSelect = (item: { label: string; value: string }) => {
		setRunning(item.value);
		runScript(item.value);
	};

	if (running) {
		return (
			<Box flexDirection="column">
				<Text color="green">Running {running} sync...</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				Select a sync script to run
			</Text>
			<SelectInput items={items} onSelect={handleSelect} />
		</Box>
	);
};

render(<App />);
