import { Triangle, Vector3, Line3 } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { getCoplanarIntersectionEdges } from './utils/intersectionUtils.js';
import { isTriDegenerate } from './utils/triangleUtils.js';
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';

const PARALLEL_EPSILON = 1e-10;

const _vec = new Vector3();
const _vec2 = new Vector3();
const _triNormal = new Vector3();
const _triangleNormal = new Vector3();
const _splittingTri = new ExtendedTriangle();
const _intersectionEdge = new Line3();
const _coplanarEdges = [];

// Projection frame temporaries
function edgesToIndices( edges ) {

	const vertexMap = new Map();
	const vertices = [];
	const indices = [];

	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		const startHash = hashVertex( edge0.start );
		const endHash = hashVertex( edge0.end );
		if ( ! vertexMap.has( startHash ) ) {

			vertexMap.set( startHash, vertices.length );
			vertices.push( edge0.start.clone() );

		}

		if ( ! vertexMap.has( endHash ) ) {

			vertexMap.set( endHash, vertices.length );
			vertices.push( edge0.end.clone() );

		}

		for ( let i1 = i + 1; i1 < l; i1 ++ ) {

			const edge1 = edges[ i1 ];
			const dist = edge0.distanceSqToLine3( edge1, _vec, _vec2 );
			if ( dist <= 1e-14 ) {

				const hash = hashVertex( _vec2 );
				if ( ! vertexMap.has( hash ) ) {

					vertexMap.set( hash, vertices.length );
					vertices.push( _vec2.clone() );

				}

			}

		}

	}

	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		let arr = [];
		const edge = edges[ i ];
		for ( let v = 0, lv = vertices.length; v < lv; v ++ ) {

			const vec = vertices[ v ];
			edge.closestPointToPoint( vec, false, _vec );

			if ( vec.distanceToSquared( _vec ) < 1e-14 ) {

				const param = edge.closestPointToPointParameter( vec, false );
				arr.push( { param, index: v } );

			}

		}

		arr.sort( ( a, b ) => a.param - b.param );

		for ( let a = 0, la = arr.length - 1; a < la; a ++ ) {

			const an = a + 1;
			indices.push( [ arr[ a ].index, arr[ an ].index ] );

		}

	}

	console.log( vertexMap )

	return { vertices, indices };

	function hashVertex( v ) {

		return `${ v.x.toFixed( 4 ) }_${ v.y.toFixed( 4 ) }_${ v.z.toFixed( 4 ) }`;

	}

}


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

// CDT-based triangle splitter. Drop-in replacement for TriangleSplitter.
export class TriangleSplitter2 {

	constructor() {

		this.trianglePool = new TrianglePool();
		this.triangles = [];
		this.normal = new Vector3();
		this.projOrigin = new Vector3();
		this.projU = new Vector3();
		this.projV = new Vector3();
		this.baseTri = new ExtendedTriangle();

		this.coplanarTriangleUsed = false;

		// collected constraint edges for the CDT pass
		this._edges = [];
		this._edgeCount = 0;

		// CDT working arrays
		this._coords = [];
		this._vertCount = 0;
		this._constraintEdges = [];

	}

	// initialize the class with a triangle to be split
	initialize( tri ) {

		this.reset();

		const { normal, baseTri, projU, projV, projOrigin } = this;
		tri.getNormal( normal );
		baseTri.copy( tri );

		// Step 1: Build 2D projection frame from base triangle
		projOrigin.copy( baseTri.a );
		projU.subVectors( baseTri.b, baseTri.a ).normalize();
		projV.crossVectors( normal, projU ).normalize();
		this._edges.length = 0;

	}

