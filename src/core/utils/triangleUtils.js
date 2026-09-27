import { Vector3 } from 'three';

const EPSILON = 1e-14;
const _AB = new Vector3();
const _AC = new Vector3();
const _CB = new Vector3();

export function isTriDegenerate( tri, eps = EPSILON ) {

	// compute angles to determine whether they're degenerate
	_AB.subVectors( tri.b, tri.a );
	_AC.subVectors( tri.c, tri.a );
	_CB.subVectors( tri.b, tri.c );

	const angle1 = _AB.angleTo( _AC );				// AB v AC
	const angle2 = _AB.angleTo( _CB );				// AB v BC
	const angle3 = Math.PI - angle1 - angle2;		// 180deg - angle1 - angle2

	// compare the squared edge lengths relative to the longest edge
	const ab = _AB.lengthSq();
	const ac = _AC.lengthSq();
	const cb = _CB.lengthSq();
	const edgeEpsilon = eps * Math.max( ab, ac, cb );

	return Math.abs( angle1 ) < eps ||
		Math.abs( angle2 ) < eps ||
		Math.abs( angle3 ) < eps ||
		ab < edgeEpsilon ||
		ac < edgeEpsilon ||
		cb < edgeEpsilon;

}
