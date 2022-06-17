import { TriangleSplitter } from './TriangleSplitter.js';
import { performOperation } from './operations.js';

export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();

	}

	performOperation( a, b, operation ) {

		return performOperation( a, b, operation, this.triangleSplitter );

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
