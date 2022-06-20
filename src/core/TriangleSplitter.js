import { Triangle, Line3, Vector3, Plane } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { BACK_SIDE, FRONT_SIDE, COPLANAR } from './operationsUtils.js';

const EPSILON = 1e-14;
const COPLANAR_EPSILON = 1e-7;
const AREA_EPSILON = 1e-8;
const _edge = new Line3();
const _foundEdge = new Line3();
const _vec = new Vector3();
const _planeNormal = new Vector3();
const _plane = new Plane();
const _exTriangle = new ExtendedTriangle();

class CullableTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );
		this.side = null;
		this.planes = [];
		this.positiveCoplanar = 0;

	}

	initFrom( other ) {

		this.side = other.side;
		this.positiveCoplanar = other.positiveCoplanar;

	}

	updateSide( plane, triangle = null, coplanarIndex = - 1 ) {

		if ( this.side === COPLANAR ) {

			return;

		}

		this.__triangle = triangle.clone();
		this.__plane = plane.clone();

		this.planes.push( triangle.clone() );


		// get center
		_vec
			.copy( this.a )
			.add( this.b )
			.add( this.c )
			.multiplyScalar( 1 / 3 );
		const foundSide = plane.distanceToPoint( _vec ) < 0 ? BACK_SIDE : FRONT_SIDE;
		if ( triangle && coplanarIndex !== - 1 ) {

			// this.side = COPLANAR;
			if ( foundSide === FRONT_SIDE ) {

				this.positiveCoplanar ++;
				if ( this.positiveCoplanar === 3 ) {

					this.side = COPLANAR;

				}

			}

		} else if ( this.side === null ) {

			// set the clip side based on the plane side
			this.side = foundSide;

		} else if ( foundSide === this.side ) {

			this.side = foundSide;

		} else if ( this.side === FRONT_SIDE || foundSide === FRONT_SIDE ) {

			this.side = FRONT_SIDE;

		} else {

			this.side = foundSide;

		}

	}

}

// A pool of triangles to avoid unnecessary triangle creation
class TrianglePool {

	constructor() {

		this._pool = [];
		this._index = 0;

	}

	getTriangle() {

		if ( this._index >= this._pool.length ) {

			this._pool.push( new CullableTriangle() );

		}

		const result = this._pool[ this._index ++ ];
		result.side = null;
		result.planes.length = 0;
		result.positiveCoplanar = 0;
		return result;

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
		triangles.length = 0;

		if ( Array.isArray( tri ) ) {

			tri.forEach( ( tri, i ) => {

				if ( i === 0 ) {

					tri.getNormal( normal );

				} else if ( tri.getNormal( _vec ).dot( normal ) !== 1 ) {

					throw new Error();

				}

				const poolTri = trianglePool.getTriangle();
				poolTri.copy( tri );
				triangles.push( poolTri );

			} );

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

				this.splitByPlane( _plane, triangle, i );

			}

			this.triangles.forEach( t => {

				t.positiveCoplanar = 0;

			} );

		} else {

			// otherwise split by the triangle plane
			this.splitByPlane( _plane, triangle );

		}

	}

	// Split the triangles by the given plan. If a triangle is provided then we ensure we
	// intersect the triangle before splitting the plane
	splitByPlane( plane, triangle = null, coplanarIndex = - 1 ) {

		const { triangles, trianglePool } = this;

		// init our triangle to check for intersection
		let splittingTriangle = null;
		if ( triangle !== null ) {

			splittingTriangle = _exTriangle;
			splittingTriangle.copy( triangle );
			splittingTriangle.needsUpdate = true;

		}

		// try to split every triangle in the class
		for ( let i = 0, l = triangles.length; i < l; i ++ ) {

			const tri = triangles[ i ];
			const { a, b, c } = tri;

			// skip the triangle if we don't intersect with it
			// if ( splittingTriangle && ! splittingTriangle.intersectsTriangle( tri ) ) {

			// 	const parentSide = tri.side;
			// 	tri.side = null;
			// 	tri.updateSide( plane, parentSide, splittingTriangle, isCoplanar );
			// 	continue;

			// }

			let intersects = 0;
			let vertexSplitEnd = - 1;
			let positiveSide = 0;
			let onPlane = 0;
			let coplanarEdge = false;
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
				if ( Math.abs( startDist ) < EPSILON ) {

					onPlane ++;

				} else if ( startDist > 0 ) {

					positiveSide ++;

				}

				if ( Math.abs( startDist ) < COPLANAR_EPSILON && Math.abs( endDist ) < COPLANAR_EPSILON ) {

					coplanarEdge = true;

				}

				// double check the end point since the "intersectLine" function sometimes does not
				// return it as an intersection (see issue #28)
				let didIntersect = ! ! plane.intersectLine( _edge, _vec );
				if ( ! didIntersect && Math.abs( endDist ) < EPSILON ) {

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
			if ( ! coplanarEdge && onPlane < 2 && intersects === 2 && _foundEdge.distance() > COPLANAR_EPSILON ) {

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

					nextTri.initFrom( tri );
					nextTri.updateSide( plane, splittingTriangle, coplanarIndex );
					nextTri.planes.push( ...tri.planes );

					tri.side = null;
					tri.updateSide( plane, splittingTriangle, coplanarIndex );

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
					if ( nextTri1.getArea() > AREA_EPSILON ) {

						triangles.push( nextTri1 );
						nextTri1.initFrom( tri );
						nextTri1.updateSide( plane, splittingTriangle, coplanarIndex );

					}

					if ( nextTri2.getArea() > AREA_EPSILON ) {

						triangles.push( nextTri2 );
						nextTri2.initFrom( tri );
						nextTri2.updateSide( plane, splittingTriangle, coplanarIndex );

					}

					if ( tri.getArea() < AREA_EPSILON ) {

						triangles.splice( i, 1 );
						i --;
						l --;

					} else {

						tri.updateSide( plane, splittingTriangle, coplanarIndex );

					}

				}

			} else if ( intersects === 3 ) {

				console.warn( 'TriangleClipper: Coplanar clip not handled' );

			} else {

				const parentSide = tri.side;
				tri.updateSide( plane, splittingTriangle, coplanarIndex );

			}

		}

	}

	reset() {

		this.triangles.length = 0;

	}

}
