import { Brush, Evaluator, HalfEdgeMap, SUBTRACTION, INTERSECTION, computeMeshVolume } from '../src';
import { BoxGeometry, SphereGeometry, CylinderGeometry } from 'three';

// relative tolerance used when comparing result volumes
const VOLUME_EPSILON = 1e-6;

function createSpheres( scale ) {

	const a = new Brush( new SphereGeometry( scale, 32, 16 ) );
	const b = new Brush( new SphereGeometry( scale, 32, 16 ) );
	b.position.set( 0.5, 0.3, 0.2 ).multiplyScalar( scale );
	b.updateMatrixWorld();
	return [ a, b ];

}

function getUnmatchedEdges( geometry ) {

	const halfEdges = new HalfEdgeMap();
	halfEdges.updateFrom( geometry );
	return halfEdges.unmatchedEdges;

}

describe( 'CDT clipping', () => {

	it( 'should conserve volume at small and large scales.', () => {

		for ( const scale of [ 0.001, 1, 1000 ] ) {

			const [ a, b ] = createSpheres( scale );
			const evaluator = new Evaluator();
			evaluator.useCDTClipping = true;

			const difference = computeMeshVolume( evaluator.evaluate( a, b, SUBTRACTION ) );
			const intersection = computeMeshVolume( evaluator.evaluate( a, b, INTERSECTION ) );
			const volume = computeMeshVolume( a );
			expect( Math.abs( difference + intersection - volume ) / volume ).toBeLessThan( VOLUME_EPSILON );

		}

	} );

	it( 'should conserve volume with coplanar faces.', () => {

		const a = new Brush( new BoxGeometry( 1, 1, 1, 3, 3, 3 ) );
		const b = new Brush( new BoxGeometry( 1, 1, 1, 2, 2, 2 ) );
		b.position.set( 0.5, 0.25, 0 );
		b.updateMatrixWorld();

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		const difference = computeMeshVolume( evaluator.evaluate( a, b, SUBTRACTION ) );
		const intersection = computeMeshVolume( evaluator.evaluate( a, b, INTERSECTION ) );
		expect( difference ).toBeCloseTo( 0.625, 10 );
		expect( intersection ).toBeCloseTo( 0.375, 10 );

	} );

	it( 'should produce watertight results.', () => {

		const [ a, b ] = createSpheres( 1 );
		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		expect( getUnmatchedEdges( evaluator.evaluate( a, b, SUBTRACTION ).geometry ) ).toBe( 0 );
		expect( getUnmatchedEdges( evaluator.evaluate( a, b, INTERSECTION ).geometry ) ).toBe( 0 );

	} );

	// fails: seam vertices are computed separately per triangle so they don't match exactly at all scales
	it.fails( 'should produce watertight results at small and large scales.', () => {

		for ( const scale of [ 0.001, 1000 ] ) {

			const [ a, b ] = createSpheres( scale );
			const evaluator = new Evaluator();
			evaluator.useCDTClipping = true;

			expect( getUnmatchedEdges( evaluator.evaluate( a, b, SUBTRACTION ).geometry ) ).toBe( 0 );

		}

	} );

	// fails: the cdt2d exterior filter uses parity, dropping regions enclosed by an intersection loop
	it.fails( 'should keep faces enclosed by an intersection loop.', () => {

		// the cylinder cuts a closed loop inside a single triangle of the box face
		const a = new Brush( new BoxGeometry( 10, 1, 10 ) );
		const b = new Brush( new CylinderGeometry( 0.3, 0.3, 3, 16 ) );
		b.position.set( 1.1, 0, - 1.3 );
		b.updateMatrixWorld();

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		// the intersection is the 16-gon prism clipped to the box height
		const capArea = 0.5 * 16 * 0.3 * 0.3 * Math.sin( 2 * Math.PI / 16 );
		const intersection = computeMeshVolume( evaluator.evaluate( a, b, INTERSECTION ) );
		expect( Math.abs( intersection - capArea ) / capArea ).toBeLessThan( VOLUME_EPSILON );

	} );

} );
