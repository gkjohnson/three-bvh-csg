import { Vector3, Line3, Triangle } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import cdt2d from '../libs/cdt2d.js';
import { Pool } from './utils/Pool.js';
import { directedDomain } from './utils/directedDomain.js';
import { anchorInteriorClassificationCell } from './utils/anchorInteriorClassificationCell.js';

// relative tolerance factor — multiplied by the max absolute coordinate
// of the base triangle to get scale-appropriate thresholds
const RELATIVE_EPSILON = 1e-16;

// tolerance for merging nearby vertices (squared distance)
const VERTEX_MERGE_EPSILON = 1e-16;

const _vec = new Vector3();
const _vec2 = new Vector3();
const _paramPool = new Pool( () => ( { param: 0, index: 0 } ) );
const _vectorPool = new Pool( () => new Vector3() );

function edgesToIndices( edges, sourceEdges, outputVertices, sourceVertices, outputIndices, epsilonScale, sharedConstraints = false, float32Output = false ) {

	_paramPool.clear();

	outputVertices.length = 0;
	sourceVertices.length = 0;
	outputIndices.length = 0;

	// Add edge endpoints and find edge-edge intersection points
	for ( let i = 0, l = edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		getIndex( edge0.start, sourceEdges[ i ].start );
		getIndex( edge0.end, sourceEdges[ i ].end );

	}

	// The operation collector already supplies the complete intersection graph.
	// In shared mode, do not manufacture face-local near-crossing endpoints.
	for ( let i = 0, l = sharedConstraints ? 0 : edges.length; i < l; i ++ ) {

		const edge0 = edges[ i ];
		for ( let i1 = i + 1; i1 < l; i1 ++ ) {

			const edge1 = edges[ i1 ];
			const dist = edge0.distanceSqToLine3( edge1, _vec, _vec2 );
			if ( dist < RELATIVE_EPSILON * epsilonScale ) {

				getIndex( _vec2 );

			}

		}

	}

	// Shared mode projects Float32 coordinates by dropping one axis. Exact
	// dyadic collinearity prevents tolerance-created extra edge constraints.
	const integers = sharedConstraints ? new Map() : null;
	const bits = sharedConstraints ? new Uint32Array( 1 ) : null;
	const scalar = sharedConstraints ? new Float32Array( bits.buffer ) : null;
	function integer( value ) {

		if ( ! integers.has( value ) ) {

			scalar[ 0 ] = value;
			const b = bits[ 0 ], exponent = ( b >>> 23 ) & 255;
			const mantissa = BigInt( ( b & 0x7fffff ) | ( exponent ? 0x800000 : 0 ) );
			integers.set( value, ( b >>> 31 ? - mantissa : mantissa ) << BigInt( exponent ? exponent - 1 : 0 ) );

		}

		return integers.get( value );

	}

	function onSharedSegment( p, a, b ) {

		if ( p.x < Math.min( a.x, b.x ) || p.x > Math.max( a.x, b.x ) || p.y < Math.min( a.y, b.y ) || p.y > Math.max( a.y, b.y ) ) return false;
		const ax = integer( a.x ), ay = integer( a.y );
		return ( integer( b.x ) - ax ) * ( integer( p.y ) - ay ) === ( integer( b.y ) - ay ) * ( integer( p.x ) - ax );

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
			if ( sharedConstraints ? onSharedSegment( vec, edge.start, edge.end ) : vec.distanceToSquared( _vec ) < RELATIVE_EPSILON * epsilonScale ) {

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

	function getIndex( v, source = null ) {

		for ( let i = 0; i < outputVertices.length; i ++ ) {

			const v2 = outputVertices[ i ];
			const existing = sourceVertices[ i ];
			const sameOutput = source && existing && ( float32Output ?
				Math.fround( source.x ) === Math.fround( existing.x ) && Math.fround( source.y ) === Math.fround( existing.y ) && Math.fround( source.z ) === Math.fround( existing.z ) : source.equals( existing ) );
			if ( sharedConstraints ? sameOutput : v === v2 || v.distanceToSquared( v2 ) < VERTEX_MERGE_EPSILON * epsilonScale ) {

				return i;

			}

		}

		sourceVertices.push( source );
		outputVertices.push( _vectorPool.getInstance().copy( v ) );
		return outputVertices.length - 1;

	}

}

// A closed internal constraint is not a hole: retain every cell separated
// from the exterior by constraints. Adapted from the flood fill in PR #256.
function removeExteriorCells( cells, halfEdgeMap ) {

	const edgeToCell = new Map();
	cells.forEach( ( cell, c ) => {

		for ( let e = 0; e < 3; e ++ ) {

			edgeToCell.set( `${ cell[ e ] }_${ cell[ ( e + 1 ) % 3 ] }`, c );

		}

	} );

	const outside = cells.length;
	const neighbors = Array.from( { length: cells.length + 1 }, () => [] );
	cells.forEach( ( cell, c ) => {

		for ( let e = 0; e < 3; e ++ ) {

			const p0 = cell[ e ];
			const p1 = cell[ ( e + 1 ) % 3 ];
			if ( halfEdgeMap.get( `${ p0 }_${ p1 }` ) !== - 1 ) {

				neighbors[ edgeToCell.get( `${ p1 }_${ p0 }` ) ?? outside ].push( c );

			}

		}

	} );

	const exterior = new Uint8Array( cells.length + 1 );
	const stack = [ outside ];
	exterior[ outside ] = 1;
	while ( stack.length > 0 ) {

		for ( const c of neighbors[ stack.pop() ] ) {

			if ( exterior[ c ] === 0 ) {

				exterior[ c ] = 1;
				stack.push( c );

			}

		}

	}

	return cells.filter( ( cell, c ) => exterior[ c ] === 0 );

}

export class CDTTriangleSplitter {

	constructor() {

		this.trianglePool = new Pool( () => new ExtendedTriangle() );
		this.linePool = new Pool( () => new Line3() );
		// TODO: use array pool

		this.triangles = [];
		this.classificationTriangles = [];
		this.triangleIndices = [];
		this.constrainedEdges = [];
		this.boundaryEdges = [];
		this.triangleConnectivity = [];

		this.normal = new Vector3();
		this.projOrigin = new Vector3();
		this.projU = new Vector3();
		this.projV = new Vector3();
		this.baseTri = new ExtendedTriangle();
		this.baseIndices = new Array( 3 );
		this.useSharedConstraints = false;
		this.float32Output = false;

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
		this.boundaryEdges.push( e0, e1, e2 );

		// Build 2D projection frame from base triangle
		projOrigin.copy( baseTri.a );
		projU.subVectors( baseTri.b, baseTri.a ).normalize();
		projV.crossVectors( normal, projU ).normalize();

	}

	// Directed source boundary, distinct from the internal cutting constraints.
	setBoundaryEdges( edges ) {

		this.boundaryEdges = edges.slice();
		this.constrainedEdges.length = 0;
		for ( const edge of edges ) this.addConstraintEdge( edge );

	}

	// Add a pre-computed constraint edge to the splitter
	addConstraintEdge( edge ) {

		if ( this.useSharedConstraints ) {

			this.constrainedEdges.push( edge );
			return;

		}

		const { constrainedEdges, linePool } = this;
		const e = linePool.getInstance().copy( edge );
		constrainedEdges.push( e );

	}

	// A shared source-edge point is a triangulation constraint even when this
	// face does not intersect the cutter. No artificial cutting plane is added.
	addConstraintPoint( point ) {

		if ( this.useSharedConstraints ) {

			this.constrainedEdges.push( new Line3( point, point ) );
			return;

		}

		const edge = this.linePool.getInstance();
		edge.start.copy( point );
		edge.end.copy( point );
		this.constrainedEdges.push( edge );

	}

	// Project a 3D point onto the 2D frame defined by _projOrigin / _projU / _projV
	_to2D( point, target ) {

		if ( this.useSharedConstraints ) {

			// No orthonormal round trip: preserve exact Float32 projected lines.
			const n = this.normal;
			const axis = Math.abs( n.x ) >= Math.abs( n.y ) && Math.abs( n.x ) >= Math.abs( n.z ) ? 0 : Math.abs( n.y ) >= Math.abs( n.z ) ? 1 : 2;
			const u = ( axis + 1 ) % 3, v = ( axis + 2 ) % 3;
			return target.set( Math.fround( point.getComponent( u ) ), Math.fround( point.getComponent( v ) ) * ( n.getComponent( axis ) < 0 ? - 1 : 1 ), 0 );

		}

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
		this.classificationTriangles.length = 0;
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
		const sourceVertices = [];
		const indices = [];
		edgesToIndices( edges2d, constrainedEdges, vertices, sourceVertices, indices, epsilonScale, this.useSharedConstraints, this.float32Output );

		const cdt2dPoints = [];
		for ( let i = 0, l = vertices.length; i < l; i ++ ) {

			const vert = vertices[ i ];
			cdt2dPoints.push( [ vert.x, vert.y ] );

		}

		// Run the CDT triangulation
		const allCells = cdt2d( cdt2dPoints, indices );

		// construct the half edge structure, marking the constrained edges as disconnected to
		// mark the polygon edges
		const halfEdgeMap = new Map();
		for ( let i = 0, l = indices.length; i < l; i ++ ) {

			const pair = indices[ i ];
			halfEdgeMap.set( `${ pair[ 0 ] }_${ pair[ 1 ] }`, - 1 );
			halfEdgeMap.set( `${ pair[ 1 ] }_${ pair[ 0 ] }`, - 1 );

		}

		const boundary2d = this.useSharedConstraints ? this.boundaryEdges.map( edge => new Line3( this._to2D( edge.start, new Vector3() ), this._to2D( edge.end, new Vector3() ) ) ) : null;
		const triangulation = this.useSharedConstraints ? directedDomain( allCells, cdt2dPoints, boundary2d ) : removeExteriorCells( allCells, halfEdgeMap );

		// create an index key to construct unique indices across the geometry
		const indexKeyPrefix = `${ baseIndices[ 0 ] }_${ baseIndices[ 1 ] }_${ baseIndices[ 2 ] }_`;
		for ( let ti = 0, l = triangulation.length; ti < l; ti ++ ) {

			// covert back to 2d
			const indexList = triangulation[ ti ];
			const [ i0, i1, i2 ] = indexList;
			const tri = trianglePool.getInstance();
			// Preserve existing 3D endpoints instead of projecting and lifting them
			// again. Only newly constructed 2D edge crossings need lifting.
			const corners = [ tri.a, tri.b, tri.c ];
			for ( let i = 0; i < 3; i ++ ) {

				const index = indexList[ i ];
				const source = sourceVertices[ index ];
				if ( source !== null ) {

					corners[ i ].copy( source );

				} else {

					this._from2D( cdt2dPoints[ index ][ 0 ], cdt2dPoints[ index ][ 1 ], corners[ i ] );

				}

			}

			triangles.push( tri );
			if ( this.useSharedConstraints ) {

				// Keep side classification in the unrounded source geometry. Output
				// rounding must not move a ray origin across the opposite surface.
				const points = [ i0, i1, i2 ].map( i => baseTri.closestPointToPoint( sourceVertices[ i ].sourcePoint || sourceVertices[ i ], new Vector3() ) );
				const classification = anchorInteriorClassificationCell( baseTri, this.boundaryEdges, [ i0, i1, i2 ].map( i => sourceVertices[ i ] ), points, this.normal );
				this.classificationTriangles.push( new Triangle( ...classification ) );

			}

			// construct the connectivity and custom index list
			const connected = [];
			triangleConnectivity.push( connected );

			const indexKeys = [];
			triangleIndices.push( indexKeys );
			for ( let i = 0; i < 3; i ++ ) {

				// use the original geometry index for base triangle corners,
				// otherwise construct a unique index key for constraint edge vertices
				const p0 = indexList[ i ];
				indexKeys.push( this.useSharedConstraints ? null : p0 < 3 ? baseIndices[ p0 ] : indexKeyPrefix + p0 );

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
		this.classificationTriangles.length = 0;
		this.triangleIndices.length = 0;
		this.triangleConnectivity.length = 0;
		this.constrainedEdges.length = 0;
		this.boundaryEdges.length = 0;

	}

}
