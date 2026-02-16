import { Vector3, Line3 } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import cdt2d from '../libs/cdt2d.js';
import { Pool } from './utils/Pool.js';

// relative tolerance factor — multiplied by the max absolute coordinate
// of the base triangle to get scale-appropriate thresholds
const RELATIVE_EPSILON = 1e-16;

// tolerance for merging nearby vertices (squared distance)
const VERTEX_MERGE_EPSILON = 1e-16;

const _vec = new Vector3();
const _vec2 = new Vector3();
const _paramPool = new Pool( () => ( { param: 0, index: 0 } ) );
const _vectorPool = new Pool( () => new Vector3() );

function edgesToIndices( edges, outputVertices, outputIndices, epsilonScale ) {

	_paramPool.clear();

	outputVertices.length = 0;
	outputIndices.length = 0;

	// Add edge endpoints and find edge-edge intersection points
	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		getIndex( edge0.start );
		getIndex( edge0.end );

	}

	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
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

		outputVertices.push( _vectorPool.getInstance().copy( v ) );
		return outputVertices.length - 1;

	}

}

export class CDTTriangleSplitter {

	constructor() {

		this.trianglePool = new Pool( () => new ExtendedTriangle() );
		this.linePool = new Pool( () => new Line3() );
		// TODO: use array pool

		this.triangles = [];
		this.triangleIndices = [];
		this.constrainedEdges = [];
		this.triangleConnectivity = [];

		this.normal = new Vector3();
		this.projOrigin = new Vector3();
		this.projU = new Vector3();
		this.projV = new Vector3();
		this.baseTri = new ExtendedTriangle();
		this.baseIndices = new Array( 3 );

	}

	// initialize the class with a triangle to be split
	initialize( tri, i0 = null, i1 = null, i2 = null ) {

		this.reset();

		const { normal, baseTri, projU, projV, projOrigin, constrainedEdges, linePool, baseIndices } = this;
		tri.getNormal( normal );
		baseTri.copy( tri );
		baseTri.update();
		baseIndices[ 0 ] = i0;
		baseIndices[ 1 ] = i1;
		baseIndices[ 2 ] = i2;

		// initialize constrained edges to the triangle boundary
		constrainedEdges.length = 0;

		// inserting these edges in this order guarantee that indices a, b, c will be given the
		// indices 0, 1, 2 so we can infer base indices from them later.
		const e0 = linePool.getInstance();
		e0.start.copy( baseTri.a );
		e0.end.copy( baseTri.b );

		const e1 = linePool.getInstance();
		e1.start.copy( baseTri.b );
		e1.end.copy( baseTri.c );

		const e2 = linePool.getInstance();
		e2.start.copy( baseTri.c );
		e2.end.copy( baseTri.a );
		constrainedEdges.push( e0, e1, e2 );

		// Build 2D projection frame from base triangle
		projOrigin.copy( baseTri.a );
		projU.subVectors( baseTri.b, baseTri.a ).normalize();
		projV.crossVectors( normal, projU ).normalize();

	}

	// Add a pre-computed constraint edge to the splitter
	addConstraintEdge( edge ) {

		const { constrainedEdges, linePool } = this;
		const e = linePool.getInstance().copy( edge );
		constrainedEdges.push( e );

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

		const { triangles, trianglePool, triangleConnectivity, triangleIndices, linePool, baseTri, constrainedEdges, baseIndices } = this;

		triangles.length = 0;
		trianglePool.clear();

		// Get the edges into a 2d frame
		const edges2d = [];
		for ( let i = 0, l = constrainedEdges.length; i < l; i ++ ) {

			const edge = constrainedEdges[ i ];
			const e2d = linePool.getInstance();
			this._to2D( edge.start, e2d.start );
			this._to2D( edge.end, e2d.end );
			edges2d.push( e2d );

		}

		// Precompute scale factor from base triangle for epsilon scaling
		let epsilonScale = 0;
		for ( let i = 0; i < 3; i ++ ) {

			const v = this._to2D( baseTri.points[ i ], _vec );
			epsilonScale = Math.max( epsilonScale, Math.abs( v.x ), Math.abs( v.y ) );

		}

		// Use custom deduplication and edge splitting
		const vertices = [];
		const indices = [];
		edgesToIndices( edges2d, vertices, indices, epsilonScale );

		const cdt2dPoints = [];
		for ( let i = 0, l = vertices.length; i < l; i ++ ) {

			const vert = vertices[ i ];
			cdt2dPoints.push( [ vert.x, vert.y ] );

		}

		// Run the CDT triangulation
		const triangulation = cdt2d( cdt2dPoints, indices, { exterior: false } );

		// construct the half edge structure, marking the constrained edges as disconnected to
		// mark the polygon edges
		const halfEdgeMap = new Map();
		for ( let i = 0, l = indices.length; i < l; i ++ ) {

			const pair = indices[ i ];
			halfEdgeMap.set( `${ pair[ 0 ] }_${ pair[ 1 ] }`, - 1 );
			halfEdgeMap.set( `${ pair[ 1 ] }_${ pair[ 0 ] }`, - 1 );

		}

		// create an index key to construct unique indices across the geometry
		const indexKeyPrefix = `${ baseIndices[ 0 ] }_${ baseIndices[ 1 ] }_${ baseIndices[ 2 ] }_`;
		for ( let ti = 0, l = triangulation.length; ti < l; ti ++ ) {

			// covert back to 2d
			const indexList = triangulation[ ti ];
			const [ i0, i1, i2 ] = indexList;
			const tri = trianglePool.getInstance();
			this._from2D( cdt2dPoints[ i0 ][ 0 ], cdt2dPoints[ i0 ][ 1 ], tri.a );
			this._from2D( cdt2dPoints[ i1 ][ 0 ], cdt2dPoints[ i1 ][ 1 ], tri.b );
			this._from2D( cdt2dPoints[ i2 ][ 0 ], cdt2dPoints[ i2 ][ 1 ], tri.c );
			triangles.push( tri );

			// construct the connectivity and custom index list
			const connected = [];
			triangleConnectivity.push( connected );

			const indexKeys = [];
			triangleIndices.push( indexKeys );
			for ( let i = 0; i < 3; i ++ ) {

				// use the original geometry index for base triangle corners,
				// otherwise construct a unique index key for constraint edge vertices
				const p0 = indexList[ i ];
				indexKeys.push( p0 < 3 ? baseIndices[ p0 ] : indexKeyPrefix + p0 );

				// find the connected triangles
				const p1 = indexList[ ( i + 1 ) % 3 ];
				const hash0 = `${ p0 }_${ p1 }`;
				if ( halfEdgeMap.has( hash0 ) ) {

					const index = halfEdgeMap.get( hash0 );
					if ( index !== - 1 ) {

						connected.push( index );
						triangleConnectivity[ index ].push( ti );

					}

				} else {

					const hash1 = `${ p1 }_${ p0 }`;
					halfEdgeMap.set( hash1, ti );

				}

			}

		}

	}

	reset() {

		this.trianglePool.clear();
		this.linePool.clear();
		this.triangles.length = 0;
		this.triangleIndices.length = 0;
		this.triangleConnectivity.length = 0;
		this.constrainedEdges.length = 0;

	}

}
