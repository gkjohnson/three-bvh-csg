import { Ray, Line3, Vector3 } from 'three';
import { HalfEdgeMap } from './HalfEdgeMap.js';

const EPSILON = 1e-10;
const HASH_MULTIPLIER = ( 1 + 1e-10 ) * 1e2;
const _ray = new Ray();
const _reverseRay = new Ray();
const _distanceRay = new Ray();
const _line = new Line3();
const _vec = new Vector3();

function toNormalizedRay( v0, v1, targetRay ) {

	targetRay.direction.subVectors( v1, v0 ).normalize();
	targetRay.origin
		.copy( v0 )
		.addScaledVector( targetRay.direction, - v0.dot( targetRay.direction ) );

	return targetRay;

}

function hashVertex( v ) {

	const x = ~ ~ ( v.x * HASH_MULTIPLIER );
	const y = ~ ~ ( v.y * HASH_MULTIPLIER );
	const z = ~ ~ ( v.z * HASH_MULTIPLIER );

	return `${ x },${ y },${ z }`;

}

function hashEdge( v0, v1 ) {

	return `${ hashVertex( v0 ) }_${ hashVertex( v1 ) }`;

}

function hashRay( ray ) {

	return hashEdge( ray.origin, ray.direction );

}

function removeOverlap( arr, a, connectionMap = null ) {

	for ( let i = 0; i < arr.length; i ++ ) {

		const b = arr[ i ];
		console.log( a, b );
		if ( a.end < b.start ) {

			continue;

		} else if ( a.start > b.end ) {

			break;

		} else if ( a.start < b.start ) {

			if ( a.end > b.end ) {

				// a extends over b on both ends
				// should never get here if our mesh is formed correctly
				b.start = b.end;

			} else {

				const tmp = a.end;
				a.end = b.start;
				b.start = tmp;

			}

		} else if ( b.start < a.start ) {

			if ( b.end > a.end ) {

				// b is longer than a
				const toInsert = {
					index: b.index,
					start: a.end,
					end: b.end,
				};

				b.end = a.start;
				a.start = a.end;
				arr.splice( i, 0, toInsert );

			} else {

				const tmp = a.end;
				a.end = b.start;
				b.start = tmp;

			}

		} else if ( a.start === b.start && a.end === b.end ) {

			a.start = a.end;
			b.start = b.end;

		}

		if ( b.end - b.start <= EPSILON ) {

			arr.splice( i, 1 );
			i --;

		}

		if ( connectionMap ) {

			connectionMap.addConnection( a.index, b.index );

		}

		if ( a.end - a.start <= EPSILON ) {

			return true;

		}

	}

	return a.end - a.start <= EPSILON;

}

class EdgeMap extends Map {

	addConnection( a, b ) {

		if ( ! this.has( a ) ) {

			this.set( a, new Set() );

		}

		if ( ! this.has( b ) ) {

			this.set( b, new Set() );

		}

		this.get( a ).add( b );
		this.get( b ).add( a );

	}

}

export class FragmentedHalfEdgeMap {

	constructor() {

		this.edgeMap = null;
		this.matchedEdges = 0;
		this.unmatchedEdges = 0;

	}

	*getSiblingIndices( triIndex, edgeIndex, target = {} ) {

		const set = this.edgeMap.get( 3 * triIndex + edgeIndex );
		for ( const value of set ) {

			const e = value % 3;
			const t = ( value - e ) / 3;
			target.edgeIndex = e;
			target.triIndex = t;
			yield target;

		}

	}

	updateFrom( geometry, unmatchedEdgeSet = null ) {

		if ( ! unmatchedEdgeSet ) {

			unmatchedEdgeSet = new Set();
			new HalfEdgeMap().updateFrom( geometry, unmatchedEdgeSet );

		}

		const { attributes } = geometry;
		const indexAttr = geometry.index;
		const posAttr = attributes.position;

		// get the edge distances
		const edgeDistanceMap = new Map();
		for ( const value of unmatchedEdgeSet ) {

			// get the triangle edge indices
			const edgeIndex = value % 3;
			const triIndex = ( value - edgeIndex ) / 3;
			let i0 = 3 * triIndex + edgeIndex;
			let i1 = 3 * triIndex + ( edgeIndex + 1 ) % 3;
			if ( indexAttr ) {

				i0 = indexAttr.getX( i0 );
				i1 = indexAttr.getX( i1 );

			}

			// get the triangle edge
			_line.start.fromBufferAttribute( posAttr, i0 );
			_line.end.fromBufferAttribute( posAttr, i1 );

			// get a normalized ray
			toNormalizedRay( _line.start, _line.end, _ray );
			toNormalizedRay( _line.end, _line.start, _reverseRay );

			const hash = hashRay( _ray );
			const reverseHash = hashRay( _reverseRay );

			if ( edgeDistanceMap.has( reverseHash ) ) {

				_distanceRay.copy( edgeDistanceMap.get( reverseHash ).ray );

			} else {

				_distanceRay.copy( _ray );

			}

			// add a distance bounces for the edge
			if ( ! edgeDistanceMap.has( hash ) ) {

				edgeDistanceMap.set( hash, {
					reverseHash,
					ray: _distanceRay.clone(),
					edges: [],
				} );

			}

			// push the edge distances onto the ray set so they can be used later
			const list = edgeDistanceMap.get( hash );
			let start = _vec.subVectors( _line.start, _distanceRay.origin ).dot( _distanceRay.direction );
			let end = _vec.subVectors( _line.end, _distanceRay.origin ).dot( _distanceRay.direction );
			if ( end < start ) {

				const tmp = start;
				start = end;
				end = tmp;

			}

			list.edges.push( {
				index: value,
				start,
				end,
			} );

		}

		// sort the edges in ascending order
		for ( const [ _, value ] of edgeDistanceMap ) {

			const { edges } = value;
			edges.sort( ( a, b ) => a.start - b.start );

		}

		// try to find accumulated matching edges
		const connections = new EdgeMap();
		for ( const [ _, value ] of edgeDistanceMap ) {

			const { reverseHash, edges } = value;
			if ( ! edgeDistanceMap.has( reverseHash ) ) {

				continue;

			}

			const otherEdges = edgeDistanceMap.get( reverseHash ).edges;
			for ( let i = 0; i < edges.length; i ++ ) {

				// find matches - remove the element if it's been full matched
				const fullyMatched = removeOverlap( otherEdges, edges[ i ], connections );
				if ( fullyMatched ) {

					edges.splice( i, 1 );
					i --;

				}


			}

		}

		this.matchedEdges = connections.size;
		this.unmatchedEdges = unmatchedEdgeSet.size - connections.size;
		this.edgeMap = connections;

	}

}
