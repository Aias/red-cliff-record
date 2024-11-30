import * as fs from 'node:fs';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';

const filePath = 'count.txt';

async function readCount() {
	return parseInt(await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'));
}

const getCount = createServerFn({
	method: 'GET',
}).handler(() => {
	return readCount();
});

const updateCount = createServerFn({ method: 'POST' })
	.validator((d: number) => d)
	.handler(async ({ data }) => {
		const count = await readCount();
		const newCount = count + data;
		await fs.promises.writeFile(filePath, `${newCount}`);
		return newCount;
	});

export const Route = createFileRoute('/')({
	component: Home,
	loader: async () => await getCount(),
});

function Home() {
	const router = useRouter();
	const count = Route.useLoaderData();

	return (
		<button
			type="button"
			onClick={async () => {
				await updateCount({ data: 1 });
				router.invalidate();
			}}
		>
			Add 1 to {count}?
		</button>
	);
}
