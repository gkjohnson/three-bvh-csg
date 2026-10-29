import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Matrix4, Vector3 } from 'three';
import { Brush, Evaluator, ADDITION } from '../src/index.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';
function brush( soup ) {
 // Exact coordinate-bit indexing for the synthetic tetrahedra, no tolerance welding.
 const map = new Map(),positions = [],indices = [],scalar = new Float32Array(1),bits = new Uint32Array(scalar.buffer);
 for ( let i = 0; i < soup.length; i += 3 ) {
  const p = Array.from( soup.subarray(i,i+3) ),key = p.map( x => { scalar[0]=x;return bits[0].toString(16); } ).join(':');
  if ( ! map.has(key) ) { map.set(key,positions.length/3);positions.push(...p); }indices.push(map.get(key));
 }
 const g = new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from(positions),3));g.setIndex(new BufferAttribute(Uint32Array.from(indices),1));
 const b = new Brush(g);b.updateMatrixWorld(true);return b;
}
function soup( b ) {
 const g = b.geometry,p = g.attributes.position,ix = g.index;
 return Float32Array.from( Array.from( {length:ix?ix.count:p.count}, (_,i)=>{const j=ix?ix.getX(i):i;return [p.getX(j),p.getY(j),p.getZ(j)];} ).flat() );
}
function assertClosedEdges( p ) {
 const edges=new Map();
 for(let i=0;i<p.length;i+=9) { const vs=[0,3,6].map(k=>Array.from(p.subarray(i+k,i+k+3)).join(','));for(let k=0;k<3;k++){const a=vs[k],b=vs[(k+1)%3],key=[a,b].sort().join('|');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(a<b?1:-1);} }
 assert.ok([...edges.values()].every(r=>r.length===2&&r[0]===-r[1]),'exact oriented edge closure (not a full geometry oracle)');
}
function evaluator( cdt=true,shared=true ) { const e=new Evaluator();e.attributes=['position'];e.useGroups=false;e.useCDTClipping=cdt;e.consistentCutSeams=shared;return e; }
function close( e,owned ) { for(const b of owned){b.disposeCacheData();b.geometry.dispose();}e.reset(); }


const tetra = [ [0,0,0],[1,0,0],[0,1,0],[0,0,1] ];
const faces = [ [0,2,1],[0,1,3],[0,3,2],[1,2,3] ];
function tetraSoup( size,translation=0,rotation=0 ) {
 const m=new Matrix4().makeRotationAxis(new Vector3(1,2,3).normalize(),rotation);
 return Float32Array.from(faces.flatMap(f=>f.flatMap(i=>new Vector3(...tetra[i]).multiplyScalar(size).add(new Vector3(translation,0,0)).applyMatrix4(m).toArray())));
}

test( 'whole faces survive both operand sides, scales, baked rotation and reflected frames', () => {
 for(const scale of [2**-30,.001,1,1000]) for(const swap of [false,true]) for(const reflected of [false,true]) {
  const e=evaluator(),a=brush(tetraSoup(scale,0,.37)),b=brush(tetraSoup(scale,8*scale,.37)),owned=[a,b];
  if(reflected)for(const x of owned){x.scale.x=-1;x.position.set(3,-4,2);x.updateMatrixWorld(true);}
  try {const r=e.evaluate(swap?b:a,swap?a:b,ADDITION);owned.push(r);const p=soup(r);assert.equal(p.length,8*9);assertClosedEdges(p);}
  finally {close(e,owned);}
 }
} );

test( 'inactive CDT and legacy retain their existing short-face filtering', () => {
 for(const cdt of [false,true]) {
  const e=evaluator(cdt,false),a=brush(tetraSoup(2**-30)),b=brush(tetraSoup(2**-30,8*2**-30)),owned=[a,b];
  try {const r=e.evaluate(a,b,ADDITION);owned.push(r);assert.equal(soup(r).length,0);}
  finally {close(e,owned);}
 }
} );

test( 'collector negative control: this output-only fix does not change its short-triangle rejection', () => {
 // Isolated faces test the collector predicate, not valid solid inputs or repair.
 const points=Float32Array.from([0,0,0,2**-30,0,0,0,1,0]),a=brush(points),b=brush(points);
 try {a.prepareGeometry();b.prepareGeometry();const r=collectIntersectingTriangles(a,b,true);assert.equal(r.aIntersections.ids.length,0);assert.equal(r.bIntersections.ids.length,0);assert.equal(r.cutRegistry,null);}
 finally {for(const item of [a,b]){item.disposeCacheData();item.geometry.dispose();}}
} );
