import { BoxGeometry, SphereGeometry } from 'three';
import { Brush, Evaluator, SUBTRACTION } from '../src';

describe( 'PolygonSplitter Performance', () => {

	let evaluator;
	beforeEach( () => {

		evaluator = new Evaluator();
		evaluator.attributes = [ 'position', 'normal' ];

	} );

	it( 'should compare performance with TriangleSplitter', () => {

		// Create test brushes
		const brush1a = new Brush( new BoxGeometry( 2, 2, 2 ) );
		brush1a.updateMatrixWorld();

		const brush2a = new Brush( new SphereGeometry( 1.25, 16, 8 ) );
		brush2a.position.set( 0.5, 0.5, 0.5 );
		brush2a.updateMatrixWorld();

		const brush1b = new Brush( new BoxGeometry( 2, 2, 2 ) );
		brush1b.updateMatrixWorld();

		const brush2b = new Brush( new SphereGeometry( 1.25, 16, 8 ) );
		brush2b.position.set( 0.5, 0.5, 0.5 );
		brush2b.updateMatrixWorld();

		// Warm up
		evaluator.useSymmetricalClipping = false;
		evaluator.evaluate( brush1a, brush2a, SUBTRACTION );

		evaluator.useSymmetricalClipping = true;
		evaluator.evaluate( brush1b, brush2b, SUBTRACTION );

		// Benchmark TriangleSplitter
		const triangleStart = performance.now();
		evaluator.useSymmetricalClipping = false;
		const triangleResult = evaluator.evaluate( brush1a, brush2a, SUBTRACTION );
		const triangleTime = performance.now() - triangleStart;

		// Benchmark PolygonSplitter
		const polygonStart = performance.now();
		evaluator.useSymmetricalClipping = true;
		const polygonResult = evaluator.evaluate( brush1b, brush2b, SUBTRACTION );
		const polygonTime = performance.now() - polygonStart;

		console.log( `TriangleSplitter: ${triangleTime.toFixed(2)}ms, ${triangleResult.geometry.attributes.position.count} vertices` );
		console.log( `PolygonSplitter:  ${polygonTime.toFixed(2)}ms, ${polygonResult.geometry.attributes.position.count} vertices` );

		// Both should produce valid results
		expect( triangleResult.geometry.attributes.position.count ).toBeGreaterThan( 0 );
		expect( polygonResult.geometry.attributes.position.count ).toBeGreaterThan( 0 );

		// Performance should be reasonable (within 10x of each other)
		const ratio = Math.max( triangleTime, polygonTime ) / Math.min( triangleTime, polygonTime );
		expect( ratio ).toBeLessThan( 10 );

	} );

	it( 'should handle complex geometry efficiently', () => {

		// More complex test case
		const brush1 = new Brush( new BoxGeometry( 3, 3, 3 ) );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new SphereGeometry( 2, 32, 16 ) );
		brush2.position.set( 1, 1, 1 );
		brush2.updateMatrixWorld();

		// Test PolygonSplitter with complex geometry
		const start = performance.now();
		evaluator.useSymmetricalClipping = true;
		const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );
		const time = performance.now() - start;

		console.log( `Complex geometry: ${time.toFixed(2)}ms, ${result.geometry.attributes.position.count} vertices` );

		// Should complete in reasonable time (less than 5 seconds)
		expect( time ).toBeLessThan( 5000 );
		expect( result.geometry.attributes.position.count ).toBeGreaterThan( 0 );

	} );

} );