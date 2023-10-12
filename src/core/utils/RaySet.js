const DIST_EPSILON = 1e-5;
const ANGLE_EPSILON = 1e-4;

export class RaySet {

	constructor() {

		this._rays = [];

	}

	addRay( ray ) {

		this._rays.push( ray );

	}

	findClosestRay( ray ) {

		const rays = this._rays;
		const inv = ray.clone();
		inv.direction.multiplyScalar( - 1 );

		let bestScore = Infinity;
		let bestRay = null;
		for ( let i = 0, l = rays.length; i < l; i ++ ) {

			const r = rays[ i ];
			if ( skipRay( r, ray ) && skipRay( r, inv ) ) {

				continue;

			}

			const rayScore = scoreRays( r, ray );
			const invScore = scoreRays( r, inv );
			const score = Math.min( rayScore, invScore );
			if ( score < bestScore ) {

				bestScore = score;
				bestRay = r;

			}

		}

		return bestRay;

		function skipRay( r0, r1 ) {

			const distOutOfThreshold = r0.origin.distanceTo( r1.origin ) > DIST_EPSILON;
			const angleOutOfThreshold = r0.direction.angleTo( r1.direction ) > ANGLE_EPSILON;
			return angleOutOfThreshold || distOutOfThreshold;

		}

		function scoreRays( r0, r1 ) {

			const originDistance = r0.origin.distanceTo( r1.origin );
			const angleDistance = r0.direction.angleTo( r1.direction );
			return originDistance / DIST_EPSILON + angleDistance / ANGLE_EPSILON;

		}

	}

}
