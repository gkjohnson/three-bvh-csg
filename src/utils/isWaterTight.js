import { HalfEdgeMap } from '../core/HalfEdgeMap.js';

export function isWaterTight( geometry ) {

	if ( geometry.isMesh ) {

		geometry = geometry.geometry;

	}

	const halfEdgeMap = new HalfEdgeMap();
	halfEdgeMap.matchDisjointEdges = true;
	halfEdgeMap.updateFrom( geometry );
	return halfEdgeMap.unmatchedEdges === 0;

}
