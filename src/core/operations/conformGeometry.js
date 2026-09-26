import { BufferAttribute } from 'three';

// Post-process that turns the per-triangle CSG output into a watertight,
// edge-conforming mesh:
//   1. weld vertices by quantized position (scale-relative tolerance)
//   2. drop degenerate (near-zero-area) and duplicate triangles
//   3. conform: split any boundary edge that has another vertex lying on its
//      interior (a T-junction left by a neighboring split triangle)
//
// Applied per Evaluator.evaluate() so cracks never accumulate across iterated
// booleans. Welds by position only (seam vertices share a position but may have
// had distinct normals) — intended for the CDT/consolidateVertices path.

const _EPS_PARAM = 1e-4;

function area2( ax, ay, az, bx, by, bz, cx, cy, cz ) {

	const ux = bx - ax, uy = by - ay, uz = bz - az;
	const vx = cx - ax, vy = cy - ay, vz = cz - az;
	const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	return nx * nx + ny * ny + nz * nz; // (2*area)^2

}

// integer spatial hash of a cell coordinate (no per-lookup string allocation)
function cellHash( a, b, c ) {

	return ( ( a * 73856093 ) ^ ( b * 19349663 ) ^ ( c * 83492791 ) ) | 0;

}

// weld vertices of `geometry` by TRUE-DISTANCE position (not cell membership). A grid of
// cell size = weldTol buckets welded points; each query searches its own cell plus the 26
// neighbours for any welded point within weldTol, so two points a hair apart that straddle
// a cell boundary still merge (a plain quantize-weld misses these, leaving near-degenerate
// sliver swarms at sub-tol cross-op split vertices). Own-cell-first keeps the common case
// at one bucket lookup.
function weldPositions( geometry, weldTol ) {

	const posAttr = geometry.attributes.position;
	const inv = 1 / weldTol;
	const tol2 = weldTol * weldTol;
	const cellMap = new Map(); // hash -> array of welded indices whose cell is this
	const remap = new Int32Array( posAttr.count );
	const px = [], py = [], pz = [], srcOf = [];
	for ( let i = 0; i < posAttr.count; i ++ ) {

		const x = posAttr.getX( i ), y = posAttr.getY( i ), z = posAttr.getZ( i );
		const qx = Math.round( x * inv ), qy = Math.round( y * inv ), qz = Math.round( z * inv );
		let w = - 1;

		// own cell first, then the 26 neighbours; accept the first welded point within tol
		for ( let dz = 0; dz <= 2 && w === - 1; dz ++ ) {

			const oz = dz === 0 ? 0 : ( dz === 1 ? - 1 : 1 );
			for ( let dy = 0; dy <= 2 && w === - 1; dy ++ ) {

				const oy = dy === 0 ? 0 : ( dy === 1 ? - 1 : 1 );
				for ( let dx = 0; dx <= 2 && w === - 1; dx ++ ) {

					const ox = dx === 0 ? 0 : ( dx === 1 ? - 1 : 1 );
					const arr = cellMap.get( cellHash( qx + ox, qy + oy, qz + oz ) );
					if ( ! arr ) continue;
					for ( let j = 0; j < arr.length; j ++ ) {

						const c = arr[ j ];
						const ddx = px[ c ] - x, ddy = py[ c ] - y, ddz = pz[ c ] - z;
						if ( ddx * ddx + ddy * ddy + ddz * ddz <= tol2 ) { w = c; break; }

					}

				}

			}

		}

		if ( w === - 1 ) {

			w = px.length;
			px.push( x ); py.push( y ); pz.push( z ); srcOf.push( i );
			const h = cellHash( qx, qy, qz );
			let arr = cellMap.get( h );
			if ( ! arr ) cellMap.set( h, arr = [] );
			arr.push( w );

		}

		remap[ i ] = w;

	}

	return { px, py, pz, srcOf, remap };

}

// build a deduplicated, non-degenerate triangle list from welded indices
function buildTriangles( index, remap, triCount, getIdx, px, py, pz, areaEps ) {

	const tris = [];
	const N = px.length;
	const faceSet = new Set();
	for ( let t = 0; t < triCount; t ++ ) {

		const a = remap[ getIdx( 3 * t ) ];
		const b = remap[ getIdx( 3 * t + 1 ) ];
		const c = remap[ getIdx( 3 * t + 2 ) ];
		if ( a === b || b === c || a === c ) continue;

		// order-independent numeric face key (N = vertex count, collision-free)
		let lo = a, mid = b, hi = c;
		if ( lo > mid ) { const t0 = lo; lo = mid; mid = t0; }
		if ( mid > hi ) { const t0 = mid; mid = hi; hi = t0; }
		if ( lo > mid ) { const t0 = lo; lo = mid; mid = t0; }
		const fkey = ( lo * N + mid ) * N + hi;
		if ( faceSet.has( fkey ) ) continue;
		if ( area2( px[ a ], py[ a ], pz[ a ], px[ b ], py[ b ], pz[ b ], px[ c ], py[ c ], pz[ c ] ) < areaEps ) continue;
		faceSet.add( fkey );
		tris.push( a, b, c );

	}

	return tris;

}

