import { Triangle, Line3, Vector3, Plane } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { isTriDegenerate } from './utils/triangleUtils.js';

// NOTE: these epsilons likely should all be the same since they're used to measure the
// distance from a point to a plane which needs to be done consistently
const EPSILON = 1e-10;
const COPLANAR_EPSILON = 1e-10;
const PARALLEL_EPSILON = 1e-10;
const _edge = new Line3();
const _foundEdge = new Line3();
const _vec = new Vector3();
const _triangleNormal = new Vector3();
const _planeNormal = new Vector3();
const _plane = new Plane();
const _splittingTriangle = new ExtendedTriangle();

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
		this.coplanarTriangleUsed = false;

	}

	// initialize the class with a triangle
	initialize( tri ) {

		this.reset();

		const { triangles, trianglePool, normal } = this;
		if ( Array.isArray( tri ) ) {

			for ( let i = 0, l = tri.length; i < l; i ++ ) {

				const t = tri[ i ];
				if ( i === 0 ) {

					t.getNormal( normal );

				} else if ( Math.abs( 1.0 - t.getNormal( _vec ).dot( normal ) ) > EPSILON ) {

					throw new Error( 'Triangle Splitter: Cannot initialize with triangles that have different normals.' );

				}

				const poolTri = trianglePool.getTriangle();
				poolTri.copy( t );
				triangles.push( poolTri );

			}

		} else {

			tri.getNormal( normal );

			const poolTri = trianglePool.getTriangle();
			poolTri.copy( tri );
			triangles.push( poolTri );

		}

	}

	// Split the current set of triangles by passing a single triangle in. If the triangle is
	// coplanar it will attempt to split by the triangle edge planes
	splitByTriangle( triangle ) {

		const { normal, triangles } = this;
		triangle.getNormal( _triangleNormal ).normalize();

		if ( Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON ) {

			this.coplanarTriangleUsed = true;

			for ( let i = 0, l = triangles.length; i < l; i ++ ) {

				const t = triangles[ i ];
				t.coplanarCount = 0;

			}

			// if the triangle is coplanar then split by the edge planes
			const arr = [ triangle.a, triangle.b, triangle.c ];
			for ( let i = 0; i < 3; i ++ ) {

				const nexti = ( i + 1 ) % 3;

				const v0 = arr[ i ];
				const v1 = arr[ nexti ];

				// plane positive direction is toward triangle center
				_vec.subVectors( v1, v0 ).normalize();
				_planeNormal.crossVectors( _triangleNormal, _vec );
				_plane.setFromNormalAndCoplanarPoint( _planeNormal, v0 );

				this.splitByPlane( _plane, triangle );

			}

		} else {

			// otherwise split by the triangle plane
			triangle.getPlane( _plane );
			this.splitByPlane( _plane, triangle );

		}

	}

	// Split the triangles by the given plan. If a triangle is provided then we ensure we
	// intersect the triangle before splitting the plane
	splitByPlane( plane, clippingTriangle ) {

		const { triangles, trianglePool } = this;

		// init our triangle to check for intersection
		_splittingTriangle.copy( clippingTriangle );
		_splittingTriangle.needsUpdate = true;

		// try to split every triangle in the class
		for ( let i = 0, l = triangles.length; i < l; i ++ ) {

			const tri = triangles[ i ];

			// skip the triangle if we don't intersect with it
			if ( ! _splittingTriangle.intersectsTriangle( tri, _edge, true ) ) {

				continue;

			}

			const { a, b, c } = tri;
			let intersects = 0;
			let vertexSplitEnd = - 1;
			let coplanarEdge = false;
			let posSideVerts = [];
			let negSideVerts = [];
			const arr = [ a, b, c ];
			for ( let t = 0; t < 3; t ++ ) {

				// get the triangle edge
				const tNext = ( t + 1 ) % 3;
				_edge.start.copy( arr[ t ] );
				_edge.end.copy( arr[ tNext ] );

				// track if the start point sits on the plane or if it's on the positive side of it
				// so we can use that information to determine whether to split later.
				const startDist = plane.distanceToPoint( _edge.start );
				const endDist = plane.distanceToPoint( _edge.end );
				if ( Math.abs( startDist ) < COPLANAR_EPSILON && Math.abs( endDist ) < COPLANAR_EPSILON ) {

					coplanarEdge = true;
					break;

				}

				if ( startDist > 0 ) {

					posSideVerts.push( t );

				} else {

					negSideVerts.push( t );

				}

				// we only don't consider this an intersection if the start points hits the plane
				if ( Math.abs( startDist ) < COPLANAR_EPSILON ) {

					continue;

				}

				// double check the end point since the "intersectLine" function sometimes does not
				// return it as an intersection (see issue #28)
				// Because we ignore the start point intersection above we have to make sure we check the end
				// point intersection here.
				let didIntersect = ! ! plane.intersectLine( _edge, _vec );
				if ( ! didIntersect && Math.abs( endDist ) < COPLANAR_EPSILON ) {

					_vec.copy( _edge.end );
					didIntersect = true;

				}

				// check if we intersect the plane (ignoring the start point so we don't double count)
				if ( didIntersect && ! ( _vec.distanceTo( _edge.start ) < EPSILON ) ) {

					// if we intersect at the end point then we track that point as one that we
					// have to split down the middle
					if ( _vec.distanceTo( _edge.end ) < EPSILON ) {

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
			// - we're not along a coplanar edge
			if ( ! coplanarEdge && intersects === 2 && _foundEdge.distance() > COPLANAR_EPSILON ) {

				if ( vertexSplitEnd !== - 1 ) {

					vertexSplitEnd = ( vertexSplitEnd + 1 ) % 3;

					// we're splitting along a vertex
					let otherVert1 = 0;
					if ( otherVert1 === vertexSplitEnd ) {

						otherVert1 = ( otherVert1 + 1 ) % 3;

					}

					let otherVert2 = otherVert1 + 1;
					if ( otherVert2 === vertexSplitEnd ) {

						otherVert2 = ( otherVert2 + 1 ) % 3;

					}

					const nextTri = trianglePool.getTriangle();
					nextTri.a.copy( arr[ otherVert2 ] );
					nextTri.b.copy( _foundEdge.end );
					nextTri.c.copy( _foundEdge.start );

					if ( ! isTriDegenerate( nextTri ) ) {

						triangles.push( nextTri );

					}

					tri.a.copy( arr[ otherVert1 ] );
					tri.b.copy( _foundEdge.start );
					tri.c.copy( _foundEdge.end );

					// finish off the adjusted triangle
					if ( isTriDegenerate( tri ) ) {

						triangles.splice( i, 1 );
						i --;
						l --;

					}

				} else {

					// we're splitting with a quad and a triangle
					// TODO: what happens when we find that about the pos and negative
					// sides have only a single vertex?
					const singleVert =
						posSideVerts.length >= 2 ?
							negSideVerts[ 0 ] :
							posSideVerts[ 0 ];

					// swap the direction of the intersection edge depending on which
					// side of the plane the single vertex is on to align with the
					// correct winding order.
					if ( singleVert === 0 ) {

						let tmp = _foundEdge.start;
						_foundEdge.start = _foundEdge.end;
						_foundEdge.end = tmp;

					}

					const nextVert1 = ( singleVert + 1 ) % 3;
					const nextVert2 = ( singleVert + 2 ) % 3;

					const nextTri1 = trianglePool.getTriangle();
					const nextTri2 = trianglePool.getTriangle();

					// choose the triangle that has the larger areas (shortest split distance)
					if ( arr[ nextVert1 ].distanceToSquared( _foundEdge.start ) < arr[ nextVert2 ].distanceToSquared( _foundEdge.end ) ) {

						nextTri1.a.copy( arr[ nextVert1 ] );
						nextTri1.b.copy( _foundEdge.start );
						nextTri1.c.copy( _foundEdge.end );

						nextTri2.a.copy( arr[ nextVert1 ] );
						nextTri2.b.copy( arr[ nextVert2 ] );
						nextTri2.c.copy( _foundEdge.start );

					} else {

						nextTri1.a.copy( arr[ nextVert2 ] );
						nextTri1.b.copy( _foundEdge.start );
						nextTri1.c.copy( _foundEdge.end );

						nextTri2.a.copy( arr[ nextVert1 ] );
						nextTri2.b.copy( arr[ nextVert2 ] );
						nextTri2.c.copy( _foundEdge.end );

					}

					tri.a.copy( arr[ singleVert ] );
					tri.b.copy( _foundEdge.end );
					tri.c.copy( _foundEdge.start );

					// don't add degenerate triangles to the list
					if ( ! isTriDegenerate( nextTri1 ) ) {

						triangles.push( nextTri1 );

					}

					if ( ! isTriDegenerate( nextTri2 ) ) {

						triangles.push( nextTri2 );

					}

					// finish off the adjusted triangle
					if ( isTriDegenerate( tri ) ) {

						triangles.splice( i, 1 );
						i --;
						l --;

					}

				}

			} else if ( intersects === 3 ) {

				console.warn( 'TriangleClipper: Coplanar clip not handled' );

			}

		}

	}

	reset() {

		this.triangles.length = 0;
		this.trianglePool.clear();
		this.coplanarTriangleUsed = false;

	}

}
