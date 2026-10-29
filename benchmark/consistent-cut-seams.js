// Optional serial comparison against PR #259 or another CDT baseline:
// node benchmark/consistent-cut-seams.js /path/to/baseline/src/index.js
// Baseline runs legacy/CDT; this checkout additionally runs consistent seams.
// Only procedural primitives; no application data or comparison libraries.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadavg } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BoxGeometry, Matrix4, SphereGeometry, REVISION } from 'three';

const worker = process.argv[ 2 ] === '--worker';
const currentSource = fileURLToPath( new URL( '../src/index.js', import.meta.url ) );

function record( brush ) {

	const geometry = brush.geometry;
	const hash = createHash( 'sha256' );
	for ( const [ name, attribute ] of Object.entries( { ...geometry.attributes, index: geometry.index } ) ) {

		if ( ! attribute ) continue;
		const array = attribute.array;
		hash.update( JSON.stringify( [ name, array.constructor.name, attribute.itemSize, attribute.normalized ] ) );
		hash.update( Buffer.from( array.buffer, array.byteOffset, array.byteLength ) );

	}

	hash.update( JSON.stringify( [ geometry.drawRange, geometry.groups ] ) );
	for ( const matrix of [ brush.matrix, brush.matrixWorld ] ) {

		hash.update( Buffer.from( Float64Array.from( matrix.elements ).buffer ) );

	}

	return { sha256: hash.digest( 'hex' ), triangles: geometry.drawRange.count / 3 };

}

function median( values ) {

	const sorted = [ ...values ].sort( ( a, b ) => a - b );
	return ( sorted[ Math.floor( ( sorted.length - 1 ) / 2 ) ] + sorted[ Math.floor( sorted.length / 2 ) ] ) / 2;

}

async function runWorker() {

	const [ source, fixture, mode ] = process.argv.slice( 3 );
	const { Brush, Evaluator, ADDITION, SUBTRACTION } = await import( pathToFileURL( resolve( source ) ) );
	const observations = [];
	for ( let run = 0; run < 5; run ++ ) {

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = mode !== 'legacy';
		if ( mode === 'seams' ) {

			assert.equal( evaluator.consistentCutSeams, false, 'seams mode requires the opt-in implementation' );
			evaluator.consistentCutSeams = true;

		}

		const owned = new Set(), outputs = [];
		let csgMs = 0;
		const own = brush => {

			owned.add( brush ); return brush;

		};

		const evaluate = ( a, b, operation ) => {

			const start = performance.now();
			const result = evaluator.evaluate( a, b, operation );
			csgMs += performance.now() - start;
			return own( result );

		};

		try {

			if ( fixture === 'sphere' ) {

				// Same sphere recipe as benchmark/benchmark.js, but fresh Brushes.
				const a = own( new Brush( new SphereGeometry( 1, 50, 50 ) ) );
				const b = own( new Brush( new SphereGeometry( 1, 50, 50 ) ) );
				a.updateMatrixWorld(); b.position.y = 1; b.updateMatrixWorld();
				outputs.push( evaluate( a, b, SUBTRACTION ) );

			} else {

				assert.equal( fixture, 'box-history' );
				evaluator.attributes = [ 'position' ]; evaluator.useGroups = false;
				const matrix = new Matrix4().makeRotationZ( 0.37 );
				const a = own( new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( matrix ) ) );
				const b = own( new Brush( new BoxGeometry( 2, 2, 2 ).translate( 0.6, 0.3, 0.2 ).applyMatrix4( matrix ) ) );
				a.updateMatrixWorld( true ); b.updateMatrixWorld( true );
				const union = evaluate( a, b, ADDITION ); union.updateMatrixWorld( true );
				outputs.push( union, evaluate( union, b, SUBTRACTION ), evaluate( a, b, SUBTRACTION ) );

			}

			// Hashing/encoding is outside the evaluator timer.
			observations.push( { run, csgMs, outputs: outputs.map( record ) } );

		} finally {

			for ( const brush of owned ) {

				brush.disposeCacheData(); brush.geometry.dispose();

			}

			evaluator.reset();

		}

	}

	console.log( JSON.stringify( { observations, threeRevision: REVISION, resourceUsage: process.resourceUsage() } ) );

}

function runBenchmark() {

	const sources = process.argv[ 2 ] ? [[ 'baseline', resolve( process.argv[ 2 ] ) ], [ 'current', currentSource ]] : [[ 'current', currentSource ]];
	const runs = [];
	for ( let round = 0; round < 3; round ++ ) {

		for ( const fixture of [ 'sphere', 'box-history' ] ) for ( const mode of [ 'legacy', 'cdt', 'seams' ] ) {

			const order = round % 2 ? [ ...sources ].reverse() : sources;
			for ( const [ version, source ] of order ) {

				if ( mode === 'seams' && version === 'baseline' ) continue;
				const args = [ fileURLToPath( import.meta.url ), '--worker', source, fixture, mode ];
				const loadBefore = loadavg();
				const result = spawnSync( process.execPath, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 ** 2 } );
				if ( result.status !== 0 ) {

					console.error( JSON.stringify( { round, fixture, mode, version, args, status: result.status, error: result.error?.message, stderr: result.stderr } ) );
					process.exitCode = 1;
					throw new Error( 'Benchmark process failed; not a geometry acceptance verdict.' );

				}

				runs.push( { round, fixture, mode, version, source, args, loadBefore, loadAfter: loadavg(), stderr: result.stderr, ...JSON.parse( result.stdout ) } );

			}

		}

	}

	const summary = [];
	for ( const fixture of [ 'sphere', 'box-history' ] ) for ( const mode of [ 'legacy', 'cdt', 'seams' ] ) for ( const [ version ] of sources ) {

		if ( mode === 'seams' && version === 'baseline' ) continue;
		const matching = runs.filter( r => r.fixture === fixture && r.mode === mode && r.version === version );
		const warm = matching.flatMap( r => r.observations.slice( 1 ).map( o => o.csgMs ) );
		summary.push( { fixture, mode, version, medianMs: median( warm ), minMs: Math.min( ...warm ), maxMs: Math.max( ...warm ), samples: warm.length,
			processMediansMs: matching.map( r => median( r.observations.slice( 1 ).map( o => o.csgMs ) ) ),
			firstMedianMs: median( matching.map( r => r.observations[ 0 ].csgMs ) ),
			deterministic: new Set( matching.flatMap( r => r.observations.map( o => JSON.stringify( o.outputs ) ) ) ).size === 1,
			outputs: matching[ 0 ].observations[ 0 ].outputs } );

	}

	console.log( JSON.stringify( { node: process.version, summary, runs,
		scope: 'Serial fresh processes, three per fixture/mode/version, one first plus four subsequent runs. Fresh evaluator/geometries each run; original intermediate Brushes retained. Only evaluate is timed, including its preparation. No profiler, forced GC, app adapter or private fixture. Checksums are not geometry validity proofs; RSS is process-wide. Uncontrolled external load; no universal performance claim.' }, null, 2 ) );

}

if ( worker ) {

	runWorker().catch( error => {

		console.error( error );
		process.exitCode = 1;

	} );

} else {

	runBenchmark();

}
