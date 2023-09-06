import { BoxGeometry, SphereGeometry } from 'three';
import { HalfEdgeMap } from '../src';

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

} );
