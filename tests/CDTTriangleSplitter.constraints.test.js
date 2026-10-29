import { Line3, Triangle, Vector3 } from 'three';
import { CDTTriangleSplitter } from '../src/core/CDTTriangleSplitter.js';

const point = ( x, y ) => new Vector3( x, y, 0 );
const base = () => new Triangle( point( 0, 0 ), point( 10, 0 ), point( 0, 10 ) );
const inner = () => [ point( 1, 1 ), point( 2, 1 ), point( 1, 2 ) ];
const key = p => p.toArray().join( ',' );

function addLoop( splitter, points, reverse = false ) {

	const loop = reverse ? [ ...points ].reverse() : points;
	for ( let i = 0; i < loop.length; i ++ ) {

		splitter.addConstraintEdge( new Line3( loop[ i ], loop[ ( i + 1 ) % loop.length ] ) );

	}

}

function expectFilled( splitter, loops = [] ) {

	expect( splitter.triangles.reduce( ( area, t ) => area + t.getArea(), 0 ) ).toBe( 50 );
	const directed = new Map();
	for ( const tri of splitter.triangles ) {

		expect( tri.getNormal( new Vector3() ).z ).toBe( 1 );
		const points = [ tri.a, tri.b, tri.c ];
		for ( const p of points ) {

			expect( p.x >= 0 && p.y >= 0 && p.x + p.y <= 10 && p.z === 0 ).toBe( true );

		}

		for ( let i = 0; i < 3; i ++ ) {

			const edge = `${ key( points[ i ] ) }|${ key( points[ ( i + 1 ) % 3 ] ) }`;
			directed.set( edge, ( directed.get( edge ) || 0 ) + 1 );

		}

	}

	for ( const loop of loops ) for ( let i = 0; i < loop.length; i ++ ) {

		const a = key( loop[ i ] ), b = key( loop[ ( i + 1 ) % loop.length ] );
		expect( directed.get( `${ a }|${ b }` ) ).toBe( 1 );
		expect( directed.get( `${ b }|${ a }` ) ).toBe( 1 );

	}

}

describe( 'CDT constraints subdivide the source triangle rather than cutting holes', () => {

	it( 'retains the unconstrained base triangle', () => {

		const splitter = new CDTTriangleSplitter();
		splitter.initialize( base() );
		splitter.triangulate();
		expectFilled( splitter );
		expect( splitter.triangles ).toHaveLength( 1 );

	} );

	for ( const reverse of [ false, true ] ) {

		it( `fills both sides of a closed internal constraint, reverse=${ reverse }`, () => {

			const splitter = new CDTTriangleSplitter(), loop = inner();
			splitter.initialize( base() );
			addLoop( splitter, loop, reverse );
			splitter.triangulate();
			expectFilled( splitter, [ loop ] );
			expect( splitter.triangles ).toHaveLength( 7 );

		} );

	}

	it( 'retains cells inside nested closed constraints', () => {

		const splitter = new CDTTriangleSplitter();
		const outer = [ point( 1, 1 ), point( 5, 1 ), point( 1, 5 ) ];
		const nested = [ point( 2, 2 ), point( 2.5, 2 ), point( 2, 2.5 ) ];
		splitter.initialize( base() );
		addLoop( splitter, outer );
		addLoop( splitter, nested, true );
		splitter.triangulate();
		expectFilled( splitter, [ outer, nested ] );
		expect( splitter.triangles ).toHaveLength( 13 );

	} );

	it( 'fills separate internal loops without joining classification regions across them', () => {

		const splitter = new CDTTriangleSplitter(), a = inner();
		const b = a.map( p => p.clone().add( new Vector3( 3, 0, 0 ) ) );
		splitter.initialize( base() );
		addLoop( splitter, a ); addLoop( splitter, b );
		splitter.triangulate();
		expectFilled( splitter, [ a, b ] );
		for ( const loop of [ a, b ] ) {

			const index = splitter.triangles.findIndex( t => [ t.a, t.b, t.c ].every( p => loop.some( q => p.equals( q ) ) ) );
			expect( index ).toBeGreaterThanOrEqual( 0 );
			expect( splitter.triangleConnectivity[ index ] ).toEqual( [] );

		}

	} );

	it( 'removes unconstrained exterior cells, not just the infinite face', () => {

		const splitter = new CDTTriangleSplitter();
		splitter.initialize( base() );
		splitter.addConstraintEdge( new Line3( point( 0, 0 ), point( - 1, - 1 ) ) );
		splitter.triangulate();
		expectFilled( splitter );
		expect( splitter.triangles ).toHaveLength( 1 );

	} );

	it( 'does not retain constraints or connectivity when reused for an uncut triangle', () => {

		const splitter = new CDTTriangleSplitter();
		splitter.initialize( base() );
		addLoop( splitter, inner() );
		splitter.triangulate();
		splitter.initialize( base() );
		splitter.triangulate();
		expectFilled( splitter );
		expect( splitter.triangleConnectivity ).toEqual( [[]] );
		expect( splitter.triangleIndices ).toHaveLength( 1 );

	} );

} );
