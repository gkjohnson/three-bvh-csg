import { Vector3 } from 'three';

const DEGENERATE_EPSILON = 1e-8;
const _tempVec = new Vector3();

export function toTriIndex( v ) {

	return ~ ~ ( v / 3 );

}

export function toEdgeIndex( v ) {

	return v % 3;

}

export function sortEdgeFunc( a, b ) {

	return a.start - b.start;

}

export function getProjectedDistance( ray, vec ) {

	return _tempVec.subVectors( vec, ray.origin ).dot( ray.direction );

}

export function hasOverlaps( arr ) {

	arr = [ ...arr ].sort( sortEdgeFunc );
	for ( let i = 0, l = arr.length; i < l - 1; i ++ ) {

		const info0 = arr[ i ];
		const info1 = arr[ i + 1 ];

		if ( info1.start < info0.end && Math.abs( info1.start - info0.end ) > 1e-5 ) {

			return true;

		}

	}

	return false;

}

export function getEdgeSetLength( arr ) {

	let tot = 0;
	arr.forEach( ( { start, end } ) => tot += end - start );
	return tot;

}

export function matchEdges( forward, reverse, disjointConnectivityMap, eps = DEGENERATE_EPSILON ) {

	forward.sort( sortEdgeFunc );
	reverse.sort( sortEdgeFunc );

	for ( let i = 0; i < forward.length; i ++ ) {

		const e0 = forward[ i ];
		for ( let o = 0; o < reverse.length; o ++ ) {

			const e1 = reverse[ o ];
			if ( e1.start > e0.end ) {

				// e2 is completely after e1
				// break;

				// NOTE: there are cases where there are overlaps due to precision issues or
				// thin / degenerate triangles. Assuming the sibling side has the same issues
				// we let the matching work here. Long term we should remove the degenerate
				// triangles before this.

			} else if ( e0.end < e1.start || e1.end < e0.start ) {

				// e1 is completely before e2
				continue;

			} else if ( e0.start <= e1.start && e0.end >= e1.end ) {

				// e1 is larger than and e2 is completely within e1
				if ( ! areDistancesDegenerate( e1.end, e0.end ) ) {

					forward.splice( i + 1, 0, {
						start: e1.end,
						end: e0.end,
						index: e0.index,
					} );

				}

				e0.end = e1.start;

				e1.start = 0;
				e1.end = 0;

			} else if ( e0.start >= e1.start && e0.end <= e1.end ) {

				// e2 is larger than and e1 is completely within e2
				if ( ! areDistancesDegenerate( e0.end, e1.end ) ) {

					reverse.splice( o + 1, 0, {
						start: e0.end,
						end: e1.end,
						index: e1.index,
					} );

				}

				e1.end = e0.start;

				e0.start = 0;
				e0.end = 0;

			} else if ( e0.start <= e1.start && e0.end <= e1.end ) {

				// e1 overlaps e2 at the beginning
				const tmp = e0.end;
				e0.end = e1.start;
				e1.start = tmp;

			} else if ( e0.start >= e1.start && e0.end >= e1.end ) {

				// e1 overlaps e2 at the end
				const tmp = e1.end;
				e1.end = e0.start;
				e0.start = tmp;

			} else {

				throw new Error();

			}

			// Add the connectivity information
			if ( ! disjointConnectivityMap.has( e0.index ) ) {

				disjointConnectivityMap.set( e0.index, [] );

			}

			if ( ! disjointConnectivityMap.has( e1.index ) ) {

				disjointConnectivityMap.set( e1.index, [] );

			}

			disjointConnectivityMap
				.get( e0.index )
				.push( e1.index );

			disjointConnectivityMap
				.get( e1.index )
				.push( e0.index );

			if ( isEdgeDegenerate( e1 ) ) {

				reverse.splice( o, 1 );
				o --;

			}

			if ( isEdgeDegenerate( e0 ) ) {

				// and if we have to remove the current original edge then exit this loop
				// so we can work on the next one
				forward.splice( i, 1 );
				i --;
				break;

			}

		}

	}

	cleanUpEdgeSet( forward );
	cleanUpEdgeSet( reverse );

	function cleanUpEdgeSet( arr ) {

		for ( let i = 0; i < arr.length; i ++ ) {

			if ( isEdgeDegenerate( arr[ i ] ) ) {

				arr.splice( i, 1 );
				i --;

			}

		}

	}

	function areDistancesDegenerate( start, end ) {

		return Math.abs( end - start ) < eps;

	}

	function isEdgeDegenerate( e ) {

		return Math.abs( e.end - e.start ) < eps;

	}

}
