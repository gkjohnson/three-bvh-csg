import { Mesh, Matrix4 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { areSharedArrayBuffersSupported, convertToSharedArrayBuffer } from './utils.js';

export class Brush extends Mesh {

	constructor( ...args ) {

		super( ...args );

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

		// - half edges

		// generate shared array buffers
		const geometry = this.geometry;
		const attributes = geometry.attributes;
		if ( areSharedArrayBuffersSupported() ) {

			for ( const key in attributes ) {

				const attribute = attributes[ key ];
				if ( attribute.isInterleavedBufferAttribute ) {

					throw new Error();

				}

				attribute.array = convertToSharedArrayBuffer( attribute.array );

			}

		}

		// generate bounds tree
		geometry.boundsTree = new MeshBVH( geometry );

	}

	disposeCacheData() {

		// - half edges

		this.geometry.boundsTree = null;

	}

}
