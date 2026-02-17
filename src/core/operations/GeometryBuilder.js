import { TypeBackedArray } from '../TypeBackedArray.js';
import { Vector3, Vector4, BufferAttribute } from 'three';

const _vec3 = new Vector3();
const _vec3_0 = new Vector3();
const _vec3_1 = new Vector3();
const _vec3_2 = new Vector3();

const _vec4 = new Vector4();
const _vec4_0 = new Vector4();
const _vec4_1 = new Vector4();
const _vec4_2 = new Vector4();

function getBarycoordValue( a, b, c, barycoord, target, normalize = false, invert = false ) {

	target.set( 0, 0, 0, 0 )
		.addScaledVector( a, barycoord.x )
		.addScaledVector( b, barycoord.y )
		.addScaledVector( c, barycoord.z );

	if ( normalize ) {

		target.normalize();

	}

	if ( invert ) {

		target.multiplyScalar( - 1 );

	}

	return target;

}

function pushItemSize( vec, itemSize, target ) {

	switch ( itemSize ) {

		case 1:
			target.push( vec.x );
			break;

		case 2:
			target.push( vec.x, vec.y );
			break;

		case 3:
			target.push( vec.x, vec.y, vec.z );
			break;

		case 4:
			target.push( vec.x, vec.y, vec.z, vec.w );
			break;

	}

}

class AttributeData extends TypeBackedArray {

	get count() {

		return this.length / this.itemSize;

	}

	constructor( ...args ) {

		super( ...args );
		this.itemSize = 1;
		this.normalized = false;


	}

}

export class GeometryBuilder {

	constructor() {

		this.attributeData = {};
		this.groupIndices = [];
		this.forwardIndexMap = new Map();
		this.invertedIndexMap = new Map();
		this.interpolatedFields = {};

	}

	initFromGeometry( referenceGeometry, relevantAttributes ) {

		this.clear();

		// initialize and clear unused data from the attribute buffers and vice versa
		const { attributeData } = this;
		const refAttributes = referenceGeometry.attributes;
		for ( let i = 0, l = relevantAttributes.length; i < l; i ++ ) {

			const key = relevantAttributes[ i ];
			const refAttr = refAttributes[ key ];
			const type = refAttr.array.constructor;
			if ( ! attributeData[ key ] ) {

				attributeData[ key ] = new AttributeData( type );

			}

			attributeData[ key ].setType( type );
			attributeData[ key ].itemSize = refAttr.itemSize;
			attributeData[ key ].normalized = refAttr.normalized;

		}

		for ( const key in attributeData.attributes ) {

			if ( ! relevantAttributes.includes( key ) ) {

				attributeData.delete( key );

			}

		}

	}

	// init and cache all the attribute data for the given indices so we can use it to append interpolated attribute data
	initInterpolatedAttributeData( geometry, matrix, normalMatrix, i0, i1, i2 ) {

		const { attributeData, interpolatedFields } = this;
		const { attributes } = geometry;

		for ( const key in attributeData ) {

			const attr = attributes[ key ];
			if ( ! attr ) {

				throw new Error( `CSG Operations: Attribute ${ key } not available on geometry.` );

			}

			// handle normals and positions specially because they require transforming
			let v0, v1, v2;
			if ( key === 'position' ) {

				v0 = _vec3_0.fromBufferAttribute( attr, i0 ).applyMatrix4( matrix );
				v1 = _vec3_1.fromBufferAttribute( attr, i1 ).applyMatrix4( matrix );
				v2 = _vec3_2.fromBufferAttribute( attr, i2 ).applyMatrix4( matrix );

			} else if ( key === 'normal' ) {

				v0 = _vec3_0.fromBufferAttribute( attr, i0 ).applyNormalMatrix( normalMatrix );
				v1 = _vec3_1.fromBufferAttribute( attr, i1 ).applyNormalMatrix( normalMatrix );
				v2 = _vec3_2.fromBufferAttribute( attr, i2 ).applyNormalMatrix( normalMatrix );

			} else if ( key === 'tangent' ) {

				v0 = _vec3_0.fromBufferAttribute( attr, i0 ).transformDirection( matrix );
				v1 = _vec3_1.fromBufferAttribute( attr, i1 ).transformDirection( matrix );
				v2 = _vec3_2.fromBufferAttribute( attr, i2 ).transformDirection( matrix );

			} else {

				v0 = _vec4_0.fromBufferAttribute( attr, i0 );
				v1 = _vec4_1.fromBufferAttribute( attr, i1 );
				v2 = _vec4_2.fromBufferAttribute( attr, i2 );

			}

			if ( ! interpolatedFields[ key ] ) {

				interpolatedFields[ key ] = [ v0.clone(), v1.clone(), v2.clone() ];

			} else {

				const fields = interpolatedFields[ key ];
				fields[ 0 ].copy( v0 );
				fields[ 1 ].copy( v1 );
				fields[ 2 ].copy( v2 );

			}

		}

	}

