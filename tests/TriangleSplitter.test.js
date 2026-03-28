import { Vector3, Triangle, Line3, Plane } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { LegacyTriangleSplitter, CDTTriangleSplitter } from '../src';
import { isTriangleCoplanar, getCoplanarIntersectionEdges } from '../src/core/utils/intersectionUtils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mulberry32( seed ) {

	return function () {

		seed |= 0; seed = seed + 0x6D2B79F5 | 0;
		let t = Math.imul( seed ^ seed >>> 15, 1 | seed );
		t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
		return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

	};

}

function triangleArea( tri ) {

	const ab = new Vector3().subVectors( tri.b, tri.a );
	const ac = new Vector3().subVectors( tri.c, tri.a );
	return new Vector3().crossVectors( ab, ac ).length() * 0.5;

}

function validateSplitResult( originalTri, resultTriangles ) {

	// At least 1 sub-triangle produced
	expect( resultTriangles.length ).toBeGreaterThanOrEqual( 1 );

	const originalArea = triangleArea( originalTri );

	// Area conservation
	let totalArea = 0;
	for ( let i = 0, l = resultTriangles.length; i < l; i ++ ) {

		const subArea = triangleArea( resultTriangles[ i ] );

		// No degenerate sub-triangles
		expect( subArea ).toBeGreaterThan( 1e-10 );

		totalArea += subArea;

	}

	const relError = Math.abs( totalArea - originalArea ) / Math.max( originalArea, 1e-15 );
	expect( relError ).toBeLessThan( 1e-6 );

	// All vertices coplanar with original
	const plane = new Plane();
	originalTri.getPlane( plane );

	for ( let i = 0, l = resultTriangles.length; i < l; i ++ ) {

		const t = resultTriangles[ i ];
		expect( Math.abs( plane.distanceToPoint( t.a ) ) ).toBeLessThan( 1e-6 );
		expect( Math.abs( plane.distanceToPoint( t.b ) ) ).toBeLessThan( 1e-6 );
		expect( Math.abs( plane.distanceToPoint( t.c ) ) ).toBeLessThan( 1e-6 );

	}

}

function splitTriangle( SplitterClass, triA, triB ) {

	const splitter = new SplitterClass();

	if ( SplitterClass === LegacyTriangleSplitter ) {

		splitter.initialize( triA );

		const coplanar = isTriangleCoplanar( triA, triB );
		splitter.splitByTriangle( triB, coplanar );

	} else {

		// CDTTriangleSplitter (PolygonSplitter)
		splitter.initialize( triA, 0, 1, 2 );

		const coplanar = isTriangleCoplanar( triA, triB );
		if ( coplanar ) {

			const edges = [];
			const count = getCoplanarIntersectionEdges( triA, triB, edges );
			for ( let i = 0; i < count; i ++ ) {

				splitter.addConstraintEdge( edges[ i ] );

			}

		} else {

			const edge = new Line3();
			const extA = new ExtendedTriangle();
			extA.copy( triA );
			extA.update();
			const extB = new ExtendedTriangle();
			extB.copy( triB );
			extB.update();

			if ( extA.intersectsTriangle( extB, edge, true ) ) {

				splitter.addConstraintEdge( edge );

			}

		}

		splitter.triangulate();

	}

	return splitter.triangles;

}

// ---------------------------------------------------------------------------
// Parameterized test suite
// ---------------------------------------------------------------------------

const splitters = [
	[ 'LegacyTriangleSplitter', LegacyTriangleSplitter ],
	[ 'CDTTriangleSplitter', CDTTriangleSplitter ],
];

describe.each( splitters )( '%s', ( _name, SplitterClass ) => {

	it( 'should not split non-intersecting triangles.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 0, 0, 2 ),
			new Vector3( 1, 0, 2 ),
			new Vector3( 0, 1, 2 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results ).toHaveLength( 1 );

	} );

	it( 'should split coplanar overlapping triangles.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 2, 0, 0 ),
			new Vector3( 0, 2, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 1, 0, 0 ),
			new Vector3( 3, 0, 0 ),
			new Vector3( 1, 2, 0 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 2 );

	} );

	it( 'should handle coplanar identical triangles.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 1 );

	} );

	it( 'should handle vertex-on-edge intersection.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 2, 0, 0 ),
			new Vector3( 1, 2, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 1, 0, - 1 ),
			new Vector3( 1, 0, 1 ),
			new Vector3( 1, 2, 1 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 1 );

	} );

	it( 'should handle vertex-on-vertex (shared vertex).', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 0, 0, 1 ),
			new Vector3( 0, 1, 0 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 1 );

	} );

	it( 'should handle edge-on-edge overlap (shared collinear edge).', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0.5, 1, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0.5, - 1, 0 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 1 );

	} );

	it( 'should split on clean bisection.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 2, 0, 0 ),
			new Vector3( 1, 2, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 1, - 1, - 1 ),
			new Vector3( 1, - 1, 1 ),
			new Vector3( 1, 3, 0 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results.length ).toBeGreaterThanOrEqual( 2 );

	} );

	it( 'should not split near-miss triangles.', () => {

		const triA = new Triangle(
			new Vector3( 0, 0, 0 ),
			new Vector3( 1, 0, 0 ),
			new Vector3( 0, 1, 0 ),
		);
		const triB = new Triangle(
			new Vector3( 0, 0, 0.001 ),
			new Vector3( 1, 0, 0.001 ),
			new Vector3( 0, 1, 0.001 ),
		);

		const results = splitTriangle( SplitterClass, triA, triB );
		validateSplitResult( triA, results );
		expect( results ).toHaveLength( 1 );

	} );

	describe( 'fuzz tests', () => {

		it( 'should satisfy invariants for 100 random triangle pairs.', () => {

			let testedCount = 0;
			const random = mulberry32( 42 );
			const randomVec = () => new Vector3(
				( random() - 0.5 ) * 2,
				( random() - 0.5 ) * 2,
				( random() - 0.5 ) * 2,
			);

			for ( let i = 0; i < 100; i ++ ) {

				const triA = new Triangle( randomVec(), randomVec(), randomVec() );
				const triB = new Triangle( randomVec(), randomVec(), randomVec() );

				// Skip degenerate input triangles
				if ( triangleArea( triA ) < 1e-10 || triangleArea( triB ) < 1e-10 ) continue;

				const results = splitTriangle( SplitterClass, triA, triB );
				validateSplitResult( triA, results );
				testedCount ++;

			}

			expect( testedCount ).toBeGreaterThan( 0 );

		} );

	} );

} );
