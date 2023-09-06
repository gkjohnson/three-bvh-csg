import { Vector2, Vector3, Vector4 } from 'three';
import { hashNumber, hashVertex2, hashVertex3, hashVertex4 } from '../utils/hashUtils.js';
import { getTriCount } from './utils.js';

const _vec2 = new Vector2();
const _vec3 = new Vector3();
const _vec4 = new Vector4();
const _hashes = [ '', '', '' ];

export class HalfEdgeMap {

	constructor( geometry = null ) {

		this.data = null;
		this.unmatchedEdges = null;
		this.matchedEdges = null;
		this.useDrawRange = true;
		this.useAllAttributes = false;

		if ( geometry ) {

			this.updateFrom( geometry );

		}

	}

	getSiblingTriangleIndex( triIndex, edgeIndex ) {

		const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
		return otherIndex === - 1 ? - 1 : ~ ~ ( otherIndex / 3 );

	}

	getSiblingEdgeIndex( triIndex, edgeIndex ) {

		const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
		return otherIndex === - 1 ? - 1 : ( otherIndex % 3 );

	}

	updateFrom( geometry ) {

		const { useAllAttributes, useDrawRange } = this;
		const hashFunction = useAllAttributes ? hashAllAttributes : hashPositionAttribute;

		// runs on the assumption that there is a 1 : 1 match of edges
		const map = new Map();

		// attributes
		const { attributes } = geometry;
		const indexAttr = geometry.index;
		const posAttr = attributes.position;

		// get the potential number of triangles
		let triCount = getTriCount( geometry );
		const maxTriCount = triCount;

		// get the real number of triangles from the based on the draw range
		let offset = 0;
		if ( useDrawRange ) {

			offset = geometry.drawRange.start;
			if ( geometry.drawRange.count !== Infinity ) {

				triCount = ~ ~ ( geometry.drawRange.count / 3 );

			}

		}

		// initialize the connectivity buffer - 1 means no connectivity
		let data = this.data;
		if ( ! data || data.length < 3 * maxTriCount ) {

			data = new Int32Array( 3 * maxTriCount );

		}

		data.fill( - 1 );

		// iterate over all triangles
		let unmatchedEdges = 0;
		let matchedEdges = 0;
		for ( let i = offset, l = triCount * 3 + offset; i < l; i += 3 ) {

			const i3 = i;
			for ( let e = 0; e < 3; e ++ ) {

				let i0 = i3 + e;
				if ( indexAttr ) {

					i0 = indexAttr.getX( i0 );

				}

				_hashes[ e ] = hashFunction( i0 );

			}

			for ( let e = 0; e < 3; e ++ ) {

				const nextE = ( e + 1 ) % 3;
				const vh0 = _hashes[ e ];
				const vh1 = _hashes[ nextE ];

				const reverseHash = `${ vh1 }_${ vh0 }`;
				if ( map.has( reverseHash ) ) {

					// create a reference between the two triangles and clear the hash
					const otherIndex = map.get( reverseHash );
					data[ i3 + e ] = otherIndex;
					data[ otherIndex ] = i3 + e;
					map.delete( reverseHash );
					unmatchedEdges --;
					matchedEdges += 2;

				} else {

					// save the triangle and triangle edge index captured in one value
					// triIndex = ~ ~ ( i0 / 3 );
					// edgeIndex = i0 % 3;
					const hash = `${ vh0 }_${ vh1 }`;
					map.set( hash, i3 + e );
					unmatchedEdges ++;

				}

			}

		}

		this.matchedEdges = matchedEdges;
		this.unmatchedEdges = unmatchedEdges;
		this.data = data;

		function hashPositionAttribute( i ) {

			_vec3.fromBufferAttribute( posAttr, i );
			return hashVertex3( _vec3 );

		}

		function hashAllAttributes( i ) {

			let result = '';
			for ( const key in attributes ) {

				const attr = attributes[ key ];
				let str;
				switch ( attr.itemSize ) {

					case 1:
						str = hashNumber( attr.getX( i ) );
						break;
					case 2:
						str = hashVertex2( _vec2.fromBufferAttribute( attr, i ) );
						break;
					case 3:
						str = hashVertex3( _vec3.fromBufferAttribute( attr, i ) );
						break;
					case 4:
						str = hashVertex4( _vec4.fromBufferAttribute( attr, i ) );
						break;

				}

				if ( result !== '' ) {

					result += '|';

				}

				result += str;

			}

			return result;

		}

	}

}
