const DEGENERATE_EPSILON = 1e-8;

export function toTriIndex( v ) {

	return ~ ~ ( v / 3 );

}

export function toEdgeIndex( v ) {

	return v % 3;

}

export function sortEdgeFunc( a, b ) {

	return a.start - b.start;

}

export function isEdgeDegenerate( e ) {

	return e.end - e.start < DEGENERATE_EPSILON;

}
