import { areSharedArrayBuffersSupported } from './utils/geometryUtils.js';

function ceilToFourByteStride( byteLength ) {

	byteLength = ~ ~ byteLength;
	return byteLength + 4 - byteLength % 4;

}

// Make a new array wrapper class that more easily affords expansion when reaching it's max capacity
export class TypeBackedArray {

	constructor( type, initialSize = 500 ) {


		this.expansionFactor = 1.5;
		this.type = type;
		this.length = 0;
		this.array = null;

		this.setSize( initialSize );

	}

	setType( type ) {

		if ( this.length !== 0 ) {

			throw new Error( 'TypeBackedArray: Cannot change the type while there is used data in the buffer.' );

		}

		const buffer = this.array.buffer;
		this.array = new type( buffer );
		this.type = type;

	}

	setSize( size ) {

		if ( this.array && size === this.array.length ) {

			return;

		}

		// ceil to the nearest 4 bytes so we can replace the array with any type using the same buffer
		const type = this.type;
		const bufferType = areSharedArrayBuffersSupported() ? SharedArrayBuffer : ArrayBuffer;
		const newArray = new type( new bufferType( ceilToFourByteStride( size * type.BYTES_PER_ELEMENT ) ) );
		if ( this.array ) {

			newArray.set( this.array, 0 );

		}

		this.array = newArray;

	}

	expand() {

		const { array, expansionFactor } = this;
		this.setSize( array.length * expansionFactor );

	}

	push( ...args ) {

		let { array, length } = this;
		if ( length + args.length > array.length ) {

			this.expand();
			array = this.array;

		}

		for ( let i = 0, l = args.length; i < l; i ++ ) {

			array[ length + i ] = args[ i ];

		}

		this.length += args.length;

	}

	clear() {

		this.length = 0;

	}

}
