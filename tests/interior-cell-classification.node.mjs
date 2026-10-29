import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Triangle, Line3 } from 'three';
import { CDTTriangleSplitter } from '../src/core/CDTTriangleSplitter.js';
const data=t=>[t.a,t.b,t.c].map(p=>p.toArray());
const equals=(a,b)=>a.every((x,i)=>x===b[i]);

function pointCase(base,output,preimage,boundary=null){
 const s=new CDTTriangleSplitter();s.useSharedConstraints=true;s.float32Output=true;s.initialize(new Triangle(...base.map(p=>new Vector3(...p))));
 const p=new Vector3(...output);p.sourcePoint=new Vector3(...preimage);
 if(boundary)s.setBoundaryEdges(boundary(p));else s.addConstraintPoint(p);
 s.triangulate();
 const expected=s.baseTri.closestPointToPoint(p.sourcePoint,new Vector3()).toArray();let hits=0;
 for(let i=0;i<s.triangles.length;i++)for(let k=0;k<3;k++)if(equals(data(s.triangles[i])[k],output)){hits++;assert.deepEqual(data(s.classificationTriangles[i])[k],expected);}
 assert.ok(hits);assert.deepEqual(p.toArray(),output);assert.deepEqual(p.sourcePoint.toArray(),preimage);
 return expected;
}

test('non-corner output uses its unrounded preimage, not output or unrelated equal-position corners',()=>{
 const out=[.25,.25,0],q=[.25+2**-27,.25,0];assert.deepEqual(q.map(Math.fround),out);
 const actual=pointCase([[0,0,0],[1,0,0],[0,1,0]],out,q);assert.notDeepEqual(actual,out);
});

test('one Float32 step from a current corner is not a corner incidence',()=>{
 const out=[1+2**-23,1+2**-23,0],q=[1+3*2**-25,1+3*2**-25,0];
 assert.deepEqual(q.map(Math.fround),out);assert.notDeepEqual(pointCase([[1,1,0],[2,1,0],[1,2,0]],out,q),out);
});

test('rounding-only equality to a transformed Double corner does not assert exact current incidence',()=>{
 const base=[[1+2**-25,1,0],[2,1,0],[1,2,0]],out=[1,1,0],q=[1+2**-25,1+2**-26,0];
 assert.deepEqual(base[0].map(Math.fround),out);assert.deepEqual(q.map(Math.fround),out);
 const actual=pointCase(base,out,q,p=>[new Line3(p,new Vector3(...base[1])),new Line3(new Vector3(...base[1]),new Vector3(...base[2])),new Line3(new Vector3(...base[2]),p)]);
 assert.notDeepEqual(actual,base[0]);
});
