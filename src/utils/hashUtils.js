const HASH_MULTIPLIER = 1e6;
const HASH_WIDTH = 1e-6;
const HASH_HALF_WIDTH = HASH_WIDTH * 0.5;
const HASH_ADDITION = HASH_HALF_WIDTH * HASH_MULTIPLIER;
export function hashNumber( v ) {

	return ~ ~ ( v * HASH_MULTIPLIER + HASH_ADDITION );

}

export function hashVertex2( v ) {

	return `${ hashNumber( v.x ) },${ hashNumber( v.y ) }`;

}

export function hashVertex3( v ) {

	return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) }`;

}

export function hashVertex4( v ) {

	return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) },${ hashNumber( v.w ) }`;

}
