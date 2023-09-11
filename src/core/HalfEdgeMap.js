import { Vector2, Vector3, Vector4 } from 'three';
import { hashNumber, hashRay, hashVertex2, hashVertex3, hashVertex4, toNormalizedRay } from './utils/hashUtils.js';
import { getTriCount } from './utils/geometryUtils.js';
import { Ray } from 'three';
import { sortEdgeFunc, toTriIndex, toEdgeIndex, isEdgeDegenerate, areDistancesDegenerate } from './utils/halfEdgeUtils.js';

const _vec2 = new Vector2();
const _vec3 = new Vector3();
const _vec4 = new Vector4();
const _hashes = [ '', '', '' ];
const _tempVec = new Vector3();

function matchEdges( edges, others, disjointConnectivityMap ) {

	edges.sort( sortEdgeFunc );
	others.sort( sortEdgeFunc );

	for ( let i = 0; i < edges.length; i ++ ) {

		const e1 = edges[ i ];
		for ( let o = 0; o < others.length; o ++ ) {

			const e2 = others[ o ];
			if ( e2.start > e1.end ) {

				// e2 is completely after e1
				break;

			}

			if ( e1.end < e2.start || e2.end < e1.start ) {

				// e1 is completely before e2
				continue;

			}

			if ( e1.start <= e2.start && e1.end >= e2.end ) {

				// e1 is larger than and e2 is completely within e1
				if ( ! areDistancesDegenerate( e2.end, e1.end ) ) {

					edges.splice( i + 1, 0, {
						start: e2.end,
						end: e1.end,
						index: e1.index,
					} );

				}

				e1.end = e2.start;

				e2.start = 0;
				e2.end = 0;

			} else if ( e1.start >= e2.start && e1.end <= e2.end ) {

				// e2 is larger than and e1 is completely within e2
				if ( ! areDistancesDegenerate( e1.end, e2.end ) ) {

					others.splice( o + 1, 0, {
						start: e1.end,
						end: e2.end,
						index: e2.index,
					} );

				}

				e2.end = e1.start;

				e1.start = 0;
				e1.end = 0;

			} else if ( e1.start <= e2.start && e1.end <= e2.end ) {

				// e1 overlaps e2 at the beginning
				const tmp = e1.end;
				e1.end = e2.start;
				e2.start = tmp;

			} else if ( e1.start >= e2.start && e1.end >= e2.end ) {

				// e1 overlaps e2 at the end
				const tmp = e2.end;
				e2.end = e1.start;
				e1.start = tmp;

			} else {

				throw new Error();

			}


			// Add the connectivity information
			if ( ! disjointConnectivityMap.has( e1.index ) ) {

				disjointConnectivityMap.set( e1.index, [] );

			}

			if ( ! disjointConnectivityMap.has( e2.index ) ) {

				disjointConnectivityMap.set( e2.index, [] );

			}

			disjointConnectivityMap
				.get( e1.index )
				.push( e2.index );

			disjointConnectivityMap
				.get( e2.index )
				.push( e1.index );

			if ( isEdgeDegenerate( e2 ) ) {

				others.splice( o, 1 );
				o --;

			}

			if ( isEdgeDegenerate( e1 ) ) {

				// and if we have to remove the current original edge then exit this loop
				// so we can work on the next one
				edges.splice( i, 1 );
				i --;
				break;

			}

		}

	}

}

export class HalfEdgeMap {

	constructor( geometry = null ) {

		// result data
		this.data = null;
		this.disjointConnections = null;
		this.unmatchedDisjointEdges = null;
		this.unmatchedEdges = - 1;
		this.matchedEdges = - 1;

		// options
		this.useDrawRange = true;
		this.useAllAttributes = false;
		this.matchDisjointEdges = false;

		if ( geometry ) {

			this.updateFrom( geometry );

		}

	}

	// TODO: can these be faster for use in the CSG operations
	getSiblingTriangleIndex( triIndex, edgeIndex ) {

		const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
		return otherIndex === - 1 ? - 1 : ~ ~ ( otherIndex / 3 );

	}

	getSiblingEdgeIndex( triIndex, edgeIndex ) {

		const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
		return otherIndex === - 1 ? - 1 : ( otherIndex % 3 );

	}

	getDisjointSiblingTriangleIndices( triIndex, edgeIndex ) {

		const index = triIndex * 3 + edgeIndex;
		const arr = this.disjointConnections.get( index );
		return arr ? arr.map( i => ~ ~ ( i / 3 ) ) : [];

	}

