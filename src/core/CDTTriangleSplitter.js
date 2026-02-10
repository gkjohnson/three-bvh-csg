import { Vector3, Line3 } from 'three';
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

// TODO:
// - report infinite loop bug
//  - caused when adding edges in for the triangle sides
//  - possible due to duplicate or near duplicate points?
// - request clarifications on tolerances

// Projection frame temporaries
function edgesToIndices( edges, existingVerts, outputVertices, outputIndices ) {

	outputVertices.length = 0;
	outputIndices.length = 0;

	for ( let i = 0, l = existingVerts.length; i < l; i ++ ) {

		getIndex( existingVerts[ i ] );

	}

	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		getIndex( edge0.start );
		getIndex( edge0.end );

		// split the edges on intersection
		// TODO: is this needed?
		for ( let i1 = i + 1; i1 < l; i1 ++ ) {

			const edge1 = edges[ i1 ];
			const dist = edge0.distanceSqToLine3( edge1, _vec, _vec2 );
			if ( dist === 0 ) {

				getIndex( _vec2 );

			}

		}

	}

	// find all generated sub segments from splits
	const arr = [];
	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		arr.length = 0;

		const edge = edges[ i ];
		for ( let v = 0, lv = outputVertices.length; v < lv; v ++ ) {

			// TODO: make this more robust - raising the tolerance causes CDT breakage
			const vec = outputVertices[ v ];
			edge.closestPointToPoint( vec, false, _vec );

			if ( vec.distanceToSquared( _vec ) < 1e-14 ) {

				const param = edge.closestPointToPointParameter( vec, false );
				arr.push( { param, index: v } );

			}

		}

		arr.sort( paramSort );

		for ( let a = 0, la = arr.length - 1; a < la; a ++ ) {

			const an = a + 1;
			outputIndices.push( [ arr[ a ].index, arr[ an ].index ] );

		}

	}

	return { vertices: outputVertices, indices: outputIndices };

	function paramSort( a, b ) {

		return a.param - b.param;

	}

	function getIndex( v ) {

		for ( let i = 0; i < outputVertices.length; i ++ ) {

			const v2 = outputVertices[ i ];
			if ( v === v2 || v.distanceToSquared( v2 ) < 1e-7 ) {

				return i;

			}

		}

		outputVertices.push( v.clone() );
		return outputVertices.length;

	}

}

class Pool {

	constructor( createFn ) {

		this.createFn = createFn;
		this._pool = [];
		this._index = 0;

	}

