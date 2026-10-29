// Exact winding of a CDT cell centroid in the materialized Float32 boundary.
// Internal constraints are deliberately absent: they partition, not define, the
// source face domain. The centroid is kept as a rational sum / 3 (no rounding).
export function directedDomain( cells, points, boundary ) {

	const scalar = new Float32Array( 1 ), bits = new Uint32Array( scalar.buffer );
	const cache = new Map();
	function integer( value ) {

		if ( ! cache.has( value ) ) {

			scalar[ 0 ] = value;
			if ( ! Number.isFinite( value ) || scalar[ 0 ] !== value ) throw new Error( 'Domain coordinates must be finite Float32.' );
			const b = bits[ 0 ], exponent = ( b >>> 23 ) & 255;
			const mantissa = BigInt( ( b & 0x7fffff ) | ( exponent ? 0x800000 : 0 ) );
			cache.set( value, ( b >>> 31 ? - mantissa : mantissa ) << BigInt( exponent ? exponent - 1 : 0 ) );

		}

		return cache.get( value );

	}

	const vertices = points.map( p => p.map( integer ) );
	const edges = boundary.map( e => [ e.start, e.end ].map( p => [ 3n * integer( p.x ), 3n * integer( p.y ) ] ) );
	return cells.filter( cell => {

		const x = cell.reduce( ( sum, i ) => sum + vertices[ i ][ 0 ], 0n );
		const y = cell.reduce( ( sum, i ) => sum + vertices[ i ][ 1 ], 0n );
		let winding = 0;
		for ( const [ a, b ] of edges ) {

			const cross = ( b[ 0 ] - a[ 0 ] ) * ( y - a[ 1 ] ) - ( b[ 1 ] - a[ 1 ] ) * ( x - a[ 0 ] );
			if ( a[ 1 ] <= y && y < b[ 1 ] && cross > 0n ) winding ++;
			if ( b[ 1 ] <= y && y < a[ 1 ] && cross < 0n ) winding --;

		}

		if ( winding < 0 || winding > 1 ) throw new Error( 'Non-simple directed source domain.' );
		return winding === 1;

	} );

}
