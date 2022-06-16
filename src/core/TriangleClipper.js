import { Triangle, Line3, Vector3 } from 'three';

const EPSILON = 1e-15;
const _edge = new Line3();
const _foundEdge = new Line3();
const _vec = new Vector3();

// TODO: this could operate on polygons instead to limit the number of
// objects and edges to check, then triangulate at the end
class TrianglePool {

	constructor() {

		this._pool = [];
		this._index = 0;

	}

	getTriangle() {

		if ( this._index >= this._pool.length ) {

			this._pool.push( new Triangle() );

		}

		return this._pool[ this._index ++ ];

	}

	clear() {

		this._index = 0;

	}

	reset() {

		this._pool.length = 0;
		this._index = 0;

	}

}

export class TriangleClipper {

	constructor() {

		this.trianglePool = new TrianglePool();
		this.triangles = [];

	}

	initialize( tri ) {

		const { triangles, trianglePool } = this;
		const poolTri = trianglePool.getTriangle();
		triangles.length = 0;

		poolTri.copy( tri );
		triangles.push( poolTri );

	}

	clipByPlane( plane ) {

		const { triangles, trianglePool } = this;

		for ( let i = 0, l = triangles.length; i < l; i ++ ) {

			const tri = triangles[ i ];
			const { a, b, c } = tri;

			let intersects = 0;
			let vertexSplitEnd = - 1;
			let positiveSide = 0;
			let onPlane = 0;
			const arr = [ a, b, c ];
			for ( let t = 0; t < 3; t ++ ) {

				const tn = ( t + 1 ) % 3;
				_edge.start.copy( arr[ t ] );
				_edge.end.copy( arr[ tn ] );

				const distance = plane.distanceToPoint( _edge.start );
				if ( Math.abs( distance ) < EPSILON ) {

					onPlane ++;

				} else if ( distance > 0 ) {

					positiveSide ++;

				}

				if ( plane.intersectLine( _edge, _vec ) && ! _vec.equals( _edge.start ) ) {

					if ( _vec.equals( _edge.end ) ) {

						vertexSplitEnd = t;

					}

					if ( intersects === 0 ) {

						_foundEdge.start.copy( _vec );

					} else {

						_foundEdge.end.copy( _vec );

					}

					intersects ++;

				}

			}

			if ( onPlane < 2 && intersects === 2 && _foundEdge.distance() > EPSILON ) {

				if ( vertexSplitEnd !== - 1 ) {

					vertexSplitEnd = ( vertexSplitEnd + 1 ) % 3;

					// we're splitting along a vertex
					let otherVert1 = 0;
					if ( otherVert1 === vertexSplitEnd ) otherVert1 = ( otherVert1 + 1 ) % 3;

					let otherVert2 = otherVert1 + 1;
					if ( otherVert2 === vertexSplitEnd ) otherVert2 = ( otherVert2 + 1 ) % 3;

					const nextTri = trianglePool.getTriangle();
					nextTri.a.copy( arr[ otherVert2 ] );
					nextTri.b.copy( _foundEdge.end );
					nextTri.c.copy( _foundEdge.start );

					triangles.push( nextTri );

					tri.a.copy( arr[ otherVert1 ] );
					tri.b.copy( _foundEdge.start );
					tri.c.copy( _foundEdge.end );

				} else {

					// we're splitting with a quad and a triangle
					const singleVert = arr.findIndex( v => {

						if ( positiveSide >= 2 ) {

							return plane.distanceToPoint( v ) < 0;

						} else {

							return plane.distanceToPoint( v ) > 0;

						}

					} );

					if ( singleVert === 0 ) {

						let tmp = _foundEdge.start;
						_foundEdge.start = _foundEdge.end;
						_foundEdge.end = tmp;

					} else if ( singleVert === - 1 ) {

						continue;

					}

					const nextVert1 = ( singleVert + 1 ) % 3;
					const nextVert2 = ( singleVert + 2 ) % 3;

					const nextTri1 = trianglePool.getTriangle();
					const nextTri2 = trianglePool.getTriangle();

					nextTri1.a.copy( arr[ nextVert1 ] );
					nextTri1.b.copy( _foundEdge.start );
					nextTri1.c.copy( _foundEdge.end );
					triangles.push( nextTri1 );

					nextTri2.a.copy( arr[ nextVert1 ] );
					nextTri2.b.copy( arr[ nextVert2 ] );
					nextTri2.c.copy( _foundEdge.start );
					triangles.push( nextTri2 );

					tri.a.copy( arr[ singleVert ] );
					tri.b.copy( _foundEdge.end );
					tri.c.copy( _foundEdge.start );

				}

			} else if ( intersects === 3 ) {

				// console.warn( 'TriangleClipper: Coplanar clip not handled' );

			}

		}

	}

	reset() {

		this.triangles.length = 0;

	}

}
