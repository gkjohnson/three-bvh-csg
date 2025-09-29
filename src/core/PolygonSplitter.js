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

	// Triangulate the polygon using a basic approach
	triangulate() {

		// Clear existing triangles
		this.triangles.length = 0;

		// Use simple triangulation for now
		this.triangulateSimple();

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

	// Split a single polygon by a plane
	splitPolygonByPlane( polygon, plane, splittingTriangle ) {

		const { points } = polygon;
		const resultPolygons = [];
		const splitEdges = [];

		// Check if any point of the polygon intersects with the splitting triangle
		let hasIntersection = false;
		for ( let i = 0; i < points.length && ! hasIntersection; i ++ ) {

			const currentPoint = points[ i ];
			const nextPoint = points[ ( i + 1 ) % points.length ];

			_edge.start.copy( currentPoint );
			_edge.end.copy( nextPoint );

			// Simple triangle intersection test
			hasIntersection = splittingTriangle.intersectsTriangle( new Triangle( currentPoint, nextPoint, currentPoint ), _foundEdge, true );

		}

		if ( ! hasIntersection ) {

			// No intersection, keep the polygon as is
			resultPolygons.push( polygon );
			return { polygons: resultPolygons, edges: splitEdges };

		}

		// Classify points and find intersection points
		const classifications = []; // -1: negative side, 0: on plane, 1: positive side
		const intersectionPoints = [];

		for ( let i = 0; i < points.length; i ++ ) {

			const currentPoint = points[ i ];
			const nextPoint = points[ ( i + 1 ) % points.length ];
			const dist = plane.distanceToPoint( currentPoint );

			if ( Math.abs( dist ) < COPLANAR_EPSILON ) {

				classifications.push( 0 );

			} else if ( dist > 0 ) {

				classifications.push( 1 );

			} else {

				classifications.push( - 1 );

			}

			// Check for intersection with the edge to the next point
			_edge.start.copy( currentPoint );
			_edge.end.copy( nextPoint );

			if ( plane.intersectLine( _edge, _vec ) ) {

				const distToStart = _vec.distanceTo( _edge.start );
				const distToEnd = _vec.distanceTo( _edge.end );

				// Only add if it's a real intersection (not at endpoints)
				if ( distToStart > EPSILON && distToEnd > EPSILON ) {

					intersectionPoints.push( { point: _vec.clone(), edgeIndex: i } );

				}

			}

		}

		// If we have intersections, split the polygon
		if ( intersectionPoints.length >= 2 ) {

			// Create polygons from the split
			const posPolygonPoints = [];
			const negPolygonPoints = [];

			for ( let i = 0; i < points.length; i ++ ) {

				const classification = classifications[ i ];
				const point = points[ i ];

				if ( classification >= 0 ) {

					posPolygonPoints.push( point.clone() );

				}

				if ( classification <= 0 ) {

					negPolygonPoints.push( point.clone() );

				}

				// Add intersection points
				const intersection = intersectionPoints.find( ip => ip.edgeIndex === i );
				if ( intersection ) {

					posPolygonPoints.push( intersection.point.clone() );
					negPolygonPoints.push( intersection.point.clone() );
					splitEdges.push( new PolygonEdge( intersection.point, intersection.point ) );

				}

			}

			// Create new polygons if they have enough points
			if ( posPolygonPoints.length >= 3 ) {

				resultPolygons.push( new Polygon( posPolygonPoints ) );

			}

			if ( negPolygonPoints.length >= 3 ) {

				resultPolygons.push( new Polygon( negPolygonPoints ) );

			}

		} else {

			// No valid split, keep original polygon
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
