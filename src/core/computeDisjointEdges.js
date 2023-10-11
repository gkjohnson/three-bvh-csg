import { Vector3, Ray } from 'three';
import { areDistancesDegenerate, isEdgeDegenerate, sortEdgeFunc, toEdgeIndex, toTriIndex } from './utils/halfEdgeUtils.js';
import { hashRay, toNormalizedRay } from './utils/hashUtils.js';

const _tempVec = new Vector3();
const _v0 = new Vector3();
const _v1 = new Vector3();
const _ray = new Ray();

export function computeDisjointEdges(
	geometry,
	unmatchedSet,
) {

	const attributes = geometry.attributes;
	const indexAttr = geometry.index;
	const posAttr = attributes.position;

	const disjointConnectivityMap = new Map();
	const fragmentMap = new Map();
	const edges = Array.from( unmatchedSet );

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

		_v0.fromBufferAttribute( posAttr, i0 );
		_v1.fromBufferAttribute( posAttr, i1 );

		// The ray will be pointing in the direction related to the triangles
		// winding direction. The opposite edge will have an inverted ray
		// direction
		toNormalizedRay( _v0, _v1, _ray );

		const invRay = _ray.clone();
		invRay.direction.multiplyScalar( - 1 );

		const hash = hashRay( _ray );
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
				ray: _ray.clone(),
				otherHash: invHash,
			};
			arr = info.edges;
			fragmentMap.set( hash, info );

		}

		const infoRay = info.ray;
		let start = _tempVec.subVectors( _v0, infoRay.origin ).dot( infoRay.direction );
		let end = _tempVec.subVectors( _v1, infoRay.origin ).dot( infoRay.direction );
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

	return {
		disjointConnectivityMap,
		fragmentMap,
	};

}


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
