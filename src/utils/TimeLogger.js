function pad( str, len, char = ' ' ) {

	let res = str;
	while ( res.length < len ) {

		res += char;

	}

	return res;

}

export const TimeLogger = new class {

	constructor() {

		this._running = {};
		this._timing = {};

	}

	start( key ) {

		const { _running, _timing } = this;
		if ( key in _running ) {

			console.warn( `TimeLogger: already tracking key ${ key }` );
			return;

		}

		if ( ! ( key in _timing ) ) {

			_timing[ key ] = 0;

		}


		_running[ key ] = window.performance.now();

	}

	end( key ) {

		const { _running, _timing } = this;
		if ( ! ( key in _running ) ) {

			console.warn( `TimeLogger: not tracking key ${ key }` );
			return;

		}

		const delta = window.performance.now() - _running[ key ];
		_timing[ key ] += delta;
		delete _running[ key ];

	}

	log() {

		const { _timing } = this;
		for ( const key in _timing ) {

			console.log( `${ pad( key, 20 ) } : ${ _timing[ key ].toFixed( 3 ) }ms` );

		}

		this._timing = {};

	}

}();
