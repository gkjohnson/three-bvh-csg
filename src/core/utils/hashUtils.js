export const HASH_WIDTH = 1e-6;
const HASH_HALF_WIDTH = HASH_WIDTH * 0.5;
const HASH_MULTIPLIER = Math.pow( 10, - Math.log10( HASH_WIDTH ) );
const HASH_ADDITION = HASH_HALF_WIDTH * HASH_MULTIPLIER;
export function hashNumber( v, multiplier = HASH_MULTIPLIER ) {

	return ~ ~ ( v * multiplier + HASH_ADDITION );

}

export function hashVertex2( v, multiplier = HASH_MULTIPLIER ) {

	return `${ hashNumber( v.x, multiplier ) },${ hashNumber( v.y, multiplier ) }`;

}

export function hashVertex3( v, multiplier = HASH_MULTIPLIER ) {

	return `${ hashNumber( v.x, multiplier ) },${ hashNumber( v.y, multiplier ) },${ hashNumber( v.z, multiplier ) }`;

}

export function hashVertex4( v, multiplier = HASH_MULTIPLIER ) {

	return `${ hashNumber( v.x, multiplier ) },${ hashNumber( v.y, multiplier ) },${ hashNumber( v.z, multiplier ) },${ hashNumber( v.w, multiplier ) }`;

}

export function hashRay( r ) {

	return `${ hashVertex3( r.origin ) }-${ hashVertex3( r.direction ) }`;

}

export function toNormalizedRay( v0, v1, target ) {

	// get a normalized direction
	target
		.direction
		.subVectors( v1, v0 )
		.normalize();

	// project the origin onto the perpendicular plane that
	// passes through 0, 0, 0
	const scalar = v0.dot( target.direction );
	target.
		origin
		.copy( v0 )
		.addScaledVector( target.direction, - scalar );

	return target;

}
