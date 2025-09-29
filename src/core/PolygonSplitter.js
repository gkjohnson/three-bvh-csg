import { Triangle, Line3, Vector3, Plane } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { isTriDegenerate } from './utils/triangleUtils.js';

// NOTE: these epsilons likely should all be the same since they're used to measure the
// distance from a point to a plane which needs to be done consistently
const EPSILON = 1e-10;
const COPLANAR_EPSILON = 1e-10;
const PARALLEL_EPSILON = 1e-10;

const _edge = new Line3();
const _foundEdge = new Line3();
const _vec = new Vector3();
const _triangleNormal = new Vector3();
const _planeNormal = new Vector3();
const _plane = new Plane();
const _splittingTriangle = new ExtendedTriangle();

// A pool of triangles to avoid unnecessary triangle creation
class TrianglePool {

	constructor() {

		this._pool = [];
		this._index = 0;

	}

	getTriangle() {

		if ( this._index >= this._pool.length ) {

			this._pool.push( new Triangle() );

		}

		return this._pool[ this._index ++ ];

	}

	clear() {

		this._index = 0;

	}

	reset() {

		this._pool.length = 0;
		this._index = 0;

	}

}

// Structure to represent a polygon edge
class PolygonEdge {

	constructor( start, end ) {

		this.start = start.clone();
		this.end = end.clone();
		this.used = false;

	}

}

// Structure to represent a polygon from connected edges
class Polygon {

	constructor( points ) {

		this.points = points; // Array of Vector3 points
		this.triangles = []; // Will be populated after triangulation

	}

	// Proper ear clipping triangulation algorithm
	triangulateEarClipping() {

		if ( this.points.length < 3 ) {

			return;

		}

		// For 3 points, just create one triangle
		if ( this.points.length === 3 ) {

			const tri = new Triangle( this.points[ 0 ], this.points[ 1 ], this.points[ 2 ] );
			if ( ! isTriDegenerate( tri ) ) {

				this.triangles.push( tri );

			}

			return;

		}

		// Calculate polygon normal for projection
		const normal = new Vector3();
		this.computeNormal( normal );

		// Project to 2D by choosing the best axis
		const absNormal = new Vector3( Math.abs( normal.x ), Math.abs( normal.y ), Math.abs( normal.z ) );
		let getU, getV;

		if ( absNormal.x >= absNormal.y && absNormal.x >= absNormal.z ) {

			// Project to YZ plane
			getU = ( p ) => p.y;
			getV = ( p ) => p.z;

		} else if ( absNormal.y >= absNormal.z ) {

			// Project to XZ plane
			getU = ( p ) => p.x;
			getV = ( p ) => p.z;

		} else {

			// Project to XY plane
			getU = ( p ) => p.x;
			getV = ( p ) => p.y;

		}

		// Create vertex indices list
		const indices = [];
		for ( let i = 0; i < this.points.length; i ++ ) {

			indices.push( i );

		}

		// Check if polygon is clockwise or counter-clockwise
		let area = 0;
		for ( let i = 0; i < indices.length; i ++ ) {

			const j = ( i + 1 ) % indices.length;
			const pi = this.points[ indices[ i ] ];
			const pj = this.points[ indices[ j ] ];
			area += getU( pi ) * getV( pj ) - getU( pj ) * getV( pi );

		}

		const isClockwise = area < 0;

		// Ear clipping main loop
		while ( indices.length > 3 ) {

			let earFound = false;

			for ( let i = 0; i < indices.length; i ++ ) {

				const prev = indices[ ( i - 1 + indices.length ) % indices.length ];
				const curr = indices[ i ];
				const next = indices[ ( i + 1 ) % indices.length ];

				const p1 = this.points[ prev ];
				const p2 = this.points[ curr ];
				const p3 = this.points[ next ];

				// Check if this is a valid ear
				if ( this.isEar( prev, curr, next, indices, getU, getV, isClockwise ) ) {

					// Create triangle
					const tri = new Triangle( p1, p2, p3 );
					if ( ! isTriDegenerate( tri ) ) {

						this.triangles.push( tri );

					}

					// Remove the ear vertex
					indices.splice( i, 1 );
					earFound = true;
					break;

				}

			}

			// Safety check to prevent infinite loop
			if ( ! earFound ) {

				// Fallback to simple triangulation (silently for now)
				this.triangulateSimple();
				return;

			}

		}

		// Add the final triangle
		if ( indices.length === 3 ) {

			const tri = new Triangle(
				this.points[ indices[ 0 ] ],
				this.points[ indices[ 1 ] ],
				this.points[ indices[ 2 ] ]
			);
			if ( ! isTriDegenerate( tri ) ) {

				this.triangles.push( tri );

			}

		}

	}

