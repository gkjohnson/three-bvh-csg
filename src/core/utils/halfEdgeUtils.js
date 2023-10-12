const DEGENERATE_EPSILON = 1e-8;

export function toTriIndex( v ) {

	return ~ ~ ( v / 3 );

}

export function toEdgeIndex( v ) {

	return v % 3;

}

export function sortEdgeFunc( a, b ) {

	return a.start - b.start;

}

export function areDistancesDegenerate( start, end ) {

	return end - start < DEGENERATE_EPSILON;

}

export function isEdgeDegenerate( e ) {

	return e.end - e.start < DEGENERATE_EPSILON;

}

export function matchEdges( forward, reverse, disjointConnectivityMap ) {

	forward.sort( sortEdgeFunc );
	reverse.sort( sortEdgeFunc );

	for ( let i = 0; i < forward.length; i ++ ) {

		const e0 = forward[ i ];
		for ( let o = 0; o < reverse.length; o ++ ) {

			const e1 = reverse[ o ];
			if ( e1.start > e0.end ) {

				// e2 is completely after e1
				break;

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

}
