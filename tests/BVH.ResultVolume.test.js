import { Brush, Evaluator, SUBTRACTION, computeMeshVolume } from '../src';
import { SphereGeometry } from 'three';

describe( 'CSG', () => {

	it( 'subtraction should result in the volume of difference.', () => {

		const sphere1 = new Brush( new SphereGeometry() );
		const sphere2 = new Brush( new SphereGeometry() );
		sphere2.scale.setScalar( 0.5 );
		sphere2.updateMatrixWorld( true );

		const evaluator = new Evaluator();
		const result = evaluator.evaluate( sphere1, sphere2, SUBTRACTION );

		const vol1 = computeMeshVolume( sphere1 );
		const vol2 = computeMeshVolume( sphere2 );
		const finalVol = computeMeshVolume( result );
		expect( finalVol ).toBeCloseTo( vol1 - vol2, 10 );

	} );

} );
