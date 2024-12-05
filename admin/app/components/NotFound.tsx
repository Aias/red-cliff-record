import { Link } from '@tanstack/react-router';
import { Box, Text, Flex, Button } from '@radix-ui/themes';

export function NotFound() {
	return (
		<Box p="4">
			<Flex direction="column" gap="4">
				<Text color="gray">
					<p>The page you are looking for does not exist.</p>
				</Text>
				<Flex gap="2" align="center" wrap="wrap">
					<Button variant="solid" color="green" onClick={() => window.history.back()}>
						Go back
					</Button>
					<Button variant="solid" color="blue" asChild>
						<Link to="/">Start Over</Link>
					</Button>
				</Flex>
			</Flex>
		</Box>
	);
}
