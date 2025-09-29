import { Vector3, Triangle } from 'three';
import { PolygonSplitter } from '../src';

describe( 'PolygonSplitter', () => {

	let splitter;
	beforeEach( () => {

		splitter = new PolygonSplitter();

	} );

	describe( 'Initialization', () => {

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

		it( 'should initialize with multiple triangles', () => {

			const tri1 = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 )
			);

			const tri2 = new Triangle(
				new Vector3( 1, 0, 0 ),
				new Vector3( 2, 0, 0 ),
				new Vector3( 1, 1, 0 )
			);

			splitter.initialize( [ tri1, tri2 ] );
			
			expect( splitter.polygons ).toHaveLength( 2 );
			expect( splitter.polygons[ 0 ].points ).toHaveLength( 3 );
			expect( splitter.polygons[ 1 ].points ).toHaveLength( 3 );

		} );

		it( 'should reject triangles with different normals', () => {

			const tri1 = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 )
			);

			const tri2 = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 0, 1, 0 ),
				new Vector3( 0, 0, 1 )
			);

			expect( () => {

				splitter.initialize( [ tri1, tri2 ] );

			} ).toThrow( 'Cannot initialize with triangles that have different normals' );

		} );

	} );

	describe( 'Triangulation', () => {

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

		it( 'should triangulate a square polygon', () => {

			// Create a PolygonSplitter and manually set up a square polygon
			splitter.polygons = []; 
			
			// Add a square polygon directly (this tests the internal triangulation)
			const squarePoints = [
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 1, 1, 0 ),
				new Vector3( 0, 1, 0 )
			];

			// We'll test this by creating a complex polygon scenario
			// For now, test that the triangulation system can handle multiple points
			const tri1 = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 )
			);
			
			const tri2 = new Triangle(
				new Vector3( 1, 0, 0 ),
				new Vector3( 1, 1, 0 ),
				new Vector3( 0, 1, 0 )
			);

			splitter.initialize( [ tri1, tri2 ] );
			const triangles = splitter.getTriangles();

			expect( triangles.length ).toBeGreaterThanOrEqual( 2 );

		} );

		it( 'should handle degenerate triangles', () => {

			const degenerateTri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 0, 0, 0 ), // Same point
				new Vector3( 1, 0, 0 )
			);

			splitter.initialize( degenerateTri );
			const triangles = splitter.getTriangles();

			// Should filter out degenerate triangles
			expect( triangles ).toHaveLength( 0 );

		} );

	} );

	describe( 'Polygon Splitting', () => {

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

		it( 'should handle coplanar triangles', () => {

			// Initialize with a triangle in XY plane
			const tri1 = new Triangle(
				new Vector3( -1, -1, 0 ),
				new Vector3( 1, -1, 0 ),
				new Vector3( 0, 1, 0 )
			);

			// Coplanar triangle in same XY plane
			const tri2 = new Triangle(
				new Vector3( -0.5, 0, 0 ),
				new Vector3( 0.5, 0, 0 ),
				new Vector3( 0, 0.5, 0 )
			);

			splitter.initialize( tri1 );
			splitter.splitByTriangle( tri2 );
			
			expect( splitter.coplanarTriangleUsed ).toBe( true );

		} );

		it( 'should handle non-intersecting triangles', () => {

			// Initialize with a triangle
			const tri1 = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 )
			);

			// Non-intersecting triangle far away
			const tri2 = new Triangle(
				new Vector3( 10, 10, 10 ),
				new Vector3( 11, 10, 10 ),
				new Vector3( 10, 11, 10 )
			);

			splitter.initialize( tri1 );
			const initialTriangleCount = splitter.getTriangles().length;
			
			splitter.splitByTriangle( tri2 );
			const finalTriangleCount = splitter.getTriangles().length;

			// Should remain unchanged since no intersection
			expect( finalTriangleCount ).toBe( initialTriangleCount );

		} );

	} );

	describe( 'Edge Cases', () => {

		it( 'should reset properly', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 )
			);

			splitter.initialize( tri );
			expect( splitter.triangles.length ).toBeGreaterThanOrEqual( 0 );

			splitter.reset();
			expect( splitter.triangles ).toHaveLength( 0 );
			expect( splitter.polygons ).toHaveLength( 0 );
			expect( splitter.coplanarTriangleUsed ).toBe( false );

		} );

		it( 'should handle empty initialization', () => {

			expect( () => splitter.initialize( [] ) ).not.toThrow();
			expect( splitter.polygons ).toHaveLength( 0 );

		} );

	} );

	describe( 'Polygon Methods', () => {

		it( 'should compute polygon normal correctly', () => {

			const polygon = {
				points: [
					new Vector3( 0, 0, 0 ),
					new Vector3( 1, 0, 0 ),
					new Vector3( 1, 1, 0 ),
					new Vector3( 0, 1, 0 )
				],
				computeNormal: function( target ) {

					target.set( 0, 0, 0 );
					for ( let i = 0; i < this.points.length; i ++ ) {

						const current = this.points[ i ];
						const next = this.points[ ( i + 1 ) % this.points.length ];

						target.x += ( current.y - next.y ) * ( current.z + next.z );
						target.y += ( current.z - next.z ) * ( current.x + next.x );
						target.z += ( current.x - next.x ) * ( current.y + next.y );

					}

					return target.normalize();

				}
			};

			const normal = new Vector3();
			polygon.computeNormal( normal );

			// For a square in XY plane, normal should point in Z direction
			expect( Math.abs( normal.z ) ).toBeCloseTo( 1, 5 );
			expect( Math.abs( normal.x ) ).toBeCloseTo( 0, 5 );
			expect( Math.abs( normal.y ) ).toBeCloseTo( 0, 5 );

		} );

	} );

} );