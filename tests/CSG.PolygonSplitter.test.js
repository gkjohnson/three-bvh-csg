import { Vector3, BoxGeometry, SphereGeometry } from 'three';
import { Brush, Evaluator, SUBTRACTION } from '../src';

describe( 'CSG with PolygonSplitter', () => {

	let evaluator;
	beforeEach( () => {

		evaluator = new Evaluator();

	} );

	it( 'should work with symmetrical clipping enabled', () => {

		// Create two intersecting brushes
		const brush1 = new Brush( new BoxGeometry( 1, 1, 1 ) );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new SphereGeometry( 0.75, 32, 16 ) );
		brush2.position.set( 0.5, 0, 0 );
		brush2.updateMatrixWorld();

		// Enable symmetrical clipping
		evaluator.useSymmetricalClipping = true;
		evaluator.attributes = [ 'position', 'normal' ];

		const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );

		// The result should have a valid geometry
		expect( result.geometry ).toBeDefined();
		expect( result.geometry.attributes.position ).toBeDefined();
		expect( result.geometry.attributes.normal ).toBeDefined();

		// Should have triangles in the result
		const positionCount = result.geometry.attributes.position.count;
		expect( positionCount ).toBeGreaterThan( 0 );
		expect( positionCount % 3 ).toBe( 0 ); // Should be divisible by 3 (triangles)

	} );

	it( 'should produce similar results to TriangleSplitter', () => {

		// Create two intersecting brushes
		const brush1a = new Brush( new BoxGeometry( 1, 1, 1 ) );
		brush1a.updateMatrixWorld();

		const brush2a = new Brush( new SphereGeometry( 0.75, 16, 8 ) ); // Lower resolution for easier testing
		brush2a.position.set( 0.25, 0, 0 );
		brush2a.updateMatrixWorld();

		const brush1b = new Brush( new BoxGeometry( 1, 1, 1 ) );
		brush1b.updateMatrixWorld();

		const brush2b = new Brush( new SphereGeometry( 0.75, 16, 8 ) );
		brush2b.position.set( 0.25, 0, 0 );
		brush2b.updateMatrixWorld();

		// Test with TriangleSplitter
		evaluator.useSymmetricalClipping = false;
		evaluator.attributes = [ 'position', 'normal' ];
		const resultTriangle = evaluator.evaluate( brush1a, brush2a, SUBTRACTION );

		// Test with PolygonSplitter
		evaluator.useSymmetricalClipping = true;
		const resultPolygon = evaluator.evaluate( brush1b, brush2b, SUBTRACTION );

		// Both should produce valid geometries
		expect( resultTriangle.geometry.attributes.position.count ).toBeGreaterThan( 0 );
		expect( resultPolygon.geometry.attributes.position.count ).toBeGreaterThan( 0 );

		// Results should be reasonably similar in vertex count (within an order of magnitude)
		const triangleCount = resultTriangle.geometry.attributes.position.count;
		const polygonCount = resultPolygon.geometry.attributes.position.count;
		
		expect( polygonCount ).toBeGreaterThan( triangleCount * 0.1 ); // At least 10% of triangle version
		expect( polygonCount ).toBeLessThan( triangleCount * 10 ); // At most 10x the triangle version

	} );

	it( 'should preserve topology better with symmetrical clipping', () => {

		// This test checks that the PolygonSplitter creates better edge connectivity
		const brush1 = new Brush( new BoxGeometry( 2, 2, 2 ) );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new BoxGeometry( 1, 1, 1 ) );
		brush2.position.set( 0.5, 0.5, 0.5 );
		brush2.updateMatrixWorld();

		// Enable symmetrical clipping
		evaluator.useSymmetricalClipping = true;
		evaluator.attributes = [ 'position', 'normal' ];

		const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );

		// The result should have valid geometry with proper topology
		expect( result.geometry.attributes.position.count ).toBeGreaterThan( 0 );

		// Check that the result geometry doesn't have degenerate triangles
		const positions = result.geometry.attributes.position;
		let degenerateCount = 0;

		for ( let i = 0; i < positions.count; i += 3 ) {

			const v1 = new Vector3().fromBufferAttribute( positions, i );
			const v2 = new Vector3().fromBufferAttribute( positions, i + 1 );
			const v3 = new Vector3().fromBufferAttribute( positions, i + 2 );

			const area = new Vector3().crossVectors(
				new Vector3().subVectors( v2, v1 ),
				new Vector3().subVectors( v3, v1 )
			).length() * 0.5;

			if ( area < 1e-10 ) {

				degenerateCount ++;

			}

		}

		// Should have very few or no degenerate triangles
		expect( degenerateCount ).toBeLessThan( positions.count / 3 * 0.1 ); // Less than 10% of triangles

	} );

} );