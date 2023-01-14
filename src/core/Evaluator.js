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
	const rootAttrSet = attributeInfo.groupAttributes[ 0 ];
	for ( const key in rootAttrSet ) {

		const requiredLength = attributeInfo.getTotalLength( key, groupCount );
		const type = rootAttrSet[ key ].type;
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

			const { array, type, length } = attributeInfo.groupAttributes[ i ][ key ];
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

function getMaterialList( groups, materials ) {

	let result = materials;
	if ( ! Array.isArray( materials ) ) {

		result = [];
		groups.forEach( g => {

			result[ g.materialIndex ] = materials;

		} );

	}

	return result;

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

		const { triangleSplitter, attributeData, attributes, useGroups, debug } = this;
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

		performOperation( a, b, operation, triangleSplitter, attributeData, { useGroups } );

		if ( debug.enabled ) {

			setDebugContext( null );

		}

		// structure the groups appropriately
		const aGroups = ! useGroups || a.geometry.groups.length === 0 ?
			[ { start: 0, count: Infinity, materialIndex: 0 } ] :
			a.geometry.groups.map( group => ( { ...group } ) );

		const bGroups = ! useGroups || b.geometry.groups.length === 0 ?
			[ { start: 0, count: Infinity, materialIndex: 0 } ] :
			b.geometry.groups.map( group => ( { ...group } ) );

		// get the materials
		const aMaterials = getMaterialList( aGroups, a.material );
		const bMaterials = getMaterialList( bGroups, b.material );

		// adjust the material index
		bGroups.forEach( g => {

			g.materialIndex += aMaterials.length;

		} );

		// apply groups and attribute data to the geometry
		applyToGeometry( targetGeometry, a.geometry, [ ...aGroups, ...bGroups ], attributeData );

		// generate the minimum set of materials needed for the list of groups and adjust the groups
		// if they're needed
		const groups = targetGeometry.groups;
		if ( useGroups ) {

			const materialMap = new Map();
			const allMaterials = [ ...aMaterials, ...bMaterials ];

			// create a map from old to new index and remove materials that aren't used
			let newIndex = 0;
			for ( let i = 0, l = allMaterials.length; i < l; i ++ ) {

				const foundGroup = Boolean( groups.find( group => group.materialIndex === i ) );
				if ( ! foundGroup ) {

					allMaterials[ i ] = null;

				} else {

					materialMap.set( i, newIndex );
					newIndex ++;

				}

			}

			// adjust the groups indices
			for ( let i = 0, l = groups.length; i < l; i ++ ) {

				const group = groups[ i ];
				group.materialIndex = materialMap.get( group.materialIndex );

			}

			targetBrush.material = allMaterials.filter( material => material );

		}

		return targetBrush;

	}

	evaluateHierarchy( root, target = new Brush() ) {

		root.updateMatrixWorld( true );

		const flatTraverse = ( obj, cb ) => {

			const children = obj.children;
			for ( let i = 0, l = children.length; i < l; i ++ ) {

				const child = children[ i ];
				if ( child.isOperationGroup ) {

					flatTraverse( child, cb );

				} else {

					cb( child );

				}

			}

		};


		const traverse = brush => {

			const children = brush.children;
			let didChange = false;
			for ( let i = 0, l = children.length; i < l; i ++ ) {

				const child = children[ i ];
				didChange = traverse( child ) || didChange;

			}

			const isDirty = brush.isDirty();
			if ( isDirty ) {

				brush.markUpdated();

			}

			if ( didChange && ! brush.isOperationGroup ) {

				let result;
				flatTraverse( brush, child => {

					if ( ! result ) {

						result = this.evaluate( brush, child, child.operation );

					} else {

						result = this.evaluate( result, child, child.operation );

					}

				} );

				brush._cachedGeometry = result.geometry;
				brush._cachedMaterials = result.material;
				return true;

			} else {

				return didChange || isDirty;

			}

		};

		traverse( root );

		target.geometry = root._cachedGeometry;
		target.material = root._cachedMaterials;

		return target;

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