	getDisjointSiblingEdgeIndices( triIndex, edgeIndex ) {

		const index = triIndex * 3 + edgeIndex;
		const arr = this.disjointConnections.get( index );
		return arr ? arr.map( i => i % 3 ) : [];

	}

	updateFrom( geometry ) {

		const { useAllAttributes, useDrawRange, matchDisjointEdges } = this;
		const hashFunction = useAllAttributes ? hashAllAttributes : hashPositionAttribute;

		// runs on the assumption that there is a 1 : 1 match of edges
		const map = new Map();

		// attributes
		const { attributes } = geometry;
		const attrKeys = useAllAttributes ? Object.keys( attributes ) : null;
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
		let matchedEdges = 0;
		let unmatchedSet = new Set();
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
					const index = i3 + e;
					const otherIndex = map.get( reverseHash );
					data[ index ] = otherIndex;
					data[ otherIndex ] = index;
					map.delete( reverseHash );
					matchedEdges += 2;
					unmatchedSet.delete( otherIndex );

				} else {

					// save the triangle and triangle edge index captured in one value
					// triIndex = ~ ~ ( i0 / 3 );
					// edgeIndex = i0 % 3;
					const hash = `${ vh0 }_${ vh1 }`;
					const index = i3 + e;
					map.set( hash, index );
					unmatchedSet.add( index );

				}

			}

		}

		if ( matchDisjointEdges ) {

			const disjointConnectivityMap = new Map();
			const fragmentMap = new Map();
			const edges = Array.from( unmatchedSet );
			const v0 = new Vector3();
			const v1 = new Vector3();
			const ray = new Ray();
			for ( let i = 0, l = edges.length; i < l; i ++ ) {

				const index = edges[ i ];
				const triIndex = toTriIndex( index );
				const edgeIndex = toEdgeIndex( index );

				let i0 = 3 * triIndex + edgeIndex;
				let i1 = 3 * triIndex + ( edgeIndex + 1 ) % 3;
				if ( indexAttr ) {

					i0 = indexAttr.getX( i0 );
					i1 = indexAttr.getX( i1 );

				}

				v0.fromBufferAttribute( posAttr, i0 );
				v1.fromBufferAttribute( posAttr, i1 );

				// The ray will be pointing in the direction related to the triangles
				// winding direction. The opposite edge will have an inverted ray
				// direction
				toNormalizedRay( v0, v1, ray );

				const invRay = ray.clone();
				invRay.direction.multiplyScalar( - 1 );

				const hash = hashRay( ray );
				const invHash = hashRay( invRay );

				let info, arr;
				if ( fragmentMap.has( hash ) ) {

					info = fragmentMap.get( hash );
					arr = info.edges;

				} else if ( fragmentMap.has( invHash ) ) {

					info = fragmentMap.get( invHash );
					arr = fragmentMap.get( invHash ).others;

				} else {

					info = {
						edges: [],
						others: [],
						ray: ray.clone(),
						otherHash: invHash,
					};
					arr = info.edges;
					fragmentMap.set( hash, info );

				}

				const infoRay = info.ray;
				let start = _tempVec.subVectors( v0, infoRay.origin ).dot( infoRay.direction );
				let end = _tempVec.subVectors( v1, infoRay.origin ).dot( infoRay.direction );
				if ( start > end ) {

					[ start, end ] = [ end, start ];

				}

				arr.push( { start, end, index } );

			}

			const fields = Array.from( fragmentMap.values() );
			for ( let i = 0, l = fields.length; i < l; i ++ ) {

				const { edges, others } = fields[ i ];
				matchEdges( edges, others, disjointConnectivityMap );

			}

			unmatchedSet.clear();
			fragmentMap.forEach( ( { edges, others }, key ) => {

				edges.forEach( ( { index } ) => unmatchedSet.add( index ) );
				others.forEach( ( { index } ) => unmatchedSet.add( index ) );

				if ( edges.length === 0 && others.length === 0 ) {

					fragmentMap.delete( key );

				}

			} );

			this.unmatchedDisjointEdges = fragmentMap;
			this.disjointConnections = disjointConnectivityMap;

		}

		this.matchedEdges = matchedEdges;
		this.unmatchedEdges = unmatchedSet.size;
		this.data = data;

		function hashPositionAttribute( i ) {

			_vec3.fromBufferAttribute( posAttr, i );
			return hashVertex3( _vec3 );

		}

		function hashAllAttributes( i ) {

			let result = '';
			for ( let k = 0, l = attrKeys.length; k < l; k ++ ) {

				const attr = attributes[ attrKeys[ k ] ];
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