// Close split-vertex seam tears: iterated booleans produce two representatives of the
// same intersection point a hair apart (~2-5e-4) when a new cut's curve lands near an
// existing workpiece vertex — beyond the weld tolerance, so they stay distinct and leave
// a tear. Distance alone can't tell these from legitimately-close surface vertices, BUT
// tear vertices sit on OPEN (boundary) edges and a watertight region has none — so we only
// merge BOUNDARY vertices, and only when the merge stays manifold (no edge gains a 3rd
// face) and actually reduces the open-edge count. Surgical and self-guarding.
function boundaryWeld( tris, px, py, pz, tol ) {

	const N = px.length;
	const ekey = ( u, v ) => u < v ? u * N + v : v * N + u;
	const tol2 = tol * tol;

	const edgeCounts = ( T ) => {

		const ec = new Map();
		for ( let t = 0; t < T.length / 3; t ++ ) {

			const a = T[ 3 * t ], b = T[ 3 * t + 1 ], c = T[ 3 * t + 2 ];
			ec.set( ekey( a, b ), ( ec.get( ekey( a, b ) ) || 0 ) + 1 );
			ec.set( ekey( b, c ), ( ec.get( ekey( b, c ) ) || 0 ) + 1 );
			ec.set( ekey( c, a ), ( ec.get( ekey( c, a ) ) || 0 ) + 1 );

		}

		return ec;

	};

	let cur = tris;
	let ec = edgeCounts( cur );
	let openCount = 0; for ( const c of ec.values() ) if ( c === 1 ) openCount ++;
	if ( openCount === 0 ) return cur;

	const bset = new Set();
	for ( const [ k, c ] of ec ) if ( c === 1 ) { bset.add( Math.floor( k / N ) ); bset.add( k % N ); }
	const bv = [ ...bset ];
	const used = new Set();

	for ( let i = 0; i < bv.length; i ++ ) {

		const a = bv[ i ];
		if ( used.has( a ) ) continue;
		const cluster = [ a ];
		for ( let j = i + 1; j < bv.length; j ++ ) {

			const b = bv[ j ];
			if ( used.has( b ) ) continue;
			const dx = px[ a ] - px[ b ], dy = py[ a ] - py[ b ], dz = pz[ a ] - pz[ b ];
			if ( dx * dx + dy * dy + dz * dz < tol2 ) cluster.push( b );

		}

		if ( cluster.length < 2 ) continue;

		// tentatively merge the whole cluster onto its first vertex
		const remap = new Map(); for ( let c = 0; c < cluster.length; c ++ ) remap.set( cluster[ c ], a );
		const cand = [];
		const faceSet = new Set();
		for ( let t = 0; t < cur.length / 3; t ++ ) {

			let x = cur[ 3 * t ], y = cur[ 3 * t + 1 ], z = cur[ 3 * t + 2 ];
			if ( remap.has( x ) ) x = remap.get( x );
			if ( remap.has( y ) ) y = remap.get( y );
			if ( remap.has( z ) ) z = remap.get( z );
			if ( x === y || y === z || x === z ) continue;          // collapsed -> drop
			let lo = x, mid = y, hi = z;
			if ( lo > mid ) { const t0 = lo; lo = mid; mid = t0; }
			if ( mid > hi ) { const t0 = mid; mid = hi; hi = t0; }
			if ( lo > mid ) { const t0 = lo; lo = mid; mid = t0; }
			const fk = ( lo * N + mid ) * N + hi;
			if ( faceSet.has( fk ) ) continue;                       // drop duplicate face
			faceSet.add( fk );
			cand.push( x, y, z );

		}

		// accept only if manifold-safe (no edge > 2 uses) and open edges strictly decrease
		const cec = edgeCounts( cand );
		let ok = true, openNow = 0;
		for ( const c of cec.values() ) { if ( c > 2 ) { ok = false; break; } if ( c === 1 ) openNow ++; }
		if ( ! ok || openNow >= openCount ) continue;

		for ( let c = 0; c < cluster.length; c ++ ) used.add( cluster[ c ] );
		cur = cand;
		openCount = openNow;

	}

	return cur;

}

// unit normal of triangle (a,b,c)
function triNormal( a, b, c, px, py, pz ) {

	const ax = px[ a ], ay = py[ a ], az = pz[ a ];
	const ux = px[ b ] - ax, uy = py[ b ] - ay, uz = pz[ b ] - az;
	const vx = px[ c ] - ax, vy = py[ c ] - ay, vz = pz[ c ] - az;
	let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	const L = Math.hypot( nx, ny, nz ) || 1;
	return [ nx / L, ny / L, nz / L ];

}

// is v on the straight segment p->q (cos angle ~ 1)
function onSegment( p, v, q, px, py, pz, eps ) {

	const e1x = px[ v ] - px[ p ], e1y = py[ v ] - py[ p ], e1z = pz[ v ] - pz[ p ];
	const e2x = px[ q ] - px[ v ], e2y = py[ q ] - py[ v ], e2z = pz[ q ] - pz[ v ];
	const l1 = Math.hypot( e1x, e1y, e1z ), l2 = Math.hypot( e2x, e2y, e2z );
	if ( l1 === 0 || l2 === 0 ) return false;
	return ( e1x * e2x + e1y * e2y + e1z * e2z ) / ( l1 * l2 ) > 1 - eps;

}

