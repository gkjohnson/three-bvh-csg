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

function getBarycoordValue( a, b, c, barycoord, target, normalize = false ) {

	target.set( 0, 0, 0, 0 )
		.addScaledVector( a, barycoord.a )
		.addScaledVector( b, barycoord.b )
		.addScaledVector( c, barycoord.c );

	if ( normalize ) {

		target.normalize();

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
		this.indexMap = new Map();

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

	appendInterpolatedAttributes( geometry, matrix, normalMatrix, group, i0, i1, i2, b0, b1, b2, invert ) {

		const { groupIndices, attributeData } = this;
		const { attributes } = geometry;

		const indexData = groupIndices[ group ];
		indexData.push( attributeData.position.count );
		indexData.push( attributeData.position.count + 1 );
		indexData.push( attributeData.position.count + 2 );

		for ( const key in attributeData ) {

			const arr = attributeData[ key ];
			const attr = attributes[ key ];
			if ( ! attr ) {

				throw new Error( `CSG Operations: Attribute ${ key } not available on geometry.` );

			}


			// handle normals and positions specially because they require transforming
			let normalize = false;
			const itemSize = arr.itemSize;
			if ( key === 'position' ) {

				_vec3_0.fromBufferAttribute( attr, i0 ).applyMatrix4( matrix );
				_vec3_1.fromBufferAttribute( attr, i1 ).applyMatrix4( matrix );
				_vec3_2.fromBufferAttribute( attr, i2 ).applyMatrix4( matrix );

				_vec4_0.copy( _vec3_0 );
				_vec4_1.copy( _vec3_1 );
				_vec4_2.copy( _vec3_2 );

			} else if ( key === 'normal' ) {

				_vec3_0.fromBufferAttribute( attr, i0 ).applyNormalMatrix( normalMatrix );
				_vec3_1.fromBufferAttribute( attr, i1 ).applyNormalMatrix( normalMatrix );
				_vec3_2.fromBufferAttribute( attr, i2 ).applyNormalMatrix( normalMatrix );

				if ( invert ) {

					_vec3_0.multiplyScalar( - 1 );
					_vec3_1.multiplyScalar( - 1 );
					_vec3_2.multiplyScalar( - 1 );

				}

				_vec4_0.copy( _vec3_0 );
				_vec4_1.copy( _vec3_1 );
				_vec4_2.copy( _vec3_2 );
				normalize = true;

			} else if ( key === 'tangent' ) {

				_vec3_0.fromBufferAttribute( attr, i0 ).transformDirection( matrix );
				_vec3_1.fromBufferAttribute( attr, i1 ).transformDirection( matrix );
				_vec3_2.fromBufferAttribute( attr, i2 ).transformDirection( matrix );

				if ( invert ) {

					_vec3_0.multiplyScalar( - 1 );
					_vec3_1.multiplyScalar( - 1 );
					_vec3_2.multiplyScalar( - 1 );

				}

				_vec4_0.copy( _vec3_0 );
				_vec4_1.copy( _vec3_1 );
				_vec4_2.copy( _vec3_2 );
				normalize = true;

			} else {

				_vec4_0.fromBufferAttribute( attr, i0 );
				_vec4_1.fromBufferAttribute( attr, i1 );
				_vec4_2.fromBufferAttribute( attr, i2 );

			}

			getBarycoordValue( _vec4_0, _vec4_1, _vec4_2, b0, _vec4, normalize );
			pushItemSize( _vec4, itemSize, arr );

			if ( invert ) {

				getBarycoordValue( _vec4_0, _vec4_1, _vec4_2, b2, _vec4, normalize );
				pushItemSize( _vec4, itemSize, arr );

				getBarycoordValue( _vec4_0, _vec4_1, _vec4_2, b1, _vec4, normalize );
				pushItemSize( _vec4, itemSize, arr );

			} else {

				getBarycoordValue( _vec4_0, _vec4_1, _vec4_2, b1, _vec4, normalize );
				pushItemSize( _vec4, itemSize, arr );

				getBarycoordValue( _vec4_0, _vec4_1, _vec4_2, b2, _vec4, normalize );
				pushItemSize( _vec4, itemSize, arr );

			}

		}

	}

	appendIndexFromGeometry( geometry, matrix, normalMatrix, group, index, invert = false ) {

		const { groupIndices, attributeData, indexMap } = this;
		while ( groupIndices.length < group ) {

			groupIndices.push( new AttributeData( Uint32Array ) );

		}

		const indexData = groupIndices[ group ];
		if ( index !== null && indexMap.has( index ) ) {

			indexData.push( indexMap.get( index ) );

		} else {

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

					arr.push( attr.getX( index ) );
					if ( itemSize > 1 ) arr.push( attr.getY( index ) );
					if ( itemSize > 2 ) arr.push( attr.getZ( index ) );
					if ( itemSize > 3 ) arr.push( attr.getW( index ) );

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
			const { type, itemSize, normalized, length, count, buffer } = arr;

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
		for ( let i = 0, l = Math.min( groupOrder.length, attributeData.groupCount ); i < l; i ++ ) {

			const { index, materialIndex } = groupOrder[ i ];
			const { count, buffer } = groupIndices[ index ];
			if ( count !== 0 ) {

				target.index.array.set( new Uint32Array( buffer, offset * Uint32Array.BYTES_PER_ELEMENT, count ), 0 );
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

		if ( needsDisposal ) {

			target.dispose();

		}

	}

	clearIndexMap() {

		this.indexMap.clear();

	}

	clear() {

		this.attributeData.clear();
		this.groupIndices.forEach( arr => {

			arr.clear();

		} );
		this.clearIndexMap();

	}

}
