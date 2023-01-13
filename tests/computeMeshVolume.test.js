import { SphereGeometry, BoxGeometry, Mesh } from 'three';
import { computeMeshVolume } from '../src/index.js';

const PRECISION = 10;

describe( 'computeMeshVolume', () => {

	it( 'should compute the volume of geometry.', () => {

		const volume = computeMeshVolume( new BoxGeometry() );
		expect( volume ).toBeCloseTo( 1, PRECISION );

	} );

	it( 'should compute the volume of a mesh.', () => {

		const mesh = new Mesh( new BoxGeometry() );
		const volume = computeMeshVolume( mesh );
		expect( volume ).toBeCloseTo( 1, PRECISION );

	} );

	it( 'should compute the volume of a larger box.', () => {

		const mesh = new Mesh( new BoxGeometry( 2, 2, 2 ) );
		const volume = computeMeshVolume( mesh );
		expect( volume ).toBeCloseTo( 8, PRECISION );

	} );

	it( 'should compute the volume of a scaled box.', () => {

		const mesh = new Mesh( new BoxGeometry( 2, 2, 2 ) );
		mesh.scale.x = 0.5;
		mesh.updateMatrixWorld();

		const volume = computeMeshVolume( mesh );
		expect( volume ).toBeCloseTo( 4, PRECISION );

	} );

	it( 'should compute the volume of a sphere.', () => {

		// sphere won't be completely accurate to a smooth sphere so we have a higher
		// precision tolerance here.
		const mesh = new Mesh( new SphereGeometry( 1, 100, 100 ) );
		const volume = computeMeshVolume( mesh );
		expect( volume ).toBeCloseTo( Math.PI * 4 / 3, 2 );

	} );

} );
