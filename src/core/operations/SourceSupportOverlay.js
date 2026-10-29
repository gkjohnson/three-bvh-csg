import { Plane } from 'three';
import { sharedSourceSupport, sourceTriangle } from './SourceFaceProvenance.js';
import { halfFloat32Ulp } from './CutPointRegistry.js';

// A local construction chart, never a proximity-based plane match. The finite
// triangles still have to be clipped; shared support alone proves no coverage.
// No mesh vertex is modified here. Keep corner order/edge identities unchanged.
export function sourceSupportOverlay( triangleA, triangleB, faceA, matrixA, faceB, matrixB ) {

	if ( ! sharedSourceSupport( faceA, matrixA, faceB, matrixB ) ) return null;
	const plane = sourceTriangle( faceA ).getPlane( new Plane() );
	if ( plane.normal.lengthSq() === 0 ) return null;
	const triangles = [ triangleA.clone(), triangleB.clone() ];
	let maxHalfUlpRatio = 0, maxProjectionDistance = 0;
	for ( const [ i, triangle ] of triangles.entries() ) {

		const original = i === 0 ? triangleA : triangleB;
		for ( const key of [ 'a', 'b', 'c' ] ) {

			const p = original[ key ], q = triangle[ key ];
			plane.projectPoint( p, q );
			for ( let k = 0; k < 3; k ++ ) {

				const delta = Math.abs( q.getComponent( k ) - p.getComponent( k ) );
				const budget = halfFloat32Ulp( p.getComponent( k ) );
				if ( ! Number.isFinite( delta ) || delta > budget ) return null;
				maxHalfUlpRatio = Math.max( maxHalfUlpRatio, delta / budget );

			}

			maxProjectionDistance = Math.max( maxProjectionDistance, p.distanceTo( q ) );

		}

		// A collapsed construction chart cannot justify a surface decision.
		if ( ! Number.isFinite( triangle.getArea() ) || triangle.getArea() === 0 ) return null;
		triangle.needsUpdate = true;

	}

	return { a: triangles[ 0 ], b: triangles[ 1 ], plane, maxHalfUlpRatio, maxProjectionDistance };

}