	getInstance() {

		if ( this._index >= this._pool.length ) {

			this._pool.push( this.createFn() );

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

export class CDTTriangleSplitter {

	constructor() {

		this.trianglePool = new Pool( () => new ExtendedTriangle() );
		this.linePool = new Pool( () => new Line3() );
		this.vectorPool = new Pool( () => new Vector3() );

		this.triangles = [];
		this.normal = new Vector3();
		this.projOrigin = new Vector3();
		this.projU = new Vector3();
		this.projV = new Vector3();
		this.baseTri = new ExtendedTriangle();
		this.edges = [];

		this.coplanarTriangleUsed = false;

	}

	// initialize the class with a triangle to be split
	initialize( tri ) {

		this.reset();

		const { normal, baseTri, projU, projV, projOrigin, edges } = this;
		tri.getNormal( normal );
		baseTri.copy( tri );
		baseTri.update();

		edges.length = 0;

		// Build 2D projection frame from base triangle
		projOrigin.copy( baseTri.a );
		projU.subVectors( baseTri.b, baseTri.a ).normalize();
		projV.crossVectors( normal, projU ).normalize();

	}

	// Collect constraint edges from an intersecting triangle.
	// Computes intersection segment(s) and stores them in edges.
	splitByTriangle( triangle ) {

		const { normal, baseTri, edges } = this;
		triangle.getNormal( _triangleNormal ).normalize();

		const isCoplanar = Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON;

		if ( isCoplanar ) {

			this.coplanarTriangleUsed = true;

			const count = getCoplanarIntersectionEdges( baseTri, triangle, normal, _coplanarEdges );
			for ( let i = 0; i < count; i ++ ) {

				edges.push( _coplanarEdges[ i ].clone() );

			}

		} else {

			_splittingTri.copy( triangle );
			_splittingTri.needsUpdate = true;

			if ( _splittingTri.intersectsTriangle( baseTri, _intersectionEdge, true ) ) {

				edges.push( _intersectionEdge.clone() );

			}

		}

	}

	// Project a 3D point onto the 2D frame defined by _projOrigin / _projU / _projV
	_to2D( point, target ) {

		const { projOrigin, projU, projV } = this;
		_vec.subVectors( point, projOrigin );
		return target.set( _vec.dot( projU ), _vec.dot( projV ), 0 );

	}

	_from2D( u, v, target ) {

		const { projOrigin, projU, projV } = this;
		target.copy( projOrigin ).addScaledVector( projU, u ).addScaledVector( projV, v );
		return target;

	}

	// Run the CDT and populate this.triangles with the result
	triangulate() {

		const { triangles, trianglePool, linePool, vectorPool, baseTri, edges } = this;

		triangles.length = 0;
		trianglePool.clear();

		// Get the edges into a 2d frame
		const edges2d = [];
		for ( let i = 0, l = edges.length; i < l; i ++ ) {

			const edge = edges[ i ];
			const e2d = linePool.getInstance();
			this._to2D( edge.start, e2d.start );
			this._to2D( edge.end, e2d.end );
			edges2d.push( e2d );

		}

		// Mark the triangle corners as unconstrained points
		const existing2d = [
			this._to2D( baseTri.a, vectorPool.getInstance() ),
			this._to2D( baseTri.b, vectorPool.getInstance() ),
			this._to2D( baseTri.c, vectorPool.getInstance() ),
		];

		// Get the deduplicated points and connectivity
		const vertices = [];
		const indices = [];
		edgesToIndices( edges2d, existing2d, vertices, indices );

		// Get the coordinates in a format suitable for delaunator
		const coords = [];
		for ( let i = 0, l = vertices.length; i < l; i ++ ) {

			const vert = vertices[ i ];
			coords.push( vert.x, vert.y );

		}

		// const v0 = this._to2D( baseTri.a );
		// const v1 = this._to2D( baseTri.b );
		// const v2 = this._to2D( baseTri.c );
		// coords.push( v0.x, v0.y, v1.x, v1.y, v2.x, v2.y );

		// Run the CDT triangulation
		const del = new Delaunator( coords );
		if ( indices.length > 0 ) {

			new Constrainautor( del, indices );

		}

		// convert the triangulation to a set of triangles
		const triangulation = del.triangles;
		for ( let i = 0, l = triangulation.length; i < l; i += 3 ) {

			const i0 = triangulation[ i ];
			const i1 = triangulation[ i + 1 ];
			const i2 = triangulation[ i + 2 ];

			// covert back to 2d
			const tri = trianglePool.getInstance();
			this._from2D( coords[ 2 * i0 ], coords[ 2 * i0 + 1 ], tri.a );
			this._from2D( coords[ 2 * i1 ], coords[ 2 * i1 + 1 ], tri.b );
			this._from2D( coords[ 2 * i2 ], coords[ 2 * i2 + 1 ], tri.c );

			// TODO: how can this happen
			if ( isTriDegenerate( tri ) ) {

				continue;

			}

			// Ensure winding matches the base triangle normal
			// TODO: is this needed?
			tri.getNormal( _triNormal );
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

		this.trianglePool.clear();
		this.vectorPool.clear();
		this.linePool.clear();
		this.triangles.length = 0;
		this.edges.length = 0;
		this.coplanarTriangleUsed = false;

	}

}
