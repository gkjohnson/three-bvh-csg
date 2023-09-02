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
)
		`.trim();

	} );

}

export function logTriangleDefinitions( ...triangles ) {

	console.log( getTriangleDefinitions( ...triangles ).join( ',\n' ) );

}

export function generateRandomTriangleColors( geometry ) {

	const position = geometry.attributes.position;
	const array = new Float32Array( position.count * 3 );

	const color = new Color();
	for ( let i = 0, l = array.length; i < l; i += 9 ) {

		color.setHSL(
			Math.random(),
			MathUtils.lerp( 0.5, 1.0, Math.random() ),
			MathUtils.lerp( 0.5, 0.75, Math.random() ),
		);

		array[ i + 0 ] = color.r;
		array[ i + 1 ] = color.g;
		array[ i + 2 ] = color.b;

		array[ i + 3 ] = color.r;
		array[ i + 4 ] = color.g;
		array[ i + 5 ] = color.b;

		array[ i + 6 ] = color.r;
		array[ i + 7 ] = color.g;
		array[ i + 8 ] = color.b;

	}

	geometry.setAttribute( 'color', new BufferAttribute( array, 3 ) );

}
