const HASH_MULTIPLIER = ( 1 + 1e-7 ) * 1e6;

export function hashNumber( v ) {

	return ~ ~ ( v * HASH_MULTIPLIER );

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
