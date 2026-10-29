import { Vector3, Matrix4, Line3, Plane } from 'three';
import { sameInvertibleFrame } from './SourceFaceProvenance.js';

const _float = new Float32Array( 1 );
const _bits = new Uint32Array( _float.buffer );

// Conservative half-ULP at a coordinate, including zero/subnormals. Taking the
// smaller neighboring spacing avoids a larger budget at binade boundaries.
export function halfFloat32Ulp( value ) {

	_float[ 0 ] = Math.abs( value );
	const rounded = _float[ 0 ];
	if ( ! Number.isFinite( rounded ) ) throw new RangeError( 'Cut coordinate cannot be represented in Float32.' );
	if ( rounded === 0 ) return 2 ** - 150;
	const bits = _bits[ 0 ];
	_bits[ 0 ] = bits - 1;
	return ( rounded - _float[ 0 ] ) / 2;

}

// Exact source connectivity, independent of the tolerance-based HalfEdgeMap.
// Attribute seams may have different indices but exactly equal positions. No
// distance welding: even very close, representably distinct edges stay distinct.
class SourceTopology {

	constructor( geometry, matrix, prefix ) {

		this.prefix = prefix;
		this.vertices = [];
		this.faces = [];
		this.edges = new Map();
		this.vertexFaces = [];
		this.cuts = new Map();
		this.edgeCuts = new Map();
		this.partitions = new Map();
		this.pending = [];
		const position = geometry.attributes.position;
		const index = geometry.index;
		const exact = new Map();
		const remap = new Uint32Array( position.count );
		for ( let i = 0; i < position.count; i ++ ) {

			const p = new Vector3().fromBufferAttribute( position, i );
			const key = `${ p.x },${ p.y },${ p.z }`;
			if ( ! exact.has( key ) ) {

				exact.set( key, this.vertices.length );
				this.vertices.push( p.applyMatrix4( matrix ) );
				this.vertexFaces.push( [] );

			}

			remap[ i ] = exact.get( key );

		}

		const count = index ? index.count : position.count;
		for ( let i = 0; i < count; i += 3 ) {

			const face = [ 0, 1, 2 ].map( k => remap[ index ? index.getX( i + k ) : i + k ] );
			const id = i / 3;
			this.faces.push( face );
			for ( let k = 0; k < 3; k ++ ) {

				const a = face[ k ], b = face[ ( k + 1 ) % 3 ];
				this.vertexFaces[ a ].push( id );
				const key = this.edgeKey( a, b );
				if ( ! this.edges.has( key ) ) this.edges.set( key, { a: Math.min( a, b ), b: Math.max( a, b ), faces: [] } );
				this.edges.get( key ).faces.push( id );

			}

		}

	}

	edgeKey( a, b ) {

		return a < b ? `${ a }_${ b }` : `${ b }_${ a }`;

	}

	localFeature( faceId, feature ) {

		const ids = this.faces[ faceId ];
		const local = feature.vertex ?? feature.edge;
		if ( ! ids || ( feature.vertex !== undefined && feature.edge !== undefined ) ||
			( local !== undefined && ( ! Number.isInteger( local ) || local < 0 || local > 2 ) ) ) {

			throw new Error( 'Invalid clipping feature incidence.' );

		}

		if ( feature.vertex !== undefined ) {

			const vertex = ids[ feature.vertex ];
			return { key: `${ this.prefix }v${ vertex }`, vertex };

		}

		if ( feature.edge !== undefined ) {

			const edge = this.edgeKey( ids[ feature.edge ], ids[ ( feature.edge + 1 ) % 3 ] );
			return { key: `${ this.prefix }e${ edge }`, edge };

		}

		return { key: `${ this.prefix }f${ faceId }`, face: faceId };

	}

	feature( faceId, point ) {

		const ids = this.faces[ faceId ];
		const vertices = ids.map( i => this.vertices[ i ] );
		// Double-arithmetic identification error only; NOT a Float32 weld radius.
		const magnitude = Math.max( ...vertices.flatMap( p => [ Math.abs( p.x ), Math.abs( p.y ), Math.abs( p.z ) ] ), ...vertices.map( ( p, i ) => p.distanceTo( vertices[ ( i + 1 ) % 3 ] ) ) );
		const epsilon = 128 * Number.EPSILON * magnitude;
		for ( let i = 0; i < 3; i ++ ) {

			if ( point.distanceToSquared( vertices[ i ] ) <= epsilon * epsilon ) return { key: `${ this.prefix }v${ ids[ i ] }`, vertex: ids[ i ] };

		}

		const closest = new Vector3();
		for ( let i = 0; i < 3; i ++ ) {

			const line = new Line3( vertices[ i ], vertices[ ( i + 1 ) % 3 ] );
			line.closestPointToPoint( point, true, closest );
			if ( point.distanceToSquared( closest ) <= epsilon * epsilon ) {

				const edge = this.edgeKey( ids[ i ], ids[ ( i + 1 ) % 3 ] );
				return { key: `${ this.prefix }e${ edge }`, edge };

			}

		}

		return { key: `${ this.prefix }f${ faceId }`, face: faceId };

	}

