function captureBookmarkRequests() {
	let responses = [];
	const originalXHR = window.XMLHttpRequest;

	window.XMLHttpRequest = function () {
		const xhr = new originalXHR();
		const originalOpen = xhr.open;

		xhr.open = function () {
			const url = arguments[1];
			if (url.includes('Bookmarks')) {
				xhr.addEventListener('load', function () {
					try {
						const response = JSON.parse(xhr.responseText);
						responses.push({
							url: url,
							timestamp: new Date().toISOString(),
							response: response
						});
						console.log('Captured Bookmark request:', url);
					} catch (e) {
						console.log('Failed to parse response as JSON for:', url);
					}
				});
			}
			originalOpen.apply(xhr, arguments);
		};

		return xhr;
	};

	window.bookmarkResponses = responses;
	console.log('Bookmark XHR interceptor installed. Access responses via window.bookmarkResponses');
}

// Save the function to window so you can easily rerun it after refresh
window.captureBookmarkRequests = captureBookmarkRequests;

// Run it immediately
captureBookmarkRequests();

//

function downloadBookmarkResponses() {
	const data = JSON.stringify(window.bookmarkResponses, null, 2);
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'bookmark-responses.json';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Run this in console to save to JSON file
// downloadBookmarkResponses();