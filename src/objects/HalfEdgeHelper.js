import { Line3, Triangle, Vector3, Plane, Ray } from 'three';
import { EdgesHelper } from './EdgesHelper.js';
import { getTriCount } from '../core/utils/geometryUtils.js';
import { toNormalizedRay } from '../core/utils/hashUtils.js';

const vertKeys = [ 'a', 'b', 'c' ];
const _tri1 = new Triangle();
const _tri2 = new Triangle();
const _center = new Vector3();
const _center2 = new Vector3();
const _projected = new Vector3();
const _projected2 = new Vector3();
const _projectedDir = new Vector3();
const _projectedDir2 = new Vector3();
const _edgeDir = new Vector3();
const _edgeDir2 = new Vector3();
const _vec = new Vector3();
const _vec2 = new Vector3();
const _finalPoint = new Vector3();
const _finalPoint2 = new Vector3();
const _plane = new Plane();
const _plane2 = new Plane();
const _centerPoint = new Vector3();
const _ray = new Ray();
const _edge = new Line3();

function getTriangle( geometry, triIndex, target ) {

	const i3 = 3 * triIndex;
	let i0 = i3 + 0;
	let i1 = i3 + 1;
	let i2 = i3 + 2;

	const indexAttr = geometry.index;
	const posAttr = geometry.attributes.position;
	if ( indexAttr ) {

		i0 = indexAttr.getX( i0 );
		i1 = indexAttr.getX( i1 );
		i2 = indexAttr.getX( i2 );

	}

	target.a.fromBufferAttribute( posAttr, i0 );
	target.b.fromBufferAttribute( posAttr, i1 );
	target.c.fromBufferAttribute( posAttr, i2 );

	return target;

}

function getOverlapEdge( tri1, e1, tri2, e2, target ) {

	// get the two edges
	const nextE_0 = ( e1 + 1 ) % 3;
	const v0_1 = tri1[ vertKeys[ e1 ] ];
	const v1_1 = tri1[ vertKeys[ nextE_0 ] ];

	const nextE_1 = ( e2 + 1 ) % 3;
	const v0_2 = tri2[ vertKeys[ e2 ] ];
	const v1_2 = tri2[ vertKeys[ nextE_1 ] ];

	// get the ray defined by the edges
	toNormalizedRay( v0_1, v1_1, _ray );

	// get the min and max stride across the rays
	let d0_1 = _vec.subVectors( v0_1, _ray.origin ).dot( _ray.direction );
	let d1_1 = _vec.subVectors( v1_1, _ray.origin ).dot( _ray.direction );
	if ( d0_1 > d1_1 ) [ d0_1, d1_1 ] = [ d1_1, d0_1 ];

	let d0_2 = _vec.subVectors( v0_2, _ray.origin ).dot( _ray.direction );
	let d1_2 = _vec.subVectors( v1_2, _ray.origin ).dot( _ray.direction );
	if ( d0_2 > d1_2 ) [ d0_2, d1_2 ] = [ d1_2, d0_2 ];

	// get the range of overlap
	const final_0 = Math.max( d0_1, d0_2 );
	const final_1 = Math.min( d1_1, d1_2 );
	_ray.at( final_0, target.start );
	_ray.at( final_1, target.end );

}


export class HalfEdgeHelper extends EdgesHelper {

	constructor( geometry = null, halfEdges = null ) {

		super();
		this.straightEdges = false;
		this.displayDisconnectedEdges = false;

		if ( geometry && halfEdges ) {

			this.setHalfEdges( geometry, halfEdges );

		}

	}

