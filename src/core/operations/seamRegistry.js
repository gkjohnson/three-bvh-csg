// Canonical seam-vertex registry (per Evaluator.evaluate / performOperation).
//
// The intersection curve between the two operands is where A's retained surface meets
// B's (flipped) surface. Each operand triangulates that curve in its own base-triangle
// frame, so the SAME curve point is reconstructed at slightly different positions on the
// two sides (and across adjacent triangles), leaving the seam non-watertight no matter
// how the result is welded afterwards.
//
// This registry gives every intersection-curve vertex ONE canonical position, clustered
// within a tolerance. collectIntersectingTriangles registers the curve's segment
// endpoints; the split passes call registerSeam on each emitted vertex, which returns the
// canonical position for any vertex within tolerance of an already-registered one. Both
// operands then emit identical coordinates along the seam, so it welds exactly.
//
// Buckets use an integer spatial hash (no per-lookup string allocation) and the own cell
// is probed first, so the common "already registered" case returns after one bucket.

let _cells = new Map();
let _tol = 3e-4;
let _inv = 1 / _tol;
let _enabled = false;

// integer spatial hash of a cell coordinate; collisions are resolved by the per-bucket
// distance test, so a hash is sufficient (no exact-cell key needed).
function _hash( cx, cy, cz ) {

	return ( ( cx * 73856093 ) ^ ( cy * 19349663 ) ^ ( cz * 83492791 ) ) | 0;

}

export function resetSeamRegistry( tolerance ) {

	_enabled = !! tolerance && tolerance > 0;
	_tol = tolerance || 3e-4;
	_inv = 1 / _tol;
	_cells = new Map();

}

// Register a curve vertex (or look one up). Returns the canonical [x,y,z] — the first
// vertex in a cluster becomes the representative and later nearby vertices collapse onto
// it. Returns null when the registry is disabled.
export function registerSeam( x, y, z ) {

	if ( ! _enabled ) return null;

	const cx = Math.floor( x * _inv ), cy = Math.floor( y * _inv ), cz = Math.floor( z * _inv );
	const t2 = _tol * _tol;

	// probe the own cell first (the common hit), then the 26 neighbours
	for ( let oi = 0; oi < 27; oi ++ ) {

		const dx = OFF[ 3 * oi ], dy = OFF[ 3 * oi + 1 ], dz = OFF[ 3 * oi + 2 ];
		const b = _cells.get( _hash( cx + dx, cy + dy, cz + dz ) );
		if ( b ) for ( let i = 0, l = b.length; i < l; i += 3 ) {

			const ex = b[ i ] - x, ey = b[ i + 1 ] - y, ez = b[ i + 2 ] - z;
			if ( ex * ex + ey * ey + ez * ez < t2 ) return [ b[ i ], b[ i + 1 ], b[ i + 2 ] ];

		}

	}

	const key = _hash( cx, cy, cz );
	let b = _cells.get( key );
	if ( ! b ) { b = []; _cells.set( key, b ); }
	b.push( x, y, z );
	return [ x, y, z ];

}

// neighbour offsets with (0,0,0) first
const OFF = ( () => {

	const a = [ 0, 0, 0 ];
	for ( let dx = - 1; dx <= 1; dx ++ )
		for ( let dy = - 1; dy <= 1; dy ++ )
			for ( let dz = - 1; dz <= 1; dz ++ )
				if ( dx !== 0 || dy !== 0 || dz !== 0 ) a.push( dx, dy, dz );
	return a;

} )();
