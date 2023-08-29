import { Brush, Evaluator, SUBTRACTION } from '../src';
import { SphereGeometry, BufferAttribute } from 'three';

describe( 'Evaluator', () => {

	it( 'it not fail if multiple operations with different buffer types.', () => {

		const geo1 = new SphereGeometry();
		const geo2 = new SphereGeometry();
		geo2.setAttribute(
			'uv',
			new BufferAttribute( new Uint8Array( geo2.attributes.uv.array.length ), 2, true ),
		);

		const brush1A = new Brush( geo1 );
		const brush1B = new Brush( geo1 );

		const brush2A = new Brush( geo2 );
		const brush2B = new Brush( geo2 );

		const evaluator = new Evaluator();
		const result1 = evaluator.evaluate( brush1A, brush1B, SUBTRACTION );
		const result2 = evaluator.evaluate( brush2A, brush2B, SUBTRACTION );


	} );


} );
