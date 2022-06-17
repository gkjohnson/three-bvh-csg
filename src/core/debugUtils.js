import { BufferAttribute, Color, MathUtils } from 'three';

export function getTriangleDefinitions( ...triangles ) {

	function getVectorDefinition( v ) {

		return /* js */`new THREE.Vector3( ${ v.x }, ${ v.y }, ${ v.z } )`;

	}

	return triangles.map( t => {

		return /* js */`
			new THREE.Triangle(
				${ getVectorDefinition( t.a ) },
				${ getVectorDefinition( t.b ) },
				${ getVectorDefinition( t.c ) },
			)`.substring( 1 );

	} );

}

export function logTriangleDefinitions( ...triangles ) {

	console.log( getTriangleDefinitions( ...triangles ).join( ',\n' ) );

}

export function generateRandomTriangleColors( geometry ) {

	const position = geometry.attributes.position;
	const array = new Float32Array( position.count * 3 );

	const color = new Color();
	for ( let i = 0, l = array.length; i < l; i += 3 ) {

		color.setHSL(
			Math.random(),
			MathUtils.lerp( 0.25, 0.75, Math.random() ),
			MathUtils.lerp( 0.25, 0.75, Math.random() ),
		);

		array[ i + 0 ] = color.r;
		array[ i + 1 ] = color.g;
		array[ i + 2 ] = color.b;

	}

	geometry.setAttribute( 'color', new BufferAttribute( array, 3 ) );

}
