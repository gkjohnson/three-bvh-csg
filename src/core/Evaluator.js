import { TriangleSplitter } from './TriangleSplitter.js';
import { TypedAttributeData } from './TypedAttributeData.js';
import { performOperation } from './operations.js';

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

		return performOperation( a, b, operation, triangleSplitter, attributeData );

	}

	evaluateHierarchy( root ) {

		// TODO

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