// 2D ear-clip of an ordered loop of vertex ids (directed edges loop[i]->loop[i+1],
// closing loop[last]->loop[0]). Returns flat [a,b,c,...] in loop winding, or null on
// failure (non-simple, no ear, or a sliver child).
function earClipLoop( loop, normal, px, py, pz, sliverFloor ) {

	const n = loop.length;
	if ( n < 3 ) return null;

	// in-plane basis (u, w) from the normal
	const nx = normal[ 0 ], ny = normal[ 1 ], nz = normal[ 2 ];
	let ux, uy, uz;
	const ax = Math.abs( nx ), ay = Math.abs( ny ), az = Math.abs( nz );
	if ( ax <= ay && ax <= az ) { ux = 0; uy = - nz; uz = ny; }
	else if ( ay <= az ) { ux = - nz; uy = 0; uz = nx; }
	else { ux = - ny; uy = nx; uz = 0; }
	const ul = Math.hypot( ux, uy, uz ) || 1; ux /= ul; uy /= ul; uz /= ul;
	const wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux;

	const X = new Array( n ), Y = new Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const id = loop[ i ], x = px[ id ], y = py[ id ], z = pz[ id ];
		X[ i ] = x * ux + y * uy + z * uz;
		Y[ i ] = x * wx + y * wy + z * wz;

	}

	// signed area to fix winding for the convexity test
	let area = 0;
	for ( let i = 0; i < n; i ++ ) { const j = ( i + 1 ) % n; area += X[ i ] * Y[ j ] - X[ j ] * Y[ i ]; }
	const ccw = area > 0;
	const EPS = 1e-14;

	const V = []; for ( let i = 0; i < n; i ++ ) V.push( i );
	const out = [];
	let guard = 0;
	while ( V.length > 3 ) {

		let ear = - 1;
		const m = V.length;
		for ( let i = 0; i < m; i ++ ) {

			const ip = V[ ( i - 1 + m ) % m ], ic = V[ i ], in_ = V[ ( i + 1 ) % m ];
			const cross = ( X[ ic ] - X[ ip ] ) * ( Y[ in_ ] - Y[ ip ] ) - ( Y[ ic ] - Y[ ip ] ) * ( X[ in_ ] - X[ ip ] );
			if ( ccw ? cross <= EPS : cross >= - EPS ) continue; // reflex/degenerate
			// no other vertex strictly inside (ip,ic,in_)
			let bad = false;
			for ( let j = 0; j < m; j ++ ) {

				const q = V[ j ];
				if ( q === ip || q === ic || q === in_ ) continue;
				const d1 = ( X[ q ] - X[ ip ] ) * ( Y[ ic ] - Y[ ip ] ) - ( Y[ q ] - Y[ ip ] ) * ( X[ ic ] - X[ ip ] );
				const d2 = ( X[ q ] - X[ ic ] ) * ( Y[ in_ ] - Y[ ic ] ) - ( Y[ q ] - Y[ ic ] ) * ( X[ in_ ] - X[ ic ] );
				const d3 = ( X[ q ] - X[ in_ ] ) * ( Y[ ip ] - Y[ in_ ] ) - ( Y[ q ] - Y[ in_ ] ) * ( X[ ip ] - X[ in_ ] );
				if ( ( d1 > EPS && d2 > EPS && d3 > EPS ) || ( d1 < - EPS && d2 < - EPS && d3 < - EPS ) ) { bad = true; break; }

			}

			if ( bad ) continue;
			ear = i; break;

		}

		if ( ear === - 1 ) return null;
		const m2 = V.length;
		const ip = V[ ( ear - 1 + m2 ) % m2 ], ic = V[ ear ], in_ = V[ ( ear + 1 ) % m2 ];
		out.push( loop[ ip ], loop[ ic ], loop[ in_ ] );
		V.splice( ear, 1 );
		if ( ++ guard > n * n + 4 ) return null;

	}

	out.push( loop[ V[ 0 ] ], loop[ V[ 1 ] ], loop[ V[ 2 ] ] );

	// reject if any child is a sliver (keeps the result BVH well-formed)
	for ( let i = 0; i < out.length; i += 3 ) {

		if ( area2( px[ out[ i ] ], py[ out[ i ] ], pz[ out[ i ] ], px[ out[ i + 1 ] ], py[ out[ i + 1 ] ], pz[ out[ i + 1 ] ], px[ out[ i + 2 ] ], py[ out[ i + 2 ] ], pz[ out[ i + 2 ] ] ) < sliverFloor ) return null;

	}

	return out;

}

