import { TypeBackedArray } from './TypeBackedArray.js';

// utility class for for tracking attribute data in type-backed arrays
export class TypedAttributeData {

	constructor() {

		this.groupAttributes = [ {} ];
		this.groupCount = 0;

	}

	getType( name ) {

		return this.groupAttributes[ 0 ][ name ].type;

	}

	getTotalLength( name ) {

		const { groupCount, groupAttributes } = this;

		let length = 0;
		for ( let i = 0; i < groupCount; i ++ ) {

			const attrSet = groupAttributes[ i ];
			length += attrSet[ name ].length;

		}

		return length;

	}

	getGroupSet( index = 0 ) {

		// throw an error if we've never
		const { groupAttributes } = this;
		if ( groupAttributes[ index ] ) {

			this.groupCount = Math.max( this.groupCount, index + 1 );
			return groupAttributes[ index ];

		}

		// add any new group sets required
		const rootAttrSet = groupAttributes[ 0 ];
		this.groupCount = Math.max( this.groupCount, index + 1 );
		while ( index >= groupAttributes.length ) {

			const newAttrSet = {};
			groupAttributes.push( newAttrSet );
			for ( const key in rootAttrSet ) {

				newAttrSet[ key ] = new TypeBackedArray( rootAttrSet[ key ].type );

			}

		}

		return groupAttributes[ index ];

	}

	getGroupArray( name, index = 0 ) {

		// throw an error if we've never
		const { groupAttributes } = this;
		const rootAttrSet = groupAttributes[ 0 ];
		const referenceAttr = rootAttrSet[ name ];
		if ( ! referenceAttr ) {

			throw new Error( `TypedAttributeData: Attribute with "${ name }" has not been initialized` );

		}

		return this.getGroupSet( index )[ name ];

	}

	// initializes an attribute array with the given name, type, and size
	initializeArray( name, type ) {

		const { groupAttributes } = this;
		const rootSet = groupAttributes[ 0 ];
		const referenceAttr = rootSet[ name ];
		if ( referenceAttr ) {

			if ( referenceAttr.type !== type ) {

				throw new Error( `TypedAttributeData: Array ${ name } already initialized with a different type.` );

			}

		} else {

			for ( let i = 0, l = groupAttributes.length; i < l; i ++ ) {

				groupAttributes[ i ][ name ] = new TypeBackedArray( type );

			}

		}

	}

	clear() {

		this.groupCount = 0;

		const { groupAttributes } = this;
		groupAttributes.forEach( attrSet => {

			for ( const key in attrSet ) {

				attrSet[ key ].clear();

			}


		} );

	}

	delete( key ) {

		this.groupAttributes.forEach( attrSet => {

			delete attrSet[ key ];

		} );

	}

	reset() {

		this.groupAttributes = [];

	}

}
