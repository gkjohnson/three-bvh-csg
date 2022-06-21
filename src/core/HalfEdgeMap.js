import { Vector3 } from 'three';

const _vec0 = new Vector3();
const _vec1 = new Vector3();

function hashNumber( v ) {

	return ~ ~ ( v * 1e4 );

}

function hashVertex( v ) {

	return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) }`;

}

function hashEdge( a, b ) {

	return `${ hashVertex( a ) }_${ hashVertex( b ) }`;

}

export class HalfEdgeMap {

	constructor() {

		this.data = null;
		this.unmatchedEdges = null;

	}

	updateFrom( geometry ) {

		// runs on the assumption that there is a 1 : 1 match of edges
		const { attributes } = geometry;
		const map = {};

		const indexAttr = geometry.index;
		const posAttr = attributes.position;

		const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
		const data = triCount >= 2 ** 15 - 1 ? new Int16Array( 3 * triCount ) : new Int32Array( 3 * triCount );

		let unmatchedEdges = 0;
		for ( let i = 0; i < triCount; i ++ ) {

			const i3 = 3 * i;
			for ( let e = 0; e < 3; e ++ ) {

				const nextE = ( e + 1 ) % 3;
				let i0 = i3 + e;
				let i1 = i3 + nextE;
				if ( indexAttr ) {

					i0 = indexAttr.getX( i0 );
					i1 = indexAttr.getX( i1 );

				}

				_vec0.fromBufferAttribute( posAttr, i0 );
				_vec1.fromBufferAttribute( posAttr, i1 );

				const hash = hashEdge( _vec0, _vec1 );
				const reverseHash = hashEdge( _vec1, _vec1 );
				if ( reverseHash in map ) {

					// create a reference between the two triangles and clear the hash
					const otherIndex = map[ reverseHash ];
					data[ i0 ] = otherIndex;
					data[ otherIndex ] = i0;
					delete map[ reverseHash ];
					unmatchedEdges --;

				} else {

					// save the triangle and triangle edge index captured in one value
					// triIndex = ~ ~ ( i0 / 3 );
					// edgeIndex = i0 % 3;
					map[ hash ] = i0;
					unmatchedEdges ++;

				}

			}

		}

		this.unmatchedEdges = unmatchedEdges;
		this.data = data;

	}

}
