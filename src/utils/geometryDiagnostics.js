import { Line3, Triangle, Vector3 } from 'three';
import { HalfEdgeMap } from '../core/HalfEdgeMap.js';
import { getTriCount } from '../core/utils/geometryUtils.js';
import { hashVertex3 } from '../core/utils/hashUtils.js';
import { toEdgeIndex, toTriIndex } from '../core/utils/halfEdgeUtils.js';

const _vertexA = new Vector3();
const _vertexB = new Vector3();
const _vertexC = new Vector3();

function getGeometry( geometry ) {

	return geometry.isMesh ? geometry.geometry : geometry;

}

function getVertexIndex( geometry, vertexIndex ) {

	const index = geometry.index;
	return index ? index.getX( vertexIndex ) : vertexIndex;

}

function getTriangleVertexIndex( geometry, triangleIndex, cornerIndex ) {

	return getVertexIndex( geometry, 3 * triangleIndex + cornerIndex );

}

function getTriangleVertex( geometry, triangleIndex, cornerIndex, target ) {

	const position = geometry.attributes.position;
	return target.fromBufferAttribute(
		position,
		getTriangleVertexIndex( geometry, triangleIndex, cornerIndex ),
	);

}

function getBoundaryEdge( geometry, triangleIndex, edgeIndex, line = null ) {

	const nextEdgeIndex = ( edgeIndex + 1 ) % 3;
	const vertexIndexA = getTriangleVertexIndex( geometry, triangleIndex, edgeIndex );
	const vertexIndexB = getTriangleVertexIndex( geometry, triangleIndex, nextEdgeIndex );
	const vertexA = line ? line.start.clone() : getTriangleVertex( geometry, triangleIndex, edgeIndex, new Vector3() );
	const vertexB = line ? line.end.clone() : getTriangleVertex( geometry, triangleIndex, nextEdgeIndex, new Vector3() );

	return {
		triangleIndex,
		edgeIndex,
		vertexIndices: [ vertexIndexA, vertexIndexB ],
		vertexHashes: [ hashVertex3( vertexA ), hashVertex3( vertexB ) ],
		vertices: [ vertexA, vertexB ],
		line: line ? line.clone() : new Line3( vertexA.clone(), vertexB.clone() ),
	};

}

function getDisjointOpenBoundaryEdges( geometry, halfEdges ) {

	const openEdges = [];

	halfEdges.unmatchedDisjointEdges.forEach( ( { forward, reverse, ray } ) => {

		[ ...forward, ...reverse ].forEach( ( { start, end, index } ) => {

			const line = new Line3();
			ray.at( start, line.start );
			ray.at( end, line.end );

			openEdges.push( getBoundaryEdge(
				geometry,
				toTriIndex( index ),
				toEdgeIndex( index ),
				line,
			) );

		} );

	} );

	return openEdges;

}

class DisjointSet {

	constructor() {

		this.parents = new Map();

	}

	add( value ) {

		if ( ! this.parents.has( value ) ) {

			this.parents.set( value, value );

		}

	}

	find( value ) {

		const parent = this.parents.get( value );
		if ( parent === value ) {

			return value;

		}

		const root = this.find( parent );
		this.parents.set( value, root );
		return root;

	}

	union( a, b ) {

		this.add( a );
		this.add( b );

		const rootA = this.find( a );
		const rootB = this.find( b );
		if ( rootA !== rootB ) {

			this.parents.set( rootB, rootA );

		}

	}

}

function getTriangleSetsFromBoundaryEdges( geometry, openEdges ) {

	const disjointSet = new DisjointSet();
	const vertexMap = new Map();

	openEdges.forEach( edge => {

		const { triangleIndex, vertexHashes } = edge;
		disjointSet.add( triangleIndex );

		vertexHashes.forEach( hash => {

			if ( ! vertexMap.has( hash ) ) {

				vertexMap.set( hash, [] );

			}

			vertexMap.get( hash ).push( triangleIndex );

		} );

	} );

	vertexMap.forEach( triangleIndices => {

		const firstTriangleIndex = triangleIndices[ 0 ];
		for ( let i = 1, l = triangleIndices.length; i < l; i ++ ) {

			disjointSet.union( firstTriangleIndex, triangleIndices[ i ] );

		}

	} );

	const groupMap = new Map();
	openEdges.forEach( edge => {

		const root = disjointSet.find( edge.triangleIndex );
		if ( ! groupMap.has( root ) ) {

			groupMap.set( root, {
				triangleIndices: new Set(),
				edges: [],
			} );

		}

		const group = groupMap.get( root );
		group.triangleIndices.add( edge.triangleIndex );
		group.edges.push( edge );

	} );

	return [ ...groupMap.values() ].map( group => {

		const triangleIndices = [ ...group.triangleIndices ].sort( ( a, b ) => a - b );
		return {
			triangleIndices,
			edges: group.edges,
			triangles: triangleIndices.map( index => getTriangle( geometry, index ) ),
		};

	} );

}

export function getTriangle( geometry, triangleIndex, target = new Triangle() ) {

	geometry = getGeometry( geometry );

	return target.set(
		getTriangleVertex( geometry, triangleIndex, 0, _vertexA ),
		getTriangleVertex( geometry, triangleIndex, 1, _vertexB ),
		getTriangleVertex( geometry, triangleIndex, 2, _vertexC ),
	);

}

export function getOpenBoundaryEdges( geometry, options = {} ) {

	geometry = getGeometry( geometry );

	const {
		matchDisjointEdges = true,
		useAllAttributes = false,
	} = options;

	const halfEdges = new HalfEdgeMap();
	halfEdges.matchDisjointEdges = matchDisjointEdges;
	halfEdges.useAllAttributes = useAllAttributes;
	halfEdges.useDrawRange = false;
	halfEdges.updateFrom( geometry );

	if ( matchDisjointEdges ) {

		return getDisjointOpenBoundaryEdges( geometry, halfEdges );

	}

	const openEdges = [];
	const triCount = getTriCount( geometry );
	for ( let triangleIndex = 0; triangleIndex < triCount; triangleIndex ++ ) {

		for ( let edgeIndex = 0; edgeIndex < 3; edgeIndex ++ ) {

			const siblingTriangleIndex = halfEdges.getSiblingTriangleIndex( triangleIndex, edgeIndex );
			const disjointSiblingIndices = matchDisjointEdges ?
				halfEdges.getDisjointSiblingTriangleIndices( triangleIndex, edgeIndex ) :
				[];

			if ( siblingTriangleIndex === - 1 && disjointSiblingIndices.length === 0 ) {

				openEdges.push( getBoundaryEdge( geometry, triangleIndex, edgeIndex ) );

			}

		}

	}

	return openEdges;

}

export function getOpenTriangleSets( geometry, options = {} ) {

	geometry = getGeometry( geometry );
	return getTriangleSetsFromBoundaryEdges(
		geometry,
		getOpenBoundaryEdges( geometry, options ),
	);

}

export function getGeometryDiagnostic( geometry, options = {} ) {

	geometry = getGeometry( geometry );

	const openEdges = getOpenBoundaryEdges( geometry, options );
	const openTriangleSets = getTriangleSetsFromBoundaryEdges( geometry, openEdges );
	const openTriangleIndices = new Set();

	openTriangleSets.forEach( set => {

		set.triangleIndices.forEach( index => openTriangleIndices.add( index ) );

	} );

	return {
		isSolid: openEdges.length === 0,
		isWaterTight: openEdges.length === 0,
		openEdgeCount: openEdges.length,
		openTriangleCount: openTriangleIndices.size,
		openEdges,
		openTriangleSets,
	};

}
