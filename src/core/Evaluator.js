import { BufferAttribute } from 'three';
import { TriangleSplitter } from './TriangleSplitter.js';
import { TypedAttributeData } from './TypedAttributeData.js';
import { OperationDebugData } from './OperationDebugData.js';
import { performOperation } from './operations.js';
import { setDebugContext } from './operationsUtils.js';
import { Brush } from './Brush.js';

// applies the given set of attribute data to the provided geometry. If the attributes are
// not large enough to hold the new set of data then new attributes will be created. Otherwise
// the existing attributes will be used and draw range updated to accommodate the new size.
function applyToGeometry( geometry, referenceGeometry, groups, attributeInfo ) {

	let needsDisposal = false;
	let drawRange = - 1;
	const groupCount = attributeInfo.groupCount;

	// set the data
	const attributes = geometry.attributes;
	for ( const key in attributeInfo.attributes ) {

		const requiredLength = attributeInfo.getTotalLength( key, groupCount );
		const type = attributeInfo.getGroupArray( key, 0 ).type;
		let attr = attributes[ key ];
		if ( ! attr || attr.array.length < requiredLength ) {

			// create the attribute if it doesn't exist yet
			const refAttr = referenceGeometry.attributes[ key ];
			attr = new BufferAttribute( new type( requiredLength ), refAttr.itemSize, refAttr.normalized );
			geometry.setAttribute( key, attr );
			needsDisposal = true;

		}

		let offset = 0;
		for ( let i = 0; i < groupCount; i ++ ) {

			const { array, type, length } = attributeInfo.getGroupArray( key, i );
			const trimmedArray = new type( array.buffer, 0, length );
			attr.array.set( trimmedArray, offset );
			offset += trimmedArray.length;

		}

		attr.needsUpdate = true;
		drawRange = requiredLength / attr.itemSize;

	}

	// update the draw range
	geometry.setDrawRange( 0, drawRange );
	geometry.clearGroups();

	let groupOffset = 0;
	for ( let i = 0; i < groupCount; i ++ ) {

		const posCount = attributeInfo.getGroupArray( 'position', i ).length / 3;
		if ( posCount !== 0 ) {

			const group = groups[ i ];
			geometry.addGroup( groupOffset, posCount, group.materialIndex );
			groupOffset += posCount;

		}

	}

	// remove or update the index appropriately
	if ( geometry.index ) {

		const indexArray = geometry.index.array;
		if ( indexArray.length < drawRange ) {

			geometry.index = null;
			needsDisposal = true;

		} else {

			for ( let i = 0, l = indexArray.length; i < l; i ++ ) {

				indexArray[ i ] = i;

			}

		}

	}

	// remove the bounds tree if it exists because its now out of date
	// TODO: can we have this dispose in the same way that a brush does?
	geometry.boundsTree = null;

	if ( needsDisposal ) {

		geometry.dispose();

	}

	return geometry;

}

// Utility class for performing CSG operations
export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();
		this.attributeData = new TypedAttributeData();
		this.attributes = [ 'position', 'uv', 'normal' ];
		this.useGroups = true;
		this.debug = new OperationDebugData();

	}

	evaluate( a, b, operation, targetBrush = new Brush() ) {

		a.prepareGeometry();
		b.prepareGeometry();

		const { triangleSplitter, attributeData, attributes, debug } = this;
		const targetGeometry = targetBrush.geometry;
		const aAttributes = a.geometry.attributes;
		for ( let i = 0, l = attributes.length; i < l; i ++ ) {

			const key = attributes[ i ];
			const attr = aAttributes[ key ];
			attributeData.initializeArray( key, attr.array.constructor );

		}

		for ( const key in attributeData.attributes ) {

			if ( ! attributes.includes( key ) ) {

				attributeData.delete( key );

			}

		}

		for ( const key in targetGeometry.attributes ) {

			if ( ! attributes.includes( key ) ) {

				targetGeometry.deleteAttribute( key );
				targetGeometry.dispose();

			}

		}

		attributeData.clear();

		if ( debug.enabled ) {

			debug.reset();
			setDebugContext( debug );

		}

		performOperation( a, b, operation, triangleSplitter, attributeData, { useGroups: this.useGroups } );

		if ( debug.enabled ) {

			setDebugContext( null );

		}

		let aGroups = [];
		let bGroups = [];
		let aMaterials, bMaterials;

		if ( this.useGroups ) {

			aGroups = [ ...a.geometry.groups ].map( g => ( { ...g } ) );
			bGroups = [ ...a.geometry.groups ].map( g => ( { ...g } ) );

			if ( Array.isArray( a.material ) ) {

				aMaterials = a.material;

			} else {

				aMaterials = [];
				a.geometry.groups.forEach( g => {

					aMaterials[ g.materialIndex ] = a.material;

				} );

			}

			if ( Array.isArray( b.material ) ) {

				bMaterials = b.material;

			} else {

				bMaterials = [];
				bGroups.forEach( g => {

					bMaterials[ g.materialIndex ] = b.material;

				} );

			}

			if ( aGroups.length === 0 ) {

				aGroups.push( { start: 0, count: Infinity, materialIndex: 0 } );
				bGroups.push( { start: 0, count: Infinity, materialIndex: 0 } );

			}

			bGroups.forEach( g => {

				g.materialIndex += aMaterials.length;

			} );

		}

		applyToGeometry( targetGeometry, a.geometry, [ ...aGroups, ...bGroups ], attributeData );

		const groups = targetGeometry.groups;
		if ( this.useGroups && groups.length !== 0 ) {

			const materialMap = new Map();
			const allMaterials = [ ...aMaterials, ...bMaterials ].map( ( mat, i ) => {

				return groups.find( group => group.materialIndex === i ) ? mat : null;

			} );

			let newIndex = 0;
			allMaterials.forEach( ( m, i ) => {

				if ( m ) {

					materialMap.set( i, newIndex );
					newIndex ++;

				}

			} );

			groups.forEach( g => {

				g.materialIndex = materialMap.get( g.materialIndex );

			} );

			targetBrush.material = allMaterials.filter( m => m );

		}


		return targetBrush;

	}

	evaluateHierarchy( root ) {

		// TODO

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
