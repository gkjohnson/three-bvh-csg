import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, PlaneGeometry } from 'three';
import {
	getGeometryDiagnostic,
	getOpenBoundaryEdges,
	getOpenTriangleSets,
	isWaterTight,
} from '../src/index.js';

describe( 'geometryDiagnostics', () => {

	it( 'should identify a closed box as solid.', () => {

		const diagnostic = getGeometryDiagnostic( new BoxGeometry() );

		expect( diagnostic.isSolid ).toBe( true );
		expect( diagnostic.isWaterTight ).toBe( true );
		expect( diagnostic.openEdgeCount ).toBe( 0 );
		expect( diagnostic.openTriangleCount ).toBe( 0 );
		expect( diagnostic.openEdges ).toHaveLength( 0 );
		expect( diagnostic.openTriangleSets ).toHaveLength( 0 );
		expect( isWaterTight( new BoxGeometry() ) ).toBe( true );

	} );

	it( 'should identify open boundary edges on a plane.', () => {

		const geometry = new PlaneGeometry();
		const openEdges = getOpenBoundaryEdges( geometry );
		const openSets = getOpenTriangleSets( geometry );
		const diagnostic = getGeometryDiagnostic( geometry );

		expect( diagnostic.isSolid ).toBe( false );
		expect( diagnostic.openEdgeCount ).toBe( 4 );
		expect( openEdges ).toHaveLength( 4 );
		expect( openSets ).toHaveLength( 1 );
		expect( openSets[ 0 ].triangleIndices ).toEqual( [ 0, 1 ] );
		expect( openSets[ 0 ].triangles ).toHaveLength( 2 );
		expect( isWaterTight( geometry ) ).toBe( false );

	} );

	it( 'should support mesh inputs.', () => {

		const mesh = new Mesh( new PlaneGeometry() );
		const diagnostic = getGeometryDiagnostic( mesh );

		expect( diagnostic.isSolid ).toBe( false );
		expect( diagnostic.openEdgeCount ).toBe( 4 );

	} );

	it( 'should preserve partially unmatched disjoint edge fragments.', () => {

		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new Float32BufferAttribute( [
			0, 0, 0,
			2, 0, 0,
			0, 1, 0,
			1, 0, 0,
			0, 0, 0,
			1, - 1, 0,
		], 3 ) );

		const diagnostic = getGeometryDiagnostic( geometry );
		const openFragment = diagnostic.openEdges.find( edge => edge.triangleIndex === 0 && edge.edgeIndex === 0 );

		expect( diagnostic.openEdgeCount ).toBe( 5 );
		expect( openFragment.line.start.x ).toBe( 1 );
		expect( openFragment.line.end.x ).toBe( 2 );

	} );

} );
