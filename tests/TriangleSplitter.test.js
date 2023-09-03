import { Vector3, Triangle } from 'three';
import { TriangleSplitter } from '../src';

describe( 'TriangleSplitter', () => {

	let splitter;
	beforeEach( () => {

		splitter = new TriangleSplitter();

	} );

	// issue #141
	it( 'split failure case 1', () => {

		const t1 = new Triangle(
			new Vector3( 0.41619066451535114, - 0.8521229388252674, 0.5206621331179401 ),
			new Vector3( 0.41619066451535114, - 0.7377804564390872, 0.5206621331179401 ),
			new Vector3( 0.376364833930707, - 0.7586154241556492, 0.5206621331179401 ),
		);

		const t2 = new Triangle(
			new Vector3( 0.5, - 0.7071067690849304, 0.5 ),
			new Vector3( 0.39284747838974, - 0.7071067690849304, 0.5879377722740173 ),
			new Vector3( 0.39284747838974, - 0.8314695954322815, 0.39284747838974 ),
		);

		splitter.initialize( t1 );
		splitter.splitByTriangle( t2 );
		expect( splitter.triangles ).toHaveLength( 1 );


	} );

} );
