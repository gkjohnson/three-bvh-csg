import { Brush, Evaluator, SUBTRACTION } from '../src';
import { BoxGeometry } from 'three';

describe( 'Evaluator', () => {

	describe( 'consolidateGroups', () => {

		it( 'should merge groups with common materials when true.', () => {

			const evaluator = new Evaluator();
			evaluator.useGroups = true;
			evaluator.consolidateGroups = true;

			const brush1 = new Brush( new BoxGeometry() );
			brush1.updateMatrixWorld();

			const brush2 = new Brush( new BoxGeometry() );
			brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
			brush2.updateMatrixWorld();

			const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );
			expect( result.material ).toHaveLength( 2 );
			expect( result.geometry.groups ).toHaveLength( 2 );

		} );

		it( 'should not merge groups with common materials when false.', () => {

			const evaluator = new Evaluator();
			evaluator.useGroups = true;
			evaluator.consolidateGroups = false;

			const brush1 = new Brush( new BoxGeometry() );
			brush1.geometry.groups.forEach( g => g.materialIndex = 0 );
			brush1.updateMatrixWorld();

			const brush2 = new Brush( new BoxGeometry() );
			brush2.geometry.groups.forEach( g => g.materialIndex = 0 );
			brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
			brush2.updateMatrixWorld();

			const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );
			expect( result.material ).toHaveLength( 2 );
			expect( result.geometry.groups ).toHaveLength( 12 );

		} );

	} );

} );
