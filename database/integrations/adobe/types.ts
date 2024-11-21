export interface LightroomAssetLinks {
	self: { href: string };
	'/rels/comments': { href: string; count: number };
	'/rels/favorites': { href: string; count: number };
	'/rels/rendition_type/2048': { href: string };
	'/rels/rendition_type/1280': { href: string };
	'/rels/rendition_type/640': { href: string };
	'/rels/rendition_type/thumbnail2x': { href: string };
	'/rels/rendition_generate/fullsize': { href: string; templated: boolean };
	'/rels/profiles/camera': { filename: string; href: string };
}

export interface LightroomAssetDevelop {
	croppedWidth: number;
	croppedHeight: number;
	fromDefaults: boolean;
	userOrientation: number;
	profiles: { camera: { filename: string; href: string } };
	crsHDREditMode: boolean;
	device: string;
	processingModel: string;
	crsVersion: string;
	xmpCameraRaw: { sha256: string };
	userUpdated: string;
	masks?: { [key: string]: { digest: string } };
}

export interface LightroomAssetExif {
	ApertureValue: [number, number];
	FNumber: [number, number];
	MaxApertureValue: [number, number];
	FocalLength: [number, number];
	LightSource: string;
	DateTimeOriginal: string;
	FlashRedEyeMode: boolean;
	ExposureTime: [number, number];
	FlashFired: boolean;
	MeteringMode: string;
	FocalLengthIn35mmFilm: number;
	FlashReturn: string;
	ISOSpeedRatings: number;
	ShutterSpeedValue: [number, number];
	ExposureProgram: string;
	FlashMode: string;
	FlashFunction: boolean;
	ExposureBiasValue: [number, number];
}

export interface LightroomAssetXmp {
	dng: { IsAppleProRAW: boolean };
	tiff: { Orientation: string; Make: string; Model: string };
	exif: LightroomAssetExif;
	aux: {
		SerialNumber: string;
		Lens: string;
		EnhanceDetailsVersion?: string;
		EnhanceDetailsAlreadyApplied?: boolean;
	};
	xmp: { CreatorTool: string; CreateDate: string; ModifyDate: string };
	photoshop: { DateCreated: string };
}

export interface LightroomAssetPayloadImportSource {
	originalHeight: number;
	importedOnDevice: string;
	importTimestamp: string;
	contentType: string;
	fileName: string;
	fileSize: number;
	originalWidth: number;
	sha256: string;
	originalDigest: string;
	importedBy: string;
	localAssetId?: string;
	uniqueDeviceId?: string;
}

export interface LightroomAssetPayload {
	develop: LightroomAssetDevelop;
	userUpdated: string;
	xmp: LightroomAssetXmp;
	ratings: { [key: string]: { rating: number; date?: string } };
	captureDate: string;
	location: {
		longitude: number;
		latitude: number;
		altitude: number;
		city: string;
		country: string;
		isoCountryCode: string;
		state: string;
		sublocation?: string[];
	};
	importSource: LightroomAssetPayloadImportSource;
	userCreated: string;
	changedAtTime: string;
	changedOnDevice: string;
	reviews: { [key: string]: { date: string; flag: string } };
	aesthetics: {
		application: string;
		balancing: number;
		content: number;
		created: string;
		dof: number;
		emphasis: number;
		harmony: number;
		lighting: number;
		repetition: number;
		rot: number;
		score: number;
		symmetry: number;
		version: number;
		vivid: number;
	};
	autoTags: {
		tags: { [key: string]: number };
		application: string;
		version: number;
		created: string;
	};
	order: string;
	aux?: { [key: string]: { digest: string; fileSize: number; sha256: string; type: string } };
}

export interface LightroomAsset {
	id: string;
	type: string;
	subtype: string;
	created: string;
	updated: string;
	revision_ids: string[];
	links: LightroomAssetLinks;
	payload: LightroomAssetPayload;
}

export interface LightroomAlbumLinks {
	self: { href: string };
}

export interface LightroomAlbum {
	id: string;
	links: LightroomAlbumLinks;
}

export interface LightroomResourcePayload {
	order: string;
	userCreated: string;
	userUpdated: string;
}

export interface LightroomResource {
	id: string;
	type: string;
	created: string;
	updated: string;
	revision_ids: string[];
	links: { self: { href: string } };
	asset: LightroomAsset;
	payload: LightroomResourcePayload;
}

export interface LightroomJsonResponse {
	base: string;
	album: LightroomAlbum;
	resources: LightroomResource[];
}
