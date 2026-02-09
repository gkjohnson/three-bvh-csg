import { Triangle, Vector3, Line3 } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { getCoplanarIntersectionEdges } from './utils/intersectionUtils.js';
import { isTriDegenerate } from './utils/triangleUtils.js';
import { addVertex, triangulate } from './utils/cdt2d.js';

const PARALLEL_EPSILON = 1e-10;

const _vec = new Vector3();
const _triNormal = new Vector3();
const _triangleNormal = new Vector3();
const _splittingTri = new ExtendedTriangle();
const _intersectionEdge = new Line3();
const _coplanarEdges = [];

// Projection frame temporaries
const _projOrigin = new Vector3();
const _projU = new Vector3();
const _projV = new Vector3();

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

		const { normal, trianglePool } = this;
		if ( Array.isArray( tri ) ) {

			for ( let i = 0, l = tri.length; i < l; i ++ ) {

				const t = tri[ i ];
				if ( i === 0 ) {

					t.getNormal( normal );

				}

				const poolTri = trianglePool.getTriangle();
				poolTri.copy( t );
				this.triangles.push( poolTri );

			}

			this._baseTri = trianglePool._pool[ 0 ];

		} else {

			tri.getNormal( normal );

			const poolTri = trianglePool.getTriangle();
			poolTri.copy( tri );
			this._baseTri = poolTri;
			this.triangles.push( poolTri );

		}

	}

	// Collect constraint edges from an intersecting triangle.
	// Computes intersection segment(s) and stores them in _edges.
	splitByTriangle( triangle ) {

		const { normal } = this;
		triangle.getNormal( _triangleNormal ).normalize();

		const isCoplanar = Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON;

		if ( isCoplanar ) {

			this.coplanarTriangleUsed = true;

			// Coplanar: clip triB's edges against the base triangle
			const count = getCoplanarIntersectionEdges( this._baseTri, triangle, normal, _coplanarEdges );
			for ( let i = 0; i < count; i ++ ) {

				const edge = _coplanarEdges[ i ];
				this._storeEdge( edge.start, edge.end );

			}

		} else {

			// Non-coplanar: compute the single intersection segment
			_splittingTri.copy( triangle );
			_splittingTri.needsUpdate = true;

			if ( _splittingTri.intersectsTriangle( this._baseTri, _intersectionEdge, true ) ) {

				if ( _intersectionEdge.distance() > PARALLEL_EPSILON ) {

					this._storeEdge( _intersectionEdge.start, _intersectionEdge.end );

				}

			}

		}

		this._needsTriangulate = true;
		this._triangulate();

	}

	// Store a 3D edge segment for later CDT insertion
	_storeEdge( start, end ) {

		const idx = this._edgeCount;
		if ( idx >= this._edges.length ) {

			this._edges.push( new Line3() );

		}

		this._edges[ idx ].start.copy( start );
		this._edges[ idx ].end.copy( end );
		this._edgeCount ++;

	}

	// Project a 3D point onto the 2D frame defined by _projOrigin / _projU / _projV
	_projectToUV( p ) {

		_vec.subVectors( p, _projOrigin );
		return { u: _vec.dot( _projU ), v: _vec.dot( _projV ) };

	}

	// Run the CDT and populate this.triangles with the result.
	_triangulate() {

		if ( ! this._needsTriangulate ) return;

		const baseTri = this._baseTri;

		// Step 1: Build 2D projection frame from base triangle
		_projOrigin.copy( baseTri.a );
		_projU.subVectors( baseTri.b, baseTri.a ).normalize();
		_projV.crossVectors( this.normal, _projU ).normalize();

		// Step 2: Project base triangle vertices (indices 0, 1, 2)
		const coords = this._coords;
		let vertCount = 0;

		const uv0 = this._projectToUV( baseTri.a );
		coords[ 0 ] = uv0.u; coords[ 1 ] = uv0.v;
		vertCount ++;

		const uv1 = this._projectToUV( baseTri.b );
		coords[ 2 ] = uv1.u; coords[ 3 ] = uv1.v;
		vertCount ++;

		const uv2 = this._projectToUV( baseTri.c );
		coords[ 4 ] = uv2.u; coords[ 5 ] = uv2.v;
		vertCount ++;

		// Step 3: Project constraint edge endpoints and insert with dedup
		const constraintEdges = this._constraintEdges;
		let edgePairCount = 0;

		for ( let i = 0; i < this._edgeCount; i ++ ) {

			const edge = this._edges[ i ];

			const uvS = this._projectToUV( edge.start );
			const resS = addVertex( coords, vertCount, uvS.u, uvS.v );
			vertCount = resS.vertCount;

			const uvE = this._projectToUV( edge.end );
			const resE = addVertex( coords, vertCount, uvE.u, uvE.v );
			vertCount = resE.vertCount;

			// Skip degenerate edges where both endpoints snapped to the same vertex
			if ( resS.index !== resE.index ) {

				constraintEdges[ edgePairCount ] = [ resS.index, resE.index ];
				edgePairCount ++;

			}

		}

		constraintEdges.length = edgePairCount;

		// Step 4: Run CDT (Delaunator + Constrainautor)
		coords.length = vertCount * 2;
		const del = triangulate( coords, constraintEdges );

		// Step 5: Map 2D triangles back to 3D and populate this.triangles
		const { triangles, trianglePool } = this;
		triangles.length = 0;
		trianglePool.clear();

		const delTris = del.triangles;
		for ( let i = 0, l = delTris.length; i < l; i += 3 ) {

			const i0 = delTris[ i ];
			const i1 = delTris[ i + 1 ];
			const i2 = delTris[ i + 2 ];

			// Unproject each vertex: p3d = origin + u * _projU + v * _projV
			const tri = trianglePool.getTriangle();

			tri.a.copy( _projOrigin )
				.addScaledVector( _projU, coords[ 2 * i0 ] )
				.addScaledVector( _projV, coords[ 2 * i0 + 1 ] );

			tri.b.copy( _projOrigin )
				.addScaledVector( _projU, coords[ 2 * i1 ] )
				.addScaledVector( _projV, coords[ 2 * i1 + 1 ] );

			tri.c.copy( _projOrigin )
				.addScaledVector( _projU, coords[ 2 * i2 ] )
				.addScaledVector( _projV, coords[ 2 * i2 + 1 ] );

			if ( isTriDegenerate( tri ) ) continue;

			// Ensure winding matches the base triangle normal
			tri.getNormal( _triNormal );
			if ( _triNormal.dot( this.normal ) < 0 ) {

				// Flip winding by swapping b and c
				_vec.copy( tri.b );
				tri.b.copy( tri.c );
				tri.c.copy( _vec );

			}

			triangles.push( tri );

		}

		this._vertCount = vertCount;
		this._needsTriangulate = false;

	}

	reset() {

		this.triangles.length = 0;
		this.trianglePool.clear();
		this.coplanarTriangleUsed = false;
		this._edges.length = 0;
		this._edgeCount = 0;
		this._baseTri = null;
		this._needsTriangulate = false;
		this._vertCount = 0;
		this._constraintEdges.length = 0;

	}

}
