const HASH_MULTIPLIER = ( 1 + 1e-10 ) * 1e5;

export function hashNumber( v ) {

	return ~ ~ ( v * HASH_MULTIPLIER );

}

export function hashVertex( v ) {

	return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) }`;

}

export function hashEdge( v0, v1 ) {

	return `${ hashVertex( v0 ) }_${ hashVertex( v1 ) }`;

}

export function hashRay( ray ) {

	return hashEdge( ray.origin, ray.direction );

}
