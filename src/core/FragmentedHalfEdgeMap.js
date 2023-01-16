import { Ray, Line3, Vector3 } from 'three';
import { HalfEdgeMap } from './HalfEdgeMap.js';

const _ray = new Ray();
const _ray2 = new Ray();
const _line = new Line3();

function toNormalizedRay( v0, v1, ray ) {

	ray.direction.subVectors( v1, v0 ).normalize();
	ray.origin
		.copy( v0 )
		.addScaledVector( ray.direction, - v0.dot( targetRay.direction ) );

	return ray;

}

function hashEdge( v0, v1 ) {

	return `${ hashVertex( v0 ) }_${ hashVertex( v1 ) }`;

}

function hashRay( ray ) {

	return hashEdge( ray.origin, ray.direction );

}

export class FragmentedHalfEdgeMap {

	constructor() {

		this.edgeMap = null;

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

			// add a distance bounces for the edge
			const hash = hashRay( _ray );
			if ( ! edgeDistanceMap.has( hash ) ) {

				toNormalizedRay( _line.end, _line.start, _ray2 );
				edgeDistanceMap.set( hash, {
					inverseHash: hashRay( _ray2 ),
					edges: [],
				} );

			}

			const list = edgeDistanceMap.get( hash );
			list.edges.push( {
				triIndex,
				edgeIndex,
				start: _line.start.distanceTo( _ray.origin ),
				end: _line.end.distanceTo( _ray.origin ),
			} );

		}

		for ( const [ _, value ] of edgeDistanceMap ) {

			const { reverseHash, edges } = value;
			const otherEdges = edgeDistanceMap.get( reverseHash ).edges;
			otherEdges.sort( ( a, b ) => {

				return a.start - b.start;

			} );

			// TODO: iterate over edges and check alignment
			// TODO: is it the case that the distances will just be reversed?


		}


	}

}
