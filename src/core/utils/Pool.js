// class for getting reusable object instances and releasing them for reuse
export class Pool {

	constructor( createFn ) {

		this.createFn = createFn;
		this._pool = [];
		this._index = 0;

	}

	getInstance() {

		if ( this._index >= this._pool.length ) {

			this._pool.push( this.createFn() );

		}

		return this._pool[ this._index ++ ];

	}

	clear() {

		this._index = 0;

	}

	reset() {

		this._pool.length = 0;
		this._index = 0;

	}

}
