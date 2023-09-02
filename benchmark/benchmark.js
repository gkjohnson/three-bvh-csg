import {
	MeshNormalMaterial,
	SphereGeometry,
} from 'three';
import {
	Brush,
	Evaluator,
	INTERSECTION,
	SUBTRACTION,
} from '../src/index.js';
import { CSG } from 'three-csg-ts';
import CSG2 from './lib/three-csgmesh/three-csg.js';
import {
	bench,
	beforeEach,
	suite,
} from './lib/bench/bench.js';
import { generateGroupGeometry } from './utils.js';

// TODO: add comparison / improvement percent?
suite( 'Library Comparison', () => {

	let brush1,
		brush2,
		result,
		evaluator,
		bsp1,
		bsp2;

	beforeEach( () => {

		evaluator = new Evaluator();
		result = new Brush();

		brush1 = new Brush( new SphereGeometry( 1, 50, 50 ), new MeshNormalMaterial( ) );
		brush2 = new Brush( new SphereGeometry( 1, 50, 50 ) );
		brush1.updateMatrixWorld();

		brush2.position.y = 1;
		brush2.updateMatrixWorld();

		bsp1 = CSG2.fromMesh( brush1 );
		bsp2 = CSG2.fromMesh( brush2 );

	} );

	bench( 'three-bvh-csg', () => evaluator.evaluate( brush1, brush2, SUBTRACTION, result ) );

	bench( 'three-bvh-csg w/ rebuild',
		() => {

			brush1.disposeCacheData();
			brush2.disposeCacheData();

		},
		() => evaluator.evaluate( brush1, brush2, SUBTRACTION, result )
	);


	bench( 'three-csg-ts', () => CSG.subtract( brush1, brush2 ) );

	bench( 'three-csg', () => {

		const bspResult = bsp1.subtract( bsp2 );
		CSG2.toMesh( bspResult, brush1.matrix, brush1.material );

	} );

	bench( 'three-csg w/ rebuild', () => {

		const bsp1 = CSG2.fromMesh( brush1 );
		const bsp2 = CSG2.fromMesh( brush2 );
		const bspResult = bsp1.subtract( bsp2 );
		CSG2.toMesh( bspResult, brush1.matrix, brush1.material );

	} );

} );

suite( 'General', () => {

	let brush1,
		brush2,
		evaluator,
		result,
		invertedResult;

	beforeEach( () => {

		evaluator = new Evaluator();
		result = new Brush();
		invertedResult = new Brush();

		brush1 = new Brush( generateGroupGeometry( 100 ) );
		brush1.updateMatrixWorld( true );
		brush1.prepareGeometry();

		brush2 = new Brush( generateGroupGeometry( 100 ) );
		brush2.position.y = 1;
		brush2.rotation.set( Math.PI / 2, 0, Math.PI / 2 );
		brush2.updateMatrixWorld( true );
		brush2.prepareGeometry();

	} );

	bench( 'Subtract w/ Groups',
		() => evaluator.evaluate( brush1, brush2, SUBTRACTION, result ),
	);

	bench( 'Subtract w/o Groups',
		() => evaluator.useGroups = false,
		() => evaluator.evaluate( brush1, brush2, SUBTRACTION, result ),
	);

	bench( 'Subtract w/ Inverted',
		() => evaluator.evaluate( brush1, brush2, [ SUBTRACTION, INTERSECTION ], [ result, invertedResult ] ),
	);

} );
