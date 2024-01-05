import { Vector3, Line3 } from 'three';

export function transformToFrame( tri, frame ) {

	tri.a.applyMatrix4( frame ).z = 0;
	tri.b.applyMatrix4( frame ).z = 0;
	tri.c.applyMatrix4( frame ).z = 0;
	return tri;

}

function isPositive( start, end, intersection ) { // all parameters are THREE.Vector3()

	let v1 = new Vector3().copy( end ).sub( start );
	let v2 = new Vector3().copy( intersection ).sub( start );
	return v1.dot( v2 ) >= 0;

}

// checks if two line segments will intersect on a point
// when traveling in one specific direction from start to end
// but not in the direction from end to start
// params (THREE.Line3, THREE.Line3)
export function getIntersectionOnAPoint( line1, line2 ) {

	let intersection = null;
	let A = line1.start;
	let B = line1.end;
	let C = line2.start;
	let D = line2.end;

	// Line AB represented as a1x + b1y = c1
	let a1 = B.y - A.y;
	let b1 = A.x - B.x;
	let c1 = a1 * ( A.x ) + b1 * ( A.y );

	// Line CD represented as a2x + b2y = c2
	let a2 = D.y - C.y;
	let b2 = C.x - D.x;
	let c2 = a2 * ( C.x ) + b2 * ( C.y );

	let determinant = a1 * b2 - a2 * b1;

	if ( determinant == 0 ) {

		// The lines are parallel.

	} else {

		let x = ( b2 * c1 - b1 * c2 ) / determinant;
		let y = ( a1 * c2 - a2 * c1 ) / determinant;
		intersection = new Vector3( x, y );

	}

	// ???
	// if there is an intersection. verify intersection occurs on the two line segments
	// when calculating from start to end
	if ( intersection ) {

		let line1result = isPositive( line1.start, line1.end, intersection );
		let line2result = isPositive( line2.start, line2.end, intersection );
		if ( line1result && line2result ) {

			// do nothing when the intersection is not "false" as both results are "true"

		} else {

			// set intersection to null when the intersection is "false" as one of results is "false"
			intersection = null;

		}

	}

	return intersection;

}


const _delta1 = new Vector3();
const _delta2 = new Vector3();
export function areEdgesParallel( l1, l2 ) {

	const EPS = 1e-10;
	l1.delta( _delta1 ).normalize();
	l2.delta( _delta2 ).normalize();
	return Math.abs( _delta1.dot( _delta2 ) ) > 1 - EPS;

}

// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
// https://paulbourke.net/geometry/pointlineplane/
export function lineIntersect( l1, l2, target ) {

	const x1 = l1.start.x;
	const y1 = l1.start.y;

	const x2 = l1.end.x;
	const y2 = l1.end.y;

	const x3 = l2.start.x;
	const y3 = l2.start.y;

	const x4 = l2.end.x;
	const y4 = l2.end.y;

	const EPS = 1e-10;
	let mua, mub;
	let denom, numera, numerb;

	denom = ( y4 - y3 ) * ( x2 - x1 ) - ( x4 - x3 ) * ( y2 - y1 );
	numera = ( x4 - x3 ) * ( y1 - y3 ) - ( y4 - y3 ) * ( x1 - x3 );
	numerb = ( x2 - x1 ) * ( y1 - y3 ) - ( y2 - y1 ) * ( x1 - x3 );

	/* Are the line coincident? */
	if ( Math.abs( numera ) < EPS && Math.abs( numerb ) < EPS && Math.abs( denom ) < EPS ) {

		target.x = ( x1 + x2 ) / 2;
		target.y = ( y1 + y2 ) / 2;
		return true;

	}

	/* Are the line parallel */
	if ( Math.abs( denom ) < EPS ) {

		target.x = 0;
		target.y = 0;
		return false;

	}

	/* Is the intersection along the the segments */
	mua = numera / denom;
	mub = numerb / denom;
	if ( mua < 0 || mua > 1 || mub < 0 || mub > 1 ) {

		target.x = 0;
		target.y = 0;

		return false;

	}

	target.x = x1 + mua * ( x2 - x1 );
	target.y = y1 + mua * ( y2 - y1 );

	return true;

}

export function getTriangleLineIntersection( line, tri, target ) {

	let setCount = 0;
	const vec = new Vector3();
	const edge = new Line3();
	const arr = [ tri.a, tri.b, tri.c ];
	for ( let i = 0; i < 3; i ++ ) {

		const ni = ( i + 1 ) % 3;
		edge.start.copy( arr[ i ] );
		edge.end.copy( arr[ ni ] );

		if ( areEdgesParallel( edge, line ) ) {

			// let sp = edge.closestPointToPointParameter( line.start, false );
			// let ep = edge.closestPointToPointParameter( line.end, false );
			// if ( ! (
			// 	sp < 0 && ep < 0 ||
			// 	sp > 1 && ep > 1
			// ) ) {

			// 	sp = MathUtils.clamp( sp, 0, 1 );
			// 	ep = MathUtils.clamp( ep, 0, 1 );

			// 	edge.at( sp, target.start );
			// 	edge.at( ep, target.end );

			// 	return true;

			// }

		} else if ( lineIntersect( edge, line, vec ) ) {

			if ( setCount === 2 ) {

				// TODO
				console.error( 'This shouldn\'t happen' );

			} else if ( setCount === 1 ) {

				target.start.copy( vec );

			} else {

				target.end.copy( vec );

			}

			setCount ++;

		}

	}

	if ( setCount === 0 || setCount === 1 ) {

		const cs = tri.containsPoint( line.start );
		const ce = tri.containsPoint( line.end );
		if ( setCount === 0 ) {

			if ( cs && ce ) {

				target.copy( line );
				setCount += 2;

			} else {

				console.error('UH OH');

			}

		}

		if ( setCount === 1 ) {

			if ( cs && ce ) {

				if ( line.start.distanceTo( target.end ) > line.end.distanceTo( target.end ) ) {

					target.start.copy( line.start );

				} else {

					target.start.copy( line.end );

				}

			} else if ( cs ) {

				target.start.copy( line.start );
				setCount ++;

			} else if ( ce ) {

				target.start.copy( line.end );
				setCount ++;

			}

		}

	}

	return setCount === 2;

}