	// push data from the given barycoord onto the geometry
	appendInterpolatedAttributeData( group, barycoord, index = null, invert = false ) {

		const { groupIndices, attributeData, interpolatedFields, forwardIndexMap, invertedIndexMap } = this;
		while ( groupIndices.length <= group ) {

			groupIndices.push( new AttributeData( Uint32Array ) );

		}

		const indexMap = invert ? invertedIndexMap : forwardIndexMap;
		const indexData = groupIndices[ group ];
		if ( index !== null && indexMap.has( index ) ) {

			indexData.push( indexMap.get( index ) );

		} else {

			indexMap.set( index, attributeData.position.count );
			indexData.push( attributeData.position.count );

			for ( const key in interpolatedFields ) {

				// handle normals and positions specially because they require transforming
				const arr = attributeData[ key ];
				const isDirection = key === 'normal' || key === 'tangent';
				const invertVector = invert && isDirection;
				const itemSize = arr.itemSize;
				const [ v0, v1, v2 ] = interpolatedFields[ key ];
				getBarycoordValue( v0, v1, v2, barycoord, _vec4, isDirection, invertVector );
				pushItemSize( _vec4, itemSize, arr );

			}

		}

	}

	// append the given vertex index from the source geometry to this one
	appendIndexFromGeometry( geometry, matrix, normalMatrix, group, index, invert = false ) {

		const { groupIndices, attributeData, forwardIndexMap, invertedIndexMap } = this;
		while ( groupIndices.length <= group ) {

			groupIndices.push( new AttributeData( Uint32Array ) );

		}

		const indexMap = invert ? invertedIndexMap : forwardIndexMap;
		const indexData = groupIndices[ group ];
		if ( index !== null && indexMap.has( index ) ) {

			indexData.push( indexMap.get( index ) );

		} else {

			indexMap.set( index, attributeData.position.count );
			indexData.push( attributeData.position.count );

			const { attributes } = geometry;
			for ( const key in attributeData ) {

				const arr = attributeData[ key ];
				const attr = attributes[ key ];
				if ( ! attr ) {

					throw new Error( `CSG Operations: Attribute ${ key } not available on geometry.` );

				}

				// specially handle the position and normal attributes because they require transforms
				const itemSize = attr.itemSize;
				if ( key === 'position' ) {

					_vec3.fromBufferAttribute( attr, index ).applyMatrix4( matrix );
					arr.push( _vec3.x, _vec3.y, _vec3.z );

				} else if ( key === 'normal' ) {

					_vec3.fromBufferAttribute( attr, index ).applyNormalMatrix( normalMatrix );
					if ( invert ) {

						_vec3.multiplyScalar( - 1 );

					}

					arr.push( _vec3.x, _vec3.y, _vec3.z );

				} else if ( key === 'tangent' ) {

					_vec3.fromBufferAttribute( attr, index ).transformDirection( matrix );
					if ( invert ) {

						_vec3.multiplyScalar( - 1 );

					}

					arr.push( _vec3.x, _vec3.y, _vec3.z );

				} else {

					_vec4.fromBufferAttribute( attr, index );
					pushItemSize( _vec4, itemSize, arr );

				}

			}

		}

	}

	buildGeometry( target, groupOrder ) {

		let needsDisposal = false;
		const { groupIndices, attributeData } = this;
		const { attributes, index } = target;
		for ( const key in attributeData ) {

			const arr = attributeData[ key ];
			const { type, itemSize, normalized, length, count } = arr;
			const buffer = arr.array.buffer;

			let attr = attributes[ key ];
			if ( ! attr || attr.count < count || attr.array.type !== type ) {

				// create the attribute if it doesn't exist yet
				attr = new BufferAttribute( new type( length ), itemSize, normalized );
				target.setAttribute( key, attr );
				needsDisposal = true;

			}

			// copy the data
			attr.array.set( new type( buffer, 0, length ), 0 );
			attr.needsUpdate = true;

		}

		// remove or update the index appropriately
		const indexCount = groupIndices.reduce( ( v, arr ) => arr.count + v, 0 );
		if ( ! target.index || index.count < indexCount || index.array.type !== Uint32Array ) {

			target.setIndex( new BufferAttribute( new Uint32Array( indexCount ), 1 ) );
			needsDisposal = true;

		}

		// initialize the groups
		target.clearGroups();

		let offset = 0;
		for ( let i = 0, l = Math.min( groupOrder.length, groupIndices.length ); i < l; i ++ ) {

			const { index, materialIndex } = groupOrder[ i ];
			const { count } = groupIndices[ index ];
			const buffer = groupIndices[ index ].array.buffer;
			if ( count !== 0 ) {

				target.index.array.set( new Uint32Array( buffer, 0, count ), offset );
				target.addGroup( offset, count, materialIndex );
				offset += count;

			}

		}

		// update the draw range
		target.setDrawRange( 0, offset );

		// remove the bounds tree if it exists because its now out of date
		// TODO: can we have this dispose in the same way that a brush does?
		// TODO: why are half edges and group indices not removed here?
		target.boundsTree = null;
		target.boundingBox = null;
		target.boundingSphere = null;

		if ( needsDisposal ) {

			target.dispose();

		}

	}

	clearIndexMap() {

		this.forwardIndexMap.clear();
		this.invertedIndexMap.clear();

	}

	clear() {

		const { groupIndices, attributeData } = this;

		this.interpolatedFields = {};

		for ( const key in attributeData ) {

			attributeData[ key ].clear();

		}

		groupIndices.forEach( arr => {

			arr.clear();

		} );
		this.clearIndexMap();

	}

}
