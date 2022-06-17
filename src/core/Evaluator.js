import { TriangleSplitter } from './TriangleSplitter.js';
import { performOperation } from './operations.js';

export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();

	}

	evaluate( a, b, operation ) {

		return performOperation( a, b, operation, this.triangleSplitter );

	}

	evaluateHierarchy( root ) {

		// TODO

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