	addToStar( feature, point ) {

		if ( feature.edge !== undefined ) {

			if ( ! this.edgeCuts.has( feature.edge ) ) this.edgeCuts.set( feature.edge, new Set() );
			this.edgeCuts.get( feature.edge ).add( point );

		}

		const faces = feature.vertex !== undefined ? this.vertexFaces[ feature.vertex ] : feature.edge !== undefined ? this.edges.get( feature.edge ).faces : [ feature.face ];
		for ( const id of faces ) {

			if ( ! this.cuts.has( id ) ) this.cuts.set( id, new Set() );
			if ( ! this.cuts.get( id ).has( point ) ) {

				this.cuts.get( id ).add( point );
				this.pending.push( [ id, point ] );

			}

		}

	}

	// One materialized ordering per CURRENT source edge, shared in reverse by
	// its neighbors. Preimage order is no longer authoritative after contraction.
	boundary( faceId, materialize ) {

		const face = this.faces[ faceId ];
		const result = [];
		for ( let k = 0; k < 3; k ++ ) {

			const a = face[ k ], b = face[ ( k + 1 ) % 3 ];
			const key = this.edgeKey( a, b );
			if ( ! this.partitions.has( key ) ) {

				const edge = this.edges.get( key );
				const p = this.vertices[ edge.a ], q = this.vertices[ edge.b ];
				const line = new Line3( materialize( p ), materialize( q ) );
				const nodes = [ p, ...( this.edgeCuts.get( key ) || [] ), q ].map( point => {

					const output = materialize( point );
					return { point, output, parameter: line.closestPointToPointParameter( output, false ) };

				} );
				nodes.sort( ( u, v ) => u.parameter - v.parameter || u.output.x - v.output.x || u.output.y - v.output.y || u.output.z - v.output.z );
				this.partitions.set( key, { nodes, faces: edge.faces.slice() } );

			}

			const nodes = this.partitions.get( key ).nodes;
			for ( let i = 0; i < nodes.length - 1; i ++ ) {

				const start = a < b ? i : nodes.length - 1 - i;
				const end = a < b ? i + 1 : nodes.length - 2 - i;
				const p = nodes[ start ].output, q = nodes[ end ].output;
				if ( ! p.equals( q ) ) result.push( new Line3( p, q ) );

			}

		}

		return result;

	}

	intersectEdgePlane( edge, other, faceId ) {

		const { a, b } = this.edges.get( edge );
		const p = this.vertices[ a ], q = this.vertices[ b ];
		const corners = other.faces[ faceId ].map( i => other.vertices[ i ] );
		const plane = new Plane().setFromCoplanarPoints( ...corners );
		const d0 = plane.distanceToPoint( p ), d1 = plane.distanceToPoint( q );
		if ( d0 === d1 ) return null;
		const t = d0 / ( d0 - d1 );
		return t >= 0 && t <= 1 ? p.clone().lerp( q, t ) : null;

	}

}

// One instance per Boolean. Endpoint identity is a pair of source features,
// never a spatial bucket. A given edge/face event is computed only on first use.
export class CutPointRegistry {

	constructor( a, b ) {

		const matrix = sameInvertibleFrame( a.matrixWorld, b.matrixWorld ) ? new Matrix4() : new Matrix4().copy( a.matrixWorld ).invert().multiply( b.matrixWorld );
		this.a = new SourceTopology( a.geometry, new Matrix4(), 'a' );
		this.b = new SourceTopology( b.geometry, matrix, 'b' );
		this.points = new Map();
		this.unresolved = 0;
		this.outputs = new WeakMap();
		this.maxRoundingDistance = 0;
		this.maxCanonicalDistance = 0;
		this.snappedPoints = 0;
		this.maxSnapDistance = 0;
		this.maxAdjustedOutputDistance = 0;
		this.supportPreimages = new Map();
		this.fixedSourceVertices = new WeakSet();
		this.supportRegistrations = 0;
		this.supportVertexRegistrations = 0;
		this.maxSupportOutputUlpRatio = 0;

	}

