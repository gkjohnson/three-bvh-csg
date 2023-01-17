import { Ray, Line3, Vector3 } from 'three';
import { HalfEdgeMap } from './HalfEdgeMap.js';
import { hashRay } from '../utils/hashUtils.js';

const EPSILON = 1e-4;
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

function removeOverlap( otherArr, arr, index, eps = EPSILON, connectionMap = null ) {

	const a = arr[ index ];
	for ( let i = 0; i < otherArr.length; i ++ ) {

		const b = otherArr[ i ];
		if ( a.end < b.start ) {

			// all of "A" comes before "B"
			continue;

		} else if ( a.start > b.end ) {

			// all of "A" comes after "B"
			continue;

		} else if ( a.start <= b.start ) {

			if ( a.end > b.end ) {

				// "A" extends over "B" on both ends
				arr.splice( index + 1, 0, {

					index: a.index,
					start: b.end,
					end: a.end,

				} );
				a.end = b.start;
				b.start = b.end;

			} else {

				// "A" extends over the first section of "B"
				const tmp = a.end;
				a.end = b.start;
				b.start = tmp;

			}

		} else if ( b.start < a.start ) {

			if ( b.end > a.end ) {

				// "B" extends over "A" on both ends
				otherArr.splice( i + 1, 0, {
					index: b.index,
					start: a.end,
					end: b.end,
				} );
				b.end = a.start;
				a.start = a.end;

			} else {

				// "B" extends over the first section of "A"
				const tmp = b.end;
				b.end = a.start;
				a.start = tmp;

			}

		} else if ( a.start === b.start && a.end === b.end ) {

			a.start = a.end;
			b.start = b.end;

		}

		if ( b.end - b.start <= eps ) {

			const res = otherArr.splice( i, 1 );
			i --;

		}

		if ( connectionMap ) {

			connectionMap.addConnection( a.index, b.index );

		}

		if ( a.end - a.start <= eps ) {

			return true;

		}

	}

	return a.end - a.start <= eps;

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
		this.epsilon = EPSILON;

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

		const { attributes } = geometry;
		const indexAttr = geometry.index;
		const posAttr = attributes.position;
		if ( ! unmatchedEdgeSet ) {

			unmatchedEdgeSet = new Set();
			new HalfEdgeMap().updateFrom( geometry, unmatchedEdgeSet );

		}

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

			const { reverseHash, edges, TOTAL } = value;
			if ( ! edgeDistanceMap.has( reverseHash ) ) {

				continue;

			}

			const otherEdges = edgeDistanceMap.get( reverseHash ).edges;
			for ( let i = 0; i < edges.length; i ++ ) {

				// find matches - remove the element if it's been full matched
				const fullyMatched = removeOverlap( otherEdges, edges, i, this.epsilon, connections );
				if ( fullyMatched ) {

					edges.splice( i, 1 );
					i --;

				}

			}

		}

		const stillUnmatchedEdgeSet = new Set();
		for ( const [ _, value ] of edgeDistanceMap ) {

			const { edges } = value;
			if ( edges.length !== 0 ) {

				edges.forEach( e => {

					stillUnmatchedEdgeSet.add( e.index );

				} );

			}

		}

		this.unmatchedEdges = stillUnmatchedEdgeSet.size;
		this.matchedEdges = unmatchedEdgeSet.size - stillUnmatchedEdgeSet.size;
		this.edgeMap = connections;

	}

}
