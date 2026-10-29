// Local predicate for a proven shared clip endpoint, not a proximity test.
// Every finite binary64 is an integer multiple of 2^-1074. Common scaling
// cancels in the sign of n dot ((b-a) cross (p-a)); no rounded subtraction.
const buffer = new DataView( new ArrayBuffer( 8 ) );
function integer( value ) {

	if ( ! Number.isFinite( value ) ) throw new RangeError( 'Nonfinite clip predicate input.' );
	buffer.setFloat64( 0, value );
	const bits = buffer.getBigUint64( 0 );
	const exponent = Number( ( bits >> 52n ) & 2047n );
	const mantissa = ( bits & 0xfffffffffffffn ) | ( exponent ? 0x10000000000000n : 0n );
	return ( bits >> 63n ? - mantissa : mantissa ) << BigInt( exponent ? exponent - 1 : 0 );

}

export function exactEndpointSide( normal, a, b, point ) {

	const n = normal.toArray().map( integer );
	const origin = a.toArray().map( integer );
	const e = b.toArray().map( ( x, i ) => integer( x ) - origin[ i ] );
	const p = point.toArray().map( ( x, i ) => integer( x ) - origin[ i ] );
	const d = n[ 0 ] * ( e[ 1 ] * p[ 2 ] - e[ 2 ] * p[ 1 ] ) +
		n[ 1 ] * ( e[ 2 ] * p[ 0 ] - e[ 0 ] * p[ 2 ] ) +
		n[ 2 ] * ( e[ 0 ] * p[ 1 ] - e[ 1 ] * p[ 0 ] );
	return d > 0n ? 1 : d < 0n ? - 1 : 0;

}