	register( point, ia, ib, coplanar = false, features = null ) {

		const fa = features ? this.a.localFeature( ia, features[ 0 ] ) : this.a.feature( ia, point );
		const fb = features ? this.b.localFeature( ib, features[ 1 ] ) : this.b.feature( ib, point );
		// An ambiguous face/face endpoint has no unique topological event key.
		// Preserve it rather than guessing a nearby edge or welding distinct cuts.
		if ( fa.face !== undefined && fb.face !== undefined ) {

			this.unresolved ++;
			if ( features ) throw new Error( 'Unresolved explicit clipping event.' );
			return point.clone();

		}

		const key = `${ fa.key }|${ fb.key }`;
		let canonical = this.points.get( key );
		if ( ! canonical ) {

			// An existing source vertex is already a canonical node. Different
			// opposing features must not manufacture additional copies of it.
			if ( fa.vertex !== undefined ) canonical = this.a.vertices[ fa.vertex ];
			else if ( fb.vertex !== undefined ) canonical = this.b.vertices[ fb.vertex ];
			else if ( ! coplanar && fa.edge !== undefined ) canonical = this.a.intersectEdgePlane( fa.edge, this.b, ib );
			else if ( ! coplanar && fb.edge !== undefined ) canonical = this.b.intersectEdgePlane( fb.edge, this.a, ia );
			if ( ! canonical ) canonical = point.clone();
			this.points.set( key, canonical );

		}

		if ( features ) {

			this.supportRegistrations ++;
			if ( fa.vertex !== undefined || fb.vertex !== undefined ) {

				this.supportVertexRegistrations ++;
				this.fixedSourceVertices.add( canonical );

			}

			if ( ! this.supportPreimages.has( canonical ) ) this.supportPreimages.set( canonical, [] );
			this.supportPreimages.get( canonical ).push( point.clone() );

		}

		this.maxCanonicalDistance = Math.max( this.maxCanonicalDistance, point.distanceTo( canonical ) );
		this.a.addToStar( fa, canonical );
		this.b.addToStar( fb, canonical );
		return canonical;

	}

	materialize( point ) {

		if ( ! this.outputs.has( point ) ) {

			const output = new Vector3( Math.fround( point.x ), Math.fround( point.y ), Math.fround( point.z ) );
			output.sourcePoint = point;
			this.maxRoundingDistance = Math.max( this.maxRoundingDistance, point.distanceTo( output ) );
			this.outputs.set( point, output );
			this.outputs.set( output, output );

		}

		return this.outputs.get( point );

	}

	resolveRoundingCollapses() {

		// A nearby cut can round across an edge even when the rounded nearest
		// projection differs by an ULP. Edge projection is limited to half an
		// ULP per coordinate; a corner band can contract to an existing incident
		// vertex. BOTH require total output movement <= one conservative ULP per
		// coordinate. Never search unrelated faces or chain position adjustments.
		const candidates = new Map();
		const roundedCorners = new Set();
		for ( const topology of [ this.a, this.b ] ) {

			for ( const [ id, points ] of topology.cuts ) {

				const face = topology.faces[ id ];
				for ( const point of points ) {

					if ( this.fixedSourceVertices.has( point ) ) continue;
					const budget = [ point.x, point.y, point.z ].map( halfFloat32Ulp );
					// A rounding-created corner band may retain one adjacent Float32
					// coordinate while another component already collapsed. Contract
					// it to an EXISTING incident vertex, with a total one-ULP budget.
					for ( const vertex of face ) {

						const v = this.materialize( topology.vertices[ vertex ] );
						// An already materialized incident corner must not be pulled
						// away by a later edge-band candidate on either operand.
						if ( this.materialize( point ).equals( v ) ) roundedCorners.add( point );
						const delta = v.clone().sub( point );
						const collapsedComponent = [ 0, 1, 2 ].some( k => point.getComponent( k ) !== v.getComponent( k ) && Math.fround( point.getComponent( k ) ) === v.getComponent( k ) );
						if ( ! collapsedComponent || Math.abs( delta.x ) > 2 * budget[ 0 ] || Math.abs( delta.y ) > 2 * budget[ 1 ] || Math.abs( delta.z ) > 2 * budget[ 2 ] ) continue;
						const output = this.materialize( point );
						if ( output.equals( v ) ) continue;
						const distance = delta.lengthSq(), order = `${ topology.prefix }v${ vertex }`;
						const previous = candidates.get( point );
						if ( ! previous || previous.vertex === undefined || distance < previous.distance || distance === previous.distance && order < previous.order ) candidates.set( point, { topology, vertex, projection: v, distance, order } );

					}

					for ( let k = 0; k < 3; k ++ ) {

						const key = topology.edgeKey( face[ k ], face[ ( k + 1 ) % 3 ] );
						if ( topology.edgeCuts.get( key )?.has( point ) ) continue;
						const edge = topology.edges.get( key );
						const line = new Line3( topology.vertices[ edge.a ], topology.vertices[ edge.b ] );
						const projection = line.closestPointToPoint( point, true, new Vector3() );
						const delta = projection.clone().sub( point );
						if ( Math.abs( delta.x ) > budget[ 0 ] || Math.abs( delta.y ) > budget[ 1 ] || Math.abs( delta.z ) > budget[ 2 ] ) continue;
						if ( [ 0, 1, 2 ].some( k => Math.abs( Math.fround( projection.getComponent( k ) ) - point.getComponent( k ) ) > 2 * budget[ k ] ) ) continue;
						const output = this.materialize( point );
						if ( output.x === Math.fround( projection.x ) && output.y === Math.fround( projection.y ) && output.z === Math.fround( projection.z ) ) continue;
						const distance = delta.lengthSq();
						const order = topology.prefix + key;
						const previous = candidates.get( point );
						if ( ! previous || previous.vertex === undefined && ( distance < previous.distance || distance === previous.distance && order < previous.order ) ) candidates.set( point, { topology, key, projection, distance, order } );

					}

				}

			}

		}

		for ( const [ point, candidate ] of candidates ) {

			if ( roundedCorners.has( point ) ) continue;
			const { topology, key, vertex, projection, distance } = candidate;
			const output = this.materialize( point );
			output.set( Math.fround( projection.x ), Math.fround( projection.y ), Math.fround( projection.z ) );
			topology.addToStar( vertex === undefined ? { edge: key } : { vertex }, point );
			this.snappedPoints ++;
			this.maxSnapDistance = Math.max( this.maxSnapDistance, Math.sqrt( distance ) );
			this.maxAdjustedOutputDistance = Math.max( this.maxAdjustedOutputDistance, output.distanceTo( point ) );

		}

	}

