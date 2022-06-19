import { Brush } from './Brush.js';
import { PASSTHROUGH } from './constants.js';

export class Operation extends Brush {

	constructor() {

		super( null, null );

		this.isOperation = true;
		this.operation = PASSTHROUGH;
		this._previousOperation = null;
		this._geometrySet = [];

	}

	isDirty() {

		return this.operation !== this._previousOperation || super.isDirty();

	}

}