// Remove vertices that carry no shape: a vertex whose incident faces are all coplanar
// (flat interior) or form exactly two coplanar fans meeting along a straight crease
// through the vertex. Re-triangulating its 1-ring without it is geometry-exact (the
// removed vertex sits in the kept plane / on the kept crease line) and preserves the
// boundary, so the mesh stays watertight and manifold. Three-bvh-csg subdivides straight
// edges on every cut and never re-merges, so these accumulate ~2.4x over the iteration;
// this is what a kernel like Manifold collapses. Runs in passes (each removes an
// independent set) until no further removal.
function decimateCollinear( tris, px, py, pz, options ) {

	const normalEps = options.decimateNormalEps ?? 1e-3;   // |dot| > 1-eps => coplanar
	const colEps = options.decimateCollinearEps ?? 1e-6;
	const sliverFloor = options.sliverFloor ?? 1e-15;
	const maxPass = options.decimateMaxPass ?? 8;

	const N = px.length;
	const ekey = ( u, v ) => u < v ? u * N + v : v * N + u;

	for ( let pass = 0; pass < maxPass; pass ++ ) {

		const nTri = tris.length / 3 | 0;
		const inc = new Map();                              // vertex -> [triIdx...]
		const edgeSet = new Set();                          // every undirected edge present
		for ( let t = 0; t < nTri; t ++ ) {

			const a = tris[ 3 * t ], b = tris[ 3 * t + 1 ], c = tris[ 3 * t + 2 ];
			edgeSet.add( ekey( a, b ) ); edgeSet.add( ekey( b, c ) ); edgeSet.add( ekey( c, a ) );
			for ( let k = 0; k < 3; k ++ ) {

				const v = tris[ 3 * t + k ];
				let a2 = inc.get( v ); if ( ! a2 ) inc.set( v, a2 = [] ); a2.push( t );

			}

		}

		const removed = new Uint8Array( nTri );
		const liveEdges = new Set();                         // new diagonals committed this pass
		const newTris = [];
		let changed = false;

		for ( const [ v, triList ] of inc ) {

			let skip = false;
			for ( let i = 0; i < triList.length; i ++ ) if ( removed[ triList[ i ] ] ) { skip = true; break; }
			if ( skip ) continue;

			// oriented link: triangle (v,x,y) contributes directed link edge x->y
			const next = new Map();
			for ( let i = 0; i < triList.length; i ++ ) {

				const t = triList[ i ], a = tris[ 3 * t ], b = tris[ 3 * t + 1 ], c = tris[ 3 * t + 2 ];
				let x, y;
				if ( a === v ) { x = b; y = c; } else if ( b === v ) { x = c; y = a; } else { x = a; y = b; }
				if ( next.has( x ) ) { skip = true; break; }
				next.set( x, y );

			}

			if ( skip || next.size !== triList.length ) continue;

			// trace the single closed ring
			const ring = [];
			let start = next.keys().next().value, cur = start;
			let ok = true, guard = 0;
			do {

				ring.push( cur );
				cur = next.get( cur );
				if ( cur === undefined ) { ok = false; break; }
				if ( ++ guard > next.size + 2 ) { ok = false; break; }

			} while ( cur !== start );
			if ( ! ok || ring.length !== triList.length || ring.length < 3 ) continue;

			const k = ring.length;
			// per ring-edge normal: triangle (v, ring[i], ring[i+1])
			const en = [];
			for ( let i = 0; i < k; i ++ ) en.push( triNormal( v, ring[ i ], ring[ ( i + 1 ) % k ], px, py, pz ) );
			// feature vertices: edge v->ring[i] sits between en[i-1] and en[i]
			const feat = [];
			for ( let i = 0; i < k; i ++ ) {

				const n1 = en[ ( i - 1 + k ) % k ], n2 = en[ i ];
				if ( Math.abs( n1[ 0 ] * n2[ 0 ] + n1[ 1 ] * n2[ 1 ] + n1[ 2 ] * n2[ 2 ] ) < 1 - normalEps ) feat.push( i );

			}

			let fan = null;
			if ( feat.length === 0 ) {

				// flat interior: one coplanar polygon
				fan = earClipLoop( ring, en[ 0 ], px, py, pz, sliverFloor );

			} else if ( feat.length === 2 ) {

				const i0 = feat[ 0 ], i1 = feat[ 1 ], p = ring[ i0 ], q = ring[ i1 ];
				if ( ! onSegment( p, v, q, px, py, pz, colEps ) ) continue; // crease bends here => keep
				const arc1 = []; for ( let i = i0; ; i = ( i + 1 ) % k ) { arc1.push( ring[ i ] ); if ( i === i1 ) break; }
				const arc2 = []; for ( let i = i1; ; i = ( i + 1 ) % k ) { arc2.push( ring[ i ] ); if ( i === i0 ) break; }
				const f1 = earClipLoop( arc1, en[ i0 ], px, py, pz, sliverFloor );
				const f2 = earClipLoop( arc2, en[ i1 ], px, py, pz, sliverFloor );
				if ( f1 && f2 ) fan = f1.concat( f2 );

			} else continue; // corner (3+ planes) or curved => keep

			if ( ! fan ) continue;

			// Reject if any new diagonal the fan introduces already exists — either in the
			// mesh (a fold-over that would become a non-manifold edge / duplicate face) or
			// as another removal's new diagonal this pass. Ring-consecutive pairs are the
			// preserved boundary; everything else a fan introduces is new. Direct ring
			// neighbours are already excluded (they share the spoke triangles we remove, so
			// the removed-triangle check skips them), so only these edge collisions remain.
			const ringEdge = new Set();
			for ( let i = 0; i < k; i ++ ) ringEdge.add( ekey( ring[ i ], ring[ ( i + 1 ) % k ] ) );
			const diag = [];
			let collide = false;
			for ( let i = 0; i < fan.length && ! collide; i += 3 ) {

				const ev = [ ekey( fan[ i ], fan[ i + 1 ] ), ekey( fan[ i + 1 ], fan[ i + 2 ] ), ekey( fan[ i + 2 ], fan[ i ] ) ];
				for ( let j = 0; j < 3; j ++ ) {

					const e = ev[ j ];
					if ( ringEdge.has( e ) ) continue;
					if ( edgeSet.has( e ) || liveEdges.has( e ) ) { collide = true; break; }
					diag.push( e );

				}

			}

			if ( collide ) continue;

			for ( let i = 0; i < triList.length; i ++ ) removed[ triList[ i ] ] = 1;
			for ( let i = 0; i < diag.length; i ++ ) liveEdges.add( diag[ i ] );
			for ( let i = 0; i < fan.length; i ++ ) newTris.push( fan[ i ] );
			changed = true;

		}

		if ( ! changed ) break;
		const out = [];
		for ( let t = 0; t < nTri; t ++ ) if ( ! removed[ t ] ) out.push( tris[ 3 * t ], tris[ 3 * t + 1 ], tris[ 3 * t + 2 ] );
		for ( let i = 0; i < newTris.length; i ++ ) out.push( newTris[ i ] );
		tris = out;

	}

	return tris;

}

