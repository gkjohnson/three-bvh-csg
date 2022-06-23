import {
	MeshNormalMaterial,
	SphereGeometry,
} from 'three';
import { CSG } from 'three-csg-ts';
import CSG2 from './lib/three-csgmesh/three-csg.js';
import { Brush, Evaluator, SUBTRACTION } from '../src/index.js';

const ITERATIONS = 5;

// warm up the script. The first iterations seem to always be slow
{

	const sphere1 = new Brush( new SphereGeometry( 1, 50, 50 ), new MeshNormalMaterial( ) );
	const sphere2 = new Brush( new SphereGeometry( 1, 50, 50 ) );
	sphere2.position.y = 1;

	// Make sure the .matrix of each mesh is current
	sphere1.updateMatrixWorld();
	sphere2.updateMatrixWorld();

	const evaluator = new Evaluator();
	const result = new Brush();
	for ( let i = 0; i < ITERATIONS; i ++ ) {

		evaluator.evaluate( sphere1, sphere2, SUBTRACTION, result );

	}

}

// Make 2 meshes..
const sphere1 = new Brush( new SphereGeometry( 1, 50, 50 ), new MeshNormalMaterial( ) );
const sphere2 = new Brush( new SphereGeometry( 1, 50, 50 ) );
sphere2.position.y = 1;

// Make sure the .matrix of each mesh is current
sphere1.updateMatrixWorld();
sphere2.updateMatrixWorld();

console.log( 'Benchmark' );
console.log( `\tpolygons per mesh : ${ sphere1.geometry.index.count / 3 }` );
console.log( `\titerations        : ${ ITERATIONS }` );


let start, delta;
let evalTime;

{

	const evaluator = new Evaluator();
	start = performance.now();
	const result = new Brush();
	for ( let i = 0; i < ITERATIONS; i ++ ) {

		const meshResult = evaluator.evaluate( sphere1, sphere2, SUBTRACTION, result );

	}

	delta = performance.now() - start;

	console.log( '\nthree-bvh-csg' );
	console.log( `\ttotal   : ${ delta.toFixed( 2 ) }ms` );
	console.log( `\taverage : ${ ( delta / ITERATIONS ).toFixed( 2 ) }ms` );

	evalTime = delta;

}

{

	start = performance.now();
	for ( let i = 0; i < ITERATIONS; i ++ ) {

		// Perform CSG operations
		// The result is a Mesh that you can add to your scene...
		const meshResult = CSG.subtract( sphere1, sphere2 );

	}

	delta = performance.now() - start;

	console.log( '\nthree-csg-ts' );
	console.log( `\ttotal       : ${ delta.toFixed( 2 ) }ms` );
	console.log( `\taverage     : ${ ( delta / ITERATIONS ).toFixed( 2 ) }ms` );
	console.log( `\timprovement : ${ ( 100 - 100 * evalTime / delta ).toFixed( 2 ) }%` );

}

{

	const bspA = CSG2.fromMesh( sphere1 );
	const bspB = CSG2.fromMesh( sphere2 );
	start = performance.now();
	for ( let i = 0; i < ITERATIONS; i ++ ) {

		const bspResult = bspA.subtract( bspB );
		const meshResult = CSG2.toMesh( bspResult, sphere1.matrix, sphere1.material );

	}

	delta = performance.now() - start;

	console.log( '\nTHREE-CSGMesh' );
	console.log( `\ttotal   : ${ delta.toFixed( 2 ) }ms` );
	console.log( `\taverage : ${ ( delta / ITERATIONS ).toFixed( 2 ) }ms` );
	console.log( `\timprovement : ${ ( 100 - 100 * evalTime / delta ).toFixed( 2 ) }%` );

}

