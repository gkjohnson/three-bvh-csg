import { hashNumber } from '../src/core/utils/hashUtils.js';

const HASH_WIDTH = 1e-6;
const HALF_HASH_WIDTH = 0.5 * HASH_WIDTH;
const EPS = 1e-7;
describe( 'hashNumber', () => {

	it( 'should round up and down to the nearest value near zero.', () => {

		expect( hashNumber( 0 ) ).toBe( 0 );
		expect( hashNumber( EPS ) ).toBe( 0 );
		expect( hashNumber( - EPS ) ).toBe( 0 );

	} );

	it( 'should round up and down to the nearest value near one.', () => {

		expect( hashNumber( 1 ) ).toBe( 1e6 );
		expect( hashNumber( 1 + EPS ) ).toBe( 1e6 );
		expect( hashNumber( 1 - EPS ) ).toBe( 1e6 );

	} );

	it( 'should round up and down to the nearest value near 1e6.', () => {

		expect( hashNumber( 1e-6 ) ).toBe( 1 );
		expect( hashNumber( 1e-6 + EPS ) ).toBe( 1 );
		expect( hashNumber( 1e-6 - EPS ) ).toBe( 1 );

	} );

	it( 'should report one hash value away if it\'s outside the hash width', () => {

		expect( hashNumber( 1e-6 + HALF_HASH_WIDTH * 1.01 ) ).toBe( 2 );
		expect( hashNumber( 1e-6 - HALF_HASH_WIDTH * 1.01 ) ).toBe( 0 );
		expect( hashNumber( 1 + HALF_HASH_WIDTH * 1.01 ) ).toBe( 1e6 + 1 );
		expect( hashNumber( 1 - HALF_HASH_WIDTH * 1.01 ) ).toBe( 1e6 - 1 );

	} );

} );