// Resolve non-manifold contacts by splitting into manifold-connected components.
// Two faces are connected only across a manifold (exactly-2-face) edge; faces meeting
// at a non-manifold edge (>2 faces, e.g. two solids unioned along a shared edge) or only
// at a shared vertex (corner contact) end up in different components. Each component then
// gets its own copy of any vertex it shares with another, so a 4-face edge becomes two
// 2-face edges and a pinch vertex splits — turning coincidental touches into the separate
// manifolds an exact kernel produces. A genuinely single connected result (the common
// case, incl. the terrain carve) has one component and is returned untouched.
function splitManifoldComponents( tris, srcOf ) {

	const nTri = tris.length / 3 | 0;
	if ( nTri === 0 ) return tris;
	const N = srcOf.length;                       // every tri index is < N here
	const ekey = ( u, v ) => u < v ? u * N + v : v * N + u;

	const ef = new Map();                         // edge -> face list
	for ( let t = 0; t < nTri; t ++ ) {

		const a = tris[ 3 * t ], b = tris[ 3 * t + 1 ], c = tris[ 3 * t + 2 ];
		for ( const [ u, v ] of [ [ a, b ], [ b, c ], [ c, a ] ] ) { const k = ekey( u, v ); let l = ef.get( k ); if ( ! l ) ef.set( k, l = [] ); l.push( t ); }

	}

	const parent = new Int32Array( nTri ); for ( let i = 0; i < nTri; i ++ ) parent[ i ] = i;
	const find = a => { while ( parent[ a ] !== a ) { parent[ a ] = parent[ parent[ a ] ]; a = parent[ a ]; } return a; };
	for ( const l of ef.values() ) if ( l.length === 2 ) parent[ find( l[ 0 ] ) ] = find( l[ 1 ] );

	let ncomp = 0; const compOf = new Int32Array( nTri ); const rootId = new Map();
	for ( let t = 0; t < nTri; t ++ ) { const r = find( t ); let id = rootId.get( r ); if ( id === undefined ) { id = ncomp ++; rootId.set( r, id ); } compOf[ t ] = id; }
	if ( ncomp <= 1 ) return tris;

	// give each component its own vertex copies (shared vertices get duplicated)
	const remap = new Map();                      // comp*N + origVert -> new index
	const out = new Array( tris.length );
	for ( let t = 0; t < nTri; t ++ ) {

		const comp = compOf[ t ];
		for ( let k = 0; k < 3; k ++ ) {

			const orig = tris[ 3 * t + k ];
			const mk = comp * N + orig;
			let nv = remap.get( mk );
			if ( nv === undefined ) { nv = srcOf.length; remap.set( mk, nv ); srcOf.push( srcOf[ orig ] ); }
			out[ 3 * t + k ] = nv;

		}

	}

	return out;

}

