import { Vector3 } from 'three';

const EPSILON = 1e-14;
const _AB = new Vector3();
const _AC = new Vector3();
const _CB = new Vector3();

export function isTriDegenerate( tri, eps = EPSILON ) {

	// compute angles to determine whether they're degenerate
	_AB.subVectors( tri.b, tri.a );
	_AC.subVectors( tri.c, tri.a );
	_CB.subVectors( tri.c, tri.b );

	const angle1 = _AB.angleTo( _AC );				// AB v AC
	const angle2 = _AB.angleTo( _CB ) - Math.PI;	// AB v BC - 180deg
	const angle3 = Math.PI - angle1 - angle2;		// 180deg - angle1 - angle2

	return Math.abs( angle1 ) < eps ||
		Math.abs( angle2 ) < eps ||
		Math.abs( angle3 ) < eps ||
		tri.a.distanceToSquared( tri.b ) < eps ||
		tri.a.distanceToSquared( tri.c ) < eps ||
		tri.b.distanceToSquared( tri.c ) < eps;

}
