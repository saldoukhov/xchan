<script lang="ts">
	type Name =
		| 'attach'
		| 'back'
		| 'check'
		| 'chevron-right'
		| 'close'
		| 'cloud'
		| 'copy'
		| 'download'
		| 'file'
		| 'github'
		| 'help'
		| 'moon'
		| 'more'
		| 'pencil'
		| 'restart'
		| 'schedule'
		| 'send'
		| 'share'
		| 'trash'
		| 'unfold-less'
		| 'unfold-more'
		| 'x';

	let { name, size = 18 }: { name: Name; size?: number } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'back'}
		<path d="M19 12H5" />
		<path d="m12 19-7-7 7-7" />
	{:else if name === 'attach'}
		<path
			d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"
		/>
	{:else if name === 'download'}
		<path d="M12 15V3" />
		<path d="m7 10 5 5 5-5" />
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
	{:else if name === 'file'}
		<path d="M14 2v6h6" />
		<path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2Z" />
	{:else if name === 'pencil'}
		<path
			d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
		/>
		<path d="m15 5 4 4" />
	{:else if name === 'trash'}
		<path d="M3 6h18" />
		<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	{:else if name === 'cloud'}
		<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
	{:else if name === 'copy'}
		<rect width="14" height="14" x="8" y="8" rx="2" />
		<path d="M4 16V4a2 2 0 0 1 2-2h12" />
	{:else if name === 'check'}
		<path d="M20 6 9 17l-5-5" />
	{:else if name === 'close'}
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	{:else if name === 'send'}
		<path d="M7 17 17 7" />
		<path d="M8 7h9v9" />
	{:else if name === 'share'}
		<path d="M12 3v12" />
		<path d="m8 7 4-4 4 4" />
		<path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
	{:else if name === 'help'}
		<circle cx="12" cy="12" r="9" />
		<path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
		<path d="M12 17h.01" />
	{:else if name === 'github'}
		<path
			fill="currentColor"
			stroke="none"
			d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"
		/>
	{:else if name === 'x'}
		<path
			fill="currentColor"
			stroke="none"
			d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
		/>
	{:else if name === 'more'}
		<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
		<circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
	{:else if name === 'schedule'}
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	{:else if name === 'chevron-right'}
		<path d="m9 6 6 6-6 6" />
	{:else if name === 'unfold-more'}
		<path d="m7 14 5 5 5-5" />
		<path d="m7 10 5-5 5 5" />
	{:else if name === 'unfold-less'}
		<path d="m7 5 5 5 5-5" />
		<path d="m7 19 5-5 5 5" />
	{:else if name === 'moon'}
		<path d="M21 14.3A8.4 8.4 0 0 1 9.7 3 7.5 7.5 0 1 0 21 14.3Z" />
	{:else if name === 'restart'}
		<path d="M3 12a9 9 0 1 0 3-6.7" />
		<path d="M3 4v5h5" />
	{/if}
</svg>
