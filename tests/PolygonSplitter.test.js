import { Vector3, Triangle, BoxGeometry } from 'three';
import { PolygonSplitter, Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION, computeMeshVolume } from '../src';

describe( 'PolygonSplitter', () => {

	let splitter;
	beforeEach( () => {

		splitter = new PolygonSplitter();

	} );

	describe( 'getPolygonRegions', () => {

		it( 'should return a single region when no constraint edges split the triangle.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			expect( regions ).toHaveLength( 1 );
			expect( regions[ 0 ].triangleIndices ).toHaveLength( splitter.triangles.length );

		} );

		it( 'should return two regions when a constraint edge bisects the triangle.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );

			const edge = {
				start: new Vector3( 0.5, 0, 0 ),
				end: new Vector3( 0, 0.5, 0 ),
			};
			splitter.addConstraintEdge( edge );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			expect( regions.length ).toBe( 2 );

			const allIndices = regions.flatMap( r => r.triangleIndices );
			expect( allIndices ).toHaveLength( splitter.triangles.length );
			expect( new Set( allIndices ).size ).toBe( splitter.triangles.length );

		} );

		it( 'should provide a midpoint for each region.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );

			const edge = {
				start: new Vector3( 0.5, 0, 0 ),
				end: new Vector3( 0, 0.5, 0 ),
			};
			splitter.addConstraintEdge( edge );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			for ( const region of regions ) {

				expect( region.midpoint ).toBeDefined();
				expect( region.midpoint.x ).toBeDefined();
				expect( region.midpoint.y ).toBeDefined();
				expect( region.midpoint.z ).toBeDefined();

			}

		} );

	} );

	describe( 'PolygonSplitter integration', () => {

		it( 'should produce correct volume with useCDTClipping enabled.', () => {

			const evaluator = new Evaluator();
			evaluator.useCDTClipping = true;

			const brush1 = new Brush( new BoxGeometry() );
			brush1.updateMatrixWorld();

			const brush2 = new Brush( new BoxGeometry() );
			brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
			brush2.updateMatrixWorld();

			const result1 = new Brush();
			const result2 = new Brush();
			evaluator.evaluate( brush1, brush2, [ SUBTRACTION, INTERSECTION ], [ result1, result2 ] );

			const vol1 = computeMeshVolume( result1 );
			const vol2 = computeMeshVolume( result2 );
			expect( vol1 + vol2 ).toBeCloseTo( 1, 7 );

		} );

		it( 'should produce correct volume for ADDITION with useCDTClipping.', () => {

			const evaluator = new Evaluator();
			evaluator.useCDTClipping = true;

			const brush1 = new Brush( new BoxGeometry() );
			brush1.updateMatrixWorld();

			const brush2 = new Brush( new BoxGeometry() );
			brush2.position.set( 0.5, 0.5, 0.5 );
			brush2.updateMatrixWorld();

			const result = evaluator.evaluate( brush1, brush2, ADDITION );
			const vol = computeMeshVolume( result );
			expect( vol ).toBeCloseTo( 1.875, 5 );

		} );

		it( 'should produce correct result with canonical edge sharing.', () => {

			const evaluator = new Evaluator();
			evaluator.useCDTClipping = true;

			const brush1 = new Brush( new BoxGeometry() );
			brush1.updateMatrixWorld();

			const brush2 = new Brush( new BoxGeometry() );
			brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
			brush2.updateMatrixWorld();

			const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );
			expect( computeMeshVolume( result ) ).toBeGreaterThan( 0 );

		} );

	} );

} );
