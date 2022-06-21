import { Line3, Triangle, Vector3, Plane } from 'three';
import { EdgesHelper } from './EdgesHelper.js';

const _tri1 = new Triangle();
const _tri2 = new Triangle();
const _center = new Vector3();
const _center2 = new Vector3();
const _edgeCenter = new Vector3();
const _edgeCenter2 = new Vector3();
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

export class HalfEdgeHelper extends EdgesHelper {

	constructor( geometry = null, halfEdges = null ) {

		super();

		if ( geometry && halfEdges ) {

			this.setHalfEdges( geometry, halfEdges );

		}

	}

	setHalfEdges( geometry, halfEdges ) {

		const indexAttr = geometry.index;
		const posAttr = geometry.attributes.position;

		const vertKeys = [ 'a', 'b', 'c' ];
		const edges = [];
		const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
		for ( let triIndex = 0; triIndex < triCount; triIndex ++ ) {

			getTriangle( geometry, triIndex, _tri1 );
			_tri1.getMidpoint( _center );
			_tri1.getPlane( _plane );
			for ( let e = 0; e < 3; e ++ ) {

				const otherTriIndex = halfEdges.getSiblingTriangleIndex( triIndex, e );
				const otherEdgeIndex = halfEdges.getSiblingEdgeIndex( triIndex, e );
				if ( otherTriIndex === - 1 ) {

					continue;

				}

				// get other triangle
				getTriangle( geometry, otherTriIndex, _tri2 );
				_tri2.getPlane( _plane2 );

				// get triangle center
				_tri2.getMidpoint( _center2 );

				// get edge centers
				{

					const nextE = ( e + 1 ) % 3;
					const v0 = _tri1[ vertKeys[ e ] ];
					const v1 = _tri1[ vertKeys[ nextE ] ];
					_edgeCenter.lerpVectors( v0, v1, 0.5 );

				}

				{

					const nextE = ( otherEdgeIndex + 1 ) % 3;
					const v0 = _tri2[ vertKeys[ otherEdgeIndex ] ];
					const v1 = _tri2[ vertKeys[ nextE ] ];
					_edgeCenter2.lerpVectors( v0, v1, 0.5 );

				}

				// get the projected centers
				_plane.projectPoint( _center2, _projected );
				_plane2.projectPoint( _center, _projected2 );

				// get the directions so we can flip them if needed
				_projectedDir.subVectors( _projected, _center );
				_projectedDir2.subVectors( _projected2, _center2 );

				// get the directions so we can flip them if needed
				_edgeDir.subVectors( _edgeCenter, _center );
				_edgeDir2.subVectors( _edgeCenter2, _center2 );

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
				_tri1.closestPointToPoint( _vec, _finalPoint );
				_tri2.closestPointToPoint( _vec2, _finalPoint2 );

				const edge = new Line3();
				edge.start.copy( _center );
				edge.end.lerpVectors( _finalPoint, _finalPoint2, 0.5 );
				edges.push( edge );

			}

		}

		super.setEdges( edges );

	}

}
