// Finite coplanar classification only. Exact signs of orthogonal-projection
// barycentrics on the supplied binary64 coordinates; no distance tolerance and
// no change to the already established supporting-plane relationship.
// In particular, a negative rounded Gram determinant numerator is not proof
// of an outside point. All arithmetic below is operation-local.
const buffer = new DataView( new ArrayBuffer( 8 ) );

export function finiteTriangleContains( triangle, point ) {

	const values = [ triangle.a, triangle.b, triangle.c, point ].flatMap( p => p.toArray() );
	let scale = Infinity;
	const parts = values.map( value => {

		if ( ! Number.isFinite( value ) ) throw new RangeError( 'Nonfinite containment input.' );
		buffer.setFloat64( 0, value );
		const bits = buffer.getBigUint64( 0 );
		const exponent = Number( ( bits >> 52n ) & 2047n );
		const mantissa = ( bits & 0xfffffffffffffn ) | ( exponent ? 0x10000000000000n : 0n );
		const power = exponent ? exponent - 1075 : - 1074;
		if ( mantissa !== 0n ) scale = Math.min( scale, power );
		return [ bits >> 63n ? - mantissa : mantissa, power ];

	} );
	if ( scale === Infinity ) return false;
	const ints = parts.map( ( [ m, e ] ) => m === 0n ? 0n : m << BigInt( e - scale ) );
	const [ a, b, c, p ] = [ 0, 3, 6, 9 ].map( i => ints.slice( i, i + 3 ) );
	const sub = ( u, v ) => u.map( ( x, i ) => x - v[ i ] );
	const cross = ( u, v ) => [ u[ 1 ] * v[ 2 ] - u[ 2 ] * v[ 1 ], u[ 2 ] * v[ 0 ] - u[ 0 ] * v[ 2 ], u[ 0 ] * v[ 1 ] - u[ 1 ] * v[ 0 ] ];
	const dot = ( u, v ) => u.reduce( ( sum, x, i ) => sum + x * v[ i ], 0n );
	const normal = cross( sub( b, a ), sub( c, a ) );
	if ( normal.every( x => x === 0n ) ) return false;
	return [[ a, b ], [ b, c ], [ c, a ]].every( ( [ u, v ] ) => dot( normal, cross( sub( v, u ), sub( p, u ) ) ) >= 0n );

}
