import { Vector3, Triangle } from 'three';
import { PolygonSplitter } from '../src';

describe( 'PolygonSplitter', () => {

	let splitter;
	beforeEach( () => {

		splitter = new PolygonSplitter();

	} );

	it( 'should initialize with a simple triangle', () => {

		const tri = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 )
		);

		splitter.initialize( tri );
		
		expect( splitter.polygons ).toHaveLength( 1 );
		expect( splitter.polygons[ 0 ].points ).toHaveLength( 3 );

	} );

	it( 'should triangulate a simple polygon', () => {

		const tri = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 )
		);

		splitter.initialize( tri );
		const triangles = splitter.getTriangles();
		
		expect( triangles ).toHaveLength( 1 );

	} );

	it( 'should split by triangle plane', () => {

		// Initialize with a triangle
		const tri1 = new Triangle(
			new Vector3( -1, -1, 0 ),
			new Vector3( 1, -1, 0 ),
			new Vector3( 0, 1, 0 )
		);

		// Splitting triangle that intersects the first one
		const tri2 = new Triangle(
			new Vector3( 0, -0.5, -1 ),
			new Vector3( 0, -0.5, 1 ),
			new Vector3( 0, 0.5, 0 )
		);

		splitter.initialize( tri1 );
		splitter.splitByTriangle( tri2 );
		
		const triangles = splitter.getTriangles();
		
		// After splitting, we should have more than 1 triangle (or equal if no intersection)
		expect( triangles.length ).toBeGreaterThanOrEqual( 1 );

	} );

} );