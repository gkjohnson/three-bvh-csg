// Whole-triangle emission in consistentCutSeams only. Short edges and small
// angles are not degeneracy: test exact collinearity of CURRENT Float32 corners.
// This neither materializes new positions nor changes the collector's predicate.
const scalar = new Float32Array( 1 );
const bits = new Uint32Array( scalar.buffer );

function integer( value ) {

	// Every finite Float32 is an integer multiple of 2^-149.
	scalar[ 0 ] = value;
	const b = bits[ 0 ], exponent = ( b >>> 23 ) & 255;
	const mantissa = BigInt( ( b & 0x7fffff ) | ( exponent ? 0x800000 : 0 ) );
	return ( b >>> 31 ? - mantissa : mantissa ) << BigInt( exponent ? exponent - 1 : 0 );

}

export function isFloat32TriangleDegenerate( tri ) {

	const { a, b, c } = tri;
	for ( const p of [ a, b, c ] ) for ( const v of [ p.x, p.y, p.z ] ) {

		if ( ! Number.isFinite( v ) || Math.fround( v ) !== v ) {

			throw new RangeError( 'Whole-triangle predicate requires finite Float32 coordinates.' );

		}

	}

	const u = [ b.x - a.x, b.y - a.y, b.z - a.z ];
	const v = [ c.x - a.x, c.y - a.y, c.z - a.z ];
	for ( let k = 0; k < 3; k ++ ) {

		const j = ( k + 1 ) % 3;
		const left = u[ k ] * v[ j ], right = u[ j ] * v[ k ];
		// Conservative binary64 arithmetic error bound (two subtractions and
		// one multiplication per term, then subtraction). Float32 inputs keep
		// all nonzero differences/products normal and finite in binary64.
		// This certifies NONZERO only; uncertainty goes to exact integers.
		if ( Math.abs( left - right ) > 8 * Number.EPSILON * ( Math.abs( left ) + Math.abs( right ) ) ) return false;

	}

	const origin = [ a.x, a.y, a.z ].map( integer );
	const ab = [ b.x, b.y, b.z ].map( ( x, i ) => integer( x ) - origin[ i ] );
	const ac = [ c.x, c.y, c.z ].map( ( x, i ) => integer( x ) - origin[ i ] );
	return ab[ 0 ] * ac[ 1 ] === ab[ 1 ] * ac[ 0 ] &&
		ab[ 1 ] * ac[ 2 ] === ab[ 2 ] * ac[ 1 ] &&
		ab[ 2 ] * ac[ 0 ] === ab[ 0 ] * ac[ 2 ];

}
