import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		// The plugin bundled with @n8n/node-cli (0.28.0) predates the trigger
		// exemption added in 0.29.0, which n8n's review scanner uses: trigger
		// nodes must NOT set usableAsTool, so the "property required" report
		// on this file is a false positive.
		files: ['nodes/NuacomTrigger/NuacomTrigger.node.ts'],
		rules: { '@n8n/community-nodes/node-usable-as-tool': 'off' },
	},
];