	// Collect constraint edges from an intersecting triangle.
	// Computes intersection segment(s) and stores them in _edges.
	splitByTriangle( triangle ) {

		const { normal, baseTri } = this;
		triangle.getNormal( _triangleNormal ).normalize();

		const isCoplanar = Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON;

		if ( isCoplanar ) {

			this.coplanarTriangleUsed = true;

			// Coplanar: clip triB's edges against the base triangle
			const count = getCoplanarIntersectionEdges( baseTri, triangle, normal, _coplanarEdges );
			for ( let i = 0; i < count; i ++ ) {

				this._edges.push( _coplanarEdges[ i ].clone() );

			}

		} else {

			// Non-coplanar: compute the single intersection segment
			_splittingTri.copy( triangle );
			_splittingTri.needsUpdate = true;

			if ( _splittingTri.intersectsTriangle( baseTri, _intersectionEdge, true ) ) {

				this._edges.push( _intersectionEdge.clone() );

			}

		}

		this._triangulate();

	}

	// Project a 3D point onto the 2D frame defined by _projOrigin / _projU / _projV
	_projectToUV( point, target = new Vector3() ) {

		const { projOrigin, projU, projV } = this;
		_vec.subVectors( point, projOrigin );
		return target.set( _vec.dot( projU ), _vec.dot( projV ), 0 );

	}

	_unprojectFromUV( u, v, target ) {

		const { projOrigin, projU, projV } = this;
		target.copy( projOrigin )
			.addScaledVector( projU, u )
			.addScaledVector( projV, v );
		return target;

	}

	// Run the CDT and populate this.triangles with the result.
	_triangulate() {

		const { triangles, trianglePool, baseTri } = this;

		triangles.length = 0;
		trianglePool.clear();

		// Step 2: Project base triangle vertices (indices 0, 1, 2)
		const edges2d = this._edges.map( e => {

			const e2d = e.clone();
			this._projectToUV( e.start, e2d.start );
			this._projectToUV( e.end, e2d.end );
			return e2d;

		} );

		const { vertices, indices } = edgesToIndices( edges2d );
		const coords = vertices.flatMap( v => [ v.x, v.y ] );

		const v0 = this._projectToUV( baseTri.a );
		const v1 = this._projectToUV( baseTri.b );
		const v2 = this._projectToUV( baseTri.c );
		coords.push( v0.x, v0.y, v1.x, v1.y, v2.x, v2.y );

		const del = new Delaunator( coords );
		if ( indices.length > 0 ) {

			new Constrainautor( del, indices );

		}

		// Step 5: Map 2D triangles back to 3D and populate this.triangles
		// Read from del.coords (the Float64Array Delaunator actually used)
		const delCoords = del.coords;
		const delTris = del.triangles;
		// console.log( del.coords, del.triangles.length )

		for ( let i = 0, l = delTris.length; i < l; i += 3 ) {

			const i0 = delTris[ i ];
			const i1 = delTris[ i + 1 ];
			const i2 = delTris[ i + 2 ];

			// Unproject each vertex: p3d = origin + u * _projU + v * _projV
			const tri = trianglePool.getTriangle();

			this._unprojectFromUV( delCoords[ 2 * i0 ], delCoords[ 2 * i0 + 1 ], tri.a );
			this._unprojectFromUV( delCoords[ 2 * i1 ], delCoords[ 2 * i1 + 1 ], tri.b );
			this._unprojectFromUV( delCoords[ 2 * i2 ], delCoords[ 2 * i2 + 1 ], tri.c );

			// TODO: how can this happen
			if ( isTriDegenerate( tri ) ) continue;

			// Ensure winding matches the base triangle normal
			tri.getNormal( _triNormal );

			// TODO: is this needed?
			if ( _triNormal.dot( this.normal ) < 0 ) {

				// Flip winding by swapping b and c
				_vec.copy( tri.b );
				tri.b.copy( tri.c );
				tri.c.copy( _vec );

			}

			triangles.push( tri );

		}

	}

	reset() {

		this.triangles.length = 0;
		this.trianglePool.clear();
		this.coplanarTriangleUsed = false;
		this._edges.length = 0;
		this._edgeCount = 0;
		this._vertCount = 0;
		this._constraintEdges.length = 0;

	}

}