	// Called once AFTER collection, BEFORE whole-face classification/output.
	// Explicit point constraints propagate cuts even to non-intersecting neighbors.
	propagate( aMap, bMap ) {

		this.resolveRoundingCollapses();

		// Support chart positions are not permission for unbounded output motion.
		// Check every incident construction preimage, including reused event keys.
		for ( const [ point, preimages ] of this.supportPreimages ) {

			const output = this.materialize( point );
			for ( const preimage of preimages ) for ( let k = 0; k < 3; k ++ ) {

				const delta = Math.abs( output.getComponent( k ) - preimage.getComponent( k ) );
				const budget = 2 * halfFloat32Ulp( preimage.getComponent( k ) );
				if ( ! Number.isFinite( delta ) || delta > budget ) throw new Error( 'Source support output exceeds one Float32 ULP.' );
				this.maxSupportOutputUlpRatio = Math.max( this.maxSupportOutputUlpRatio, delta / budget );

			}

		}

		for ( const [ topology, map ] of [[ this.a, aMap ], [ this.b, bMap ]] ) {

			// Quantization can move an interior cut onto the representable source
			// edge. Resolve that event ONLY within its known incident source face,
			// then update the whole edge/vertex star before building any boundary.
			// Equality is exact Float32 equality, not a world-space weld radius.
			// addToStar appends newly reached (face, point) pairs to this queue;
			// revisiting a previously reached face with a NEW point is necessary.
			for ( const [ id, point ] of topology.pending ) {

				const ids = topology.faces[ id ];
				const output = this.materialize( point );
				for ( let k = 0; k < 3; k ++ ) {

					const a = ids[ k ], b = ids[ ( k + 1 ) % 3 ];
					if ( output.equals( this.materialize( topology.vertices[ a ] ) ) ) topology.addToStar( { vertex: a }, point );
					const line = new Line3( topology.vertices[ a ], topology.vertices[ b ] );
					const projection = line.closestPointToPoint( point, true, new Vector3() );
					if ( output.x === Math.fround( projection.x ) && output.y === Math.fround( projection.y ) && output.z === Math.fround( projection.z ) ) topology.addToStar( { edge: topology.edgeKey( a, b ) }, point );

				}

			}

			topology.pending.length = 0;

			// All incidents use the same materialized point. Triangle contraction
			// and re-triangulation happen on this graph, not on an emitted mesh.
			for ( const edges of map.edgeSet.values() ) {

				for ( const edge of edges ) {

					edge.start = this.materialize( edge.start );
					edge.end = this.materialize( edge.end );

				}

			}

			map.boundaryPoints = new Map();
			map.boundaryEdges = new Map();
			for ( const id of topology.cuts.keys() ) {

				map.boundaryPoints.set( id, new Set( [ ...topology.cuts.get( id ) ].map( p => this.materialize( p ) ) ) );
				map.boundaryEdges.set( id, topology.boundary( id, p => this.materialize( p ) ) );

				if ( ! map.intersectionSet.has( id ) ) {

					map.intersectionSet.set( id, [] );
					map.ids.push( id );

				}

			}

		}

	}

}
