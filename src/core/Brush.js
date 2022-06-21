import { Mesh, Matrix4 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
// import { HalfEdgeMap } from './HalfEdgeMap.js';
import { areSharedArrayBuffersSupported, convertToSharedArrayBuffer } from './utils.js';

export class Brush extends Mesh {

	constructor( ...args ) {

		super( ...args );

		this.isBrush = true;
		this._previousMatrix = new Matrix4();
		this._previousMatrix.elements.fill( 0 );

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
		if ( areSharedArrayBuffersSupported() ) {

			for ( const key in attributes ) {

				const attribute = attributes[ key ];
				if ( attribute.isInterleavedBufferAttribute ) {

					throw new Error( 'Brush: InterleavedBufferAttributes are not supported.' );

				}

				attribute.array = convertToSharedArrayBuffer( attribute.array );

			}

		}

		// generate bounds tree
		if ( ! geometry.boundsTree ) {

			geometry.boundsTree = new MeshBVH( geometry, { maxLeafTris: 3 } );
			geometry.halfEdges = null;

		}

		// generate half edges
		// if ( ! geometry.halfEdges ) {

		// 	geometry.halfEdges = new HalfEdgeMap( geometry );

		// }

	}

	disposeCacheData() {

		const { geometry } = this;
		geometry.halfEdges = null;
		geometry.boundsTree = null;

	}

}
