import { Triangle, Line3, Vector3, Plane } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';

const EPSILON = 1e-14;
const COPLANAR_EPSILON = 1e-7;
const _edge = new Line3();
const _foundEdge = new Line3();
const _vec = new Vector3();
const _planeNormal = new Vector3();
const _plane = new Plane();
const _triangle = new ExtendedTriangle();

// A pool of triangles to avoid unnecessary triangle creation
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

// Utility class for splitting triangles
export class TriangleSplitter {

	constructor() {

		this.trianglePool = new TrianglePool();
		this.triangles = [];
		this.normal = new Vector3();

	}

	// initialize the class with a triangle
	initialize( tri ) {

		const { triangles, trianglePool, normal } = this;
		const poolTri = trianglePool.getTriangle();
		triangles.length = 0;

		tri.getNormal( normal );
		poolTri.copy( tri );
		triangles.push( poolTri );

	}

	// Split the current set of triangles by passing a single triangle in. If the triangle is
	// coplanar it will attempt to split by the triangle edge planes
	splitByTriangle( triangle ) {

		const { normal } = this;
		triangle.getPlane( _plane );

		if ( Math.abs( 1.0 - Math.abs( _plane.normal.dot( normal ) ) ) < COPLANAR_EPSILON ) {

			// if the triangle is coplanar then split by the edge planes
			const arr = [ triangle.a, triangle.b, triangle.c ];
			for ( let i = 0; i < 3; i ++ ) {

				const nexti = ( i + 1 ) % 3;

				const v0 = arr[ i ];
				const v1 = arr[ nexti ];

				_vec.subVectors( v1, v0 ).normalize();
				_planeNormal.crossVectors( normal, _vec );
				_plane.setFromNormalAndCoplanarPoint( _planeNormal, v0 );

				this.splitByPlane( _plane, triangle );

			}

		} else {

			// otherwise split by the triangle plane
			this.splitByPlane( _plane, triangle );

		}

	}

	// Split the triangles by the given plan. If a triangle is provided then we ensure we
	// intersect the triangle before splitting the plane
	splitByPlane( plane, triangle = null ) {

		const { triangles, trianglePool } = this;

		// init our triangle to check for intersection
		let splittingTriangle = null;
		if ( triangle !== null ) {

			splittingTriangle = _triangle;
			splittingTriangle.copy( triangle );
			splittingTriangle.needsUpdate = true;

		}

		// try to split every triangle in the class
		for ( let i = 0, l = triangles.length; i < l; i ++ ) {

			const tri = triangles[ i ];
			const { a, b, c } = tri;

			// skip the triangle if we don't intersect with it
			if ( splittingTriangle && ! splittingTriangle.intersectsTriangle( tri ) ) {

				continue;

			}

			let intersects = 0;
			let vertexSplitEnd = - 1;
			let positiveSide = 0;
			let onPlane = 0;
			const arr = [ a, b, c ];
			for ( let t = 0; t < 3; t ++ ) {

				// get the triangle edge
				const tNext = ( t + 1 ) % 3;
				_edge.start.copy( arr[ t ] );
				_edge.end.copy( arr[ tNext ] );

				// track if the start point sits on the plane or if it's on the positive side of it
				// so we can use that information to determine whether to split later.
				const distance = plane.distanceToPoint( _edge.start );
				if ( Math.abs( distance ) < EPSILON ) {

					onPlane ++;

				} else if ( distance > 0 ) {

					positiveSide ++;

				}

				// double check the end point since the "intersectLine" function sometimes does not
				// return it as an intersection (see issue #28)
				let didIntersect = plane.intersectLine( _edge, _vec );
				if ( ! didIntersect && plane.distanceToPoint( _edge.end ) === 0 ) {

					_vec.copy( _edge.end );
					didIntersect = true;

				}

				// check if we intersect the plane (ignoring the start point so we don't double count)
				if ( didIntersect && ! _vec.equals( _edge.start ) ) {

					// if we intersect at the end point then we track that point as one that we
					// have to split down the middle
					if ( _vec.equals( _edge.end ) ) {

						vertexSplitEnd = t;

					}

					// track the split edge
					if ( intersects === 0 ) {

						_foundEdge.start.copy( _vec );

					} else {

						_foundEdge.end.copy( _vec );

					}

					intersects ++;

				}

			}

			// skip splitting if:
			// - we have two points on the plane then the plane intersects the triangle exactly on an edge
			// - the plane does not intersect on 2 points
			// - the intersection edge is too small
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

					// TODO: split along a shortest edge here to optimize for larger triangles
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

				console.warn( 'TriangleClipper: Coplanar clip not handled' );

			}

		}

	}

	reset() {

		this.triangles.length = 0;

	}

}