export function conformGeometry( geometry, options = {} ) {

	const index = geometry.index;
	const posAttr = geometry.attributes.position;
	if ( ! posAttr ) return geometry;

	const weldTol = options.weldTolerance ?? 1e-5;
	const conformTol = options.conformTolerance ?? Math.max( weldTol * 10, 1e-4 );
	const maxPass = options.maxPass ?? 8;
	// (2*area)^2 floor below which a triangle is a sliver. Sliver children poison
	// the downstream BVH (clustered, max-depth) and tank subsequent-op perf, so we
	// neither create them (skip the split) nor keep any (final drop).
	const sliverFloor = options.sliverFloor ?? 1e-15;

	const triCount = ( index ? index.count : posAttr.count ) / 3 | 0;
	const getIdx = index ? ( i => index.getX( i ) ) : ( i => i );

	const { px, py, pz, srcOf, remap } = weldPositions( geometry, weldTol );

	const areaEps = ( weldTol * weldTol ) * ( weldTol * weldTol );
	let tris = buildTriangles( index, remap, triCount, getIdx, px, py, pz, areaEps );

	// spatial hash of welded vertices for the conform search
	const cell = Math.max( conformTol * 4, 2e-3 );
	const cinv = 1 / cell;
	const grid = new Map();
	const gkey = ( x, y, z ) => cellHash( Math.floor( x * cinv ), Math.floor( y * cinv ), Math.floor( z * cinv ) );
	for ( let i = 0; i < px.length; i ++ ) {

		const k = gkey( px[ i ], py[ i ], pz[ i ] );
		let arr = grid.get( k );
		if ( ! arr ) grid.set( k, arr = [] );
		arr.push( i );

	}

	// Make the mesh edge-conforming: any vertex lying on the interior of a
	// triangle edge (boundary OR interior) becomes a shared vertex by fan-splitting
	// that triangle. Both triangles across an interior edge find the same on-edge
	// vertices (geometric search), so they subdivide consistently and stay manifold.
	const conformTol2 = conformTol * conformTol;
	for ( let pass = 0; pass < maxPass; pass ++ ) {

		// Count edge uses and collect boundary vertices. We split an edge when a
		// boundary vertex lies on its interior — boundary edges (to close T-junctions)
		// AND interior edges a seam chain crosses (the long-edge case where one side is
		// a single interior edge and the other is finely subdivided). Restricting splits
		// to boundary vertices keeps it bounded to the seam (no whole-mesh cascade).
		const edgeCount = new Map();
		const boundaryVerts = new Set();
		const nTriC = tris.length / 3;
		for ( let ti = 0; ti < nTriC; ti ++ ) {

			const a = tris[ 3 * ti ], b = tris[ 3 * ti + 1 ], c = tris[ 3 * ti + 2 ];
			const es = [ a, b, b, c, c, a ];
			for ( let e = 0; e < 3; e ++ ) {

				const u = es[ e * 2 ], v = es[ e * 2 + 1 ];
				const ek = u < v ? u * 1e7 + v : v * 1e7 + u;
				edgeCount.set( ek, ( edgeCount.get( ek ) || 0 ) + 1 );

			}

		}
		for ( const [ ek, count ] of edgeCount ) {

			if ( count === 1 ) { boundaryVerts.add( Math.floor( ek / 1e7 ) ); boundaryVerts.add( ek % 1e7 ); }

		}

		let changed = false;
		const newTris = [];
		const nTri = tris.length / 3;

		for ( let ti = 0; ti < nTri; ti ++ ) {

			const a = tris[ 3 * ti ], b = tris[ 3 * ti + 1 ], c = tris[ 3 * ti + 2 ];
			const corners = [ a, b, c ];
			let didSplit = false;

			for ( let e = 0; e < 3 && ! didSplit; e ++ ) {

				const u = corners[ e ], v = corners[ ( e + 1 ) % 3 ], w = corners[ ( e + 2 ) % 3 ];
				const ekk = u < v ? u * 1e7 + v : v * 1e7 + u;
				if ( edgeCount.get( ekk ) !== 1 ) continue; // only boundary edges (interior conforming cascades)
				const ux = px[ u ], uy = py[ u ], uz = pz[ u ];
				const ex = px[ v ] - ux, ey = py[ v ] - uy, ez = pz[ v ] - uz;
				const L2 = ex * ex + ey * ey + ez * ez;
				if ( L2 === 0 ) continue;
				const steps = Math.max( 1, ( Math.sqrt( L2 ) * cinv | 0 ) + 1 );

				// collect every interior on-edge vertex, then fan-split at all of them
				const onEdge = [];
				const considered = new Set();
				const seenCells = new Set();
				for ( let s = 0; s <= steps; s ++ ) {

					const tt = s / steps;
					const k = gkey( ux + tt * ex, uy + tt * ey, uz + tt * ez );
					if ( seenCells.has( k ) ) continue;
					seenCells.add( k );
					const bucket = grid.get( k );
					if ( ! bucket ) continue;
					for ( let bi = 0; bi < bucket.length; bi ++ ) {

						const q = bucket[ bi ];
						if ( q === u || q === v || q === w || considered.has( q ) ) continue;
						considered.add( q );
						if ( ! boundaryVerts.has( q ) ) continue; // only split at seam (boundary) vertices
						const t = ( ( px[ q ] - ux ) * ex + ( py[ q ] - uy ) * ey + ( pz[ q ] - uz ) * ez ) / L2;
						if ( t <= _EPS_PARAM || t >= 1 - _EPS_PARAM ) continue;
						const dx = px[ q ] - ( ux + t * ex ), dy = py[ q ] - ( uy + t * ey ), dz = pz[ q ] - ( uz + t * ez );
						if ( dx * dx + dy * dy + dz * dz < conformTol2 ) onEdge.push( [ t, q ] );

					}

				}

				if ( onEdge.length === 0 ) continue;
				onEdge.sort( ( p, q ) => p[ 0 ] - q[ 0 ] );
				const seq = [ u ];
				for ( let s = 0; s < onEdge.length; s ++ ) seq.push( onEdge[ s ][ 1 ] );
				seq.push( v );

				// reject if any fan child would be a sliver
				let ok = true;
				for ( let s = 0; s + 1 < seq.length; s ++ ) {

					if ( area2( px[ seq[ s ] ], py[ seq[ s ] ], pz[ seq[ s ] ], px[ seq[ s + 1 ] ], py[ seq[ s + 1 ] ], pz[ seq[ s + 1 ] ], px[ w ], py[ w ], pz[ w ] ) < sliverFloor ) { ok = false; break; }

				}

				if ( ! ok ) continue;
				for ( let s = 0; s + 1 < seq.length; s ++ ) newTris.push( seq[ s ], seq[ s + 1 ], w );
				didSplit = true;
				changed = true;

			}

			if ( ! didSplit ) newTris.push( a, b, c );

		}

		tris = newTris;
		if ( ! changed ) break;

	}

	// final pass: drop any remaining sliver triangles so the result BVH stays well-formed
	{

		const kept = [];
		const nTri = tris.length / 3;
		for ( let ti = 0; ti < nTri; ti ++ ) {

			const a = tris[ 3 * ti ], b = tris[ 3 * ti + 1 ], c = tris[ 3 * ti + 2 ];
			if ( area2( px[ a ], py[ a ], pz[ a ], px[ b ], py[ b ], pz[ b ], px[ c ], py[ c ], pz[ c ] ) >= sliverFloor ) {

				kept.push( a, b, c );

			}

		}

		tris = kept;

	}

	// Merge near-coincident boundary vertices (cross-op split-vertex seam tears) before
	// the structural closure: beyond weldTol but distinguishable as boundary-only.
	tris = boundaryWeld( tris, px, py, pz, options.boundaryWeldTolerance ?? 6e-4 );

	// Watertight closure. Every remaining boundary edge belongs to a thin closed loop —
	// either a seam TEAR (the two operands tessellated the same curve span differently)
	// or a small genuine HOLE. Trace each loop and:
	//   - ZIPPER a tear: its longest edge is one side of the tear; the opposite chain's
	//     vertices project onto that edge, so split the triangle owning it at exactly
	//     those vertices (precise edge-matched Steiner insertion — driven by the loop
	//     structure, not a lateral tolerance, so it never over-inserts). Each opposite
	//     chain edge then gains its reverse → the tear is sealed.
	//   - FILL a genuine small hole: fan with reversed winding.
	{

		const maxLoop = options.maxHoleEdges ?? 16;
		const maxFillArea2 = ( options.maxHoleArea ?? 2e-4 ) * ( options.maxHoleArea ?? 2e-4 ) * 4;
		const tearTol2 = ( options.zipperTolerance ?? 1e-2 ) * ( options.zipperTolerance ?? 1e-2 );
		const N = px.length;

		const present = new Set();
		const edgeTri = new Map();           // directed edge key -> owning triangle index
		const nTri = tris.length / 3;
		for ( let t = 0; t < nTri; t ++ ) {

			const a = tris[ 3 * t ], b = tris[ 3 * t + 1 ], c = tris[ 3 * t + 2 ];
			present.add( a * N + b ); present.add( b * N + c ); present.add( c * N + a );
			edgeTri.set( a * N + b, t ); edgeTri.set( b * N + c, t ); edgeTri.set( c * N + a, t );

		}

		const nextOf = new Map();
		for ( const e of present ) {

			const u = Math.floor( e / N ), v = e % N;
			if ( ! present.has( v * N + u ) ) {

				if ( ! nextOf.has( u ) ) nextOf.set( u, [] );
				nextOf.get( u ).push( v );

			}

		}

		const splitAt = new Map();           // triangle index -> { seq, apex }
		const fills = [];
		const usedEdge = new Set();
		const apexOf = ( ti, u, v ) => {

			const a = tris[ 3 * ti ], b = tris[ 3 * ti + 1 ], c = tris[ 3 * ti + 2 ];
			if ( a === u && b === v ) return c;
			if ( b === u && c === v ) return a;
			if ( c === u && a === v ) return b;
			return - 1;

		};

		for ( const [ startU, vs ] of nextOf ) {

			for ( const startV of vs ) {

				if ( usedEdge.has( startU * N + startV ) ) continue;

				// trace the boundary loop
				const loop = [ startU ];
				let cur = startV, okLoop = true;
				usedEdge.add( startU * N + startV );
				while ( cur !== startU ) {

					loop.push( cur );
					if ( loop.length > maxLoop ) { okLoop = false; break; }
					const outs = nextOf.get( cur );
					if ( ! outs ) { okLoop = false; break; }
					let nv = - 1;
					for ( const w of outs ) if ( ! usedEdge.has( cur * N + w ) ) { nv = w; break; }
					if ( nv === - 1 ) { okLoop = false; break; }
					usedEdge.add( cur * N + nv );
					cur = nv;

				}

				const n = loop.length;
				if ( ! okLoop || n < 3 ) continue;

				// longest loop edge loop[li] -> loop[li+1]
				let li = 0, bestL = - 1;
				for ( let i = 0; i < n; i ++ ) {

					const a = loop[ i ], b = loop[ ( i + 1 ) % n ];
					const dx = px[ b ] - px[ a ], dy = py[ b ] - py[ a ], dz = pz[ b ] - pz[ a ];
					const l = dx * dx + dy * dy + dz * dz;
					if ( l > bestL ) { bestL = l; li = i; }

				}

				const u = loop[ li ], v = loop[ ( li + 1 ) % n ];
				const ux = px[ u ], uy = py[ u ], uz = pz[ u ];
				const ex = px[ v ] - ux, ey = py[ v ] - uy, ez = pz[ v ] - uz;
				const L2 = ex * ex + ey * ey + ez * ez;

				// is the opposite chain a tear that projects onto the longest edge?
				const proj = [];
				let isTear = L2 > 0;
				for ( let k = 2; k < n && isTear; k ++ ) {

					const z = loop[ ( li + k ) % n ];
					if ( z === u || z === v ) { isTear = false; break; }
					const t = ( ( px[ z ] - ux ) * ex + ( py[ z ] - uy ) * ey + ( pz[ z ] - uz ) * ez ) / L2;
					if ( t <= 1e-6 || t >= 1 - 1e-6 ) { isTear = false; break; }
					const dpx = px[ z ] - ( ux + t * ex ), dpy = py[ z ] - ( uy + t * ey ), dpz = pz[ z ] - ( uz + t * ez );
					if ( dpx * dpx + dpy * dpy + dpz * dpz > tearTol2 ) { isTear = false; break; }
					proj.push( [ t, z ] );

				}

				if ( isTear && proj.length > 0 ) {

					// ZIPPER: split the triangle owning u->v at the opposite-chain vertices
					const ti = edgeTri.get( u * N + v );
					if ( ti === undefined || splitAt.has( ti ) ) continue;
					const apex = apexOf( ti, u, v );
					if ( apex === - 1 ) continue;
					proj.sort( ( p, q ) => p[ 0 ] - q[ 0 ] );
					const seq = [ u ];
					for ( let i = 0; i < proj.length; i ++ ) seq.push( proj[ i ][ 1 ] );
					seq.push( v );
					splitAt.set( ti, { seq, apex } );

				} else if ( n <= maxLoop ) {

					// FILL a small boundary loop (reversed winding), guarded against
					// duplicating existing faces / making non-manifold edges. A boolean of
					// closed inputs must yield a closed result, so any short loop is a tear
					// to seal regardless of its area — only the edge-count bound (maxLoop)
					// and the manifold guard below limit what we fill.
					const v0 = loop[ 0 ];
					for ( let i = 1; i + 1 < n; i ++ ) {

						const a = v0, b = loop[ i + 1 ], c = loop[ i ];
						const fa = area2( px[ a ], py[ a ], pz[ a ], px[ b ], py[ b ], pz[ b ], px[ c ], py[ c ], pz[ c ] );
						if ( fa < sliverFloor ) continue;
						if ( present.has( a * N + b ) || present.has( b * N + c ) || present.has( c * N + a ) ) continue;
						present.add( a * N + b ); present.add( b * N + c ); present.add( c * N + a );
						fills.push( a, b, c );

					}

				}

			}

		}

		// apply zipper splits + appended fills
		if ( splitAt.size > 0 || fills.length > 0 ) {

			const out = [];
			for ( let t = 0; t < nTri; t ++ ) {

				const s = splitAt.get( t );
				if ( s ) {

					const seq = s.seq, apex = s.apex;
					for ( let i = 0; i + 1 < seq.length; i ++ ) out.push( seq[ i ], seq[ i + 1 ], apex );

				} else {

					out.push( tris[ 3 * t ], tris[ 3 * t + 1 ], tris[ 3 * t + 2 ] );

				}

			}

			for ( let i = 0; i < fills.length; i ++ ) out.push( fills[ i ] );
			tris = out;

		}

	}

	// Collapse the straight-edge / coplanar subdivision vertices three-bvh-csg
	// accumulates each cut (geometry-exact, boundary-preserving) so they don't
	// compound over the iterated booleans. Runs after closure so the mesh is
	// already watertight (no boundary edges to disturb).
	if ( options.decimate !== false ) {

		tris = decimateCollinear( tris, px, py, pz, options );

	}

	// Split coincidental touches / non-manifold contacts into separate manifold pieces
	// (e.g. two cubes unioned along a shared edge or corner become two components, as an
	// exact kernel produces). No-op for a single connected result.
	if ( options.splitComponents !== false ) {

		tris = splitManifoldComponents( tris, srcOf );

	}

	// rebuild attributes — compact to only vertices still referenced (decimation
	// leaves the removed ones unused), remapping the index in place.
	const compact = new Int32Array( srcOf.length ).fill( - 1 ); // srcOf may have grown past px in the component split
	const keepSrc = [];
	for ( let i = 0; i < tris.length; i ++ ) {

		const v = tris[ i ];
		let w = compact[ v ];
		if ( w === - 1 ) { w = keepSrc.length; compact[ v ] = w; keepSrc.push( srcOf[ v ] ); }
		tris[ i ] = w;

	}

	const newCount = keepSrc.length;
	for ( const key in geometry.attributes ) {

		const attr = geometry.attributes[ key ];
		const itemSize = attr.itemSize;
		const ArrayType = attr.array.constructor;
		const arr = new ArrayType( newCount * itemSize );
		for ( let w = 0; w < newCount; w ++ ) {

			const src = keepSrc[ w ];
			for ( let c = 0; c < itemSize; c ++ ) arr[ w * itemSize + c ] = attr.array[ src * itemSize + c ];

		}

		geometry.setAttribute( key, new BufferAttribute( arr, itemSize, attr.normalized ) );

	}

	geometry.setIndex( new BufferAttribute( new Uint32Array( tris ), 1 ) );
	geometry.clearGroups();
	geometry.addGroup( 0, tris.length, 0 );
	geometry.setDrawRange( 0, tris.length );
	geometry.boundsTree = null;
	geometry.boundingBox = null;
	geometry.boundingSphere = null;

	return geometry;

}
