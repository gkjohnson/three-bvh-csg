import { Line3, Triangle } from 'three';
import { EdgesHelper } from './EdgesHelper.js';

const _tri1 = new Triangle();
const _tri2 = new Triangle();

function getTriangleCenter( tri, target ) {

	return target.copy( tri.a ).add( tri.b ).add( tri.c ).multiplyScalar( 1 / 3 );

}

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

	constructor( geometry, halfEdges ) {

		super();
		this.setHalfEdges( geometry, halfEdges );

	}

	setHalfEdges( geometry, halfEdges ) {

		const indexAttr = geometry.index;
		const posAttr = geometry.attributes.position;

		const edges = [];
		const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
		for ( let triIndex = 0; triIndex < triCount; triIndex ++ ) {

			const i3 = triIndex * 3;
			getTriangle( geometry, triIndex, _tri1 );
			for ( let e = 0; e < 3; e ++ ) {

				const edgeIndex = i3 + e;
				const otherEdgeIndex = halfEdges.data[ edgeIndex ];
				if ( otherEdgeIndex === - 1 ) {

					continue;

				}

				const edge = new Line3();
				const otherTriIndex = ~ ~ ( otherEdgeIndex / 3 );
				getTriangle( geometry, otherTriIndex, _tri2 );

				getTriangleCenter( _tri1, edge.start );
				getTriangleCenter( _tri2, edge.end );
				edges.push( edge );

			}

		}

		super.setEdges( edges );

	}

}
