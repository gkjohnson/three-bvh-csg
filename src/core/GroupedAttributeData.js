import { TypedAttributeData } from './TypedAttributeData.js';

export class GroupedAttributeArray {

	constructor() {

		this.groups = [ new TypedAttributeData() ];
		this.initialSize = null;

	}

	pushValues( name, group, ...values ) {

		const { groups } = this;
		if ( group >= groups.length ) {

			const newAttr = new TypedAttributeData();
			const ogAttr = groups[ 0 ];
			for ( const name in ogAttr.attributes ) {

				newAttr.initializeArray( name, ogAttr.attributes[ name ].type, this.initialSize || undefined );

			}

		}

		const groupAttr = groups[ group ][ name ];
		groupAttr.push( ...values );

	}

	getType( key ) {

		return this.groups[ key ].type;

	}

	initializeArray( name, type ) {

		this.groups.forEach( attr => attr.initializeArray( name, type, this.initialSize || undefined ) );

	}

	clear() {

		this.groups.forEach( attr => attr.clear() );

	}

	delete( key ) {

		this.groups.forEach( attr => attr.delete( key ) );

	}

	reset() {

		this.groups = [];

	}

}
