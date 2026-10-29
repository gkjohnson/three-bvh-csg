import { Line3, Matrix4, Triangle, Vector3 } from 'three';
import { CDTTriangleSplitter } from '../src/core/CDTTriangleSplitter.js';

// Procedural synthetic inputs only. The zero endpoint lies on the oblique
// source edge; a project/lift round trip moves it away from zero.
function fixture( matrix = new Matrix4() ) {

	const point = ( x, y, z ) => new Vector3( x, y, z ).applyMatrix4( matrix );
	return {
		base: new Triangle( point( - 1, - 1, 0 ), point( 1, 1, 0 ), point( - 1, 1, 1 ) ),
		edge: new Line3( point( 0, 0, 0 ), point( - 1, 0, 0.5 ) ),
	};

}

const points = splitter => splitter.triangles.flatMap( t => [ t.a, t.b, t.c ] );

describe( 'CDTTriangleSplitter endpoint positions', () => {

	for ( const [ name, matrix ] of [
		[ 'oblique', new Matrix4() ],
		[ 'rotated', new Matrix4().makeRotationAxis( new Vector3( 1, 2, 3 ).normalize(), 0.37 ) ],
		[ 'translated', new Matrix4().makeTranslation( 1000, - 1000, 1000 ) ],
		[ 'small', new Matrix4().makeScale( 0.001, 0.001, 0.001 ) ],
		[ 'large', new Matrix4().makeScale( 1000, 1000, 1000 ) ],
	] ) {

		it( `retains the original 3D corners and constraint endpoints: ${ name }`, () => {

			const { base, edge } = fixture( matrix );
			const before = [ base.a, base.b, base.c, edge.start, edge.end ].map( p => p.clone() );
			const splitter = new CDTTriangleSplitter();
			splitter.initialize( base, 10, 20, 30 );
			splitter.addConstraintEdge( edge );
			splitter.triangulate();

			for ( const p of before ) {

				expect( points( splitter ).some( q => q.equals( p ) ) ).toBe( true );

			}

			expect( [ base.a, base.b, base.c, edge.start, edge.end ] ).toEqual( before );
			// Existing geometry-index identities are retained for the three corners.
			for ( const index of [ 10, 20, 30 ] ) expect( splitter.triangleIndices.flat() ).toContain( index );

		} );

	}

	it( 'does not introduce nonzero Float32 coordinates at the zero endpoint', () => {

		const { base, edge } = fixture();
		const splitter = new CDTTriangleSplitter();
		splitter.initialize( base );
		splitter.addConstraintEdge( edge );
		splitter.triangulate();
		expect( points( splitter ).some( p => p.toArray().every( c => Math.fround( c ) === 0 ) ) ).toBe( true );

	} );

	it( 'still lifts newly constructed 2D crossings', () => {

		const splitter = new CDTTriangleSplitter();
		splitter.initialize( new Triangle( new Vector3(), new Vector3( 4, 0, 0 ), new Vector3( 0, 4, 0 ) ) );
		splitter.addConstraintEdge( new Line3( new Vector3( 1, 0, 0 ), new Vector3( 1, 3, 0 ) ) );
		splitter.addConstraintEdge( new Line3( new Vector3( 0, 1, 0 ), new Vector3( 3, 1, 0 ) ) );
		splitter.triangulate();
		expect( points( splitter ).some( p => p.equals( new Vector3( 1, 1, 0 ) ) ) ).toBe( true );
		expect( points( splitter ).every( p => p.toArray().every( Number.isFinite ) ) ).toBe( true );

	} );

	it( 'does not retain endpoint positions across initialize/reset', () => {

		const splitter = new CDTTriangleSplitter();
		for ( const shift of [ 0, 10, - 10, 0 ] ) {

			const { base, edge } = fixture( new Matrix4().makeTranslation( shift, 0, 0 ) );
			splitter.initialize( base );
			splitter.addConstraintEdge( edge );
			splitter.triangulate();
			expect( points( splitter ).some( p => p.equals( edge.start ) ) ).toBe( true );
			expect( points( splitter ).every( p => p.x >= shift - 1 && p.x <= shift + 1 ) ).toBe( true );

		}

	} );

	it( 'keeps the existing near-endpoint merge policy and first representative', () => {

		const splitter = new CDTTriangleSplitter();
		splitter.initialize( new Triangle( new Vector3(), new Vector3( 4, 0, 0 ), new Vector3( 0, 4, 0 ) ) );
		splitter.addConstraintEdge( new Line3( new Vector3( 1, 0, 0 ), new Vector3( 1, 2, 0 ) ) );
		splitter.addConstraintEdge( new Line3( new Vector3( 1 + 1e-10, 0, 0 ), new Vector3( 1 + 1e-10, 2, 0 ) ) );
		splitter.triangulate();
		expect( points( splitter ).some( p => p.x === 1 ) ).toBe( true );
		expect( points( splitter ).some( p => p.x === 1 + 1e-10 ) ).toBe( false );

	} );

} );
