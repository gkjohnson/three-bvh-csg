import { BufferGeometry } from 'three';
import { Brush } from '../Brush.js';
import { ADDITION } from '../constants.js';

export class Operation extends Brush {

	constructor( ...args ) {

		super( ...args );

		this.isOperation = true;
		this.operation = ADDITION;

		this._cachedGeometry = new BufferGeometry();
		this._cachedMaterials = null;
		this._previousOperation = null;

	}

	markUpdated() {

		super.markUpdated();
		this._previousOperation = this.operation;

	}

	isDirty() {

		return this.operation !== this._previousOperation || super.isDirty();

	}

	insertBefore( brush ) {

		const parent = this.parent;
		const index = parent.children.indexOf( this );
		parent.children.splice( index, 0, brush );

	}

	insertAfter( brush ) {

		const parent = this.parent;
		const index = parent.children.indexOf( this );
		parent.children.splice( index + 1, 0, brush );

	}

}
