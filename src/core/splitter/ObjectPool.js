export class ObjectPool {

	constructor( createCb, initCb = () => {} ) {

		this._createCb = createCb;
		this._initCb = initCb;

		this._index = 0;
		this._pool = [];

	}

	get() {

		const pool = this._pool;
		if ( this._index === pool.length ) {

			pool.push( this._createCb() );

		}

		const result = pool[ this._index ++ ];
		this._initCb( result );
		return result;

	}

	reset() {

		this._index = 0;

	}

}
