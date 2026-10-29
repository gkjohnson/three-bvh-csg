// Public failing reproducers, deliberately NOT expected-failure tests.
// node benchmark/consistent-cut-seams-limitations.js sphere
// node benchmark/consistent-cut-seams-limitations.js groups-uv
// A failure stays nonzero. Do not use success alone as a mesh-validity verdict.
import assert from 'node:assert/strict';
import { BoxGeometry, SphereGeometry, MeshBasicMaterial } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from '../src/index.js';

const fixture = process.argv[ 2 ] || 'sphere';
assert.ok( [ 'sphere', 'groups-uv' ].includes( fixture ) );
const evaluator = new Evaluator();
evaluator.useCDTClipping = true;
evaluator.consistentCutSeams = true;
const materials = [ new MeshBasicMaterial(), new MeshBasicMaterial() ];
const a = new Brush( fixture === 'sphere' ? new SphereGeometry( 1, 50, 50 ) : new BoxGeometry( 2, 2, 2 ), materials[ 0 ] );
const b = new Brush( fixture === 'sphere' ? new SphereGeometry( 1, 50, 50 ) : new BoxGeometry( 2, 2, 2 ).translate( 0.6, 0.3, 0.2 ), materials[ 1 ] );
if ( fixture === 'sphere' ) {

	b.position.y = 1;

} else {

	b.rotation.set( 0.2, - 0.1, 0.3 );
	evaluator.removeUnusedMaterials = false;
	evaluator.consolidateGroups = false;

}

a.updateMatrixWorld( true );
b.updateMatrixWorld( true );
let union, repeated;
try {

	union = evaluator.evaluate( a, b, ADDITION );
	union.updateMatrixWorld( true );
	console.log( `${ fixture }: union completed; evaluating union minus B` );
	repeated = evaluator.evaluate( union, b, SUBTRACTION );
	console.log( `${ fixture }: no construction exception; geometry validity is not certified by this script` );

} finally {

	for ( const brush of [ a, b, union, repeated ] ) {

		if ( brush ) {

			brush.disposeCacheData();
			brush.geometry.dispose();

		}

	}

	for ( const material of materials ) material.dispose();
	evaluator.reset();

}
