export const extensions: { [key: string]: string } = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

export const getContentTypeFromExtension = (extension: string): string => {
	return extensions[extension.toLowerCase()] || 'application/octet-stream';
};

export const getExtensionFromContentType = (contentType: string | null): string | null => {
	if (!contentType) return null;

	for (const [ext, mime] of Object.entries(extensions)) {
		if (mime === contentType) {
			return ext;
		}
	}

	return null;
};