	setHalfEdges( geometry, halfEdges ) {

		const { straightEdges, displayDisconnectedEdges } = this;
		const edges = [];
		const offset = geometry.drawRange.start;
		let triCount = getTriCount( geometry );
		if ( geometry.drawRange.count !== Infinity ) {

			triCount = ~ ~ ( geometry.drawRange.count / 3 );

		}

		if ( displayDisconnectedEdges ) {

			if ( halfEdges.unmatchedDisjointEdges ) {

				halfEdges
					.unmatchedDisjointEdges
					.forEach( ( { forward, reverse, ray } ) => {

						[ ...forward, ...reverse ]
							.forEach( ( { start, end } ) => {

								const edge = new Line3();
								ray.at( start, edge.start );
								ray.at( end, edge.end );
								edges.push( edge );

							} );

					} );

			} else {

				for ( let triIndex = offset; triIndex < triCount; triIndex ++ ) {

					getTriangle( geometry, triIndex, _tri1 );
					for ( let e = 0; e < 3; e ++ ) {

						const otherTriIndex = halfEdges.getSiblingTriangleIndex( triIndex, e );
						if ( otherTriIndex === - 1 ) {

							const nextE = ( e + 1 ) % 3;
							const v0 = _tri1[ vertKeys[ e ] ];
							const v1 = _tri1[ vertKeys[ nextE ] ];
							const edge = new Line3();
							edge.start.copy( v0 );
							edge.end.copy( v1 );
							edges.push( edge );

						}

					}

				}

			}

		} else {

			for ( let triIndex = offset; triIndex < triCount; triIndex ++ ) {

				getTriangle( geometry, triIndex, _tri1 );
				for ( let e = 0; e < 3; e ++ ) {

					const otherTriIndex = halfEdges.getSiblingTriangleIndex( triIndex, e );
					if ( otherTriIndex === - 1 ) {

						continue;

					}

					// get other triangle
					getTriangle( geometry, otherTriIndex, _tri2 );

					// get edge centers
					const nextE = ( e + 1 ) % 3;
					const v0 = _tri1[ vertKeys[ e ] ];
					const v1 = _tri1[ vertKeys[ nextE ] ];
					_centerPoint.lerpVectors( v0, v1, 0.5 );
					addConnectionEdge( _tri1, _tri2, _centerPoint );

				}

				if ( halfEdges.disjointConnections ) {

					for ( let e = 0; e < 3; e ++ ) {

						const disjointTriIndices = halfEdges.getDisjointSiblingTriangleIndices( triIndex, e );
						const disjointEdgeIndices = halfEdges.getDisjointSiblingEdgeIndices( triIndex, e );

						for ( let i = 0; i < disjointTriIndices.length; i ++ ) {

							const ti = disjointTriIndices[ i ];
							const ei = disjointEdgeIndices[ i ];

							// get other triangle
							getTriangle( geometry, ti, _tri2 );

							getOverlapEdge( _tri1, e, _tri2, ei, _edge );

							_centerPoint.lerpVectors( _edge.start, _edge.end, 0.5 );
							addConnectionEdge( _tri1, _tri2, _centerPoint );

						}

					}

				}

			}

		}

		super.setEdges( edges );

		function addConnectionEdge( tri1, tri2, centerPoint ) {

			tri1.getMidpoint( _center );
			tri2.getMidpoint( _center2 );

			tri1.getPlane( _plane );
			tri2.getPlane( _plane2 );

			const edge = new Line3();
			edge.start.copy( _center );

			if ( straightEdges ) {

				// get the projected centers
				_plane.projectPoint( _center2, _projected );
				_plane2.projectPoint( _center, _projected2 );

				// get the directions so we can flip them if needed
				_projectedDir.subVectors( _projected, _center );
				_projectedDir2.subVectors( _projected2, _center2 );

				// get the directions so we can flip them if needed
				_edgeDir.subVectors( centerPoint, _center );
				_edgeDir2.subVectors( centerPoint, _center2 );

				if ( _projectedDir.dot( _edgeDir ) < 0 ) {

					_projectedDir.multiplyScalar( - 1 );

				}

				if ( _projectedDir2.dot( _edgeDir2 ) < 0 ) {

					_projectedDir2.multiplyScalar( - 1 );

				}

				// find the new points after inversion
				_vec.addVectors( _center, _projectedDir );
				_vec2.addVectors( _center2, _projectedDir2 );

				// project the points onto the triangle edge. This would be better
				// if we clipped instead of chose the closest point
				tri1.closestPointToPoint( _vec, _finalPoint );
				tri2.closestPointToPoint( _vec2, _finalPoint2 );

				edge.end.lerpVectors( _finalPoint, _finalPoint2, 0.5 );

			} else {

				edge.end.copy( centerPoint );

			}

			edges.push( edge );

		}

	}

}
