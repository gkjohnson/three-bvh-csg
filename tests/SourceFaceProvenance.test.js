import { BoxGeometry, Matrix4 } from 'three';
import { Brush } from '../src/core/Brush.js';
import { getSourceFaces, prepareSourceFaces, sourceFaceMapper } from '../src/core/operations/SourceFaceProvenance.js';

function fixture() {

	const brush = new Brush( new BoxGeometry() );
	brush.updateMatrixWorld( true );
	return brush;

}

function dispose( brush ) {

	brush.disposeCacheData();
	brush.geometry.dispose();

}

describe( 'SourceFaceProvenance', () => {

	it( 'does not invent history merely by reading a new geometry', () => {

		const brush = fixture();
		try {

			expect( getSourceFaces( brush.geometry ) ).toBeNull();

		} finally {

			dispose( brush );

		}

	} );

	it( 'keeps immutable source tokens across unchanged preparation and cache eviction', () => {

		const brush = fixture();
		try {

			const faces = prepareSourceFaces( brush );
			expect( faces ).toHaveLength( 12 );
			expect( Object.isFrozen( getSourceFaces( brush.geometry ) ) ).toBe( true );
			expect( Object.isFrozen( faces[ 0 ].source ) ).toBe( true );
			expect( Object.isFrozen( faces[ 0 ].source.points ) ).toBe( true );
			expect( prepareSourceFaces( brush )[ 0 ].source ).toBe( faces[ 0 ].source );
			brush.disposeCacheData();
			expect( prepareSourceFaces( brush )[ 0 ].source ).toBe( faces[ 0 ].source );

		} finally {

			dispose( brush );

		}

	} );

	it.each( [
		[ 'raw positions', g => g.attributes.position.array[ 0 ] += 0.25 ],
		[ 'raw indices', g => g.index.array[ 0 ] = g.index.array[ 1 ] ],
		[ 'draw range', g => g.setDrawRange( 3, 3 ) ],
		[ 'groups', g => g.groups[ 0 ].materialIndex ++ ],
	] )( 'invalidates stale history after changes to %s without version updates', ( name, mutate ) => {

		const brush = fixture();
		try {

			prepareSourceFaces( brush );
			mutate( brush.geometry );
			expect( getSourceFaces( brush.geometry ) ).toBeNull();

		} finally {

			dispose( brush );

		}

	} );

	it( 'maps frames and inversion without changing source identity or retaining a parent chain', () => {

		const brush = fixture();
		try {

			const faces = prepareSourceFaces( brush );
			const matrix = new Matrix4().makeScale( - 1, 2, 1 );
			const map = sourceFaceMapper( faces, matrix );
			const forward = map( 0, false ), reverse = map( 0, true );
			expect( forward.source ).toBe( faces[ 0 ].source );
			expect( reverse.source ).toBe( faces[ 0 ].source );
			expect( forward.orientation ).toBe( 1 );
			expect( reverse.orientation ).toBe( - 1 );
			expect( forward.frame ).toEqual( matrix.elements );
			expect( reverse.frame ).toBe( forward.frame );
			expect( Object.isFrozen( forward.frame ) ).toBe( true );
			expect( map( 0, false ) ).toBe( forward );
			expect( Object.keys( forward ).sort() ).toEqual( [ 'frame', 'orientation', 'source' ] );

		} finally {

			dispose( brush );

		}

	} );

	it( 'distinguishes sharing geometry from cloning it and clears disposed geometry history', () => {

		const brush = fixture();
		const clone = brush.geometry.clone();
		try {

			const faces = prepareSourceFaces( brush );
			const shared = new Brush( brush.geometry );
			expect( getSourceFaces( shared.geometry )[ 0 ].source ).toBe( faces[ 0 ].source );
			expect( getSourceFaces( clone ) ).toBeNull();
			brush.geometry.dispose();
			expect( getSourceFaces( brush.geometry ) ).toBeNull();

		} finally {

			clone.dispose();
			dispose( brush );

		}

	} );

} );
