import { Brush } from './Brush.js';
import { PASSTHROUGH } from './constants.js';

export class Operation extends Brush {

	constructor() {

		super( null, null );
		this.operation = PASSTHROUGH;

	}

}
