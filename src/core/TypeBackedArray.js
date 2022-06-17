// Make a new array wrapper class that more easily affords expansion when reaching it's max capacity
export class TypeBackedArray {

	constructor( type, initialSize = 500 ) {

		this.expansionFactor = 1.5;
		this.type = type;
		this.array = new type( initialSize );
		this.length = 0;

	}

	expand( size = null ) {

		const { type, array, expansionFactor } = this;

		if ( size === null ) {

			size = ~ ~ ( array.length * expansionFactor );

		}

		const newArray = new type( size );
		newArray.set( array, 0 );
		this.array = newArray;

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
