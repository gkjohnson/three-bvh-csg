import { Vector3 } from 'three';
import { exactEndpointSide } from './exactEndpointSide.js';

// Bounded reconstruction of a folded classification cell spanning one intact
// CURRENT source edge and an interior cut node. Boundary-node contractions need
// a shared-neighbor argument and are deliberately outside this local rule.
// Neither the materialized cell nor its construction preimages are modified.
export function anchorInteriorClassificationCell( base, boundary, sources, points, normal ) {

	const corners = sources.map( p => base.points.find( q => q.equals( p ) ) );
	if ( corners.filter( Boolean ).length !== 2 ) return points;
	if ( ! corners.some( ( p, i ) => p && ! p.equals( points[ i ] ) ) ) return points;
	const interior = corners.findIndex( p => ! p );
	const node = sources[ interior ];
	const [ a, b ] = corners.filter( Boolean );
	if ( ! boundary.some( e => e.start.equals( a ) && e.end.equals( b ) || e.start.equals( b ) && e.end.equals( a ) ) ) return points;
	if ( boundary.some( e => e.start.equals( node ) || e.end.equals( node ) ) ) return points;

	// Same dominant-axis chart as the CDT, but exact binary64 signs. Zero or
	// already correctly oriented cells are not a license to choose new samples.
	const n = normal;
	const axis = Math.abs( n.x ) >= Math.abs( n.y ) && Math.abs( n.x ) >= Math.abs( n.z ) ? 0 : Math.abs( n.y ) >= Math.abs( n.z ) ? 1 : 2;
	const direction = new Vector3().setComponent( axis, n.getComponent( axis ) < 0 ? - 1 : 1 );
	if ( exactEndpointSide( direction, ...points ) >= 0 ) return points;
	for ( let i = 0; i < 3; i ++ ) {

		const p = base.points[ i ], q = base.points[ ( i + 1 ) % 3 ];
		if ( exactEndpointSide( direction, p, q, node ) <= 0 ||
			exactEndpointSide( direction, p, q, points[ interior ] ) <= 0 ) return points;

	}

	const anchored = corners.map( ( p, i ) => p || points[ i ] );
	if ( exactEndpointSide( direction, ...anchored ) <= 0 ) return points;
	return anchored.map( p => p.clone() );

}