	// Check if a vertex forms a valid ear
	isEar( prevIdx, currIdx, nextIdx, indices, getU, getV, isClockwise ) {

		const p1 = this.points[ prevIdx ];
		const p2 = this.points[ currIdx ];
		const p3 = this.points[ nextIdx ];

		// Check if the angle is convex
		const u1 = getU( p1 ), v1 = getV( p1 );
		const u2 = getU( p2 ), v2 = getV( p2 );
		const u3 = getU( p3 ), v3 = getV( p3 );

		const cross = ( u2 - u1 ) * ( v3 - v1 ) - ( v2 - v1 ) * ( u3 - u1 );
		const isConvex = isClockwise ? cross < 0 : cross > 0;

		if ( ! isConvex ) {

			return false;

		}

		// Check if any other vertex is inside this triangle
		for ( const idx of indices ) {

			if ( idx === prevIdx || idx === currIdx || idx === nextIdx ) {

				continue;

			}

			const p = this.points[ idx ];
			const u = getU( p ), v = getV( p );

			if ( this.isPointInTriangle2D( u, v, u1, v1, u2, v2, u3, v3 ) ) {

				return false;

			}

		}

		return true;

	}

	// Check if a 2D point is inside a 2D triangle
	isPointInTriangle2D( px, py, x1, y1, x2, y2, x3, y3 ) {

		const denom = ( y2 - y3 ) * ( x1 - x3 ) + ( x3 - x2 ) * ( y1 - y3 );
		if ( Math.abs( denom ) < 1e-10 ) return false;

		const a = ( ( y2 - y3 ) * ( px - x3 ) + ( x3 - x2 ) * ( py - y3 ) ) / denom;
		const b = ( ( y3 - y1 ) * ( px - x3 ) + ( x1 - x3 ) * ( py - y3 ) ) / denom;
		const c = 1 - a - b;

		return a >= 0 && b >= 0 && c >= 0;

	}

	// Simple triangulation using ear clipping algorithm
	triangulateSimple() {

		if ( this.points.length < 3 ) {

			return;

		}

		// For 3 points, just create one triangle
		if ( this.points.length === 3 ) {

			const tri = new Triangle( this.points[ 0 ], this.points[ 1 ], this.points[ 2 ] );
			if ( ! isTriDegenerate( tri ) ) {

				this.triangles.push( tri );

			}

			return;

		}

		// Simple fan triangulation (works for convex polygons)
		// For more complex polygons, we'd need proper ear clipping
		const center = this.points[ 0 ];
		for ( let i = 1; i < this.points.length - 1; i ++ ) {

			const tri = new Triangle( center, this.points[ i ], this.points[ i + 1 ] );
			if ( ! isTriDegenerate( tri ) ) {

				this.triangles.push( tri );

			}

		}

	}

	// Triangulate the polygon using ear clipping
	triangulate() {

		// Clear existing triangles
		this.triangles.length = 0;

		// Use ear clipping triangulation
		this.triangulateEarClipping();

	}

	// Compute the normal of the polygon
	computeNormal( target ) {

		target.set( 0, 0, 0 );

		if ( this.points.length < 3 ) {

			return target;

		}

		// Use Newell's method for polygon normal calculation
		for ( let i = 0; i < this.points.length; i ++ ) {

			const current = this.points[ i ];
			const next = this.points[ ( i + 1 ) % this.points.length ];

			target.x += ( current.y - next.y ) * ( current.z + next.z );
			target.y += ( current.z - next.z ) * ( current.x + next.x );
			target.z += ( current.x - next.x ) * ( current.y + next.y );

		}

		return target.normalize();

	}

}

// Enhanced TriangleSplitter that creates symmetrical clipping along connected edges
export class PolygonSplitter {

	constructor() {

		this.trianglePool = new TrianglePool();
		this.triangles = [];
		this.normal = new Vector3();
		this.coplanarTriangleUsed = false;
		this.polygons = []; // Store generated polygons instead of individual triangles
		this.edges = []; // Store all intersection edges for polygon construction

	}

	// initialize the class with a triangle
	initialize( tri ) {

		this.reset();

		const { normal } = this;
		if ( Array.isArray( tri ) ) {

			for ( let i = 0, l = tri.length; i < l; i ++ ) {

				const t = tri[ i ];
				if ( i === 0 ) {

					t.getNormal( normal );

				} else if ( Math.abs( 1.0 - t.getNormal( _vec ).dot( normal ) ) > EPSILON ) {

					throw new Error( 'PolygonSplitter: Cannot initialize with triangles that have different normals.' );

				}

			}

			// For polygon approach, we start with the outer boundary of all triangles
			this.constructInitialPolygonFromTriangles( tri );

		} else {

			tri.getNormal( normal );

			// Create initial polygon from single triangle
			const polygon = new Polygon( [ tri.a.clone(), tri.b.clone(), tri.c.clone() ] );
			this.polygons.push( polygon );

		}

	}

	// Construct a polygon boundary from an array of triangles
	constructInitialPolygonFromTriangles( triangles ) {

		// This is a simplified approach - in a full implementation you'd want to
		// construct the actual boundary polygon, but for now we'll just use individual triangles
		for ( const tri of triangles ) {

			const polygon = new Polygon( [ tri.a.clone(), tri.b.clone(), tri.c.clone() ] );
			this.polygons.push( polygon );

		}

	}

