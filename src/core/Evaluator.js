import { BufferGeometry, BufferAttribute } from 'three';
import { TriangleSplitter } from './TriangleSplitter.js';
import { TypedAttributeData } from './TypedAttributeData.js';
import { performOperation } from './operations.js';

function applyToGeometry( geometry, referenceGeometry, attributeData ) {

	let needsDisposal = false;
	let drawRange = - 1;
	const attributes = geometry.attributes;
	for ( const key in attributeData ) {

		const { array, type, length } = attributeData[ key ];
		const trimmedArray = new type( array.buffer, 0, length );

		let attr = attributes[ key ];
		if ( ! attr ) {

			const refAttr = referenceGeometry.attributes[ key ];
			attr = new BufferAttribute( trimmedArray.slice(), refAttr.itemSize, refAttr.normalized );
			geometry.setAttribute( key, attr );

		} else if ( attr.array.length < length ) {

			needsDisposal = true;
			attr.array = trimmedArray.slice();

		} else {

			attr.array.set( trimmedArray, 0 );

		}

		drawRange = length / attr.itemSize;


	}

	geometry.setDrawRange( 0, drawRange );

	if ( geometry.index ) {

		const indexArray = geometry.index.array;
		if ( indexArray.length < drawRange ) {

			geometry.toNonIndexed();
			needsDisposal = true;

		} else {

			for ( let i = 0, l = indexArray.length; i < l; i ++ ) {

				indexArray[ i ] = i;

			}

		}

	}

	geometry.boundsTree = null;

	if ( needsDisposal ) {

		geometry.dispose();

	}

	return geometry;

}

export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();
		this.attributeData = new TypedAttributeData();
		this.attributes = [ 'position', 'uv', 'normal' ];

	}

	evaluate( a, b, operation ) {

		a.prepareGeometry();
		b.prepareGeometry();

		const { triangleSplitter, attributeData, attributes } = this;
		const aAttributes = a.geometry.attributes;
		for ( let i = 0, l = attributes.length; i < l; i ++ ) {

			const key = attributes[ i ];
			const attr = aAttributes[ key ];
			attributeData.initializeArray( key, attr.array.constructor );

		}

		attributeData.clear();

		performOperation( a, b, operation, triangleSplitter, attributeData );
		return applyToGeometry( new BufferGeometry(), a.geometry, attributeData.attributes );

	}

	evaluateHierarchy( root ) {

		// TODO

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
