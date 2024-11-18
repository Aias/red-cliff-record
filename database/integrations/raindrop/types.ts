export interface Raindrop {
	_id: number;
	title: string;
	excerpt: string;
	link: string;
	created: string;
	lastUpdate: string;
	tags: string[];
	type: string;
	cover?: string;
	note: string;
	domain: string;
	user: {
		$ref: string;
		$id: number;
	};
	media: Array<{
		link: string;
		type: string;
	}>;
	collection: {
		$ref: string;
		$id: number;
		oid: number;
	};
	file?: {
		name: string;
		size: number;
		type: string;
	};
	highlights: Array<{
		_id: string;
		text: string;
		color: string;
		note?: string;
		created: string;
	}>;
	important: boolean;
	removed: boolean;
	creatorRef: {
		_id: number;
		avatar: string;
		name: string;
		email: string;
	};
	sort: number;
	broken: boolean;
	cache?: {
		status: string;
		size: number;
		created: string;
	};
}

export interface RaindropResponse {
	items: Raindrop[];
	count: number;
	result: boolean;
}

interface RaindropCollection {
	_id: number;
	access: {
		level: number;
		draggable: boolean;
	};
	color?: string;
	count: number;
	cover: string[];
	created: string;
	expanded: boolean;
	lastUpdate: string;
	parent?: {
		$id: number;
	};
	public: boolean;
	sort: number;
	title: string;
	user: {
		$id: number;
	};
	view: string;
}

export interface CollectionsResponse {
	items: RaindropCollection[];
	result: boolean;
}
