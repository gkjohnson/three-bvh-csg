import { Matrix4, Triangle, Vector3 } from 'three';

// Internal, opt-in construction history, NOT a coplanarity or coverage predicate.
// Never serialize through userData: a geometry clone deliberately loses history.
const records = new WeakMap();
const identity = Object.freeze( new Matrix4().elements );

function layout( geometry ) {

	return [ geometry.drawRange.start, geometry.drawRange.count,
		...geometry.groups.flatMap( g => [ g.start, g.count, g.materialIndex ] ) ];

}

function captureAttribute( attribute ) {

	if ( ! attribute ) return null;
	return { attribute, version: attribute.version, count: attribute.count, itemSize: attribute.itemSize,
		normalized: attribute.normalized, array: attribute.array,
		bytes: new Uint8Array( attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength ).slice() };

}

function unchanged( attribute, snapshot, allowArrayReplacement = false ) {

	if ( ! snapshot ) return ! attribute;
	if ( attribute !== snapshot.attribute || attribute.version !== snapshot.version || attribute.count !== snapshot.count ||
		attribute.itemSize !== snapshot.itemSize || attribute.normalized !== snapshot.normalized ||
		( ! allowArrayReplacement && attribute.array !== snapshot.array ) ) return false;
	const bytes = new Uint8Array( attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength );
	if ( bytes.length !== snapshot.bytes.length ) return false;
	// Versions alone miss setXYZ/raw-array writes. No probabilistic hash equality.
	for ( let i = 0; i < bytes.length; i ++ ) if ( bytes[ i ] !== snapshot.bytes[ i ] ) return false;
	return true;

}

function onDispose( event ) {

	records.delete( event.target );

}

export function clearSourceFaces( geometry ) {

	records.delete( geometry );
	geometry.removeEventListener( 'dispose', onDispose );

}

export function setSourceFaces( geometry, faces ) {

	records.set( geometry, {
		faces: Object.freeze( faces.slice() ),
		position: captureAttribute( geometry.attributes.position ),
		index: captureAttribute( geometry.index ), layout: layout( geometry ),
	} );
	geometry.addEventListener( 'dispose', onDispose );

}

// Validate once at operation entry, not inside per-triangle loops. No stale
// equality claim after edits, even when a client forgot needsUpdate.
export function getSourceFaces( geometry ) {

	const record = records.get( geometry );
	if ( ! record ) return null;
	const currentLayout = layout( geometry );
	if ( record.layout.length !== currentLayout.length || ! record.layout.every( ( v, i ) => Object.is( v, currentLayout[ i ] ) ) ||
		! unchanged( geometry.attributes.position, record.position ) ||
		! unchanged( geometry.index, record.index ) ) {

		clearSourceFaces( geometry );
		return null;

	}

	return record.faces;

}

export function prepareSourceFaces( brush ) {

	let faces = getSourceFaces( brush.geometry );
	if ( ! faces || ! brush.geometry.boundsTree || ! brush.geometry.halfEdges || ! brush.geometry.groupIndices ) {

		// Brush's historical uuid/count/version key does not detect raw writes,
		// replacement BufferAttributes, group or drawRange changes. Opt-in only.
		brush.disposeCacheData();
		brush._hash = null;

	}

	const previous = records.get( brush.geometry );
	brush.prepareGeometry();
	if ( faces ) {

		// prepareGeometry may replace ArrayBuffers with SharedArrayBuffers.
		// Preserve identity ONLY after checking the replacement bytes exactly.
		const geometry = brush.geometry;
		if ( geometry.attributes.position.array === previous.position.array && geometry.index?.array === previous.index?.array ) return faces;
		if ( unchanged( geometry.attributes.position, previous.position, true ) && unchanged( geometry.index, previous.index, true ) ) {

			setSourceFaces( geometry, faces );
			return faces;

		}

	}

	const geometry = brush.geometry, position = geometry.attributes.position, index = geometry.index;
	faces = [];
	const count = index ? index.count : position.count;
	for ( let i = 0; i < count; i += 3 ) {

		const points = [];
		for ( let k = 0; k < 3; k ++ ) {

			const v = index ? index.getX( i + k ) : i + k;
			points.push( position.getX( v ), position.getY( v ), position.getZ( v ) );

		}

		// Identity is this immutable source token, never rounded plane coefficients.
		const source = Object.freeze( { triangle: i / 3, points: Object.freeze( points ) } );
		faces.push( Object.freeze( { source, frame: identity, orientation: 1 } ) );

	}

	setSourceFaces( geometry, faces );
	return faces;

}

// One mapper per operand emission pass. Share transformed frames and face records
// across all fragments; no parent Brush, Geometry, snapshot or history chain.
export function sourceFaceMapper( faces, matrix ) {

	const frames = new Map(), forward = new Map(), reverse = new Map();
	return ( id, inverted ) => {

		const face = faces[ id ];
		if ( ! face ) throw new Error( 'Missing source face for emitted triangle.' );
		const cache = inverted ? reverse : forward;
		if ( ! cache.has( face ) ) {

			if ( ! frames.has( face.frame ) ) {

				const frame = new Matrix4().multiplyMatrices( matrix, new Matrix4().fromArray( face.frame ) );
				frames.set( face.frame, Object.freeze( frame.elements ) );

			}

			cache.set( face, Object.freeze( { source: face.source, frame: frames.get( face.frame ),
				orientation: face.orientation * ( inverted ? - 1 : 1 ) } ) );

		}

		return cache.get( face );

	};

}

// Exact equality only; inverse(M) * M is identity only for invertible frames.
export function sameInvertibleFrame( a, b ) {

	if ( ! a.equals( b ) || ! a.elements.every( Number.isFinite ) ) return false;
	const determinant = a.determinant();
	return Number.isFinite( determinant ) && determinant !== 0;

}

// A shared supporting-source identity in the CURRENT world frame. This says
// nothing about overlap of the finite fragments or equality of their Float32
// planes! Exact matrix comparison intentionally has conservative false negatives.
export function sharedSourceSupport( a, matrixA, b, matrixB ) {

	if ( ! a || ! b || a.source !== b.source ) return false;
	const ma = new Matrix4().multiplyMatrices( matrixA, new Matrix4().fromArray( a.frame ) );
	const mb = new Matrix4().multiplyMatrices( matrixB, new Matrix4().fromArray( b.frame ) );
	return sameInvertibleFrame( ma, mb );

}

export function sourceTriangle( face, matrix = new Matrix4() ) {

	const frame = new Matrix4().multiplyMatrices( matrix, new Matrix4().fromArray( face.frame ) );
	const points = [ 0, 3, 6 ].map( i => new Vector3().fromArray( face.source.points, i ).applyMatrix4( frame ) );
	if ( face.orientation < 0 ) [ points[ 1 ], points[ 2 ] ] = [ points[ 2 ], points[ 1 ] ];
	return new Triangle( ...points );

}

// Diagnostic accounting: exact copied typed-buffer bytes, NOT total JS heap.
export function sourceFaceStats( geometry ) {

	const faces = getSourceFaces( geometry );
	if ( ! faces ) return null;
	const record = records.get( geometry );
	return { faces: faces.length, sources: new Set( faces.map( f => f.source ) ).size,
		frames: new Set( faces.map( f => f.frame ) ).size,
		snapshotBytes: record.position.bytes.byteLength + ( record.index?.bytes.byteLength || 0 ) };

}
