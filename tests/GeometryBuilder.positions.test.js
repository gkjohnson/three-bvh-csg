import { BoxGeometry, BufferAttribute, BufferGeometry, Matrix3, Matrix4, Vector3 } from 'three';
import { Brush, Evaluator, SUBTRACTION } from '../src/index.js';
import { GeometryBuilder } from '../src/core/operations/GeometryBuilder.js';

function builderFixture() {

	const geometry = new BufferGeometry();
	geometry.setAttribute( 'position', new BufferAttribute( Float32Array.of( 0, 0, 0, 2, 0, 0, 0, 2, 0 ), 3 ) );
	geometry.setAttribute( 'normal', new BufferAttribute( Float32Array.of( 0, 0, 1, 0, 0, 1, 0, 0, 1 ), 3 ) );
	geometry.setAttribute( 'uv', new BufferAttribute( Float32Array.of( 0, 0, 1, 0, 0, 1 ), 2 ) );
	const builder = new GeometryBuilder();
	builder.initFromGeometry( geometry, [ 'position', 'normal', 'uv' ] );
	builder.initInterpolatedAttributeData( geometry, new Matrix4(), new Matrix3(), 0, 1, 2 );
	return builder;

}

const values = data => Array.from( data.array.slice( 0, data.length ) );

describe( 'GeometryBuilder explicit split positions', () => {

	it( 'uses the supplied output position but still interpolates UVs and inverts normals', () => {

		const builder = builderFixture(), position = new Vector3( 0.25, 0.5, 0 );
		const barycoord = new Vector3( 0.25, 0.25, 0.5 );
		builder.appendInterpolatedAttributeData( 0, barycoord, null, true, position );
		expect( values( builder.attributeData.position ) ).toEqual( position.toArray() );
		expect( values( builder.attributeData.uv ) ).toEqual( [ 0.25, 0.5 ] );
		expect( values( builder.attributeData.normal ).map( c => c || 0 ) ).toEqual( [ 0, 0, - 1 ] );
		expect( position.toArray() ).toEqual( [ 0.25, 0.5, 0 ] );
		expect( barycoord.toArray() ).toEqual( [ 0.25, 0.25, 0.5 ] );

	} );

	it( 'retains barycentric positions when no explicit position is supplied', () => {

		const builder = builderFixture();
		builder.appendInterpolatedAttributeData( 0, new Vector3( 0.25, 0.25, 0.5 ) );
		expect( values( builder.attributeData.position ) ).toEqual( [ 0.5, 1, 0 ] );
		expect( values( builder.attributeData.uv ) ).toEqual( [ 0.25, 0.5 ] );

	} );

	it( 'preserves existing index reuse and separate inverted attribute entries', () => {

		const builder = builderFixture(), barycoord = new Vector3( 0.25, 0.25, 0.5 );
		builder.appendInterpolatedAttributeData( 0, barycoord, 7, false, new Vector3( 0.25, 0.5, 0 ) );
		builder.appendInterpolatedAttributeData( 0, barycoord, 7, false, new Vector3( 9, 9, 9 ) );
		builder.appendInterpolatedAttributeData( 0, barycoord, 7, true, new Vector3( 0.25, 0.5, 0 ) );
		expect( values( builder.groupIndices[ 0 ] ) ).toEqual( [ 0, 0, 1 ] );
		expect( values( builder.attributeData.position ) ).toEqual( [ 0.25, 0.5, 0, 0.25, 0.5, 0 ] );
		expect( values( builder.attributeData.normal ).map( c => c || 0 ) ).toEqual( [ 0, 0, 1, 0, 0, - 1 ] );

	} );

	for ( const cdt of [ false, true ] ) for ( const reflected of [ false, true ] ) {

		it( `passes split positions only on the CDT path, including output-frame transforms: ${ cdt } / ${ reflected }`, () => {

			const evaluator = new Evaluator();
			evaluator.useCDTClipping = cdt;
			const a = new Brush( new BoxGeometry( 2, 2, 2 ) ), b = new Brush( new BoxGeometry() );
			a.position.set( 4, 5, - 2 ); a.rotation.set( 0.2, - 0.1, 0.3 ); a.scale.set( 2, 1, 0.5 );
			b.position.set( 4.5, 5.2, - 1.9 ); b.rotation.set( - 0.1, 0.2, - 0.3 ); b.scale.set( reflected ? - 1 : 1, 0.8, 1.2 );
			a.updateMatrixWorld( true ); b.updateMatrixWorld( true );
			const original = GeometryBuilder.prototype.appendInterpolatedAttributeData;
			let calls = 0, result;
			const emittedPositions = [], expectedPositions = [];
			const spy = vi.spyOn( GeometryBuilder.prototype, 'appendInterpolatedAttributeData' ).mockImplementation( function ( ...args ) {

				const supplied = args[ 4 ];
				const position = supplied ? supplied.toArray() : null; // Copy pooled vectors synchronously.
				expect( position !== null ).toBe( cdt );
				const start = this.attributeData.position.length;
				const value = original.apply( this, args );
				if ( position && this.attributeData.position.length > start ) {

					emittedPositions.push( Array.from( this.attributeData.position.array.slice( start, start + 3 ) ) );
					expectedPositions.push( position.map( Math.fround ) );

				}

				calls ++;
				return value;

			} );
			try {

				result = evaluator.evaluate( a, b, SUBTRACTION );
				expect( calls ).toBeGreaterThan( 0 );
				expect( emittedPositions.length > 0 ).toBe( cdt );
				expect( emittedPositions ).toEqual( expectedPositions );
				expect( result.matrixWorld.elements ).toEqual( a.matrixWorld.elements );

			} finally {

				spy.mockRestore();
				for ( const brush of [ a, b, result ] ) if ( brush ) {

					brush.disposeCacheData(); brush.geometry.dispose();

				}

				evaluator.reset();

			}

		} );

	}

} );