	// Split the current set of polygons by passing a single triangle in
	splitByTriangle( triangle ) {

		const { normal } = this;
		triangle.getNormal( _triangleNormal ).normalize();

		if ( Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON ) {

			this.coplanarTriangleUsed = true;

			// If the triangle is coplanar then split by the edge planes
			const arr = [ triangle.a, triangle.b, triangle.c ];
			for ( let i = 0; i < 3; i ++ ) {

				const nexti = ( i + 1 ) % 3;

				const v0 = arr[ i ];
				const v1 = arr[ nexti ];

				// plane positive direction is toward triangle center
				_vec.subVectors( v1, v0 ).normalize();
				_planeNormal.crossVectors( _triangleNormal, _vec );
				_plane.setFromNormalAndCoplanarPoint( _planeNormal, v0 );

				this.splitByPlane( _plane, triangle );

			}

		} else {

			// Otherwise split by the triangle plane
			triangle.getPlane( _plane );
			this.splitByPlane( _plane, triangle );

		}

		// Update triangles array after splitting
		this.updateTrianglesFromPolygons();

	}

	// Split polygons by the given plane
	splitByPlane( plane, clippingTriangle ) {

		// Init our triangle to check for intersection
		_splittingTriangle.copy( clippingTriangle );
		_splittingTriangle.needsUpdate = true;

		const newPolygons = [];
		const splitEdges = [];

		// Process each polygon
		for ( const polygon of this.polygons ) {

			const result = this.splitPolygonByPlane( polygon, plane, _splittingTriangle );
			newPolygons.push( ...result.polygons );
			splitEdges.push( ...result.edges );

		}

		this.polygons = newPolygons;
		this.edges.push( ...splitEdges );

	}

	// Split a single polygon by a plane - improved version
	splitPolygonByPlane( polygon, plane, splittingTriangle ) {

		const { points } = polygon;
		const resultPolygons = [];
		const splitEdges = [];

		if ( points.length < 3 ) {

			return { polygons: resultPolygons, edges: splitEdges };

		}

		// Classify each vertex relative to the plane
		const classifications = [];
		const distances = [];

		for ( const point of points ) {

			const dist = plane.distanceToPoint( point );
			distances.push( dist );

			if ( Math.abs( dist ) < COPLANAR_EPSILON ) {

				classifications.push( 0 ); // on plane

			} else if ( dist > 0 ) {

				classifications.push( 1 ); // positive side

			} else {

				classifications.push( - 1 ); // negative side

			}

		}

		// Check if we need to split
		const hasPositive = classifications.some( c => c > 0 );
		const hasNegative = classifications.some( c => c < 0 );

		if ( ! hasPositive || ! hasNegative ) {

			// No split needed, polygon is entirely on one side
			resultPolygons.push( polygon );
			return { polygons: resultPolygons, edges: splitEdges };

		}

		// Find intersection points and build new polygons
		const intersectionPoints = [];
		const positivePoints = [];
		const negativePoints = [];

		for ( let i = 0; i < points.length; i ++ ) {

			const current = points[ i ];
			const next = points[ ( i + 1 ) % points.length ];
			const currentClass = classifications[ i ];
			const nextClass = classifications[ ( i + 1 ) % points.length ];

			// Add current point to appropriate polygons
			if ( currentClass >= 0 ) {

				positivePoints.push( current.clone() );

			}

			if ( currentClass <= 0 ) {

				negativePoints.push( current.clone() );

			}

			// Check for edge-plane intersection
			if ( currentClass !== nextClass && currentClass !== 0 && nextClass !== 0 ) {

				// Edge crosses the plane
				_edge.start.copy( current );
				_edge.end.copy( next );

				const intersection = new Vector3();
				if ( plane.intersectLine( _edge, intersection ) ) {

					intersectionPoints.push( intersection.clone() );
					positivePoints.push( intersection.clone() );
					negativePoints.push( intersection.clone() );

				}

			}

		}

		// Create new polygons if they have sufficient points
		if ( positivePoints.length >= 3 ) {

			resultPolygons.push( new Polygon( positivePoints ) );

		}

		if ( negativePoints.length >= 3 ) {

			resultPolygons.push( new Polygon( negativePoints ) );

		}

		// If no valid split was created, keep the original
		if ( resultPolygons.length === 0 ) {

			resultPolygons.push( polygon );

		}

		return { polygons: resultPolygons, edges: splitEdges };

	}

	// Update the triangles array from current polygons
	updateTrianglesFromPolygons() {

		// Clear existing triangles
		this.triangles.length = 0;

		// Triangulate all polygons and populate triangles array
		for ( const polygon of this.polygons ) {

			polygon.triangulate();

			// Copy triangles to our pool for compatibility
			for ( const tri of polygon.triangles ) {

				const poolTri = this.trianglePool.getTriangle();
				poolTri.copy( tri );
				this.triangles.push( poolTri );

			}

		}

	}

	// Get the final triangulated result (for backward compatibility)
	getTriangles() {

		this.updateTrianglesFromPolygons();
		return this.triangles;

	}

	reset() {

		this.triangles.length = 0;
		this.polygons.length = 0;
		this.edges.length = 0;
		this.trianglePool.clear();
		this.coplanarTriangleUsed = false;

	}

}
