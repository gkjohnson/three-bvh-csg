import { Vector3, Line3 } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { getCoplanarIntersectionEdges } from './utils/intersectionUtils.js';
import { isTriDegenerate } from './utils/triangleUtils.js';
import cdt2d from 'cdt2d';
import cleanPSLG from 'clean-pslg';
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';

const PARALLEL_EPSILON = 1e-10;

// relative tolerance factor — multiplied by the max absolute coordinate
// of the base triangle to get scale-appropriate thresholds
const RELATIVE_EPSILON = 1e-10;

// tolerance for merging nearby vertices (squared distance)
const VERTEX_MERGE_EPSILON = 1e-16;

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

const _vec = new Vector3();
const _vec2 = new Vector3();
const _triNormal = new Vector3();
const _triangleNormal = new Vector3();
const _splittingTri = new ExtendedTriangle();
const _intersectionEdge = new Line3();
const _coplanarEdges = [];
const _paramPool = new Pool( () => ( { param: 0, index: 0 } ) );

function edgesToIndices( edges, existingVerts, outputVertices, outputIndices, epsilonScale ) {

	_paramPool.clear();

	outputVertices.length = 0;
	outputIndices.length = 0;

	// Add existing (unconstrained) vertices
	for ( let i = 0, l = existingVerts.length; i < l; i ++ ) {

		getIndex( existingVerts[ i ] );

	}

	// Add edge endpoints and find edge-edge intersection points
	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		getIndex( edge0.start );
		getIndex( edge0.end );

		for ( let i1 = i + 1; i1 < l; i1 ++ ) {

			const edge1 = edges[ i1 ];
			const dist = edge0.distanceSqToLine3( edge1, _vec, _vec2 );
			if ( dist < RELATIVE_EPSILON * epsilonScale ) {

				getIndex( _vec2 );

			}

		}

	}

	// Build sub-segments by finding all vertices on each edge
	const arr = [];
	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		arr.length = 0;

		const edge = edges[ i ];
		for ( let v = 0, lv = outputVertices.length; v < lv; v ++ ) {

			const vec = outputVertices[ v ];
			const param = edge.closestPointToPointParameter( vec, true );
			edge.at( param, _vec );
			if ( vec.distanceToSquared( _vec ) < RELATIVE_EPSILON * epsilonScale ) {

				const entry = _paramPool.getInstance();
				entry.param = param;
				entry.index = v;
				arr.push( entry );

			}

		}

		arr.sort( paramSort );

		for ( let a = 0, la = arr.length - 1; a < la; a ++ ) {

			const i0 = arr[ a ].index;
			const i1 = arr[ a + 1 ].index;

			// Skip self-loops (can arise when two endpoints merge)
			if ( i0 === i1 ) continue;

			outputIndices.push( [ i0, i1 ] );

		}

	}

	// Remove duplicate edges
	const edgeSet = new Set();
	let ptr = 0;
	for ( let i = 0, l = outputIndices.length; i < l; i ++ ) {

		const e = outputIndices[ i ];
		const lo = Math.min( e[ 0 ], e[ 1 ] );
		const hi = Math.max( e[ 0 ], e[ 1 ] );
		const key = lo + ',' + hi;
		if ( ! edgeSet.has( key ) ) {

			edgeSet.add( key );
			outputIndices[ ptr ++ ] = e;

		}

	}

	outputIndices.length = ptr;

	function paramSort( a, b ) {

		return a.param - b.param;

	}

	function getIndex( v ) {

		for ( let i = 0; i < outputVertices.length; i ++ ) {

			const v2 = outputVertices[ i ];
			if ( v === v2 || v.distanceToSquared( v2 ) < VERTEX_MERGE_EPSILON * epsilonScale ) {

				return i;

			}

		}

		outputVertices.push( v.clone() );
		return outputVertices.length - 1;

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
		this.useCleanPSLG = false;
		this.useConstrainautor = false;

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

		// Precompute scale factor from base triangle for epsilon scaling
		let epsilonScale = 0;
		for ( let i = 0; i < 3; i ++ ) {

			const v = existing2d[ i ];
			epsilonScale = Math.max( epsilonScale, Math.abs( v.x ), Math.abs( v.y ) );

		}

		let points, indices;

		if ( this.useCleanPSLG ) {

			// Build points and edges directly for clean-pslg
			points = existing2d.map( v => [ v.x, v.y ] );
			indices = [];

			for ( let i = 0, l = edges2d.length; i < l; i ++ ) {

				const e = edges2d[ i ];
				const startIdx = points.length;
				points.push( [ e.start.x, e.start.y ] );
				const endIdx = points.length;
				points.push( [ e.end.x, e.end.y ] );
				indices.push( [ startIdx, endIdx ] );

			}

			cleanPSLG( points, indices );

		} else {

			// Use custom deduplication and edge splitting
			const vertices = [];
			indices = [];
			edgesToIndices( edges2d, existing2d, vertices, indices, epsilonScale );

			points = [];
			for ( let i = 0, l = vertices.length; i < l; i ++ ) {

				const vert = vertices[ i ];
				points.push( [ vert.x, vert.y ] );

			}

		}

		// Run the CDT triangulation
		let triangulation;
		if ( this.useConstrainautor ) {

			const flatCoords = new Float64Array( points.length * 2 );
			for ( let i = 0, l = points.length; i < l; i ++ ) {

				flatCoords[ i * 2 ] = points[ i ][ 0 ];
				flatCoords[ i * 2 + 1 ] = points[ i ][ 1 ];

			}

			const del = new Delaunator( flatCoords );
			new Constrainautor( del, indices );

			triangulation = [];
			for ( let i = 0, l = del.triangles.length; i < l; i += 3 ) {

				triangulation.push( [ del.triangles[ i ], del.triangles[ i + 1 ], del.triangles[ i + 2 ] ] );

			}

		} else {

			triangulation = cdt2d( points, indices );

		}

		for ( let i = 0, l = triangulation.length; i < l; i ++ ) {

			const [ i0, i1, i2 ] = triangulation[ i ];

			// covert back to 2d
			const tri = trianglePool.getInstance();
			this._from2D( points[ i0 ][ 0 ], points[ i0 ][ 1 ], tri.a );
			this._from2D( points[ i1 ][ 0 ], points[ i1 ][ 1 ], tri.b );
			this._from2D( points[ i2 ][ 0 ], points[ i2 ][ 1 ], tri.c );

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
