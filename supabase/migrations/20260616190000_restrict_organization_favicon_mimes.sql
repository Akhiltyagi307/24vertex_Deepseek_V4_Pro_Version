UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/x-icon',
	'image/vnd.microsoft.icon'
]::text[]
WHERE id = 'organization-favicons';
