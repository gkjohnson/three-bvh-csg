import { Mesh, Matrix4 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { HalfEdgeMap } from './HalfEdgeMap.js';
import { areSharedArrayBuffersSupported, convertToSharedArrayBuffer, getTriCount } from './utils/geometryUtils.js';

export class Brush extends Mesh {

	constructor( ...args ) {

		super( ...args );

		this.isBrush = true;
		this._previousMatrix = new Matrix4();
		this._previousMatrix.elements.fill( 0 );
		this._halfEdges = null;
		this._boundsTree = null;
		this._groupIndices = null;
		this._hash = null;

	}

	markUpdated() {

		this._previousMatrix.copy( this.matrix );

	}

	isDirty() {

		const { matrix, _previousMatrix } = this;
		const el1 = matrix.elements;
		const el2 = _previousMatrix.elements;
		for ( let i = 0; i < 16; i ++ ) {

			if ( el1[ i ] !== el2[ i ] ) {

				return true;

			}

		}

		return false;

	}

	prepareGeometry() {

		// generate shared array buffers
		const geometry = this.geometry;
		const attributes = geometry.attributes;
		const useSharedArrayBuffer = areSharedArrayBuffersSupported();

		const index = geometry.index;
		const posAttr = geometry.attributes.position;
		const indexHash = index ? `${ index.uuid }_${ index.count }_${ index.version }` : '-1_-1_-1';
		const posHash = `${ posAttr.uuid }_${ posAttr.count }_${ posAttr.version }`;
		const hash = `${ geometry.uuid }_${ indexHash }_${ posHash }`;
		if ( this._hash === hash ) {

			return;

		}

		this._hash = hash;
		if ( useSharedArrayBuffer ) {

			for ( const key in attributes ) {

				const attribute = attributes[ key ];
				if ( attribute.isInterleavedBufferAttribute ) {

					throw new Error( 'Brush: InterleavedBufferAttributes are not supported.' );

				}

				attribute.array = convertToSharedArrayBuffer( attribute.array );

			}

		}

		// generate bounds tree
		geometry.boundsTree = new MeshBVH( geometry, { maxLeafSize: 3, indirect: true, useSharedArrayBuffer } );

		// generate half edges
		if ( ! geometry.halfEdges ) {

			geometry.halfEdges = new HalfEdgeMap();

		}

		geometry.halfEdges.updateFrom( geometry );

		// save group indices for materials
		const triCount = getTriCount( geometry );
		if ( ! geometry.groupIndices || geometry.groupIndices.length !== triCount ) {

			geometry.groupIndices = new Uint16Array( triCount );

		}

		const array = geometry.groupIndices;
		const groups = geometry.groups;
		for ( let i = 0, l = groups.length; i < l; i ++ ) {

			const { start, count } = groups[ i ];
			for ( let g = start / 3, lg = ( start + count ) / 3; g < lg; g ++ ) {

				array[ g ] = i;

			}

		}

	}

	disposeCacheData() {

		const { geometry } = this;
		geometry.halfEdges = null;
		geometry.boundsTree = null;
		geometry.groupIndices = null;

	}

}
