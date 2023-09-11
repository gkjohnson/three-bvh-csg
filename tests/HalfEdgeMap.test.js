import { BoxGeometry, SphereGeometry, BufferGeometry, BufferAttribute } from 'three';
import { Brush, Evaluator, HalfEdgeMap, SUBTRACTION } from '../src';

describe( 'HalfEdgeMap', () => {

	describe( 'useAllAttributes', () => {

		it( 'should connect all edges by position when false.', () => {

			const geometry = new BoxGeometry();
			const halfEdgeMap = new HalfEdgeMap();
			halfEdgeMap.useAllAttributes = false;
			halfEdgeMap.updateFrom( geometry );

			expect( halfEdgeMap.unmatchedEdges ).toBe( 0 );

		} );

		it( 'should leave some edges disconnected when true.', () => {

			const geometry = new BoxGeometry();
			const halfEdgeMap = new HalfEdgeMap();
			halfEdgeMap.useAllAttributes = true;
			halfEdgeMap.updateFrom( geometry );

			expect( halfEdgeMap.unmatchedEdges ).toBe( 24 );

		} );

		it( 'should leave some edges disconnected on a sphere when true.', () => {

			const geometry = new SphereGeometry( 1, 5, 5 );
			const halfEdgeMap = new HalfEdgeMap();
			halfEdgeMap.useAllAttributes = true;
			halfEdgeMap.updateFrom( geometry );

			expect( halfEdgeMap.unmatchedEdges ).toBe( 26 );

		} );

	} );

	describe( 'matchDisjointEdges', () => {

		it( 'should match disjoint edges.', () => {

			//    / \
			//   /   \
			//  -------
			//   \ | /
			//    \|/

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [

				// top triangle
				- 1, 0, 0,
				1, 0, 0,
				0, 1, 0,

				// bottom two triangles
				- 1, 0, 0,
				0, - 1, 0,
				0, 0, 0,

				1, 0, 0,
				0, 0, 0,
				0, - 1, 0,

			] ), 3 ) );

			const halfEdge = new HalfEdgeMap();
			halfEdge.matchDisjointEdges = true;
			halfEdge.updateFrom( geometry );

			expect( halfEdge.unmatchedEdges ).toBe( 4 );

		} );

		it( 'should match disjoint edges in the opposite order.', () => {

			//    / \
			//   /   \
			//  -------
			//   \ | /
			//    \|/

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [

				// bottom two triangles
				- 1, 0, 0,
				0, - 1, 0,
				0, 0, 0,

				1, 0, 0,
				0, 0, 0,
				0, - 1, 0,

				// top triangle
				- 1, 0, 0,
				1, 0, 0,
				0, 1, 0,

			] ), 3 ) );

			const halfEdge = new HalfEdgeMap();
			halfEdge.matchDisjointEdges = true;
			halfEdge.updateFrom( geometry );

			expect( halfEdge.unmatchedEdges ).toBe( 4 );

		} );

		it( 'should match partial disjoint edges.', () => {

			//    / \
			//   /   \
			//  -------
			//    \ /

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [

				- 1, 0, 0,
				1, 0, 0,
				0, 1, 0,

				0.5, 0, 0,
				- 0.5, 0, 0,
				0, - 1, 0,

			] ), 3 ) );

			const halfEdge = new HalfEdgeMap();
			halfEdge.matchDisjointEdges = true;
			halfEdge.updateFrom( geometry );

			expect( halfEdge.unmatchedEdges ).toBe( 5 );

		} );

		it( 'should consider a basic cube operation to be water tight.', () => {

			const b1 = new Brush( new BoxGeometry() );
			const b2 = new Brush( new BoxGeometry() );
			b2.position.y = 0.5;
			b2.scale.setScalar( 0.5 );
			b2.updateMatrixWorld( true );

			const evaluator = new Evaluator();
			const result = evaluator.evaluate( b1, b2, SUBTRACTION );
			const halfEdge = new HalfEdgeMap();
			halfEdge.matchDisjointEdges = true;
			halfEdge.updateFrom( result.geometry );

			expect( halfEdge.unmatchedEdges ).toBe( 0 );

		} );

	} );

} );
