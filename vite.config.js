import { searchForWorkspaceRoot } from 'vite';
import fs from 'fs';

export default {

	define: {
		global: 'globalThis',
	},
	root: './examples/',
	base: '',
	build: {
		outDir: './bundle/',
		rollupOptions: {
			input: fs
				.readdirSync( './examples/' )
				.filter( p => /\.html$/.test( p ) )
				.map( p => `./examples/${ p }` ),
		},
	},
	server: {
		fs: {
			allow: [
				// search up for workspace root
				searchForWorkspaceRoot( process.cwd() ),
			],
		},
	}

};
