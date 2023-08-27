import {
	MeshNormalMaterial,
	SphereGeometry,
} from 'three';
import {
	Brush,
	Evaluator,
	SUBTRACTION,
} from '../src/index.js';
import { CSG } from 'three-csg-ts';
import CSG2 from './lib/three-csgmesh/three-csg.js';
import {
	bench,
	beforeEach,
	suite,
} from './lib/bench/bench.js';

// TODO: add comparison / improvement percent?
suite( 'Library Comparison', () => {

	let sphere1,
		sphere2,
		result,
		evaluator,
		bsp1,
		bsp2;

	beforeEach( () => {

		evaluator = new Evaluator();
		result = new Brush();
		sphere1 = new Brush( new SphereGeometry( 1, 50, 50 ), new MeshNormalMaterial( ) );
		sphere2 = new Brush( new SphereGeometry( 1, 50, 50 ) );
		sphere2.position.y = 1;
		sphere1.updateMatrixWorld();
		sphere2.updateMatrixWorld();

		bsp1 = CSG2.fromMesh( sphere1 );
		bsp2 = CSG2.fromMesh( sphere2 );

	} );

	bench( 'three-bvh-csg', () => evaluator.evaluate( sphere1, sphere2, SUBTRACTION, result ) );

	bench( 'three-bvh-csg w/ rebuild',
		() => {

			sphere1.disposeCacheData();
			sphere2.disposeCacheData();

		},
		() => evaluator.evaluate( sphere1, sphere2, SUBTRACTION, result )
	);


	bench( 'three-csg-ts', () => CSG.subtract( sphere1, sphere2 ) );

	bench( 'three-csg', () => {

		const bspResult = bsp1.subtract( bsp2 );
		CSG2.toMesh( bspResult, sphere1.matrix, sphere1.material );

	} );

	bench( 'three-csg w/ rebuild', () => {

		const bsp1 = CSG2.fromMesh( sphere1 );
		const bsp2 = CSG2.fromMesh( sphere2 );
		const bspResult = bsp1.subtract( bsp2 );
		CSG2.toMesh( bspResult, sphere1.matrix, sphere1.material );

	} );

} );

