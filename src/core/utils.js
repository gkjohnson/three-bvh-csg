export function areSharedArrayBuffersSupported() {

	return typeof SharedArrayBuffer !== 'undefined';

}

export function convertToSharedArrayBuffer( array ) {

	if ( array.buffer instanceof SharedArrayBuffer ) {

		return array;

	}

	const cons = array.constructor;
	const buffer = array.buffer;
	const sharedBuffer = new SharedArrayBuffer( buffer.byteLength );

	const uintArray = new Uint8Array( buffer );
	const sharedUintArray = new Uint8Array( sharedBuffer );
	sharedUintArray.set( uintArray, 0 );

	return new cons( sharedBuffer );

}
